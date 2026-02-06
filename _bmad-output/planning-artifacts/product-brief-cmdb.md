# Product Brief : Module CMDB - Sentinel GRC v2

---

**Document Version:** 1.0
**Date:** 2026-02-06
**Auteur:** Mary (Business Analyst) avec Thibaultllopis
**Statut:** DRAFT - En attente de validation

---

## 1. Vision Produit

### 1.1 Énoncé de Vision

> **Transformer l'inventaire d'actifs existant de Sentinel GRC en une véritable CMDB (Configuration Management Database) ITIL 4 compliant, exploitant la synergie unique entre l'agent Rust déployé et la plateforme SaaS pour offrir une découverte automatisée, une réconciliation intelligente et une analyse d'impact en temps réel.**

### 1.2 Objectifs Stratégiques

| Objectif | Métrique de Succès | Délai |
|----------|-------------------|-------|
| Réconciliation automatique Agent → Assets | 95% des CIs découverts liés automatiquement | Phase 1 |
| Cartographie des dépendances | 100% des services critiques mappés | Phase 2 |
| Réduction MTTR (Mean Time To Resolve) | -30% sur les incidents liés aux assets | Phase 2 |
| Conformité ITIL 4 SCM | Certification ITIL Ready | Phase 3 |

### 1.3 Alignement Réglementaire

| Framework | Exigence | Couverture CMDB |
|-----------|----------|-----------------|
| **NIS2** | Art. 21 - Gestion des actifs et vulnérabilités | Inventaire automatisé + Vuln correlation |
| **DORA** | Art. 9 - Registre des actifs ICT | CMDB complète avec relations |
| **ISO 27001** | A.5.9 - Inventaire des actifs | CI management + ownership |
| **ITIL 4** | Service Configuration Management | Découverte + Réconciliation + Impact |

---

## 2. Analyse de l'Existant

### 2.1 Fondations Disponibles

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AGENT RUST (sentinel-agent)                       │
├─────────────────────────────────────────────────────────────────────┤
│ ✅ Inventaire Software (Homebrew/APT/Windows)                        │
│ ✅ Interfaces réseau (MAC, IP, type, vitesse)                       │
│ ✅ Connexions actives (TCP/UDP, process associé)                    │
│ ✅ Découverte réseau (devices, vendor, ports)                       │
│ ✅ Métriques système (CPU, RAM, Disk, Uptime)                       │
│ ✅ File Integrity Monitoring (FIM)                                  │
│ ⚠️ Hardware details (partiel - manque CPU/RAM/Serial)               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ Sync via Firebase
┌─────────────────────────────────────────────────────────────────────┐
│                    PLATEFORME SAAS (src/)                            │
├─────────────────────────────────────────────────────────────────────┤
│ ✅ Module Assets (Matériel, Logiciel, Données, Service, Humain)     │
│ ✅ Cycle de vie (Neuf → En service → Fin de vie → Rebut)            │
│ ✅ CIA (Confidentialité, Intégrité, Disponibilité)                  │
│ ✅ Relations via arrays (risks, incidents, projects, audits)        │
│ ✅ Historique complet (audit logs avec avant/après)                 │
│ ✅ Support OT/ICS (PLC, SCADA, protocoles industriels)              │
│ ⚠️ Pas de réconciliation automatique Agent ↔ Assets                 │
│ ⚠️ Relations dénormalisées (pas de modèle first-class)              │
│ ❌ Pas d'analyse d'impact                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Gap Analysis Détaillée

| Capacité CMDB | État Actuel | Gap | Priorité |
|---------------|-------------|-----|----------|
| **Découverte automatique** | ✅ Agent collecte | Pont Agent→CMDB manquant | P0 |
| **Identification CI** | ⚠️ UUID agent seulement | Fingerprint multi-critères | P0 |
| **Réconciliation** | ❌ Manuel | Algorithme de matching | P0 |
| **Relations typées** | ⚠️ Arrays dénormalisés | Entité Relationship | P1 |
| **Analyse d'impact** | ❌ Inexistant | Graphe de propagation | P1 |
| **Hardware détaillé** | ⚠️ Partiel | Enrichissement agent | P1 |
| **Gestion licences** | ❌ Inexistant | Module License | P2 |
| **Service Mapping** | ❌ Inexistant | App → Infra mapping | P2 |
| **API CMDB** | ❌ Inexistant | REST API + Query DSL | P3 |

