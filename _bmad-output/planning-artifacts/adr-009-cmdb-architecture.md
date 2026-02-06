# ADR-009: Architecture Module CMDB

---

**Status:** PROPOSED
**Date:** 2026-02-06
**Deciders:** Thibaultllopis, Architecture Team
**Technical Story:** Module CMDB pour Sentinel GRC v2

---

## Context

Sentinel GRC v2 possède un module Assets et un agent Rust collectant des données système, mais sans CMDB (Configuration Management Database) intégrée. L'objectif est de transformer l'inventaire existant en une CMDB ITIL 4 compliant avec découverte automatique, réconciliation et analyse d'impact.

### Contraintes Existantes

1. **Stack Frontend:** React 19 + TypeScript strict + Zustand
2. **Backend:** Firebase Firestore (NoSQL, pas de graph database native)
3. **Agent:** Rust, synchronisation via Firebase
4. **Multi-tenant:** Isolation stricte par organizationId
5. **Design System:** Apple-style avec Tailwind CSS

---

## Decision Drivers

1. **Performance:** Réconciliation < 500ms/CI, Impact analysis < 2s
2. **Scalabilité:** Support > 100,000 CIs par organisation
3. **Maintenabilité:** Réutilisation maximale du code existant
4. **UX:** Intégration seamless avec VoxelEngine pour visualisation
5. **Conformité:** ITIL 4, NIS2, DORA

---

## Considered Options

### Option 1: Extension du Module Assets Existant

**Description:** Ajouter les fonctionnalités CMDB directement dans le module Assets existant.

**Pros:**
- Pas de migration de données
- Moins de code à maintenir
- Continuité UX

**Cons:**
- Modèle de données limité (pas de relations first-class)
- Couplage fort avec la logique Assets
- Scalabilité limitée
- Non-conforme ITIL 4 (Asset ≠ CI)

### Option 2: Module CMDB Séparé avec Migration

**Description:** Créer un module CMDB dédié avec nouvelles collections Firestore et migration des Assets vers CIs.

**Pros:**
- Modèle de données propre et extensible
- Séparation des responsabilités
- Conforme ITIL 4
- Scalable indépendamment

**Cons:**
- Migration complexe
- Coût de développement initial plus élevé
- Période de transition avec deux systèmes

### Option 3: Graph Database (Neo4j/Dgraph)

**Description:** Ajouter une graph database pour les relations CMDB.

**Pros:**
- Performance optimale pour traversal
- Requêtes de relations natives
- Analyse d'impact ultra-rapide

**Cons:**
- Complexité opérationnelle (nouveau service à gérer)
- Coût infrastructure
- Sync bidirectionnelle avec Firestore
- Non-cohérent avec le stack existant

---

## Decision

**Option retenue: Option 2 - Module CMDB Séparé avec Migration**

### Justification

1. **Séparation propre** entre Asset Management (gestion financière/lifecycle) et Configuration Management (technique/dépendances)
2. **Modèle extensible** pour futures fonctionnalités (ITSM, Change Management)
3. **Migration douce** avec `legacyAssetId` pour maintenir la compatibilité
4. **Réutilisation Firestore** sans ajouter de complexité infrastructure

---

## Architecture Decision Records

### AD-001: Modèle de Données CI

```typescript
// Collection: cmdb_cis
interface ConfigurationItem {
  id: string;                          // Auto-generated
  organizationId: string;              // Multi-tenant (OBLIGATOIRE)

  // Classification
  ciClass: 'Hardware' | 'Software' | 'Service' | 'Document' | 'Network' | 'Cloud' | 'Container';
  ciType: string;                      // Sous-type spécifique

  // Identification (pour réconciliation)
  fingerprint: {
    serialNumber?: string;
    primaryMacAddress?: string;
    hostname?: string;
    fqdn?: string;
    osFingerprint?: string;
    cloudInstanceId?: string;
  };

  // Core attributes
  name: string;
  description?: string;
  status: 'In_Stock' | 'In_Use' | 'In_Maintenance' | 'Retired' | 'Missing';
  environment: 'Production' | 'Staging' | 'Development' | 'Test' | 'DR';
  criticality: 'Critical' | 'High' | 'Medium' | 'Low';

  // Ownership
  ownerId: string;
  supportGroupId?: string;

  // Quality & Discovery
  dataQualityScore: number;            // 0-100
  discoverySource: 'Agent' | 'Manual' | 'Import' | 'Cloud' | 'Network_Scan';
  sourceAgentId?: string;
  lastDiscoveredAt?: Timestamp;
  lastReconciliationAt?: Timestamp;

  // Legacy link
  legacyAssetId?: string;

  // Class-specific (polymorphic)
  attributes: Record<string, unknown>;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}
```

