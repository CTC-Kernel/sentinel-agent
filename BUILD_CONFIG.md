# Configuration finale pour compilation correcte

## Variables d'environnement OpenSSL
```powershell
$env:OPENSSL_DIR = "C:\Program Files\OpenSSL-Win64"
$env:OPENSSL_LIB_DIR = "C:\Program Files\OpenSSL-Win64\lib\VC\x64\MD"
$env:OPENSSL_INCLUDE_DIR = "C:\Program Files\OpenSSL-Win64\include"
```

## Commande de compilation
```powershell
cargo build --release --features gui --jobs 1
```

## Déploiement
```powershell
# Créer le répertoire d'installation
New-Item -ItemType Directory -Force -Path "C:\Users\thiba\sentinel\bin"

# Copier le binaire
Copy-Item "target\release\agent-core.exe" "C:\Users\thiba\sentinel\bin\sentinel-agent.exe" -Force
```

## Lancement (sans fichier de configuration)
```powershell
cd "C:\Users\thiba\sentinel\bin"
.\sentinel-agent.exe run
```

## État actuel
- ✅ OpenSSL installé et configuré
- ✅ Variables d'environnement définies
- ✅ Fichiers temporaires nettoyés
- ✅ Pas de fichier de configuration (généré automatiquement)
- ⏳ En attente de compilation complète
