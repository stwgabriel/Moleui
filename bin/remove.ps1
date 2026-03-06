# Mole - Remove Command
# Removes Mole from the current installation directory.

#Requires -Version 5.1
param(
    [Alias('h')]
    [switch]$ShowHelp
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsDir = Split-Path -Parent $scriptDir
$installScript = Join-Path $windowsDir "install.ps1"

function Show-RemoveHelp {
    $esc = [char]27
    Write-Host ""
    Write-Host "$esc[1;35mmo remove$esc[0m - Remove Mole from this system"
    Write-Host ""
    Write-Host "$esc[33mUsage:$esc[0m mo remove"
    Write-Host ""
    Write-Host "$esc[33mBehavior:$esc[0m"
    Write-Host "  - Removes the current Mole installation directory"
    Write-Host "  - Removes PATH entries created for this install"
    Write-Host "  - Prompts before deleting Mole config files"
    Write-Host ""
}

if ($ShowHelp) {
    Show-RemoveHelp
    return
}

if (-not (Test-Path $installScript)) {
    Write-Host "Installer not found at: $installScript" -ForegroundColor Red
    exit 1
}

& $installScript -InstallDir $windowsDir -Uninstall
