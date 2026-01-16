---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflow_completed: true
lastStep: 8
completedAt: '2026-01-16'
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-ebios-rm-iso27003-2026-01-16.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/prd.md'
workflowType: 'architecture-extension'
project_name: 'Sentinel GRC v2 - EBIOS RM Module'
user_name: 'Thibaultllopis'
date: '2026-01-16'
parent_architecture: 'architecture.md'
extension_type: 'additive'
---

# Architecture Decision Document - Extension EBIOS RM & ISO 27003

**Module d'extension pour Sentinel GRC v2**

_Ce document étend l'architecture existante (architecture.md) sans la modifier._

---

## Project Context Analysis

### Extension Overview

**Type d'extension :** Additive (nouvelles fonctionnalités sans modification de l'existant)

**Modules à créer :**
1. Module EBIOS RM (5 ateliers)
2. Module Programme SMSI (ISO 27003)
3. Extension Contexte de Risque (ISO 27005)
4. Extension Efficacité des Contrôles (ISO 27002)

**Contraintes d'intégration :**
- Zéro breaking change sur l'existant
- Réutilisation des composants UI existants
- Connexion bidirectionnelle avec le registre de risques
- Alignement avec les 7 ADRs existants

### Requirements Summary

**47 nouvelles exigences fonctionnelles :**

| Module | FRs | Complexité |
|--------|-----|------------|
| EBIOS RM Atelier 1 (Cadrage) | 7 | Moyenne |
| EBIOS RM Atelier 2 (Sources) | 6 | Moyenne |
| EBIOS RM Atelier 3 (Scénarios Stratégiques) | 6 | Haute |
| EBIOS RM Atelier 4 (Scénarios Opérationnels) | 6 | Haute |
| EBIOS RM Atelier 5 (Traitement) | 6 | Haute |
| ISO 27003 Programme SMSI | 7 | Moyenne |
| ISO 27005 Contexte | 5 | Faible |
| ISO 27002 Efficacité | 4 | Moyenne |

### Cross-Cutting Concerns

| Concern | Impact | Solution |
|---------|--------|----------|
| **Multi-tenancy** | Critique | Toutes les collections avec `tenantId` |
| **Audit Trail** | Haute | Extension du système existant |
| **RBAC** | Haute | Nouvelles permissions EBIOS |
| **Internationalization** | Moyenne | Traductions FR/EN |
| **Auto-save/Draft** | Haute | ADR-002 appliqué à tous les ateliers |
| **Score Integration** | Haute | Contribution au score global |

---

## Architectural Decisions

### ADR-E001: EBIOS RM State Machine

**Contexte:** Les 5 ateliers EBIOS RM doivent être suivis séquentiellement avec possibilité de retour.

**Décision:** Implémenter un state machine pour gérer la progression des ateliers.

**Implementation:**

```typescript
// src/types/ebios.types.ts

export type EbiosWorkshopStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'validated';

export type EbiosWorkshopNumber = 1 | 2 | 3 | 4 | 5;

export interface EbiosAnalysis {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  currentWorkshop: EbiosWorkshopNumber;
  workshops: {
    [K in EbiosWorkshopNumber]: {
      status: EbiosWorkshopStatus;
      startedAt?: Timestamp;
      completedAt?: Timestamp;
      validatedBy?: string;
      data: WorkshopData[K];
    };
  };
  completionPercentage: number;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// Workshop-specific data types
export interface Workshop1Data {
  scope: {
    missions: Mission[];
    essentialAssets: EssentialAsset[];
    supportingAssets: SupportingAsset[];
  };
  fearedEvents: FearedEvent[];
  securityBaseline: SecurityBaseline;
}

export interface Workshop2Data {
  riskSources: RiskSource[];
  targetedObjectives: TargetedObjective[];
  srOvPairs: SROVPair[];
}

export interface Workshop3Data {
  ecosystem: EcosystemParty[];
  attackPaths: AttackPath[];
  strategicScenarios: StrategicScenario[];
}

export interface Workshop4Data {
  operationalScenarios: OperationalScenario[];
  attackSequences: AttackSequence[];
  riskLevels: RiskLevel[];
}

export interface Workshop5Data {
  treatmentPlan: TreatmentPlan;
  selectedControls: SelectedControl[];
  residualRisks: ResidualRisk[];
}
```

