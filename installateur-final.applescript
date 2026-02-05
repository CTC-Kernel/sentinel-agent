#!/usr/bin/osascript

on run
    try
        set dialogResult to display dialog "Agent Sentinel GRC" buttons {"Annuler", "Installer"} default button "Installer" cancel button "Annuler" with icon note with title "Installation" message "Bienvenue dans l Agent Sentinel GRC !
        
Cet installeur va configurer l application sur votre systeme.
        
Cliquez sur Installer pour continuer."
        
        if button returned of dialogResult is "Annuler" then
            return
        end if
        
        set licenseResult to display dialog "Licence" buttons {"Refuser", "Accepter"} default button "Accepter" cancel button "Refuser" with icon caution with title "Contrat" message "Contrat de Licence Agent Sentinel GRC
        
Copyright 2024-2026 Cyber Threat Consulting
        
Logiciel fourni tel quel. Acceptez-vous les conditions ?"
        
        if button returned of licenseResult is "Refuser" then
            display dialog "Annule" buttons {"OK"} default button "OK" with icon stop with title "Installation" message "Installation annulee."
            return
        end if
        
        set autoStart to button returned of (display dialog "Demarrage" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Option" message "Demarrer automatiquement au demarrage de macOS ?")
        
        set startNow to button returned of (display dialog "Lancement" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Option" message "Demarrer l agent maintenant ?")
        
        try
            set installPath to "/Applications/Sentinel GRC"
            do shell script "mkdir -p '" & installPath & "'"
            do shell script "mkdir -p /usr/local/bin; ln -sf '" & installPath & "/SentinelAgent.app/Contents/MacOS/SentinelAgent' /usr/local/bin/sentinel-agent"
            
            if autoStart is "Oui" then
                do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"" & installPath & "/SentinelAgent.app\"}'"
            end if
            
            if startNow is "Oui" then
                set successResult to display dialog "Succes" buttons {"Lancer", "Terminer"} default button "Lancer" with icon note with title "Installation" message "Agent installe avec succes !
                
Emplacement : " & installPath
                
                if button returned of successResult is "Lancer" then
                    do shell script "open '" & installPath & "/SentinelAgent.app'"
                end if
            else
                display dialog "Succes" buttons {"OK"} default button "OK" with icon note with title "Installation" message "Agent installe avec succes !
                
Emplacement : " & installPath
            end if
            
        on error errMsg
            display dialog "Erreur" buttons {"OK"} default button "OK" with icon stop with title "Installation" message "Erreur : " & errMsg
        end try
        
    on error errMsg
        display dialog "Erreur" buttons {"OK"} default button "OK" with icon stop with title "System" message "Erreur systeme : " & errMsg
    end try
end run
