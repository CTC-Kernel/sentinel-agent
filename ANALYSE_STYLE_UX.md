# 🎨 Analyse Approfondie Style & UX - Sentinel GRC v2

**Date**: 16 Décembre 2025
**Objectif**: Identifier les incohérences visuelles et les opportunités d'amélioration pour atteindre un standard "Premium / Apple-like".

---

## 1. 🖌️ Harmonisation Visuelle (Visual Consistency)

### A. Rayons de Bordure (Border Radius)
**Observation**: Une incohérence dans l'utilisation des rayons de bordure a été détectée entre les composants majeurs.
- `StatCard`: Utilise `rounded-[2rem]` (32px).
- `DataTable`: Utilise `rounded-[1.5rem]` (24px).
- `FloatingLabelInput`: Utilise `rounded-xl` (12px ou 16px).
- `CustomSelect`: Utilise `rounded-xl`.

**Recommandation**: Définir une échelle de rayons sémantique stricte pour maintenir la cohérence "Premium".
- **Panneaux / Cartes**: Standardiser sur `rounded-3xl` (24px) ou `rounded-[2rem]` (32px) pour les grands conteneurs pour un look "organique".
- **Inputs / Boutons**: Standardiser sur `rounded-xl` (12px) ou `rounded-2xl` (16px) pour les éléments interactifs.

### B. Couleurs & Variables
**Observation**: Présence de nombreuses valeurs de couleurs hardcodées (ex: `bg-white/50`, `border-slate-200/60`) au lieu de variables sémantiques.
- Rend difficile la maintenance du dark mode et des thèmes.
- Crée de légères variations de teinte non intentionnelles.

**Recommandation**:
- Utiliser exclusivement les variables CSS définies (`--glass-bg`, `--glass-border`, `--glass-shadow`).
- Créer des classes utilitaires Tailwind étendues si nécessaire (ex: `bg-glass`, `border-glass`).

### C. Ombres (Shadows)
**Observation**: Mélange entre des ombres Tailwind standard (`shadow-xl`) et des ombres personnalisées (`shadow-apple`, `shadow-glass`).

**Recommandation**:
- Généraliser l'utilisation de `shadow-apple` et `shadow-glass` pour tous les éléments flottants pour une profondeur cohérente.

---

## 2. 🧩 Harmonisation des Composants

### A. Formulaires (Inputs & Selects)
**Observation**: `FloatingLabelInput` et `CustomSelect` sont visuellement proches mais présentent des différences d'implémentation (ex: gestion du focus ring, transitions de label).

**Recommandation**:
- Refactoriser pour unifier le comportement du label flottant (taille de police, position, animation).
- S'assurer que les hauteurs (`min-h-[50px]`) sont identiques pour un alignement parfait en grille.

### B. Tableaux de Données (Data Tables)
**Observation**:
- Les en-têtes utilisent `uppercase tracking-widest`, ce qui est excellent pour la lisibilité.
- Les états vides ("Aucune donnée") sont basiques (texte simple).

**Recommandation**:
- Intégrer des illustrations SVG ou des icônes plus grandes pour les états vides ("Empty States") afin de rendre l'interface plus accueillante.
- Appliquer l'effet "Glass" au conteneur du tableau de manière cohérente avec les cartes.

### C. Cartes (Cards)
**Observation**: `StatCard` définit sa propre transparence.

**Recommandation**:
- Utiliser la classe globale `.glass-panel` pour garantir que le flou (`backdrop-blur`) et la transparence sont identiques partout.

---

## 3. ✨ Expérience Utilisateur (UX) & Micro-interactions

### A. États de Chargement
**Observation**: Bonne utilisation des Skeletons.

**Recommandation**:
- Ajouter des transitions fluides (`animate-pulse` ou `shimmer`) sur tous les éléments de chargement.
- Éviter les sauts de mise en page (layout shifts) lors du chargement des données.

### B. Feedback Visuel
**Observation**: Les survols (hover) sont présents mais parfois subtils.

**Recommandation**:
- Renforcer les effets de survol sur les cartes interactives (léger `scale` + augmentation de l'ombre).
- Standardiser les anneaux de focus (`ring-brand-500`) pour l'accessibilité navigation clavier.

---

## 📋 Plan d'Action Immédiat

1.  **Refactor Global CSS**: Mettre à jour `index.css` pour solidifier les classes utilitaires `.glass-panel` et les variables de rayons.
2.  **Standardisation Composants**: Mettre à jour `StatCard.tsx`, `DataTable.tsx`, `FloatingLabelInput.tsx` pour utiliser les nouvelles variables.
3.  **Nettoyage**: Remplacer les couleurs hardcodées par des références sémantiques. 
