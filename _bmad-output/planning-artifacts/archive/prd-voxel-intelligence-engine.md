---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
workflowType: 'prd'
workflow_completed: true
project_type: 'feature_enhancement'
domain: 'data_visualization_analytics'
complexity: 'very_high'
created: '2026-01-17'
author: 'John (PM) + Thibaultllopis'
---

# PRD - Voxel Intelligence Engine

**Sentinel GRC v2 - 3D Security Intelligence Platform**

**Auteur:** Thibaultllopis
**Date:** 2026-01-17
**Version:** 1.0
**Statut:** Ready for Architecture

---

## Executive Summary

### Le Problème

Le module Voxel actuel est une **visualisation 3D impressionnante mais passive**. Il affiche les données mais ne les analyse pas. Les utilisateurs voient une belle représentation mais ne peuvent pas :
- Détecter automatiquement les anomalies
- Analyser les tendances temporelles
- Simuler l'impact des incidents
- Recevoir des alertes proactives

C'est comme avoir un cockpit d'avion avec tous les cadrans mais sans pilote automatique.

### La Solution

Transformer Voxel en une **Intelligence Platform** qui :
1. **Détecte** automatiquement les anomalies et incohérences
2. **Analyse** les tendances et prédit les problèmes
3. **Simule** l'impact en cascade des incidents
4. **Alerte** proactivement sur les situations critiques
5. **Synchronise** en temps réel avec les données

### What Makes This Special

| Différenciateur | Description |
|-----------------|-------------|
| **Real-time 3D** | Premier GRC avec visualisation 3D synchronisée en temps réel |
| **Anomaly Detection** | IA détecte les incohérences automatiquement |
| **Blast Radius Simulation** | Simule l'impact cascade des incidents |
| **Role-based Views** | Chaque persona voit ce qui lui importe |
| **AR/VR Ready** | Préparé pour l'immersif (WebXR) |

---

## Project Classification

**Type:** Feature Enhancement (Brownfield)
**Module:** Voxel / CTC Engine 3D
**Priorité:** P1 - Différenciateur Majeur
**Complexité:** Très Haute
**Effort estimé:** 12-15 sprints

### État Actuel (Audit 2026-01-17)

**Ce qui existe :**
- ✅ Rendu 3D performant (Three.js + React Three Fiber)
- ✅ 7 types de nœuds (Assets, Risks, Projects, Audits, Incidents, Suppliers, Controls)
- ✅ Connexions animées entre entités
- ✅ Modes: Heatmap, X-Ray, Impact, Présentation
- ✅ Analyse IA basique (suggestions de liens via Gemini)
- ✅ Navigation fluide (zoom, orbite, sélection)

**Ce qui manque :**
- ❌ Détection d'anomalies automatique
- ❌ Temps réel (Firestore subscriptions)
- ❌ Analytics temporels (tendances, prédictions)
- ❌ Blast radius avancé (simulation multi-étapes)
- ❌ Vues personnalisées par rôle
- ❌ Export/Partage (PDF, URL, 3D)
- ❌ AR/VR support

---

## User Personas & Journeys

### Persona 1: RSSI (Marie, 42 ans) - "Le Pilote"

**Contexte:** Doit avoir une vue d'ensemble de la posture sécurité en temps réel.

**Besoins critiques:**
- Voir immédiatement les risques critiques
- Comprendre les dépendances et impacts potentiels
- Être alertée des anomalies sans avoir à chercher
- Présenter au COMEX avec des visuels impactants

**Journey actuel (frustrant):**
1. Ouvre Voxel, voit plein de nœuds
2. Cherche manuellement les risques critiques
3. Ne sait pas si quelque chose a changé depuis hier
4. Exporte des captures d'écran pour ses présentations

**Journey cible (satisfaisant):**
1. Ouvre Voxel → Vue RSSI automatique (risques critiques en premier)
2. Notification "3 nouvelles anomalies détectées" avec highlight
3. Clique sur risque → Voit blast radius animé
4. Click "Rapport COMEX" → PDF généré avec snapshots 3D
5. "Depuis hier: +2 risques, -1 incident résolu" affiché

### Persona 2: Auditeur Interne (Pierre, 35 ans) - "L'Investigateur"

**Contexte:** Doit investiguer les gaps de contrôle et tracer les dépendances.

