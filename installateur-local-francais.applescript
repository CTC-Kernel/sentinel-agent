#!/usr/bin/osascript

on run
    try
        -- Vérifier si le package local existe
        set scriptPath to (path to me as text)
        set scriptDir to do shell script "dirname '" & scriptPath & "'"
        set packagePath to scriptDir & "public/SentinelAgent-2.0.0.pkg"
        
        if not (exists file packagePath) then
            display dialog "Package Introuvable" buttons {"OK"} default button "OK" with icon stop with title "Erreur" message "Le package d'installation SentinelAgent-2.0.0.pkg est introuvable.

Assurez-vous que le fichier est dans le repertoire public/ a cote de cet installeur."
            return
        end if
        
        -- Dialogue d'accueil
        set dialogResult to display dialog "Agent Sentinel GRC" buttons {"Annuler", "Installer"} default button "Installer" cancel button "Annuler" with icon note with title "Installation Locale" message "Bienvenue dans l Agent Sentinel GRC !

Cet installeur utilisera le package local pour installer l'agent.

Cliquez sur Installer pour continuer."
        
        if button returned of dialogResult is "Annuler" then
            return
        end if
        
        -- Contrat de licence
        set licenseResult to display dialog "Licence" buttons {"Refuser", "Accepter"} default button "Accepter" cancel button "Refuser" with icon caution with title "Contrat" message "Contrat de Licence Agent Sentinel GRC
        
Copyright 2024-2026 Cyber Threat Consulting
        
Ce logiciel est fourni tel quel. Acceptez-vous les conditions ?"
        
        if button returned of licenseResult is "Refuser" then
            display dialog "Annule" buttons {"OK"} default button "OK" with icon stop with title "Installation" message "Installation annulee."
            return
        end if
        
        -- Options de configuration
        set autoStart to button returned of (display dialog "Demarrage Automatique" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Option" message "Voulez-vous que l Agent Sentinel demarre automatiquement au demarrage de macOS ?")
        
        set startNow to button returned of (display dialog "Lancement" buttons {"Non", "Oui"} default button "Oui" with icon note with title "Option" message "Voulez-vous demarrer l Agent Sentinel maintenant ?")
        
        -- Installation
        try
            -- Préparer le package
            do shell script "xattr -d com.apple.quarantine '" & packagePath & "' 2>/dev/null || true"
            
            -- Installer le package
            do shell script "sudo installer -pkg '" & packagePath & "' -target /"
            
            -- Configuration du démarrage automatique
            if autoStart is "Oui" then
                do shell script "osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"/Applications/SentinelAgent.app\"}'"
            end if
            
            -- Message de succès
            if startNow is "Oui" then
                set successResult to display dialog "Installation Terminee" buttons {"Lancer Agent", "Terminer"} default button "Lancer Agent" with icon note with title "Succes" message "Agent Sentinel GRC installe avec succes !
                
Emplacement : /Applications/SentinelAgent.app
Ligne de commande : sentinel-agent
                
Que souhaitez-vous faire maintenant ?"
                
                if button returned of successResult is "Lancer Agent" then
                    do shell script "open '/Applications/SentinelAgent.app'"
                end if
            else
                display dialog "Installation Terminee" buttons {"OK"} default button "OK" with icon note with title "Succes" message "Agent Sentinel GRC installe avec succes !
                
Emplacement : /Applications/SentinelAgent.app
Ligne de commande : sentinel-agent"
            end if
            
        on error errMsg
            display dialog "Erreur Installation" buttons {"OK"} default button "OK" with icon stop with title "Erreur" message "L installation a echoue : " & errMsg
        end try
        
    on error errMsg
        display dialog "Erreur Systeme" buttons {"OK"} default button "OK" with icon stop with title "Erreur" message "Erreur systeme : " & errMsg
    end try
end run
