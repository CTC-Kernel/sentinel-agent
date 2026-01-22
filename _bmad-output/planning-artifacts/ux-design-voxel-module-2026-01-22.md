---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
workflow_completed: true
inputDocuments:
  - prd-voxel-module-2026-01-22.md
  - product-brief-voxel-module-2026-01-22.md
  - research/technical-voxel-3d-visualization-grc-research-2026-01-22.md
  - ux-design-specification.md
workflowType: 'ux-design'
lastStep: 14
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

## Design Direction Decision

### Design Directions Explored

**4 directions visuelles évaluées :**

1. **Mission Control** - Dense, opérationnel, style monitoring
2. **Digital Galaxy** - Immersif, spacieux, style jeu AAA
3. **Clean Analytics** - Sobre, professionnel, style SaaS moderne
4. **Cyberpunk HQ** - Dramatique, futuriste, style sci-fi

### Chosen Direction

**Direction retenue : "Digital Galaxy"**

| Caractéristique | Spécification |
|-----------------|---------------|
| **Ambiance** | Immersif, contemplatif, premium |
| **Background** | Deep space gradient (#0F172A → #1E293B) |
| **UI Density** | Basse - focus sur le canvas 3D |
| **Node Style** | Sphères lumineuses, halos subtils |
| **Edge Style** | Courbes fluides, particules optionnelles |
| **Panel Style** | Glass morphism, slide-in depuis la droite |
| **Toolbar** | Minimal, transparent, sticky top |

### Design Rationale

1. **Maximise le "Wow Effect"**
   - Premier regard mémorable
   - Conversion +30% sur démos (objectif PRD)
   - Différenciation totale vs concurrents GRC

2. **Cohérence Sentinel**
   - Palette compatible avec le Design System existant
   - Ambiance premium alignée avec le positionnement
   - Glass morphism déjà utilisé dans Sentinel

3. **Support multi-personas**
   - RSSI : exploration libre, immersion
   - Direction : présentation impactante
   - Auditeur : clarté malgré l'ambiance (contraste)

4. **Performance optimale**
   - UI légère = GPU dédié au rendu 3D
   - Moins de composants overlay = meilleur FPS
   - Progressive disclosure = pas de surcharge

### Implementation Approach

**Phase 1 - MVP Core :**
- Background simple (couleur unie #0F172A)
- Nodes sphériques basiques avec couleurs sémantiques
- Edges lignes simples
- Toolbar minimal (reset, filters, help)
- Panel détail glass morphism

**Phase 2 - MVP+ :**
- Background gradient subtil
- Node halos et emissive
- Edge particles (optionnel, feature flag)
- Minimap glass
- Animations entrée/sortie panels

**Phase 3 - V2 :**
- Effets post-processing (bloom léger)
- Particles ambient optionnelles
- Transitions cinématiques entre vues

**Digital Galaxy Theme Reference :**

```typescript
export const DigitalGalaxyTheme = {
  canvas: {
    background: '#0F172A',
    backgroundGradient: 'radial-gradient(ellipse at center, #1E293B 0%, #0F172A 100%)',
    gridColor: '#334155',
    gridOpacity: 0.15
  },
  nodes: {
    baseEmissive: 0.05,
    hoverEmissive: 0.15,
    selectedEmissive: 0.3,
    haloOpacity: 0.2
  },
  ui: {
    panelBackground: 'rgba(15, 23, 42, 0.8)',
    panelBackdropBlur: '12px',
    panelBorder: 'rgba(255, 255, 255, 0.1)',
    toolbarBackground: 'rgba(15, 23, 42, 0.6)'
  },
  animation: {
    panelSlideIn: '300ms ease-out',
    nodeHover: '150ms ease-out',
    cameraTransition: '500ms ease-in-out'
  }
};
```

## User Journey Flows

### Journey 1: Vue Macro RSSI (Sophie)

**Objectif :** Comprendre l'état du SI en 30 secondes

**Flow :**
1. Ouvre Voxel → Canvas charge (< 2s)
2. Vue macro : SI complet visible
3. Identifie zones rouges (risques critiques)
4. Double-click → Zoom automatique sur zone
5. Click noeud → Panel détail
6. Option : Mode Présentation pour COMEX

**Points clés UX :**
- Pas de configuration requise
- First-time hint discret
- Zones critiques attirent l'attention (pulse)

### Journey 2: Investigation Incident (Lucas)

**Objectif :** Tracer le blast radius en 15 secondes

**Flow :**
1. Cmd+K → Recherche serveur compromis
2. Enter → Focus automatique sur noeud
3. Mode Investigation → Connexions s'illuminent
4. Propagation animée → Impact visible
5. Click assets connectés → Évaluer criticité
6. Screenshot → Documenter pour escalade

**Points clés UX :**
- Recherche globale toujours accessible
- Animation propagation intuitive
- Panel avec actions contextuelles

### Journey 3: Découverte SPOF (Amélie)

**Objectif :** Identifier les Single Points of Failure

**Flow :**
1. Ouvre Voxel → Vue macro
2. Filter : Risques only
3. Observer clusters denses
4. Zoom sur cluster suspect
5. Identifier asset central avec beaucoup de connexions
6. Click → Voir dépendances
7. Confirmer SPOF → Créer risque agrégé

**Points clés UX :**
- Filtres combinables
- Clustering révèle patterns
- Création risque depuis Voxel

### Journey 4: Audit Conformité (Marc)

**Objectif :** Vérifier couverture contrôles visuellement

**Flow :**
1. Ouvre Voxel → Toolbar
2. Overlay : ISO 27001
3. Assets colorés par couverture
4. Gaps en rouge pulsant
5. Click gap → Contrôles manquants listés
6. Screenshot findings
7. Export rapport visuel

**Points clés UX :**
- Overlays par framework
- Couverture = couleur
- Export one-click

### Journey 5: Brief Direction (Catherine)

**Objectif :** Comprendre posture cyber en 2 minutes

**Flow :**
1. Mode Direction activé
2. Vue épurée : Score global dominant
3. 3 zones critiques pulsent
4. RSSI zoome et explique chaque zone (30s each)
5. Questions → Zoom on-demand
6. Compréhension → Décision

**Points clés UX :**
- Mode Direction = simplicité max
- Score prominent
- Navigation guidée par RSSI

### Journey Patterns

**Navigation Universelle :**
- Cmd+K : Recherche globale
- Double-click : Focus + zoom
- Escape : Reset vue
- Tab : Cycle noeuds (a11y)

**Feedback Universel :**
- Hover : Tooltip (200ms)
- Click : Halo + Panel (instant)
- Critical : Pulse animation (2s loop)
- Loading : Skeleton → data

**Panel Behavior :**
- Slide-in depuis droite (300ms)
- Glass morphism background
- Close : click outside / Escape
- Deep link : vers modules Sentinel

### Flow Optimization Principles

1. **< 3 clicks to value**
   - Tout insight accessible rapidement
   - Pas de wizard obligatoire
   - Defaults intelligents

2. **Progressive disclosure**
   - Macro → détails via zoom
   - Info essentielle d'abord
   - Détails on-demand

3. **Recovery toujours possible**
   - Escape = reset
   - Undo sur navigation
   - Jamais de dead-end

4. **Context preserved**
   - Panel ne cache pas le canvas
   - Breadcrumb spatial
   - Minimap pour orientation

## Component Strategy

### Design System Components

**Inherited from Sentinel DS :**

| Component | Voxel Usage |
|-----------|-------------|
| Button | Toolbar, Panel actions |
| Input/Search | Search overlay, filters |
| Card | Panel content sections |
| Modal | Confirmations |
| Toast | Notifications |
| Badge | Node status indicators |
| Tooltip | Non-3D tooltips |

**Inherited from @react-three/drei :**

| Component | Voxel Usage |
|-----------|-------------|
| OrbitControls | Camera navigation |
| Html | In-canvas labels |
| Billboard | Labels facing camera |
| Line | Basic edges |
| Geometries | Node shapes |

### Custom Components

#### 3D Components

| Component | Purpose | Priority |
|-----------|---------|----------|
| **VoxelCanvas** | Main R3F container with config | P0 |
| **VoxelScene** | Scene, lighting, grid, camera | P0 |
| **NodeMesh** | Entity visualization (Asset/Risk/Control) | P0 |
| **EdgeLine** | Connection lines between nodes | P0 |
| **PulseEffect** | Critical risk animation | P1 |
| **ClusterGroup** | Node grouping for scaling | P2 |

#### UI Components

| Component | Purpose | Priority |
|-----------|---------|----------|
| **VoxelToolbar** | Global actions and filters | P0 |
| **DetailPanel** | Node information panel | P0 |
| **SearchOverlay** | Cmd+K global search | P1 |
| **Minimap** | Navigation orientation | P1 |
| **FrameworkOverlay** | Compliance view toggle | P2 |

### Component Implementation Strategy

**Principles :**

1. **Composition over inheritance**
   - Small, focused components
   - Combine for complex behavior

2. **Design tokens first**
   - All colors from VoxelTheme
   - All spacing from tokens
   - No magic numbers

3. **State management**
   - Zustand for 3D state
   - React state for UI
   - Props for component config

4. **Performance by default**
   - useMemo for geometries
   - useCallback for handlers
   - Lazy loading for heavy components

### Implementation Roadmap

**MVP Core (Phase 1) :**
- VoxelCanvas + VoxelScene
- NodeMesh (basic states)
- EdgeLine (static)
- VoxelToolbar (minimal)
- DetailPanel

**MVP+ (Phase 2) :**
- SearchOverlay
- Minimap
- PulseEffect
- NodeMesh (all states)
- EdgeLine (animated)

**V2 (Phase 3) :**
- ClusterGroup
- FrameworkOverlay
- ExportCapture
- ModeDirectionView

## UX Consistency Patterns

### 3D Navigation Patterns

#### OrbitControls Standard

| Geste | Action | Feedback | Accessibilité |
|-------|--------|----------|---------------|
| **Drag gauche** | Rotation orbitale | Cursor: grab → grabbing | Touches fléchées alternatives |
| **Scroll** | Zoom in/out (0.1x - 2x) | Zoom smooth 300ms | +/- clavier alternatives |
| **Drag droit** | Pan (déplacement) | Cursor: move | Shift + flèches |
| **Double-click** | Focus + zoom auto | Animation 500ms vers noeud | Enter sur noeud focusé |

**Contraintes :**
- Zoom minimum : 50 unités (max détail)
- Zoom maximum : 2000 unités (vue macro)
- Inertie : 0.1 (ralentissement naturel)
- Damping : enabled (mouvement fluide)

#### Zoom Sémantique

| Niveau Zoom | Distance Caméra | Visible | Labels |
|-------------|-----------------|---------|--------|
| **Macro** | > 1000u | Clusters, scores | Aucun |
| **Moyen** | 200-1000u | Noeuds individuels | Noms courts |
| **Micro** | < 200u | Détails complets | Labels complets + badges |

**Transition :** Les labels apparaissent/disparaissent avec fade 200ms selon le niveau de zoom.

#### Reset & Recovery

| Action | Trigger | Comportement |
|--------|---------|--------------|
| **Reset View** | Bouton Home / Escape | Retour position initiale en 500ms |
| **Undo Navigation** | Cmd+Z | Vue précédente (historique 10 états) |
| **Focus perdu** | Auto-detect | Minimap pulse + bouton Home visible |

### Button Hierarchy

#### Actions Primaires

| Type | Style | Usage Voxel |
|------|-------|-------------|
| **Primary** | Blue (#2563EB), filled | Actions principales : "Voir détails", "Créer risque" |
| **Danger** | Red (#EF4444), filled | Suppressions avec confirmation |
| **Ghost** | Transparent, border | Actions secondaires : "Reset", "Filters" |

#### Toolbar Actions

```
┌────────────────────────────────────────────────────────┐
│ [🏠 Home] [🔍 Search] [🎛️ Filters ▾] | [Mode ▾] [?] │
└────────────────────────────────────────────────────────┘
```

| Position | Priorité | Exemple |
|----------|----------|---------|
| **Gauche** | Navigation | Home, Search |
| **Centre** | Filtres actifs | Badges de filtres |
| **Droite** | Modes & Aide | Direction Mode, Help |

**Icônes obligatoires :** Tous les boutons toolbar ont icône + tooltip (hover 200ms).

### Feedback Patterns

#### 3D Feedback

| Événement | Feedback Visuel | Timing |
|-----------|-----------------|--------|
| **Hover noeud** | Emissive +0.1, scale 1.05 | 150ms |
| **Sélection noeud** | Halo ring + emissive +0.3 | Instant |
| **Désélection** | Fade halo | 200ms |
| **Pulse critique** | Scale oscillation 1.0 → 1.1 | 2s loop |
| **Propagation** | Edges illumination cascade | 100ms/hop |

#### Overlay Feedback

| Type | Visual | Animation | Durée |
|------|--------|-----------|-------|
| **Success** | Toast vert (#10B981) | Slide-in top | 3s auto-dismiss |
| **Error** | Toast rouge (#EF4444) | Slide-in top | Manual dismiss |
| **Warning** | Toast orange (#F59E0B) | Slide-in top | 5s auto-dismiss |
| **Info** | Toast bleu (#3B82F6) | Slide-in top | 3s auto-dismiss |

#### Loading States

| Phase | Visual | Durée Max |
|-------|--------|-----------|
| **Canvas init** | Skeleton + spinner central | 2s |
| **Données streaming** | Noeuds apparaissent progressivement | 3s |
| **Stabilisation** | Force-layout animation | 1s |
| **Action en cours** | Spinner inline + disabled state | Variable |

### Panel Patterns

#### Detail Panel (Slide-in Droite)

```
┌──────────────────┐
│ [X]    Title     │ ← Header 48px
├──────────────────┤
│                  │
│    Content       │ ← Scrollable
│                  │
├──────────────────┤
│ [Action Buttons] │ ← Footer sticky 56px
└──────────────────┘
```

| Property | Value |
|----------|-------|
| **Width** | 320px (desktop), 100% (mobile) |
| **Background** | rgba(15, 23, 42, 0.8) + backdrop-blur 12px |
| **Border** | 1px solid rgba(255, 255, 255, 0.1) |
| **Animation** | Slide-in 300ms ease-out |
| **Close triggers** | X button, Escape, click outside canvas |

#### Tooltip Pattern

| Property | Value |
|----------|-------|
| **Delay apparition** | 200ms hover |
| **Position** | Au-dessus du noeud (Billboard) |
| **Max width** | 200px |
| **Content** | 1 ligne, 5 mots max |
| **Style** | Dark bg, white text, rounded-md |

### Form Patterns

#### Search (Cmd+K)

```
┌──────────────────────────────────────────┐
│ 🔍  Search assets, risks, controls...    │
├──────────────────────────────────────────┤
│ Recent:                                  │
│ • Serveur-Prod-01                        │
│ • Risque-Ransomware                      │
├──────────────────────────────────────────┤
│ Results:                                 │
│ [Asset] Serveur-Prod-01                  │
│ [Risk]  Risque associé...                │
└──────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Trigger** | Cmd+K / Ctrl+K / bouton toolbar |
| **Position** | Modal centré, overlay sombre |
| **Debounce** | 150ms |
| **Results limit** | 10 items groupés par type |
| **Enter** | Focus caméra sur premier résultat |
| **Escape** | Ferme sans action |

#### Filter Controls

| Type | Component | Behavior |
|------|-----------|----------|
| **Entity Type** | Checkbox group | Multi-select, OR logic |
| **Risk Level** | Checkbox group | Multi-select, show matching |
| **Framework** | Radio group | Single select overlay |
| **Search** | Text input | Live filter debounced |

**Active Filter Display :**
```
[Assets ×] [Risques Critiques ×] [ISO 27001 ×]
```

Badges cliquables pour supprimer le filtre individuel.

### Modal & Confirmation Patterns

#### Confirmation Dialog

| Scénario | Title | Actions |
|----------|-------|---------|
| **Suppression** | "Supprimer [nom] ?" | [Annuler] [Supprimer] (danger) |
| **Navigation externe** | "Quitter Voxel ?" | [Rester] [Voir détails] |
| **Reset** | "Réinitialiser la vue ?" | [Annuler] [Reset] |

**Style :**
- Glass morphism background
- Max-width: 400px
- Focus trap obligatoire
- Escape = annuler

### Empty States

| Contexte | Message | Action |
|----------|---------|--------|
| **Aucune donnée** | "Votre SI attend d'être visualisé" | [Importer des assets] |
| **Aucun résultat filtre** | "Aucun élément ne correspond" | [Réinitialiser filtres] |
| **Recherche vide** | "Aucun résultat pour '[query]'" | Suggestions alternatives |
| **GPU non supporté** | "WebGL non disponible" | [Voir en mode tableau] |

**Visual :** Icône illustrative + message + CTA centré.

### Mode Patterns

#### Mode Toggle

| Mode | Audience | Modifications UI |
|------|----------|------------------|
| **Explore** (défaut) | RSSI, Analyste | Full toolbar, filtres, minimap |
| **Investigation** | SOC | Propagation enabled, timeline visible |
| **Direction** | DG, COMEX | Score prominent, UI minimale, labels simples |
| **Présentation** | Tous | UI cachée, fullscreen, controls subtils |

**Switch :** Dropdown toolbar, raccourci D (Direction), I (Investigation), P (Présentation).

### Accessibility Patterns

#### Keyboard Navigation

| Touche | Action |
|--------|--------|
| **Tab** | Cycle entre noeuds focusables |
| **Shift+Tab** | Cycle inverse |
| **Enter** | Sélectionne noeud focusé |
| **Escape** | Désélectionne / ferme panel / reset |
| **Flèches** | Navigation spatiale dans le graphe |
| **Home** | Reset vue |
| **Cmd+K** | Ouvre recherche |

#### Focus Indicators

| Element | Focus Style |
|---------|-------------|
| **Noeud 3D** | Outline ring 2px bleu |
| **Bouton UI** | Ring-2 ring-offset-2 ring-primary |
| **Panel items** | Background highlight |

#### Screen Reader

| Element | ARIA |
|---------|------|
| **Canvas** | role="application", aria-label="Visualisation 3D du SI" |
| **Noeud** | role="button", aria-label="[type]: [nom]" |
| **Panel** | role="dialog", aria-labelledby="panel-title" |
| **Toast** | role="alert", aria-live="polite" |

### Animation Patterns

#### Timing Standards

| Animation | Duration | Easing |
|-----------|----------|--------|
| **Hover effects** | 150ms | ease-out |
| **Panel slide** | 300ms | ease-out |
| **Camera transition** | 500ms | ease-in-out |
| **Pulse loop** | 2000ms | ease-in-out |
| **Fade in/out** | 200ms | ease |

#### Reduced Motion

Quand `prefers-reduced-motion: reduce` :
- Pulse → opacity flash (pas de scale)
- Transitions → instantanées ou 100ms max
- Propagation → statique, pas d'animation
- Camera → position immédiate

## Responsive Design & Accessibility

### Responsive Strategy

#### Platform Hierarchy

| Plateforme | Priorité | Expérience |
|------------|----------|------------|
| **Desktop (1024px+)** | Primaire | 3D complet, toutes fonctionnalités |
| **Tablet (768-1023px)** | Secondaire | 3D touch-optimisé, UI simplifiée |
| **Mobile (<768px)** | Fallback | Vue 2D alternative, essentiel seulement |

#### Desktop Strategy (1024px+)

**Layout :**
```
┌─────────────────────────────────────────────────────────┐
│ Toolbar (48px)                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                  3D Canvas (100%)                       │
│                                                         │
│ ┌──────────┐                              ┌───────────┐ │
│ │ Minimap  │                              │  Detail   │ │
│ │  160px   │                              │   Panel   │ │
│ └──────────┘                              │   320px   │ │
│                                           └───────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Caractéristiques :**
- Canvas 3D plein écran (minus toolbar)
- Minimap en overlay coin inférieur gauche
- Panel détail slide-in depuis la droite (320px)
- Tous les raccourcis clavier actifs
- OrbitControls souris complet

**Breakpoint Large (1440px+) :**
- Panel détail peut être épinglé (split view)
- Toolbar peut afficher plus d'options inline
- Minimap légèrement plus grande (200px)

#### Tablet Strategy (768-1023px)

**Layout :**
```
┌─────────────────────────────────────┐
│ Toolbar compact (40px)              │
├─────────────────────────────────────┤
│                                     │
│          3D Canvas (100%)           │
│                                     │
│ ┌────────┐                          │
│ │Minimap │                          │
│ │ 120px  │                          │
│ └────────┘                          │
├─────────────────────────────────────┤
│ Detail Panel (slide-up, 50% height) │
└─────────────────────────────────────┘
```

**Adaptations Touch :**
- **Pinch** : Zoom in/out
- **Two-finger drag** : Rotation orbitale
- **Single tap** : Sélection noeud
- **Double tap** : Focus + zoom
- **Long press** : Menu contextuel

**UI Changes :**
- Toolbar icônes seules (labels cachés)
- Panel détail slide-up depuis le bas (pas droite)
- Minimap plus petite (120px)
- Touch targets minimum 44px
- Pas de hover states (tap only)

#### Mobile Strategy (<768px)

**Décision critique :** WebGL 3D n'est pas optimal sur mobile (GPU, batterie, ergonomie). On propose une **Vue 2D Alternative**.

**Layout Mobile :**
```
┌─────────────────────────────────┐
│ Header (Score + Actions)  56px  │
├─────────────────────────────────┤
│                                 │
│      Liste Cards / Tree         │
│      (Scrollable)               │
│                                 │
├─────────────────────────────────┤
│ Bottom Nav (Home|Search|Filter) │
└─────────────────────────────────┘
```

**Fallback 2D Features :**
- Liste d'entités avec cards
- Hiérarchie en arbre dépliable
- Filtres en bottom sheet
- Recherche en plein écran
- Score global prominent

**Détection & Switch :**
```typescript
const shouldUse3D = () => {
  return window.innerWidth >= 768
    && hasWebGL()
    && !prefersReducedMotion();
};
```

**Message de transition :**
> "Pour une expérience 3D complète, utilisez un ordinateur ou une tablette."

### Breakpoint Strategy

#### Breakpoints Définis

| Nom | Min Width | Max Width | Target |
|-----|-----------|-----------|--------|
| **mobile** | 0px | 767px | Smartphones |
| **tablet** | 768px | 1023px | Tablets portrait |
| **desktop** | 1024px | 1439px | Laptops, tablets landscape |
| **large** | 1440px | ∞ | Desktops, écrans externes |

#### Breakpoint Behavior Matrix

| Feature | Mobile | Tablet | Desktop | Large |
|---------|--------|--------|---------|-------|
| **3D Canvas** | ❌ 2D | ✅ | ✅ | ✅ |
| **Minimap** | ❌ | ✅ 120px | ✅ 160px | ✅ 200px |
| **Detail Panel** | Full screen | Bottom 50% | Right 320px | Right pinnable |
| **Toolbar** | Bottom nav | Icons only | Icons + select labels | Full |
| **Filters** | Bottom sheet | Dropdown | Dropdown | Side panel option |
| **Keyboard shortcuts** | ❌ | Limited | ✅ | ✅ |

#### CSS Implementation

```css
/* Mobile first approach */
.voxel-container {
  display: flex;
  flex-direction: column;
}

/* Tablet */
@media (min-width: 768px) {
  .voxel-container {
    position: relative;
  }
  .voxel-canvas {
    width: 100%;
    height: 100%;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .voxel-detail-panel {
    position: absolute;
    right: 0;
    width: 320px;
    height: 100%;
  }
}

/* Large */
@media (min-width: 1440px) {
  .voxel-detail-panel.pinned {
    position: relative;
    flex-shrink: 0;
  }
}
```

### Accessibility Strategy

#### WCAG Compliance Level

**Cible : WCAG 2.1 Level AA**

Justification :
- Standard industrie pour SaaS B2B
- Conformité légale européenne (directive accessibilité)
- Équilibre entre inclusivité et faisabilité technique pour 3D

#### Défis Spécifiques 3D

| Défi | Impact | Solution |
|------|--------|----------|
| **Navigation souris** | Inaccessible clavier | Tab navigation + flèches |
| **Hover states** | Invisible screen readers | ARIA live regions |
| **Information visuelle** | Daltonisme | Formes + couleurs |
| **Animation** | Troubles vestibulaires | prefers-reduced-motion |
| **Canvas WebGL** | Non sémantique | ARIA labels overlay |

#### Color Accessibility

**Contrast Ratios :**
| Element | Ratio | Status |
|---------|-------|--------|
| Text on dark bg | 7:1+ | ✅ AAA |
| UI labels | 4.5:1+ | ✅ AA |
| Node labels (3D) | 4.5:1+ | ✅ AA |
| Focus indicators | 3:1+ | ✅ AA |

**Daltonisme-Safe Palette :**
| Type | Color | Shape | Pattern |
|------|-------|-------|---------|
| Asset | Blue #3B82F6 | Sphere | Solid |
| Risk Critical | Red #EF4444 | Icosahedron | Pulse |
| Risk High | Orange #F97316 | Icosahedron | - |
| Risk Medium | Yellow #EAB308 | Icosahedron | - |
| Risk Low | Green #22C55E | Icosahedron | - |
| Control | Purple #8B5CF6 | Box | - |

**Principe :** Jamais de couleur seule pour l'information critique.

#### Keyboard Navigation

**Navigation Complète :**
```
Tab / Shift+Tab → Cycle entre éléments focusables
↑ ↓ ← → → Navigation spatiale dans le graphe
Enter → Sélectionner noeud focusé
Escape → Désélectionner / Fermer / Reset
Home → Retour vue initiale
Cmd+K → Ouvrir recherche
? → Afficher aide raccourcis
```

**Focus Management :**
- Focus visible sur tous les éléments interactifs
- Focus trap dans modals et panels
- Skip link : "Aller au canvas" / "Aller au contenu"
- Retour focus après fermeture modale

#### Screen Reader Support

**ARIA Implementation :**

```html
<!-- Canvas container -->
<div role="application"
     aria-label="Visualisation 3D du Système d'Information"
     aria-describedby="voxel-instructions">

  <!-- Instructions cachées visuellement -->
  <div id="voxel-instructions" class="sr-only">
    Utilisez Tab pour naviguer entre les éléments,
    Entrée pour sélectionner, Échap pour fermer.
  </div>

  <!-- Live region pour annonces -->
  <div aria-live="polite" aria-atomic="true" class="sr-only">
    <!-- Dynamically updated -->
  </div>
</div>

<!-- Node announcement example -->
<button role="button"
        aria-label="Asset: Serveur-Prod-01, 3 risques associés"
        aria-pressed="false">
</button>
```

**Annonces Live :**
| Event | Announcement |
|-------|--------------|
| Node selected | "[Type]: [Nom] sélectionné, [N] connexions" |
| Panel opened | "Panneau détails ouvert pour [Nom]" |
| Filter applied | "[N] éléments affichés" |
| Zoom level | "Niveau zoom: [Macro/Moyen/Micro]" |

#### Motion Accessibility

**prefers-reduced-motion Support :**

```css
@media (prefers-reduced-motion: reduce) {
  .voxel-node {
    animation: none !important;
    transition: opacity 0.1s !important;
  }

  .voxel-pulse {
    animation: none;
    /* Alternative: static glow */
    box-shadow: 0 0 20px var(--voxel-node-risk-critical);
  }

  .voxel-panel {
    transition: none !important;
  }
}
```

**Animations désactivées :**
- Pulse scale → Static glow
- Camera transitions → Immediate position
- Edge propagation → Static highlight
- Panel slides → Immediate show/hide

### Testing Strategy

#### Responsive Testing

**Device Matrix :**
| Device | OS | Browser | Priority |
|--------|-------|---------|----------|
| iPhone 14/15 | iOS 17+ | Safari | P0 |
| iPad Pro | iPadOS 17+ | Safari | P0 |
| Samsung Galaxy | Android 13+ | Chrome | P1 |
| MacBook Pro | macOS | Chrome, Safari | P0 |
| Windows Laptop | Windows 11 | Chrome, Edge | P0 |
| Linux Desktop | Ubuntu | Firefox | P2 |

**Test Scenarios :**
- [ ] 3D renders correctly on desktop
- [ ] Touch controls work on tablet
- [ ] 2D fallback activates on mobile
- [ ] Panel adapts to screen size
- [ ] Minimap scales appropriately
- [ ] Toolbar collapses correctly

#### Accessibility Testing

**Automated Tools :**
| Tool | Purpose | Run Frequency |
|------|---------|---------------|
| axe-core | WCAG violations | CI/CD |
| Lighthouse | Accessibility score | Weekly |
| WAVE | Visual issues | Manual |
| Pa11y | Regression | CI/CD |

**Manual Testing Protocol :**
| Test | Tool/Method | Frequency |
|------|-------------|-----------|
| Keyboard navigation | Manual | Each feature |
| Screen reader | VoiceOver (Mac), NVDA (Win) | Monthly |
| Color contrast | Colour Contrast Analyzer | Design review |
| Color blindness | Sim Daltonism | Design review |
| Reduced motion | OS setting toggle | Each animation |

**Screen Reader Test Script :**
1. Navigate to Voxel module
2. Verify canvas is announced
3. Tab to first node, verify announcement
4. Select node with Enter
5. Verify panel announcement
6. Navigate panel with Tab
7. Close panel with Escape
8. Verify focus returns to canvas

#### Performance Testing

**3D-Specific Metrics :**
| Metric | Target | Method |
|--------|--------|--------|
| Initial render | < 2s | Performance API |
| 60 FPS sustained | > 55 FPS | requestAnimationFrame |
| Memory usage | < 500MB | Chrome DevTools |
| GPU usage | < 70% | Chrome task manager |

**Device Performance Tiers :**
| Tier | GPU | Node Limit | Effects |
|------|-----|------------|---------|
| High | Dedicated | 10,000+ | All |
| Medium | Integrated modern | 5,000 | No post-processing |
| Low | Integrated old | 1,000 | Simplified geometry |
| Fallback | No WebGL | N/A | 2D view |

### Implementation Guidelines

#### Responsive Development

**Principles :**
1. **Mobile-first CSS** - Styles de base pour mobile, media queries pour plus grand
2. **Relative units** - rem pour typography, % pour layouts, vw/vh pour full-screen
3. **Flexible images** - max-width: 100%, srcset pour retina
4. **Touch-friendly** - min 44px touch targets, 8px spacing minimum

**React Implementation :**

```typescript
// useResponsive hook
export const useResponsive = () => {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop' | 'large'>('desktop');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 768) setBreakpoint('mobile');
      else if (width < 1024) setBreakpoint('tablet');
      else if (width < 1440) setBreakpoint('desktop');
      else setBreakpoint('large');
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTouch: breakpoint === 'mobile' || breakpoint === 'tablet',
    supports3D: breakpoint !== 'mobile' && hasWebGL()
  };
};
```

#### Accessibility Development

**Semantic Structure :**
```html
<main>
  <header role="banner">
    <!-- Toolbar -->
  </header>

  <section role="application" aria-label="Voxel 3D">
    <!-- Canvas -->
  </section>

  <aside role="complementary" aria-label="Détails">
    <!-- Detail Panel -->
  </aside>
</main>
```

**ARIA Checklist :**
- [ ] All interactive elements have accessible names
- [ ] Live regions for dynamic content
- [ ] Focus management in modals
- [ ] Skip links for main content
- [ ] Landmark roles defined
- [ ] Error messages linked to inputs

**Focus Management :**
```typescript
// useFocusManagement hook
export const useFocusManagement = () => {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const trapFocus = useCallback((container: HTMLElement) => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    const focusables = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length) (focusables[0] as HTMLElement).focus();
  }, []);

  const releaseFocus = useCallback(() => {
    previousFocusRef.current?.focus();
  }, []);

  return { trapFocus, releaseFocus };
};
```

**Reduced Motion Check :**
```typescript
export const usePrefersReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
};
