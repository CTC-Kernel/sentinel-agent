#!/usr/bin/osascript

# Sentinel GRC Agent - macOS Gatekeeper Handler
# Provides user choice when Gatekeeper blocks the package

on run
    try
        -- Get the package path from command line arguments or use default
        set packagePath to "/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-agent/dist/SentinelAgent-2.0.0.pkg"
        
        -- Check if package exists
        try
            do shell script "test -f '" & packagePath & "'"
        on error
            display dialog "❌ Package Not Found" buttons {"OK"} default button "OK" with icon stop with title "Error" message "The SentinelAgent package was not found at: " & packagePath
            return
        end try
        
        -- Main security warning dialog
        set securityDialog to display dialog "🛡️ Security Alert - macOS Gatekeeper

Apple cannot verify that this package is free from malware.

Package: SentinelAgent.pkg
Developer: Cyber Threat Consulting
Type: Enterprise Security Software

This is normal for software that hasn't been signed/notarized by Apple.

What would you like to do?" buttons {"Cancel Installation", "Learn More", "Trust and Install"} default button "Trust and Install" cancel button "Cancel Installation" with icon caution
        
        if button returned of securityDialog is "Cancel Installation" then
            display dialog "Installation Cancelled" buttons {"OK"} default button "OK" with icon note with title "Cancelled" message "The installation has been cancelled for your safety."
            return
            
        else if button returned of securityDialog is "Learn More" then
            -- Show detailed information
            set infoDialog to display dialog "📋 About Sentinel GRC Agent Security

Why this warning appears:
• This package is not signed by Apple Developer Program
• It hasn't been through Apple's notarization process
• This is common for enterprise security software

About this software:
• Purpose: Endpoint compliance monitoring
• Developer: Cyber Threat Consulting
• Source: Open source, auditable code
• Function: Security policy enforcement

Security measures in place:
• Package integrity verification (SHA256)
• Code transparency and auditability
• No data collection beyond compliance needs
• Enterprise-grade security standards

You can verify the package integrity manually:
1. Open Terminal
2. Run: shasum -a 256 " & packagePath & "
3. Compare with expected hash from documentation

Would you like to proceed with installation?" buttons {"Cancel", "Trust and Install"} default button "Trust and Install" cancel button "Cancel" with icon note
            
            if button returned of infoDialog is "Cancel" then
                return
            end if
        end if
        
        -- User chose to install - show verification steps
        display dialog "🔍 Verifying Package Security" buttons {"OK"} default button "OK" with icon note with title "Security Verification" message "Performing security checks before installation...

• Verifying package integrity
• Calculating SHA256 hash
• Checking for suspicious content
• Validating package structure

This will take a few moments..."
        
        -- Run security verification script
        try
            set scriptPath to "/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-agent/install-macos-secure.sh"
            do shell script "chmod +x '" & scriptPath & "' && '" & scriptPath & "'"
            
        on error errMsg
            display dialog "❌ Installation Failed" buttons {"OK", "Try Manual Install"} default button "OK" with icon stop with title "Installation Error" message "The secure installation failed with error: " & errMsg & "

You can try manual installation:
1. Right-click the .pkg file
2. Select 'Open'
3. Click 'Open' in the security dialog"
            
            if button returned of result is "Try Manual Install" then
                do shell script "open '" & packagePath & "'"
            end if
        end try
        
    on error errMsg
        display dialog "Unexpected Error" buttons {"OK"} default button "OK" with icon stop with title "Error" message "An unexpected error occurred: " & errMsg
    end try
end run

-- Alternative entry point for command line usage
on open droppedItems
    repeat with anItem in droppedItems
        set packagePath to POSIX path of anItem
        
        -- Check if it's a .pkg file
        if packagePath ends with ".pkg" then
            -- Run the same security dialog logic
            run
        else
            display dialog "Invalid File" buttons {"OK"} default button "OK" with icon stop with title "Error" message "Please drop a .pkg file to install Sentinel GRC Agent."
        end if
    end repeat
end open
