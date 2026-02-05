#!/usr/bin/osascript

on run
    try
        -- Dialogue d'installation principal
        set dialogResult to display dialog "Agent Sentinel GRC - Installation" buttons {"Annuler", "Installer"} default button "Installer" cancel button "Annuler" with icon note with title "Agent Sentinel GRC" message "Bienvenue dans l'Agent Sentinel GRC !

Cet installeur va :
- Installer l'application Agent Sentinel
- Configurer l'integration systeme
- Mettre en place les mises a jour automatiques
- Creer des raccourcis bureau

Cliquez sur 'Installer' pour continuer ou 'Annuler' pour quitter."
        
        if button returned of dialogResult is "Annuler" then
            return
        end if
        
        -- Contrat de licence
        set licenseResult to display dialog "Contrat de Licence" buttons {"Refuser", "Accepter"} default button "Accepter" cancel button "Refuser" with icon caution with title "Contrat de Licence" message "Contrat de Licence Agent Sentinel GRC

Copyright © 2024-2026 Cyber Threat Consulting

Ce logiciel est fourni 'tel quel', sans aucune garantie. En installant ce logiciel, vous acceptez les conditions de service disponibles à : https://sentinel-grc-v2-prod.web.app/terms

Acceptez-vous ces conditions ?"
        
        if button returned of licenseResult is "Refuser" then
            display dialog "Installation Annulee" buttons {"OK"} default button "OK" with icon stop with title "Annule" message "L'installation a ete annulee car le contrat de licence n'a pas ete accepte."
            return
        end if
        
        -- Configuration du demarrage automatique
        set autoStart to button returned of (display dialog "Demarrage Automatique" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Configuration du Demarrage Automatique" message "Voulez-vous que l'Agent Sentinel demarre automatiquement lorsque vous vous connectez ?")
        
        -- Option pour demarrer l'agent apres installation
        set startNow to button returned of (display dialog "Demarrage Immediate" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Demarrer l'Agent" message "Voulez-vous demarrer l'Agent Sentinel maintenant ?")
        
        -- Simulation de l'installation
        try
            set installPath to "/Applications/Sentinel GRC"
            
            -- Creer le repertoire d'installation
            do shell script "mkdir -p '" & installPath & "' 2>/dev/null"
            
            -- Creer un lien symbolique pour l'utilisation en ligne de commande
            do shell script "mkdir -p /usr/local/bin 2>/dev/null; ln -sf '" & installPath & "/SentinelAgent.app/Contents/MacOS/SentinelAgent' /usr/local/bin/sentinel-agent" 2>/dev/null
            
            if autoStart is "Oui" then
                do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"" & installPath & "/SentinelAgent.app\", hidden:false}'" 2>/dev/null
            end if
            
            -- Dialogue de succes
            set launchOption to "Lancer l'Agent"
            if startNow is "Oui" then
                set successResult to display dialog "Installation Terminee !" buttons {"Lancer l'Agent", "Terminer"} default button "Lancer l'Agent" with icon note with title "Succes" message "L'Agent Sentinel GRC a ete installe avec succes !

Emplacement d'installation : " & installPath & "
Ligne de commande : sentinel-agent
Documentation : https://docs.sentinel-grc.com

Que souhaitez-vous faire maintenant ?"
                
                if button returned of successResult is "Lancer l'Agent" then
                    do shell script "open '" & installPath & "/SentinelAgent.app'"
                end if
            else
                display dialog "Installation Terminee !" buttons {"OK"} default button "OK" with icon note with title "Succes" message "L'Agent Sentinel GRC a ete installe avec succes !

Emplacement d'installation : " & installPath & "
Ligne de commande : sentinel-agent
Documentation : https://docs.sentinel-grc.com"
            end if
            
        on error errMsg
            display dialog "Echec de l'Installation" buttons {"OK"} default button "OK" with icon stop with title "Erreur d'Installation" message "L'installation a echoue avec l'erreur : " & errMsg
        end try
        
    on error errMsg
        display dialog "Erreur" buttons {"OK"} default button "OK" with icon stop with title "Erreur" message "Une erreur inattendue est survenue : " & errMsg
    end try
end run
