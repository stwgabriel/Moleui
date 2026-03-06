# Mole - Analyze Command
# Disk space analyzer wrapper

#Requires -Version 5.1
param(
    [Parameter(Position = 0)]
    [string]$Path,
    
    [Alias('h')]
    [switch]$ShowHelp
)

$ErrorActionPreference = "Stop"

# Script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$windowsDir = Split-Path -Parent $scriptDir
$defaultBinPath = Join-Path $windowsDir "bin\analyze.exe"
. (Join-Path $windowsDir "lib\core\tui_binaries.ps1")

# Help
function Show-AnalyzeHelp {
    $esc = [char]27
    Write-Host ""
    Write-Host "$esc[1;35mmo analyze$esc[0m - Interactive disk space analyzer"
    Write-Host ""
    Write-Host "$esc[33mUsage:$esc[0m mo analyze [path]"
    Write-Host ""
    Write-Host "$esc[33mOptions:$esc[0m"
    Write-Host "  [path]     Path to analyze (default: user profile)"
    Write-Host "  --help     Show this help message"
    Write-Host ""
    Write-Host "$esc[33mKeybindings:$esc[0m"
    Write-Host "  Up/Down      Navigate entries"
    Write-Host "  Enter        Enter directory"
    Write-Host "  Backspace    Go back"
    Write-Host "  Space        Multi-select"
    Write-Host "  d            Delete selected"
    Write-Host "  f            Toggle large files view"
    Write-Host "  o            Open in Explorer"
    Write-Host "  r            Refresh"
    Write-Host "  q            Quit"
    Write-Host ""
}

if ($ShowHelp) {
    Show-AnalyzeHelp
    return
}

$binPath = Ensure-TuiBinary -Name "analyze" -WindowsDir $windowsDir -DestinationPath $defaultBinPath -SourcePath "./cmd/analyze/"
if (-not $binPath) {
    Write-Host "Analyze binary not found, no prerelease asset was available, and Go 1.24+ is not installed." -ForegroundColor Red
    Write-Host "Install Go or wait for a Windows prerelease asset that includes analyze.exe." -ForegroundColor Yellow
    exit 1
}

# Set path environment variable if provided
if ($Path) {
    $env:MO_ANALYZE_PATH = $Path
}

# Run the binary
& $binPath
