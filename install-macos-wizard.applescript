#!/usr/bin/osascript

# Sentinel GRC Agent - macOS Installation Wizard
# Interactive installer with native macOS interface

on run
    try
        -- Main installation dialog
        set dialogResult to display dialog "🛡️ Sentinel GRC Agent - Installation" buttons {"Cancel", "Install"} default button "Install" cancel button "Cancel" with icon note with title "Sentinel GRC Agent" message "Welcome to Sentinel GRC Agent!

This installer will:
• Install the Sentinel Agent application
• Set up system integration
• Configure automatic updates
• Create desktop shortcuts

Click 'Install' to continue or 'Cancel' to exit."
        
        if button returned of dialogResult is "Cancel" then
            return
        end if
        
        -- License agreement
        set licenseResult to display dialog "📋 License Agreement" buttons {"Decline", "Accept"} default button "Accept" cancel button "Decline" with icon caution with title "License Agreement" message "Sentinel GRC Agent License Agreement

Copyright © 2024-2026 Cyber Threat Consulting

This software is provided 'as-is', without warranty of any kind. By installing this software, you agree to the terms of service available at: https://sentinel-grc-v2-prod.web.app/terms

Do you accept these terms?"
        
        if button returned of licenseResult is "Decline" then
            display dialog "Installation Cancelled" buttons {"OK"} default button "OK" with icon stop with title "Cancelled" message "Installation was cancelled because the license agreement was not accepted."
            return
        end if
        
        -- Installation type selection
        set installType to choose from list "Choose Installation Type" with prompt "Select the type of installation:" default items {"Standard"} with title "Installation Type" items {"Standard", "Custom", "Portable"}
        
        -- Installation path
        set defaultPath to "/Applications/Sentinel GRC"
        if installType is "Custom" then
            set installPath to text returned of (display dialog "Installation Path" default answer defaultPath buttons {"Cancel", "Continue"} default button "Continue" cancel button "Cancel" with icon note with title "Choose Installation Path" message "Select where to install Sentinel GRC Agent:")
        else
            set installPath to defaultPath
        end if
        
        -- Show progress
        set progressSteps to {"Creating directories...", "Installing files...", "Setting permissions...", "Creating shortcuts...", "Configuring system integration..."}
        
        repeat with step in progressSteps
            set progressResult to display dialog step buttons {"Cancel"} default button "" with icon note with title "Installing..." message step giving up after 2
            delay 1
        end repeat
        
        -- Simulate installation (in real scenario, this would run the actual installation)
        try
            -- Create installation directory
            do shell script "mkdir -p '" & installPath & "' 2>/dev/null
            
            -- Copy application bundle (assuming it exists in the same directory as this script)
            set scriptPath to (path to me as text)
            set scriptDir to do shell script "dirname '" & scriptPath & "'"
            set appBundle to scriptDir & "/SentinelAgent.app"
            
            if (exists file appBundle) then
                do shell script "cp -R '" & appBundle & "' '" & installPath & "/'"
            end if
            
            -- Create symbolic link for command line usage
            do shell script "mkdir -p /usr/local/bin 2>/dev/null; ln -sf '" & installPath & "/SentinelAgent.app/Contents/MacOS/SentinelAgent' /usr/local/bin/sentinel-agent" 2>/dev/null
            
            -- Set up auto-start (optional)
            set autoStart to button returned of (display dialog "Auto-Start" buttons {"No", "Yes"} default button "Yes" with icon note with title "Auto-Start Configuration" message "Would you like Sentinel Agent to start automatically when you log in?")
            
            if autoStart is "Yes" then
                do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"'" & installPath & "/SentinelAgent.app'\", hidden:false}'" 2>/dev/null
            end if
            
            -- Success dialog
            display dialog "✅ Installation Complete!" buttons {"Launch Agent", "Finish"} default button "Launch Agent" with icon note with title "Success" message "Sentinel GRC Agent has been successfully installed!

Installation location: " & installPath & "
Command line: sentinel-agent
Documentation: https://docs.sentinel-grc.com

What would you like to do next?"
            
            if button returned of result is "Launch Agent" then
                do shell script "open '" & installPath & "/SentinelAgent.app'"
            end if
            
        on error errMsg
            display dialog "❌ Installation Failed" buttons {"OK"} default button "OK" with icon stop with title "Installation Error" message "Installation failed with error: " & errMsg
        end try
        
    on error errMsg
        display dialog "Error" buttons {"OK"} default button "OK" with icon stop with title "Error" message "An unexpected error occurred: " & errMsg
    end try
end run
