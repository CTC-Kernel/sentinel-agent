# Build script for Windows - Creates MSI installer
# Run as: powershell -ExecutionPolicy Bypass -File build-windows.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$BuildDir = Join-Path $ProjectDir "target\release"
$WixDir = Join-Path $ProjectDir "wix"
$AssetsDir = Join-Path $ProjectDir "assets\icons"
$Version = "1.0.0"

Write-Host "=== Building Sentinel Agent for Windows ===" -ForegroundColor Cyan
Write-Host "Project dir: $ProjectDir"

# Build release binary
Write-Host ""
Write-Host "1. Building release binary..." -ForegroundColor Yellow
Push-Location $ProjectDir
cargo build --release --package agent-core
Pop-Location

# Generate icons if not present
$IcoPath = Join-Path $AssetsDir "sentinel-agent.ico"
if (-not (Test-Path $IcoPath)) {
    Write-Host ""
    Write-Host "2. Generating icons..." -ForegroundColor Yellow
    Push-Location $AssetsDir
    python generate_icons.py 2>$null
    Pop-Location
}

# Check for WiX toolset
Write-Host ""
Write-Host "3. Checking WiX toolset..." -ForegroundColor Yellow
$WixInstalled = $null
try {
    $WixInstalled = Get-Command candle.exe -ErrorAction SilentlyContinue
} catch {}

if (-not $WixInstalled) {
    Write-Host "WiX toolset not found. Install from: https://wixtoolset.org/releases/"
    Write-Host "Or use: winget install WixToolset.WiX"
    exit 1
}

# Build MSI
Write-Host ""
Write-Host "4. Building MSI installer..." -ForegroundColor Yellow

$WxsFile = Join-Path $WixDir "sentinel-agent.wxs"
$WixObjFile = Join-Path $BuildDir "sentinel-agent.wixobj"
$MsiFile = Join-Path $BuildDir "SentinelAgentSetup-$Version.msi"

# Compile
candle.exe -nologo `
    -dVersion="$Version" `
    -dBuildDir="$BuildDir" `
    -dAssetsDir="$AssetsDir" `
    -o "$WixObjFile" `
    "$WxsFile"

# Link
light.exe -nologo `
    -ext WixUIExtension `
    -ext WixUtilExtension `
    -cultures:fr-FR `
    -o "$MsiFile" `
    "$WixObjFile"

# Cleanup
Remove-Item $WixObjFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Build complete ===" -ForegroundColor Green
Write-Host "MSI: $MsiFile"
Write-Host ""
Write-Host "To install:" -ForegroundColor Cyan
Write-Host "  1. Run the MSI as Administrator"
Write-Host "  2. Follow the installation wizard"
Write-Host "  3. The agent starts automatically"