---

## 3. Solution Proposée

### 3.1 Architecture CMDB

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CMDB ARCHITECTURE                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │   Agent 1   │    │   Agent 2   │    │   Agent N   │                  │
│  │   (Rust)    │    │   (Rust)    │    │   (Rust)    │                  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                  │
│         │                  │                  │                          │
│         └──────────────────┼──────────────────┘                          │
│                            ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    DISCOVERY ENGINE                                 │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │  Collector   │  │  Normalizer  │  │  Enricher    │              │ │
│  │  │  (Firestore) │→ │  (Transform) │→ │  (CPE, CVE)  │              │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                            ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                 RECONCILIATION ENGINE (IRE)                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │ Fingerprint  │  │   Matcher    │  │  Dedup &     │              │ │
│  │  │ Generator    │→ │  (Priority)  │→ │  Merger      │              │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │ │
│  │                                                                     │ │
│  │  Identification Rules (Priority Order):                            │ │
│  │  1. Serial Number + Manufacturer                                   │ │
│  │  2. MAC Address (primary NIC)                                      │ │
│  │  3. Hostname + OS + Domain                                         │ │
│  │  4. IP Address (least reliable, fallback)                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                            ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        CMDB CORE                                    │ │
│  │                                                                     │ │
│  │   ┌────────────────────────────────────────────────────────────┐   │ │
│  │   │                CONFIGURATION ITEMS (CIs)                    │   │ │
│  │   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │   │ │
│  │   │  │Hardware │ │Software │ │Service  │ │Document │          │   │ │
│  │   │  │   CI    │ │   CI    │ │   CI    │ │   CI    │          │   │ │
│  │   │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │   │ │
│  │   │       │           │           │           │                │   │ │
│  │   │       └───────────┴─────┬─────┴───────────┘                │   │ │
│  │   │                         ▼                                  │   │ │
│  │   │              ┌─────────────────────┐                       │   │ │
│  │   │              │    RELATIONSHIPS    │                       │   │ │
│  │   │              │  ┌───────────────┐  │                       │   │ │
│  │   │              │  │ depends_on    │  │                       │   │ │
│  │   │              │  │ runs_on       │  │                       │   │ │
│  │   │              │  │ hosted_on     │  │                       │   │ │
│  │   │              │  │ connects_to   │  │                       │   │ │
│  │   │              │  │ uses          │  │                       │   │ │
│  │   │              │  │ contains      │  │                       │   │ │
│  │   │              │  └───────────────┘  │                       │   │ │
│  │   │              └─────────────────────┘                       │   │ │
│  │   └────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                            ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    IMPACT ANALYSIS ENGINE                           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │ Dependency   │  │  Impact      │  │  Blast       │              │ │
│  │  │ Graph        │→ │  Calculator  │→ │  Radius      │              │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Modèle de Données CMDB

#### 3.2.1 Configuration Item (CI) - Extension de Asset

