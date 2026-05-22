param(
    [string]$InstallDir = "C:\mysql",
    [string]$ServiceName = "MySQL84",
    [string]$ZipUrl = "https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.9-winx64.zip",
    [string]$ZipPath = "",
    [string]$ResultPath = (Join-Path $PSScriptRoot "mysql-install-result.txt"),
    [string]$LogPath = (Join-Path $PSScriptRoot "mysql-install.log")
)

$ErrorActionPreference = "Stop"
$transcriptStarted = $false

function Assert-Admin {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "This installer must be run from an elevated PowerShell session."
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
    $password = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "A").Replace("/", "B")
    return "MySQL-" + $password
}

Assert-Admin

try {
    Start-Transcript -LiteralPath $LogPath -Force | Out-Null
    $transcriptStarted = $true
} catch {
    Write-Warning "Could not start transcript at '$LogPath': $($_.Exception.Message)"
}

if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    throw "Windows service '$ServiceName' already exists."
}

if (Test-Path $InstallDir) {
    $existingMysql = Test-Path (Join-Path $InstallDir "bin\mysqld.exe")
    $existingDataDir = Join-Path $InstallDir "data"
    $existingDataItems = @()
    if (Test-Path $existingDataDir) {
        $existingDataItems = @(Get-ChildItem -LiteralPath $existingDataDir -Force -ErrorAction SilentlyContinue)
    }

    if ($existingMysql -and $existingDataItems.Count -eq 0) {
        Write-Host "Removing partial MySQL install at '$InstallDir'"
        Remove-Item -LiteralPath $InstallDir -Recurse -Force
    } else {
        throw "Install directory '$InstallDir' already exists. Refusing to overwrite it."
    }
}

$portInUse = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if ($portInUse) {
    throw "Port 3306 is already in use."
}

$tempDir = Join-Path $env:TEMP ("mysql-install-" + [Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempDir "mysql.zip"
$extractDir = Join-Path $tempDir "extract"

New-Item -ItemType Directory -Path $tempDir, $extractDir | Out-Null

try {
    if ($ZipPath -and (Test-Path $ZipPath)) {
        Write-Host "Using local MySQL ZIP at $ZipPath"
        Copy-Item -LiteralPath $ZipPath -Destination $zipPath
    } else {
        Write-Host "Downloading MySQL from $ZipUrl"
        Invoke-WebRequest -Uri $ZipUrl -OutFile $zipPath -UseBasicParsing
    }

    Write-Host "Extracting MySQL ZIP"
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir

    $expandedRoot = Get-ChildItem -LiteralPath $extractDir -Directory | Select-Object -First 1
    if (-not $expandedRoot) {
        throw "Could not find extracted MySQL directory."
    }

    Move-Item -LiteralPath $expandedRoot.FullName -Destination $InstallDir

    $dataDir = Join-Path $InstallDir "data"
    $logDir = Join-Path $InstallDir "logs"
    New-Item -ItemType Directory -Path $dataDir, $logDir | Out-Null

    $myIni = Join-Path $InstallDir "my.ini"
    $myIniContent = @"
[client]
port=3306
default-character-set=utf8mb4

[mysqld]
basedir=$($InstallDir.Replace('\', '/'))
datadir=$($dataDir.Replace('\', '/'))
port=3306
bind-address=127.0.0.1
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
log-error=$((Join-Path $logDir 'mysql-error.log').Replace('\', '/'))
"@
    Set-Content -LiteralPath $myIni -Value $myIniContent -Encoding ASCII

    $mysqld = Join-Path $InstallDir "bin\mysqld.exe"
    $mysql = Join-Path $InstallDir "bin\mysql.exe"

    Write-Host "Initializing MySQL data directory"
    & $mysqld --defaults-file="$myIni" --initialize-insecure --console
    if ($LASTEXITCODE -ne 0) {
        throw "mysqld --initialize-insecure failed with exit code $LASTEXITCODE."
    }

    Write-Host "Installing Windows service '$ServiceName'"
    & $mysqld --install $ServiceName --defaults-file="$myIni"
    if ($LASTEXITCODE -ne 0) {
        throw "mysqld --install failed with exit code $LASTEXITCODE."
    }

    Start-Service -Name $ServiceName

    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            & $mysql -u root --protocol=tcp -h 127.0.0.1 -e "SELECT 1" *> $null
            if ($LASTEXITCODE -eq 0) {
                $ready = $true
                break
            }
        } catch {
        }
    }
    if (-not $ready) {
        throw "MySQL service started, but mysql client did not become ready within 30 seconds."
    }

    $rootPassword = New-RandomPassword
    $escapedRootPassword = $rootPassword.Replace('\', '\\').Replace("'", "\'")
    & $mysql -u root --protocol=tcp -h 127.0.0.1 -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$escapedRootPassword'; FLUSH PRIVILEGES;"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set root password."
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

    Write-Host ""
    $resultLines = @(
        "MYSQL_INSTALL_OK",
        "InstallDir=$InstallDir",
        "ServiceName=$ServiceName",
        "RootUser=root",
        "RootPassword=$rootPassword",
        "ConnectCommand=mysql -u root -p -h 127.0.0.1"
    )
    Set-Content -LiteralPath $ResultPath -Value $resultLines -Encoding ASCII

    Write-Host "MYSQL_INSTALL_OK"
    Write-Host "InstallDir=$InstallDir"
    Write-Host "ServiceName=$ServiceName"
    Write-Host "RootUser=root"
    Write-Host "RootPassword=$rootPassword"
    Write-Host "ConnectCommand=mysql -u root -p -h 127.0.0.1"
} finally {
    if (Test-Path $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    if ($transcriptStarted) {
        Stop-Transcript | Out-Null
    }
}
