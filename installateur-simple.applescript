#!/usr/bin/osascript

on run
    try
        display dialog "Agent Sentinel GRC" buttons {"Annuler", "Installer"} default button "Installer" cancel button "Annuler" with icon note with title "Installation" message "Bienvenue !
        
Cliquez sur Installer pour continuer."
        
        set licenseResult to display dialog "Licence" buttons {"Refuser", "Accepter"} default button "Accepter" cancel button "Refuser" with icon caution with title "Contrat" message "Acceptez-vous les conditions ?"
        
        if button returned of licenseResult is "Refuser" then
            display dialog "Annule" buttons {"OK"} default button "OK" with icon stop with title "Installation" message "Installation annulee."
            return
        end if
        
        set autoStart to button returned of (display dialog "Demarrage" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Option" message "Demarrer automatiquement ?")
        
        set startNow to button returned of (display dialog "Lancement" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Option" message "Demarrer maintenant ?")
        
        try
            set installPath to "/Applications/Sentinel GRC"
            do shell script "mkdir -p '" & installPath & "'"
            
            if autoStart is "Oui" then
                do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"" & installPath & "/SentinelAgent.app\"}'"
            end if
            
            if startNow is "Oui" then
                set successResult to display dialog "Succes" buttons {"Lancer", "Terminer"} default button "Lancer" with icon note with title "Installation" message "Agent installe !
                
Emplacement : " & installPath
                
                if button returned of successResult is "Lancer" then
                    do shell script "open '" & installPath & "/SentinelAgent.app'"
                end if
            else
                display dialog "Succes" buttons {"OK"} default button "OK" with icon note with title "Installation" message "Agent installe !
                
Emplacement : " & installPath
            end if
            
        on error errMsg
            display dialog "Erreur" buttons {"OK"} default button "OK" with icon stop with title "Installation" message "Erreur : " & errMsg
        end try
        
    on error errMsg
        display dialog "Erreur" buttons {"OK"} default button "OK" with icon stop with title "System" message "Erreur : " & errMsg
    end try
end run
