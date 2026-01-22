---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - product-brief-voxel-module-2026-01-22.md
  - research/technical-voxel-3d-visualization-grc-research-2026-01-22.md
  - prd.md
workflowType: 'prd'
lastStep: 2
briefCount: 1
researchCount: 1
projectDocsCount: 1
project_type: 'saas_b2b'
domain: 'grc_visualization_3d'
complexity: 'high'
---

# Product Requirements Document - Module Voxel

**Author:** Thibaultllopis
**Date:** 2026-01-22

## Executive Summary

> **"Voxel révèle l'invisible. Là où les outils traditionnels montrent des listes et des tableaux, Voxel fait émerger les patterns, les corrélations cachées et les risques latents dans un espace 3D navigable — transformant chaque RSSI en pilote de sa sécurité."**

Le **Module Voxel** transforme la gestion des risques cyber d'un exercice bureaucratique en une **expérience de pilotage immersive**. Face à des outils GRC jugés obsolètes, non-prédictifs et incapables de révéler les risques cachés, Voxel propose une rupture : un **Digital Twin 3D du Système d'Information**.

### Le Problème

| Statu Quo | Impact Business |
|-----------|-----------------|
| Outils GRC = dashboards 2D statiques | Impossibilité de voir les interdépendances |
| Analyse manuelle des corrélations | 3 semaines pour identifier un chemin d'attaque |
| Pas de vue macro ET micro simultanée | Décisions prises sans contexte complet |
| Interfaces datées et non-engageantes | Adoption faible, données incomplètes |
| Approche réactive vs prédictive | Toujours un temps de retard sur les menaces |

### Ce qui Rend Voxel Unique

| Différenciateur | Impact |
|-----------------|--------|
| **Visualisation 3D unique** | Océan bleu — aucune plateforme GRC ne propose cette approche |
| **UX style jeu vidéo** | Engagement utilisateur radicalement supérieur |
| **Zoom sémantique** | Transition fluide macro ↔ micro sans perte de contexte |
| **Double mode navigation** | Exploration libre + Navigation guidée selon le besoin |
| **Digital Twin du SI** | Représentation spatiale vivante de l'écosystème complet |

## Project Classification

**Type Technique :** SaaS B2B — Module WebGL/3D
**Domaine :** GRC / Cybersécurité — Visualisation de données
**Complexité :** Élevée (3D temps réel, graphes 10K+ noeuds, performance critique)
**Contexte Projet :** Brownfield — Transformation radicale du module Voxel existant dans Sentinel GRC

**Stack Technique Cible :**
- React Three Fiber (R3F) + Three.js
- @react-three/drei pour helpers
- Zustand pour state management 3D
- InstancedMesh + LOD pour performance
- Web Workers pour calculs layout

## Success Criteria

### User Success

**North Star Metric :**
> **"Temps moyen pour identifier une corrélation cachée critique"**
> - Baseline : 3+ jours (si détectée)
> - Target : < 5 minutes

**Moments de Succès Utilisateur :**

| Persona | Moment "Aha!" | Métrique |
|---------|---------------|----------|
| **RSSI** | "En 30s je vois ce qui prenait 3 jours à compiler" | Temps insight → décision < 10 min |
| **Analyste SOC** | "Je trace le chemin d'attaque instantanément en 3D" | Temps traçage incident -70% |
| **Risk Manager** | "Je modélise l'impact sur tout l'écosystème" | Couverture cartographie 100% |
| **Auditeur** | "Je vérifie la couverture des contrôles visuellement" | Temps vérification < 1h/framework |
| **Direction** | "Enfin je comprends notre posture cyber en 2 min" | Compréhension "immédiate" |

**Métriques Utilisateur Quantifiées :**

| Métrique | Baseline (Sans Voxel) | Target (Avec Voxel) |
|----------|----------------------|---------------------|
| Temps identification anomalie | 3 jours | < 5 minutes |
| Temps préparation audit visuel | 1 semaine | < 2 heures |
| Temps création rapport COMEX | 4 heures | < 30 minutes |
| Visibilité interdépendances | 15% estimé | 100% cartographié |