```typescript
// Nouvelle collection Firestore: cmdb_cis
interface ConfigurationItem {
  // Identité
  id: string;                          // Firestore auto-generated
  organizationId: string;              // Multi-tenant isolation
  ciClass: CIClass;                    // Hardware, Software, Service, Document, Network
  ciType: string;                      // Sous-type (Server, Workstation, Database, etc.)

  // Identification (pour réconciliation)
  fingerprint: CIFingerprint;          // Identifiants uniques combinés

  // Attributs communs
  name: string;
  description?: string;
  status: CIStatus;                    // In_Stock, In_Use, In_Maintenance, Retired
  environment: Environment;            // Production, Staging, Development, Test
  criticality: Criticality;            // Critical, High, Medium, Low

  // Ownership
  ownerId: string;                     // User reference
  supportGroupId?: string;             // Team reference

  // Lifecycle
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastDiscoveredAt?: Timestamp;        // Dernière découverte agent
  lastReconciliationAt?: Timestamp;    // Dernière réconciliation
  dataQualityScore: number;            // 0-100, calculé automatiquement

  // Source tracking
  discoverySource: DiscoverySource;    // Agent, Manual, Import, Cloud
  sourceAgentId?: string;              // UUID de l'agent source

  // Legacy link
  legacyAssetId?: string;              // Lien vers l'ancien Asset ID

  // Classe-specific attributes
  attributes: Record<string, unknown>; // Attributs spécifiques à la classe
}

interface CIFingerprint {
  serialNumber?: string;
  primaryMacAddress?: string;
  hostname?: string;
  fqdn?: string;
  osFingerprint?: string;              // OS + Version + Architecture
  cloudInstanceId?: string;            // AWS/Azure/GCP instance ID
}

type CIClass =
  | 'Hardware'      // Serveurs, Workstations, Network devices
  | 'Software'      // Applications, OS, Middleware
  | 'Service'       // Business services, IT services
  | 'Document'      // Configs, Policies, Procedures
  | 'Network'       // Subnets, VLANs, DNS zones
  | 'Cloud'         // Cloud resources
  | 'Container';    // Containers, Pods, Namespaces

type CIStatus =
  | 'In_Stock'      // Inventorié, pas déployé
  | 'In_Use'        // En production
  | 'In_Maintenance'// En maintenance/réparation
  | 'Retired'       // Hors service
  | 'Missing';      // Découvert mais pas retrouvé

type Environment = 'Production' | 'Staging' | 'Development' | 'Test' | 'DR';
type Criticality = 'Critical' | 'High' | 'Medium' | 'Low';
type DiscoverySource = 'Agent' | 'Manual' | 'Import' | 'Cloud' | 'Network_Scan';
```

#### 3.2.2 CMDB Relationships

```typescript
// Nouvelle collection Firestore: cmdb_relationships
interface CMDBRelationship {
  id: string;
  organizationId: string;

  // Source et Destination
  sourceId: string;                    // CI source
  sourceCIClass: CIClass;
  targetId: string;                    // CI destination
  targetCIClass: CIClass;

  // Type de relation
  relationshipType: RelationshipType;
  direction: 'unidirectional' | 'bidirectional';

  // Métadonnées
  criticality: Criticality;            // Impact si la relation est rompue
  status: 'Active' | 'Inactive' | 'Pending_Validation';

  // Discovery
  discoveredBy: 'Agent' | 'Manual' | 'Inference';
  confidence: number;                  // 0-100, pour relations inférées

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  validatedBy?: string;
  validatedAt?: Timestamp;
}

type RelationshipType =
  // Dépendances
  | 'depends_on'        // A dépend de B (A ne fonctionne pas sans B)
  | 'uses'              // A utilise B (mais peut fonctionner sans)

  // Hébergement
  | 'runs_on'           // A tourne sur B (App runs on Server)
  | 'hosted_on'         // A est hébergé sur B (VM hosted on Hypervisor)
  | 'installed_on'      // A est installé sur B (Software on Hardware)

  // Connectivité
  | 'connects_to'       // A se connecte à B (réseau)
  | 'interfaces_with'   // A interface avec B (API)

  // Composition
  | 'contains'          // A contient B (Server contains CPU)
  | 'member_of'         // A est membre de B (Server member of Cluster)
  | 'instance_of'       // A est une instance de B (VM instance of Template)

  // Business
  | 'provides'          // A fournit B (Service provides Capability)
  | 'consumes'          // A consomme B (Team consumes Service)
  | 'owned_by'          // A appartient à B
  | 'supported_by';     // A est supporté par B (Team)
```

