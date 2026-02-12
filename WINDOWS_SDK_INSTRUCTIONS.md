# Instructions pour utiliser Windows SDK gratuitement

## 🆓 Windows SDK Gratuit

Microsoft offre Windows SDK gratuitement, il inclut:
- `signtool.exe` pour signer les applications
- `makecert.exe` pour créer des certificats
- `certmgr.exe` pour gérer les certificats

## 📦 Installation

1. **Télécharger Windows SDK** (gratuit):
   - https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
   - Choisir "Windows 10 SDK" ou "Windows 11 SDK"

2. **Installer les composants**:
   - Windows SDK Signing Tools
   - Windows SDK Desktop Libraries
   - Windows SDK Registry Tools

## 🔧 Créer et signer avec Windows SDK

### Étape 1: Créer certificat auto-signé
```cmd
makecert -r -pe -n "CN=Cyber Threat Consulting" -ss My -len 2048 -a sha256 -cy authority sentinel-agent.cer
```

### Étape 2: Exporter en PFX
```cmd
pvk2pfx -pvk sentinel-agent.pvk -spc sentinel-agent.cer -pfx sentinel-agent.pfx -po Sentinel2024!
```

### Étape 3: Signer le MSI
```cmd
signtool sign /f sentinel-agent.pfx /p Sentinel2024! /t http://timestamp.digicert.com SentinelAgent-2.0.0.msi
```

### Étape 4: Distribuer avec certificat
```cmd
# Copier les fichiers pour distribution:
copy sentinel-agent.pfx .\package\
copy sentinel-agent.cer .\package\
copy SentinelAgent-2.0.0.msi .\package\
```

## 🎯 Script de distribution automatique

Le script `install-with-cert.bat` installera automatiquement:
1. Le certificat dans Trusted Publishers
2. Le MSI sans avertissement

## ✅ Avantages

- **100% gratuit** (Windows SDK est gratuit)
- **Pas d'avertissement** SmartScreen
- **Format MSI** conservé
- **Installation silencieuse** possible
- **Réputation locale** sur la machine

## 🔄 Processus complet

1. **Créer le certificat**: `create-self-signed-cert.bat`
2. **Signer le MSI**: `create-windows-installer.sh` (avec variables d'environnement)
3. **Distribuer**: `install-with-cert.bat` + MSI + certificat
4. **Installer**: L'utilisateur exécute `install-with-cert.bat` en admin

Résultat: **Aucun avertissement SmartScreen** avec MSI signé!
