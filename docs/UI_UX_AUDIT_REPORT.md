# Audit UI/UX - Sentinel GRC v2

**Date:** 2026-01-12
**Application:** Sentinel GRC v2
**Scope:** Analyse complète des incohérences de style et bugs UI/UX

---

## Résumé Exécutif

| Catégorie | Issues Critiques | Issues Hautes | Issues Moyennes |
|-----------|-----------------|---------------|-----------------|
| Couleurs hardcodées | 15 | 30 | 16 |
| Incohérences d'espacement | 5 | 12 | 20+ |
| Styles de boutons | 8 | 15 | 10 |
| Z-index | 4 | 0 | 0 |
| Tailles d'icônes | 3 | 10 | 15 |
| Accessibilité | 5 | 8 | 6 |

**Total estimé: ~180 issues**

---

## 1. COULEURS HARDCODÉES (Critique)

### Problème
Multiple composants utilisent des valeurs hex hardcodées au lieu du système de design tokens défini dans `tailwind.config.js` et `theme/chartTheme.ts`.

### Fichiers Affectés

| Fichier | Ligne | Issue | Fix Recommandé |
|---------|-------|-------|----------------|
| `src/components/continuity/dashboard/ContinuityCharts.tsx` | 45-47 | `#10b981`, `#f59e0b`, `#ef4444` | Utiliser `SEVERITY_COLORS` du thème |
| `src/components/continuity/dashboard/ContinuityCharts.tsx` | 183-189 | Couleurs gradient hardcodées dans SVG | Utiliser `ChartGradients` |
| `src/components/ui/ScoreGauge.tsx` | 41-43 | `#fca5a5`, `#fdba74`, `#86efac` | Créer design token |
| `src/components/suppliers/SupplierDashboard.tsx` | 29-32 | `#ef4444`, `#f97316`, `#eab308`, `#22c55e` | Utiliser `SEVERITY_COLORS` |
| `src/components/suppliers/SupplierDashboard.tsx` | 278-293 | Couleurs de graphiques hardcodées | Utiliser palette du thème |
| `src/components/audits/dashboard/AuditCharts.tsx` | 88-104 | `#94a3b8`, `#EF4444`, `#F59E0B`, `#3B82F6` | Utiliser `SEVERITY_COLORS` |
| `src/components/audits/SingleAuditStats.tsx` | 22-25 | Couleurs de type de finding | Utiliser tokens sémantiques |
| `src/components/audits/AuditDashboard.tsx` | 42-45 | Couleurs de statut hardcodées | Créer status color tokens |
| `src/components/threats/ThreatDashboard.tsx` | 162-196 | Couleurs de graphiques | Utiliser palette du thème |
| `src/components/projects/ProjectDashboard.tsx` | 59-70 | Couleurs statut/priorité | Utiliser design tokens |
| `src/components/landing/LandingMap.tsx` | 65-66 | `#94a3b8`, `#e2e8f0` dans SVG | Utiliser classes Tailwind |
| `src/components/ui/aceternity/BorderBeam.tsx` | 9-10 | `#ffaa40`, `#9c40ff` | Rendre configurable |
| `src/components/ui/aceternity/Sparkles.tsx` | 59 | `#ffffff` hardcodé | Utiliser design token |
| `src/components/ui/ProgressRing.tsx` | 18 | `#3b82f6` comme défaut | Utiliser couleur Tailwind |

### Solution Recommandée

```typescript
// Créer src/constants/colors.ts
export const SEVERITY_COLORS = {
  critical: 'rgb(var(--color-error))',
  high: 'rgb(var(--color-warning))',
  medium: 'rgb(var(--color-info))',
  low: 'rgb(var(--color-success))',
} as const;

export const CHART_COLORS = {
  primary: 'rgb(var(--color-brand-500))',
  secondary: 'rgb(var(--color-brand-400))',
  // ...
} as const;
```

---

## 2. INCOHÉRENCES DE STYLES DE BOUTONS (Haute)

### Problème
Mélange de styles inline et variants. Certains boutons n'utilisent pas le système `button-variants.ts`.

### Fichiers Affectés

