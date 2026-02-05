#!/usr/bin/osascript

on run
    try
        set dialogResult to display dialog "Installation Locale" buttons {"Annuler", "Installer"} default button "Installer" cancel button "Annuler" with icon note
        
        if button returned of dialogResult is "Annuler" then
            return
        end if
        
        set licenseResult to display dialog "Licence" buttons {"Refuser", "Accepter"} default button "Accepter" cancel button "Refuser" with icon caution
        
        if button returned of licenseResult is "Refuser" then
            return
        end if
        
        set autoStart to button returned of (display dialog "Demarrage" buttons {"Non", "Oui"} default button "Oui" with icon note)
        
        set startNow to button returned of (display dialog "Lancement" buttons {"Non", "Oui"} default button "Oui" with icon note)
        
        try
            set scriptPath to (path to me as text)
            set scriptDir to do shell script "dirname '" & scriptPath & "'"
            set packagePath to scriptDir & "public/SentinelAgent-2.0.0.pkg"
            
            do shell script "sudo installer -pkg '" & packagePath & "' -target /"
            
            if autoStart is "Oui" then
                do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"/Applications/SentinelAgent.app\"}'"
            end if
            
            if startNow is "Oui" then
                display dialog "Succes" buttons {"Lancer", "Terminer"} default button "Lancer" with icon note
                do shell script "open '/Applications/SentinelAgent.app'"
            else
                display dialog "Succes" buttons {"OK"} default button "OK" with icon note
            end if
            
        on error
            display dialog "Erreur" buttons {"OK"} default button "OK" with icon stop
        end try
        
    on error
        display dialog "Erreur" buttons {"OK"} default button "OK" with icon stop
    end try
end run
