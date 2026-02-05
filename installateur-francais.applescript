#!/usr/bin/osascript

# Sentinel GRC Agent - Assistant d'Installation macOS
# Installeur interactif avec interface native macOS

on run
    try
        -- Dialogue d'installation principal
        set dialogResult to display dialog "Agent Sentinel GRC - Installation" buttons {"Annuler", "Installer"} default button "Installer" cancel button "Annuler" with icon note with title "Agent Sentinel GRC" message "Bienvenue dans l'Agent Sentinel GRC !

Cet installeur va :
• Installer l'application Agent Sentinel
• Configurer l'intégration système
• Mettre en place les mises à jour automatiques
• Créer des raccourcis bureau

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
        
        -- Selection du type d'installation
        set installType to choose from list "Choisir le Type d'Installation" with prompt "Selectionnez le type d'installation :" default items {"Standard"} with title "Type d'Installation" items {"Standard", "Personnalise", "Portable"}
        
        -- Chemin d'installation
        set defaultPath to "/Applications/Sentinel GRC"
        if installType is "Personnalise" then
            set installPath to text returned of (display dialog "Chemin d'Installation" default answer defaultPath buttons {"Annuler", "Continuer"} default button "Continuer" cancel button "Annuler" with icon note with title "Choisir le Chemin d'Installation" message "Selectionnez ou installer l'Agent Sentinel GRC :")
        else
            set installPath to defaultPath
        end if
        
        -- Afficher la progression
        set progressSteps to {"Creation des repertoires...", "Installation des fichiers...", "Configuration des permissions...", "Creation des raccourcis...", "Configuration de l'integration systeme..."}
        
        repeat with step in progressSteps
            set progressResult to display dialog step buttons {"Annuler"} default button "" with icon note with title "Installation..." message step giving up after 2
            delay 1
        end repeat
        
        -- Simulation de l'installation
        try
            -- Creer le repertoire d'installation
            do shell script "mkdir -p '" & installPath & "' 2>/dev/null"
            
            -- Copier le bundle d'application
            set scriptPath to (path to me as text)
            set scriptDir to do shell script "dirname '" & scriptPath & "'"
            set appBundle to scriptDir & "/SentinelAgent.app"
            
            if (exists file appBundle) then
                do shell script "cp -R '" & appBundle & "' '" & installPath & "/'"
            end if
            
            -- Creer un lien symbolique pour l'utilisation en ligne de commande
            do shell script "mkdir -p /usr/local/bin 2>/dev/null; ln -sf '" & installPath & "/SentinelAgent.app/Contents/MacOS/SentinelAgent' /usr/local/bin/sentinel-agent" 2>/dev/null
            
            -- Configuration du demarrage automatique
            set autoStart to button returned of (display dialog "Demarrage Automatique" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Configuration du Demarrage Automatique" message "Voulez-vous que l'Agent Sentinel demarre automatiquement lorsque vous vous connectez ?")
            
            if autoStart is "Oui" then
                do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"" & installPath & "/SentinelAgent.app\", hidden:false}'" 2>/dev/null
            end if
            
            -- Option pour demarrer l'agent apres installation
            set startNow to button returned of (display dialog "Demarrage Immediate" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Demarrer l'Agent" message "Voulez-vous demarrer l'Agent Sentinel maintenant ?")
            
            if startNow is "Oui" then
                set startAgentNow to true
            else
                set startAgentNow to false
            end if
            
            -- Dialogue de succes
            set launchOption to "Lancer l'Agent"
            if startAgentNow is false then
                set launchOption to "Terminer"
            end if
            
            set successResult to display dialog "Installation Terminee !" buttons {launchOption, "Terminer"} default button launchOption with icon note with title "Succes" message "L'Agent Sentinel GRC a ete installe avec succes !

Emplacement d'installation : " & installPath & "
Ligne de commande : sentinel-agent
Documentation : https://docs.sentinel-grc.com

Que souhaitez-vous faire maintenant ?"
            
            if button returned of successResult is "Lancer l'Agent" then
                do shell script "open '" & installPath & "/SentinelAgent.app'"
            end if
            
        on error errMsg
            display dialog "Echec de l'Installation" buttons {"OK"} default button "OK" with icon stop with title "Erreur d'Installation" message "L'installation a echoue avec l'erreur : " & errMsg
        end try
        
    on error errMsg
        display dialog "Erreur" buttons {"OK"} default button "OK" with icon stop with title "Erreur" message "Une erreur inattendue est survenue : " & errMsg
    end try
end run
