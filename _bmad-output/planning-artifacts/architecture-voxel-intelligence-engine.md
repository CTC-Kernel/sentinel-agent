---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: ['prd-voxel-intelligence-engine.md', 'audit-module-voxel']
workflowType: 'architecture'
project_name: 'sentinel-grc-v2-prod'
module: 'voxel-intelligence-engine'
user_name: 'Thibaultllopis'
date: '2026-01-17'
status: 'ready-for-implementation'
---

# Architecture Decision Document - Voxel Intelligence Engine

**Module:** 3D Security Intelligence Platform
**Auteur:** Architecte + Thibaultllopis
**Date:** 2026-01-17
**Version:** 1.0

---

## 1. Executive Summary

Ce document définit les décisions architecturales pour transformer le module Voxel d'une **visualisation 3D passive** en une **plateforme d'intelligence sécurité** avec détection d'anomalies, temps réel, et analyses prédictives.

### Principes Directeurs

1. **Real-time First** - Synchronisation instantanée avec les données
2. **Intelligence by Default** - Détection proactive, pas réactive
3. **Performance at Scale** - 60fps avec 5000+ nœuds
4. **Role-Optimized** - Chaque persona voit ce qui lui importe
5. **Brownfield** - Extension de l'existant Three.js/R3F

---

## 2. Current State Analysis

### 2.1 Architecture Existante

