$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "reset-mysql-root-elevated.ps1"
$logPath = Join-Path $PSScriptRoot "mysql-root-reset.log"
$resultPath = Join-Path $PSScriptRoot "mysql-install-result.txt"

Remove-Item -LiteralPath $logPath, $resultPath -Force -ErrorAction SilentlyContinue

$command = @"
`$ErrorActionPreference = "Stop"
try {
    & "$scriptPath" -ResultPath "$resultPath" -LogPath "$logPath"
    exit 0
} catch {
    Add-Content -LiteralPath "$logPath" -Value `$_.Exception.ToString()
    exit 1
}
"@

$encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
$process = Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedCommand) `
    -Verb RunAs `
    -Wait `
    -PassThru

exit $process.ExitCode