**State Transitions:**

```typescript
// Valid workshop transitions
const WORKSHOP_TRANSITIONS: Record<EbiosWorkshopNumber, EbiosWorkshopNumber[]> = {
  1: [2],      // Workshop 1 can only go to 2
  2: [1, 3],   // Workshop 2 can go back to 1 or forward to 3
  3: [2, 4],   // Workshop 3 can go back to 2 or forward to 4
  4: [3, 5],   // Workshop 4 can go back to 3 or forward to 5
  5: [4],      // Workshop 5 can only go back to 4
};

// Validation: Cannot proceed without completing previous workshop
function canProceedToWorkshop(
  analysis: EbiosAnalysis,
  targetWorkshop: EbiosWorkshopNumber
): boolean {
  if (targetWorkshop === 1) return true;
  const previousWorkshop = (targetWorkshop - 1) as EbiosWorkshopNumber;
  return analysis.workshops[previousWorkshop].status === 'completed'
      || analysis.workshops[previousWorkshop].status === 'validated';
}
```

**Rationale:** Garantit le respect de la méthodologie EBIOS RM tout en permettant les révisions.

---

### ADR-E002: Risk Source Library (Bibliothèque SR)

**Contexte:** EBIOS RM utilise une bibliothèque standard de sources de risque (ANSSI).

**Décision:** Créer une collection de référence avec sources ANSSI pré-chargées + possibilité d'ajout custom.

**Implementation:**

```typescript
// src/types/ebios-library.types.ts

export interface RiskSource {
  id: string;
  code: string;              // Ex: "SR1", "SR2"
  category: RiskSourceCategory;
  name: string;
  description: string;
  motivation?: string;
  resources?: string;
  isANSSIStandard: boolean;  // true = bibliothèque ANSSI
  tenantId?: string;         // null = global, string = custom tenant
  createdAt: Timestamp;
}

export type RiskSourceCategory =
  | 'state_sponsored'        // Étatique
  | 'organized_crime'        // Crime organisé
  | 'terrorist'              // Terroriste
  | 'activist'               // Activiste
  | 'competitor'             // Concurrent
  | 'insider_malicious'      // Interne malveillant
  | 'insider_negligent'      // Interne négligent
  | 'opportunist';           // Opportuniste

export interface TargetedObjective {
  id: string;
  code: string;              // Ex: "OV1", "OV2"
  name: string;
  description: string;
  impactType: 'confidentiality' | 'integrity' | 'availability';
  isANSSIStandard: boolean;
  tenantId?: string;
}

// SR/OV Pair with relevance assessment
export interface SROVPair {
  id: string;
  analysisId: string;
  riskSourceId: string;
  targetedObjectiveId: string;
  relevance: 1 | 2 | 3 | 4;  // 1=Minimal, 4=Maximal
  justification?: string;
  retainedForAnalysis: boolean;
}
```

**Données ANSSI pré-chargées:**

```typescript
// functions/seed/ebios-library.ts

export const ANSSI_RISK_SOURCES: Omit<RiskSource, 'id' | 'createdAt'>[] = [
  {
    code: 'SR1',
    category: 'state_sponsored',
    name: 'État étranger',
    description: 'Acteur étatique menant des opérations cyber offensives',
    motivation: 'Espionnage, sabotage, influence',
    resources: 'Très élevées',
    isANSSIStandard: true,
    tenantId: null,
  },
  {
    code: 'SR2',
    category: 'organized_crime',
    name: 'Crime organisé',
    description: 'Groupes criminels structurés',
    motivation: 'Gain financier',
    resources: 'Élevées',
    isANSSIStandard: true,
    tenantId: null,
  },
  // ... autres sources ANSSI
];

export const ANSSI_TARGETED_OBJECTIVES: Omit<TargetedObjective, 'id'>[] = [
  {
    code: 'OV1',
    name: 'Espionnage',
    description: 'Vol d\'informations sensibles',
    impactType: 'confidentiality',
    isANSSIStandard: true,
    tenantId: null,
  },
  {
    code: 'OV2',
    name: 'Pré-positionnement',
    description: 'Installation de capacités pour actions futures',
    impactType: 'integrity',
    isANSSIStandard: true,
    tenantId: null,
  },
  // ... autres objectifs ANSSI
];
```

