# Sentinel GRC Agent - MSI Build Script
# Requires: WiX Toolset v4, Rust toolchain

param(
    [string]$Configuration = "Release",
    [string]$OutputDir = ".\output",
    [string]$Version = "0.1.0"
)

$ErrorActionPreference = "Stop"

Write-Host "Building Sentinel GRC Agent MSI Installer" -ForegroundColor Cyan
Write-Host "Configuration: $Configuration"
Write-Host "Version: $Version"
Write-Host ""

# Ensure we're in the right directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

# Step 1: Build the Rust binary
Write-Host "Step 1: Building Rust binary..." -ForegroundColor Yellow
cargo build --release --package agent-core
if ($LASTEXITCODE -ne 0) {
    Write-Error "Rust build failed"
    exit 1
}

# Verify binary exists
$BinaryPath = ".\target\release\agent-core.exe"
if (-not (Test-Path $BinaryPath)) {
    Write-Error "Binary not found at $BinaryPath"
    exit 1
}
Write-Host "Binary built successfully: $BinaryPath" -ForegroundColor Green

# Step 2: Create output directory
Write-Host "`nStep 2: Creating output directory..." -ForegroundColor Yellow
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

# Step 3: Build MSI with WiX
Write-Host "`nStep 3: Building MSI with WiX..." -ForegroundColor Yellow

# Check if WiX is installed
$WixPath = Get-Command wix -ErrorAction SilentlyContinue
if (-not $WixPath) {
    Write-Host "WiX not found. Installing via dotnet tool..." -ForegroundColor Yellow
    dotnet tool install --global wix
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install WiX"
        exit 1
    }
}

# Build the MSI
$MsiOutput = Join-Path $OutputDir "sentinel-agent-$Version.msi"
$WxsFile = Join-Path $ScriptDir "main.wxs"

# Add required WiX extensions
wix extension add WixToolset.UI.wixext
wix extension add WixToolset.Util.wixext
wix extension add WixToolset.Firewall.wixext

wix build `
    -d "TargetDir=.\target\release" `
    -d "AssetsDir=.\assets" `
    -d "Version=$Version" `
    -ext WixToolset.UI.wixext `
    -ext WixToolset.Util.wixext `
    -ext WixToolset.Firewall.wixext `
    -o $MsiOutput `
    $WxsFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "WiX build failed"
    exit 1
}

Write-Host "`nMSI built successfully: $MsiOutput" -ForegroundColor Green

# Step 4: Verify MSI
Write-Host "`nStep 4: Verifying MSI..." -ForegroundColor Yellow
$MsiInfo = Get-Item $MsiOutput
Write-Host "  File: $($MsiInfo.Name)"
Write-Host "  Size: $([math]::Round($MsiInfo.Length / 1MB, 2)) MB"
Write-Host "  Created: $($MsiInfo.CreationTime)"

# Step 5: Generate checksums
Write-Host "`nStep 5: Generating checksums..." -ForegroundColor Yellow
$Sha256 = Get-FileHash -Path $MsiOutput -Algorithm SHA256
$ChecksumFile = Join-Path $OutputDir "sentinel-agent-$Version.msi.sha256"
"$($Sha256.Hash.ToLower())  sentinel-agent-$Version.msi" | Out-File -FilePath $ChecksumFile -Encoding ASCII

Write-Host "SHA256: $($Sha256.Hash.ToLower())"
Write-Host "Checksum file: $ChecksumFile"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation commands:"
Write-Host "  Silent install:"
Write-Host "    msiexec /i $MsiOutput /qn"
Write-Host ""
Write-Host "  With custom server:"
Write-Host "    msiexec /i $MsiOutput /qn SERVERURL=https://api.example.com"
Write-Host ""
Write-Host "  With enrollment token:"
Write-Host "    msiexec /i $MsiOutput /qn ENROLLMENTTOKEN=your-token-here"