| Fichier | Ligne | Style Actuel | Fix |
|---------|-------|--------------|-----|
| `src/components/continuity/WarRoomModal.tsx` | 195 | `bg-blue-600 hover:bg-blue-700...` inline | `variant="default"` |
| `src/components/continuity/ContinuityCrisis.tsx` | 106 | `border-red-500 text-red-500...` inline | `variant="destructive"` |
| `src/components/ui/ContactModal.tsx` | 189 | `bg-blue-600 hover:bg-blue-700...` inline | `variant="default"` |
| `src/components/ui/FilePreview.tsx` | 110 | `bg-blue-600 hover:bg-blue-700...` inline | `variant="default"` |
| `src/components/ui/CSVImport.tsx` | 303 | `bg-green-600...` hardcodé | `variant="default"` |
| `src/components/ui/DatePicker.tsx` | 115 | `text-red-500...` inline | Utiliser variant |
| `src/components/continuity/ProcessFormModal.tsx` | 150 | Style dropdown inconsistant | Standardiser |

### Solution

Remplacer tous les styles inline par les variants définis:
```tsx
// Avant
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">

// Après
import { Button } from '@/components/ui/button';
<Button variant="default">
```

---

## 3. INCOHÉRENCES Z-INDEX (Moyenne)

### Problème
Valeurs z-index arbitraires au lieu d'utiliser l'échelle définie.

### Échelle Définie (tailwind.config.js)
```javascript
zIndex: {
  decorator: 10,
  sticky: 20,
  header: 40,
  modal: 50,
  tooltip: 60,
  max: 9999,
}
```

### Issues

| Fichier | Ligne | Valeur Actuelle | Fix |
|---------|-------|-----------------|-----|
| `src/components/continuity/WarRoomModal.tsx` | 60 | `z-[200]` | `z-modal` |
| `src/components/ui/OfflineBanner.tsx` | 28 | `z-[100]` | `z-sticky` ou `z-header` |
| `src/components/continuity/WarRoomModal.tsx` | 76 | `z-50` | `z-max` pour overlay |

---

## 4. TAILLES D'ICÔNES INCOHÉRENTES (Moyenne)

### Problème
10+ combinaisons de tailles différentes sans pattern clair.

### Tailles Trouvées
`w-3 h-3`, `w-3.5 h-3.5`, `w-4 h-4`, `w-5 h-5`, `w-6 h-6`, `w-8 h-8`, `w-10 h-10`, `w-12 h-12`

### Système Recommandé

| Taille | Classes | Usage |
|--------|---------|-------|
| xs | `w-3 h-3` | Badges, indicateurs inline |
| sm | `w-4 h-4` | Items de liste, boutons |
| md | `w-5 h-5` | Headers, navigation |
| lg | `w-6 h-6` | Headers de carte |
| xl | `w-8 h-8` | Empty states, warnings |
| 2xl | `w-10 h-10` | Grande emphase |
| 3xl | `w-12 h-12` | Sections majeures |

### Fichiers à Corriger

| Fichier | Ligne | Actuel | Recommandé |
|---------|-------|--------|------------|
| `src/components/continuity/WarRoomModal.tsx` | 138 | `w-5 h-5` close button | `w-4 h-4` (cohérent) |
| `src/components/continuity/WarRoomModal.tsx` | 186 vs 196 | `w-5 h-5` vs `w-4 h-4` | Uniformiser à `w-4 h-4` |
| `src/components/suppliers/SupplierCard.tsx` | 70 | `h-3.5 w-3.5` | `w-4 h-4` (sm) |

---

## 5. PROBLÈMES D'ACCESSIBILITÉ (Critique)

### 5.1 Éléments Interactifs Sans Support Clavier

| Fichier | Ligne | Issue | Fix |
|---------|-------|-------|-----|
| `src/components/ui/StatCard.tsx` | 51 | `onClick` sans `onKeyDown` | Ajouter handler clavier |

```tsx
// Fix pour StatCard.tsx
<div
  onClick={onClick}
  onKeyDown={(e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  }}
  tabIndex={onClick ? 0 : undefined}
  role={onClick ? 'button' : undefined}
  className={cn(className, onClick && 'cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-500')}
>
```

### 5.2 Aria-labels Manquants

| Fichier | Ligne | Élément | Fix |
|---------|-------|---------|-----|
| `src/components/ui/ThemeToggle.tsx` | 32 | Toggle button | `aria-label="Basculer le mode sombre"` |
| `src/components/ui/RichTextEditor.tsx` | 42-130 | Boutons toolbar | Ajouter `aria-label` à chaque icône |
| `src/components/ui/StatCard.tsx` | 51 | Carte cliquable | `aria-label="Voir les détails de [stat]"` |

### 5.3 Images Sans Alt Text

| Fichier | Ligne | Issue | Fix |
|---------|-------|-------|-----|
| `src/components/ui/LazyImage.tsx` | 71 | `alt=""` vide | Fournir alt descriptif ou `role="presentation"` |
| `src/components/continuity/ContinuityBIA.tsx` | 110-117 | Alt minimal | `alt="Avatar du propriétaire: ${name}"` |