### Business Success

**Métriques d'Adoption :**

| Métrique | Target M3 | Target M6 | Target M12 |
|----------|-----------|-----------|------------|
| Utilisateurs actifs Voxel / tenant | 40% | 60% | 80% |
| Sessions Voxel / semaine / user | 2 | 4 | 5+ |
| Temps moyen par session | 5 min | 10 min | 15 min |
| NPS Module Voxel | 30 | 45 | 60+ |

**Impact Business :**

| Métrique | Impact Attendu |
|----------|----------------|
| Taux conversion démo → trial | +30% (effet "Wow" 3D) |
| Taux conversion trial → paid | +15% |
| Réduction churn | -20% (facteur stickiness) |
| Justification pricing premium | +20% ARPU |
| Demandes entrantes "j'ai vu Voxel" | 15% des leads |

### Technical Success

**KPIs Performance :**

| KPI | Minimum Acceptable | Target Optimal |
|-----|-------------------|----------------|
| FPS (frames per second) | 30 fps | 60 fps |
| Temps chargement initial | < 5s | < 2s |
| Noeuds supportés (fluide) | 10,000 | 50,000+ |
| Temps réponse interaction | < 200ms | < 100ms |
| Disponibilité | 99.5% | 99.9% |
| Score Lighthouse Performance | 70 | 90+ |

### Measurable Outcomes

**Critères Go/No-Go MVP Core → MVP+ :**

| Critère | Seuil Go | Mesure |
|---------|----------|--------|
| Performance | 30+ FPS avec données réelles | Benchmark auto |
| Feedback utilisateur | "Utile" > 70% | Survey beta |
| Bugs critiques | 0 bloquant | Bug tracker |
| Adoption beta | > 50% users actifs | Analytics |

## Product Scope

### MVP Core - Minimum Viable Product

**Objectif :** Démontrer la valeur de la visualisation 3D avec les données existantes.

| Feature | Description | Priorité |
|---------|-------------|----------|
| Canvas R3F | Intégration React Three Fiber | P0 |
| Noeuds Assets | Visualisation 3D (taille = criticité) | P0 |
| Noeuds Risques | Visualisation (couleur = gravité) | P0 |
| Noeuds Contrôles | Visualisation contrôles liés | P0 |
| Arcs Connexions | Liens visuels entre entités | P0 |
| Navigation Orbit | Rotation, zoom, pan | P0 |
| Filtres Basiques | Par type, par framework | P0 |
| Tooltip Hover | Info au survol | P0 |
| Click → Détail | Panneau détail au clic | P0 |

**Critères de succès MVP Core :**
- [ ] Rendu fluide (30+ FPS) avec 1,000 noeuds
- [ ] Données temps réel Firestore affichées
- [ ] Navigation intuitive sans formation
- [ ] "Wow effect" lors de la première démo

### Growth Features (MVP+)

| Feature | Description | Priorité |
|---------|-------------|----------|
| Zoom Sémantique | Transition macro ↔ micro | P1 |
| Alertes Visuelles | Pulsation, glow risques critiques | P1 |
| Mode Guidé | Navigation auto vers points critiques | P1 |
| Clustering Auto | Regroupement par domaine | P1 |
| Minimap | Vue globale pour orientation | P1 |
| Overlay Framework | Vue par NIS2, DORA, ISO... | P1 |
| Performance 10K+ | InstancedMesh, LOD, culling | P1 |

### Vision (V2+)

| Feature | Horizon |
|---------|---------|
| Détection Anomalies IA | V2 (Q3 2026) |
| Simulation What-If | V2 (Q3 2026) |
| Mode Présentation | V2 (Q4 2026) |
| Export PNG/PDF | V2 (Q4 2026) |
| VR/AR immersif | V3 (2027) |
| Multi-user temps réel | V3 (2027) |
| API Voxel publique | V3 (2027) |

