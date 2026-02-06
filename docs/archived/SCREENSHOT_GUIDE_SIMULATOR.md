# 📸 Guide de Capture Screenshots - Simulateur iOS

## 🎯 Objectif
Capturer 15 screenshots (3 devices × 5 écrans) pour l'App Store.

---

## 📱 Simulateurs Requis

### 1. iPhone 15 Pro Max (6.7") - 1290x2796
### 2. iPhone 11 Pro Max (6.5") - 1242x2688  
### 3. iPad Pro 12.9" - 2048x2732

---

## 🚀 Étapes de Capture

### Préparation

Le simulateur est en train de s'ouvrir et l'application est en cours de build.

### Une fois l'app lancée dans le simulateur :

#### Méthode 1 : Capture via Cmd+S (Recommandée)

1. **Dans le simulateur**, appuyez sur **Cmd+S**
2. Le screenshot sera sauvegardé sur votre **Bureau**
3. Les dimensions seront automatiquement correctes

#### Méthode 2 : Capture via ligne de commande

```bash
# Obtenir l'UUID du simulateur actif
xcrun simctl list devices | grep Booted

# Capturer (remplacez DEVICE_UUID)
xcrun simctl io DEVICE_UUID screenshot ~/Desktop/screenshot.png
```

---

## 📋 Checklist de Capture

### iPhone 15 Pro Max (6.7")

Naviguez dans l'app et capturez :

- [ ] **1-dashboard.png** - Dashboard principal (page d'accueil)
  - Appuyez sur Cmd+S
  - Renommez en `iphone-6.7/1-dashboard.png`

- [ ] **2-assets.png** - Gestion des actifs
  - Naviguez vers Assets (menu ou onglet)
  - Cmd+S
  - Renommez en `iphone-6.7/2-assets.png`

- [ ] **3-risks.png** - Évaluation des risques
  - Naviguez vers Risks
  - Cmd+S
  - Renommez en `iphone-6.7/3-risks.png`

- [ ] **4-audits.png** - Rapports d'audit
  - Naviguez vers Audits
  - Cmd+S
  - Renommez en `iphone-6.7/4-audits.png`

- [ ] **5-compliance.png** - Conformité ISO 27001
  - Naviguez vers Compliance
  - Cmd+S
  - Renommez en `iphone-6.7/5-compliance.png`

### Changer de Simulateur

**Pour iPhone 11 Pro Max (6.5")** :

1. Dans Xcode : Arrêtez l'app (Cmd+.)
2. Changez le device : Sélectionnez "iPhone 11 Pro Max" en haut
3. Relancez : Cmd+R
4. Répétez les 5 captures ci-dessus
5. Sauvegardez dans `iphone-6.5/`

**Pour iPad Pro 12.9"** :

1. Changez le device : Sélectionnez "iPad Pro (12.9-inch)"
2. Relancez : Cmd+R
3. Répétez les 5 captures
4. Sauvegardez dans `ipad-12.9/`

---

## 📁 Organisation des Fichiers

Créez cette structure sur votre Bureau ou dans `~/Desktop/screenshots/` :

```
screenshots/
├── iphone-6.7/
│   ├── 1-dashboard.png (1290x2796)
│   ├── 2-assets.png
│   ├── 3-risks.png
│   ├── 4-audits.png
│   └── 5-compliance.png
├── iphone-6.5/
│   ├── 1-dashboard.png (1242x2688)
│   ├── 2-assets.png
│   ├── 3-risks.png
│   ├── 4-audits.png
│   └── 5-compliance.png
└── ipad-12.9/
    ├── 1-dashboard.png (2048x2732)
    ├── 2-assets.png
    ├── 3-risks.png
    ├── 4-audits.png
    └── 5-compliance.png
```

---

## 🎨 Conseils pour de Beaux Screenshots

### Contenu à Afficher

✅ **Dashboard** :
- Statistiques clés visibles
- Graphiques colorés
- Indicateurs de conformité
- Navigation claire

✅ **Assets** :
- Liste d'actifs avec icônes
- Filtres visibles
- Indicateurs de criticité (couleurs)

✅ **Risks** :
- Matrice de risques
- Niveaux de risque colorés
- Détails d'un risque

✅ **Audits** :
- Grille de contrôles ISO
- Statuts de conformité
- Boutons d'action visibles

✅ **Compliance** :
- Tableau de bord ISO 27001
- Graphiques de progression
- Annexe A visible

### À Éviter

❌ Écrans vides ou de chargement
❌ Messages d'erreur
❌ Données sensibles réelles
❌ Lorem ipsum ou texte de placeholder
❌ Barre de statut du simulateur (elle sera masquée automatiquement)

---

## 🔧 Commandes Utiles

### Lancer l'app dans un simulateur spécifique

```bash
# iPhone 15 Pro Max
npm run cap:sync
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Pro Max' build
xcrun simctl install booted ios/App/build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.sentinel.grc

# iPhone 11 Pro Max
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 11 Pro Max' build

# iPad Pro 12.9"
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPad Pro (12.9-inch) (6th generation)' build
```

### Capturer depuis la ligne de commande

```bash
# Trouver le simulateur actif
DEVICE_UUID=$(xcrun simctl list devices | grep Booted | grep -oE '\([A-F0-9-]+\)' | tr -d '()')

# Capturer
xcrun simctl io $DEVICE_UUID screenshot ~/Desktop/screenshot-$(date +%s).png
```

---

## ⏱️ Temps Estimé

- **iPhone 6.7"** : 5 min (5 screenshots)
- **iPhone 6.5"** : 5 min (5 screenshots)
- **iPad 12.9"** : 5 min (5 screenshots)
- **Organisation** : 5 min

**Total** : ~20 minutes

---

## ✅ Vérification Finale

Avant d'uploader sur App Store Connect :

- [ ] 15 screenshots au total (3 × 5)
- [ ] Dimensions correctes pour chaque device
- [ ] Format PNG
- [ ] Noms de fichiers clairs
- [ ] Contenu professionnel et représentatif
- [ ] Pas d'informations sensibles

---

## 🚀 Prochaine Étape

Une fois les screenshots capturés :

1. **Organisez-les** dans les dossiers appropriés
2. **Archivez l'app** dans Xcode : Product > Archive
3. **Uploadez sur App Store Connect**
4. **Ajoutez les screenshots** dans la section "App Previews and Screenshots"

Consultez **`APP_STORE_CONNECT_GUIDE.md`** pour la suite !

---

**Bon courage ! 📸**
