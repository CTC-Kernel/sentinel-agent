---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - prd-voxel-module-2026-01-22.md
  - product-brief-voxel-module-2026-01-22.md
  - research/technical-voxel-3d-visualization-grc-research-2026-01-22.md
  - ux-design-specification.md
workflowType: 'ux-design'
lastStep: 1
context: 'voxel-3d-module'
---

# UX Design Specification - Module Voxel 3D

**Author:** Thibaultllopis
**Date:** 2026-01-22

---

## Executive Summary

### Project Vision

**Module Voxel** transforme la gestion des risques cyber d'un exercice bureaucratique en une **expérience de pilotage immersive**. C'est le premier **Digital Twin 3D** du Système d'Information dans le marché GRC.

**Promesse UX :** "En 30 secondes, voir ce qui prenait 3 jours à compiler."

**Positionnement :** Océan bleu — aucune plateforme GRC ne propose de visualisation 3D navigable. L'UX doit capitaliser sur cet avantage tout en restant accessible aux non-gamers.

### Target Users

#### Personas Primaires

| Persona | Rôle | Moment Clé | Besoin UX |
|---------|------|------------|-----------|
| **Sophie (RSSI)** | Pilotage stratégique | "Je vois mon SI en 30s" | Vue macro, zoom points critiques |
| **Lucas (SOC)** | Investigation incident | "Je trace le blast radius" | Sélection noeud, propagation |
| **Amélie (Risk)** | Analyse corrélations | "Je découvre les SPOF" | Clustering, patterns visuels |

#### Personas Secondaires

| Persona | Rôle | Moment Clé | Besoin UX |
|---------|------|------------|-----------|
| **Marc (Auditeur)** | Vérification conformité | "Je vérifie la couverture" | Overlay framework, gaps |
| **Catherine (DG)** | Décision rapide | "Enfin je comprends" | Mode Direction simplifié |

### Key Design Challenges

1. **Navigation 3D Intuitive**
   - OrbitControls (rotate, zoom, pan) pour utilisateurs non-gamers
   - Courbe d'apprentissage < 2 minutes sans formation
   - Fallback 2D pour cas edge (mobile, GPU faible)

2. **Zoom Sémantique**
   - Transition fluide entre vue macro (tout le SI) et micro (un asset)
   - Maintien du contexte pendant la navigation
   - Breadcrumb spatial pour orientation

3. **Multi-Mode Utilisateur**
   - 5 personas avec besoins UX différents
   - Interface adaptative selon rôle sans surcharge
   - Modes spécialisés : Investigation, Direction, Audit

4. **Accessibilité 3D (WCAG 2.1 AA)**
   - Palette daltonisme-safe avec formes distinctives
   - Navigation clavier complète (Tab, Arrows, Enter)
   - Support prefers-reduced-motion
   - Contraste 4.5:1 sur tous les labels

5. **Performance Perçue**
   - Loading states élégants pendant init 3D
   - Feedback immédiat sur interactions
   - Dégradation gracieuse si GPU faible

### Design Opportunities

1. **"Wow Effect" Différenciateur**
   - La 3D comme outil de conversion (+30% démos)
   - Premier regard = mémorisation instantanée
   - Storytelling visuel pour COMEX

2. **Mode Guidé Intelligent**
   - Navigation automatique vers points critiques
   - Onboarding progressif sans manuel
   - "Montrez-moi les risques" → tour guidé

3. **Révélation Visuelle**
   - Patterns invisibles en 2D deviennent évidents en 3D
   - Clustering automatique révèle les SPOF
   - "Je l'ai vu" vs "Je l'ai lu"

4. **UX Gaming pour Enterprise**
   - Inspirations : Stellaris (zoom), Cyberpunk (données)
   - Engagement radicalement supérieur aux outils GRC
   - Rétention par le plaisir d'usage

## Core User Experience

### Defining Experience

**Action Centrale :** Naviguer dans l'espace 3D pour révéler visuellement ce qui était invisible.

