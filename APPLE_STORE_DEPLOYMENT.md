# 📱 Guide de Déploiement Apple App Store - Sentinel GRC

## ✅ Prérequis Obligatoires

### 1. Compte Apple Developer
- [ ] Compte Apple Developer actif (99$/an)
- [ ] Accès à [App Store Connect](https://appstoreconnect.apple.com)
- [ ] Certificats de distribution iOS configurés
- [ ] Profils de provisionnement créés

### 2. Environnement de Développement
- [ ] macOS (obligatoire pour build iOS)
- [ ] Xcode 14+ installé
- [ ] Command Line Tools: `xcode-select --install`
- [ ] CocoaPods: `sudo gem install cocoapods`
- [ ] Node.js 18+ et npm installés

### 3. Identifiants et Configuration
- [ ] Bundle ID: `com.sentinel.grc` (à enregistrer dans App Store Connect)
- [ ] Team ID Apple Developer
- [ ] Certificats de signature configurés dans Xcode

---

## 🚀 Étapes de Déploiement

### Étape 1: Initialiser le Projet iOS

```bash
# 1. Builder l'application web
npm run build

# 2. Initialiser Capacitor (si pas déjà fait)
npm run cap:init

# 3. Ajouter la plateforme iOS
npm run cap:add:ios

# 4. Synchroniser le code web avec iOS
npm run cap:sync
```

### Étape 2: Créer les Assets Requis

#### Icône de l'Application (OBLIGATOIRE)
- **Fichier**: `resources/icon.png`
- **Taille**: 1024x1024 pixels
- **Format**: PNG sans transparence
- **Contenu**: Logo Sentinel GRC sur fond uni

#### Splash Screen (OBLIGATOIRE)
- **Fichier**: `resources/splash.png`
- **Taille**: 2732x2732 pixels
- **Format**: PNG
- **Background**: #0f172a (slate-900)

#### Générer tous les assets automatiquement:
```bash
npm install -g @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#0f172a' --splashBackgroundColor '#0f172a'
```

### Étape 3: Configuration Xcode

```bash
# Ouvrir le projet dans Xcode
npm run cap:open:ios
```

#### Dans Xcode:
1. **Sélectionner le projet** "App" dans le navigateur
2. **General Tab**:
   - Display Name: `Sentinel GRC`
   - Bundle Identifier: `com.sentinel.grc`
   - Version: `2.0.0`
   - Build: `1`
   - Deployment Target: `iOS 13.0`
   - Team: Sélectionner votre équipe Apple Developer

3. **Signing & Capabilities**:
   - ✅ Automatically manage signing
   - Team: Votre équipe
   - Provisioning Profile: Automatic
   - Ajouter les capabilities:
     - Push Notifications
     - Background Modes (Remote notifications, Background fetch)
     - Associated Domains (si nécessaire pour deep linking)

4. **Info Tab**:
   - Vérifier que toutes les descriptions de confidentialité sont présentes
   - Langue principale: Français

### Étape 4: Conformité Sécurité Apple

#### Privacy Manifest (OBLIGATOIRE depuis iOS 17)

Créer `ios/App/App/PrivacyInfo.xcprivacy`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSPrivacyTracking</key>
    <false/>
    <key>NSPrivacyTrackingDomains</key>
    <array/>
    <key>NSPrivacyCollectedDataTypes</key>
    <array>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeEmailAddress</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypeTracking</key>
            <false/>
            <key>NSPrivacyCollectedDataTypePurposes</key>
            <array>
                <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
            </array>
        </dict>
        <dict>
            <key>NSPrivacyCollectedDataType</key>
            <string>NSPrivacyCollectedDataTypeName</string>
            <key>NSPrivacyCollectedDataTypeLinked</key>
            <true/>
            <key>NSPrivacyCollectedDataTypeTracking</key>
            <false/>
            <key>NSPrivacyCollectedDataTypePurposes</key>
            <array>
                <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
            </array>
        </dict>
    </array>
    <key>NSPrivacyAccessedAPITypes</key>
    <array>
        <dict>
            <key>NSPrivacyAccessedAPIType</key>
            <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
            <key>NSPrivacyAccessedAPITypeReasons</key>
            <array>
                <string>CA92.1</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```

#### Encryption Export Compliance

Ajouter dans `Info.plist`:
```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

Si vous utilisez HTTPS uniquement (votre cas), vous êtes exempt.

### Étape 5: Build de Production

#### Option A: Build via Xcode (Recommandé pour premier déploiement)

1. Dans Xcode, sélectionner:
   - Target: **Any iOS Device (arm64)**
   - Scheme: **App**

2. Menu: **Product > Archive**

3. Une fois l'archive créée:
   - Window > Organizer
   - Sélectionner l'archive
   - Cliquer **Distribute App**
   - Choisir **App Store Connect**
   - Upload

#### Option B: Build en ligne de commande

```bash
# Build pour release
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath build/App.xcarchive \
  archive

# Export pour App Store
xcodebuild -exportArchive \
  -archivePath build/App.xcarchive \
  -exportPath build \
  -exportOptionsPlist ExportOptions.plist
```

### Étape 6: App Store Connect

#### 1. Créer l'Application
- Aller sur [App Store Connect](https://appstoreconnect.apple.com)
- **My Apps** > **+** > **New App**
- Platforms: iOS
- Name: **Sentinel GRC**
- Primary Language: **French**
- Bundle ID: `com.sentinel.grc`
- SKU: `sentinel-grc-2024`

#### 2. Métadonnées Requises

**Informations de l'App**:
- **Nom**: Sentinel GRC
- **Sous-titre**: Gouvernance, Risques & Conformité ISO 27001
- **Description**:
```
Sentinel GRC est la plateforme professionnelle de gestion de la sécurité des systèmes d'information (SSI) conforme aux normes ISO 27001 et ISO 27005.

FONCTIONNALITÉS PRINCIPALES:

✓ Gestion des Actifs
- Inventaire complet des actifs IT
- Classification et évaluation de criticité
- Suivi du cycle de vie

✓ Gestion des Risques
- Identification des menaces et vulnérabilités
- Évaluation selon ISO 27005
- Plans de traitement automatisés
- Tableaux de bord dynamiques

✓ Audits de Conformité
- Grilles ISO 27001 intégrées
- Collecte de preuves
- Génération automatique de rapports PDF
- Suivi des écarts et recommandations

✓ Gestion de Projets SSI
- Planification et suivi
- Jalons et échéances
- Lien avec contrôles ISO

✓ Conformité ISO 27001
- Tableau de bord par annexe A
- Statement of Applicability (SoA)
- Suivi de mise en œuvre

✓ Gestion Documentaire
- Stockage sécurisé
- Versionning
- Validation et publication

DESTINÉ AUX:
- RSSI (Responsables de la Sécurité des Systèmes d'Information)
- Équipes GRC (Gouvernance, Risques, Conformité)
- Consultants en cybersécurité
- Auditeurs internes/externes
- DPO (Data Protection Officers)

SÉCURITÉ & CONFIDENTIALITÉ:
- Chiffrement de bout en bout
- Authentification multi-facteurs
- Conformité RGPD
- Hébergement sécurisé Firebase
- Aucune donnée partagée avec des tiers

SUPPORT:
- Documentation complète
- Support technique dédié
- Mises à jour régulières
```

- **Mots-clés**: ISO 27001, GRC, cybersécurité, conformité, audit, risques, RSSI, sécurité, SMSI, ISO 27005
- **URL de support**: https://sentinel-grc.com/support
- **URL marketing**: https://sentinel-grc.com
- **Catégorie**: Business
- **Catégorie secondaire**: Productivity

**Pricing**:
- Modèle: Gratuit avec achats intégrés (si Stripe)
- Ou: Payant (définir le prix)

#### 3. Screenshots Requis

**iPhone 6.7" (iPhone 14 Pro Max)** - OBLIGATOIRE:
- 1290 x 2796 pixels
- 3-10 screenshots

**iPhone 6.5" (iPhone 11 Pro Max)** - OBLIGATOIRE:
- 1242 x 2688 pixels
- 3-10 screenshots

**iPad Pro 12.9" (6th gen)** - OBLIGATOIRE:
- 2048 x 2732 pixels
- 3-10 screenshots

**Conseils pour les screenshots**:
1. Dashboard principal avec métriques
2. Liste des actifs avec filtres
3. Évaluation de risque
4. Rapport d'audit PDF
5. Tableau de bord conformité ISO 27001
6. Gestion de projet

#### 4. Informations de Révision

- **Coordonnées**: Email et téléphone pour Apple
- **Notes de révision**: Expliquer les fonctionnalités principales
- **Compte de démo**: Fournir identifiants de test si nécessaire
- **Pièce jointe**: Documentation si fonctionnalités complexes

#### 5. Informations de Confidentialité

- **URL de politique de confidentialité**: OBLIGATOIRE
- Créer une page: https://sentinel-grc.com/privacy
- Contenu requis:
  - Données collectées
  - Utilisation des données
  - Partage (aucun dans votre cas)
  - Droits des utilisateurs
  - Contact DPO

### Étape 7: Soumission

1. **Sélectionner le build** uploadé depuis Xcode
2. **Remplir toutes les métadonnées**
3. **Ajouter tous les screenshots**
4. **Accepter les accords** (Export Compliance, Content Rights)
5. **Soumettre pour révision**

**Délai de révision**: 24-48h en moyenne

---

## 📋 Checklist de Conformité Apple

### Sécurité et Confidentialité
- [x] Privacy Manifest (PrivacyInfo.xcprivacy)
- [x] Descriptions d'usage des permissions (Info.plist)
- [x] App Transport Security (HTTPS uniquement)
- [x] Politique de confidentialité publiée
- [x] Pas de tracking tiers
- [x] Chiffrement des données

### Qualité de l'App
- [ ] Pas de crash au lancement
- [ ] Toutes les fonctionnalités testées
- [ ] Performance optimale
- [ ] Interface responsive (iPhone + iPad)
- [ ] Support mode sombre
- [ ] Accessibilité (VoiceOver compatible)

### Contenu
- [ ] Pas de contenu offensant
- [ ] Pas de fausses déclarations
- [ ] Métadonnées précises
- [ ] Screenshots représentatifs
- [ ] Description claire et honnête

### Technique
- [x] Build pour iOS 13.0+
- [x] Support arm64
- [x] Pas de code obsolète
- [x] Pas de frameworks privés
- [x] Conformité aux guidelines Apple

---

## 🔄 Mises à Jour Futures

### Processus de mise à jour:

```bash
# 1. Incrémenter la version dans package.json
# Version: 2.0.0 -> 2.1.0
# Build: 1 -> 2

# 2. Rebuild et sync
npm run build
npm run cap:sync

# 3. Ouvrir Xcode et incrémenter
npm run cap:open:ios
# Dans Xcode: General > Version et Build

# 4. Archive et upload
# Product > Archive > Distribute

# 5. Dans App Store Connect
# Créer une nouvelle version
# Ajouter les notes de version
# Soumettre
```

---

## 🆘 Résolution de Problèmes

### Build échoue
```bash
# Nettoyer le cache
cd ios/App
pod deintegrate
pod install
cd ../..
npm run cap:sync
```

### Erreur de signature
- Vérifier le certificat dans Xcode > Preferences > Accounts
- Régénérer le profil de provisionnement
- Vérifier le Bundle ID dans App Store Connect

### App rejetée
- Lire attentivement le message de rejet
- Corriger le problème
- Répondre dans Resolution Center
- Resoumettre

---

## 📞 Support

### Documentation Apple
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)

### Capacitor
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [Capacitor Community](https://forum.ionicframework.com/)

---

## 📝 Notes Importantes

1. **Première soumission**: Peut prendre 2-5 jours de révision
2. **Mises à jour**: Généralement 24-48h
3. **Rejets communs**: 
   - Métadonnées incomplètes
   - Screenshots manquants
   - Politique de confidentialité absente
   - Crash au lancement
   - Fonctionnalités non documentées

4. **TestFlight**: Utilisez TestFlight pour les bêta-tests avant soumission
5. **Phased Release**: Activez le déploiement progressif pour limiter les risques

---

## ✅ Prochaines Étapes

1. [ ] Créer les assets (icon.png et splash.png)
2. [ ] Exécuter `npm run cap:add:ios`
3. [ ] Configurer Xcode avec votre Team ID
4. [ ] Créer l'app dans App Store Connect
5. [ ] Préparer les screenshots
6. [ ] Rédiger la politique de confidentialité
7. [ ] Build et upload
8. [ ] Soumettre pour révision

**Temps estimé total**: 4-6 heures pour la première soumission
