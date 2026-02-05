#!/usr/bin/osascript

on run
    try
        set scriptPath to (path to me as text)
        set scriptDir to do shell script "dirname '" & scriptPath & "'"
        set packagePath to scriptDir & "public/SentinelAgent-2.0.0.pkg"
        
        if not (exists file packagePath) then
            display dialog "Package Introuvable" buttons {"OK"} default button "OK" with icon stop with title "Erreur" message "Package SentinelAgent-2.0.0.pkg introuvable dans le repertoire public/"
            return
        end if
        
        set dialogResult to display dialog "Agent Sentinel GRC" buttons {"Annuler", "Installer"} default button "Installer" cancel button "Annuler" with icon note
        
        if button returned of dialogResult is "Annuler" then
            return
        end if
        
        set licenseResult to display dialog "Licence" buttons {"Refuser", "Accepter"} default button "Accepter" cancel button "Refuser" with icon caution
        
        if button returned of licenseResult is "Refuser" then
            return
        end if
        
        set autoStart to button returned of (display dialog "Demarrage Automatique" buttons {"Non", "Oui"} default button "Oui" with icon note)
        
        set startNow to button returned of (display dialog "Lancement" buttons {"Non", "Oui"} default button "Oui" with icon note)
        
        try
            do shell script "xattr -d com.apple.quarantine '" & packagePath & "' 2>/dev/null || true"
            do shell script "sudo installer -pkg '" & packagePath & "' -target /"
            
            if autoStart is "Oui" then
                do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"/Applications/SentinelAgent.app\"}'"
            end if
            
            if startNow is "Oui" then
                set successResult to display dialog "Succes" buttons {"Lancer", "Terminer"} default button "Lancer" with icon note
                if button returned of successResult is "Lancer" then
                    do shell script "open '/Applications/SentinelAgent.app'"
                end if
            else
                display dialog "Succes" buttons {"OK"} default button "OK" with icon note
            end if
            
        on error errMsg
            display dialog "Erreur" buttons {"OK"} default button "OK" with icon stop with title "Installation" message "Erreur : " & errMsg
        end try
        
    on error errMsg
        display dialog "Erreur" buttons {"OK"} default button "OK" with icon stop with title "System" message "Erreur : " & errMsg
    end try
end run