**Core Loop :**
1. **Observer** — Vue macro du SI entier
2. **Zoomer** — Focus sur un point d'intérêt
3. **Sélectionner** — Clic sur un noeud
4. **Comprendre** — Panneau détail contextuel
5. **Décider** — Action ou exploration suivante
6. **Répéter** — Retour à la vue adaptée

**Temps cible par cycle :** < 30 secondes pour un insight actionnable.

### Platform Strategy

| Plateforme | Support | Interaction |
|------------|---------|-------------|
| **Desktop Web** | Principal | Souris + Clavier (OrbitControls) |
| **Tablet** | Secondaire | Touch (pinch, drag, tap) |
| **Mobile** | Fallback | Vue 2D simplifiée |

**Contraintes techniques :**
- WebGL 2.0 requis (Chrome 90+, Firefox 88+, Safari 14+)
- GPU minimum : Intel HD 4000 / équivalent
- Fallback gracieux si WebGL indisponible

### Effortless Interactions

| Geste | Action | Feedback |
|-------|--------|----------|
| **Drag gauche** | Rotation orbitale | Vue tourne autour du centre |
| **Scroll** | Zoom in/out | Approche/éloigne smoothly |
| **Drag droit** | Pan (déplacement) | Vue glisse latéralement |
| **Click gauche** | Sélection noeud | Halo + panneau détail |
| **Hover** | Tooltip preview | Info essentielle en 200ms |
| **Double-click** | Focus + zoom auto | Centre et zoome sur noeud |
| **Escape** | Reset vue | Retour position initiale |

**Principe de profondeur :** Le niveau de détail suit le niveau de zoom.

| Niveau Zoom | Informations Visibles |
|-------------|----------------------|
| **Macro (tout le SI)** | Clusters, couleurs agrégées, score global |
| **Moyen (département)** | Noeuds individuels, connexions, badges statut |
| **Micro (asset)** | Labels complets, métriques, historique |

### Critical Success Moments

1. **Premier Chargement ("Wow")**
   - Canvas 3D s'anime avec données réelles
   - Utilisateur voit son SI prendre forme
   - Cible : < 3s de chargement, émotion immédiate

2. **Révélation de Pattern**
   - Zoom révèle corrélation invisible en 2D
   - "Je vois le problème" sans analyse manuelle
   - Cible : < 30s de la question à l'insight

3. **Traçage Blast Radius**
   - Click sur noeud compromis
   - Propagation s'illumine en cascade
   - Cible : Comprendre l'impact en < 15s

4. **Présentation COMEX**
   - Navigation en temps réel sur écran partagé
   - Storytelling visuel vs slides statiques
   - Cible : DG comprend en 2 minutes

5. **Détection Anomalie**
   - Risque critique pulse automatiquement
   - Attention guidée sans recherche
   - Cible : 0 anomalie manquée

### Experience Principles

1. **"Le zoom révèle"**
   > Plus on zoome, plus on voit de détails — jamais de surcharge initiale. La profondeur d'information est progressive.

2. **"Le mouvement a du sens"**
   > Chaque geste a une signification : rotation = explorer les angles, zoom = approfondir, pan = changer de contexte.

3. **"Le danger pulse"**
   > Les risques critiques ne doivent jamais être manqués. Animation subtile mais immanquable pour attirer l'attention.

4. **"Un clic suffit"**
   > De la sélection à l'action en maximum 3 clics. Pas de menu profond, pas de navigation complexe.

5. **"Le mode s'adapte"**
   > L'interface reconnaît le besoin : exploration libre pour RSSI, vue épurée pour Direction, focus investigation pour SOC.

## Desired Emotional Response

### Primary Emotional Goals

| Rang | Émotion | Description | Indicateur de Succès |
|------|---------|-------------|---------------------|
| 1 | **Émerveillement** | "Wow, je n'ai jamais vu ça" | Temps de premier engagement > 30s |
| 2 | **Clarté** | "Je comprends enfin mon SI" | NPS question "clarté" > 8/10 |
| 3 | **Maîtrise** | "Je contrôle la complexité" | Navigation sans aide < 2 min |
| 4 | **Confiance** | "Ces données sont fiables" | Décisions prises depuis Voxel |
| 5 | **Fierté** | "Regardez ce que je peux montrer" | Partages/présentations COMEX |