## User Journeys

### Journey 1: Sophie Marchand — De l'Aveuglement à la Clairvoyance

Sophie est RSSI d'une ETI de 2,500 employés soumise à NIS2 et DORA. Chaque matin, elle ouvre 5 outils différents pour tenter de comprendre sa posture cyber : un tableur Excel de risques, un dashboard conformité, un CMDB obsolète, des rapports PDF d'audit. Elle passe 2 heures à compiler mentalement ces informations fragmentées. Quand le COMEX lui demande "où en sommes-nous ?", elle improvise une réponse qu'elle sait incomplète.

Un lundi matin, Sophie découvre le nouveau module Voxel dans Sentinel GRC. En 30 secondes, elle voit son SI prendre forme en 3D devant ses yeux : les assets critiques apparaissent plus gros, les risques non-couverts pulsent en rouge, les connexions entre systèmes dessinent un réseau vivant. Elle zoome sur un cluster qui l'intrigue — un groupe de 15 assets interconnectés avec un seul contrôle défaillant. En 3 clics, elle comprend qu'une faille sur ce point unique pourrait propager un incident à travers tout le département Finance.

Le moment de vérité arrive lors du prochain COMEX. Au lieu de slides PowerPoint statiques, Sophie projette Voxel sur l'écran. Elle navigue en temps réel dans le SI, montre visuellement les zones de risque, zoome sur les points critiques. Le DG, habituellement distrait pendant ses présentations, est captivé. "Enfin je comprends notre exposition", dit-il. Le budget sécurité qu'elle demandait depuis 18 mois est approuvé dans la semaine.

**Capacités révélées :** Vue macro du SI, zoom sémantique, identification visuelle des risques, mode présentation, filtres par criticité.

---

### Journey 2: Lucas Petit — L'Investigation Qui Change Tout

Lucas est analyste SOC depuis 3 ans. Quand une alerte de compromission potentielle arrive à 14h32 un vendredi, il sait qu'il a des heures de travail devant lui. Habituellement, il doit croiser manuellement les logs SIEM, consulter le CMDB pour identifier les systèmes impactés, tracer les connexions réseau dans des schémas Visio périmés. La dernière fois, il a mis 6 heures à comprendre le périmètre d'impact d'un ransomware.

Aujourd'hui, Lucas ouvre Voxel et sélectionne le serveur compromis. Instantanément, le graphe 3D se recentre sur cet asset. Les connexions s'illuminent : 12 systèmes directement liés, dont 3 bases de données critiques. Il active le "mode propagation" et voit le chemin d'attaque potentiel se dessiner en rouge — le malware pourrait atteindre le système de paie en seulement 3 sauts.

En 15 minutes au lieu de 6 heures, Lucas a cartographié le blast radius, identifié les systèmes à isoler en priorité, et généré un rapport d'impact visuel pour l'équipe de réponse. Il isole les 4 systèmes critiques avant que le malware ne se propage. Son manager le félicite : "Comment as-tu fait aussi vite ?"

**Capacités révélées :** Sélection de noeud, traçage des connexions, mode investigation, calcul du blast radius, export rapport.

---

### Journey 3: Amélie Rousseau — La Cartographe des Risques Invisibles

Amélie est Risk Manager et prépare la revue trimestrielle des risques. Sa frustration : elle sait que son registre Excel de 847 risques contient des corrélations qu'elle ne voit pas. Deux risques "moyens" pourraient, combinés, créer un risque "critique" — mais comment les identifier parmi des centaines d'entrées ?

Elle ouvre Voxel en mode "Risques" et voit immédiatement quelque chose d'étrange : un cluster de 8 risques "moyens" tous connectés au même asset — le serveur d'authentification central. Aucun de ces risques n'était flaggé comme critique individuellement. Mais Voxel les a regroupés visuellement, révélant un pattern invisible dans son Excel : si ce serveur tombe, 8 processus métier critiques s'arrêtent simultanément.

