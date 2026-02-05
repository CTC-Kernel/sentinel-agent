#!/usr/bin/osascript

on run
    try
        display dialog "Installation" buttons {"Cancel", "Install"} default button "Install" cancel button "Cancel" with icon note
        
        set autoStart to button returned of (display dialog "Auto Start" buttons {"No", "Yes"} default button "Yes" with icon note)
        
        set startNow to button returned of (display dialog "Start Now" buttons {"No", "Yes"} default button "Yes" with icon note)
        
        try
            set installPath to "/Applications/Sentinel GRC"
            do shell script "mkdir -p '" & installPath & "'"
            
            if autoStart is "Yes" then
                do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"" & installPath & "/SentinelAgent.app\"}'"
            end if
            
            if startNow is "Yes" then
                display dialog "Success" buttons {"Launch", "Finish"} default button "Launch" with icon note
                do shell script "open '" & installPath & "/SentinelAgent.app'"
            else
                display dialog "Success" buttons {"OK"} default button "OK" with icon note
            end if
            
        on error errMsg
            display dialog "Error" buttons {"OK"} default button "OK" with icon stop
        end try
        
    on error errMsg
        display dialog "System Error" buttons {"OK"} default button "OK" with icon stop
    end try
end run