### Emotional Journey Mapping

**Phase 1 - Découverte (0-30s)**
- Émotion : Émerveillement → Curiosité
- Trigger : Canvas 3D s'anime avec les vraies données
- Design : Animation d'entrée cinématique, pas de tutoriel bloquant

**Phase 2 - Exploration (30s-5min)**
- Émotion : Curiosité → Découverte
- Trigger : Chaque zoom révèle un nouveau niveau de détail
- Design : Progressive disclosure, tooltips contextuels

**Phase 3 - Révélation (variable)**
- Émotion : "Aha!" → Satisfaction
- Trigger : Pattern invisible devient évident visuellement
- Design : Clustering automatique, alertes visuelles subtiles

**Phase 4 - Maîtrise (5min+)**
- Émotion : Compétence → Efficacité
- Trigger : Navigation devient intuitive
- Design : Shortcuts clavier, modes personnalisés

**Phase 5 - Advocacy (externe)**
- Émotion : Fierté → Validation
- Trigger : Présentation externe réussie
- Design : Mode présentation, export élégant

### Micro-Emotions

**Émotions à Cultiver :**

| Moment | Émotion | Trigger Design |
|--------|---------|----------------|
| Hover sur noeud | Anticipation | Tooltip apparaît en 200ms |
| Click sur noeud | Satisfaction | Halo + panneau en < 100ms |
| Zoom in | Découverte | Nouveaux détails émergent |
| Reset vue | Sécurité | Retour instantané, tout est safe |
| Filtre appliqué | Contrôle | Noeuds se réorganisent smoothly |

**Émotions à Prévenir :**

| Émotion Négative | Cause | Solution Design |
|------------------|-------|-----------------|
| Désorientation | Perdu en 3D | Minimap permanente, bouton Home |
| Frustration | Latence | Feedback < 100ms, optimistic UI |
| Surcharge cognitive | Trop d'infos | Zoom = niveau de détail |
| Anxiété | Données manquantes | Indicateurs de complétude |
| Ennui | Interface statique | Animations subtiles, données live |

### Design Implications

**Pour l'Émerveillement :**
- Lighting 3D cinématique (ambient + directional)
- Animation d'entrée avec ease-out
- Données réelles dès le premier load (pas de démo)
- Qualité visuelle "AAA game" pas "enterprise software"

**Pour la Clarté :**
- Palette de couleurs sémantique stricte (rouge = danger, vert = ok)
- Labels apparaissent progressivement avec le zoom
- Fond neutre, noeuds sont les stars
- Pas de chrome UI inutile dans le canvas

**Pour la Maîtrise :**
- Contrôles standard gaming (WASD optionnel, scroll zoom)
- Undo/Redo sur navigation (Cmd+Z = vue précédente)
- Shortcuts affichés au hover des boutons
- Feedback haptique si disponible

**Pour la Confiance :**
- Badge "LIVE" visible si données temps réel
- Timestamps sur les données critiques
- Source de données traçable (clic → origine)
- Pas d'interpolation ou estimation non-marquée

**Pour la Fierté :**
- Mode présentation (UI cachée, focus canvas)
- Export PNG haute résolution
- Watermark professionnel (logo + date)
- Transitions smooth pour démos live

### Emotional Design Principles

1. **"Le premier regard compte"**
   > Les 3 premières secondes déterminent l'émotion dominante. Investir massivement dans l'animation d'entrée et la qualité visuelle initiale.

2. **"Zéro frustration, toujours"**
   > Chaque clic a une réponse en < 100ms. Chaque action est réversible. Chaque erreur est récupérable gracieusement.

3. **"La complexité est optionnelle"**
   > Le niveau de détail suit l'intention de l'utilisateur (zoom). Ne jamais forcer la complexité sur qui veut la simplicité.

4. **"Célébrer les découvertes"**
   > Quand l'utilisateur trouve quelque chose d'important, le design le reconnaît subtilement (highlight, animation légère).

5. **"Digne d'être montré"**
   > Chaque écran doit être assez beau pour être partagé. Mode présentation = fierté de l'utilisateur.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