**Rationale:**
- `fingerprint` séparé pour matching performance
- `attributes` flexible pour attributs class-specific
- `legacyAssetId` pour migration douce
- `dataQualityScore` pour monitoring qualité CMDB

### AD-002: Modèle de Relations

```typescript
// Collection: cmdb_relationships
interface CMDBRelationship {
  id: string;
  organizationId: string;

  // Endpoints
  sourceId: string;
  sourceCIClass: CIClass;
  targetId: string;
  targetCIClass: CIClass;

  // Relation type
  relationshipType: RelationshipType;
  direction: 'unidirectional' | 'bidirectional';
  inverseType?: RelationshipType;      // Pour bidirectionnel

  // Metadata
  criticality: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Active' | 'Inactive' | 'Pending_Validation';

  // Discovery
  discoveredBy: 'Agent' | 'Manual' | 'Inference';
  confidence: number;                  // 0-100 pour inférées

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  validatedBy?: string;
  validatedAt?: Timestamp;
}

type RelationshipType =
  | 'depends_on' | 'uses'              // Dependency
  | 'runs_on' | 'hosted_on' | 'installed_on'  // Hosting
  | 'connects_to' | 'interfaces_with'  // Connectivity
  | 'contains' | 'member_of' | 'instance_of'  // Composition
  | 'provides' | 'consumes'            // Service
  | 'owned_by' | 'supported_by';       // Ownership
```

**Rationale:**
- Collection séparée pour queries efficaces
- `confidence` pour relations inférées automatiquement
- `inverseType` pour relations bidirectionnelles cohérentes

### AD-003: Stratégie d'Indexation Firestore

