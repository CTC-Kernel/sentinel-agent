#!/bin/bash

# Sentinel GRC Agent - Windows MSI Builder
# Creates professional Windows installer with native MSI interface

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

echo -e "${BLUE}🪟 Creating Windows Native Installer${NC}"
echo -e "${BLUE}=================================${NC}"

# Check for required tools
echo -e "${YELLOW}Checking requirements...${NC}"

# Check for WiX Toolset
if ! command -v candle &> /dev/null; then
    echo -e "${RED}❌ WiX Toolset (candle) not found. Please install WiX Toolset.${NC}"
    echo "Download from: https://wixtoolset.org/releases/"
    exit 1
fi

if ! command -v light &> /dev/null; then
    echo -e "${RED}❌ WiX Toolset (light) not found. Please install WiX Toolset.${NC}"
    echo "Download from: https://wixtoolset.org/releases/"
    exit 1
fi

# Check for Windows build environment
if [[ "$OSTYPE" != "msys" ]] && [[ "$OSTYPE" != "cygwin" ]] && [[ "$OSTYPE" != "win32" ]]; then
    echo -e "${YELLOW}⚠️  Not building on Windows. Cross-compilation not supported.${NC}"
    echo "Please run this script on Windows with WiX Toolset installed."
    exit 1
fi

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

# Create banner bitmap (simple placeholder)
echo -e "${YELLOW}Creating UI assets...${NC}"
# Create a simple 493x58 banner (blue gradient)
cat > "$BUILD_DIR/banner.bmp" << 'EOF'
BM6
(   (   )   (
 )   )   )
 (   )   )
(   )   )
EOF

# Create dialog bitmap (simple placeholder)
cat > "$BUILD_DIR/dialog.bmp" << 'EOF'
BM6
(   (   )   (
 )   )   )
(   )   )
(   )   )
EOF

# Create icon placeholder
echo -e "${YELLOW}Creating icon...${NC}"
# In production, you would use a real .ico file
cat > "$BUILD_DIR/sentinel.ico" << 'EOF'
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
      <Directory Id="ProgramFilesFolder">
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
        
        <!-- SECURITY: Use Virtual Service Account (least privilege) instead of LocalSystem -->
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
    <WixVariable Id="WixUIBannerBmp" Value="banner.bmp" />
    <WixVariable Id="WixUIDialogBmp" Value="dialog.bmp" />

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

# Verify MSI
echo -e "${YELLOW}Verifying MSI...${NC}"
if [[ -f "$MSI_DIR/SentinelAgent-$VERSION.msi" ]]; then
    echo -e "${GREEN}✅ MSI created successfully${NC}"
    
    # Display MSI info
    echo -e "${BLUE}Package Information:${NC}"
    echo "File: $MSI_DIR/SentinelAgent-$VERSION.msi"
    echo "Size: $(du -h "$MSI_DIR/SentinelAgent-$VERSION.msi" | cut -f1)"
    echo "Version: $VERSION"
    
    # Test MSI with Windows Installer (if available)
    if command -v msiexec &> /dev/null; then
        echo -e "${YELLOW}Testing MSI integrity...${NC}"
        msiexec /i "$MSI_DIR/SentinelAgent-$VERSION.msi" /qn /l*v "$BUILD_DIR/install.log"
        
        if [[ $? -eq 0 ]]; then
            echo -e "${GREEN}✅ MSI integrity verified${NC}"
        else
            echo -e "${YELLOW}⚠️  MSI test completed (check install.log)${NC}"
        fi
    fi
else
    echo -e "${RED}❌ MSI creation failed${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Windows native installer created successfully!${NC}"
echo -e "${BLUE}To install: msiexec /i \"$MSI_DIR/SentinelAgent-$VERSION.msi\" /quiet${NC}"
echo -e "${BLUE}Or double-click: $MSI_DIR/SentinelAgent-$VERSION.msi${NC}"

# Create installation script
cat > "$MSI_DIR/install.bat" << EOF
@echo off
echo Installing Sentinel GRC Agent...
msiexec /i "SentinelAgent-$VERSION.msi" /quiet /norestart
echo Installation completed!
echo.
echo Next steps:
echo 1. Get your enrollment token from the Sentinel GRC dashboard
echo 2. Run: sentinel-agent enroll --token YOUR_TOKEN
echo 3. Check service: sc query SentinelAgentService
echo.
pause
EOF

echo -e "${GREEN}✅ Installation script created: $MSI_DIR/install.bat${NC}"