#### Stellaris (Paradox Interactive)
**Pertinence :** Zoom sémantique de référence dans le gaming

| Ce qui fonctionne | Application Voxel |
|-------------------|-------------------|
| Transition galaxie → système → planète | SI global → département → asset |
| Click pour centrer, scroll pour zoom | Navigation principale |
| Plus de détails au fur et à mesure du zoom | Progressive disclosure |
| Ambiance immersive mais informative | Enterprise + premium |

#### Google Earth / Maps 3D
**Pertinence :** Navigation 3D grand public

| Ce qui fonctionne | Application Voxel |
|-------------------|-------------------|
| LOD automatique selon distance | InstancedMesh + Level of Detail |
| Orientation permanente (boussole) | Minimap, indicateurs position |
| Streaming progressif des données | Skeleton → données réelles |
| Contrôles intuitifs sans formation | OrbitControls standard |

#### Neo4j Bloom
**Pertinence :** Visualisation de graphes professionnelle

| Ce qui fonctionne | Application Voxel |
|-------------------|-------------------|
| Force-directed layout automatique | Layout sans configuration |
| Expansion des voisins au clic | Exploration des connexions |
| Filtrage par type de noeud | Filtres Assets/Risques/Contrôles |
| Recherche avec auto-focus | Cmd+K → noeud |

#### Datadog / Grafana
**Pertinence :** Monitoring et alerting enterprise

| Ce qui fonctionne | Application Voxel |
|-------------------|-------------------|
| Alertes visuelles immédiates | Pulsation risques critiques |
| Dashboards temps réel | Données live Firestore |
| Drill-down contextuel | Click noeud → détails |
| Thresholds visuels | Couleurs sémantiques |

#### Apple Health
**Pertinence :** Score et tendances simplifiés

| Ce qui fonctionne | Application Voxel |
|-------------------|-------------------|
| Score circulaire central | Score santé SI global |
| Tendances visuelles | Évolution posture dans le temps |
| Simplicité pour non-experts | Mode Direction |

### Transferable UX Patterns

#### Navigation Patterns

| Pattern | Description | Priorité |
|---------|-------------|----------|
| **Zoom sémantique** | Niveau de détail suit le niveau de zoom | P0 |
| **Double-click focus** | Centre et zoome sur l'élément cliqué | P0 |
| **Minimap** | Vue globale pour orientation (coin inférieur) | P1 |
| **Reset Home** | Retour vue initiale en un clic | P0 |
| **Breadcrumb spatial** | Chemin de navigation visuel | P1 |

#### Interaction Patterns

| Pattern | Description | Priorité |
|---------|-------------|----------|
| **Hover preview** | Tooltip avec info essentielle en 200ms | P0 |
| **Click select** | Sélection avec halo visuel | P0 |
| **Cmd+K search** | Recherche globale avec auto-focus | P1 |
| **Multi-select** | Shift+click pour groupes | P2 |
| **Right-click context** | Menu contextuel actions | P1 |

#### Visual Patterns

| Pattern | Description | Priorité |
|---------|-------------|----------|
| **Pulsation alerte** | Animation subtile sur risques critiques | P0 |
| **Score circulaire** | Gauge type Apple Health | P1 |
| **Halo sélection** | Feedback visuel immédiat | P0 |
| **Edge bundling** | Grouper connexions denses | P2 |
| **Couleurs sémantiques** | Rouge=danger, vert=ok, etc. | P0 |

### Anti-Patterns to Avoid

| Anti-Pattern | Problème | Alternative Voxel |
|--------------|----------|-------------------|
| **Menus profonds (>3 niveaux)** | Friction, abandon | Max 2 clics pour toute action |
| **Dashboards surchargés** | Surcharge cognitive | Progressive disclosure via zoom |
| **Tutoriels bloquants** | Time to value retardé | Learn by doing, hints contextuels |
| **Tooltips paragraphes** | Personne ne lit | 1 ligne, 5 mots max |
| **Animations >500ms** | Perception de lenteur | Max 300ms, easing rapide |
| **Configuration préalable** | Friction onboarding | Defaults intelligents, zéro config |
| **3D décorative** | Perception "gadget" | 3D = valeur (révèle patterns) |
| **Jargon technique** | Exclusion non-experts | Langage utilisateur |