```javascript
// Indexes composites requis (firestore.indexes.json)
{
  "indexes": [
    // CI Discovery queries
    {
      "collectionGroup": "cmdb_cis",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "lastDiscoveredAt", "order": "DESCENDING" }
      ]
    },
    // CI Fingerprint matching
    {
      "collectionGroup": "cmdb_cis",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "fingerprint.serialNumber", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "cmdb_cis",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "fingerprint.primaryMacAddress", "order": "ASCENDING" }
      ]
    },
    // Relationship traversal
    {
      "collectionGroup": "cmdb_relationships",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "sourceId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "cmdb_relationships",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "targetId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### AD-004: Architecture IRE (Identification & Reconciliation Engine)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        IRE ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                     CLOUD FUNCTION: onAgentSync                     ││
│  │                     Trigger: Firestore onCreate/onUpdate            ││
│  │                     Collection: agent_heartbeats                     ││
│  └──────────────────────────────┬──────────────────────────────────────┘│
│                                 │                                        │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                     1. FINGERPRINT GENERATOR                        ││
│  │  Input: Agent data (hostname, MAC, serial, OS)                      ││
│  │  Output: Normalized fingerprint object                              ││
│  │  Logic:                                                             ││
│  │    - Normalize MAC (lowercase, colons)                              ││
│  │    - Normalize hostname (lowercase, trim domain)                    ││
│  │    - Generate OS fingerprint (OS + version + arch)                  ││
│  └──────────────────────────────┬──────────────────────────────────────┘│
│                                 │                                        │
│                                 ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                     2. MATCHER (Priority-based)                     ││
│  │  Rules (configurable per organization):                             ││
│  │                                                                     ││
│  │  Priority 1: Serial Number (exact)           → Confidence: 100     ││
│  │  Priority 2: MAC Address (exact)             → Confidence: 90      ││
│  │  Priority 3: Hostname + OS Fingerprint       → Confidence: 70      ││
│  │  Priority 4: IP Address (exact, fallback)    → Confidence: 40      ││
│  │                                                                     ││
│  │  Output: { matchedCIId: string | null, confidence: number }        ││
│  └──────────────────────────────┬──────────────────────────────────────┘│
│                                 │                                        │
│            ┌────────────────────┴────────────────────┐                  │
│            │                                          │                  │
│            ▼                                          ▼                  │
│  ┌─────────────────────┐                   ┌─────────────────────┐      │
│  │  MATCH FOUND        │                   │  NO MATCH           │      │
│  │  Confidence >= 80%  │                   │  OR Confidence < 80%│      │
│  └──────────┬──────────┘                   └──────────┬──────────┘      │
│             │                                          │                 │
│             ▼                                          ▼                 │
│  ┌─────────────────────┐                   ┌─────────────────────┐      │
│  │  3a. AUTO-UPDATE CI │                   │  3b. CHECK CONFIG   │      │
│  │  - Merge attributes │                   │  - autoCreateCI?    │      │
│  │  - Update discovery │                   │  - requireValidation│      │
│  │  - Recalculate DQS  │                   └──────────┬──────────┘      │
│  └─────────────────────┘                              │                 │
│                                    ┌──────────────────┴──────────┐      │
│                                    │                              │      │
│                                    ▼                              ▼      │
│                         ┌─────────────────┐            ┌─────────────────┐
│                         │ AUTO-CREATE CI  │            │ ADD TO QUEUE    │
│                         │ status: In_Use  │            │ Pending_Valid.  │
│                         │ source: Agent   │            │ + Notification  │
│                         └─────────────────┘            └─────────────────┘
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// functions/src/cmdb/reconciliation.ts
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

export const onAgentSync = onDocumentWritten(
  'organizations/{orgId}/agent_heartbeats/{agentId}',
  async (event) => {
    const orgId = event.params.orgId;
    const agentId = event.params.agentId;
    const data = event.data?.after.data();

    if (!data) return; // Deletion, ignore

    // 1. Generate fingerprint
    const fingerprint = generateFingerprint(data);

    // 2. Get org reconciliation rules
    const rules = await getReconciliationRules(orgId);

    // 3. Match against existing CIs
    const match = await matchCI(orgId, fingerprint, rules);

    // 4. Process based on match result
    if (match.ciId && match.confidence >= rules.autoMatchThreshold) {
      await updateCI(orgId, match.ciId, data, fingerprint);
    } else if (rules.autoCreateCI && !match.ciId) {
      await createCI(orgId, data, fingerprint, 'Agent');
    } else {
      await addToValidationQueue(orgId, agentId, data, fingerprint, match);
    }
  }
);

function generateFingerprint(agentData: AgentHeartbeat): CIFingerprint {
  return {
    serialNumber: agentData.systemInfo?.serialNumber?.toUpperCase(),
    primaryMacAddress: normalizeMac(agentData.networkInterfaces?.[0]?.mac),
    hostname: agentData.hostname?.toLowerCase().split('.')[0],
    fqdn: agentData.hostname?.toLowerCase(),
    osFingerprint: `${agentData.os?.type}-${agentData.os?.version}-${agentData.os?.arch}`,
  };
}

async function matchCI(
  orgId: string,
  fingerprint: CIFingerprint,
  rules: ReconciliationRules
): Promise<MatchResult> {
  // Priority 1: Serial Number
  if (fingerprint.serialNumber) {
    const match = await queryByFingerprint(orgId, 'fingerprint.serialNumber', fingerprint.serialNumber);
    if (match) return { ciId: match.id, confidence: 100, rule: 'serial' };
  }

  // Priority 2: MAC Address
  if (fingerprint.primaryMacAddress) {
    const match = await queryByFingerprint(orgId, 'fingerprint.primaryMacAddress', fingerprint.primaryMacAddress);
    if (match) return { ciId: match.id, confidence: 90, rule: 'mac' };
  }

  // Priority 3: Hostname + OS
  if (fingerprint.hostname && fingerprint.osFingerprint) {
    const matches = await queryByHostname(orgId, fingerprint.hostname);
    const osMatch = matches.find(m => m.fingerprint.osFingerprint === fingerprint.osFingerprint);
    if (osMatch) return { ciId: osMatch.id, confidence: 70, rule: 'hostname_os' };
  }

  // No confident match
  return { ciId: null, confidence: 0, rule: 'none' };
}
```

### AD-005: Impact Analysis Algorithm

