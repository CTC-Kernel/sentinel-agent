#!/usr/bin/osascript

# Sentinel GRC Agent - Client Installation Assistant
# Bypasses Gatekeeper for enterprise deployment

on run
    try
        -- Welcome dialog
        set welcomeResult to display dialog "🚀 Sentinel GRC Agent - Enterprise Installation

This installer will deploy Sentinel GRC Agent on your macOS system.

About this software:
• Purpose: Enterprise security compliance monitoring
• Developer: Cyber Threat Consulting
• Type: Background security service
• Requirements: macOS 10.15+

Installation Options:
• Standard Install - For current user only
• System Install - For all users (requires admin)
• Custom Install - Choose installation location

This software bypasses Apple signing requirements for enterprise deployment." buttons {"Cancel", "Learn More", "Continue"} default button "Continue" cancel button "Cancel" with icon note
        
        if button returned of welcomeResult is "Cancel" then
            return
        else if button returned of welcomeResult is "Learn More" then
            -- Information dialog
            set infoResult to display dialog "📋 About Sentinel GRC Agent

What this software does:
• Monitors system security compliance
• Collects audit information for corporate policies
• Reports compliance status to management console
• Runs as a background service

Security & Privacy:
• No personal data collection
• Enterprise-grade encryption
• Auditable open-source code
• Minimal system resource usage

Why no Apple signature:
• Enterprise deployment software
• Faster update cycles
• Direct distribution to clients
• Cost-effective for organizations

System Requirements:
• macOS 10.15 (Catalina) or later
• 50MB free disk space
• Network connection for reporting
• Administrator access (for system install)

Questions? Contact your IT administrator." buttons {"Cancel", "Continue"} default button "Continue" cancel button "Cancel" with icon note
            
            if button returned of infoResult is "Cancel" then
                return
            end if
        end if
        
        -- Installation type selection
        set installType to choose from list "Choose Installation Type" with prompt "Select how you want to install Sentinel GRC Agent:" default items {"Standard Install"} with title "Installation Type" items {"Standard Install", "System Install", "Custom Install"}
        
        if installType is false then
            return
        end if
        
        -- Handle different installation types
        if installType is "Standard Install" then
            set installCommand to "install-client.sh --user"
            set installPath to "$HOME/Applications"
            
        else if installType is "System Install" then
            -- Check for admin rights
            try
                do shell script "whoami" with administrator privileges
                set installCommand to "sudo install-client.sh --system"
                set installPath to "/Applications"
                
            on error
                display dialog "❌ Administrator Required" buttons {"OK"} default button "OK" with icon stop with title "Access Denied" message "System installation requires administrator privileges.

Please:
1. Run this installer with sudo
2. Contact your IT administrator
3. Choose 'Standard Install' for user-only installation"
                return
            end try
            
        else if installType is "Custom Install" then
            -- Custom location selection
            set customPath to text returned of (display dialog "Custom Installation Location" default answer "$HOME/Applications" buttons {"Cancel", "Continue"} default button "Continue" cancel button "Cancel" with icon note with title "Choose Location" message "Enter the installation directory:")
            
            if customPath is "" then
                return
            end if
            
            set installCommand to "install-client.sh --user"
            set installPath to customPath
        end if
        
        -- Confirmation dialog
        set confirmResult to display dialog "🔍 Installation Summary

Type: " & installType & "
Location: " & installPath & "
Command: " & installCommand & "

The installation will:
• Copy Sentinel Agent files
• Configure auto-start service
• Create command line tools
• Set up configuration files

Ready to proceed?" buttons {"Cancel", "Install"} default button "Install" cancel button "Cancel" with icon note
        
        if button returned of confirmResult is "Cancel" then
            return
        end if
        
        -- Progress simulation
        set progressSteps to {"Preparing installation...", "Copying files...", "Configuring system...", "Setting up auto-start...", "Finalizing..."}
        
        repeat with step in progressSteps
            display notification step with title "Installing Sentinel GRC Agent"
            delay 1
        end repeat
        
        -- Run the actual installation
        try
            set scriptPath to "/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-agent/" & installCommand
            
            if installType is "System Install" then
                do shell script "cd '" & scriptPath & "' && " & installCommand with administrator privileges
            else
                do shell script "cd '" & scriptPath & "' && " & installCommand
            end if
            
            -- Success dialog
            set successResult to display dialog "✅ Installation Complete!

Sentinel GRC Agent has been successfully installed.

Installation Details:
• Type: " & installType & "
• Location: " & installPath & "
• Auto-start: Enabled
• Command: sentinel-agent

Next Steps:
1. Get your enrollment token from the dashboard
2. Run: sentinel-agent enroll <token>
3. Monitor status: sentinel-agent status

Documentation: https://docs.sentinel-grc.com" buttons {"Launch Agent", "Finish"} default button "Launch Agent" with icon note
            
            if button returned of successResult is "Launch Agent" then
                if installType is "System Install" then
                    do shell script "open /Applications/SentinelAgent.app"
                else
                    do shell script "open '$HOME/Applications/SentinelAgent.app'"
                end if
            end if
            
        on error errMsg
            display dialog "❌ Installation Failed" buttons {"View Log", "Manual Install", "Cancel"} default button "Cancel" with icon stop with title "Installation Error" message "The installation failed with error: " & errMsg & "

Troubleshooting options:
• View Log - See detailed error information
• Manual Install - Get manual installation instructions
• Cancel - Exit installer"
            
            if button returned of result is "View Log" then
                try
                    set logContent to do shell script "cat ~/Library/Logs/SentinelAgent_Install.log 2>/dev/null || cat /tmp/sentinel_install.log 2>/dev/null || echo 'Log file not found'"
                    display dialog "📋 Installation Log" buttons {"OK"} default button "OK" with icon note with title "Installation Log" message logContent
                on error
                    display dialog "Log file not found" buttons {"OK"} default button "OK" with icon caution with title "Error" message "Could not locate installation log file."
                end try
                
            else if button returned of result is "Manual Install" then
                display dialog "📖 Manual Installation Instructions

1. Open Terminal
2. Navigate to the agent directory
3. Run: " & installCommand & "
4. Follow the on-screen instructions

For additional help:
• Contact your IT administrator
• Visit: https://docs.sentinel-grc.com
• Check system requirements" buttons {"OK"} default button "OK" with icon note
            end if
        end try
        
    on error errMsg
        display dialog "Unexpected Error" buttons {"OK"} default button "OK" with icon stop with title "Error" message "An unexpected error occurred: " & errMsg
    end try
end run

-- Handle drag and drop installation
on open droppedItems
    repeat with anItem in droppedItems
        set itemPath to POSIX path of anItem
        
        -- Check if it's the installer script
        if itemPath ends with "install-client.sh" then
            display dialog "🚀 Found Installer Script" buttons {"Run Installer"} default button "Run Installer" with icon note with title "Installer Detected" message "Sentinel GRC Agent installer script detected. Would you like to run it?"
            
            if button returned of result is "Run Installer" then
                run
            end if
            
        else
            display dialog "Invalid File" buttons {"OK"} default button "OK" with icon stop with title "Error" message "Please drop the install-client.sh script to run the installer."
        end if
    end repeat
end open