```
┌─────────────────────────────────────────────────────────────────┐
│                    ÉTAT ACTUEL (Audit 2026-01-17)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend (React + Three.js)                                    │
│  ├─ VoxelView.tsx (1139 lines - orchestration)                  │
│  ├─ VoxelStudio.tsx (795 lines - 3D engine)                     │
│  ├─ VoxelMesh.tsx (516 lines - node rendering)                  │
│  ├─ VoxelSidebar.tsx (149 lines - filters)                      │
│  ├─ VoxelDetailOverlay.tsx (300 lines - details panel)          │
│  └─ VoxelMaterials.tsx (38 lines - shaders)                     │
│                                                                 │
│  Hooks                                                          │
│  └─ useVoxels.ts (132 lines - data fetch, NO real-time)         │
│                                                                 │
│  AI Service                                                     │
│  └─ aiService.ts (analyzeGraph - manual trigger only)           │
│                                                                 │
│  Data: ONE-TIME FETCH from Firestore                            │
│  └─ assets, risks, projects, audits, incidents, suppliers       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Gaps Identifiés

| Gap | Impact | Solution Architecturale |
|-----|--------|-------------------------|
| Pas de temps réel | Critique | Firestore onSnapshot |
| Pas de détection anomalies | Critique | Cloud Function + Rules Engine |
| Pas d'analytics temporels | Haute | Daily snapshots + time series |
| Performance limitée >2000 nodes | Haute | Instancing + Web Workers |
| Blast radius basique | Haute | Weighted BFS + simulation |
| Pas de vues par rôle | Moyenne | Presets + URL state |

---

## 3. Target Architecture

### 3.1 Vue d'Ensemble

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE CIBLE - VOXEL INTELLIGENCE               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      FRONTEND (React + R3F)                        │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │ │
│  │  │ VoxelView   │  │ VoxelStudio │  │ VoxelMesh   │                │ │
│  │  │ (Smart)     │  │ (Optimized) │  │ (Instanced) │                │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                │ │
│  │         │                │                │                        │ │
│  │         ▼                ▼                ▼                        │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │                    STATE MANAGEMENT                          │  │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │  │ │
│  │  │  │ Zustand  │  │ Real-time│  │ Anomaly  │  │ Analytics│    │  │ │
│  │  │  │ Store    │  │ Sync     │  │ State    │  │ State    │    │  │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  │         │                │                │                        │ │
│  │         ▼                ▼                ▼                        │ │
│  │  ┌─────────────────────────────────────────────────────────────┐  │ │
│  │  │                    WEB WORKERS                               │  │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │  │ │
│  │  │  │ Layout   │  │ Anomaly  │  │ Blast    │                   │  │ │
│  │  │  │ Compute  │  │ Detect   │  │ Radius   │                   │  │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘                   │  │ │
│  │  └─────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                       FIREBASE BACKEND                             │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │                   FIRESTORE (Real-time)                       │ │ │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │ │ │
│  │  │  │ assets │ │ risks  │ │projects│ │ audits │ │incidents│     │ │ │
│  │  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘     │ │ │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                │ │ │
│  │  │  │supplier│ │controls│ │anomalies│ │snapshots│              │ │ │
│  │  │  └────────┘ └────────┘ └────────┘ └────────┘                │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  │                          │                                        │ │
│  │                          ▼                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │                   CLOUD FUNCTIONS                             │ │ │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │ │ │
│  │  │  │ detectAnom  │  │ createSnap  │  │ predictTrend│          │ │ │
│  │  │  │ (scheduled) │  │ (daily)     │  │ (weekly)    │          │ │ │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘          │ │ │
│  │  │  ┌─────────────┐  ┌─────────────┐                           │ │ │
│  │  │  │ alertCritical│ │ cleanupOld │                           │ │ │
│  │  │  │ (trigger)   │  │ (monthly)  │                           │ │ │
│  │  │  └─────────────┘  └─────────────┘                           │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow - Real-time

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         REAL-TIME DATA FLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Firestore                     Frontend                    3D Scene     │
│  ┌────────┐                   ┌────────┐                  ┌────────┐   │
│  │ risks  │ ──onSnapshot──▶  │ Zustand │ ──subscribe──▶  │ Nodes  │   │
│  │ (write)│                   │ Store   │                  │ Update │   │
│  └────────┘                   └────────┘                  └────────┘   │
│      │                             │                           │        │
│      │ <100ms                      │ <16ms                     │ 60fps  │
│      ▼                             ▼                           ▼        │
│  ┌────────┐                   ┌────────┐                  ┌────────┐   │
│  │ Cloud  │                   │ Web    │                  │ Three  │   │
│  │ Func   │                   │ Worker │                  │ Render │   │
│  │ Detect │                   │ Compute│                  │ Loop   │   │
│  └────────┘                   └────────┘                  └────────┘   │
│      │                             │                           │        │
│      ▼                             ▼                           ▼        │
│  ┌────────┐                   ┌────────┐                  ┌────────┐   │
│  │anomalies│◀──────────────── │ Result │ ──────────────▶ │ Visual │   │
│  │(write) │                   │ Back   │                  │ Update │   │
│  └────────┘                   └────────┘                  └────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Architecture Decisions (ADRs)

### ADR-VOXEL-001: Real-time via Firestore onSnapshot

**Contexte:** Les données doivent être synchronisées en temps réel entre tous les clients.

**Décision:** Utiliser Firestore `onSnapshot` avec debounce côté client.

**Alternatives considérées:**
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Polling (30s) | Simple | Latence, gaspillage | ❌ |
| WebSocket custom | Contrôle total | Complexité, scaling | ❌ |
| Firebase RTDB | Très rapide | Pas de requêtes avancées | ❌ |
| Firestore onSnapshot | Intégré, requêtes | Coût si trop de writes | ✅ |

**Implémentation:**
```typescript
// useVoxelRealtime.ts
export function useVoxelRealtime() {
  const setNodes = useVoxelStore((s) => s.setNodes);
  const addNode = useVoxelStore((s) => s.addNode);
  const updateNode = useVoxelStore((s) => s.updateNode);
  const removeNode = useVoxelStore((s) => s.removeNode);

  useEffect(() => {
    const orgId = getCurrentOrgId();
    const unsubscribers: Unsubscribe[] = [];

    // Subscribe to each collection
    const collections = ['assets', 'risks', 'projects', 'audits', 'incidents', 'suppliers', 'controls'];

    collections.forEach((collectionName) => {
      const q = query(
        collection(db, collectionName),
        where('organizationId', '==', orgId)
      );

      const unsub = onSnapshot(q, {
        next: (snapshot) => {
          const changes = snapshot.docChanges();

          // Debounce batch updates
          debouncedBatchUpdate(changes, collectionName);
        },
        error: (error) => {
          console.error(`Realtime error on ${collectionName}:`, error);
          // Fallback to polling
          enablePollingFallback(collectionName);
        },
      });

      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);
}

// Debounce to avoid render thrashing
const debouncedBatchUpdate = debounce((changes: DocumentChange[], type: string) => {
  const store = useVoxelStore.getState();

  changes.forEach((change) => {
    const node = mapToVoxelNode(change.doc.data(), type);

    switch (change.type) {
      case 'added':
        store.addNode(node);
        animateNodeIn(node.id);
        break;
      case 'modified':
        store.updateNode(node.id, node);
        highlightNodeChange(node.id);
        break;
      case 'removed':
        animateNodeOut(node.id).then(() => {
          store.removeNode(node.id);
        });
        break;
    }
  });
}, 100); // 100ms debounce
```

**Conséquences:**
- Latence <500ms pour sync
- Coût Firestore: ~$0.06/100K reads
- Offline support via persistence cache

---

### ADR-VOXEL-002: Anomaly Detection Engine

**Contexte:** Le système doit détecter automatiquement les incohérences et problèmes.

**Décision:** Hybrid approach - Cloud Function (scheduled) + Client-side (reactive).

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                   ANOMALY DETECTION ENGINE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SERVER-SIDE (Cloud Function - every 15min)                     │
│  ├─ Heavy computations (graph analysis, ML)                     │
│  ├─ Cross-collection queries                                    │
│  ├─ Historical comparison                                       │
│  └─ Writes to `anomalies` collection                            │
│                                                                 │
│  CLIENT-SIDE (Web Worker - on data change)                      │
│  ├─ Simple rule checks (orphans, stale)                         │
│  ├─ Real-time highlighting                                      │
│  ├─ No writes (display only)                                    │
│  └─ Merges with server anomalies                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Anomaly Types & Detection:**
```typescript
// anomalyDetector.ts
interface AnomalyRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: AnomalyType;
  detect: (data: VoxelData) => Anomaly[];
}

const ANOMALY_RULES: AnomalyRule[] = [
  // Orphan detection
  {
    id: 'orphan-asset',
    name: 'Asset sans contrôle',
    severity: 'high',
    type: 'orphan',
    detect: (data) => {
      const assetsWithControls = new Set(
        data.controls.flatMap(c => c.relatedAssetIds || [])
      );
      return data.assets
        .filter(a => !assetsWithControls.has(a.id))
        .map(a => ({
          id: `orphan-asset-${a.id}`,
          type: 'orphan',
          severity: 'high',
          entityId: a.id,
          entityType: 'asset',
          message: `Asset "${a.name}" sans contrôle de sécurité`,
          detectedAt: new Date(),
        }));
    },
  },

  // Stale detection
  {
    id: 'stale-control',
    name: 'Contrôle périmé',
    severity: 'high',
    type: 'stale',
    detect: (data) => {
      const cutoff = subDays(new Date(), 90);
      return data.controls
        .filter(c => new Date(c.lastUpdated) < cutoff)
        .map(c => ({
          id: `stale-control-${c.id}`,
          type: 'stale',
          severity: 'high',
          entityId: c.id,
          entityType: 'control',
          message: `Contrôle "${c.name}" non revu depuis >90 jours`,
          detectedAt: new Date(),
          metadata: { lastUpdated: c.lastUpdated },
        }));
    },
  },

  // Inconsistency detection
  {
    id: 'risk-severity-mismatch',
    name: 'Score risque incohérent',
    severity: 'medium',
    type: 'inconsistency',
    detect: (data) => {
      return data.risks
        .filter(r => {
          const relatedAsset = data.assets.find(a => a.id === r.assetId);
          if (!relatedAsset) return false;
          // Risk score should correlate with asset criticality
          const expectedMinScore = relatedAsset.criticality * 3;
          return r.score < expectedMinScore;
        })
        .map(r => ({
          id: `mismatch-${r.id}`,
          type: 'inconsistency',
          severity: 'medium',
          entityId: r.id,
          entityType: 'risk',
          message: `Score risque potentiellement sous-évalué`,
          detectedAt: new Date(),
        }));
    },
  },

  // Circular dependency detection
  {
    id: 'circular-dep',
    name: 'Dépendance circulaire',
    severity: 'critical',
    type: 'cycle',
    detect: (data) => {
      const graph = buildDependencyGraph(data);
      const cycles = detectCycles(graph); // DFS-based
      return cycles.map((cycle, i) => ({
        id: `cycle-${i}`,
        type: 'cycle',
        severity: 'critical',
        entityId: cycle[0],
        entityType: 'mixed',
        message: `Dépendance circulaire détectée: ${cycle.join(' → ')}`,
        detectedAt: new Date(),
        metadata: { cycle },
      }));
    },
  },

  // Open incident too long
  {
    id: 'stale-incident',
    name: 'Incident ouvert trop longtemps',
    severity: 'high',
    type: 'stale',
    detect: (data) => {
      const cutoff = subDays(new Date(), 30);
      return data.incidents
        .filter(i => i.status !== 'Fermé' && new Date(i.dateReported) < cutoff)
        .map(i => ({
          id: `stale-incident-${i.id}`,
          type: 'stale',
          severity: 'high',
          entityId: i.id,
          entityType: 'incident',
          message: `Incident "${i.title}" ouvert depuis >30 jours`,
          detectedAt: new Date(),
        }));
    },
  },

  // Critical supplier without SLA
  {
    id: 'supplier-no-sla',
    name: 'Fournisseur critique sans SLA',
    severity: 'high',
    type: 'missing_data',
    detect: (data) => {
      return data.suppliers
        .filter(s => s.criticality === 'high' && !s.slaDocument)
        .map(s => ({
          id: `no-sla-${s.id}`,
          type: 'missing_data',
          severity: 'high',
          entityId: s.id,
          entityType: 'supplier',
          message: `Fournisseur critique "${s.name}" sans SLA documenté`,
          detectedAt: new Date(),
        }));
    },
  },
];
```

**Cloud Function:**
```typescript
// detectAnomalies.ts (Cloud Function)
export const detectAnomalies = onSchedule('*/15 * * * *', async () => {
  const orgs = await db.collection('organizations').get();

  for (const org of orgs.docs) {
    const orgId = org.id;

    // Load all data for org
    const data = await loadOrgData(orgId);

    // Run all detection rules
    const anomalies: Anomaly[] = [];
    for (const rule of ANOMALY_RULES) {
      const detected = rule.detect(data);
      anomalies.push(...detected);
    }

    // Compare with existing anomalies
    const existing = await db.collection('anomalies')
      .where('organizationId', '==', orgId)
      .where('status', '==', 'active')
      .get();

    const existingIds = new Set(existing.docs.map(d => d.id));
    const newAnomalies = anomalies.filter(a => !existingIds.has(a.id));
    const resolvedAnomalies = existing.docs
      .filter(d => !anomalies.some(a => a.id === d.id));

    // Write new anomalies
    const batch = db.batch();
    for (const anomaly of newAnomalies) {
      batch.set(db.collection('anomalies').doc(anomaly.id), {
        ...anomaly,
        organizationId: orgId,
        status: 'active',
      });
    }

    // Mark resolved
    for (const resolved of resolvedAnomalies) {
      batch.update(resolved.ref, {
        status: 'resolved',
        resolvedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    // Alert on critical new anomalies
    const criticals = newAnomalies.filter(a => a.severity === 'critical');
    if (criticals.length > 0) {
      await sendAnomalyAlert(orgId, criticals);
    }
  }
});
```

---

### ADR-VOXEL-003: Blast Radius Simulation

**Contexte:** Les utilisateurs doivent pouvoir simuler l'impact en cascade d'un incident.

**Décision:** Weighted BFS algorithm exécuté dans un Web Worker.

**Algorithm:**
```typescript
// blastRadiusWorker.ts
interface BlastRadiusConfig {
  startNodeId: string;
  maxDepth: number;
  includeIndirect: boolean;
  simulateFailure?: string[]; // Optional: simulate control failure
}

interface BlastRadiusResult {
  impactedNodes: Array<{
    id: string;
    type: string;
    depth: number; // Hops from source
    impactLevel: 'direct' | 'indirect' | 'potential';
    probability: number; // 0-1
    path: string[]; // Chain of nodes
    estimatedMTTR?: number; // Mean time to recover
  }>;
  totalImpact: {
    assets: number;
    risks: number;
    suppliers: number;
    estimatedDowntime: string;
    businessImpact: 'low' | 'medium' | 'high' | 'critical';
  };
  mitigationSuggestions: string[];
}

function calculateBlastRadius(
  nodes: VoxelNode[],
  edges: Edge[],
  config: BlastRadiusConfig
): BlastRadiusResult {
  const adjacencyList = buildAdjacencyList(nodes, edges);
  const visited = new Map<string, { depth: number; path: string[]; probability: number }>();
  const queue: Array<{ id: string; depth: number; path: string[]; probability: number }> = [
    { id: config.startNodeId, depth: 0, path: [], probability: 1.0 }
  ];

  while (queue.length > 0) {
    const { id, depth, path, probability } = queue.shift()!;

    if (visited.has(id) || depth > config.maxDepth) continue;
    if (probability < 0.1) continue; // Ignore very low probability impacts

    visited.set(id, { depth, path: [...path, id], probability });

    // Get neighbors and their edge weights
    const neighbors = adjacencyList.get(id) || [];
    for (const { targetId, weight } of neighbors) {
      const connectionProbability = calculatePropagationProbability(
        nodes.find(n => n.id === id)!,
        nodes.find(n => n.id === targetId)!,
        weight
      );

      queue.push({
        id: targetId,
        depth: depth + 1,
        path: [...path, id],
        probability: probability * connectionProbability,
      });
    }

    // Sort by probability (highest first)
    queue.sort((a, b) => b.probability - a.probability);
  }

  // Transform results
  const impactedNodes = Array.from(visited.entries()).map(([id, info]) => {
    const node = nodes.find(n => n.id === id)!;
    return {
      id,
      type: node.type,
      depth: info.depth,
      impactLevel: info.depth === 0 ? 'direct' as const :
                   info.depth === 1 ? 'direct' as const :
                   info.depth <= 2 ? 'indirect' as const : 'potential' as const,
      probability: info.probability,
      path: info.path,
      estimatedMTTR: estimateMTTR(node),
    };
  });

  return {
    impactedNodes,
    totalImpact: calculateTotalImpact(impactedNodes, nodes),
    mitigationSuggestions: generateMitigationSuggestions(impactedNodes, nodes),
  };
}

function calculatePropagationProbability(
  source: VoxelNode,
  target: VoxelNode,
  edgeWeight: number
): number {
  // Base probability from edge weight
  let prob = edgeWeight;

  // Adjust based on source severity
  if (source.type === 'risk') {
    prob *= (source.data as Risk).score / 20; // Max score 20
  }

  // Adjust based on target type
  const typeMultipliers: Record<string, number> = {
    asset: 0.9,
    risk: 0.7,
    supplier: 0.6,
    control: 0.4,
    project: 0.3,
  };
  prob *= typeMultipliers[target.type] || 0.5;

  return Math.min(prob, 1.0);
}
```

**Web Worker Integration:**
```typescript
// useBlastRadius.ts
export function useBlastRadius() {
  const workerRef = useRef<Worker | null>(null);
  const [result, setResult] = useState<BlastRadiusResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/blastRadiusWorker.ts', import.meta.url)
    );

    workerRef.current.onmessage = (e) => {
      setResult(e.data);
      setIsSimulating(false);
    };

    return () => workerRef.current?.terminate();
  }, []);

  const simulate = useCallback((config: BlastRadiusConfig) => {
    const { nodes, edges } = useVoxelStore.getState();
    setIsSimulating(true);
    workerRef.current?.postMessage({ nodes, edges, config });
  }, []);

  return { simulate, result, isSimulating };
}
```

---

### ADR-VOXEL-004: Performance Optimization Strategy

**Contexte:** Le moteur 3D doit maintenir 60fps avec 5000+ nœuds.

**Décision:** Multi-layered optimization approach.

**Strategies:**
```typescript
// Performance optimizations

// 1. INSTANCED RENDERING
// Instead of 1000 mesh objects, use 1 instanced mesh
const AssetNodesInstanced: React.FC<{ assets: Asset[] }> = ({ assets }) => {
  const meshRef = useRef<InstancedMesh>(null);
  const tempObject = useMemo(() => new Object3D(), []);

  useFrame(() => {
    assets.forEach((asset, i) => {
      tempObject.position.set(asset.position.x, asset.position.y, asset.position.z);
      tempObject.scale.setScalar(asset.size);
      tempObject.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.matrix);
    });
    meshRef.current!.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, assets.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3b82f6" />
    </instancedMesh>
  );
};

// 2. LEVEL OF DETAIL (LOD)
const VoxelNodeLOD: React.FC<{ node: VoxelNode }> = ({ node }) => {
  const { camera } = useThree();
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    const distance = camera.position.distanceTo(meshRef.current!.position);
    const lod = distance < 10 ? 'high' : distance < 30 ? 'medium' : 'low';
    setCurrentLOD(lod);
  });

  return (
    <mesh ref={meshRef} position={node.position}>
      {currentLOD === 'high' && <detailedGeometry />}
      {currentLOD === 'medium' && <simplifiedGeometry />}
      {currentLOD === 'low' && <sphereGeometry args={[0.5, 8, 8]} />}
    </mesh>
  );
};

