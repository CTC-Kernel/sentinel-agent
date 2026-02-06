# 🚀 Guide Rapide - Déploiement iOS en 30 Minutes

## Étape 1: Générer les Assets (5 min)

### Icône de l'Application
1. Ouvrir `scripts/generate-app-icon.html` dans votre navigateur
2. Cliquer sur "📥 Télécharger icon.png"
3. Enregistrer dans `resources/icon.png`

### Splash Screen
1. Ouvrir `scripts/generate-splash-screen.html` dans votre navigateur
2. Cliquer sur "📥 Télécharger splash.png"
3. Enregistrer dans `resources/splash.png`

### Générer toutes les tailles
```bash
npm install -g @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#0f172a' --splashBackgroundColor '#0f172a'
```

---

## Étape 2: Build et Initialisation iOS (10 min)

```bash
# 1. Build de l'application web
npm run build

# 2. Ajouter la plateforme iOS (première fois uniquement)
npm run cap:add:ios

# 3. Synchroniser le code
npm run cap:sync

# 4. Ouvrir Xcode
npm run cap:open:ios
```

---

## Étape 3: Configuration Xcode (5 min)

### Dans Xcode:

1. **Sélectionner le projet "App"** dans le navigateur de gauche

2. **Onglet "General"**:
   - Display Name: `Sentinel GRC`
   - Bundle Identifier: `com.sentinel.grc`
   - Version: `2.0.0`
   - Build: `1`
   - Team: **Sélectionner votre équipe Apple Developer** ⚠️

3. **Onglet "Signing & Capabilities"**:
   - ✅ Cocher "Automatically manage signing"
   - Team: Votre équipe
   - Vérifier que le profil est créé automatiquement

---

## Étape 4: Build et Archive (5 min)

1. **Sélectionner le device**: En haut à gauche, choisir "Any iOS Device (arm64)"

2. **Menu Product > Archive**

3. **Attendre la fin du build** (3-5 min)

4. **Window > Organizer** s'ouvre automatiquement

---

## Étape 5: Upload vers App Store Connect (5 min)

1. Dans **Organizer**, sélectionner votre archive

2. Cliquer **"Distribute App"**

3. Sélectionner **"App Store Connect"**

4. Cliquer **"Upload"**

5. Attendre la confirmation (peut prendre 10-30 min pour apparaître dans App Store Connect)

---

## ✅ Vérification

### Vérifier que tout est OK:
```bash
# Vérifier que le build web existe
ls -la dist/

# Vérifier que iOS est configuré
ls -la ios/App/

# Vérifier les assets
ls -la resources/
```

---

## 🆘 Problèmes Courants

### "No account for team"
➡️ Xcode > Preferences > Accounts > Ajouter votre compte Apple Developer

### "Failed to create provisioning profile"
➡️ Vérifier que le Bundle ID `com.sentinel.grc` est unique et disponible

### "Build failed"
```bash
cd ios/App
pod deintegrate
pod install
cd ../..
npm run cap:sync
```

### "Archive not showing in Organizer"
➡️ Vérifier que vous avez sélectionné "Any iOS Device" (pas un simulateur)

---

## 📱 Prochaines Étapes

Après l'upload, aller sur [App Store Connect](https://appstoreconnect.apple.com):

1. **My Apps** > **+** > **New App**
2. Remplir les métadonnées (voir `APPLE_STORE_DEPLOYMENT.md`)
3. Ajouter les screenshots
4. Sélectionner le build uploadé
5. Soumettre pour révision

**Délai de révision**: 24-48h en moyenne

---

## 📚 Documentation Complète

- **Guide détaillé**: `APPLE_STORE_DEPLOYMENT.md`
- **Checklist complète**: `APP_STORE_CHECKLIST.md`
- **Politique de confidentialité**: `PRIVACY_POLICY.md`

---

## 🎯 Commandes Essentielles

```bash
# Build et sync
npm run build && npm run cap:sync

# Ouvrir Xcode
npm run cap:open:ios

# Build complet (web + sync + Xcode)
npm run ios:build

# Mettre à jour après modifications
npm run cap:sync
```

---

**Temps total estimé**: 30 minutes pour le premier déploiement  
**Mises à jour ultérieures**: 10 minutes