**Besoins critiques:**
- Identifier les assets non couverts par des contrôles
- Tracer la chaîne de dépendances d'un incident
- Valider la couverture des contrôles
- Documenter ses findings visuellement

**Journey cible:**
1. Ouvre Voxel → Vue Auditeur (focus contrôles)
2. Active "Anomaly Mode" → Assets sans contrôles highlightés en rouge
3. Clique sur asset orphelin → Trace arrière automatique
4. "Root Cause Analysis" → Visualise la chaîne de défaillances
5. Annote le graphe → Export rapport avec annotations

### Persona 3: Direction (Jean, 55 ans) - "Le Décideur"

**Contexte:** PDG, veut comprendre la posture risque en 30 secondes.

**Besoins critiques:**
- Vue simplifiée (pas de jargon technique)
- Score global de santé visuel
- Top 3 problèmes avec impact business
- Comparaison temporelle (vs mois dernier)

**Journey cible:**
1. Ouvre Voxel → Vue Executive (3 KPIs géants)
2. Voit "Score Santé: 72/100" (vert/orange/rouge)
3. "Top 3 Risques Business" avec impact en €
4. Graphe simplifié: seulement les connexions critiques
5. Swipe pour voir évolution sur 3 mois

### Persona 4: SOC Analyst (Alex, 28 ans) - "Le Gardien"

**Contexte:** Surveille les incidents en temps réel 24/7.

**Besoins critiques:**
- Flux temps réel des incidents
- Corrélation automatique avec assets
- Timeline des événements
- Escalade rapide

**Journey cible:**
1. Voxel en mode "SOC Live" sur écran dédié
2. Nouvel incident → Nœud apparaît avec animation
3. Corrélation auto: "Incident lié à Asset X, Risk Y"
4. Timeline latérale: événements des 24h
5. Click "Escalade" → Notification RSSI + snapshot

---

## Success Criteria

### User Success

| Critère | Métrique | Cible |
|---------|----------|-------|
| **Temps insight** | Secondes pour trouver un problème | <10s (vs 2min actuel) |
| **Détection anomalies** | % anomalies détectées automatiquement | >80% |
| **Compréhension impact** | Users comprenant blast radius | >90% |
| **Satisfaction SOC** | NPS équipe SOC | >60 |

### Business Success

| Critère | Métrique | Cible |
|---------|----------|-------|
| **Différenciation** | Prospects mentionnant Voxel | +40% |
| **Demo conversion** | Conversion après démo Voxel | +25% |
| **Usage quotidien** | Users ouvrant Voxel/jour | >50% RSSI |
| **Enterprise tier** | Upsell "Voxel Premium" | 30% base |

### Technical Success

| Critère | Métrique | Cible |
|---------|----------|-------|
| **Latence sync** | Délai Firestore → Voxel | <2s |
| **FPS rendering** | Frames/seconde 3D | >30 fps |
| **Scalabilité** | Nœuds sans dégradation | >5000 |
| **Couverture anomalies** | Types détectés | 15+ types |

---

## Functional Requirements

### FR-VOXEL-001: Temps Réel (Real-time Sync)

**Priorité:** P0 - CRITIQUE
**Effort:** 1.5 sprint

**Description:**
Synchronisation en temps réel des données Firestore avec la visualisation 3D.

**Acceptance Criteria:**
1. Firestore listeners sur toutes les collections (assets, risks, incidents, etc.)
2. Mise à jour visuelle <2s après changement en base
3. Animation d'apparition/disparition des nœuds
4. Indicateur de sync status ("Live" / "Syncing..." / "Offline")
5. Debounce intelligent pour éviter surcharge (100ms)
6. Mode offline graceful avec cache local
7. Notification push si changement majeur (nouveau risque critique)

**Technical Notes:**
```typescript
// Real-time subscription
const unsubscribe = onSnapshot(
  collection(db, 'risks'),
  { includeMetadataChanges: true },
  (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') animateNodeIn(change.doc);
      if (change.type === 'removed') animateNodeOut(change.doc.id);
      if (change.type === 'modified') updateNode(change.doc);
    });
  }
);
```

---

### FR-VOXEL-002: Détection d'Anomalies Automatique

**Priorité:** P0 - CRITIQUE
**Effort:** 2.5 sprints