// 3. FRUSTUM CULLING (built into Three.js, ensure enabled)
// Already default behavior, but verify:
mesh.frustumCulled = true;

// 4. WEB WORKERS FOR HEAVY COMPUTATIONS
// Layout calculation, anomaly detection, blast radius
// See ADR-VOXEL-003 for worker pattern

// 5. DEBOUNCED STATE UPDATES
const debouncedSetNodes = useMemo(
  () => debounce(setNodes, 50),
  [setNodes]
);

// 6. REACT.MEMO FOR STATIC COMPONENTS
const VoxelNode = React.memo(({ node }: { node: VoxelNode }) => {
  // Render node
}, (prev, next) => prev.node.id === next.node.id && prev.node.version === next.node.version);

// 7. DISPOSE RESOURCES ON UNMOUNT
useEffect(() => {
  return () => {
    geometry.dispose();
    material.dispose();
    texture?.dispose();
  };
}, []);
```

**Performance Targets:**
| Metric | 500 nodes | 2000 nodes | 5000 nodes | 10000 nodes |
|--------|-----------|------------|------------|-------------|
| FPS | 60 | 60 | 45 | 30 |
| Memory | 150MB | 300MB | 600MB | 1.2GB |
| Init time | 500ms | 1s | 2s | 4s |
| Sync latency | 100ms | 200ms | 400ms | 800ms |

---

### ADR-VOXEL-005: State Management Architecture

**Contexte:** L'état de Voxel est complexe: nodes, selections, filters, animations, anomalies, etc.

**Décision:** Zustand avec slices séparés.

**Store Structure:**
```typescript
// voxelStore.ts
interface VoxelState {
  // Core data
  nodes: Map<string, VoxelNode>;
  edges: Edge[];
  anomalies: Anomaly[];