```typescript
// src/services/CMDBImpactService.ts

interface ImpactNode {
  ciId: string;
  ci: ConfigurationItem;
  hop: number;
  impactLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  path: string[];  // Chain of CIs from source
}

export class CMDBImpactService {
  /**
   * Calculate blast radius using BFS traversal
   * Limited to maxDepth hops to prevent infinite loops and perf issues
   */
  static async calculateImpact(
    orgId: string,
    sourceId: string,
    scenario: 'down' | 'maintenance' | 'decommission',
    maxDepth: number = 3
  ): Promise<ImpactAssessment> {
    const visited = new Set<string>();
    const impactNodes: ImpactNode[] = [];
    const queue: { ciId: string; hop: number; path: string[] }[] = [
      { ciId: sourceId, hop: 0, path: [] }
    ];

    // Get source CI
    const sourceCI = await CMDBService.getCI(orgId, sourceId);
    if (!sourceCI) throw new Error('Source CI not found');

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.ciId) || current.hop > maxDepth) continue;
      visited.add(current.ciId);

      // Get dependents (CIs that depend on this one)
      const dependents = await this.getDependentCIs(orgId, current.ciId);

      for (const dep of dependents) {
        const impactLevel = this.calculateImpactLevel(dep.relationship, current.hop);
        const newPath = [...current.path, current.ciId];

        impactNodes.push({
          ciId: dep.ci.id,
          ci: dep.ci,
          hop: current.hop + 1,
          impactLevel,
          path: newPath,
        });

        // Continue traversal for critical/high impact
        if (impactLevel === 'Critical' || impactLevel === 'High') {
          queue.push({
            ciId: dep.ci.id,
            hop: current.hop + 1,
            path: newPath,
          });
        }
      }
    }

    // Aggregate results
    return this.aggregateImpact(sourceCI, impactNodes, scenario);
  }

  private static async getDependentCIs(
    orgId: string,
    ciId: string
  ): Promise<{ ci: ConfigurationItem; relationship: CMDBRelationship }[]> {
    // Query relationships where this CI is the target (dependents are sources)
    const dependencyTypes = ['depends_on', 'uses', 'runs_on', 'hosted_on', 'installed_on'];

    const relationships = await db
      .collection('cmdb_relationships')
      .where('organizationId', '==', orgId)
      .where('targetId', '==', ciId)
      .where('relationshipType', 'in', dependencyTypes)
      .where('status', '==', 'Active')
      .get();

    const results = [];
    for (const rel of relationships.docs) {
      const relData = rel.data() as CMDBRelationship;
      const ci = await CMDBService.getCI(orgId, relData.sourceId);
      if (ci) results.push({ ci, relationship: relData });
    }

    return results;
  }

  private static calculateImpactLevel(
    relationship: CMDBRelationship,
    hop: number
  ): ImpactLevel {
    // Base impact from relationship type
    const typeImpact: Record<string, number> = {
      'depends_on': 100,
      'runs_on': 90,
      'hosted_on': 85,
      'installed_on': 80,
      'uses': 60,
      'connects_to': 40,
    };

    const baseScore = typeImpact[relationship.relationshipType] || 50;

    // Reduce by criticality
    const criticalityMultiplier: Record<string, number> = {
      'Critical': 1.0,
      'High': 0.8,
      'Medium': 0.6,
      'Low': 0.4,
    };

    // Reduce by hop distance
    const hopDecay = Math.pow(0.7, hop);

    const finalScore = baseScore *
      (criticalityMultiplier[relationship.criticality] || 0.5) *
      hopDecay;

    if (finalScore >= 70) return 'Critical';
    if (finalScore >= 50) return 'High';
    if (finalScore >= 30) return 'Medium';
    return 'Low';
  }
}
```

### AD-006: Migration Strategy Asset → CI