### 5.4 Problèmes de Contraste de Couleurs

| Fichier | Ligne | Classes | Issue |
|---------|-------|---------|-------|
| `src/components/ui/StatCard.tsx` | 87 | `text-slate-500 dark:text-slate-400` | Contraste insuffisant |
| `src/components/ui/DataTable.tsx` | 215 | `text-slate-500 dark:text-slate-400` | Contraste insuffisant |
| `src/components/ui/Badge.tsx` | 66 | Variant neutral | Vérifier contraste |
| `src/components/ui/EmptyState.tsx` | 17 | `text-slate-600` | Vérifier sur fond clair |

**Recommandation:** Utiliser `text-slate-700 dark:text-slate-300` pour assurer WCAG AA.

### 5.5 Focus States Manquants

| Fichier | Élément | Fix |
|---------|---------|-----|
| `src/components/ui/StatCard.tsx` | Carte cliquable | Ajouter `focus-visible:outline-2 focus-visible:outline-brand-500` |

---

## 6. STYLES INLINE AU LIEU DE TAILWIND (Moyenne)

### Fichiers Affectés

| Fichier | Ligne | Issue | Fix |
|---------|-------|-------|-----|
| `src/components/ui/ScoreGauge.tsx` | 87-91 | Objet style inline pour SVG | CSS modules ou variants Tailwind |
| `src/components/ai/ChatMessage.tsx` | 96 | `style={prismTheme}` | Extraire vers config Tailwind |
| `src/components/continuity/WarRoomModal.tsx` | 73 | `shadow-[0_0_100px_rgba(...)]` | Créer token shadow |
| `src/components/ui/OfflineBanner.tsx` | 25-27 | Styles Framer Motion inline | Définir dans keyframes Tailwind |

---

## 7. INCOHÉRENCES DE MODALES (Moyenne)

### Pattern Actuel (Inconsistant)

| Modal | Z-Index | Shadow | Boutons |
|-------|---------|--------|---------|
| WarRoomModal | `z-[200]` | Custom shadow | Inline styles |
| FeedbackModal | Standard | Standard | Inline error color |
| ContactModal | Standard | `shadow-lg shadow-blue-500/30` | Inline primary |
| ImportGuidelinesModal | Standard | Standard | Tailles icônes inconsistantes |

### Solution: Créer BaseModal

```tsx
// src/components/ui/BaseModal.tsx
export const modalStyles = {
  overlay: 'fixed inset-0 z-modal bg-black/60 backdrop-blur-sm',
  container: 'fixed inset-0 z-modal flex items-center justify-center p-4',
  panel: 'bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-h-[90vh] overflow-hidden',
  header: 'p-6 border-b border-slate-200 dark:border-slate-800',
  body: 'p-6 overflow-y-auto',
  footer: 'p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3',
};
```

---

## 8. PLAN D'ACTION PRIORITAIRE

### Sprint 1 - Critiques (1-2 semaines)
1. [ ] Créer `src/constants/colors.ts` avec tokens centralisés
2. [ ] Corriger accessibilité StatCard (clavier + focus)
3. [ ] Ajouter aria-labels aux boutons RichTextEditor
4. [ ] Remplacer couleurs hardcodées dans les dashboards

### Sprint 2 - Hautes (2-3 semaines)
1. [ ] Standardiser tous les boutons vers variants
2. [ ] Créer système de tailles d'icônes
3. [ ] Corriger contrastes de couleurs text-slate-*
4. [ ] Unifier z-index vers tokens

### Sprint 3 - Moyennes (2-3 semaines)
1. [ ] Créer BaseModal pour cohérence
2. [ ] Remplacer styles inline par Tailwind
3. [ ] Améliorer alt text des images
4. [ ] Documenter le design system

---

## 9. MÉTRIQUES DE SUCCÈS

| Métrique | Actuel | Cible |
|----------|--------|-------|
| Couleurs hardcodées | 61 fichiers | 0 |
| Boutons sans variant | 33 occurrences | 0 |
| Issues accessibilité critiques | 5 | 0 |
| Score Lighthouse Accessibility | ~85% | 95%+ |

---

## Annexe: Fichiers les Plus Affectés

1. `src/components/continuity/WarRoomModal.tsx` - 6 issues
2. `src/components/suppliers/SupplierDashboard.tsx` - 5 issues
3. `src/components/ui/StatCard.tsx` - 4 issues (dont accessibilité critique)
4. `src/components/audits/dashboard/AuditCharts.tsx` - 4 issues
5. `src/components/ui/DataTable.tsx` - 3 issues

