#!/usr/bin/osascript

on run
    try
        set dialogResult to display dialog "Agent Sentinel GRC - Installation" buttons {"Annuler", "Installer"} default button "Installer" cancel button "Annuler" with icon note with title "Agent Sentinel GRC" message "Bienvenue dans l Agent Sentinel GRC !

Cet installeur va installer l application Agent Sentinel et configurer l integration systeme.

Cliquez sur Installer pour continuer."
        
        if button returned of dialogResult is "Annuler" then
            return
        end if
        
        set licenseResult to display dialog "Contrat de Licence" buttons {"Refuser", "Accepter"} default button "Accepter" cancel button "Refuser" with icon caution with title "Contrat de Licence" message "Contrat de Licence Agent Sentinel GRC

Copyright © 2024-2026 Cyber Threat Consulting

Ce logiciel est fourni tel quel, sans aucune garantie. En installant ce logiciel, vous acceptez les conditions de service.

Acceptez-vous ces conditions ?"
        
        if button returned of licenseResult is "Refuser" then
            display dialog "Installation Annulee" buttons {"OK"} default button "OK" with icon stop with title "Annule" message "L installation a ete annulee."
            return
        end if
        
        set autoStart to button returned of (display dialog "Demarrage Automatique" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Configuration" message "Voulez-vous que l Agent Sentinel demarre automatiquement au demarrage de macOS ?")
        
        set startNow to button returned of (display dialog "Demarrage Immediate" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Demarrage" message "Voulez-vous demarrer l Agent Sentinel maintenant ?")
        
        try
            set installPath to "/Applications/Sentinel GRC"
            do shell script "mkdir -p '" & installPath & "' 2>/dev/null"
            do shell script "mkdir -p /usr/local/bin 2>/dev/null; ln -sf '" & installPath & "/SentinelAgent.app/Contents/MacOS/SentinelAgent' /usr/local/bin/sentinel-agent" 2>/dev/null
            
            if autoStart is "Oui" then
                do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"" & installPath & "/SentinelAgent.app\", hidden:false}'" 2>/dev/null
            end if
            
            if startNow is "Oui" then
                set successResult to display dialog "Installation Terminee !" buttons {"Lancer l Agent", "Terminer"} default button "Lancer l Agent" with icon note with title "Succes" message "L Agent Sentinel GRC a ete installe avec succes !
                
Emplacement : " & installPath & "
Ligne de commande : sentinel-agent"
                
                if button returned of successResult is "Lancer l Agent" then
                    do shell script "open '" & installPath & "/SentinelAgent.app'"
                end if
            else
                display dialog "Installation Terminee !" buttons {"OK"} default button "OK" with icon note with title "Succes" message "L Agent Sentinel GRC a ete installe avec succes !
                
Emplacement : " & installPath & "
Ligne de commande : sentinel-agent"
            end if
            
        on error errMsg
            display dialog "Echec Installation" buttons {"OK"} default button "OK" with icon stop with title "Erreur" message "Erreur : " & errMsg
        end try
        
    on error errMsg
        display dialog "Erreur" buttons {"OK"} default button "OK" with icon stop with title "Erreur" message "Erreur : " & errMsg
    end try
end run