```typescript
// scripts/migrate-assets-to-cis.ts

interface MigrationResult {
  totalAssets: number;
  migratedCIs: number;
  errors: { assetId: string; error: string }[];
}

async function migrateAssetsToCIs(orgId: string): Promise<MigrationResult> {
  const result: MigrationResult = { totalAssets: 0, migratedCIs: 0, errors: [] };

  // Get all assets
  const assets = await db
    .collection('assets')
    .where('organizationId', '==', orgId)
    .get();

  result.totalAssets = assets.size;

  const batch = db.batch();
  let batchCount = 0;

  for (const assetDoc of assets.docs) {
    try {
      const asset = assetDoc.data() as Asset;

      // Map Asset to CI
      const ci: Partial<ConfigurationItem> = {
        organizationId: orgId,
        ciClass: mapAssetTypeToCIClass(asset.type),
        ciType: mapAssetTypeToDetailedType(asset.type, asset.hardwareType),

        name: asset.name,
        description: asset.notes,
        status: mapLifecycleToStatus(asset.lifecycleStatus),
        environment: 'Production', // Default, can be updated later
        criticality: mapCIACriticality(asset),

        ownerId: asset.owner, // Will need user lookup

        fingerprint: {
          hostname: asset.hostname,
          primaryMacAddress: asset.macAddress,
        },

        attributes: {
          // Hardware specific
          ...(asset.ipAddress && { primaryIpAddress: asset.ipAddress }),
          ...(asset.hardwareType && { hardwareType: asset.hardwareType }),
          // Software specific
          ...(asset.version && { version: asset.version }),
          ...(asset.cpe && { cpe: asset.cpe }),
          // Legacy
          purchaseDate: asset.purchaseDate,
          purchasePrice: asset.purchasePrice,
          warrantyEndDate: asset.warrantyEnd,
        },

        dataQualityScore: calculateInitialDQS(asset),
        discoverySource: 'Manual',
        legacyAssetId: assetDoc.id,

        createdAt: asset.createdAt,
        updatedAt: serverTimestamp(),
        createdBy: asset.createdBy || 'migration',
        updatedBy: 'migration',
      };

      // Create CI
      const ciRef = db.collection('cmdb_cis').doc();
      batch.set(ciRef, ci);

      // Update original asset with CI link (for transition period)
      batch.update(assetDoc.ref, {
        migratedToCIId: ciRef.id,
        migrationDate: serverTimestamp()
      });

      batchCount++;
      result.migratedCIs++;

      // Commit every 400 (Firestore limit is 500)
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
      }

    } catch (error) {
      result.errors.push({
        assetId: assetDoc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Final commit
  if (batchCount > 0) {
    await batch.commit();
  }

  return result;
}

function mapAssetTypeToCIClass(assetType: string): CIClass {
  const mapping: Record<string, CIClass> = {
    'Matériel': 'Hardware',
    'Logiciel': 'Software',
    'Données': 'Document',
    'Service': 'Service',
    'Humain': 'Service', // People map to Service ownership
  };
  return mapping[assetType] || 'Hardware';
}

function mapLifecycleToStatus(lifecycle: string): CIStatus {
  const mapping: Record<string, CIStatus> = {
    'Neuf': 'In_Stock',
    'En service': 'In_Use',
    'En réparation': 'In_Maintenance',
    'Fin de vie': 'Retired',
    'Rebut': 'Retired',
  };
  return mapping[lifecycle] || 'In_Use';
}
```

### AD-007: Frontend Components Architecture

```
src/
├── components/
│   └── cmdb/
│       ├── CMDBDashboard.tsx          # Main CMDB view
│       ├── DiscoveryDashboard.tsx     # Discovery & reconciliation
│       ├── ValidationQueue.tsx        # Pending validation list
│       ├── CIInspector.tsx            # CI detail panel (like AssetInspector)
│       ├── RelationshipGraph.tsx      # VoxelEngine integration
│       ├── ImpactAnalysis.tsx         # Blast radius view
│       └── inspector/
│           ├── CIInspectorDetails.tsx
│           ├── CIInspectorRelations.tsx
│           ├── CIInspectorHistory.tsx
│           └── CIInspectorImpact.tsx
│
├── hooks/
│   └── cmdb/
│       ├── useCMDBCIs.ts              # CI CRUD operations
│       ├── useCMDBRelationships.ts    # Relationship operations
│       ├── useReconciliation.ts       # IRE integration
│       ├── useImpactAnalysis.ts       # Impact calculation
│       └── useCMDBFilters.ts          # Filtering logic
│
├── services/
│   ├── CMDBService.ts                 # CI CRUD
│   ├── CMDBRelationshipService.ts     # Relationship CRUD
│   ├── CMDBReconciliationService.ts   # IRE client
│   └── CMDBImpactService.ts           # Impact analysis
│
├── stores/
│   └── cmdbStore.ts                   # Zustand store for CMDB state
│
├── types/
│   └── cmdb.ts                        # All CMDB types
│
└── schemas/
    └── cmdbSchema.ts                  # Zod validation schemas
```

### AD-008: Zustand Store Design