#### 3.2.3 CI Classes Spécifiques

```typescript
// Hardware CI Attributes
interface HardwareCIAttributes {
  hardwareType: 'Server' | 'Workstation' | 'Laptop' | 'Network_Device' | 'Storage' | 'IoT' | 'OT_Device';
  manufacturer: string;
  model: string;
  serialNumber: string;

  // Specs
  cpuModel?: string;
  cpuCores?: number;
  ramGB?: number;
  ramType?: 'DDR4' | 'DDR5';
  storageGB?: number;
  storageType?: 'SSD' | 'HDD' | 'NVMe';

  // Network
  primaryIpAddress?: string;
  primaryMacAddress?: string;
  hostname?: string;
  fqdn?: string;

  // Location
  location?: string;
  rackUnit?: string;
  datacenter?: string;

  // Lifecycle
  purchaseDate?: Timestamp;
  warrantyEndDate?: Timestamp;
  endOfSupportDate?: Timestamp;

  // OT/ICS specific
  otDetails?: OTDetails;               // Réutilisation du type existant
}

// Software CI Attributes
interface SoftwareCIAttributes {
  softwareType: 'Application' | 'Operating_System' | 'Middleware' | 'Database' | 'Security_Tool';
  vendor: string;
  product: string;
  version: string;
  edition?: string;

  // Identification
  cpe?: string;                        // Common Platform Enumeration
  swid?: string;                       // Software Identification Tag

  // Licensing
  licenseType?: 'Perpetual' | 'Subscription' | 'Open_Source' | 'Freeware';
  licenseCount?: number;
  licenseExpiryDate?: Timestamp;

  // Security
  endOfLifeDate?: Timestamp;
  knownVulnerabilities?: number;       // Count from CVE correlation
  lastPatchDate?: Timestamp;
}

// Service CI Attributes
interface ServiceCIAttributes {
  serviceType: 'Business_Service' | 'IT_Service' | 'Infrastructure_Service';
  serviceLevel?: 'Platinum' | 'Gold' | 'Silver' | 'Bronze';

  // SLA
  availabilityTarget?: number;         // 99.9%
  rtoMinutes?: number;                 // Recovery Time Objective
  rpoMinutes?: number;                 // Recovery Point Objective

  // Contacts
  serviceOwnerId: string;
  supportTeamId?: string;
  escalationPath?: string[];

  // Endpoints
  primaryUrl?: string;
  healthCheckUrl?: string;
  documentationUrl?: string;
}
```

### 3.3 Moteur de Réconciliation (IRE - Identification & Reconciliation Engine)

```typescript
// Service de réconciliation
interface ReconciliationService {
  // Règles d'identification par priorité
  identificationRules: IdentificationRule[];

  // Configuration
  config: {
    autoCreateCI: boolean;             // Créer auto si non trouvé
    autoLinkToAsset: boolean;          // Lier auto à Asset existant
    confidenceThreshold: number;       // Seuil pour match auto (0-100)
    requireValidation: boolean;        // Validation manuelle requise
  };
}

interface IdentificationRule {
  priority: number;                    // 1 = highest
  name: string;
  matchCriteria: MatchCriterion[];
  ciClass: CIClass;
  enabled: boolean;
}

interface MatchCriterion {
  field: string;                       // fingerprint.serialNumber
  matchType: 'exact' | 'fuzzy' | 'regex' | 'normalized';
  weight: number;                      // Pour scoring
  required: boolean;
}

// Exemple de règles d'identification
const defaultIdentificationRules: IdentificationRule[] = [
  {
    priority: 1,
    name: 'Serial Number Match',
    ciClass: 'Hardware',
    enabled: true,
    matchCriteria: [
      { field: 'fingerprint.serialNumber', matchType: 'exact', weight: 100, required: true },
      { field: 'fingerprint.manufacturer', matchType: 'normalized', weight: 20, required: false }
    ]
  },
  {
    priority: 2,
    name: 'MAC Address Match',
    ciClass: 'Hardware',
    enabled: true,
    matchCriteria: [
      { field: 'fingerprint.primaryMacAddress', matchType: 'exact', weight: 90, required: true }
    ]
  },
  {
    priority: 3,
    name: 'Hostname + OS Match',
    ciClass: 'Hardware',
    enabled: true,
    matchCriteria: [
      { field: 'fingerprint.hostname', matchType: 'normalized', weight: 50, required: true },
      { field: 'fingerprint.osFingerprint', matchType: 'exact', weight: 40, required: true }
    ]
  },
  {
    priority: 4,
    name: 'IP Address Fallback',
    ciClass: 'Hardware',
    enabled: true,
    matchCriteria: [
      { field: 'attributes.primaryIpAddress', matchType: 'exact', weight: 30, required: true }
    ]
  }
];
```