  // UI state
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  filters: {
    layers: Set<LayerType>;
    searchQuery: string;
    minScore: number;
    showAnomaliesOnly: boolean;
  };

  // View state
  currentView: ViewPreset;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];

  // Real-time state
  syncStatus: 'connected' | 'syncing' | 'offline';
  lastSyncAt: Date | null;

  // Simulation state
  blastRadiusResult: BlastRadiusResult | null;
  isSimulating: boolean;

  // Analytics state
  snapshots: DailySnapshot[];
  selectedTimeRange: 'week' | 'month' | 'quarter' | 'year';

  // Actions
  setNodes: (nodes: VoxelNode[]) => void;
  addNode: (node: VoxelNode) => void;
  updateNode: (id: string, updates: Partial<VoxelNode>) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  setFilters: (filters: Partial<VoxelState['filters']>) => void;
  setView: (preset: ViewPreset) => void;
  // ... more actions
}

const useVoxelStore = create<VoxelState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        nodes: new Map(),
        edges: [],
        anomalies: [],
        selectedNodeId: null,
        hoveredNodeId: null,
        filters: {
          layers: new Set(['asset', 'risk', 'project', 'audit', 'incident', 'supplier', 'control']),
          searchQuery: '',
          minScore: 0,
          showAnomaliesOnly: false,
        },
        currentView: 'rssi',
        cameraPosition: [0, 20, 50],
        cameraTarget: [0, 0, 0],
        syncStatus: 'offline',
        lastSyncAt: null,
        blastRadiusResult: null,
        isSimulating: false,
        snapshots: [],
        selectedTimeRange: 'month',

        // Actions
        setNodes: (nodes) => set({
          nodes: new Map(nodes.map(n => [n.id, n])),
          edges: computeEdges(nodes),
        }),

        addNode: (node) => set((state) => {
          const nodes = new Map(state.nodes);
          nodes.set(node.id, node);
          return { nodes, edges: computeEdges(Array.from(nodes.values())) };
        }),

        updateNode: (id, updates) => set((state) => {
          const nodes = new Map(state.nodes);
          const existing = nodes.get(id);
          if (existing) {
            nodes.set(id, { ...existing, ...updates });
          }
          return { nodes };
        }),

        removeNode: (id) => set((state) => {
          const nodes = new Map(state.nodes);
          nodes.delete(id);
          return {
            nodes,
            edges: computeEdges(Array.from(nodes.values())),
            selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
          };
        }),

        selectNode: (id) => set({ selectedNodeId: id }),

        setFilters: (filters) => set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

        setView: (preset) => set({
          currentView: preset,
          ...VIEW_PRESETS[preset], // Apply preset's filters and camera
        }),
      }),
      {
        name: 'voxel-storage',
        partialize: (state) => ({
          filters: state.filters,
          currentView: state.currentView,
          cameraPosition: state.cameraPosition,
          cameraTarget: state.cameraTarget,
          selectedTimeRange: state.selectedTimeRange,
        }),
      }
    )
  )
);
```

---

### ADR-VOXEL-006: View Presets System

**Contexte:** Chaque rôle a des besoins de visualisation différents.

**Décision:** Presets configurables avec URL state sharing.

**Implementation:**
```typescript
// viewPresets.ts
interface ViewPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  role: Role[];
  config: {
    layers: LayerType[];
    filters: {
      minRiskScore?: number;
      severityFilter?: Severity[];
      timeRange?: 'day' | 'week' | 'month';
      showAnomaliesOnly?: boolean;
    };
    camera: {
      position: [number, number, number];
      target: [number, number, number];
      fov: number;
    };
    display: {
      heatmapEnabled: boolean;
      connectionsVisible: boolean;
      labelsVisible: boolean;
      gridVisible: boolean;
    };
    layout: 'default' | 'hierarchical' | 'radial' | 'timeline';
  };
}