```typescript
// src/stores/cmdbStore.ts
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';

interface CMDBState {
  // Selected CI
  selectedCIId: string | null;

  // Filters
  filters: {
    ciClass: CIClass | null;
    status: CIStatus | null;
    environment: Environment | null;
    search: string;
  };

  // Discovery
  pendingValidation: CMDBValidationItem[];
  discoveryStats: {
    total: number;
    pending: number;
    matched: number;
    missing: number;
  };

  // Impact Analysis
  impactAnalysis: {
    isCalculating: boolean;
    result: ImpactAssessment | null;
    scenario: 'down' | 'maintenance' | 'decommission';
    depth: number;
  };

  // Actions
  selectCI: (id: string | null) => void;
  setFilter: (key: keyof CMDBState['filters'], value: unknown) => void;
  resetFilters: () => void;
  loadPendingValidation: () => Promise<void>;
  calculateImpact: (ciId: string, scenario: string, depth: number) => Promise<void>;
  clearImpact: () => void;
}

export const useCMDBStore = create<CMDBState>((set, get) => ({
  selectedCIId: null,

  filters: {
    ciClass: null,
    status: null,
    environment: null,
    search: '',
  },

  pendingValidation: [],
  discoveryStats: { total: 0, pending: 0, matched: 0, missing: 0 },

  impactAnalysis: {
    isCalculating: false,
    result: null,
    scenario: 'down',
    depth: 3,
  },

  selectCI: (id) => set({ selectedCIId: id }),

  setFilter: (key, value) => set((state) => ({
    filters: { ...state.filters, [key]: value }
  })),

  resetFilters: () => set({
    filters: { ciClass: null, status: null, environment: null, search: '' }
  }),

  loadPendingValidation: async () => {
    const items = await CMDBReconciliationService.getPendingValidation();
    set({ pendingValidation: items });
  },

  calculateImpact: async (ciId, scenario, depth) => {
    set((state) => ({
      impactAnalysis: { ...state.impactAnalysis, isCalculating: true }
    }));

    try {
      const result = await CMDBImpactService.calculateImpact(ciId, scenario, depth);
      set((state) => ({
        impactAnalysis: {
          ...state.impactAnalysis,
          isCalculating: false,
          result
        }
      }));
    } catch (error) {
      set((state) => ({
        impactAnalysis: { ...state.impactAnalysis, isCalculating: false }
      }));
      throw error;
    }
  },

  clearImpact: () => set((state) => ({
    impactAnalysis: { ...state.impactAnalysis, result: null }
  })),
}));

// Selectors (fine-grained to avoid over-subscription)
export const useSelectedCIId = () => useCMDBStore((s) => s.selectedCIId);
export const useCMDBFilters = () => useCMDBStore((s) => s.filters, shallow);
export const useImpactResult = () => useCMDBStore((s) => s.impactAnalysis.result);
```

---

## Consequences

### Positive

1. **Modèle extensible** : Nouvelles classes CI et types de relations facilement ajoutables
2. **Performance prévisible** : Indexation Firestore optimisée pour les patterns de query
3. **Migration douce** : `legacyAssetId` permet une transition progressive
4. **Réutilisation** : VoxelEngine pour visualisation, patterns existants pour UI
5. **Conformité** : Architecture alignée ITIL 4 SCM

### Negative

1. **Complexité initiale** : Nouveau modèle à apprendre pour l'équipe
2. **Double maintenance** : Période de transition Asset + CI
3. **Pas de graph database** : Traversal moins performant que Neo4j (acceptable avec caching)

### Risks

| Risk | Mitigation |
|------|------------|
| Performance traversal à grande échelle | Caching agressif + limiter profondeur |
| Migration data loss | Backup complet + rollback possible |
| Adoption utilisateurs | UI intuitive + formation |

---

## References

- [ITIL 4 Service Configuration Management](https://www.axelos.com/certifications/itil-service-management)
- [ServiceNow CMDB Best Practices](https://docs.servicenow.com/bundle/tokyo-servicenow-platform/page/product/configuration-management/concept/cmdb-best-practices.html)
- [Firestore Data Modeling](https://firebase.google.com/docs/firestore/data-model)
- Product Brief CMDB: `_bmad-output/planning-artifacts/product-brief-cmdb.md`
- PRD CMDB: `_bmad-output/planning-artifacts/prd-cmdb.md`

---

**Status:** PROPOSED → Waiting for Architecture Review
