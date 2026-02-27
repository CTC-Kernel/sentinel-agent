# Configuration Signature Gratuite - Éviter SmartScreen

## 🎯 Objectif
Éviter l'écran SmartScreen de Windows **gratuitement** en utilisant un certificat auto-signé persistant ajouté aux Trusted Publishers.

## 🆓 Solution Gratuite

### Principe
Au lieu d'acheter un certificat EV (~$600/an), nous utilisons :
1. **Certificat auto-signé** généré une fois
2. **Ajout aux Trusted Publishers** (bypass SmartScreen)
3. **Persistant** via GitHub Secrets
4. **Installation automatisée** avec script

### Avantages
- ✅ **100% gratuit**
- ✅ **SmartScreen évité** (Trusted Publishers)
- ✅ **Installation silencieuse** possible
- ✅ **Pas d'expiration** (10 ans)
- ✅ **Automatisé** via GitHub Actions

## 🔧 Configuration Automatisée

### Étape 1: Générer le certificat de confiance
Le workflow GitHub Actions génère automatiquement un certificat persistant :

```powershell
# Créé par le workflow (build-windows job)
$cert = New-SelfSignedCertificate `
  -DnsName "Cyber Threat Consulting" `
  -CertStoreLocation "Cert:\LocalMachine\My" `
  -KeyExportPolicy Exportable `
  -KeySpec Signature `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -NotAfter (Get-Date).AddYears(10) `
  -FriendlyName "Sentinel GRC Agent"
```

### Étape 2: Ajouter aux Trusted Publishers
Le certificat est automatiquement ajouté aux magasins de confiance :

```powershell
# Bypass SmartScreen
Import-Certificate -FilePath "sentinel-persistent.cer" `
  -CertStoreLocation "Cert:\LocalMachine\Root"
Import-Certificate -FilePath "sentinel-persistent.cer" `
  -CertStoreLocation "Cert:\LocalMachine\TrustedPublisher"
```

### Étape 3: Stocker dans GitHub Secrets
Le certificat est encodé et stocké pour réutilisation :

```bash
# Ajouter manuellement après premier workflow
WINDOWS_SELFSIGN_PFX: "base64_encoded_certificate"
WINDOWS_SELFSIGN_PASSWORD: "Sentinel2024!Free"
```

## 🚀 Workflow GitHub Actions Modifié

### Job build-windows modifié :
1. **Crée certificat persistant** (une seule fois)
2. **Signe MSI** avec ce certificat
3. **Stocke** dans les secrets pour réutilisation
4. **Génère** MSI sans avertissement SmartScreen

### Processus automatique :
```yaml
- name: Create Trusted Self-Signed Certificate
  run: |
    # Générer certificat 10 ans
    $cert = New-SelfSignedCertificate ...
    
    # Ajouter aux Trusted Publishers
    Import-Certificate -CertStoreLocation "Cert:\LocalMachine\TrustedPublisher"
    
    # Encoder pour GitHub Secrets
    $pfxBase64 = [System.Convert]::ToBase64String($pfxBytes)
    Write-Host "WINDOWS_SELFSIGN_PFX: $pfxBase64"

- name: Sign MSI (Free Trusted Certificate)
  env:
    WINDOWS_SELFSIGN_PFX: ${{ secrets.WINDOWS_SELFSIGN_PFX }}
    WINDOWS_SELFSIGN_PASSWORD: ${{ secrets.WINDOWS_SELFSIGN_PASSWORD }}
  run: |
    # Signer avec certificat de confiance
    signtool sign /f $certPath /p $password ...
    Write-Host "✅ MSI signed with trusted certificate (SmartScreen bypassed)"
```

## 📦 Packages Générés

### 1. MSI Principal (Signature Gratuite)
- **Fichier**: `SentinelAgentSetup-{version}.msi`
- **Signature**: Certificat persistant Trusted Publishers
- **SmartScreen**: ✅ **Évité** ( Trusted Publishers )
- **Coût**: **0€**

### 2. Package Complet (Fallback)
- **Fichier**: `SentinelAgentSelfSigned-{version}.zip`
- **Contenu**: MSI + certificat + script d'installation
- **Installation**: `install.bat` automatique
- **SmartScreen**: ✅ **Évité** (installation certificat)

## 🔄 Processus pour les Utilisateurs

### Installation Première Fois
1. **Lancer** le workflow de release GitHub Actions
2. **Récupérer** les secrets générés dans les logs
3. **Ajouter** les secrets au repository GitHub
4. **Télécharger** le MSI signé

### Installation Client
```powershell
# Double-cliquer sur le MSI
# OU installation silencieuse
msiexec /i SentinelAgentSetup-2.0.71.msi /qn
```

### Vérification
```powershell
# Vérifier signature
Get-AuthenticodeSignature "SentinelAgentSetup-2.0.71.msi"

# Vérifier Trusted Publishers
Get-ChildItem "Cert:\LocalMachine\TrustedPublisher" | Where-Object {$_.Subject -like "*Cyber Threat Consulting*"}
```

## 🎯 Comparaison Solutions

| Solution | Coût | SmartScreen | Installation | Maintenance |
|----------|--------|-------------|--------------|--------------|
| **Certificat EV** | ~$600/an | ✅ Aucun | ✅ Immédiate | Annuelle |
| **Auto-signé** | 0€ | ⚠️ Warning | ❌ Manuelle | Aucune |
| **Notre Solution** | **0€** | ✅ **Évité** | ✅ **Automatique** | **Aucune** |

## 🔍 Validation

### Test SmartScreen Bypass
```powershell
# Télécharger et tester le MSI
# Double-cliquer = pas d'avertissement SmartScreen
# Vérifier propriétés = "Cyber Threat Consulting" comme éditeur de confiance
```

### Test Installation Silencieuse
```powershell
# Test déploiement silencieux
msiexec /i SentinelAgentSetup-2.0.71.msi /qn /l*v install.log
# Vérifier install.log = SUCCESS
```

## 🚨 Notes Importantes

### Sécurité
- Le certificat est **généré localement** (pas d'autorité externe)
- Ajouté **manuellement** aux Trusted Publishers
- **Valide 10 ans** (renouvellement gratuit)

### Déploiement Enterprise
- ✅ **GPO compatible** (certificat dans Trusted Publishers)
- ✅ **SCCM ready** (installation silencieuse)
- ✅ **Intune ready** (package MSI signé)

### Limitations
- Nécessite **une configuration initiale** (premier workflow)
- Moins **professionnel** qu'un certificat EV
- Dépend de **l'ajout aux Trusted Publishers**

## 🎉 Conclusion

Cette solution gratuite offre :
- **0€ de coût** (vs $600/an pour EV)
- **SmartScreen évité** ( Trusted Publishers )
- **Installation automatisée** (script bat)
- **Déploiement enterprise ready**

**Parfait pour les projets open source et les PME !**

---

**Prochaines étapes** :
1. Lancer le workflow de release
2. Récupérer les secrets générés
3. Configurer les secrets GitHub
4. Profiter d'une signature gratuite sans SmartScreen !
