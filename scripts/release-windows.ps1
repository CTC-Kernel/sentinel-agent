# Build the Windows installer of the agent on a Windows machine, without
# GitHub Actions. Same steps as the build-windows job of
# .github/workflows/release.yml.
#
#   .\scripts\release-windows.ps1 -ServerUrl https://grc.example.com/fn/agentApi `
#       -ReleasesBaseUrl https://grc.example.com/releases/installer/agent
#
# Needs, once: Visual Studio Build Tools (Desktop development with C++),
# rustup, Strawberry Perl, the .NET SDK, Git and vcpkg. Run from a clean
# checkout of the release tag.
#
# The result is target\release\SentinelAgentSetup-<version>.msi. Hand it to
# scripts/release-vps.sh add-windows on the machine that publishes, or pass
# -CopyTo user@host:/path to send it there with scp.
#
# The MSI is not code-signed here: SmartScreen warns at install. Sign it
# with your certificate (signtool) before publishing if you have one.
param(
    [Parameter(Mandatory = $true)][string]$ServerUrl,
    [Parameter(Mandatory = $true)][string]$ReleasesBaseUrl,
    [string]$UpdatePubKey = "",
    [string]$VcpkgRoot = "C:\vcpkg",
    [string]$Perl = "C:\Strawberry\perl\bin\perl.exe",
    [string]$CopyTo = ""
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Fail($message) { Write-Error $message; exit 1 }
function Run { & $args[0] $args[1..($args.Length - 1)]; if ($LASTEXITCODE -ne 0) { Fail "$($args -join ' ') failed ($LASTEXITCODE)" } }

$version = (Select-String -Path Cargo.toml -Pattern '^\s*version\s*=\s*"([^"]+)"' | Select-Object -First 1).Matches[0].Groups[1].Value
if (-not $version) { Fail "Could not read the version from Cargo.toml" }
if (git status --porcelain) { Fail "The working tree has changes: release from a clean checkout" }
if ((git describe --exact-match --tags HEAD 2>$null) -ne "v$version") { Fail "HEAD is not the tag v$version" }
foreach ($tool in "cargo", "dotnet", "git") {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "$tool is not installed" }
}
if (-not (Test-Path $Perl)) { Fail "Perl not found at $Perl (OpenSSL is compiled from source and needs it)" }

Write-Host "Building Sentinel Agent $version for Windows"

# Compiled into the agent.
$env:SENTINEL_SERVER_URL = $ServerUrl
$env:SENTINEL_RELEASES_BASE_URL = $ReleasesBaseUrl
if ($UpdatePubKey) { $env:SENTINEL_UPDATE_PUBKEY = $UpdatePubKey }

Run "$VcpkgRoot\vcpkg.exe" install openssl:x64-windows-static-md
$env:OPENSSL_DIR = "$VcpkgRoot\packages\openssl_x64-windows-static-md"
$env:OPENSSL_STATIC = "1"
$env:PERL = $Perl -replace '\\', '/'

# The build scripts look for the icon beside each crate.
foreach ($dir in "crates\agent-gui\assets\icons", "crates\agent-core\assets\icons") {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Copy-Item "assets\icons\sentinel-agent.ico" $dir -Force
}
Run cargo build --release --features gui --package agent-core --no-default-features
if (-not (Test-Path "target\release\agent-core.exe")) { Fail "agent-core.exe was not produced" }

if (-not (Get-Command wix -ErrorAction SilentlyContinue)) {
    Run dotnet tool install --global wix --version 4.0.0
    $env:PATH += ";$env:USERPROFILE\.dotnet\tools"
}
foreach ($extension in "WixToolset.UI.wixext", "WixToolset.Util.wixext", "WixToolset.Firewall.wixext") {
    Run wix extension add -g "$extension/4.0.0"
}

$msi = "target\release\SentinelAgentSetup-$version.msi"
Run wix build `
    -d "TargetDir=.\target\release" `
    -d "Version=$version" `
    -d "AssetsDir=.\assets" `
    -d "ServerUrl=$ServerUrl" `
    -o $msi `
    wix/main.wxs `
    -ext WixToolset.UI.wixext -ext WixToolset.Util.wixext -ext WixToolset.Firewall.wixext
if (-not (Test-Path $msi)) { Fail "The MSI was not produced" }

$hash = (Get-FileHash $msi -Algorithm SHA256).Hash.ToLower()
Write-Host "Built $msi"
Write-Host "SHA-256 $hash"
Write-Host ""
Write-Host "Before publishing, install it on this machine and check that:"
Write-Host "  1. the SentinelGRCAgent service starts and the interface shows data;"
Write-Host "  2. a protected action asks for the administrator password;"
Write-Host "  3. after the service is stopped and started, the interface reconnects by itself."

if ($CopyTo) {
    Run scp $msi $CopyTo
    Write-Host "Sent to $CopyTo. On that machine: scripts/release-vps.sh add-windows <msi>, then publish."
}
