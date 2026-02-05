#!/usr/bin/osascript

on run
    try
        display dialog "Agent Sentinel GRC" buttons {"Annuler", "Installer"} default button "Installer" cancel button "Annuler" with icon note with title "Installation" message "Bienvenue dans l Agent Sentinel GRC !
        
Cet installeur va configurer l application.
        
Cliquez sur Installer pour continuer."
        
        set licenseResult to display dialog "Licence" buttons {"Refuser", "Accepter"} default button "Accepter" cancel button "Refuser" with icon caution with title "Contrat" message "Contrat de Licence
        
Copyright 2024-2026 Cyber Threat Consulting
        
Acceptez-vous les conditions ?"
        
        if button returned of licenseResult is "Refuser" then
            display dialog "Annule" buttons {"OK"} default button "OK" with icon stop with title "Installation" message "Installation annulee."
            return
        end if
        
        set autoStart to button returned of (display dialog "Demarrage Automatique" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Option" message "Voulez-vous que l Agent Sentinel demarre automatiquement au demarrage de macOS ?")
        
        set startNow to button returned of (display dialog "Demarrage Maintenant" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Option" message "Voulez-vous demarrer l Agent Sentinel maintenant ?")
        
        try
            set installPath to "/Applications/Sentinel GRC"
            do shell script "mkdir -p '" & installPath & "'"
            
            if autoStart is "Oui" then
                do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"" & installPath & "/SentinelAgent.app\"}'"
            end if
            
            if startNow is "Oui" then
                set successResult to display dialog "Installation Terminee" buttons {"Lancer Agent", "Terminer"} default button "Lancer Agent" with icon note with title "Succes" message "Agent Sentinel GRC installe avec succes !
                
Emplacement : " & installPath & "
Ligne de commande : sentinel-agent"
                
                if button returned of successResult is "Lancer Agent" then
                    do shell script "open '" & installPath & "/SentinelAgent.app'"
                end if
            else
                display dialog "Installation Terminee" buttons {"OK"} default button "OK" with icon note with title "Succes" message "Agent Sentinel GRC installe avec succes !
                
Emplacement : " & installPath & "
Ligne de commande : sentinel-agent"
            end if
            
        on error errMsg
            display dialog "Erreur Installation" buttons {"OK"} default button "OK" with icon stop with title "Erreur" message "L installation a echoue : " & errMsg
        end try
        
    on error errMsg
        display dialog "Erreur Systeme" buttons {"OK"} default button "OK" with icon stop with title "Erreur" message "Erreur systeme : " & errMsg
    end try
end run