**Description:**
Moteur de détection d'anomalies et incohérences dans le graphe de données.

**Types d'anomalies à détecter:**

| Catégorie | Anomalie | Sévérité | Détection |
|-----------|----------|----------|-----------|
| **Orphelins** | Asset sans contrôle | Haute | Query JOIN |
| **Orphelins** | Risque sans asset | Moyenne | Query JOIN |
| **Orphelins** | Contrôle sans preuve | Moyenne | Query JOIN |
| **Périmés** | Contrôle >90j sans review | Haute | Timestamp check |
| **Périmés** | Incident ouvert >30j | Haute | Timestamp check |
| **Périmés** | Document expiré | Moyenne | Date check |
| **Incohérences** | Risk.score > Related.severity | Haute | Logic check |
| **Incohérences** | Supplier critique sans SLA | Haute | Field check |
| **Cycles** | Dépendance circulaire | Critique | DFS graph |
| **Clusters** | Concentration de risques | Moyenne | ML clustering |
| **Tendances** | Score dégradé >20% /mois | Haute | Time series |

**Acceptance Criteria:**
1. Job de détection s'exécute en background (Cloud Function scheduled)
2. Résultats stockés en Firestore (collection: `anomalies`)
3. Visualisation: nœuds anomaliques entourés de halo rouge pulsant
4. Panel "Anomalies" dans sidebar avec liste filtrable
5. Click sur anomalie → zoom et highlight des nœuds concernés
6. Actions rapides: "Ignorer", "Créer tâche", "Voir détails"
7. Historique des anomalies (résolues vs persistantes)
8. Score global d'intégrité: "Data Health: 87%"

---

### FR-VOXEL-003: Blast Radius Simulation

**Priorité:** P0 - CRITIQUE
**Effort:** 2 sprints

**Description:**
Simulation visuelle de l'impact en cascade d'un incident ou risque.

**Acceptance Criteria:**
1. Bouton "Simuler Impact" sur chaque nœud Risk/Incident
2. Animation BFS: vagues concentriques vers nœuds dépendants
3. Niveaux d'impact: Direct (rouge), Indirect (orange), Potentiel (jaune)
4. Affichage temps estimé de propagation (basé sur historique)
5. Stats panel: "12 assets impactés, 3 suppliers, MTTR estimé: 4h"
6. Mode "What-If": simuler impact si contrôle défaillant
7. Export rapport d'impact (PDF avec timeline)
8. Comparaison: impact avec/sans mesures de mitigation

**Algorithme:**
```typescript
function simulateBlastRadius(nodeId: string, maxDepth: number = 3) {
  const visited = new Set<string>();
  const queue: Array<{id: string, depth: number, path: string[]}> = [{id: nodeId, depth: 0, path: []}];
  const impacts: ImpactNode[] = [];

  while (queue.length > 0) {
    const {id, depth, path} = queue.shift()!;
    if (visited.has(id) || depth > maxDepth) continue;
    visited.add(id);

    const node = getNode(id);
    const impactLevel = calculateImpactLevel(node, depth, path);
    impacts.push({...node, impactLevel, depth, path});

    // Propagate to connected nodes
    node.connections.forEach(connId => {
      const weight = getConnectionWeight(id, connId);
      queue.push({id: connId, depth: depth + weight, path: [...path, id]});
    });
  }
  return impacts.sort((a, b) => a.depth - b.depth);
}
```

---

### FR-VOXEL-004: Vues Personnalisées par Rôle

**Priorité:** P1 - HAUTE
**Effort:** 1.5 sprint

**Description:**
Presets de visualisation optimisés pour chaque persona.

**Vues prédéfinies:**

| Vue | Rôle | Focus | Layout | Filters |
|-----|------|-------|--------|---------|
| **Executive** | Direction | KPIs, Top risques | Simplifié | Score >15 only |
| **RSSI** | RSSI | Risques, Incidents | Complet | All critical |
| **Auditor** | Auditeur | Contrôles, Preuves | Contrôles-centric | Gaps highlighted |
| **SOC** | Analyst | Incidents live | Timeline | Last 24h |
| **Compliance** | DPO | RGPD, Documents | By regulation | Per framework |

