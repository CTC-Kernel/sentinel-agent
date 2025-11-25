# ✅ Checklist Complète - Déploiement Apple App Store

## 📋 Prérequis Compte Apple

- [ ] **Compte Apple Developer actif** (99$/an)
  - Inscription: https://developer.apple.com/programs/
  - Vérification: 24-48h
  
- [ ] **Accès App Store Connect**
  - URL: https://appstoreconnect.apple.com
  - Rôle: Account Holder ou Admin
  
- [ ] **Team ID récupéré**
  - Localisation: App Store Connect > Membership
  - Format: 10 caractères alphanumériques
  
- [ ] **Certificats de distribution iOS**
  - Xcode > Preferences > Accounts > Manage Certificates
  - Type: Apple Distribution
  
- [ ] **Profils de provisionnement**
  - Automatic signing activé dans Xcode
  - Ou création manuelle sur developer.apple.com

---

## 🖼️ Assets Graphiques

### Icône de l'Application
- [ ] **Icon.png créé** (1024x1024px)
  - Emplacement: `resources/icon.png`
  - Format: PNG sans transparence
  - Contenu: Logo Sentinel GRC
  - Fond: Uni (pas de dégradé complexe)
  - Pas de texte (sauf logo)
  
### Splash Screen
- [ ] **Splash.png créé** (2732x2732px)
  - Emplacement: `resources/splash.png`
  - Format: PNG
  - Background: #0f172a
  - Logo centré avec marges de sécurité
  
### Génération Automatique
- [ ] **Installer @capacitor/assets**
  ```bash
  npm install -g @capacitor/assets
  ```
  
- [ ] **Générer toutes les tailles**
  ```bash
  npx capacitor-assets generate --iconBackgroundColor '#0f172a' --splashBackgroundColor '#0f172a'
  ```

### Screenshots App Store (OBLIGATOIRE)

#### iPhone 6.7" (iPhone 14 Pro Max)
- [ ] Screenshot 1: Dashboard principal (1290x2796px)
- [ ] Screenshot 2: Liste des actifs (1290x2796px)
- [ ] Screenshot 3: Évaluation de risque (1290x2796px)
- [ ] Screenshot 4: Rapport d'audit (1290x2796px)
- [ ] Screenshot 5: Conformité ISO 27001 (1290x2796px)

#### iPhone 6.5" (iPhone 11 Pro Max)
- [ ] Screenshot 1: Dashboard (1242x2688px)
- [ ] Screenshot 2: Actifs (1242x2688px)
- [ ] Screenshot 3: Risques (1242x2688px)
- [ ] Screenshot 4: Audit (1242x2688px)
- [ ] Screenshot 5: Conformité (1242x2688px)

#### iPad Pro 12.9"
- [ ] Screenshot 1: Dashboard (2048x2732px)
- [ ] Screenshot 2: Actifs (2048x2732px)
- [ ] Screenshot 3: Risques (2048x2732px)
- [ ] Screenshot 4: Audit (2048x2732px)
- [ ] Screenshot 5: Conformité (2048x2732px)

**Outil recommandé**: Simulateur iOS + `Cmd+S` pour capturer

---

## 🔧 Configuration Technique

### Environnement de Développement
- [ ] **macOS installé** (obligatoire pour iOS)
- [ ] **Xcode 14+ installé**
  ```bash
  xcode-select --install
  ```
  
- [ ] **CocoaPods installé**
  ```bash
  sudo gem install cocoapods
  ```
  
- [ ] **Node.js 18+ et npm**
  ```bash
  node --version  # >= 18.0.0
  npm --version
  ```

### Dépendances Capacitor
- [x] **@capacitor/core** installé
- [x] **@capacitor/cli** installé
- [x] **@capacitor/ios** installé
- [x] **@capacitor/app** installé
- [x] **@capacitor/splash-screen** installé
- [x] **@capacitor/status-bar** installé

### Configuration Capacitor
- [x] **capacitor.config.ts** créé
  - appId: `com.sentinel.grc`
  - appName: `Sentinel GRC`
  - webDir: `dist`
  
- [ ] **Build de l'application web**
  ```bash
  npm run build
  ```
  
- [ ] **Initialiser Capacitor**
  ```bash
  npm run cap:init
  ```
  
- [ ] **Ajouter la plateforme iOS**
  ```bash
  npm run cap:add:ios
  ```
  