### 3.4 Analyse d'Impact

```typescript
// Service d'analyse d'impact
interface ImpactAnalysisService {
  // Calculer l'impact d'un CI down
  calculateImpact(ciId: string): ImpactAssessment;

  // Obtenir le blast radius
  getBlastRadius(ciId: string, depth: number): BlastRadius;

  // Simuler un changement
  simulateChange(changeRequest: ChangeRequest): ImpactSimulation;
}

interface ImpactAssessment {
  affectedCI: ConfigurationItem;

  // Impact direct
  directDependencies: {
    ci: ConfigurationItem;
    relationshipType: RelationshipType;
    impactLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  }[];

  // Impact indirect (propagation)
  indirectDependencies: {
    ci: ConfigurationItem;
    pathFromSource: string[];          // Chain of CIs
    hops: number;
    impactLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  }[];

  // Services métier impactés
  affectedServices: {
    service: ServiceCIAttributes;
    criticality: Criticality;
    userCount?: number;
  }[];

  // Métriques
  totalAffectedCIs: number;
  totalAffectedUsers: number;
  estimatedDowntimeMinutes?: number;
  financialImpact?: number;
}

interface BlastRadius {
  center: ConfigurationItem;
  rings: {
    hop: number;
    cis: ConfigurationItem[];
    totalImpactScore: number;
  }[];
  visualization: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}
```

---

## 4. User Stories Principales

### Epic 1: Réconciliation Automatique (P0)

| Story ID | Description | Critères d'Acceptation |
|----------|-------------|------------------------|
| CMDB-001 | En tant qu'admin, je veux que les CIs découverts par l'agent soient automatiquement liés aux Assets existants | - Matching par fingerprint multi-critères<br>- Score de confiance affiché<br>- Validation manuelle si confiance < 80% |
| CMDB-002 | En tant qu'admin, je veux créer automatiquement des CIs pour les devices découverts non-matchés | - Auto-création avec source "Agent"<br>- Statut "Pending_Validation"<br>- Notification au propriétaire |
| CMDB-003 | En tant qu'admin, je veux configurer les règles d'identification | - Interface de configuration des règles<br>- Priorités drag & drop<br>- Test des règles sur données existantes |

### Epic 2: Modèle de Relations (P1)

| Story ID | Description | Critères d'Acceptation |
|----------|-------------|------------------------|
| CMDB-010 | En tant qu'utilisateur, je veux créer des relations typées entre CIs | - Sélection source/destination<br>- Choix du type de relation<br>- Validation de cohérence |
| CMDB-011 | En tant qu'utilisateur, je veux visualiser le graphe de dépendances | - Vue graphique interactive (VoxelEngine existant)<br>- Filtrage par type de relation<br>- Drill-down sur les CIs |
| CMDB-012 | En tant qu'admin, je veux que les relations soient inférées automatiquement | - Détection runs_on (process → host)<br>- Détection connects_to (network connections)<br>- Confiance score + validation |

### Epic 3: Analyse d'Impact (P1)