Amélie zoome, analyse les connexions, et réalise qu'elle vient de découvrir un Single Point of Failure majeur que personne n'avait identifié en 3 ans. Elle crée un nouveau risque "agrégé" critique et propose un plan de redondance au COMEX. Le DSI lui demande : "Comment avez-vous trouvé ça ?" Elle sourit : "Je l'ai vu."

**Capacités révélées :** Vue par risques, clustering automatique, détection SPOF, analyse des corrélations, création de risque depuis Voxel.

---

### Journey 4: Marc Dubois — L'Audit Visuel

Marc est auditeur externe mandaté pour vérifier la conformité ISO 27001 de l'entreprise. Habituellement, il passe 3 jours à éplucher des documents, croiser des listes de contrôles avec des preuves, demander des clarifications. C'est fastidieux et il manque souvent des incohérences.

Le client lui donne accès à Voxel en mode "Auditeur". Marc active l'overlay "ISO 27001" et voit instantanément la couverture des contrôles : les assets couverts apparaissent avec un bouclier vert, les gaps en rouge pulsant. Il peut filtrer par domaine ISO (A.5 Politiques, A.8 Gestion des assets...) et voir en un coup d'oeil les zones de faiblesse.

En zoomant sur un gap, Marc voit non seulement l'asset non-couvert, mais aussi ses connexions — et réalise que ce gap expose 3 autres systèmes critiques. Il documente ses findings visuellement, capture des screenshots annotés directement depuis Voxel. Son rapport d'audit, habituellement 40 pages de tableaux, devient une présentation visuelle percutante. Le client comprend immédiatement ses priorités de remédiation.

**Capacités révélées :** Mode auditeur, overlay framework (ISO, NIS2, DORA), filtres par domaine, détection gaps, export screenshots.

---

### Journey 5: Catherine Martin — Le COMEX Convaincu

Catherine est DG et n'a que 15 minutes pour comprendre la posture cyber avant le conseil d'administration. Elle déteste les rapports de 50 pages qu'elle ne lit jamais et les slides techniques incompréhensibles. Elle a besoin de répondre à une seule question : "Sommes-nous en danger ?"

Sa RSSI lance Voxel en "Mode Direction". L'écran affiche une vue épurée : le SI apparaît comme une galaxie, avec un score de santé global bien visible (72/100). Les zones rouges attirent immédiatement son regard — 3 clusters critiques pulsent. La RSSI zoome sur chacun et explique en 2 phrases : "Ici, notre ERP est exposé. Là, un fournisseur critique non-audité. Ici, un retard de patch sur les postes."

Catherine comprend instantanément. Elle n'a pas besoin de lire des tableaux — elle voit. Elle pose des questions pertinentes, valide les priorités, approuve le budget demandé. En sortant, elle dit à sa RSSI : "C'est la première fois que je comprends vraiment notre situation. Continuez avec cet outil."

**Capacités révélées :** Mode Direction simplifié, score de santé global, vue épurée, navigation guidée, storytelling visuel.

---

### Journey Requirements Summary

| Capability | Journeys | Priority |
|------------|----------|----------|
| **Canvas 3D navigable** | Tous | P0 |
| **Représentation assets/risques/contrôles** | Tous | P0 |
| **Zoom sémantique macro ↔ micro** | Sophie, Amélie, Marc | P0 |
| **Sélection et focus sur noeud** | Lucas, Amélie | P0 |
| **Traçage des connexions** | Lucas, Amélie | P0 |
| **Clustering automatique** | Amélie | P1 |
| **Overlay par framework** | Marc | P1 |
| **Mode Direction simplifié** | Catherine | P1 |
| **Mode Investigation** | Lucas | P1 |
| **Alertes visuelles (pulsation)** | Tous | P0 |
| **Export/Screenshots** | Lucas, Marc | P1 |
| **Score de santé global** | Catherine | P1 |

## Domain-Specific Requirements

### GRC Visualization - Contexte Réglementaire