const VIEW_PRESETS: Record<string, ViewPreset> = {
  executive: {
    id: 'executive',
    name: 'Vue Direction',
    description: 'KPIs et top risques uniquement',
    icon: '👔',
    role: ['admin', 'super_admin'],
    config: {
      layers: ['risk', 'incident'],
      filters: {
        minRiskScore: 15,
        showAnomaliesOnly: false,
      },
      camera: {
        position: [0, 40, 60],
        target: [0, 0, 0],
        fov: 50,
      },
      display: {
        heatmapEnabled: true,
        connectionsVisible: false,
        labelsVisible: true,
        gridVisible: false,
      },
      layout: 'default',
    },
  },

  rssi: {
    id: 'rssi',
    name: 'Vue RSSI',
    description: 'Risques, incidents, et dépendances',
    icon: '🛡️',
    role: ['rssi', 'admin'],
    config: {
      layers: ['asset', 'risk', 'incident', 'control'],
      filters: {
        minRiskScore: 0,
      },
      camera: {
        position: [0, 25, 45],
        target: [0, 0, 0],
        fov: 60,
      },
      display: {
        heatmapEnabled: true,
        connectionsVisible: true,
        labelsVisible: true,
        gridVisible: true,
      },
      layout: 'default',
    },
  },

  auditor: {
    id: 'auditor',
    name: 'Vue Auditeur',
    description: 'Focus contrôles et couverture',
    icon: '📋',
    role: ['auditor', 'rssi', 'admin'],
    config: {
      layers: ['asset', 'control', 'audit'],
      filters: {},
      camera: {
        position: [0, 30, 50],
        target: [0, 5, 0],
        fov: 55,
      },
      display: {
        heatmapEnabled: false,
        connectionsVisible: true,
        labelsVisible: true,
        gridVisible: true,
      },
      layout: 'hierarchical',
    },
  },

  soc: {
    id: 'soc',
    name: 'Vue SOC Live',
    description: 'Incidents temps réel 24/7',
    icon: '🚨',
    role: ['rssi', 'admin'],
    config: {
      layers: ['asset', 'incident'],
      filters: {
        timeRange: 'day',
      },
      camera: {
        position: [0, 15, 35],
        target: [0, 5, 0],
        fov: 65,
      },
      display: {
        heatmapEnabled: true,
        connectionsVisible: true,
        labelsVisible: true,
        gridVisible: false,
      },
      layout: 'timeline',
    },
  },

  compliance: {
    id: 'compliance',
    name: 'Vue Conformité',
    description: 'Contrôles par framework',
    icon: '✅',
    role: ['auditor', 'rssi', 'admin'],
    config: {
      layers: ['control', 'audit', 'asset'],
      filters: {},
      camera: {
        position: [0, 35, 55],
        target: [0, 0, 0],
        fov: 50,
      },
      display: {
        heatmapEnabled: false,
        connectionsVisible: true,
        labelsVisible: true,
        gridVisible: true,
      },
      layout: 'radial',
    },
  },
};