**Acceptance Criteria:**
1. Dropdown "Changer de vue" dans toolbar
2. Chaque vue configure: layers visibles, caméra position, filtres, layout
3. Vue sauvegardée en localStorage + sync Firestore
4. Possibilité de créer/sauvegarder vues custom
5. Partage de vue via URL (params encodés)
6. Raccourcis clavier: 1=Executive, 2=RSSI, 3=Auditor, etc.
7. Transition animée entre vues

---

### FR-VOXEL-005: Analytics Temporels

**Priorité:** P1 - HAUTE
**Effort:** 2.5 sprints

**Description:**
Analyse des tendances et évolution dans le temps.

**Acceptance Criteria:**
1. Historique des scores stocké (daily snapshots)
2. Mode "Time Machine": slider pour voir état à une date
3. Graphique superposé: évolution score risque sur 90 jours
4. Détection de tendances: "Risk score +15% ce mois"
5. Prédiction ML: "Risque estimé dans 30j: Critique"
6. Comparaison: "vs semaine dernière", "vs mois dernier"
7. Heatmap calendrier: intensité des incidents par jour
8. Export timeline (GIF animé ou vidéo)

**Data Model:**
```typescript
interface DailySnapshot {
  date: string; // YYYY-MM-DD
  organizationId: string;
  metrics: {
    totalRisks: number;
    criticalRisks: number;
    avgRiskScore: number;
    openIncidents: number;
    controlCoverage: number;
    dataHealthScore: number;
  };
  topRisks: Array<{id: string, score: number}>;
  anomaliesCount: number;
}
```

---

### FR-VOXEL-006: Root Cause Analysis

**Priorité:** P1 - HAUTE
**Effort:** 1.5 sprint

**Description:**
Traçage arrière pour identifier la cause racine d'un problème.

**Acceptance Criteria:**
1. Bouton "Analyser Cause" sur incidents et risques
2. Algorithme de traceback: remonte les dépendances
3. Visualisation: chemin surligné jusqu'à la source
4. Identification des "bottlenecks" (nœuds avec beaucoup de dépendants)
5. Suggestion de contrôles à renforcer
6. Timeline des événements menant au problème
7. Export "Rapport Root Cause" (5 Whys format)

---

### FR-VOXEL-007: Alertes Proactives

**Priorité:** P1 - HAUTE
**Effort:** 1 sprint

**Description:**
Système de notifications basé sur les détections Voxel.

**Types d'alertes:**

| Alerte | Condition | Canal | Fréquence |
|--------|-----------|-------|-----------|
| Anomalie critique | Nouvelle anomalie sévérité critique | Push + Email | Immédiat |
| Tendance négative | Score risque +20% / semaine | Email | Hebdo |
| Nouvel incident | Incident créé | Push | Immédiat |
| Blast radius élevé | Impact >10 assets | Push + Slack | Immédiat |
| Data health dégradé | Score <70% | Email | Quotidien |

**Acceptance Criteria:**
1. Configuration des alertes par utilisateur
2. Seuils personnalisables
3. Canaux: In-app, Email, Slack webhook, Teams webhook
4. Digest mode: agrégation des alertes similaires
5. Snooze temporaire par alerte
6. Historique des alertes envoyées
7. Intégration avec notification system existant

---

### FR-VOXEL-008: Export & Partage

**Priorité:** P2 - MOYENNE
**Effort:** 1.5 sprint

**Description:**
Capacités d'export et de partage des visualisations.

**Acceptance Criteria:**
1. Screenshot HD de la vue actuelle (PNG)
2. Export PDF "Rapport Voxel" avec multiples vues
3. URL de partage avec état encodé (view, filters, camera)
4. Export 3D (glTF) pour viewers externes
5. Mode présentation full-screen avec laser pointer
6. Enregistrement vidéo de navigation (WebM)
7. QR code pour accès mobile rapide

---

### FR-VOXEL-009: Performance & Scalabilité

**Priorité:** P1 - HAUTE
**Effort:** 2 sprints

**Description:**
Optimisations pour supporter de grands graphes.

**Acceptance Criteria:**
1. Instanced rendering pour nœuds similaires (1 draw call pour 1000 assets)
2. LOD dynamique: détail réduit pour nœuds distants
3. Frustum culling: ne render que le visible
4. Web Workers pour calculs (anomalies, BFS, layouts)
5. Lazy loading des connexions (afficher sur zoom)
6. Pagination virtuelle des listes sidebar
7. Memory monitoring et garbage collection proactif
8. Target: 5000 nœuds à 30fps sur laptop standard