| Story ID | Description | Critères d'Acceptation |
|----------|-------------|------------------------|
| CMDB-020 | En tant qu'utilisateur, je veux voir l'impact si un CI tombe | - Calcul du blast radius<br>- Liste des CIs impactés par niveau<br>- Services métier affectés |
| CMDB-021 | En tant qu'utilisateur, je veux simuler un changement avant exécution | - Sélection du CI à modifier<br>- Type de changement (maintenance, update, decom)<br>- Rapport d'impact préventif |

### Epic 4: Enrichissement Agent (P1)

| Story ID | Description | Critères d'Acceptation |
|----------|-------------|------------------------|
| CMDB-030 | En tant qu'admin, je veux collecter les specs hardware détaillées | - CPU model, cores, frequency<br>- RAM type, size, slots<br>- Storage type, size, health<br>- Serial numbers |
| CMDB-031 | En tant qu'admin, je veux extraire les CPE des logiciels découverts | - Mapping produit → CPE<br>- Corrélation CVE automatique<br>- Score de vulnérabilité |

---

## 5. Métriques et KPIs

### 5.1 Qualité des Données CMDB

| KPI | Description | Cible | Mesure |
|-----|-------------|-------|--------|
| **Freshness** | % de CIs mis à jour dans les 7 jours | > 95% | `lastDiscoveredAt > now - 7d` |
| **Completeness** | % de champs obligatoires remplis | > 90% | Champs requis non-null |
| **Accuracy** | % de CIs validés manuellement | > 80% | `status != Pending_Validation` |
| **Orphans** | CIs sans relations | < 10% | CIs avec 0 relationships |
| **Duplicates** | CIs dupliqués détectés | < 2% | Fingerprint collisions |

### 5.2 Utilisation

| KPI | Description | Cible |
|-----|-------------|-------|
| **Discovery Rate** | CIs découverts / heure | > 100 |
| **Reconciliation Success** | % matchés automatiquement | > 85% |
| **Impact Queries** | Requêtes d'impact / semaine | Croissant |
| **MTTR Reduction** | Réduction temps résolution | -30% |

---

## 6. Roadmap de Livraison

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ROADMAP CMDB                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1 (8 semaines) - Fondations                                       │
│  ├─ Sprint 1-2: Modèle de données CI + Migration Assets                 │
│  ├─ Sprint 3-4: Moteur de réconciliation (IRE)                          │
│  └─ Sprint 5-6: UI Discovery Dashboard + Validation workflow            │
│                                                                          │
│  PHASE 2 (6 semaines) - Relations & Impact                               │
│  ├─ Sprint 7-8: Entité Relationship + API                               │
│  ├─ Sprint 9: Graphe de dépendances (VoxelEngine integration)           │
│  └─ Sprint 10: Impact Analysis Engine                                    │
│                                                                          │
│  PHASE 3 (6 semaines) - Enrichissement & Avancé                          │
│  ├─ Sprint 11-12: Hardware discovery enrichment (Agent Rust)            │
│  ├─ Sprint 13: License Management                                        │
│  └─ Sprint 14: API CMDB RESTful + Intégrations                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Risques et Mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Performance réconciliation à grande échelle | Haut | Moyen | Batch processing + Cloud Functions |
| Faux positifs dans le matching | Moyen | Haut | Seuil de confiance + validation humaine |
| Résistance au changement (Asset → CI) | Moyen | Moyen | Migration douce + dual-view |
| Complexité du graphe de relations | Haut | Moyen | Limiter la profondeur + caching |
| Surcharge agent avec hardware discovery | Moyen | Faible | Collection périodique (pas temps réel) |

---

## 8. Dépendances Techniques

### 8.1 Modifications Agent Rust