### Design Inspiration Strategy

**Adopter directement :**
- OrbitControls Three.js (convention établie)
- Zoom sémantique (Stellaris-style)
- Cmd+K search (standard power users)
- Halo sélection (feedback universel)
- Couleurs sémantiques (rouge/orange/jaune/vert)

**Adapter au contexte :**
- Minimap simplifiée (2D dans coin, pas 3D)
- Force-directed optimisé GRC (clusters par domaine)
- Score circulaire multi-frameworks
- Pulsation subtile enterprise (pas gaming flashy)

**Innover (différenciation) :**
- Mode Investigation (propagation visuelle d'impact)
- Mode Direction (épuré pour executives)
- Overlay Framework (toggle ISO/NIS2/DORA)
- Zoom = information (pas juste visuel)

## Design System Foundation

### Design System Choice

**Décision :** Extension du Design System Sentinel existant avec tokens 3D spécifiques.

**Approche :** Héritage + Spécialisation
- Hérite : Typography, colors, spacing, shadows, components UI
- Ajoute : Node styling, lighting, materials, animations 3D

### Rationale for Selection

| Critère | Justification |
|---------|---------------|
| **Cohérence** | Voxel = module de Sentinel, pas app séparée |
| **Familiarité** | Utilisateurs connaissent déjà l'UI Sentinel |
| **Maintenance** | Un seul système à maintenir |
| **Performance** | Pas de CSS/fonts additionnels |
| **Brand** | Identité visuelle unifiée |

### Implementation Approach

**Structure des fichiers :**

```
src/
├── styles/
│   ├── design-system/          # Sentinel global (existant)
│   │   ├── tokens.css
│   │   ├── typography.css
│   │   └── components.css
│   └── voxel/                   # Extension Voxel (nouveau)
│       ├── tokens-3d.css        # Tokens spécifiques 3D
│       ├── nodes.css            # Styles overlay UI
│       └── animations.css       # Keyframes 3D
├── components/voxel/
│   ├── styles/
│   │   └── VoxelTheme.ts       # Theme Three.js
```

**Tokens 3D (tokens-3d.css) :**

```css
:root {
  /* Node Colors */
  --voxel-node-asset: #3B82F6;
  --voxel-node-risk-critical: #EF4444;
  --voxel-node-risk-high: #F97316;
  --voxel-node-risk-medium: #EAB308;
  --voxel-node-risk-low: #22C55E;
  --voxel-node-control: #8B5CF6;

  /* Selection */
  --voxel-selection-color: var(--primary-500);
  --voxel-selection-glow: 0 0 20px var(--primary-500);

  /* Animation */
  --voxel-pulse-duration: 2s;
  --voxel-transition-fast: 150ms;
  --voxel-transition-normal: 300ms;

  /* Lighting */
  --voxel-ambient-intensity: 0.4;
  --voxel-directional-intensity: 0.8;

  /* Background */
  --voxel-bg-color: #0F172A;
  --voxel-grid-color: #1E293B;
}
```

**Theme Three.js (VoxelTheme.ts) :**

```typescript
export const VoxelTheme = {
  nodes: {
    asset: { color: '#3B82F6', geometry: 'sphere' },
    risk: {
      critical: { color: '#EF4444', geometry: 'icosahedron' },
      high: { color: '#F97316', geometry: 'icosahedron' },
      medium: { color: '#EAB308', geometry: 'icosahedron' },
      low: { color: '#22C55E', geometry: 'icosahedron' }
    },
    control: { color: '#8B5CF6', geometry: 'box' }
  },
  lighting: {
    ambient: { intensity: 0.4, color: '#ffffff' },
    directional: { intensity: 0.8, position: [10, 10, 5] }
  },
  materials: {
    default: { metalness: 0.1, roughness: 0.8 },
    selected: { emissive: '#2563EB', emissiveIntensity: 0.3 }
  },
  animation: {
    pulseDuration: 2000,
    transitionEase: 'easeOut'
  }
};
```

### Customization Strategy

**Niveau 1 - Tokens (CSS Variables)**
- Modifiables sans rebuild
- Thèmes clair/sombre via CSS
- Override par tenant possible

**Niveau 2 - Theme Three.js**
- Configuration centralisée
- Import dans tous les composants 3D
- Type-safe avec TypeScript

**Niveau 3 - Composants**
- Props pour customisation runtime
- Feature flags pour variants
- Slots pour extension

**Accessibilité intégrée :**

| Mode | Adaptation |
|------|------------|
| **Daltonisme** | Formes + couleurs (jamais couleur seule) |
| **Haut contraste** | Tokens alternatifs `--voxel-*-contrast` |
| **Reduced motion** | `prefers-reduced-motion` → no pulse |

## Defining User Experience

### The Defining Experience

**En une phrase :** "Vois ton SI en 3D et révèle ce qui était invisible."

**Test de l'ascenseur :**
> "Voxel transforme tes données GRC en une visualisation 3D navigable. Tu zoomes, tu explores, et tu découvres des patterns et des risques que les tableaux ne montrent jamais."

**Moments définissants :**
1. Le SI prend forme en 3D devant tes yeux
2. Tu zoomes et tu comprends instantanément plus
3. Tu découvres un problème caché visuellement
4. Tu montres Voxel et on te dit "Wow"

### User Mental Model

**Modèle mental existant :**
- GRC = tableaux, listes, scores
- Interdépendances = difficiles à voir
- Risques = perdus dans la masse
- Présentations = slides statiques

**Nouveau modèle mental Voxel :**
- GRC = espace navigable
- Interdépendances = liens visibles
- Risques = pulsent et attirent l'oeil
- Présentations = exploration live

**Métaphore centrale :**
Piloter un avion au-dessus de son SI — altitude haute (macro) → approche (détails) → atterrissage (asset spécifique).

### Success Criteria

| Dimension | Métrique | Cible |
|-----------|----------|-------|
| **Time to Wow** | Premier "Aha!" | < 30s |
| **Learnability** | Navigation autonome | < 2 min |
| **Discovery** | Pattern révélé par session | ≥ 1 |
| **Stickiness** | Envie de revenir | > 80% |
| **Virality** | Partagé à un collègue | > 50% |

**Signaux de succès utilisateur :**
- Reste plus de 2 min sans quitter
- Zoome au moins 3 fois
- Clique sur un noeud pour voir les détails
- Dit "ah oui je vois" ou équivalent
- Partage l'écran ou fait une capture

### Novel UX Patterns

**Pattern clé : Zoom Sémantique**

| Niveau | Ce qui est visible | Interaction |
|--------|-------------------|-------------|
| Macro (100%) | Clusters, score global | Survol du SI |
| Moyen (50%) | Noeuds individuels, labels | Exploration |
| Micro (10%) | Détails complets, métriques | Investigation |

**Enseignement progressif :**
- First-time : hint "Scroll pour explorer"
- Premier zoom : animation plus prononcée
- Premier clic : panneau s'ouvre avec guide
- Ensuite : comportement normal, hints off

**Pattern d'innovation : Propagation Visuelle**

1. Utilisateur clique sur un noeud
2. Les connexions s'illuminent progressivement
3. Le "blast radius" devient visible
4. Compréhension immédiate de l'impact

### Experience Mechanics

**Phase 1 - Initiation**

```
[Utilisateur ouvre Voxel]
     │
     ▼
[Canvas s'initialise - skeleton]
     │ < 2s
     ▼
[Données streamées - noeuds apparaissent]
     │
     ▼
[Animation stabilisation - SI prend forme]
     │
     ▼
[Hint first-time: "Scroll pour explorer"]
```

**Phase 2 - Exploration**

```
[Scroll down]           [Drag left]           [Click node]
     │                       │                      │
     ▼                       ▼                      ▼
[Zoom in]               [Rotation]            [Selection]
     │                       │                      │
     ▼                       ▼                      ▼
[Details emerge]        [New angle]           [Halo + Panel]
     │                       │                      │
     ▼                       ▼                      ▼
[Labels appear]         [Context shift]       [Details shown]
```

**Phase 3 - Révélation**

```
[Pattern spotted]
     │
     ▼
[Zoom sur cluster]
     │
     ▼
[Connexions visibles]
     │
     ▼
[Click noeud central]
     │
     ▼
[Propagation illuminée]
     │
     ▼
["Aha! Je vois le problème"]
```

**Phase 4 - Action**

```
[Insight obtenu]
     │
     ├─→ [Screenshot] → [Partage/rapport]
     │
     ├─→ [Click "Voir détails"] → [Page entité]
     │
     └─→ [Reset] → [Nouvelle exploration]
```

## Visual Design Foundation

### Color System

**Canvas Environment :**

| Element | Light Mode | Dark Mode (Default) |
|---------|------------|---------------------|
| Background | #F8FAFC | #0F172A |
| Grid | #E2E8F0 @ 20% | #334155 @ 20% |
| Ambient | #FFFFFF | #FFFFFF |

**Node Palette :**

| Entity | Color | Hex | Shape |
|--------|-------|-----|-------|
| Asset | Blue | #3B82F6 | Sphere |
| Risk Critical | Red | #EF4444 | Icosahedron |
| Risk High | Orange | #F97316 | Icosahedron |
| Risk Medium | Yellow | #EAB308 | Icosahedron |
| Risk Low | Green | #22C55E | Icosahedron |
| Control | Purple | #8B5CF6 | Box |
| Framework | Cyan | #06B6D4 | Octahedron |

**Interaction States :**

| State | Visual Effect |
|-------|---------------|
| Default | Base color, metalness 0.1 |
| Hover | Emissive +0.1, cursor pointer |
| Selected | Halo ring, emissive +0.3 |
| Disabled | Opacity 0.3 |
| Pulse (critical) | Scale oscillation 1.0-1.1 |

### Typography System

**In-Canvas Labels :**

| Level | Font | Size | Weight | Opacity |
|-------|------|------|--------|---------|
| Cluster | Inter | 16px | Bold | 80% |
| Node (zoomed) | Inter | 14px | Medium | 100% |
| Node (default) | Inter | 12px | Regular | 90% |
| Badge | Inter | 10px | Bold | 100% |

**Overlay UI :**

| Element | Size | Weight |
|---------|------|--------|
| Panel Title | 18px | Semibold |
| Panel Body | 14px | Regular |
| Tooltip | 12px | Regular |
| Button | 14px | Medium |

### Spacing & Layout Foundation

**Canvas Structure :**

```
┌─────────────────────────────────────────┐
│ Toolbar (48px)              Filters     │
├─────────────────────────────────────────┤
│                                         │
│           3D Canvas (flex-1)            │
│                                         │
│ ┌────────┐                  ┌─────────┐ │
│ │Minimap │                  │ Detail  │ │
│ │ 160px  │                  │  320px  │ │
│ └────────┘                  └─────────┘ │
└─────────────────────────────────────────┘
```

**Z-Index Layers :**

| Layer | Z-Index | Content |
|-------|---------|---------|
| Canvas | 0 | 3D scene |
| Overlays | 10 | Minimap, toolbars |
| Panels | 20 | Detail panel |
| Tooltips | 30 | Hover tooltips |
| Modals | 40 | Dialogs |

**3D Spacing :**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Node min distance | 50 units | Prevent overlap |
| Cluster padding | 100 units | Visual grouping |
| Camera default distance | 500 units | Initial view |
| Camera min distance | 50 units | Max zoom |
| Camera max distance | 2000 units | Min zoom |

### Accessibility Considerations

**Color Accessibility :**
- All node types have distinct shapes in addition to colors
- Contrast ratios meet WCAG AA (4.5:1) minimum
- Critical information never conveyed by color alone

**Motion Accessibility :**
- All animations respect `prefers-reduced-motion`
- Pulse effects can be disabled globally
- Transitions max 300ms for comfort

**Keyboard Navigation :**
- Tab cycles through focusable nodes
- Arrow keys for spatial navigation
- Enter to select, Escape to deselect
- Home to reset view

**Screen Reader Support :**
- ARIA labels on all interactive elements
- Live regions for dynamic updates
- Semantic HTML for overlay UI