**Rationale:** Facilite l'adoption en fournissant les références ANSSI tout en permettant la personnalisation.

---

### ADR-E003: Ecosystem Visualization

**Contexte:** L'atelier 3 EBIOS RM requiert une cartographie visuelle de l'écosystème.

**Décision:** Utiliser un composant de graphe interactif pour visualiser les parties prenantes et chemins d'attaque.

**Implementation:**

```typescript
// src/types/ecosystem.types.ts

export interface EcosystemParty {
  id: string;
  analysisId: string;
  name: string;
  type: EcosystemPartyType;
  category: 'internal' | 'external';
  trustLevel: 1 | 2 | 3 | 4 | 5;  // 1=Très faible, 5=Très élevé
  exposure: 1 | 2 | 3 | 4 | 5;    // 1=Très faible, 5=Très élevé
  cyberdependency: 1 | 2 | 3 | 4 | 5;
  penetration: 1 | 2 | 3 | 4 | 5;
  maturityLevel?: number;
  description?: string;
  position?: { x: number; y: number };  // Pour visualisation
}

export type EcosystemPartyType =
  | 'supplier'           // Fournisseur
  | 'partner'            // Partenaire
  | 'customer'           // Client
  | 'regulator'          // Régulateur
  | 'subcontractor'      // Sous-traitant
  | 'cloud_provider'     // Fournisseur cloud
  | 'software_vendor'    // Éditeur logiciel
  | 'service_provider';  // Prestataire

export interface AttackPath {
  id: string;
  analysisId: string;
  name: string;
  description: string;
  sourcePartyId: string;     // Point d'entrée
  targetAssetId: string;     // Bien visé
  intermediateParties: string[];  // Parties traversées
  likelihood: 1 | 2 | 3 | 4;
  complexity: 1 | 2 | 3 | 4;
}
```

**Composant de visualisation:**

```typescript
// src/components/ebios/EcosystemMap.tsx

import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
} from 'reactflow';

interface EcosystemMapProps {
  parties: EcosystemParty[];
  attackPaths: AttackPath[];
  onPartyClick: (party: EcosystemParty) => void;
  onPathClick: (path: AttackPath) => void;
  editable?: boolean;
}

export function EcosystemMap({
  parties,
  attackPaths,
  onPartyClick,
  onPathClick,
  editable = false,
}: EcosystemMapProps) {
  const nodes: Node[] = useMemo(() =>
    parties.map(party => ({
      id: party.id,
      position: party.position || { x: 0, y: 0 },
      data: {
        label: party.name,
        type: party.type,
        trustLevel: party.trustLevel,
      },
      type: getNodeType(party),
    })),
    [parties]
  );

  const edges: Edge[] = useMemo(() =>
    attackPaths.flatMap(path =>
      path.intermediateParties.map((partyId, index, arr) => ({
        id: `${path.id}-${index}`,
        source: index === 0 ? path.sourcePartyId : arr[index - 1],
        target: partyId,
        animated: true,
        style: { stroke: getPathColor(path.likelihood) },
      }))
    ),
    [attackPaths]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      nodesDraggable={editable}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

**Rationale:** Visualisation interactive conforme à l'approche EBIOS RM tout en utilisant des composants modernes.

---

### ADR-E004: MITRE ATT&CK Integration

**Contexte:** L'atelier 4 EBIOS RM utilise les techniques MITRE ATT&CK pour les scénarios opérationnels.

**Décision:** Intégrer la base MITRE ATT&CK existante (déjà dans le système) avec le module EBIOS.

**Implementation:**

```typescript
// src/types/operational-scenario.types.ts

export interface OperationalScenario {
  id: string;
  analysisId: string;
  strategicScenarioId: string;  // Lien vers scénario stratégique
  name: string;
  description: string;
  attackSequence: AttackStep[];
  likelihood: 1 | 2 | 3 | 4;
  difficulty: 1 | 2 | 3 | 4;
  riskLevel: number;  // Calculé: gravité × vraisemblance
}

