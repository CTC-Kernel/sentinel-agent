# 🎯 Guide Final Xcode - Sentinel GRC

## ✅ Configuration Automatique Terminée

Toutes les configurations automatiques ont été appliquées :
- ✅ Info.plist configuré (version 2.0.0, build 1)
- ✅ Assets (icônes et splash screens) intégrés
- ✅ Entitlements créés
- ✅ CocoaPods installés et à jour

---

## 📱 Étapes Manuelles dans Xcode (5 minutes)

### Étape 1 : Ouvrir le Projet

Le projet Xcode devrait déjà être ouvert. Sinon :

```bash
npm run cap:open:ios
```

### Étape 2 : Configuration de la Signature (CRITIQUE)

1. **Sélectionner le projet** :
   - Dans le navigateur de gauche, cliquez sur **"App"** (l'icône bleue en haut)

2. **Onglet "Signing & Capabilities"** :
   - ✅ **Cocher** : "Automatically manage signing"
   - ✅ **Team** : Sélectionnez votre compte Apple Developer dans le menu déroulant
   - ✅ **Bundle Identifier** : Vérifiez que c'est bien `com.sentinel.grc`
   - ✅ **Signing Certificate** : Devrait afficher "Apple Development" ou "Apple Distribution"

> ⚠️ **Si vous voyez une erreur** : Assurez-vous d'être connecté à votre compte Apple Developer dans Xcode (Preferences > Accounts)

### Étape 3 : Vérification des Métadonnées

**Onglet "General"** :
- ✅ **Display Name** : `Sentinel GRC`
- ✅ **Version** : `2.0.0`
- ✅ **Build** : `1`
- ✅ **Deployment Info** :
  - iOS : `13.0` (minimum)
  - iPhone et iPad supportés

### Étape 4 : Vérification des Assets

1. Dans le navigateur de gauche, ouvrez :
   ```
   App > App > Assets.xcassets
   ```

2. Vérifiez :
   - ✅ **AppIcon** : Doit contenir toutes les tailles d'icônes
   - ✅ **Splash** : Doit contenir les splash screens (clair et sombre)

### Étape 5 : Configuration Build (Optionnel mais Recommandé)

**Onglet "Build Settings"** (sélectionnez "All" et "Combined") :

Recherchez et vérifiez :
- **Code Signing Identity (Release)** : `Apple Distribution`
- **Development Team** : Votre Team ID
- **Code Signing Style** : `Automatic`

---

## 🏗️ Archivage pour l'App Store

### Préparation

1. **Sélectionner le bon device** :
   - En haut à gauche, à côté du bouton Play/Stop
   - Cliquez sur le menu déroulant
   - Sélectionnez : **"Any iOS Device (arm64)"**
   - ⚠️ NE PAS sélectionner un simulateur !

2. **Nettoyer le build** (recommandé) :
   - Menu : **Product > Clean Build Folder** (⇧⌘K)

### Archivage

1. **Lancer l'archive** :
   - Menu : **Product > Archive**
   - ⏱️ Durée : 2-5 minutes selon votre Mac

2. **Une fois l'archive terminée** :
   - La fenêtre "Organizer" s'ouvre automatiquement
   - Vous devriez voir votre archive "Sentinel GRC 2.0.0 (1)"

### Distribution vers App Store Connect

1. **Dans Organizer** :
   - Sélectionnez votre archive
   - Cliquez sur **"Distribute App"**

2. **Méthode de distribution** :
   - Sélectionnez : **"App Store Connect"**
   - Cliquez : **"Next"**

3. **Destination** :
   - Sélectionnez : **"Upload"**
   - Cliquez : **"Next"**

4. **Options de distribution** :
   - ✅ Cocher : "Upload your app's symbols to receive symbolicated crash logs from Apple"
   - ✅ Cocher : "Manage Version and Build Number" (optionnel)
   - Cliquez : **"Next"**

5. **Signature automatique** :
   - Sélectionnez : **"Automatically manage signing"**
   - Cliquez : **"Next"**

6. **Révision** :
   - Vérifiez les informations
   - Cliquez : **"Upload"**

7. **Upload en cours** :
   - ⏱️ Durée : 5-15 minutes selon votre connexion
   - ✅ Une fois terminé : "Upload Successful"

---

## 📧 Après l'Upload

### Vérification dans App Store Connect

1. Allez sur : https://appstoreconnect.apple.com
2. **My Apps** > **Sentinel GRC**
3. Onglet **"TestFlight"** :
   - Votre build devrait apparaître dans "iOS Builds"
   - Statut initial : "Processing" (⏱️ 10-30 minutes)
   - Statut final : "Ready to Submit" ou "Missing Compliance"

### Si "Missing Compliance" apparaît

C'est normal ! Répondez au questionnaire :
- **Does your app use encryption?** : `No` (ou `Yes` si vous utilisez HTTPS uniquement, alors sélectionnez "Exempt")
- Suivez les instructions à l'écran

---

## 🚀 Soumission pour Révision

### Préparer les Métadonnées

1. Dans App Store Connect, onglet **"App Store"**
2. Cliquez sur **"+ Version"** ou sélectionnez la version existante

### Remplir les Informations (Utilisez APP_STORE_METADATA.md)

**Informations de l'app** :
- **Nom** : `Sentinel GRC`
- **Sous-titre** : `Gouvernance, Risques & Conformité`
- **Description** : Copiez depuis `APP_STORE_METADATA.md`
- **Mots-clés** : Copiez depuis `APP_STORE_METADATA.md`
- **URL de support** : `https://sentinel-grc.com/support`
- **URL marketing** : `https://sentinel-grc.com`

**Confidentialité** :
- **URL de confidentialité** : `https://sentinel-grc.com/privacy`

**Catégorie** :
- **Principale** : `Business` ou `Productivity`
- **Secondaire** : `Utilities`

**Captures d'écran** :
- Suivez le guide : `scripts/capture-screenshots.md`
- Uploadez les 15 screenshots (3 tailles × 5 écrans)

**Informations de révision** :
- **Contact** : Vos coordonnées
- **Compte de démo** :
  - Email : `demo@sentinel-grc.com`
  - Mot de passe : `SentinelDemo2024!`
- **Notes** : Copiez depuis `APP_STORE_METADATA.md`

### Sélectionner le Build

1. Section **"Build"**
2. Cliquez sur **"+ Build"**
3. Sélectionnez votre build `2.0.0 (1)`

### Soumettre

1. Vérifiez que tout est rempli (icône verte ✅ partout)
2. Cliquez sur **"Add for Review"** ou **"Submit for Review"**
3. Répondez aux questions de conformité
4. Confirmez la soumission

---

## ⏱️ Timeline de Révision

- **Soumission** : Immédiat
- **En attente de révision** : 1-3 jours
- **En révision** : 1-2 jours
- **Approuvé** : Publication automatique ou manuelle

---

## 🆘 Dépannage

### Erreur : "No signing certificate found"

**Solution** :
1. Xcode > Preferences > Accounts
2. Sélectionnez votre compte Apple
3. Cliquez sur "Manage Certificates"
4. Cliquez sur "+" > "Apple Distribution"

### Erreur : "Provisioning profile doesn't include signing certificate"

**Solution** :
1. Décochez "Automatically manage signing"
2. Recochez "Automatically manage signing"
3. Xcode va recréer le profil

### Archive grisée dans Organizer

**Solution** :
1. Vérifiez que vous avez bien sélectionné "Any iOS Device (arm64)"
2. Product > Clean Build Folder
3. Relancez l'archive

### Upload échoue

**Solution** :
1. Vérifiez votre connexion internet
2. Vérifiez que votre compte Apple Developer est actif
3. Essayez avec Application Loader (Xcode > Open Developer Tool > Application Loader)

---

## ✅ Checklist Finale

Avant de soumettre, vérifiez :

- [ ] Build uploadé avec succès sur App Store Connect
- [ ] Build traité (statut "Ready to Submit")
- [ ] Toutes les métadonnées remplies
- [ ] 15 screenshots uploadés (3 tailles)
- [ ] URL de confidentialité accessible : https://sentinel-grc.com/privacy
- [ ] Compte de démo fourni et testé
- [ ] Catégories sélectionnées
- [ ] Informations de contact correctes
- [ ] Export compliance répondu
- [ ] Soumis pour révision

---

## 🎉 Félicitations !

Une fois soumis, vous recevrez :
1. Email de confirmation de soumission
2. Email "In Review" (1-3 jours)
3. Email "Ready for Sale" ou "Rejected" (1-2 jours après)

**En cas de rejet** : Lisez attentivement les raisons, corrigez, et resoumettez.

**En cas d'approbation** : Votre app sera disponible sur l'App Store ! 🚀

---

**Besoin d'aide ?** Consultez :
- `APPLE_STORE_DEPLOYMENT.md` - Guide complet
- `APP_STORE_CHECKLIST.md` - Checklist détaillée
- `FINAL_COMPLIANCE_REPORT.md` - Rapport de conformité