- [ ] **Synchroniser le code**
  ```bash
  npm run cap:sync
  ```

---

## 🔐 Sécurité et Conformité

### Privacy Manifest (iOS 17+)
- [x] **PrivacyInfo.xcprivacy créé**
  - Emplacement: `ios/App/App/PrivacyInfo.xcprivacy`
  - Tracking: Désactivé
  - Données collectées: Documentées
  - APIs utilisées: Déclarées

### Info.plist
- [x] **Descriptions de permissions**
  - NSCameraUsageDescription ✅
  - NSPhotoLibraryUsageDescription ✅
  - NSPhotoLibraryAddUsageDescription ✅
  - NSLocationWhenInUseUsageDescription ✅
  - NSCalendarsUsageDescription ✅
  - NSRemindersUsageDescription ✅
  - NSFaceIDUsageDescription ✅

- [x] **App Transport Security**
  - HTTPS uniquement
  - TLS 1.2 minimum
  - Domaines Firebase autorisés

- [x] **Encryption Export Compliance**
  - ITSAppUsesNonExemptEncryption: false
  - (HTTPS standard uniquement)

### Politique de Confidentialité
- [x] **PRIVACY_POLICY.md créé**
- [ ] **Publier sur un site web**
  - URL requise: https://sentinel-grc.com/privacy
  - Accessible publiquement
  - Conforme RGPD
  
- [ ] **Ajouter l'URL dans App Store Connect**

---

## 🏗️ Build et Configuration Xcode

### Ouvrir le Projet
- [ ] **Ouvrir Xcode**
  ```bash
  npm run cap:open:ios
  ```

### Configuration Générale (General Tab)
- [ ] **Display Name**: `Sentinel GRC`
- [ ] **Bundle Identifier**: `com.sentinel.grc`
- [ ] **Version**: `2.0.0`
- [ ] **Build**: `1`
- [ ] **Deployment Target**: `iOS 13.0`
- [ ] **Team**: Sélectionner votre équipe Apple Developer
- [ ] **Devices**: iPhone et iPad

### Signing & Capabilities
- [ ] **Automatically manage signing**: ✅ Activé
- [ ] **Team**: Votre équipe sélectionnée
- [ ] **Provisioning Profile**: Automatic

#### Capabilities à Ajouter
- [ ] **Push Notifications**
- [ ] **Background Modes**
  - Remote notifications
  - Background fetch
- [ ] **Associated Domains** (si deep linking)

### Build Settings
- [ ] **Architecture**: arm64
- [ ] **Build Active Architecture Only**: NO (Release)
- [ ] **Enable Bitcode**: NO
- [ ] **Strip Debug Symbols**: YES (Release)

### Info Tab
- [ ] **Vérifier toutes les permissions**
- [ ] **Langue principale**: Français
- [ ] **Supported Interface Orientations**:
  - iPhone: Portrait, Landscape Left, Landscape Right
  - iPad: All

---

## 📦 Build de Production

### Préparation
- [ ] **Incrémenter le numéro de version**
  - Dans `package.json`: version `2.0.0`
  - Dans Xcode General: Version `2.0.0`, Build `1`
  
- [ ] **Mode Release activé**
  - Scheme: App
  - Configuration: Release

### Archive
- [ ] **Sélectionner le device**: Any iOS Device (arm64)
- [ ] **Menu Product > Archive**
- [ ] **Attendre la fin du build** (5-10 min)
- [ ] **Vérifier l'archive dans Organizer**

### Validation
- [ ] **Window > Organizer**
- [ ] **Sélectionner l'archive**
- [ ] **Cliquer "Validate App"**
- [ ] **Corriger les erreurs éventuelles**

### Upload
- [ ] **Cliquer "Distribute App"**
- [ ] **Sélectionner "App Store Connect"**
- [ ] **Upload**
- [ ] **Attendre la confirmation** (peut prendre 10-30 min)

---

## 🌐 App Store Connect

### Créer l'Application
- [ ] **Se connecter**: https://appstoreconnect.apple.com
- [ ] **My Apps > + > New App**
- [ ] **Platforms**: iOS
- [ ] **Name**: `Sentinel GRC`
- [ ] **Primary Language**: French
- [ ] **Bundle ID**: `com.sentinel.grc`
- [ ] **SKU**: `sentinel-grc-2024`
- [ ] **User Access**: Full Access