export interface AttackStep {
  id: string;
  order: number;
  mitreReference?: {
    tacticId: string;      // Ex: "TA0001" (Initial Access)
    techniqueId: string;   // Ex: "T1566" (Phishing)
    subtechniqueId?: string;
  };
  customDescription?: string;
  targetAsset?: string;
  requiredCapability?: string;
}

// Réutilisation du service MITRE existant
// src/services/mitreService.ts (existant)
import { MitreService } from '@/services/mitreService';

export async function suggestAttackTechniques(
  scenarioContext: string
): Promise<MitreTechnique[]> {
  // Utilise le service MITRE existant
  return MitreService.searchTechniques(scenarioContext);
}
```

**Rationale:** Réutilise l'intégration MITRE ATT&CK existante pour cohérence et maintenance réduite.

---

### ADR-E005: Risk Registry Integration

**Contexte:** Les risques identifiés dans EBIOS RM doivent alimenter le registre de risques existant.

**Décision:** Création automatique de risques dans le registre avec lien bidirectionnel.

**Implementation:**

```typescript
// src/services/ebios/riskIntegrationService.ts

import { RiskService } from '@/services/riskService';
import { Risk, CreateRiskDTO } from '@/types/risk.types';

export class EbiosRiskIntegrationService {
  /**
   * Crée un risque dans le registre depuis un scénario opérationnel EBIOS
   */
  static async createRiskFromScenario(
    tenantId: string,
    scenario: OperationalScenario,
    strategicScenario: StrategicScenario,
    analysisId: string
  ): Promise<Risk> {
    const riskDTO: CreateRiskDTO = {
      title: scenario.name,
      description: scenario.description,
      category: 'operational',
      source: 'ebios_rm',
      ebiosReference: {
        analysisId,
        scenarioId: scenario.id,
        strategicScenarioId: strategicScenario.id,
        workshopNumber: 4,
      },
      inherentRisk: {
        impact: strategicScenario.gravity,
        probability: scenario.likelihood,
        level: strategicScenario.gravity * scenario.likelihood,
      },
      status: 'identified',
      mitreTechniques: scenario.attackSequence
        .filter(step => step.mitreReference)
        .map(step => step.mitreReference!.techniqueId),
    };

    return RiskService.create(tenantId, riskDTO);
  }

