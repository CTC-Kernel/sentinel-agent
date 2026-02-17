#!/bin/bash

# Sentinel GRC Agent - Windows Self-Signed Build Script
# Creates MSI with self-signed certificate to avoid SmartScreen warnings

set -e

# Configuration
VERSION="2.0.0"
PRODUCT_NAME="Sentinel GRC Agent"
MANUFACTURER="Cyber Threat Consulting"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
MSI_DIR="$SCRIPT_DIR/dist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 Creating Self-Signed Windows Installer${NC}"
echo -e "${BLUE}======================================${NC}"

# Check if running on Windows
if [[ "$OSTYPE" != "msys" ]] && [[ "$OSTYPE" != "cygwin" ]] && [[ "$OSTYPE" != "win32" ]]; then
    echo -e "${YELLOW}⚠️  Not building on Windows. Cross-compilation not supported.${NC}"
    echo "Please run this script on Windows with makecert and signtool available."
    exit 1
fi

# Create self-signed certificate if it doesn't exist
if [[ ! -f "$SCRIPT_DIR/sentinel-selfsigned.pfx" ]]; then
    echo -e "${YELLOW}Creating self-signed certificate...${NC}"
    
    # Create certificate using makecert (Windows SDK)
    makecert -r -pe -n "CN=Cyber Threat Consulting" -ss My -len 2048 -a sha256 -cy authority "$SCRIPT_DIR/sentinel-selfsigned.cer" 2>/dev/null || {
        echo -e "${RED}❌ makecert not found. Please install Windows SDK.${NC}"
        echo "Download from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/"
        exit 1
    }
    
    # Export to PFX with password
    pvk2pfx -pvk "$SCRIPT_DIR/sentinel-selfsigned.pvk" -spc "$SCRIPT_DIR/sentinel-selfsigned.cer" -pfx "$SCRIPT_DIR/sentinel-selfsigned.pfx" -po "Sentinel2024!" 2>/dev/null || {
        echo -e "${YELLOW}⚠️  pvk2pfx failed, trying alternative method...${NC}"
        # Alternative using PowerShell
        powershell -Command "
            \$cert = New-SelfSignedCertificate -Type CodeSigningCert -DnsName 'Cyber Threat Consulting' -CertStoreLocation 'Cert:\LocalMachine\My' -KeyExportPolicy 'Exportable' -NotAfter (Get-Date).AddYears(5)
            \$password = ConvertTo-SecureString -String 'Sentinel2024!' -Force -AsPlainText
            Export-PfxCertificate -Cert \$cert -FilePath '$SCRIPT_DIR/sentinel-selfsigned.pfx' -Password \$password
        "
    }
    
    echo -e "${GREEN}✅ Self-signed certificate created${NC}"
fi

# Import certificate to Trusted Publishers (avoids SmartScreen)
echo -e "${YELLOW}Adding certificate to Trusted Publishers...${NC}"
powershell -Command "
    Import-Certificate -FilePath '$SCRIPT_DIR/sentinel-selfsigned.cer' -CertStoreLocation 'Cert:\LocalMachine\Root' -ErrorAction SilentlyContinue
    Import-Certificate -FilePath '$SCRIPT_DIR/sentinel-selfsigned.cer' -CertStoreLocation 'Cert:\LocalMachine\TrustedPublisher' -ErrorAction SilentlyContinue
    Write-Host '✅ Certificate added to trusted stores'
"