Le module Voxel opère dans l'écosystème GRC de Sentinel et doit respecter des exigences spécifiques liées à la visualisation de données sensibles et à l'accessibilité enterprise.

### Accessibilité (WCAG 2.1 AA)

**Défi :** La visualisation 3D pose des challenges uniques pour l'accessibilité.

| Exigence | Implementation Voxel | Priorité |
|----------|---------------------|----------|
| **Daltonisme** | Palette de couleurs accessible + formes distinctives | P0 |
| **Navigation clavier** | Tab, Enter, Escape, Arrows pour naviguer | P1 |
| **Réduction des mouvements** | Respecter `prefers-reduced-motion` | P1 |
| **Contraste suffisant** | Ratio 4.5:1 minimum (WCAG AA) | P0 |
| **Labels textuels** | Tooltips et légendes pour tous les indicateurs | P0 |
| **Mode haut contraste** | Alternative pour environnements difficiles | P2 |

**Palette Daltonisme-Safe :**

| Niveau Risque | Couleur | Alternative Visuelle |
|---------------|---------|---------------------|
| Critique | #E53E3E (Rouge) | + Motif hachuré |
| Élevé | #DD6B20 (Orange) | + Triangle |
| Moyen | #D69E2E (Jaune) | + Cercle |
| Faible | #38B2AC (Bleu-vert) | + Carré |

### Sécurité des Données Visualisées

**Contexte :** Voxel affiche des données GRC sensibles (assets critiques, risques, vulnérabilités).

| Exigence | Mesure | Priorité |
|----------|--------|----------|
| **Pas de cache client** | Données 3D en mémoire uniquement, pas de localStorage | P0 |
| **Filtrage RBAC** | Noeuds visibles selon permissions utilisateur | P0 |
| **Audit trail** | Log des vues et exports dans Voxel | P1 |
| **Watermark export** | Marquer les screenshots avec user/date | P2 |
| **Session timeout** | Vider le canvas 3D après inactivité | P1 |

**Contrôle d'accès par rôle :**

| Rôle | Assets | Risques | Contrôles | Export |
|------|--------|---------|-----------|--------|
| Admin | Tous | Tous | Tous | Oui |
| RSSI | Tous | Tous | Tous | Oui |
| Analyste | Assignés | Assignés | Lecture | Non |
| Auditeur | Lecture | Lecture | Lecture | Limité |
| Direction | Agrégés | Agrégés | Non | Non |

### Performance - Contraintes Enterprise

**Contexte :** Déploiement enterprise avec variabilité hardware.

| Contrainte | Minimum Supporté | Target |
|------------|------------------|--------|
| **Navigateurs** | Chrome 90+, Firefox 88+, Edge 90+, Safari 14+ | Dernières versions |
| **GPU** | Intel HD 4000+ / Équivalent | GPU dédié |
| **RAM disponible** | 4 GB | 8 GB+ |
| **Bande passante** | 10 Mbps | 50 Mbps+ |
| **Écran** | 1366x768 | 1920x1080+ |

**Dégradation gracieuse :**

| Condition | Comportement |
|-----------|--------------|
| GPU faible détecté | Réduire qualité, désactiver effets |
| >5000 noeuds | Activer LOD automatiquement |
| Mobile/Tablet | Mode 2D simplifié (fallback) |
| WebGL non supporté | Message + lien dashboard classique |

### Conformité Data Residency

| Exigence | Mesure |
|----------|--------|
| Données EU | Rendu côté client, pas de transfer vers serveurs externes |
| Pas de CDN tiers pour assets 3D | Bundler les modèles dans l'app |
| RGPD | Pas de tracking analytics dans le canvas 3D |

## Innovation & Novel Patterns

### Detected Innovation Areas

**Innovation Principale : Premier Digital Twin 3D pour la GRC**

Voxel représente une rupture dans le marché GRC :

