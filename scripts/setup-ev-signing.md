# Configuration Signature Code Professionnelle - Éviter SmartScreen

## 🎯 Objectif
Éviter l'écran SmartScreen de Windows en utilisant un certificat EV (Extended Validation) pour la signature de code Authenticode.

## 📋 Prérequis

### 1. Certificat EV Code Signing
- **Type**: Extended Validation Code Signing Certificate
- **Fournisseurs recommandés**:
  - DigiCert
  - Sectigo
  - GlobalSign
  - SSL.com
- **Format**: .pfx/.p12 (avec clé privée)

### 2. Comptes Requis
- **Apple Developer Account** (pour macOS)
- **Compte Windows Developer** (optionnel mais recommandé)

## 🔧 Configuration GitHub Secrets

### Windows (EV Certificate)
```bash
# Dans GitHub Repository > Settings > Secrets and variables > Actions
WINDOWS_CERT_P12: "base64_encoded_ev_certificate.pfx"
WINDOWS_CERT_PASSWORD: "certificate_password"
```

### macOS (Developer ID)
```bash
APPLE_CERTIFICATE_P12: "base64_developer_id_certificate.p12"
APPLE_CERTIFICATE_PASSWORD: "certificate_password"
APPLE_ID: "your@apple.id"
APPLE_APP_PASSWORD: "app-specific-password"
APPLE_TEAM_ID: "YOUR_TEAM_ID"
```

### Linux (GPG)
```bash
GPG_PRIVATE_KEY: "-----BEGIN PGP PRIVATE KEY-----..."
GPG_PASSPHRASE: "gpg_passphrase"
```

## 🚀 Workflow Actuel

Le workflow `.github/workflows/release.yml` inclut déjà :

### ✅ Signature Windows Professionnelle
```yaml
- name: Sign MSI (Authenticode)
  env:
    WINDOWS_CERT_P12: ${{ secrets.WINDOWS_CERT_P12 }}
    WINDOWS_CERT_PASSWORD: ${{ secrets.WINDOWS_CERT_PASSWORD }}
  run: |
    signtool sign /f $certPath /p $env:WINDOWS_CERT_PASSWORD \
      /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 \
      /d "Sentinel GRC Agent" "target\release\SentinelAgentSetup-$version.msi"
```

### ✅ Signature macOS avec Notarization
```yaml
- name: Build and Notarize PKG
  env:
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_APP_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  run: |
    xcrun notarytool submit sentinel-agent.dmg \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_APP_PASSWORD" \
      --team-id "$APPLE_TEAM_ID" \
      --wait
```

### ✅ Fallback Auto-signé (SmartScreen évité)
```yaml
- name: Create Self-Signed MSI
  env:
    WINDOWS_SELFSIGN_PFX: ${{ secrets.WINDOWS_SELFSIGN_PFX }}
    WINDOWS_SELFSIGN_PASSWORD: ${{ secrets.WINDOWS_SELFSIGN_PASSWORD }}
  run: |
    # Ajout aux Trusted Publishers
    Import-Certificate -FilePath "sentinel-selfsigned.cer" \
      -CertStoreLocation "Cert:\LocalMachine\TrustedPublisher"
```

## 📦 Packages Générés

### 1. Windows Professionnel (EV Signed)
- **Fichier**: `SentinelAgentSetup-{version}.msi`
- **Signature**: Authenticode avec certificat EV
- **SmartScreen**: ✅ Pas d'avertissement
- **Réputation**: Immédiate avec Microsoft SmartScreen

### 2. Windows Auto-signé (Fallback)
- **Fichier**: `SentinelAgentSelfSigned-{version}.zip`
- **Contenu**: MSI + certificat + script d'installation
- **SmartScreen**: ✅ Évité via Trusted Publishers
- **Installation**: `install.bat` automatique

### 3. macOS Notarized
- **Fichier**: `SentinelAgent-{version}.pkg`
- **Signature**: Developer ID + Notarization Apple
- **Gatekeeper**: ✅ Pas de blocage
- **Distribution**: App Store ready

## 🎯 Avantages Certification EV

### Windows EV Code Signing
- ✅ **Réputation immédiate** : Pas de période d'apprentissage
- ✅ **SmartScreen bypass** : Aucun avertissement
- ✅ **Confiance maximale** : Vert dans les propriétés du fichier
- ✅ **Enterprise ready** : Déploiement GPO compatible

### Comparaison
| Type | Délai Réputation | SmartScreen | Coût | Recommandation |
|------|------------------|-------------|--------|----------------|
| Auto-signé | ❌ Jamais | ⚠️ Warning | Gratuit | Développement |
| Standard | ⏳ 2-4 semaines | ⚠️ Warning | $300/an | Test |
| **EV** | ✅ **Immédiat** | ✅ **Aucun** | $600/an | **Production** |

## 🔍 Vérification Signature

### Windows
```powershell
# Vérifier signature MSI
Get-AuthenticodeSignature "SentinelAgentSetup-2.0.71.msi"

# Vérifier réputation SmartScreen
Get-AppLockerFileInformation -Path "SentinelAgentSetup-2.0.71.msi"
```

### macOS
```bash
# Vérifier notarization
spctl --assess --type install SentinelAgent-2.0.71.pkg
xcrun stapler validate SentinelAgent-2.0.71.pkg
```

## 📋 Instructions Déploiement

### Pour les Clients
1. **Télécharger** le MSI EV signé
2. **Exécuter** normalement (double-clic)
3. **Aucun** avertissement SmartScreen
4. **Installation** silencieuse possible

### Pour les Administrateurs
```powershell
# Déploiement silencieux en masse
msiexec /i SentinelAgentSetup-2.0.71.msi /qn \
  ENROLLMENTTOKEN=xxx SERVERURL=https://votre-serveur.com
```

## 🚨 Notes Importantes

### SmartScreen Évitement
1. **EV Certificate** : Bypass immédiat et permanent
2. **Trusted Publishers** : Solution fallback efficace
3. **Réputation buildup** : Automatique avec EV

### Coûts vs Bénéfices
- **EV Certificate** : ~$600/an mais zéro support
- **Auto-signé** : Gratuit mais support requis
- **Standard** : $300/an avec délai 2-4 semaines

### Recommandation Sentinel GRC
**Utiliser EV Certificate** pour :
- ✅ Déploiements entreprise
- ✅ Expérience utilisateur optimale
- ✅ Support réduit
- ✅ Image professionnelle

## 🔄 Maintenance

### Renouvellement Certificat
```yaml
# Mettre à jour les secrets GitHub annually
WINDOWS_CERT_P12: "nouveau_certificat_base64"
WINDOWS_CERT_PASSWORD: "nouveau_mot_de_passe"
```

### Monitoring Réputation
```powershell
# Script monitoring réputation des fichiers
Get-ChildItem "C:\Downloads\*.msi" | ForEach-Object {
    $sig = Get-AuthenticodeSignature $_.FullName
    [PSCustomObject]@{
        File = $_.Name
        Status = $sig.Status
        Signer = $sig.SignerCertificate.Subject
        Reputation = "Check SmartScreen manually"
    }
}
```

---

**Conclusion** : Le workflow actuel supporte déjà la signature professionnelle. Configurez simplement les secrets GitHub avec un certificat EV pour éliminer complètement les avertissements SmartScreen.