### Informations de l'App

#### Version Information
- [ ] **Nom**: Sentinel GRC
- [ ] **Sous-titre**: Gouvernance, Risques & Conformité ISO 27001
- [ ] **Description**: (Voir APPLE_STORE_DEPLOYMENT.md)
- [ ] **Mots-clés**: ISO 27001, GRC, cybersécurité, conformité, audit, risques, RSSI, sécurité, SMSI, ISO 27005
- [ ] **URL de support**: https://sentinel-grc.com/support
- [ ] **URL marketing**: https://sentinel-grc.com
- [ ] **Promotional Text**: (Optionnel)

#### Catégories
- [ ] **Catégorie principale**: Business
- [ ] **Catégorie secondaire**: Productivity

#### Pricing
- [ ] **Modèle de prix défini**
  - Gratuit avec achats intégrés
  - Ou: Payant (définir le prix)
- [ ] **Disponibilité**: Tous les pays ou sélection

### Screenshots
- [ ] **iPhone 6.7"**: 5 screenshots uploadés
- [ ] **iPhone 6.5"**: 5 screenshots uploadés
- [ ] **iPad Pro 12.9"**: 5 screenshots uploadés

### App Preview (Optionnel)
- [ ] **Vidéo de démonstration** (30 secondes max)
- [ ] **Format**: .mov ou .mp4

### Build
- [ ] **Sélectionner le build** uploadé depuis Xcode
- [ ] **Vérifier la version et le numéro de build**

### Informations Générales

#### App Information
- [ ] **Nom**: Sentinel GRC
- [ ] **Catégorie**: Business
- [ ] **Licence**: Standard EULA ou Custom
- [ ] **Âge minimum**: 4+

#### Privacy Policy
- [ ] **URL**: https://sentinel-grc.com/privacy
- [ ] **Vérifier l'accessibilité**

#### App Review Information
- [ ] **Prénom et nom du contact**
- [ ] **Téléphone**
- [ ] **Email**
- [ ] **Notes pour l'équipe de révision**:
  ```
  Sentinel GRC est une plateforme professionnelle de gestion de la sécurité 
  des systèmes d'information conforme ISO 27001.
  
  Fonctionnalités principales:
  - Gestion des actifs IT
  - Évaluation des risques (ISO 27005)
  - Audits de conformité
  - Génération de rapports PDF
  - Tableaux de bord de conformité
  
  Compte de test fourni ci-dessous.
  ```

#### Compte de Démo (IMPORTANT)
- [ ] **Créer un compte de test**
- [ ] **Username**: demo@sentinel-grc.com
- [ ] **Password**: [Mot de passe sécurisé]
- [ ] **Pré-remplir avec des données de démonstration**
- [ ] **Fournir les identifiants dans "Sign-in required"**

### Export Compliance
- [ ] **Uses Encryption**: YES
- [ ] **Exempt from regulations**: YES (HTTPS standard uniquement)
- [ ] **ITSAppUsesNonExemptEncryption**: false

### Content Rights
- [ ] **Cocher "I have the rights to use..."**

---

## 🚀 Soumission

### Vérifications Finales
- [ ] **Toutes les métadonnées remplies**
- [ ] **Tous les screenshots uploadés**
- [ ] **Build sélectionné**
- [ ] **Politique de confidentialité accessible**
- [ ] **Compte de test fourni**
- [ ] **Notes de révision complètes**

### Soumettre
- [ ] **Cliquer "Submit for Review"**
- [ ] **Confirmer la soumission**
- [ ] **Recevoir l'email de confirmation**

### Statuts
- **Waiting for Review**: En attente (1-2 jours)
- **In Review**: En cours de révision (24-48h)
- **Pending Developer Release**: Approuvé, en attente de publication
- **Ready for Sale**: Publié sur l'App Store ✅
- **Rejected**: Rejeté (lire les raisons, corriger, resoumettre)

---

## 📊 Post-Soumission

### Monitoring
- [ ] **Vérifier les emails Apple**
- [ ] **Consulter App Store Connect quotidiennement**
- [ ] **Répondre rapidement aux demandes de l'équipe de révision**

### En Cas de Rejet
- [ ] **Lire attentivement le message de rejet**
- [ ] **Corriger les problèmes identifiés**
- [ ] **Répondre dans Resolution Center**
- [ ] **Resoumettre une nouvelle version**