**Benchmarks:**
| Nœuds | FPS actuel | FPS cible | Mémoire cible |
|-------|------------|-----------|---------------|
| 500 | 60 | 60 | <200MB |
| 2000 | 45 | 55 | <400MB |
| 5000 | 20 | 35 | <800MB |
| 10000 | 8 | 25 | <1.5GB |

---

### FR-VOXEL-010: Annotations & Collaboration

**Priorité:** P2 - MOYENNE
**Effort:** 1.5 sprint

**Description:**
Outils d'annotation et de collaboration sur les visualisations.

**Acceptance Criteria:**
1. Mode annotation: ajouter notes sur nœuds/connexions
2. Annotations visibles en 3D (labels flottants)
3. Mentions @user dans annotations
4. Thread de discussion par annotation
5. Historique des annotations par nœud
6. Filtrer par auteur/date/statut
7. Export annotations avec le rapport

---

### FR-VOXEL-011: AR/VR Foundation (Future-Ready)

**Priorité:** P3 - BASSE (Foundation only)
**Effort:** 1 sprint

**Description:**
Préparation pour expériences immersives futures.

**Acceptance Criteria:**
1. Détection WebXR support dans le navigateur
2. Bouton "Entrer en VR" (si casque détecté)
3. Mode VR basique: navigation orbitale avec controllers
4. Mode AR mobile: projection du graphe (ARCore/ARKit via WebXR)
5. Export glTF optimisé pour Quest/Vision Pro
6. Documentation pour extension VR future

---

## Non-Functional Requirements

### NFR-PERF-001: Rendering

- FPS: >30 fps avec 5000 nœuds
- Frame time: <33ms
- First render: <2s après data load

### NFR-PERF-002: Real-time

- Latence sync: <2s Firestore → UI
- Debounce: 100ms
- Reconnection auto: <5s

### NFR-PERF-003: Scalabilité

- Nœuds supportés: jusqu'à 10000
- Connexions: jusqu'à 50000
- Memory: <1.5GB pour 10K nœuds

### NFR-UX-001: Accessibilité

- Keyboard navigation complète
- Screen reader support (descriptions audio)
- High contrast mode
- Color blind safe palette

### NFR-SEC-001: Données

- Pas de données sensibles dans logs console
- Sanitization des exports
- Respect RBAC dans vues partagées

---

## Technical Architecture

### Composants Nouveaux