  /**
   * Synchronise les modifications EBIOS vers le registre
   */
  static async syncRiskFromEbios(
    tenantId: string,
    scenario: OperationalScenario,
    existingRiskId: string
  ): Promise<void> {
    await RiskService.update(tenantId, existingRiskId, {
      inherentRisk: {
        impact: scenario.gravity,
        probability: scenario.likelihood,
        level: scenario.riskLevel,
      },
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Lie un contrôle ISO 27002 au traitement du risque
   */
  static async linkControlToTreatment(
    tenantId: string,
    riskId: string,
    controlId: string,
    effectiveness: number
  ): Promise<void> {
    await RiskService.addControl(tenantId, riskId, {
      controlId,
      effectiveness,
      linkedAt: Timestamp.now(),
    });
  }
}
```

**Data Flow:**

```
EBIOS Workshop 4           EBIOS Workshop 5
(Scénarios Opérationnels)  (Traitement)
         │                        │
         ▼                        ▼
    ┌─────────────────────────────────────┐
    │        REGISTRE DE RISQUES          │
    │         (Collection existante)      │
    │                                     │
    │  risk.ebiosReference = {            │
    │    analysisId: "...",               │
    │    scenarioId: "...",               │
    │    workshopNumber: 4                │
    │  }                                  │
    └─────────────────────────────────────┘
                    │
                    ▼
           CONTRÔLES ISO 27001
           (Collection existante)
```

**Rationale:** Intégration transparente sans duplication de données.

---

### ADR-E006: SMSI Program Management (ISO 27003)

**Contexte:** ISO 27003 requiert un pilotage du programme SMSI avec le cycle PDCA.

**Décision:** Créer un module de gestion de programme intégré au dashboard existant.

**Implementation:**

```typescript
// src/types/smsi-program.types.ts

export interface SMSIProgram {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  targetCertificationDate?: Timestamp;
  currentPhase: PDCAPhase;
  phases: {
    plan: PDCAPhaseData;
    do: PDCAPhaseData;
    check: PDCAPhaseData;
    act: PDCAPhaseData;
  };
  overallProgress: number;  // 0-100
  status: 'active' | 'paused' | 'completed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PDCAPhase = 'plan' | 'do' | 'check' | 'act';

export interface PDCAPhaseData {
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  progress: number;
  milestones: Milestone[];
  responsibleId?: string;
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  dueDate: Timestamp;
  completedAt?: Timestamp;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  linkedItems?: {
    type: 'ebios_analysis' | 'risk' | 'control' | 'document' | 'audit';
    id: string;
  }[];
}

// Score contribution
export interface SMSIProgramScore {
  programId: string;
  overallScore: number;
  phaseScores: {
    plan: number;
    do: number;
    check: number;
    act: number;
  };
  calculatedAt: Timestamp;
}
```

**Dashboard Widget:**

```typescript
// src/components/dashboard/widgets/SMSIProgramWidget.tsx

export function SMSIProgramWidget() {
  const { program, loading } = useSMSIProgram();

  if (loading) return <WidgetSkeleton />;
  if (!program) return <SMSIProgramCTA />;

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle>Programme SMSI</CardTitle>
        <Badge variant={getPhaseVariant(program.currentPhase)}>
          {getPhaseName(program.currentPhase)}
        </Badge>
      </CardHeader>
      <CardContent>
        <PDCAProgressRing
          phases={program.phases}
          currentPhase={program.currentPhase}
        />
        <div className="mt-4 space-y-2">
          {getUpcomingMilestones(program).map(milestone => (
            <MilestoneItem key={milestone.id} milestone={milestone} />
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" asChild>
          <Link to="/smsi-program">Voir le programme</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
```

**Rationale:** Vue management intégrée au dashboard pour suivi PDCA sans complexité excessive.

---

### ADR-E007: EBIOS Completion Score

**Contexte:** La progression EBIOS RM doit contribuer au score global de conformité.

**Décision:** Étendre le calcul de score existant (ADR-003) pour inclure EBIOS.

**Implementation:**

```typescript
// functions/triggers/onEbiosChange.ts

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { calculateEbiosScore } from '../shared/ebiosScoreCalculator';
import { updateGlobalScore } from '../shared/scoreService';

export const onEbiosAnalysisChange = onDocumentWritten(
  'tenants/{tenantId}/ebiosAnalyses/{analysisId}',
  async (event) => {
    const { tenantId } = event.params;
    const analysis = event.data?.after?.data();

    if (!analysis) return;

    // Calcul du score EBIOS
    const ebiosScore = calculateEbiosScore(analysis);

    // Mise à jour du score EBIOS dans la collection scores
    await event.data?.after?.ref.update({
      completionPercentage: ebiosScore.completion,
      lastScoreUpdate: Timestamp.now(),
    });

    // Mise à jour du score global (incluant EBIOS)
    await updateGlobalScore(tenantId, {
      ebios: ebiosScore.weighted,
    });
  }
);

// Score calculation logic
export function calculateEbiosScore(analysis: EbiosAnalysis): {
  completion: number;
  weighted: number;
} {
  const workshopWeights = {
    1: 0.15,  // Cadrage
    2: 0.15,  // Sources
    3: 0.20,  // Scénarios stratégiques
    4: 0.25,  // Scénarios opérationnels
    5: 0.25,  // Traitement
  };

  let totalScore = 0;

  for (const [workshop, weight] of Object.entries(workshopWeights)) {
    const workshopData = analysis.workshops[Number(workshop) as EbiosWorkshopNumber];
    const workshopScore = getWorkshopCompletionScore(workshopData);
    totalScore += workshopScore * weight;
  }

  return {
    completion: Math.round(totalScore * 100),
    weighted: totalScore * 0.20,  // EBIOS = 20% du score global
  };
}
```

**Score Global Mis à Jour:**

```typescript
// Extension du score existant (ADR-003)
export interface ComplianceScore {
  global: number;
  byFramework: {
    iso27001: number;
    nis2: number;
    dora: number;
    rgpd: number;
  };
  byComponent: {
    risks: { score: number; weight: 0.25 };
    controls: { score: number; weight: 0.30 };
    documents: { score: number; weight: 0.15 };
    audits: { score: number; weight: 0.10 };
    ebios: { score: number; weight: 0.20 };  // NOUVEAU
  };
  trend: 'up' | 'down' | 'stable';
  lastCalculated: Timestamp;
}
```

**Rationale:** Cohérence avec le système de score existant, visible dans le dashboard dirigeant.

---

## Project Structure Extension

### New Directories & Files

```
src/
├── components/
│   ├── ebios/                          # 🆕 Module EBIOS RM
│   │   ├── EbiosWizard.tsx             # Wizard principal
│   │   ├── WorkshopStepper.tsx         # Navigation ateliers
│   │   ├── WorkshopProgress.tsx        # Barre de progression
│   │   │
│   │   ├── workshop1/                  # Atelier 1: Cadrage
│   │   │   ├── ScopeDefinition.tsx
│   │   │   ├── MissionsList.tsx
│   │   │   ├── EssentialAssets.tsx
│   │   │   ├── SupportingAssets.tsx
│   │   │   ├── FearedEvents.tsx
│   │   │   └── SecurityBaseline.tsx
│   │   │
│   │   ├── workshop2/                  # Atelier 2: Sources
│   │   │   ├── RiskSourceSelector.tsx
│   │   │   ├── RiskSourceLibrary.tsx
│   │   │   ├── TargetedObjectives.tsx
│   │   │   ├── SROVMatrix.tsx
│   │   │   └── SROVPairEditor.tsx
│   │   │
│   │   ├── workshop3/                  # Atelier 3: Stratégique
│   │   │   ├── EcosystemMap.tsx
│   │   │   ├── EcosystemPartyEditor.tsx
│   │   │   ├── AttackPathBuilder.tsx
│   │   │   ├── StrategicScenarioList.tsx
│   │   │   └── GravityAssessment.tsx
│   │   │
│   │   ├── workshop4/                  # Atelier 4: Opérationnel
│   │   │   ├── OperationalScenarioBuilder.tsx
│   │   │   ├── AttackSequenceEditor.tsx
│   │   │   ├── MitreSelector.tsx
│   │   │   ├── LikelihoodAssessment.tsx
│   │   │   └── RiskLevelCalculator.tsx
│   │   │
│   │   ├── workshop5/                  # Atelier 5: Traitement
│   │   │   ├── TreatmentPlanEditor.tsx
│   │   │   ├── ControlSelector.tsx
│   │   │   ├── ResidualRiskCalculator.tsx
│   │   │   └── EbiosSummaryReport.tsx
│   │   │
│   │   └── shared/                     # Composants partagés EBIOS
│   │       ├── EbiosAnalysisList.tsx
│   │       ├── EbiosAnalysisCard.tsx
│   │       ├── WorkshopStatusBadge.tsx
│   │       └── EbiosScoreGauge.tsx
│   │
│   ├── smsi-program/                   # 🆕 Module Programme SMSI
│   │   ├── SMSIProgramDashboard.tsx
│   │   ├── PDCATimeline.tsx
│   │   ├── PDCAPhaseCard.tsx
│   │   ├── MilestoneList.tsx
│   │   ├── MilestoneEditor.tsx
│   │   └── ProgramProgressRing.tsx
│   │
│   └── dashboard/
│       └── widgets/
│           ├── EbiosProgressWidget.tsx   # 🆕
│           └── SMSIProgramWidget.tsx     # 🆕
│
├── hooks/
│   ├── ebios/                          # 🆕
│   │   ├── useEbiosAnalysis.ts
│   │   ├── useEbiosWorkshop.ts
│   │   ├── useRiskSources.ts
│   │   ├── useEcosystem.ts
│   │   └── useEbiosScore.ts
│   │
│   └── smsi/                           # 🆕
│       ├── useSMSIProgram.ts
│       └── usePDCAPhase.ts
│
├── services/
│   ├── ebios/                          # 🆕
│   │   ├── ebiosAnalysisService.ts
│   │   ├── workshopService.ts
│   │   ├── riskSourceService.ts
│   │   ├── ecosystemService.ts
│   │   ├── scenarioService.ts
│   │   ├── treatmentService.ts
│   │   └── riskIntegrationService.ts
│   │
│   └── smsi/                           # 🆕
│       ├── smsiProgramService.ts
│       └── milestoneService.ts
│
├── types/
│   ├── ebios.types.ts                  # 🆕
│   ├── ebios-library.types.ts          # 🆕
│   ├── ecosystem.types.ts              # 🆕
│   ├── operational-scenario.types.ts   # 🆕
│   └── smsi-program.types.ts           # 🆕
│
├── schemas/
│   ├── ebios.schema.ts                 # 🆕
│   └── smsi-program.schema.ts          # 🆕
│
└── pages/
    ├── ebios/                          # 🆕
    │   ├── EbiosListPage.tsx
    │   ├── EbiosAnalysisPage.tsx
    │   └── EbiosReportPage.tsx
    │
    └── smsi-program/                   # 🆕
        ├── SMSIProgramPage.tsx
        └── MilestonePage.tsx

functions/
├── triggers/
│   ├── onEbiosChange.ts                # 🆕
│   └── onSMSIProgramChange.ts          # 🆕
│
├── callable/
│   ├── generateEbiosReport.ts          # 🆕
│   └── calculateEbiosScore.ts          # 🆕
│
└── seed/
    └── ebios-library.ts                # 🆕 Données ANSSI
```

### Firestore Collections Extension

```
tenants/{tenantId}/
├── ebiosAnalyses/                      # 🆕 Analyses EBIOS RM
│   └── {analysisId}/
│       ├── workshops/                  # Données des ateliers
│       │   ├── workshop1/
│       │   ├── workshop2/
│       │   ├── workshop3/
│       │   ├── workshop4/
│       │   └── workshop5/
│       ├── scenarios/                  # Scénarios (stratégiques + opérationnels)
│       └── treatments/                 # Plans de traitement
│
├── riskSources/                        # 🆕 Sources de risque custom
├── targetedObjectives/                 # 🆕 Objectifs visés custom
├── ecosystemParties/                   # 🆕 Parties prenantes
│
├── smsiProgram/                        # 🆕 Programme SMSI (1 par tenant)
│   └── milestones/                     # Jalons du programme
│
└── riskContexts/                       # 🆕 Contexte ISO 27005

# Collections globales (read-only pour tenants)
ebiosLibrary/                           # 🆕 Bibliothèque ANSSI
├── riskSources/                        # Sources standard
└── targetedObjectives/                 # Objectifs standard
```

### Firestore Security Rules Extension

```javascript
// firestore.rules (extension)

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // EBIOS Analyses - tenant isolated
    match /tenants/{tenantId}/ebiosAnalyses/{analysisId} {
      allow read: if isAuthenticated() && belongsToTenant(tenantId);
      allow create: if isAuthenticated() && belongsToTenant(tenantId)
                    && hasRole(['admin', 'rssi']);
      allow update: if isAuthenticated() && belongsToTenant(tenantId)
                    && hasRole(['admin', 'rssi']);
      allow delete: if isAuthenticated() && belongsToTenant(tenantId)
                    && hasRole(['admin']);

      // Subcollections
      match /{subcollection}/{docId} {
        allow read, write: if isAuthenticated() && belongsToTenant(tenantId)
                          && hasRole(['admin', 'rssi']);
      }
    }

    // SMSI Program - tenant isolated
    match /tenants/{tenantId}/smsiProgram/{docId} {
      allow read: if isAuthenticated() && belongsToTenant(tenantId);
      allow write: if isAuthenticated() && belongsToTenant(tenantId)
                   && hasRole(['admin', 'rssi', 'project_manager']);
    }

    // EBIOS Library - global read-only
    match /ebiosLibrary/{collection}/{docId} {
      allow read: if isAuthenticated();
      allow write: if false;  // Admin seeding only via functions
    }
  }
}
```

---

## Implementation Patterns

### EBIOS Workshop Form Pattern

```typescript
// Pattern pour tous les formulaires d'atelier
// src/components/ebios/workshop1/EssentialAssets.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { essentialAssetSchema } from '@/schemas/ebios.schema';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useDraftMode } from '@/hooks/useDraftMode';
import { useLocale } from '@/hooks/useLocale';

export function EssentialAssets({ analysisId, workshopData, onComplete }) {
  const { locale } = useLocale();
  const { isDraft, setDraft } = useDraftMode();

  const form = useForm({
    resolver: zodResolver(essentialAssetSchema),
    defaultValues: workshopData?.essentialAssets || [],
  });

  // Auto-save every 30s (ADR-002)
  const saveStatus = useAutoSave(form.watch(), async (data) => {
    await WorkshopService.saveWorkshop1Data(analysisId, {
      essentialAssets: data,
    });
  });

  const onSubmit = async (data) => {
    await WorkshopService.completeWorkshop1Section(analysisId, 'essentialAssets', data);
    onComplete();
  };

  return (
    <Card className="glass-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('ebios.workshop1.essentialAssets')}</CardTitle>
          <AutoSaveIndicator status={saveStatus} />
        </div>
        {isDraft && <DraftBadge />}
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Form fields */}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

### EBIOS Service Pattern

```typescript
// src/services/ebios/workshopService.ts

import { db } from '@/firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';

export class WorkshopService {
  static getWorkshopRef(tenantId: string, analysisId: string, workshopNum: number) {
    return doc(db, `tenants/${tenantId}/ebiosAnalyses/${analysisId}/workshops/workshop${workshopNum}`);
  }

  static async saveWorkshopData<T>(
    tenantId: string,
    analysisId: string,
    workshopNum: EbiosWorkshopNumber,
    data: Partial<T>
  ): Promise<void> {
    const ref = this.getWorkshopRef(tenantId, analysisId, workshopNum);
    await updateDoc(ref, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  }

  static async completeWorkshop(
    tenantId: string,
    analysisId: string,
    workshopNum: EbiosWorkshopNumber
  ): Promise<void> {
    const analysisRef = doc(db, `tenants/${tenantId}/ebiosAnalyses/${analysisId}`);

    await updateDoc(analysisRef, {
      [`workshops.${workshopNum}.status`]: 'completed',
      [`workshops.${workshopNum}.completedAt`]: Timestamp.now(),
      currentWorkshop: Math.min(workshopNum + 1, 5) as EbiosWorkshopNumber,
      updatedAt: Timestamp.now(),
    });
  }

  static async validateWorkshop(
    tenantId: string,
    analysisId: string,
    workshopNum: EbiosWorkshopNumber,
    validatedBy: string
  ): Promise<void> {
    const analysisRef = doc(db, `tenants/${tenantId}/ebiosAnalyses/${analysisId}`);

    await updateDoc(analysisRef, {
      [`workshops.${workshopNum}.status`]: 'validated',
      [`workshops.${workshopNum}.validatedBy`]: validatedBy,
      updatedAt: Timestamp.now(),
    });
  }
}
```

---

## Architecture Validation

### Coherence with Existing Architecture

| ADR Existant | Application EBIOS | Status |
|--------------|-------------------|--------|
| ADR-001 (Locale) | Tous formulaires EBIOS utilisent localeConfig | ✅ |
| ADR-002 (Draft/Auto-save) | Chaque atelier supporte draft + auto-save | ✅ |
| ADR-003 (Score) | Score EBIOS contribue au score global | ✅ |
| ADR-004 (Dashboard) | Widgets EBIOS dans dashboard configurable | ✅ |
| ADR-005 (Multi-Framework) | Mapping EBIOS → ISO 27001 contrôles | ✅ |
| ADR-006 (Wizard SMSI) | EBIOS peut alimenter le wizard existant | ✅ |
| ADR-007 (Notifications) | Alertes jalons SMSI | ✅ |

### Non-Breaking Change Verification

| Composant | Impact | Verification |
|-----------|--------|--------------|
| Risk Registry | Additive (nouveau champ ebiosReference) | ✅ Migration non-destructive |
| Score Calculation | Additive (nouveau composant ebios) | ✅ Rétrocompatible |
| Dashboard | Additive (nouveaux widgets optionnels) | ✅ Widgets existants préservés |
| Firestore Rules | Additive (nouvelles collections) | ✅ Collections existantes inchangées |
| UI Components | Additive (nouveau module) | ✅ Composants existants inchangés |

### Implementation Readiness

**✅ READY FOR IMPLEMENTATION**

- 7 ADRs d'extension documentés
- Structure fichiers complète
- Patterns d'implémentation définis
- Intégrations spécifiées
- Validation de cohérence passée

---

*Architecture Document généré par BMad Method - Architect Agent*
*Date: 2026-01-16*
*Extension pour: Sentinel GRC v2*