| Dimension | État du Marché | Innovation Voxel |
|-----------|----------------|------------------|
| **Visualisation** | Dashboards 2D, graphiques standards | Canvas 3D immersif navigable |
| **Interaction** | Clic sur tableaux, filtres dropdown | Navigation spatiale style jeu vidéo |
| **Découverte** | Recherche manuelle, requêtes | Révélation visuelle des patterns |
| **Compréhension** | Lecture de rapports | "Voir" instantanément |

**Innovations Techniques :**

| Innovation | Description | Différenciation |
|------------|-------------|-----------------|
| **Force-Directed GRC** | Layout automatique des graphes de risques | Aucun concurrent |
| **Zoom Sémantique** | Transition fluide macro ↔ micro | Inspiré gaming (Stellaris) |
| **Alertes 3D** | Pulsation, glow, particules pour risques | UX enterprise + gaming |
| **RBAC 3D** | Filtrage des noeuds selon permissions | Sécurité native |

### Market Context & Competitive Landscape

**Analyse Concurrentielle (Source: Research Voxel 2026-01-22)**

| Plateforme | Visualisation | Limite |
|------------|---------------|--------|
| ServiceNow GRC | Dashboards 2D | Pas de vue spatiale |
| SAI360 | Heatmaps, charts | Vue macro uniquement |
| ZenGRC | Dashboards AI | 2D traditionnel |
| Riskonnect | Charts personnalisables | Pas de navigation 3D |
| **Voxel** | **Canvas 3D immersif** | **Océan bleu** |

**Conclusion :** Voxel est positionné sur un **océan bleu** — aucun concurrent direct sur la visualisation 3D GRC.

### Validation Approach

| Hypothèse à Valider | Méthode | Critère de Succès |
|---------------------|---------|-------------------|
| "La 3D apporte plus de valeur que la 2D" | A/B test temps d'identification | -50% temps avec 3D |
| "Les utilisateurs adoptent la navigation 3D" | Analytics sessions Voxel | >40% users actifs M3 |
| "Le Wow effect convertit" | Tracking démos | +30% conversion |
| "Performance acceptable" | Benchmarks 1K/10K noeuds | 30+ FPS |

### Risk Mitigation