```
┌─────────────────────────────────────────────────────────────────┐
│               VOXEL INTELLIGENCE ENGINE ARCHITECTURE            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    FRONTEND (React)                      │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │ VoxelView│  │ 3D Engine│  │ Anomaly  │  │Analytics│ │   │
│  │  │ (Smart)  │  │ (Optimized)│ │ Panel    │  │ Charts  │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │   │
│  │       │              │             │             │       │   │
│  │       └──────────────┴─────────────┴─────────────┘       │   │
│  │                          │                                │   │
│  │                   ┌──────┴──────┐                        │   │
│  │                   │ Web Workers │                        │   │
│  │                   │ (Compute)   │                        │   │
│  │                   └─────────────┘                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   FIREBASE BACKEND                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │Firestore │  │ Cloud    │  │ Pub/Sub  │              │   │
│  │  │Listeners │  │ Functions│  │ (Events) │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  │       │              │             │                     │   │
│  │       ▼              ▼             ▼                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │anomalies │  │ daily_   │  │ alerts   │              │   │
│  │  │(detected)│  │ snapshots│  │ (sent)   │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Services à Créer/Modifier

| Service | Type | Description |
|---------|------|-------------|
| **VoxelRealtimeService** | Nouveau | Gestion subscriptions Firestore |
| **AnomalyDetectionService** | Nouveau | Moteur de détection (Cloud Function) |
| **BlastRadiusService** | Nouveau | Algorithmes de simulation |
| **VoxelAnalyticsService** | Nouveau | Time series et prédictions |
| **VoxelExportService** | Nouveau | PDF, PNG, glTF exports |
| **VoxelStudio** | Modifier | Optimisations perf |
| **aiService** | Modifier | Extend pour anomalies ML |

### Cloud Functions Requises

| Function | Trigger | Description |
|----------|---------|-------------|
| `detectAnomalies` | Scheduled (15min) | Scan et détecte anomalies |
| `createDailySnapshot` | Scheduled (daily) | Archive métriques journalières |
| `alertOnCritical` | Firestore write | Alerte si anomalie critique |
| `predictTrends` | Scheduled (weekly) | ML predictions |
| `cleanupOldSnapshots` | Scheduled (monthly) | Archive >1 an |

---

## Roadmap

### Phase 1: Foundation Intelligence (Sprints 1-4)

| Sprint | Stories | Livrables |
|--------|---------|-----------|
| **Sprint 1** | FR-VOXEL-001 | Real-time sync complet |
| **Sprint 2** | FR-VOXEL-002 (partie 1) | Détection anomalies basiques |
| **Sprint 3** | FR-VOXEL-002 (partie 2) | Détection avancée + UI |
| **Sprint 4** | FR-VOXEL-003 | Blast radius simulation |

### Phase 2: Analytics & Views (Sprints 5-8)

| Sprint | Stories | Livrables |
|--------|---------|-----------|
| **Sprint 5** | FR-VOXEL-004 | Vues par rôle |
| **Sprint 6** | FR-VOXEL-005 (partie 1) | Time machine + snapshots |
| **Sprint 7** | FR-VOXEL-005 (partie 2) | Tendances + prédictions |
| **Sprint 8** | FR-VOXEL-006 | Root cause analysis |

### Phase 3: Production Ready (Sprints 9-12)

| Sprint | Stories | Livrables |
|--------|---------|-----------|
| **Sprint 9** | FR-VOXEL-007 | Alertes proactives |
| **Sprint 10** | FR-VOXEL-009 | Optimisations perf |
| **Sprint 11** | FR-VOXEL-008 | Export & partage |
| **Sprint 12** | FR-VOXEL-010, 011 | Annotations + AR foundation |

---

## Risks & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Performance 3D dégradée | Haute | Haute | LOD, instancing, Web Workers |
| Faux positifs anomalies | Moyenne | Moyenne | Tuning seuils, feedback loop |
| Surcharge Firestore listeners | Moyenne | Haute | Debounce, pagination |
| Complexité ML prédictions | Haute | Basse | Commencer simple (règles) |
| WebXR support limité | Basse | Basse | Feature detection, fallback |

---

## Dependencies

### Externes
- Gemini API (analyse IA) - déjà intégré
- Three.js (3D) - déjà intégré
- WebXR API (AR/VR) - browser native

### Internes
- Notification system (alertes)
- Export PDF (rapport) - à étendre
- RBAC (vues par rôle)

---

## Appendix

### A. Anomalies Prioritaires (MVP)

**Sprint 2-3 scope:**
1. ✅ Assets sans contrôle (orphelins)
2. ✅ Risques sans asset lié
3. ✅ Contrôles >90j sans review
4. ✅ Incidents ouverts >30j
5. ✅ Score risque incohérent vs sévérité
6. ✅ Supplier critique sans SLA
7. ✅ Dépendances circulaires

### B. Métriques Dashboard Data Health

```typescript
const dataHealthScore = {
  orphanedAssets: { weight: 0.2, calc: (count) => Math.max(0, 100 - count * 5) },
  orphanedRisks: { weight: 0.15, calc: (count) => Math.max(0, 100 - count * 10) },
  staleControls: { weight: 0.2, calc: (count) => Math.max(0, 100 - count * 3) },
  oldIncidents: { weight: 0.15, calc: (count) => Math.max(0, 100 - count * 8) },
  missingLinks: { weight: 0.15, calc: (count) => Math.max(0, 100 - count * 2) },
  circularDeps: { weight: 0.15, calc: (count) => count > 0 ? 0 : 100 },
};
```

### C. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `1-5` | Switch view preset |
| `A` | Toggle anomaly mode |
| `I` | Toggle impact mode |
| `T` | Open time machine |
| `R` | Reset camera |
| `F` | Fit all to view |
| `S` | Screenshot |
| `?` | Help overlay |

---

**Document créé par:** John (PM) avec Thibaultllopis
**Prêt pour:** Architecture Review
**Prochaine étape:** Validation Architecture puis création des Epics & Stories