// URL State Sharing
function encodeViewState(state: Partial<ViewPreset['config']>): string {
  return btoa(JSON.stringify(state));
}

function decodeViewState(encoded: string): Partial<ViewPreset['config']> {
  return JSON.parse(atob(encoded));
}

// Generate shareable URL
function getShareableUrl(): string {
  const state = useVoxelStore.getState();
  const encoded = encodeViewState({
    layers: Array.from(state.filters.layers),
    filters: state.filters,
    camera: {
      position: state.cameraPosition,
      target: state.cameraTarget,
      fov: 60,
    },
    display: {
      heatmapEnabled: state.heatmapEnabled,
      connectionsVisible: state.connectionsVisible,
      labelsVisible: state.labelsVisible,
      gridVisible: state.gridVisible,
    },
  });

  return `${window.location.origin}/voxel?view=${encoded}`;
}
```

---

## 5. Data Model Extensions

### 5.1 New Collections

```typescript
// Firestore Collections

// anomalies - Detected issues
interface Anomaly {
  id: string;
  organizationId: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  entityId: string;
  entityType: LayerType;
  message: string;
  detectedAt: Timestamp;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledgedBy?: string;
  acknowledgedAt?: Timestamp;
  resolvedAt?: Timestamp;
  dismissedReason?: string;
  metadata?: Record<string, any>;
}

// daily_snapshots - Historical metrics
interface DailySnapshot {
  id: string; // YYYY-MM-DD
  organizationId: string;
  date: string;
  metrics: {
    totalAssets: number;
    totalRisks: number;
    criticalRisks: number;
    avgRiskScore: number;
    openIncidents: number;
    controlCoverage: number; // 0-100%
    dataHealthScore: number; // 0-100%
    anomaliesCount: number;
  };
  topRisks: Array<{ id: string; name: string; score: number }>;
  topAnomalies: Array<{ id: string; type: string; severity: string }>;
  createdAt: Timestamp;
}

