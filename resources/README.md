# Resources pour iOS App Store

## Icônes requises

### Icon.png (1024x1024px)
- Format: PNG sans transparence
- Taille: 1024x1024 pixels
- Utilisation: App Store et icône principale iOS
- Doit représenter le logo Sentinel GRC

### Splash Screen (2732x2732px)
- Format: PNG
- Taille: 2732x2732 pixels (iPad Pro 12.9")
- Background: #0f172a (slate-900)
- Logo centré avec espace de sécurité

## Génération automatique

Capacitor générera automatiquement toutes les tailles requises à partir de ces fichiers sources.

### Commande de génération:
```bash
npm install -g @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#0f172a' --splashBackgroundColor '#0f172a'
```

## Tailles iOS générées automatiquement

### App Icons:
- 20x20, 29x29, 40x40, 58x58, 60x60, 76x76, 80x80, 87x87, 120x120, 152x152, 167x167, 180x180, 1024x1024

### Splash Screens:
- iPhone SE, 8, 8 Plus, X, XS, XS Max, XR, 11, 11 Pro, 11 Pro Max, 12, 12 Pro, 12 Pro Max, 13, 13 Pro, 13 Pro Max, 14, 14 Plus, 14 Pro, 14 Pro Max
- iPad, iPad Pro 9.7", 10.5", 11", 12.9"

## Design Guidelines Apple

1. **Pas de transparence** sur l'icône principale
2. **Coins arrondis** appliqués automatiquement par iOS
3. **Couleurs cohérentes** avec votre branding
4. **Lisibilité** à toutes les tailles
5. **Pas de texte** dans l'icône (sauf logo)