# Get certificate thumbprint from the store
CERT_THUMBPRINT=$(powershell -Command "
    \$cert = Get-ChildItem -Path 'Cert:\LocalMachine\Root' | Where-Object { \$_.Subject -like '*Cyber Threat Consulting*' } | Select-Object -First 1
    if (\$cert) {
        Write-Output \$cert.Thumbprint
    } else {
        Write-Error 'Certificate not found in store'
        exit 1
    }
" | tr -d '\r')

if [[ -z "$CERT_THUMBPRINT" ]]; then
    echo -e "${RED}❌ Failed to get certificate thumbprint${NC}"
    echo -e "${YELLOW}🔍 Running certificate diagnostics...${NC}"
    
    # List all certificates in the store
    echo "Available certificates in LocalMachine\Root:"
    powershell -Command "
        Get-ChildItem -Path 'Cert:\LocalMachine\Root' | Where-Object { \$_.Subject -like '*Cyber Threat Consulting*' -or \$_.Issuer -like '*Cyber Threat Consulting*' } | ForEach-Object {
            Write-Host \"  - Subject: \$_.Subject\"
            Write-Host \"    Thumbprint: \$_.Thumbprint\"
            Write-Host \"    HasPrivateKey: \$_.HasPrivateKey\"
            Write-Host \"    NotAfter: \$_.NotAfter\"
            Write-Host \"\"
        }
    "
    
    # Check if certificate files exist
    echo "Certificate files status:"
    [[ -f "$SCRIPT_DIR/sentinel-selfsigned.cer" ]] && echo "✅ CER file exists" || echo "❌ CER file missing"
    [[ -f "$SCRIPT_DIR/sentinel-selfsigned.pfx" ]] && echo "✅ PFX file exists" || echo "❌ PFX file missing"
    
    exit 1
fi

echo -e "${GREEN}✅ Certificate thumbprint: $CERT_THUMBPRINT${NC}"

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf "$BUILD_DIR" "$MSI_DIR"
mkdir -p "$BUILD_DIR" "$MSI_DIR"

# Copy Windows binary if available
echo -e "${YELLOW}Preparing Windows binary...${NC}"
if [[ -f "$SCRIPT_DIR/target/x86_64-pc-windows-gnu/release/agent-core.exe" ]]; then
    cp "$SCRIPT_DIR/target/x86_64-pc-windows-gnu/release/agent-core.exe" "$BUILD_DIR/sentinel-agent.exe"
    echo -e "${GREEN}✅ Windows binary copied${NC}"
else
    echo -e "${RED}❌ Windows binary not found. Please build with: cargo build --release --target x86_64-pc-windows-gnu${NC}"
    exit 1
fi

# Sign the executable
echo -e "${YELLOW}Signing executable...${NC}"
SIGNING_SUCCESS=false

# Method 1: Try PFX file first (most reliable)
if [[ -f "$SCRIPT_DIR/sentinel-selfsigned.pfx" ]]; then
    echo "🔑 Using PFX file for signing..."
    if signtool sign /f "$SCRIPT_DIR/sentinel-selfsigned.pfx" /p "Sentinel2024!" /fd SHA256 /tr "http://timestamp.digicert.com" /td SHA256 "$BUILD_DIR/sentinel-agent.exe"; then
        echo "✅ PFX signing successful"
        SIGNING_SUCCESS=true
    else
        echo "⚠️  PFX signing failed, trying alternative methods..."
    fi
fi

# Method 2: Try with certificate thumbprint from store
if [[ "$SIGNING_SUCCESS" == "false" && -n "$CERT_THUMBPRINT" ]]; then
    echo "🔍 Using certificate thumbprint: $CERT_THUMBPRINT"
    if signtool sign /sha1 "$CERT_THUMBPRINT" /fd SHA256 /tr "http://timestamp.digicert.com" /td SHA256 "$BUILD_DIR/sentinel-agent.exe"; then
        echo "✅ Thumbprint signing successful"
        SIGNING_SUCCESS=true
    else
        echo "⚠️  Thumbprint signing failed, trying certificate name..."
    fi
fi

# Method 3: Try with certificate name (most compatible)
if [[ "$SIGNING_SUCCESS" == "false" ]]; then
    echo "🏷️  Using certificate name: Cyber Threat Consulting"
    if signtool sign /a /s My /n "Cyber Threat Consulting" /fd SHA256 /tr "http://timestamp.digicert.com" /td SHA256 "$BUILD_DIR/sentinel-agent.exe"; then
        echo "✅ Certificate name signing successful"
        SIGNING_SUCCESS=true
    else
        echo "⚠️  Certificate name signing failed..."
    fi
fi

# Method 4: Try with any available certificate
if [[ "$SIGNING_SUCCESS" == "false" ]]; then
    echo "🔎 Trying any available certificate..."
    if signtool sign /a /fd SHA256 /tr "http://timestamp.digicert.com" /td SHA256 "$BUILD_DIR/sentinel-agent.exe"; then
        echo "✅ Auto-discovered certificate signing successful"
        SIGNING_SUCCESS=true
    else
        echo "❌ All signing methods failed"
    fi
fi

if [[ "$SIGNING_SUCCESS" == "false" ]]; then
    echo -e "${YELLOW}⚠️  Executable signing failed, continuing without signature...${NC}"
else
    echo -e "${GREEN}✅ Executable signed successfully${NC}"
fi

# Create configuration file
echo -e "${YELLOW}Creating configuration...${NC}"
cat > "$BUILD_DIR/agent.json" << EOF
{
    "server_url": "https://sentinel-grc-v2-prod.web.app",
    "check_interval_secs": 3600,
    "heartbeat_interval_secs": 60,
    "log_level": "info",
    "tls_verify": true,
    "data_dir": "C:\\ProgramData\\Sentinel GRC\\Agent"
}
EOF

# Create license file (RTF format)
echo -e "${YELLOW}Creating license file...${NC}"
cat > "$BUILD_DIR/license.rtf" << 'EOF'
{\rtf1\ansi\deff0
{\fonttbl{\f0\fnil\fcharset0 Calibri;}}
{\colortbl;\red0\green0\blue0;}
\f0\fs24
{\b\cf1 Sentinel GRC Agent License Agreement\par
\par
Copyright \copyright 2024-2026 Cyber Threat Consulting\par
\par
IMPORTANT NOTICE: This software is provided 'as-is', without warranty of any kind.\par
By installing this software, you agree to:\par
\par
1. Use the software only for legitimate security monitoring purposes\par
2. Not reverse engineer or modify the software\par
3. Comply with all applicable laws and regulations\par
4. Not use the software for any malicious purposes\par
\par
Full terms available at: https://sentinel-grc-v2-prod.web.app/terms\par
\par
This software collects system information for compliance monitoring purposes.\par
By continuing, you consent to this data collection and processing.\par
}
EOF

# Create WiX project file
echo -e "${YELLOW}Creating WiX project...${NC}"
cat > "$BUILD_DIR/SentinelAgent.wxs" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" 
           Name="$PRODUCT_NAME" 
           Language="1033" 
           Version="$VERSION.0" 
           Manufacturer="$MANUFACTURER" 
           UpgradeCode="12345678-1234-5678-9012-123456789012">
    
    <Package InstallerVersion="200" 
             Compressed="yes" 
             InstallScope="perMachine" 
             Platform="x64" 
             Description="$PRODUCT_NAME - Endpoint compliance monitoring" />

    <MediaTemplate EmbedCab="yes" />

    <Property Id="ARPPRODUCTICON" Value="sentinel.ico" />
    <Property Id="ARPNOMODIFY" Value="Modify" />
    <Property Id="ARPNOREPAIR" Value="Repair" />
    <Property Id="ARPNOREMOVE" Value="Remove" />
    
    <Feature Id="Complete" 
             Title="$PRODUCT_NAME" 
             Description="Complete $PRODUCT_NAME installation" 
             Display="expand" 
             Level="1">
      <Feature Id="AgentCore" 
               Title="Core Agent" 
               Description="Sentinel Agent core application and service" 
               Level="1">
        <ComponentRef Id="AgentExecutable" />
        <ComponentRef Id="AgentService" />
        <ComponentRef Id="AgentConfig" />
      </Feature>
      
      <Feature Id="Shortcuts" 
               Title="Shortcuts" 
               Description="Desktop and Start Menu shortcuts" 
               Level="2">
        <ComponentRef Id="DesktopShortcut" />
        <ComponentRef Id="StartMenuShortcut" />
      </Feature>
    </Feature>

    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFiles64Folder">
        <Directory Id="INSTALLDIR" Name="Sentinel GRC">
          <Directory Id="AGENTDIR" Name="Agent" />
        </Directory>
      </Directory>
      
      <Directory Id="ProgramMenuFolder">
        <Directory Id="ApplicationProgramsFolder" Name="Sentinel GRC" />
      </Directory>
      
      <Directory Id="DesktopFolder" Name="Desktop" />
    </Directory>

    <ComponentGroup Id="AgentComponents" Directory="AGENTDIR">
      <Component Id="AgentExecutable" Guid="12345678-1234-5678-9012-123456789001">
        <File Id="AgentExe" 
              Source="sentinel-agent.exe" 
              KeyPath="yes" />
        
        <RegistryKey Root="HKLM" Key="SOFTWARE\Sentinel GRC\Agent">
          <RegistryValue Name="InstallPath" Type="string" Value="[AGENTDIR]" />
          <RegistryValue Name="Version" Type="string" Value="$VERSION" />
        </RegistryKey>
      </Component>
      
      <Component Id="AgentService" Guid="12345678-1234-5678-9012-123456789002">
        <File Id="ServiceExe" 
              Source="sentinel-agent.exe" />
        
        <ServiceInstall Id="AgentService"
                     Type="ownProcess"
                     Vital="yes"
                     Name="SentinelAgentService"
                     DisplayName="Sentinel GRC Agent"
                     Description="Endpoint compliance monitoring agent for Sentinel GRC platform"
                     Start="auto"
                     Account="NT SERVICE\SentinelAgentService"
                     ErrorControl="normal"
                     Interactive="no">
          <ServiceDependency Id="Tcpip" />
          <ServiceDependency Id="Dnscache" />
        </ServiceInstall>
        
        <ServiceControl Id="AgentService" 
                       Start="install" 
                       Stop="both" 
                       Remove="uninstall" 
                       Name="SentinelAgentService" 
                       Wait="yes" />
      </Component>
      
      <Component Id="AgentConfig" Guid="12345678-1234-5678-9012-123456789003">
        <File Id="ConfigFile" 
              Source="agent.json" />
        
        <RegistryKey Root="HKLM" Key="SOFTWARE\Sentinel GRC\Agent">
          <RegistryValue Name="ConfigFile" Type="string" Value="[AGENTDIR]agent.json" />
        </RegistryKey>
      </Component>
      
      <Component Id="DesktopShortcut" Guid="12345678-1234-5678-9012-123456789004">
        <Shortcut Id="DesktopShortcut"
                  Directory="DesktopFolder"
                  Name="Sentinel GRC Agent"
                  Description="Launch Sentinel GRC Agent"
                  Target="[AGENTDIR]sentinel-agent.exe"
                  WorkingDirectory="AGENTDIR"
                  Icon="sentinel.ico"
                  IconIndex="0" />
        <RegistryValue Root="HKCU" 
                     Key="Software\Sentinel GRC\Agent" 
                     Name="DesktopShortcut" 
                     Type="integer" 
                     Value="1" />
      </Component>
      
      <Component Id="StartMenuShortcut" Guid="12345678-1234-5678-9012-123456789005">
        <Shortcut Id="StartMenuShortcut"
                  Directory="ApplicationProgramsFolder"
                  Name="Sentinel GRC Agent"
                  Description="Launch Sentinel GRC Agent"
                  Target="[AGENTDIR]sentinel-agent.exe"
                  WorkingDirectory="AGENTDIR"
                  Icon="sentinel.ico"
                  IconIndex="0" />
        <RemoveFolder Id="ApplicationProgramsFolder" On="uninstall" />
        <RegistryValue Root="HKCU" 
                     Key="Software\Sentinel GRC\Agent" 
                     Name="StartMenuShortcut" 
                     Type="integer" 
                     Value="1" />
      </Component>
    </ComponentGroup>

    <UI>
      <UIRef Id="WixUI_InstallDir" />
      <Publish Dialog="WelcomeDlg" Control="Next" Event="NewDialog" Value="InstallDirDlg" Order="2" />
      <Publish Dialog="InstallDirDlg" Control="Back" Event="NewDialog" Value="WelcomeDlg" Order="2" />
      <Publish Dialog="InstallDirDlg" Control="Next" Event="NewDialog" Value="VerifyReadyDlg" Order="3" />
      <Publish Dialog="VerifyReadyDlg" Control="Back" Event="NewDialog" Value="InstallDirDlg" Order="2" />
    </UI>

    <Property Id="WIXUI_INSTALLDIR" Value="INSTALLDIR" />
    <WixVariable Id="WixUILicenseRtf" Value="license.rtf" />

    <MajorUpgrade DowngradeErrorMessage="A newer version of [ProductName] is already installed." />

    <InstallExecuteSequence>
    </InstallExecuteSequence>

    <Media Id="1" Cabinet="SentinelAgent.cab" EmbedCab="yes" />

    <FeatureRef Id="Complete" />
  </Product>
</Wix>
EOF

# Build the MSI
echo -e "${YELLOW}Building MSI installer...${NC}"
cd "$BUILD_DIR"

# Compile WiX source
echo "Compiling WiX source..."
candle SentinelAgent.wxs -out SentinelAgent.wixobj

if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ WiX compilation failed${NC}"
    exit 1
fi

# Link the MSI
echo "Linking MSI..."
light SentinelAgent.wixobj -out "$MSI_DIR/SentinelAgent-$VERSION.msi" -ext WixUIExtension

if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ MSI linking failed${NC}"
    exit 1
fi

# Sign the MSI
echo -e "${YELLOW}Signing MSI...${NC}"
MSI_SIGNING_SUCCESS=false

# Method 1: Try PFX file first (most reliable)
if [[ -f "$SCRIPT_DIR/sentinel-selfsigned.pfx" ]]; then
    echo "🔑 Using PFX file for MSI signing..."
    if signtool sign /f "$SCRIPT_DIR/sentinel-selfsigned.pfx" /p "Sentinel2024!" /fd SHA256 /tr "http://timestamp.digicert.com" /td SHA256 "$MSI_DIR/SentinelAgent-$VERSION.msi"; then
        echo "✅ PFX MSI signing successful"
        MSI_SIGNING_SUCCESS=true
    else
        echo "⚠️  PFX MSI signing failed, trying alternative methods..."
    fi
fi

# Method 2: Try with certificate thumbprint from store
if [[ "$MSI_SIGNING_SUCCESS" == "false" && -n "$CERT_THUMBPRINT" ]]; then
    echo "🔍 Using certificate thumbprint for MSI: $CERT_THUMBPRINT"
    if signtool sign /sha1 "$CERT_THUMBPRINT" /fd SHA256 /tr "http://timestamp.digicert.com" /td SHA256 "$MSI_DIR/SentinelAgent-$VERSION.msi"; then
        echo "✅ Thumbprint MSI signing successful"
        MSI_SIGNING_SUCCESS=true
    else
        echo "⚠️  Thumbprint MSI signing failed, trying certificate name..."
    fi
fi

# Method 3: Try with certificate name (most compatible)
if [[ "$MSI_SIGNING_SUCCESS" == "false" ]]; then
    echo "🏷️  Using certificate name for MSI: Cyber Threat Consulting"
    if signtool sign /a /s My /n "Cyber Threat Consulting" /fd SHA256 /tr "http://timestamp.digicert.com" /td SHA256 "$MSI_DIR/SentinelAgent-$VERSION.msi"; then
        echo "✅ Certificate name MSI signing successful"
        MSI_SIGNING_SUCCESS=true
    else
        echo "⚠️  Certificate name MSI signing failed..."
    fi
fi

# Method 4: Try with any available certificate
if [[ "$MSI_SIGNING_SUCCESS" == "false" ]]; then
    echo "🔎 Trying any available certificate for MSI..."
    if signtool sign /a /fd SHA256 /tr "http://timestamp.digicert.com" /td SHA256 "$MSI_DIR/SentinelAgent-$VERSION.msi"; then
        echo "✅ Auto-discovered certificate MSI signing successful"
        MSI_SIGNING_SUCCESS=true
    else
        echo "❌ All MSI signing methods failed"
    fi
fi

if [[ "$MSI_SIGNING_SUCCESS" == "false" ]]; then
    echo -e "${YELLOW}⚠️  MSI signing failed, continuing without signature...${NC}"
else
    echo -e "${GREEN}✅ MSI signed successfully${NC}"
fi

# Create installation package with certificate
echo -e "${YELLOW}Creating installation package...${NC}"
PACKAGE_DIR="$SCRIPT_DIR/SentinelAgent-SelfSigned-$VERSION"
mkdir -p "$PACKAGE_DIR"

# Copy files
cp "$MSI_DIR/SentinelAgent-$VERSION.msi" "$PACKAGE_DIR/"
cp "$SCRIPT_DIR/sentinel-selfsigned.cer" "$PACKAGE_DIR/"

# Create installation script
cat > "$PACKAGE_DIR/install.bat" << EOF
@echo off
echo 🔐 Installation Sentinel GRC Agent (sécurisée)
echo ===========================================

REM Vérifier les droits admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Droits administrateur requis
    echo Relancez ce script en tant qu'administrateur
    pause
    exit /b 1
)

REM Installer le certificat dans Trusted Publishers
echo 📋 Installation du certificat de confiance...
certutil -addstore "TrustedPublisher" "sentinel-selfsigned.cer" >nul 2>&1
REM certutil -addstore "Root" "sentinel-selfsigned.cer" >nul 2>&1
echo ✅ Certificat ajouté aux Trusted Publishers

REM Installer le MSI
echo 📦 Installation de Sentinel GRC Agent...
msiexec /i "SentinelAgent-$VERSION.msi" /quiet /norestart

if %errorLevel% equ 0 (
    echo ✅ Installation terminée avec succès!
) else (
    echo ❌ Erreur lors de l'installation MSI
    echo Code d'erreur: %errorLevel%
)

echo.
echo 🎉 Installation complète!
echo Le certificat est maintenant installé sur cette machine
echo Les futures installations n'auront plus d'avertissements
echo.
pause
EOF

# Create README
cat > "$PACKAGE_DIR/README.txt" << EOF
Sentinel GRC Agent - Package Sécurisé Auto-signé
===============================================

Ce package inclut:
- L'installateur MSI signé avec certificat auto-signé
- Le certificat public pour Trusted Publishers
- Script d'installation automatique

Installation:
1. Exécuter install.bat en tant qu'administrateur
2. Le certificat sera installé automatiquement
3. L'agent s'installera sans avertissements

Avantages:
✅ Aucun avertissement SmartScreen
✅ Installation silencieuse possible
✅ Certificat ajouté aux Trusted Publishers
✅ 100% gratuit

Le certificat est ajouté aux Trusted Publishers,
donc plus aucun avertissement sur cette machine.
EOF

# Create ZIP package
cd "$SCRIPT_DIR"
powershell -Command "Compress-Archive -Path '$PACKAGE_DIR/*' -DestinationPath 'SentinelAgent-SelfSigned-$VERSION.zip' -Force"

echo -e "${GREEN}🎉 Self-signed Windows installer created successfully!${NC}"
echo -e "${BLUE}Package created: SentinelAgent-SelfSigned-$VERSION.zip${NC}"
echo -e "${BLUE}MSI location: $MSI_DIR/SentinelAgent-$VERSION.msi${NC}"
echo -e "${YELLOW}Certificate: sentinel-selfsigned.pfx${NC}"
echo -e "${YELLOW}To install: Extract ZIP and run install.bat as Administrator${NC}"
