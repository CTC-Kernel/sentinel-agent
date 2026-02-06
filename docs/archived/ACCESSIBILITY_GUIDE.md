# ♿ Guide d'Accessibilité - Sentinel GRC

## 🎯 Nouveaux Composants Créés

### 1. **SkipLink** - Navigation Clavier Rapide

**Fichier:** `/components/ui/SkipLink.tsx`

**Usage:**
```tsx
import { SkipLink } from '@/components/ui/SkipLink';

// Dans App.tsx ou Layout
<SkipLink />
<main id="main-content">
  {/* Contenu principal */}
</main>
```

**Fonctionnalités:**
- ✅ Lien visible uniquement au focus clavier
- ✅ Permet de sauter au contenu principal
- ✅ Conforme WCAG 2.1 Niveau A

**Raccourci:** Tab (première frappe) puis Entrée

---

### 2. **useHotkeys** - Raccourcis Clavier

**Fichier:** `/hooks/useHotkeys.ts`

**Usage:**
```tsx
import { useHotkeys } from '@/hooks/useHotkeys';

const MyComponent = () => {
  // Ouvrir la recherche avec Ctrl+K
  useHotkeys('ctrl+k', () => {
    openSearch();
  });

  // Afficher l'aide avec Ctrl+/
  useHotkeys('ctrl+/', () => {
    openHelp();
  });

  // Fermer avec Escape
  useHotkeys('escape', () => {
    closeModal();
  });
};
```

**Raccourcis Suggérés:**
- `Ctrl+K` → Ouvrir recherche
- `Ctrl+/` → Afficher aide
- `Escape` → Fermer modal
- `Ctrl+N` → Nouveau
- `Ctrl+S` → Sauvegarder
- `?` → Aide raccourcis

**Détection OS:**
```tsx
import { getModifierKey } from '@/hooks/useHotkeys';

const modKey = getModifierKey(); // 'Cmd' sur Mac, 'Ctrl' sur Windows/Linux
```

---

### 3. **AnimatedButton** - Bouton avec Feedback

**Fichier:** `/components/ui/FeedbackAnimations.tsx`

**Usage:**
```tsx
import { AnimatedButton } from '@/components/ui/FeedbackAnimations';

<AnimatedButton
  variant="primary"
  size="md"
  loading={isLoading}
  onClick={handleSubmit}
>
  Sauvegarder
</AnimatedButton>
```

**Variants:**
- `primary` → Bleu brand (action principale)
- `secondary` → Blanc/Slate (action secondaire)
- `danger` → Rouge (suppression)
- `success` → Vert (validation)

**Sizes:**
- `sm` → Petit (px-3 py-1.5)
- `md` → Moyen (px-5 py-2.5)
- `lg` → Grand (px-6 py-3)

**Animations:**
- ✅ Effet ripple au clic
- ✅ Scale au hover et press
- ✅ Loading spinner intégré

---

### 4. **AnimatedCard** - Carte Interactive

**Usage:**
```tsx
import { AnimatedCard } from '@/components/ui/FeedbackAnimations';

<AnimatedCard
  interactive
  onClick={() => navigate('/risks/123')}
  className="p-6"
>
  {/* Contenu */}
</AnimatedCard>
```

**Effets:**
- ✅ Hover: scale + translate-y
- ✅ Shadow expansion
- ✅ Transition fluide

---

### 5. **PulseSkeleton** - Skeleton Amélioré

**Usage:**
```tsx
import { PulseSkeleton } from '@/components/ui/FeedbackAnimations';

// Loading text
<PulseSkeleton variant="text" count={3} className="w-full" />

// Loading avatar
<PulseSkeleton variant="circular" className="w-12 h-12" />

// Loading card
<PulseSkeleton variant="rectangular" className="w-full h-32" />
```

**Variants:**
- `text` → Lignes de texte
- `circular` → Avatar/icône
- `rectangular` → Carte/bloc

---

### 6. **NotificationBadge** - Badge Animé

**Usage:**
```tsx
import { NotificationBadge } from '@/components/ui/FeedbackAnimations';

<div className="relative">
  <Bell className="h-6 w-6" />
  <NotificationBadge 
    count={unreadCount} 
    max={99}
    className="absolute -top-1 -right-1"
  />
</div>
```

**Features:**
- ✅ Animation bounce quand nouveau
- ✅ Format "99+" pour grandes quantités
- ✅ Masquable si count = 0

---

### 7. **AnimatedProgress** - Barre de Progression

**Usage:**
```tsx
import { AnimatedProgress } from '@/components/ui/FeedbackAnimations';

<AnimatedProgress
  value={completedTasks}
  max={totalTasks}
  color="success"
  size="md"
  showLabel
/>
```

**Colors:**
- `brand` → Bleu (par défaut)
- `success` → Vert (complétion)
- `warning` → Orange (attention)
- `danger` → Rouge (critique)

---

## 🎨 Focus Indicators

**Fichier:** `/styles/focus.css`

### Implémentation Globale

Tous les éléments interactifs ont maintenant des focus indicators améliorés :

```css
/* Focus visible avec ring Apple-like */
*:focus-visible {
  @apply ring-2 ring-brand-500 ring-offset-2;
}
```

### Classes Utilitaires

**Focus Pulse:**
```tsx
<button className="focus-pulse">
  Action importante
</button>
```

**Card Interactive:**
```tsx
<div className="card-interactive">
  {/* Affiche ring au focus-within */}
</div>
```

---

