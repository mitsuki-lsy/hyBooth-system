param(
    [string]$InstallDir = "C:\mysql",
    [string]$ServiceName = "MySQL84",
    [string]$ResultPath = (Join-Path $PSScriptRoot "mysql-install-result.txt"),
    [string]$LogPath = (Join-Path $PSScriptRoot "mysql-root-reset.log")
)

$ErrorActionPreference = "Stop"
$transcriptStarted = $false

function Assert-Admin {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "This script must be run from an elevated PowerShell session."
    }
}

function New-RandomPassword {
    $bytes = New-Object byte[] 24
    $rng = [Security.Cryptography.RNGCryptoServiceProvider]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }
    return "MySQL-" + ([Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "A").Replace("/", "B"))
}

function Wait-MySqlReady {
    param(
        [string]$MysqlAdmin,
        [string]$Password
    )

    $oldPwd = $env:MYSQL_PWD
    $env:MYSQL_PWD = $Password
    try {
        for ($i = 0; $i -lt 45; $i++) {
            Start-Sleep -Seconds 1
            & $MysqlAdmin --connect-timeout=3 -u root --protocol=tcp -h 127.0.0.1 ping *> $null
            if ($LASTEXITCODE -eq 0) {
                return $true
            }
        }
        return $false
    } finally {
        if ($null -eq $oldPwd) {
            Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
        } else {
            $env:MYSQL_PWD = $oldPwd
        }
    }
}

Assert-Admin

try {
    Start-Transcript -LiteralPath $LogPath -Force | Out-Null
    $transcriptStarted = $true

    $myIni = Join-Path $InstallDir "my.ini"
    $mysqld = Join-Path $InstallDir "bin\mysqld.exe"
    $mysqladmin = Join-Path $InstallDir "bin\mysqladmin.exe"
    $initFile = Join-Path $InstallDir "reset-root.sql"

    if (-not (Test-Path $myIni)) { throw "Missing $myIni" }
    if (-not (Test-Path $mysqld)) { throw "Missing $mysqld" }
    if (-not (Test-Path $mysqladmin)) { throw "Missing $mysqladmin" }

    $rootPassword = New-RandomPassword
    Set-Content -LiteralPath $initFile -Value "ALTER USER 'root'@'localhost' IDENTIFIED BY '$rootPassword';" -Encoding ASCII

    if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
        Write-Host "Stopping service '$ServiceName'"
        Stop-Service -Name $ServiceName -Force
        for ($i = 0; $i -lt 30; $i++) {
            $service = Get-Service -Name $ServiceName
            if ($service.Status -eq "Stopped") { break }
            Start-Sleep -Seconds 1
        }
    }

    Write-Host "Starting temporary mysqld with init-file"
    $process = Start-Process -FilePath $mysqld `
        -ArgumentList @("--defaults-file=$myIni", "--init-file=$initFile", "--console") `
        -WindowStyle Hidden `
        -PassThru

    try {
        if (-not (Wait-MySqlReady -MysqlAdmin $mysqladmin -Password $rootPassword)) {
            throw "Temporary mysqld did not accept the new root password within 45 seconds."
        }

        $oldPwd = $env:MYSQL_PWD
        $env:MYSQL_PWD = $rootPassword
        try {
            & $mysqladmin -u root --protocol=tcp -h 127.0.0.1 shutdown
            if ($LASTEXITCODE -ne 0) {
                throw "mysqladmin shutdown failed with exit code $LASTEXITCODE."
            }
        } finally {
            if ($null -eq $oldPwd) {
                Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
            } else {
                $env:MYSQL_PWD = $oldPwd
            }
        }

        Wait-Process -Id $process.Id -Timeout 30
    } finally {
        if (-not $process.HasExited) {
            Stop-Process -Id $process.Id -Force
        }
        Remove-Item -LiteralPath $initFile -Force -ErrorAction SilentlyContinue
    }

    $myIniContent = Get-Content -LiteralPath $myIni -Raw
    if ($myIniContent -notmatch "(?m)^mysqlx-bind-address=") {
        Add-Content -LiteralPath $myIni -Value "mysqlx-bind-address=127.0.0.1" -Encoding ASCII
    }

    Write-Host "Starting service '$ServiceName'"
    Start-Service -Name $ServiceName
    if (-not (Wait-MySqlReady -MysqlAdmin $mysqladmin -Password $rootPassword)) {
        throw "MySQL service did not accept the new root password after restart."
    }

    $binDir = Join-Path $InstallDir "bin"
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $pathEntries = @()
    if ($userPath) {
        $pathEntries = @($userPath -split ";" | Where-Object { $_ -ne "" })
    }
    if ($pathEntries -notcontains $binDir) {
        $newUserPath = ($pathEntries + $binDir) -join ";"
        [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
    }

    $resultLines = @(
        "MYSQL_INSTALL_OK",
        "InstallDir=$InstallDir",
        "ServiceName=$ServiceName",
        "RootUser=root",
        "RootPassword=$rootPassword",
        "ConnectCommand=mysql -u root -p -h 127.0.0.1"
    )
    Set-Content -LiteralPath $ResultPath -Value $resultLines -Encoding ASCII
    Write-Host "MYSQL_ROOT_RESET_OK"
} finally {
    if ($transcriptStarted) {
        Stop-Transcript | Out-Null
    }
}