// voxel_alerts - Alert history
interface VoxelAlert {
  id: string;
  organizationId: string;
  type: 'anomaly' | 'trend' | 'incident' | 'blast_radius';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  relatedEntityId?: string;
  relatedEntityType?: LayerType;
  channels: ('in_app' | 'email' | 'slack' | 'teams')[];
  sentAt: Timestamp;
  acknowledgedAt?: Timestamp;
  acknowledgedBy?: string;
}

// voxel_user_settings - Per-user preferences
interface VoxelUserSettings {
  userId: string;
  organizationId: string;
  defaultView: string;
  customViews: ViewPreset[];
  alertPreferences: {
    anomalyCritical: boolean;
    anomalyHigh: boolean;
    trendNegative: boolean;
    newIncident: boolean;
    channels: ('in_app' | 'email' | 'slack')[];
  };
  savedCameraPositions: Array<{
    name: string;
    position: [number, number, number];
    target: [number, number, number];
  }>;
}
```

---

## 6. Cloud Functions

### 6.1 Scheduled Functions

```typescript
// detectAnomalies - Every 15 minutes
export const detectAnomalies = onSchedule('*/15 * * * *', async () => {
  // See ADR-VOXEL-002 for implementation
});

// createDailySnapshot - Daily at midnight
export const createDailySnapshot = onSchedule('0 0 * * *', async () => {
  const orgs = await db.collection('organizations').get();

  for (const org of orgs.docs) {
    const orgId = org.id;
    const data = await loadOrgData(orgId);

    const snapshot: DailySnapshot = {
      id: format(new Date(), 'yyyy-MM-dd'),
      organizationId: orgId,
      date: format(new Date(), 'yyyy-MM-dd'),
      metrics: {
        totalAssets: data.assets.length,
        totalRisks: data.risks.length,
        criticalRisks: data.risks.filter(r => r.score >= 15).length,
        avgRiskScore: average(data.risks.map(r => r.score)),
        openIncidents: data.incidents.filter(i => i.status !== 'Fermé').length,
        controlCoverage: calculateControlCoverage(data),
        dataHealthScore: calculateDataHealth(data),
        anomaliesCount: (await db.collection('anomalies')
          .where('organizationId', '==', orgId)
          .where('status', '==', 'active')
          .get()).size,
      },
      topRisks: data.risks
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(r => ({ id: r.id, name: r.name, score: r.score })),
      topAnomalies: [], // Filled from anomalies collection
      createdAt: FieldValue.serverTimestamp(),
    };

    await db.collection('daily_snapshots').doc(`${orgId}_${snapshot.id}`).set(snapshot);
  }
});

// cleanupOldSnapshots - Monthly
export const cleanupOldSnapshots = onSchedule('0 0 1 * *', async () => {
  const oneYearAgo = subYears(new Date(), 1);
  const oldSnapshots = await db.collection('daily_snapshots')
    .where('date', '<', format(oneYearAgo, 'yyyy-MM-dd'))
    .get();

  const batch = db.batch();
  oldSnapshots.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
});
```

### 6.2 Trigger Functions

```typescript
// alertOnCriticalAnomaly - Firestore trigger
export const alertOnCriticalAnomaly = onDocumentCreated(
  'anomalies/{anomalyId}',
  async (event) => {
    const anomaly = event.data?.data() as Anomaly;
    if (anomaly.severity !== 'critical') return;

    const org = await db.collection('organizations').doc(anomaly.organizationId).get();
    const alertRecipients = await getAlertRecipients(anomaly.organizationId, 'anomalyCritical');

    for (const recipient of alertRecipients) {
      await sendAlert({
        userId: recipient.id,
        type: 'anomaly',
        title: `Anomalie critique détectée`,
        message: anomaly.message,
        severity: 'critical',
        relatedEntityId: anomaly.entityId,
        relatedEntityType: anomaly.entityType,
      });
    }
  }
);