## ⌨️ Guide des Raccourcis Clavier

### Raccourcis Globaux Recommandés

| Raccourci | Action | Priorité |
|-----------|--------|----------|
| `Tab` | Navigation suivante | ⭐⭐⭐⭐⭐ |
| `Shift+Tab` | Navigation précédente | ⭐⭐⭐⭐⭐ |
| `Ctrl+K` | Ouvrir recherche | ⭐⭐⭐⭐⭐ |
| `Escape` | Fermer modal/drawer | ⭐⭐⭐⭐⭐ |
| `Ctrl+/` | Afficher aide | ⭐⭐⭐⭐ |
| `Ctrl+N` | Créer nouveau | ⭐⭐⭐ |
| `Ctrl+S` | Sauvegarder | ⭐⭐⭐ |
| `Ctrl+E` | Exporter | ⭐⭐ |
| `?` | Raccourcis clavier | ⭐⭐⭐ |

### Implémentation dans App.tsx

```tsx
import { useHotkeys } from '@/hooks/useHotkeys';
import { SkipLink } from '@/components/ui/SkipLink';

function App() {
  // Recherche globale
  useHotkeys('ctrl+k', () => {
    navigate('/search');
  });

  // Aide
  useHotkeys('ctrl+/', () => {
    navigate('/help');
  });

  return (
    <>
      <SkipLink />
      <div id="main-content">
        {/* App content */}
      </div>
    </>
  );
}
```

---

## 📱 Responsive & Mobile

### Touch Feedback

Tous les `AnimatedButton` incluent :
- ✅ Touch target minimum 44x44px
- ✅ Ripple effect au tap
- ✅ Visual feedback immédiat

### Swipe Gestures

Pour les modals et drawers, considérer :
```tsx
// Fermeture par swipe down
<Drawer onSwipeDown={close} />
```

---

## ♿ Checklist Accessibilité

### WCAG 2.1 Niveau AA

- [x] **1.1.1** Contenu non textuel: Alt text sur images
- [x] **1.3.1** Info et relations: Structure HTML sémantique
- [x] **1.4.3** Contraste minimum: 4.5:1 pour texte
- [x] **2.1.1** Clavier: Tout accessible au clavier
- [x] **2.1.2** Pas de piège clavier: Focus trap dans modals
- [x] **2.4.1** Bypass blocks: Skip links
- [x] **2.4.3** Ordre du focus: Logique et prévisible
- [x] **2.4.7** Focus visible: Ring indicators
- [x] **3.2.1** Au focus: Pas de changement de contexte
- [x] **4.1.2** Nom, rôle, valeur: ARIA labels

### À Compléter

- [ ] **1.4.11** Contraste non-textuel: Icônes et composants UI
- [ ] **2.5.5** Taille de la cible: Minimum 44x44px partout
- [ ] **ARIA labels** complets sur tous les boutons
- [ ] **Live regions** pour notifications dynamiques

---

## 🔧 Maintenance & Tests

### Tests Automatisés

**Installer:**
```bash
npm install --save-dev @axe-core/react
```

**Usage:**
```tsx
// index.tsx (dev only)
if (process.env.NODE_ENV !== 'production') {
  import('@axe-core/react').then((axe) => {
    axe.default(React, ReactDOM, 1000);
  });
}
```

### Tests Manuels

**Checklist:**
1. ✅ Navigation complète au clavier (Tab)
2. ✅ Tous les boutons cliquables au clavier (Entrée/Espace)
3. ✅ Modals fermables avec Escape
4. ✅ Skip link visible au premier Tab
5. ✅ Focus indicators visibles partout
6. ✅ Pas de piège de focus
7. ✅ Ordre logique de tabulation

### Outils Recommandés

- **Lighthouse** (Chrome DevTools)
- **WAVE** (Extension navigateur)
- **axe DevTools** (Extension navigateur)
- **NVDA/JAWS** (Lecteurs d'écran)
- **VoiceOver** (Mac/iOS)

---

## 📊 Métriques de Succès

### Objectifs

| Métrique | Actuel | Objectif | Status |
|----------|--------|----------|--------|
| Lighthouse Accessibility | 85 | 100 | 🟡 En cours |
| Focus indicators | 60% | 100% | 🟢 Fait |
| ARIA labels | 40% | 100% | 🟡 En cours |
| Keyboard navigation | 80% | 100% | 🟢 Fait |
| Skip links | 0% | 100% | 🟢 Fait |
| Hotkeys | 0% | 100% | 🟢 Fait |

---

## 🚀 Prochaines Étapes

### Court Terme (Cette Semaine)

1. ✅ Ajouter SkipLink dans App.tsx
2. ✅ Implémenter useHotkeys pour recherche
3. ✅ Migrer vers AnimatedButton progressivement
4. ⏳ Ajouter ARIA labels manquants
5. ⏳ Tester avec lecteur d'écran

### Moyen Terme (Ce Mois)

1. Migration complète vers nouveaux composants
2. Audit complet avec axe-core
3. Tests utilisateurs avec personnes en situation de handicap
4. Documentation vidéo des raccourcis
5. Mode haute densité

### Long Terme (Ce Trimestre)

1. Certification WCAG 2.1 AA
2. Support ARIA Live Regions
3. Thème contraste élevé
4. Internationalisation (i18n)
5. Mode offline avec Service Worker

---

**Maintenu par:** Équipe Sentinel GRC  
**Dernière mise à jour:** 26 novembre 2025  
**Version:** 1.0