| Risque Innovation | Probabilité | Mitigation |
|-------------------|-------------|------------|
| **Adoption faible** (courbe d'apprentissage 3D) | Moyenne | Mode guidé + tutoriel onboarding |
| **Performance insuffisante** | Moyenne | InstancedMesh, LOD, tests charge |
| **Rejet "gadget"** | Faible | Focus valeur métier, pas cosmétique |
| **Complexité technique** | Moyenne | MVP Core minimal, itérations |

**Fallback Strategy :**
Si la 3D ne convainc pas après MVP Core, les composants (données, filtres, alertes) peuvent être réutilisés dans une vue 2D améliorée. L'investissement n'est pas perdu.

## SaaS B2B Module - Technical Requirements

### Integration Architecture

**Positionnement dans Sentinel GRC :**

```
┌─────────────────────────────────────────────────────────────┐
│                    SENTINEL GRC PLATFORM                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │ Assets  │  │ Risks   │  │Controls │  │   Compliance    │ │
│  │ Module  │  │ Module  │  │ Module  │  │     Module      │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘ │
│       │            │            │                 │          │
│       └────────────┴─────┬──────┴─────────────────┘          │
│                          │                                   │
│                    ┌─────▼─────┐                             │
│                    │  VOXEL    │  ◄── Module de visualisation│
│                    │  3D View  │      Consomme les données   │
│                    └───────────┘      Ne modifie pas         │
├─────────────────────────────────────────────────────────────┤
│                      FIRESTORE                               │
│              (Source de vérité unique)                       │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Tenancy Model

**Héritage du modèle Sentinel :**

| Aspect | Comportement Voxel |
|--------|-------------------|
| **Isolation données** | `organizationId` filter sur toutes les queries |
| **Permissions** | RBAC Sentinel appliqué + filtrage noeuds visibles |
| **Configuration** | Paramètres Voxel par tenant (couleurs, layouts) |
| **Quotas** | Limite noeuds selon plan (Basic: 1K, Pro: 10K, Enterprise: 50K+) |

### RBAC Integration

**Extension du modèle RBAC existant :**

| Permission Sentinel | Mapping Voxel |
|--------------------|---------------|
| `assets.read` | Voir noeuds Assets |
| `risks.read` | Voir noeuds Risques |
| `controls.read` | Voir noeuds Contrôles |
| `compliance.read` | Voir overlays Framework |
| `*.write` | Non applicable (Voxel = lecture seule) |

**Filtrage dynamique :**
```typescript
// Les noeuds sont filtrés côté client selon permissions
const visibleNodes = allNodes.filter(node =>
  hasPermission(user, `${node.type}.read`)
);
```

### Data Flow Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Firestore   │────▶│  React Query │────▶│  Zustand     │
│  Real-time   │     │  Cache       │     │  3D State    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  R3F Canvas  │◀────│  Graph       │◀────│  Layout      │
│  Rendering   │     │  Builder     │     │  Engine      │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Collections Firestore consommées :**

| Collection | Usage Voxel | Subscription |
|------------|-------------|--------------|
| `assets` | Noeuds principaux | Real-time |
| `risks` | Noeuds risques | Real-time |
| `controls` | Noeuds contrôles | Real-time |
| `frameworks` | Overlays conformité | On-demand |
| `asset_links` | Arcs connexions | Real-time |

### React Three Fiber Stack

**Dépendances à ajouter :**

```json
{
  "@react-three/fiber": "^8.x",
  "@react-three/drei": "^9.x",
  "@react-three/postprocessing": "^2.x",
  "three": "^0.160.x",
  "zustand": "^4.x"
}
```

**Structure composants :**

```
src/components/voxel/
├── VoxelCanvas.tsx        # Canvas R3F principal
├── VoxelScene.tsx         # Scene 3D + lighting
├── VoxelControls.tsx      # OrbitControls wrapper
├── nodes/
│   ├── AssetNode.tsx      # Géométrie asset
│   ├── RiskNode.tsx       # Géométrie risque
│   └── ControlNode.tsx    # Géométrie contrôle
├── edges/
│   └── ConnectionEdge.tsx # Ligne entre noeuds
├── effects/
│   └── RiskPulse.tsx      # Animation pulsation
└── hooks/
    ├── useVoxelData.ts    # Agrégation Firestore
    └── useGraphLayout.ts  # Force-directed calc
```

### Performance Considerations

**Optimisations prévues :**

| Phase | Technique | Impact |
|-------|-----------|--------|
| MVP | Mesh standard | 1K noeuds @ 60fps |
| MVP+ | InstancedMesh | 10K noeuds @ 60fps |
| V2 | LOD + Culling | 50K+ noeuds @ 30fps |
| V2 | Web Workers | Layout non-bloquant |

### Feature Flags

**Rollout progressif :**

```typescript
const VOXEL_FLAGS = {
  enabled: true,           // Kill switch global
  maxNodes: 1000,          // Limite MVP
  enableClustering: false, // MVP+
  enableAlerts: false,     // MVP+
  enableExport: false,     // V2
};
```

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach :** Experience MVP
> Démontrer le "Wow effect" de la visualisation 3D avec une valeur métier immédiate. L'objectif n'est pas la complétude fonctionnelle, mais la validation de l'hypothèse : "La 3D révèle ce que la 2D cache."

**Ressources estimées :**

| Rôle | MVP Core | MVP+ |
|------|----------|------|
| Dev Frontend (R3F) | 1 senior | 1 senior |
| Dev Frontend (UI) | 0.5 | 0.5 |
| UX Designer | 0.25 | 0.5 |
| QA | 0.25 | 0.5 |

### MVP Core Feature Set (Phase 1)

**Durée estimée :** 4-6 semaines

**User Journeys supportés :**
- ✅ Sophie (RSSI) — Vue macro, identification visuelle
- ✅ Lucas (SOC) — Sélection noeud, traçage connexions (basique)
- ⚠️ Amélie (Risk) — Partiel (pas de clustering)
- ⚠️ Marc (Auditeur) — Partiel (pas d'overlay framework)
- ❌ Catherine (Direction) — Mode simplifié en MVP+

**Must-Have Capabilities :**

| Feature | Justification | Effort |
|---------|--------------|--------|
| Canvas R3F | Fondation technique | M |
| Noeuds Assets/Risques/Contrôles | Core value | M |
| Arcs Connexions | Visualiser interdépendances | M |
| Navigation Orbit | Interaction de base | S |
| Filtres par type | Gérer complexité | S |
| Tooltip + Click detail | Exploration données | M |
| Palette couleurs risque | Sémantique visuelle | XS |

**Explicitement hors MVP Core :**
- ❌ Zoom sémantique (macro ↔ micro fluide)
- ❌ Alertes visuelles (pulsation, glow)
- ❌ Clustering automatique
- ❌ Minimap
- ❌ Overlay frameworks
- ❌ Export/Screenshots

### Post-MVP Features

**Phase 2 — MVP+ (6-8 semaines après MVP Core) :**

| Feature | Valeur ajoutée | Priorité |
|---------|----------------|----------|
| Zoom Sémantique | Différenciateur clé, navigation intuitive | P1 |
| Alertes Visuelles | Détection anomalies immédiate | P1 |
| Mode Guidé | Onboarding, accessibilité | P1 |
| Clustering Auto | Gestion complexité 1K+ noeuds | P1 |
| InstancedMesh | Performance 10K noeuds | P1 |
| Overlay Framework | Journey Marc (Auditeur) complet | P1 |
| Mode Direction | Journey Catherine complet | P1 |

**Phase 3 — V2 (Q3-Q4 2026) :**

| Feature | Valeur ajoutée |
|---------|----------------|
| Détection Anomalies IA | Prédictif vs réactif |
| Simulation What-If | Aide à la décision |
| Export PNG/PDF | Reporting, audit |
| Mode Présentation | COMEX, board meetings |

**Phase 4 — V3 (2027) :**

| Feature | Valeur ajoutée |
|---------|----------------|
| VR/AR | Immersion totale |
| Multi-user temps réel | Collaboration |
| API Voxel publique | Écosystème, intégrations |

### Risk Mitigation Strategy

**Risques Techniques :**

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Performance R3F insuffisante | Moyenne | Tests charge dès semaine 2, InstancedMesh prêt en backup |
| Complexité intégration Firestore | Faible | Architecture data flow validée, React Query existant |
| Bugs WebGL cross-browser | Moyenne | Tests Safari/Firefox early, fallback 2D prêt |

**Risques Marché :**

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Adoption faible ("gadget") | Moyenne | Focus valeur métier dans démos, métriques dès MVP |
| Courbe d'apprentissage 3D | Moyenne | Mode guidé en MVP+, tutoriel onboarding |

**Risques Ressources :**

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Retard planning | Moyenne | Buffer 20% intégré, scope MVP négociable |
| Perte dev clé | Faible | Documentation code dès le départ |

### Go/No-Go Checkpoints

**Checkpoint 1 — Fin MVP Core :**

| Critère | Seuil | Action si échec |
|---------|-------|-----------------|
| 30+ FPS avec 1K noeuds | Obligatoire | Itérer perf avant MVP+ |
| Feedback "utile" > 70% | Obligatoire | Pivoter UX |
| 0 bug bloquant | Obligatoire | Fix avant release |

**Checkpoint 2 — Fin MVP+ :**

| Critère | Seuil | Action si échec |
|---------|-------|-----------------|
| 60 FPS avec 10K noeuds | Target | Optimiser avant V2 |
| Adoption > 40% users | Obligatoire | Revoir onboarding |
| NPS > 30 | Target | Collecter feedback |