// alertOnNewIncident - Firestore trigger
export const alertOnNewIncident = onDocumentCreated(
  'incidents/{incidentId}',
  async (event) => {
    const incident = event.data?.data() as Incident;
    if (incident.severity !== 'Critique') return;

    const alertRecipients = await getAlertRecipients(incident.organizationId, 'newIncident');

    for (const recipient of alertRecipients) {
      await sendAlert({
        userId: recipient.id,
        type: 'incident',
        title: `Nouvel incident critique: ${incident.title}`,
        message: incident.description,
        severity: 'critical',
        relatedEntityId: incident.id,
        relatedEntityType: 'incident',
      });
    }
  }
);
```

---

## 7. Component Architecture

### 7.1 Component Tree

```
VoxelView (Smart Container)
├── VoxelHeader
│   ├── ViewSelector
│   ├── TimeRangeSelector
│   ├── SearchInput
│   └── ActionButtons (Export, Share, Settings)
│
├── VoxelCanvas (R3F Canvas)
│   ├── VoxelStudio
│   │   ├── SceneSetup (lights, camera, controls)
│   │   ├── NodesLayer
│   │   │   ├── AssetNodesInstanced
│   │   │   ├── RiskNodesInstanced
│   │   │   ├── ProjectNodesInstanced
│   │   │   ├── AuditNodesInstanced
│   │   │   ├── IncidentNodesInstanced
│   │   │   ├── SupplierNodesInstanced
│   │   │   └── ControlNodesInstanced
│   │   ├── EdgesLayer
│   │   │   ├── ConnectionLines
│   │   │   └── DataFlowParticles
│   │   ├── AnomalyOverlay (pulsing halos)
│   │   ├── BlastRadiusOverlay (impact waves)
│   │   └── SelectionHighlight
│   └── CameraController
│
├── VoxelSidebar
│   ├── LayerToggles
│   ├── FilterControls
│   ├── AnomalyList
│   ├── NodeList
│   └── AnalyticsPreview
│
├── VoxelDetailPanel (Draggable)
│   ├── NodeDetails
│   ├── ConnectionsTab
│   ├── HistoryTab
│   └── ActionsTab
│
├── VoxelAnomalyPanel
│   ├── AnomalySummary
│   ├── AnomalyList
│   └── AnomalyActions
│
├── VoxelTimelinePanel
│   ├── TimeSlider
│   ├── MetricsChart
│   └── SnapshotComparison
│
└── VoxelAlertToast
```

---

## 8. Testing Strategy

### 8.1 Test Categories

| Category | Coverage | Focus |
|----------|----------|-------|
| Unit (Services) | 80% | Anomaly rules, calculations |
| Unit (Workers) | 90% | Blast radius, layout |
| Integration | 70% | Realtime sync, Cloud Functions |
| Visual Regression | Key views | Consistent rendering |
| Performance | Critical paths | FPS, memory, latency |
| E2E | User journeys | View switching, simulation |

### 8.2 Key Test Cases

```typescript
describe('AnomalyDetection', () => {
  test('detects orphaned assets without controls');
  test('detects stale controls >90 days');
  test('detects circular dependencies');
  test('handles empty datasets gracefully');
  test('respects organization isolation');
});

describe('BlastRadius', () => {
  test('calculates direct impact correctly');
  test('propagates through dependencies');
  test('respects max depth limit');
  test('handles cycles without infinite loop');
  test('calculates probability correctly');
});

describe('RealtimeSync', () => {
  test('receives new nodes within 2s');
  test('handles disconnection gracefully');
  test('debounces rapid updates');
  test('maintains consistency after reconnect');
});

describe('Performance', () => {
  test('maintains 30fps with 5000 nodes');
  test('memory stays under 800MB');
  test('initial render under 2s');
});
```

---

## 9. Observability

### 9.1 Metrics

```typescript
const VOXEL_METRICS = [
  // Performance
  'voxel.render.fps',
  'voxel.render.frame_time_ms',
  'voxel.memory.heap_mb',
  'voxel.nodes.count',

  // Real-time
  'voxel.sync.latency_ms',
  'voxel.sync.status',
  'voxel.sync.events_per_minute',

  // Anomalies
  'voxel.anomalies.active.count',
  'voxel.anomalies.detected.total',
  'voxel.anomalies.by_severity',
  'voxel.anomalies.by_type',

  // User engagement
  'voxel.views.switches',
  'voxel.simulations.run',
  'voxel.exports.count',
  'voxel.session.duration_minutes',
];
```

### 9.2 Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| FPS drop | <20fps for >30s | Warning |
| Memory spike | >1.5GB | Warning |
| Sync failure | Disconnected >1min | High |
| Anomaly detection failure | Function error | Critical |
| Critical anomaly | New severity=critical | Critical |

---

## 10. Migration Strategy

### 10.1 Phases

```
Phase 1: Real-time Foundation (Sprint 1-2)
├─ Implement Firestore listeners
├─ Add Zustand store
├─ Node add/remove animations
└─ Sync status indicator

Phase 2: Anomaly Detection (Sprint 3-4)
├─ Cloud Function for detection
├─ Anomaly collection
├─ UI overlay for anomalies
└─ Alert system integration

Phase 3: Analytics (Sprint 5-7)
├─ Daily snapshot Cloud Function
├─ Time machine UI
├─ Trends charts
└─ Predictions (basic)

Phase 4: Performance & Polish (Sprint 8-10)
├─ Instanced rendering
├─ Web Workers
├─ View presets
└─ Export features

Phase 5: Advanced Features (Sprint 11-12)
├─ Blast radius simulation
├─ Root cause analysis
├─ Annotations
└─ AR/VR foundation
```

---

## 11. Appendix

### A. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `1-5` | Switch view preset |
| `A` | Toggle anomaly mode |
| `B` | Simulate blast radius |
| `T` | Toggle time machine |
| `R` | Reset camera |
| `F` | Fit all to view |
| `S` | Screenshot |
| `Esc` | Deselect |
| `?` | Help |

### B. Performance Benchmarks

| Operation | Target | Measurement Method |
|-----------|--------|-------------------|
| Initial load | <2s | Performance.now() |
| Sync latency | <500ms | onSnapshot timestamp diff |
| Anomaly detection | <5s | Cloud Function duration |
| Blast simulation | <1s | Worker message round-trip |
| View switch | <200ms | Animation frame count |

### C. External Dependencies

- `three` ^0.170.0
- `@react-three/fiber` ^9.0.0
- `@react-three/drei` ^9.120.0
- `zustand` ^5.0.1
- `firebase` ^11.0.2

---

**Document validé par:** Architecte + Thibaultllopis
**Statut:** Ready for Implementation
**Prochaine étape:** Création des Epics & Stories