### Après Approbation
- [ ] **Vérifier l'app sur l'App Store**
- [ ] **Tester le téléchargement**
- [ ] **Partager le lien**: https://apps.apple.com/app/sentinel-grc/[ID]
- [ ] **Activer Phased Release** (déploiement progressif)
- [ ] **Monitorer les crashes et reviews**

---

## 🔄 Mises à Jour Futures

### Processus
1. [ ] Incrémenter version dans `package.json`
2. [ ] `npm run build`
3. [ ] `npm run cap:sync`
4. [ ] Ouvrir Xcode, incrémenter Version et Build
5. [ ] Archive et upload
6. [ ] Créer nouvelle version dans App Store Connect
7. [ ] Ajouter "What's New" (notes de version)
8. [ ] Soumettre

### Notes de Version (Exemple)
```
Version 2.1.0

Nouveautés:
• Nouveau tableau de bord 3D interactif
• Export Excel amélioré
• Notifications push pour les échéances
• Performance optimisée

Corrections:
• Correction du bug d'affichage des risques
• Amélioration de la synchronisation
```

---

## 📞 Support et Ressources

### Documentation Apple
- [ ] [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [ ] [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [ ] [App Store Connect Help](https://help.apple.com/app-store-connect/)

### Capacitor
- [ ] [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [ ] [Capacitor Community Forum](https://forum.ionicframework.com/)

### Outils
- [ ] [App Store Connect](https://appstoreconnect.apple.com)
- [ ] [Apple Developer Portal](https://developer.apple.com)
- [ ] [TestFlight](https://testflight.apple.com) (bêta-testing)

---

## ⏱️ Estimation de Temps

| Tâche | Durée Estimée |
|-------|---------------|
| Création des assets | 2-3 heures |
| Configuration Xcode | 1 heure |
| Premier build | 30 min |
| Screenshots | 1-2 heures |
| Métadonnées App Store Connect | 1-2 heures |
| Politique de confidentialité | 1 heure |
| Upload et soumission | 30 min |
| **TOTAL PREMIÈRE SOUMISSION** | **6-10 heures** |
| Mises à jour ultérieures | 1-2 heures |

---

## ✅ Résumé des Fichiers Créés

- [x] `capacitor.config.ts` - Configuration Capacitor
- [x] `ios/App/App/Info.plist` - Métadonnées iOS
- [x] `ios/App/App/PrivacyInfo.xcprivacy` - Privacy Manifest
- [x] `ExportOptions.plist` - Options d'export
- [x] `APPLE_STORE_DEPLOYMENT.md` - Guide détaillé
- [x] `PRIVACY_POLICY.md` - Politique de confidentialité
- [x] `resources/README.md` - Guide des assets
- [x] Scripts npm ajoutés dans `package.json`
- [x] `.gitignore` mis à jour

---

## 🎯 Prochaines Actions Immédiates

1. **Créer les assets graphiques**:
   - [ ] Concevoir `resources/icon.png` (1024x1024)
   - [ ] Concevoir `resources/splash.png` (2732x2732)
   - [ ] Générer toutes les tailles: `npx capacitor-assets generate`

2. **Initialiser iOS**:
   ```bash
   npm run build
   npm run cap:add:ios
   npm run cap:sync
   ```

3. **Configurer Xcode**:
   ```bash
   npm run cap:open:ios
   ```
   - Sélectionner votre Team
   - Vérifier Bundle ID
   - Activer signing automatique

4. **Créer l'app dans App Store Connect**:
   - Bundle ID: `com.sentinel.grc`
   - Nom: Sentinel GRC

5. **Préparer les screenshots**:
   - Utiliser le simulateur iOS
   - Capturer 5 écrans principaux
   - 3 tailles requises

6. **Publier la politique de confidentialité**:
   - Héberger `PRIVACY_POLICY.md` sur votre site
   - URL: https://sentinel-grc.com/privacy

7. **Build et upload**:
   - Archive dans Xcode
   - Upload vers App Store Connect

8. **Soumettre pour révision**:
   - Remplir toutes les métadonnées
   - Fournir compte de test
   - Soumettre

---

**Statut**: ✅ Configuration technique complète  
**Prêt pour**: Création des assets et build iOS  
**Temps restant estimé**: 6-10 heures de travail
