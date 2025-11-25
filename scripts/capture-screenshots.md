# 📸 Guide de Capture des Screenshots App Store

## Prérequis

- Xcode installé
- Application buildée (`npm run build`)
- Simulateurs iOS configurés

## Simulateurs Requis

### iPhone 6.7" (iPhone 14 Pro Max)
- Résolution: 1290 x 2796 pixels
- 5 screenshots requis

### iPhone 6.5" (iPhone 11 Pro Max)
- Résolution: 1242 x 2688 pixels
- 5 screenshots requis

### iPad Pro 12.9" (6th gen)
- Résolution: 2048 x 2732 pixels
- 5 screenshots requis

## Étapes de Capture

### 1. Lancer les Simulateurs

```bash
# Ouvrir Xcode
npm run cap:open:ios

# Ou lancer directement les simulateurs
open -a Simulator

# Dans Xcode: Window > Devices and Simulators
# Créer les simulateurs si nécessaire
```

### 2. Écrans à Capturer

#### Screenshot 1: Dashboard Principal
- **Contenu**: Vue d'ensemble avec métriques clés
- **Éléments visibles**:
  - Statistiques de conformité
  - Graphiques de risques
  - Alertes importantes
  - Navigation claire

#### Screenshot 2: Gestion des Actifs
- **Contenu**: Liste des actifs avec filtres
- **Éléments visibles**:
  - Tableau des actifs
  - Filtres de recherche
  - Indicateurs de criticité
  - Actions rapides

#### Screenshot 3: Évaluation de Risque
- **Contenu**: Matrice de risques ou détail d'évaluation
- **Éléments visibles**:
  - Matrice probabilité/impact
  - Détails du risque
  - Plan de traitement
  - Graphiques

#### Screenshot 4: Rapport d'Audit
- **Contenu**: Vue d'un audit en cours
- **Éléments visibles**:
  - Grille de contrôles ISO 27001
  - Statuts de conformité
  - Preuves collectées
  - Bouton de génération PDF

#### Screenshot 5: Conformité ISO 27001
- **Contenu**: Tableau de bord de conformité
- **Éléments visibles**:
  - Annexe A avec statuts
  - Graphiques de progression
  - Contrôles applicables
  - SoA (Statement of Applicability)

### 3. Commandes de Capture

```bash
# Dans le simulateur, utiliser:
Cmd + S  # Capture d'écran

# Ou via ligne de commande:
xcrun simctl io booted screenshot screenshot.png

# Les screenshots sont sauvegardés sur le Bureau par défaut
```

### 4. Organisation des Fichiers

Créer la structure suivante:

```
screenshots/
├── iphone-6.7/
│   ├── 1-dashboard.png
│   ├── 2-assets.png
│   ├── 3-risks.png
│   ├── 4-audit.png
│   └── 5-compliance.png
├── iphone-6.5/
│   ├── 1-dashboard.png
│   ├── 2-assets.png
│   ├── 3-risks.png
│   ├── 4-audit.png
│   └── 5-compliance.png
└── ipad-12.9/
    ├── 1-dashboard.png
    ├── 2-assets.png
    ├── 3-risks.png
    ├── 4-audit.png
    └── 5-compliance.png
```

## Conseils de Qualité

### Design
- ✅ Interface propre et professionnelle
- ✅ Données réalistes (pas de "Lorem ipsum")
- ✅ Pas d'informations sensibles
- ✅ Bon contraste et lisibilité

### Contenu
- ✅ Montrer les fonctionnalités clés
- ✅ Éviter les écrans vides
- ✅ Utiliser des données de démonstration cohérentes
- ✅ Mettre en valeur l'UX

### Technique
- ✅ Résolution exacte requise
- ✅ Format PNG
- ✅ Pas de barre de statut simulateur
- ✅ Mode portrait (sauf iPad peut être landscape)

## Vérification

Avant d'uploader sur App Store Connect:

- [ ] 5 screenshots iPhone 6.7" (1290x2796)
- [ ] 5 screenshots iPhone 6.5" (1242x2688)
- [ ] 5 screenshots iPad Pro 12.9" (2048x2732)
- [ ] Tous en format PNG
- [ ] Résolutions exactes
- [ ] Contenu professionnel
- [ ] Pas d'informations sensibles

## Upload sur App Store Connect

1. Se connecter à [App Store Connect](https://appstoreconnect.apple.com)
2. My Apps > Sentinel GRC > App Store
3. Sélectionner la version
4. Section "App Previews and Screenshots"
5. Glisser-déposer les screenshots dans l'ordre
6. Sauvegarder

## Alternative: Utiliser l'Application Web

Si vous préférez capturer depuis l'application web en développement:

```bash
# Lancer l'app en mode dev
npm run dev

# Ouvrir dans le navigateur avec les bonnes dimensions
# Utiliser les DevTools pour simuler les devices
# Capturer avec Cmd+Shift+4 (macOS)
```

### Dimensions DevTools

**iPhone 14 Pro Max**: 430 x 932 (scale 3x = 1290 x 2796)
**iPhone 11 Pro Max**: 414 x 896 (scale 3x = 1242 x 2688)
**iPad Pro 12.9"**: 1024 x 1366 (scale 2x = 2048 x 2732)

## Temps Estimé

- Configuration simulateurs: 10 min
- Capture iPhone 6.7": 15 min
- Capture iPhone 6.5": 10 min
- Capture iPad: 10 min
- Organisation et vérification: 5 min

**Total**: ~50 minutes