```rust
// Nouvelles structs à ajouter dans agent-scanner

#[derive(Serialize, Deserialize)]
pub struct HardwareInventory {
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub storage: Vec<StorageDevice>,
    pub bios: BiosInfo,
    pub network_adapters: Vec<NetworkAdapter>,
}

#[derive(Serialize, Deserialize)]
pub struct CpuInfo {
    pub model: String,
    pub vendor: String,
    pub cores: u32,
    pub threads: u32,
    pub frequency_mhz: u32,
    pub architecture: String,
}

#[derive(Serialize, Deserialize)]
pub struct MemoryInfo {
    pub total_gb: f32,
    pub memory_type: String,  // DDR4, DDR5
    pub slots_used: u32,
    pub slots_total: u32,
    pub modules: Vec<MemoryModule>,
}

#[derive(Serialize, Deserialize)]
pub struct StorageDevice {
    pub device_type: String,  // SSD, HDD, NVMe
    pub model: String,
    pub serial_number: String,
    pub capacity_gb: u64,
    pub health_status: String,
}

#[derive(Serialize, Deserialize)]
pub struct BiosInfo {
    pub vendor: String,
    pub version: String,
    pub release_date: String,
    pub serial_number: String,  // Souvent le serial de la machine
}
```

### 8.2 Collections Firestore

| Collection | Description | Index |
|------------|-------------|-------|
| `cmdb_cis` | Configuration Items | organizationId + ciClass, fingerprint.* |
| `cmdb_relationships` | Relations entre CIs | organizationId + sourceId, targetId |
| `cmdb_reconciliation_queue` | CIs en attente de validation | organizationId + status |
| `cmdb_identification_rules` | Règles de matching | organizationId + ciClass |
| `cmdb_audit_log` | Historique CMDB | organizationId + ciId + timestamp |

### 8.3 Intégration Modules Existants

- **Module Assets**: Migration douce, `legacyAssetId` pour lien bidirectionnel
- **Module Risks**: `affectedCIIds` remplace `affectedAssetIds`
- **Module Incidents**: Lien vers CIs pour root cause analysis
- **VoxelEngine**: Réutilisation pour graphe de dépendances

---

## 9. Références et Sources

### Standards et Best Practices

- [ITIL CMDB: Practical Guide to ITIL 4 Service Configuration Management](https://cloudaware.com/blog/itil-cmdb/)
- [ITIL Configuration Management: Examples & Best Practices for 2025](https://cloudaware.com/blog/itil-configuration-management/)
- [ITIL 4: CMDB and Configuration Management - ServiceNow](https://www.servicenow.com/blogs/2023/itil-4-cmdb-configuration-management)
- [Configuration Management Database (CMDB) - Best Practices 2025](https://faddom.com/cmdb-4-key-capabilities-pros-cons-and-best-practices-2025/)

### Modèles de Données et Relations

- [BMC CMDB - Relationships in Data Model](https://docs.bmc.com/docs/ac2002/relationships-represented-in-a-data-model-diagram-908213445.html)
- [ServiceNow CMDB Data Model & Relationships](https://www.servicenow.com/community/developer-forum/cmdb-data-model-amp-relationships/m-p/3083472)
- [ManageEngine - Defining CI Relationships](https://www.manageengine.com/products/asset-explorer/help/cmdb/cmdb-relationships.html)

### Réconciliation et Discovery

- [ServiceNow - CMDB Population and Maintenance with Discovery](https://www.servicenow.com/content/dam/servicenow-assets/public/en-us/doc-type/success/playbook/cmdb-population-maintenance-discovery.pdf)
- [Device42 - Autodiscovery Best Practices](https://docs.device42.com/auto-discovery/autodisc-best-practices/)
- [BMC - Reconciliation Best Practices](https://docs.bmc.com/docs/ac2002/reconciliation-best-practices-908213855.html)
- [ServiceNow CMDB Identification and Reconciliation Engine (IRE)](https://servicenowguru.com/cmdb/servicenow-cmdb-identification-and-reconciliation-engine-ire/)

---

## 10. Approbations

| Rôle | Nom | Date | Signature |
|------|-----|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| Security Officer | | | |
| Business Analyst | Mary (BMAD) | 2026-02-06 | ✅ |

---

**Statut du Document:** PRÊT POUR REVIEW
**Prochaine Étape:** Validation par le Product Owner et création des Epics dans le backlog
