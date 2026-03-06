# Mole - Status Command
# System status monitor wrapper

#Requires -Version 5.1
param(
    [Alias('h')]
    [switch]$ShowHelp
)

$ErrorActionPreference = "Stop"

# Script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsDir = Split-Path -Parent $scriptDir
$defaultBinPath = Join-Path $windowsDir "bin\status.exe"
. (Join-Path $windowsDir "lib\core\tui_binaries.ps1")

# Help
function Show-StatusHelp {
    $esc = [char]27
    Write-Host ""
    Write-Host "$esc[1;35mmo status$esc[0m - Real-time system health monitor"
    Write-Host ""
    Write-Host "$esc[33mUsage:$esc[0m mo status"
    Write-Host ""
    Write-Host "$esc[33mOptions:$esc[0m"
    Write-Host "  --help     Show this help message"
    Write-Host ""
    Write-Host "$esc[33mDisplays:$esc[0m"
    Write-Host "  - System health score (0-100)"
    Write-Host "  - CPU usage and model"
    Write-Host "  - Memory and swap usage"
    Write-Host "  - Disk space per drive"
    Write-Host "  - Top processes by CPU"
    Write-Host "  - Network interfaces"
    Write-Host ""
    Write-Host "$esc[33mKeybindings:$esc[0m"
    Write-Host "  c            Toggle mole animation"
    Write-Host "  r            Force refresh"
    Write-Host "  q            Quit"
    Write-Host ""
}

if ($ShowHelp) {
    Show-StatusHelp
    return
}

$binPath = Ensure-TuiBinary -Name "status" -WindowsDir $windowsDir -DestinationPath $defaultBinPath -SourcePath "./cmd/status/"
if (-not $binPath) {
    Write-Host "Status binary not found, no prerelease asset was available, and Go 1.24+ is not installed." -ForegroundColor Red
    Write-Host "Install Go or wait for a Windows prerelease asset that includes status.exe." -ForegroundColor Yellow
    exit 1
}

# Run the binary
& $binPath
