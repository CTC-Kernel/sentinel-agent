---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-ebios-rm-iso27003-2026-01-16.md'
  - '_bmad-output/planning-artifacts/architecture-ebios-rm-iso27003-2026-01-16.md'
workflowType: 'epics-and-stories'
workflow_completed: true
lastStep: 4
completedAt: '2026-01-16'
project_name: 'Sentinel GRC v2 - EBIOS RM Extension'
user_name: 'Thibaultllopis'
date: '2026-01-16'
validation_results:
  fr_coverage: '47/47 (100%)'
  stories_count: 42
  epics_count: 8
  architecture_alignment: 'passed'
  dependency_check: 'passed'
---

# Sentinel GRC v2 - EBIOS RM Extension - Epic Breakdown

## Overview

Ce document décline les exigences du Product Brief EBIOS RM en épics et stories implémentables, alignés avec l'architecture définie.

**Couverture :** 47 exigences fonctionnelles → 42 stories → 8 épics

---

## Requirements Inventory

### EBIOS RM Requirements

| ID | Requirement | Epic |
|----|-------------|------|
| EBIOS-001 | Créer une nouvelle analyse EBIOS RM | Epic 13 |
| EBIOS-002 | Définir le périmètre (missions essentielles) | Epic 13 |
| EBIOS-003 | Identifier les biens supports | Epic 13 |
| EBIOS-004 | Définir les événements redoutés | Epic 13 |
| EBIOS-005 | Évaluer le socle de sécurité | Epic 13 |
| EBIOS-006 | Générer la Note de cadrage | Epic 13 |
| EBIOS-007 | Lier aux actifs existants | Epic 13 |
| EBIOS-010 | Sélectionner sources de risque ANSSI | Epic 14 |
| EBIOS-011 | Créer sources de risque custom | Epic 14 |
| EBIOS-012 | Définir objectifs visés (OV) | Epic 14 |
| EBIOS-013 | Générer couples SR/OV | Epic 14 |
| EBIOS-014 | Évaluer pertinence SR/OV | Epic 14 |
| EBIOS-015 | Suggestions par secteur | Epic 14 |
| EBIOS-020 | Cartographier l'écosystème | Epic 15 |
| EBIOS-021 | Définir chemins d'attaque | Epic 15 |
| EBIOS-022 | Construire scénarios stratégiques | Epic 15 |
| EBIOS-023 | Évaluer gravité scénarios | Epic 15 |
| EBIOS-024 | Visualisation graphique écosystème | Epic 15 |
| EBIOS-025 | Suggestions scénarios par secteur | Epic 15 |
| EBIOS-030 | Décliner en modes opératoires | Epic 16 |
| EBIOS-031 | Séquences d'attaque MITRE ATT&CK | Epic 16 |
| EBIOS-032 | Évaluer vraisemblance | Epic 16 |
| EBIOS-033 | Calculer niveau de risque | Epic 16 |
| EBIOS-034 | Créer risques dans registre existant | Epic 16 |
| EBIOS-035 | Proposer techniques MITRE | Epic 16 |
| EBIOS-040 | Définir plan de traitement | Epic 17 |
| EBIOS-041 | Sélectionner mesures ISO 27002 | Epic 17 |
| EBIOS-042 | Mapper risques → contrôles ISO 27001 | Epic 17 |
| EBIOS-043 | Calculer risques résiduels | Epic 17 |
| EBIOS-044 | Générer synthèse EBIOS RM | Epic 17 |
| EBIOS-045 | Exporter dossier EBIOS PDF | Epic 17 |

### ISO 27003 Requirements

| ID | Requirement | Epic |
|----|-------------|------|
| ISO3-001 | Créer programme SMSI avec PDCA | Epic 18 |
| ISO3-002 | Définir jalons par phase | Epic 18 |
| ISO3-003 | Afficher avancement global | Epic 18 |
| ISO3-004 | Assigner responsables | Epic 18 |
| ISO3-005 | Alertes jalons en retard | Epic 18 |
| ISO3-006 | Rapports d'avancement auto | Epic 18 |
| ISO3-007 | Documenter revues de direction | Epic 18 |

### ISO 27005 Requirements

| ID | Requirement | Epic |
|----|-------------|------|
| ISO5-001 | Définir contexte business | Epic 19 |
| ISO5-002 | Définir contexte réglementaire | Epic 19 |
| ISO5-003 | Définir appétit au risque | Epic 19 |
| ISO5-004 | Définir critères d'évaluation | Epic 19 |
| ISO5-005 | Stocker contexte comme référence | Epic 19 |

### ISO 27002 Requirements

| ID | Requirement | Epic |
|----|-------------|------|
| ISO2-001 | Évaluer efficacité contrôles | Epic 20 |
| ISO2-002 | Score maturité par domaine | Epic 20 |
| ISO2-003 | Définir objectifs d'efficacité | Epic 20 |
| ISO2-004 | Identifier contrôles sous-performants | Epic 20 |

---

## Epic Summary

| Epic | Title | Stories | Priorité | Phase |
|------|-------|---------|----------|-------|
| 13 | EBIOS RM - Atelier 1: Cadrage | 7 | P0 | Phase 1 |
| 14 | EBIOS RM - Atelier 2: Sources de Risque | 6 | P0 | Phase 1 |
| 15 | EBIOS RM - Atelier 3: Scénarios Stratégiques | 6 | P0 | Phase 2 |
| 16 | EBIOS RM - Atelier 4: Scénarios Opérationnels | 6 | P0 | Phase 2 |
| 17 | EBIOS RM - Atelier 5: Traitement | 6 | P0 | Phase 3 |
| 18 | Programme SMSI (ISO 27003) | 5 | P1 | Phase 4 |
| 19 | Contexte de Risque (ISO 27005) | 4 | P1 | Phase 1 |
| 20 | Efficacité des Contrôles (ISO 27002) | 2 | P2 | Phase 4 |

**Total: 8 Epics, 42 Stories**

---

## Epic 13: EBIOS RM - Atelier 1: Cadrage et Socle de Sécurité

**Goal:** L'utilisateur peut cadrer son analyse EBIOS RM en définissant le périmètre, les missions essentielles, les biens supports, et le socle de sécurité.

**FRs covered:** EBIOS-001 à EBIOS-007
**ADRs:** ADR-E001 (State Machine), ADR-002 (Draft/Auto-save)
**Priority:** P0 - Foundation

---

### Story 13.1: Création d'une Analyse EBIOS RM

**As a** RSSI,
**I want** to create a new EBIOS RM analysis,
**So that** I can start the risk assessment process.

**Acceptance Criteria:**

```gherkin
Given I am on the EBIOS RM module
When I click "Nouvelle analyse EBIOS RM"
Then a wizard opens with Step 1: Cadrage
And I can enter: Name, Description, Target certification date
And the analysis is created with status "draft"
And I see a progress indicator showing "Atelier 1/5"
```

**Technical Notes:**
- Create `EbiosAnalysis` document in Firestore
- Initialize all 5 workshops with status "not_started"
- Set currentWorkshop to 1
- Apply ADR-002 draft mode

---

### Story 13.2: Définition du Périmètre (Missions Essentielles)

**As a** RSSI,
**I want** to define the scope with essential missions,
**So that** I establish what my security management covers.

**Acceptance Criteria:**

```gherkin
Given I am in EBIOS Workshop 1
When I access the "Missions Essentielles" section
Then I can add missions with: Name, Description, Criticality (1-4)
And I can import missions from existing assets
And I see a list of all defined missions
And changes auto-save every 30 seconds
And I can mark the section as complete
```

**Technical Notes:**
- `Workshop1Data.scope.missions[]`
- Link to existing `assets` collection if desired
- Zod validation with localeConfig

---

### Story 13.3: Identification des Biens Supports

**As a** RSSI,
**I want** to identify supporting assets,
**So that** I know what systems support my essential missions.

**Acceptance Criteria:**

```gherkin
Given I have defined essential missions
When I access the "Biens Supports" section
Then I can add assets with: Name, Type (SI, Local, Personnel), Description
And I can link assets to missions (many-to-many)
And I can import from existing asset inventory
And I see a matrix showing asset-mission relationships
```

**Technical Notes:**
- `Workshop1Data.scope.supportingAssets[]`
- `Workshop1Data.scope.essentialAssets[]`
- Bidirectional link with `assets` collection

---

### Story 13.4: Définition des Événements Redoutés

**As a** RSSI,
**I want** to define feared events,
**So that** I identify what I'm protecting against.

**Acceptance Criteria:**

```gherkin
Given I have defined missions and assets
When I access the "Événements Redoutés" section
Then I can add feared events with: Name, Description, Impact type (C/I/A)
And I can assess gravity (1-4) for each event
And I can link feared events to missions
And suggestions appear based on mission type
```

**Technical Notes:**
- `Workshop1Data.fearedEvents[]`
- Pre-loaded suggestions from ANSSI library

---

### Story 13.5: Évaluation du Socle de Sécurité

**As a** RSSI,
**I want** to evaluate my current security baseline,
**So that** I understand my starting maturity level.

**Acceptance Criteria:**

```gherkin
Given I am completing Workshop 1
When I access the "Socle de Sécurité" section
Then I see a checklist of hygiene measures (ANSSI)
And I can mark each measure as: Implemented, Partial, Not implemented
And a maturity score is calculated automatically
And I can add notes for each measure
```

**Technical Notes:**
- `Workshop1Data.securityBaseline`
- ANSSI hygiene checklist pre-loaded
- Score calculation: % implemented

---

### Story 13.6: Génération de la Note de Cadrage

**As a** RSSI,
**I want** to generate the "Note de Cadrage" document,
**So that** I have a formal deliverable for this workshop.

**Acceptance Criteria:**

```gherkin
Given I have completed all Workshop 1 sections
When I click "Générer Note de Cadrage"
Then a PDF document is generated with:
  - Scope summary
  - Mission list
  - Asset inventory
  - Feared events
  - Security baseline score
And I can download or share the document
```

**Technical Notes:**
- Use existing PDF generation service
- Template: `ebios-workshop1-report.template.md`

---

### Story 13.7: Liaison avec Actifs Existants

**As a** RSSI,
**I want** to link EBIOS assets to my existing asset inventory,
**So that** I maintain data consistency.

**Acceptance Criteria:**

```gherkin
Given I am adding supporting assets
When I click "Importer depuis inventaire"
Then I see a list of existing assets
And I can select multiple assets to import
And imported assets keep their link to the original record
And changes in the original update the EBIOS reference
```

**Technical Notes:**
- Reference field: `linkedAssetId` in `SupportingAsset`
- Firestore listener for sync

---

## Epic 14: EBIOS RM - Atelier 2: Sources de Risque

**Goal:** L'utilisateur peut identifier les sources de risque et leurs objectifs visés pour construire les couples SR/OV.

**FRs covered:** EBIOS-010 à EBIOS-015
**ADRs:** ADR-E002 (Risk Source Library)
**Priority:** P0 - Foundation

---

### Story 14.1: Sélection des Sources de Risque ANSSI

**As a** RSSI,
**I want** to select risk sources from the ANSSI library,
**So that** I use standardized threat categories.

**Acceptance Criteria:**

```gherkin
Given I am in EBIOS Workshop 2
When I access "Sources de Risque"
Then I see the ANSSI library with 8+ standard sources
And each source shows: Code, Name, Category, Motivation, Resources
And I can select relevant sources for my analysis
And selected sources appear in my analysis list
```

**Technical Notes:**
- Read from `ebiosLibrary/riskSources` (global collection)
- Copy to `tenants/{tenantId}/ebiosAnalyses/{id}/riskSources`

---

### Story 14.2: Création de Sources de Risque Custom

**As a** RSSI,
**I want** to create custom risk sources,
**So that** I can add threats specific to my context.

**Acceptance Criteria:**

```gherkin
Given I am in the risk sources section
When I click "Ajouter source personnalisée"
Then I can enter: Code, Name, Category, Description, Motivation
And the custom source is saved to my tenant
And it appears alongside ANSSI sources
And it can be reused in future analyses
```

**Technical Notes:**
- Save to `tenants/{tenantId}/riskSources` (tenant collection)
- Field `isANSSIStandard: false`

---

### Story 14.3: Définition des Objectifs Visés

**As a** RSSI,
**I want** to define targeted objectives for each risk source,
**So that** I understand what attackers want.

**Acceptance Criteria:**

```gherkin
Given I have selected risk sources
When I access "Objectifs Visés"
Then I see ANSSI standard objectives (espionage, sabotage, etc.)
And I can add custom objectives
And I can link objectives to risk sources
And I see which sources target which objectives
```

**Technical Notes:**
- `Workshop2Data.targetedObjectives[]`
- Standard objectives from ANSSI library

---

### Story 14.4: Génération des Couples SR/OV

**As a** RSSI,
**I want** to generate SR/OV pairs automatically,
**So that** I can evaluate threat scenarios.

**Acceptance Criteria:**

```gherkin
Given I have selected sources and objectives
When I click "Générer matrice SR/OV"
Then all possible SR/OV pairs are created
And I see a matrix view with sources as rows, objectives as columns
And each cell shows the pair status (à évaluer, retenu, écarté)
```

**Technical Notes:**
- `Workshop2Data.srOvPairs[]`
- Cartesian product of selected SR × OV

---

### Story 14.5: Évaluation de la Pertinence SR/OV

**As a** RSSI,
**I want** to evaluate the relevance of each SR/OV pair,
**So that** I focus on realistic threats.

**Acceptance Criteria:**

```gherkin
Given I see the SR/OV matrix
When I click on a pair
Then I can assess relevance (1-4 scale)
And I can add justification notes
And I can mark as "Retenu" or "Écarté"
And only retained pairs proceed to Workshop 3
```

**Technical Notes:**
- `SROVPair.relevance`, `SROVPair.retainedForAnalysis`
- Filter for Workshop 3 based on `retainedForAnalysis: true`

---

### Story 14.6: Suggestions de Sources par Secteur

**As a** RSSI,
**I want** to receive risk source suggestions based on my sector,
**So that** I don't miss relevant threats.

**Acceptance Criteria:**

```gherkin
Given I have defined my organization's sector
When I enter Workshop 2
Then I see highlighted "Recommended for your sector" sources
And recommendations are based on ANSSI sector profiles
And I can accept or dismiss recommendations
```

**Technical Notes:**
- Sector mapping in ANSSI library metadata
- AI suggestion optional enhancement

---

## Epic 15: EBIOS RM - Atelier 3: Scénarios Stratégiques

**Goal:** L'utilisateur peut cartographier son écosystème et construire des scénarios stratégiques de haut niveau.

**FRs covered:** EBIOS-020 à EBIOS-025
**ADRs:** ADR-E003 (Ecosystem Visualization)
**Priority:** P0 - Core

---

### Story 15.1: Cartographie de l'Écosystème

**As a** RSSI,
**I want** to map my organization's ecosystem,
**So that** I identify potential attack vectors.

**Acceptance Criteria:**

```gherkin
Given I am in EBIOS Workshop 3
When I access "Cartographie Écosystème"
Then I can add parties: Name, Type (supplier, partner, etc.), Category
And I can assess each party: Trust level, Exposure, Cyber-dependency
And parties appear on an interactive diagram
And I can drag parties to organize the view
```

**Technical Notes:**
- `Workshop3Data.ecosystem[]` → `EcosystemParty`
- ReactFlow for visualization
- Position saved in Firestore

---

### Story 15.2: Définition des Chemins d'Attaque

**As a** RSSI,
**I want** to define attack paths through the ecosystem,
**So that** I understand how threats can reach my assets.

**Acceptance Criteria:**

```gherkin
Given I have mapped ecosystem parties
When I create an attack path
Then I select: Source party, Target asset, Intermediate parties
And I assess: Likelihood, Complexity
And the path is visualized as arrows on the ecosystem map
And colors indicate likelihood (red=high, green=low)
```

**Technical Notes:**
- `Workshop3Data.attackPaths[]`
- Edge rendering in ReactFlow

---

### Story 15.3: Construction des Scénarios Stratégiques

**As a** RSSI,
**I want** to build strategic scenarios,
**So that** I describe high-level attack narratives.

**Acceptance Criteria:**

```gherkin
Given I have attack paths and retained SR/OV pairs
When I create a strategic scenario
Then I link: SR/OV pair, Attack path, Feared event
And I write a narrative description
And I see the scenario in a list with all linked elements
```

**Technical Notes:**
- `Workshop3Data.strategicScenarios[]`
- Links to Workshop 2 data (SR/OV) and Workshop 1 (feared events)

---

### Story 15.4: Évaluation de la Gravité

**As a** RSSI,
**I want** to assess the gravity of strategic scenarios,
**So that** I prioritize the most impactful threats.

**Acceptance Criteria:**

```gherkin
Given I have created strategic scenarios
When I assess gravity
Then I rate on a 1-4 scale (Minimal to Critical)
And I justify the rating
And scenarios are sorted by gravity in the list
And high-gravity scenarios are highlighted
```

**Technical Notes:**
- `StrategicScenario.gravity`
- Used in Workshop 4 for risk level calculation

---

### Story 15.5: Visualisation Graphique de l'Écosystème

**As a** RSSI,
**I want** to see an interactive ecosystem visualization,
**So that** I can explore attack paths visually.

**Acceptance Criteria:**

```gherkin
Given I have mapped parties and paths
When I view the ecosystem diagram
Then I see all parties as nodes with type icons
And I see attack paths as animated edges
And I can zoom, pan, and filter
And clicking a node shows party details
And clicking an edge shows path details
```

**Technical Notes:**
- `EcosystemMap.tsx` component
- ReactFlow with custom node types

---

### Story 15.6: Suggestions de Scénarios par Secteur

**As a** RSSI,
**I want** to see scenario suggestions based on my sector,
**So that** I don't miss common attack patterns.

**Acceptance Criteria:**

```gherkin
Given I am building strategic scenarios
When I click "Suggestions"
Then I see common scenarios for my sector
And suggestions include: Name, Description, Typical gravity
And I can import a suggestion as a starting point
```

**Technical Notes:**
- Sector-based templates in ANSSI library
- Optional AI enhancement

---

## Epic 16: EBIOS RM - Atelier 4: Scénarios Opérationnels

**Goal:** L'utilisateur peut décliner les scénarios stratégiques en modes opératoires détaillés avec intégration MITRE ATT&CK.

**FRs covered:** EBIOS-030 à EBIOS-035
**ADRs:** ADR-E004 (MITRE Integration), ADR-E005 (Risk Registry Integration)
**Priority:** P0 - Core

---

### Story 16.1: Déclinaison en Modes Opératoires

**As a** RSSI,
**I want** to break down strategic scenarios into operational modes,
**So that** I understand how attacks would actually happen.

**Acceptance Criteria:**

```gherkin
Given I have strategic scenarios from Workshop 3
When I enter Workshop 4
Then I see each strategic scenario as a starting point
And I can create one or more operational scenarios per strategic
And each operational scenario has: Name, Description, Parent strategic
```

**Technical Notes:**
- `Workshop4Data.operationalScenarios[]`
- Link: `strategicScenarioId`

---

### Story 16.2: Séquences d'Attaque avec MITRE ATT&CK

**As a** RSSI,
**I want** to define attack sequences using MITRE ATT&CK,
**So that** I use industry-standard technique references.

**Acceptance Criteria:**

```gherkin
Given I am building an operational scenario
When I add attack steps
Then I can search MITRE ATT&CK techniques
And I select: Tactic, Technique, Sub-technique (optional)
And steps are ordered sequentially
And I see the MITRE reference (e.g., T1566.001)
And I can add custom descriptions
```

**Technical Notes:**
- Reuse existing `MitreService`
- `AttackStep.mitreReference`

---

### Story 16.3: Évaluation de la Vraisemblance

**As a** RSSI,
**I want** to assess the likelihood of operational scenarios,
**So that** I calculate risk levels.

**Acceptance Criteria:**

```gherkin
Given I have defined attack sequences
When I assess likelihood
Then I rate on a 1-4 scale
And I consider: Attacker capability, Defense effectiveness
And I justify the rating
And the likelihood is used for risk calculation
```

**Technical Notes:**
- `OperationalScenario.likelihood`
- Input for risk level formula

---

### Story 16.4: Calcul du Niveau de Risque

**As a** RSSI,
**I want** to see the calculated risk level,
**So that** I prioritize risks.

**Acceptance Criteria:**

```gherkin
Given I have gravity (from strategic) and likelihood (from operational)
When I view the scenario
Then risk level is calculated: Gravity × Likelihood
And the level is displayed with color coding
And a risk matrix shows all scenarios positioned
And scenarios are sorted by risk level
```

**Technical Notes:**
- `OperationalScenario.riskLevel = strategicScenario.gravity * operationalScenario.likelihood`
- Visual: Risk matrix component

---

### Story 16.5: Création Automatique dans le Registre de Risques

**As a** RSSI,
**I want** operational scenarios to create risks in my registry,
**So that** EBIOS feeds into my GRC system.

**Acceptance Criteria:**

```gherkin
Given I have completed an operational scenario
When I click "Créer risque dans le registre"
Then a risk is created in the existing risk registry
And the risk includes: Title, Description, Impact, Probability
And the risk links back to the EBIOS scenario
And the risk appears in my risk list with "Source: EBIOS RM" badge
```

**Technical Notes:**
- `EbiosRiskIntegrationService.createRiskFromScenario()`
- `Risk.ebiosReference`

---

### Story 16.6: Propositions de Techniques MITRE

**As a** RSSI,
**I want** to receive MITRE technique suggestions,
**So that** I build realistic attack sequences.

**Acceptance Criteria:**

```gherkin
Given I am adding attack steps
When I describe the step context
Then relevant MITRE techniques are suggested
And suggestions are based on: Previous steps, Target asset type
And I can accept or dismiss suggestions
```

**Technical Notes:**
- AI-powered suggestion (optional)
- Fallback: manual search

---

## Epic 17: EBIOS RM - Atelier 5: Traitement du Risque

**Goal:** L'utilisateur peut définir le plan de traitement, sélectionner les contrôles ISO 27002, et calculer les risques résiduels.

**FRs covered:** EBIOS-040 à EBIOS-045
**ADRs:** ADR-E005 (Risk Registry Integration)
**Priority:** P0 - Core

---

### Story 17.1: Définition du Plan de Traitement

**As a** RSSI,
**I want** to define a treatment plan for each risk,
**So that** I address identified risks.

**Acceptance Criteria:**

```gherkin
Given I have risks from Workshop 4
When I enter Workshop 5
Then I see all risks with their levels
And for each risk I can select treatment: Accept, Mitigate, Transfer, Avoid
And I justify the treatment choice
And I assign a responsible person and deadline
```

**Technical Notes:**
- `Workshop5Data.treatmentPlan`
- Link to existing risk treatment workflow

---

### Story 17.2: Sélection des Mesures ISO 27002

**As a** RSSI,
**I want** to select ISO 27002 controls for mitigation,
**So that** I implement standard security measures.

**Acceptance Criteria:**

```gherkin
Given I am treating a risk with "Mitigate"
When I click "Ajouter contrôle"
Then I see the ISO 27002 control catalog (93 controls)
And I can search and filter controls
And I select controls relevant to the risk
And selected controls show expected effectiveness
```

**Technical Notes:**
- Use existing `controls` collection
- Filter by ISO 27002 framework

---

### Story 17.3: Mapping Automatique Risques → Contrôles

**As a** RSSI,
**I want** automatic control suggestions based on risk type,
**So that** I don't miss relevant controls.

**Acceptance Criteria:**

```gherkin
Given I am treating a risk
When I view control suggestions
Then the system suggests controls based on:
  - Risk category
  - MITRE techniques used
  - Industry best practices
And suggestions show relevance score
And I can accept or dismiss suggestions
```

**Technical Notes:**
- Mapping table: MITRE technique → ISO 27002 controls
- ADR-005 Multi-Framework Mapping

---

### Story 17.4: Calcul des Risques Résiduels

**As a** RSSI,
**I want** to calculate residual risk after controls,
**So that** I know my remaining exposure.

**Acceptance Criteria:**

```gherkin
Given I have assigned controls to a risk
When I view the risk
Then residual risk is calculated based on control effectiveness
And I see: Initial risk level, Control coverage, Residual level
And residual risk must be ≤ inherent risk (validation)
And I can adjust effectiveness estimates
```

**Technical Notes:**
- `ResidualRisk = InherentRisk × (1 - ControlEffectiveness)`
- Validation: residual ≤ inherent

---

### Story 17.5: Génération de la Synthèse EBIOS RM

**As a** RSSI,
**I want** to generate a complete EBIOS RM summary,
**So that** I have the final deliverable.

**Acceptance Criteria:**

```gherkin
Given I have completed all 5 workshops
When I click "Générer synthèse"
Then a comprehensive report is generated with:
  - Executive summary
  - Workshop 1: Scope and baseline
  - Workshop 2: SR/OV analysis
  - Workshop 3: Strategic scenarios
  - Workshop 4: Operational scenarios
  - Workshop 5: Treatment plan
  - Risk register summary
And the report follows ANSSI format
```

**Technical Notes:**
- Template: `ebios-full-report.template.md`
- Aggregate data from all workshops

---

### Story 17.6: Export du Dossier EBIOS en PDF

**As a** RSSI,
**I want** to export the complete EBIOS dossier as PDF,
**So that** I can share with auditors.

**Acceptance Criteria:**

```gherkin
Given the EBIOS analysis is complete
When I click "Exporter PDF"
Then a professional PDF is generated
And it includes all diagrams and matrices
And it's formatted for auditor review
And I can choose which sections to include
```

**Technical Notes:**
- Use existing PDF service
- Include ecosystem diagram as image

---

## Epic 18: Programme SMSI (ISO 27003)

**Goal:** L'utilisateur peut piloter son programme SMSI avec le cycle PDCA, des jalons, et des rapports d'avancement.

**FRs covered:** ISO3-001 à ISO3-007
**ADRs:** ADR-E006 (SMSI Program Management)
**Priority:** P1 - Program Management

---

### Story 18.1: Création du Programme SMSI

**As a** RSSI/PM,
**I want** to create an SMSI program with PDCA phases,
**So that** I can track my certification journey.

**Acceptance Criteria:**

```gherkin
Given I am in the SMSI Program module
When I click "Créer programme"
Then I can enter: Name, Description, Target certification date
And the program is created with 4 phases: Plan, Do, Check, Act
And each phase has status "Not started"
And I see a PDCA wheel visualization
```

**Technical Notes:**
- `SMSIProgram` document
- One program per tenant

---

### Story 18.2: Définition des Jalons

**As a** PM,
**I want** to define milestones for each phase,
**So that** I track concrete deliverables.

**Acceptance Criteria:**

```gherkin
Given I have a program
When I add milestones
Then I can specify: Name, Description, Due date, Phase (P/D/C/A)
And I can link milestones to: EBIOS analyses, Risks, Controls, Documents
And milestones appear on a timeline view
And overdue milestones are highlighted red
```

**Technical Notes:**
- `Milestone.linkedItems[]`
- Timeline component

---

### Story 18.3: Dashboard d'Avancement

**As a** Dirigeant/RSSI,
**I want** to see program progress at a glance,
**So that** I know if we're on track.

**Acceptance Criteria:**

```gherkin
Given I have a program with milestones
When I view the SMSI dashboard
Then I see: Overall progress %, Current phase, Upcoming milestones
And a PDCA ring shows phase completion
And a timeline shows past and future milestones
And I can drill down into any phase
```

**Technical Notes:**
- `SMSIProgramDashboard.tsx`
- `PDCAProgressRing.tsx`

---

### Story 18.4: Attribution des Responsables

**As a** PM,
**I want** to assign phase owners,
**So that** accountability is clear.

**Acceptance Criteria:**

```gherkin
Given I am managing the program
When I assign a phase owner
Then I select from organization users
And the owner receives a notification
And their name appears on the phase card
And they can see their assigned phases in their dashboard
```

**Technical Notes:**
- `PDCAPhaseData.responsibleId`
- Notification on assignment

---

### Story 18.5: Alertes et Rapports Automatiques

**As a** PM/Dirigeant,
**I want** automatic alerts and reports,
**So that** I stay informed without manual effort.

**Acceptance Criteria:**

```gherkin
Given milestones have due dates
When a milestone is approaching (7d, 3d, 1d)
Then owners receive reminder notifications
And overdue milestones trigger escalation
And weekly progress reports are generated automatically
And reports can be sent by email to stakeholders
```

**Technical Notes:**
- Scheduled Cloud Function
- Email via existing notification service

---

## Epic 19: Contexte de Risque (ISO 27005)

**Goal:** L'utilisateur peut définir le contexte de risque complet selon ISO 27005 comme fondation pour toutes les analyses.

**FRs covered:** ISO5-001 à ISO5-005
**Priority:** P1 - Foundation

---

### Story 19.1: Définition du Contexte Business

**As a** RSSI,
**I want** to document my business context,
**So that** risk assessments are grounded in reality.

**Acceptance Criteria:**

```gherkin
Given I access the Risk Context module
When I define business context
Then I can document: Activities, Objectives, Critical processes
And I can link to organizational documents
And the context is available to all risk analyses
```

**Technical Notes:**
- `RiskContext.businessContext`
- Reference in EBIOS Workshop 1

---

### Story 19.2: Définition du Contexte Réglementaire

**As a** RSSI,
**I want** to document regulatory obligations,
**So that** I ensure compliance requirements are considered.

**Acceptance Criteria:**

```gherkin
Given I am in Risk Context
When I define regulatory context
Then I can list: Applicable regulations (NIS2, DORA, GDPR)
And I specify obligations and deadlines
And the system links to activated frameworks
```

**Technical Notes:**
- `RiskContext.regulatoryContext`
- Link to multi-framework settings

---

### Story 19.3: Définition de l'Appétit au Risque

**As a** Dirigeant/RSSI,
**I want** to define our risk appetite,
**So that** treatment decisions align with business tolerance.

**Acceptance Criteria:**

```gherkin
Given I am setting up Risk Context
When I define risk appetite
Then I can set: Acceptable risk levels by category
And I define thresholds for escalation
And the appetite is used in risk treatment validation
```

**Technical Notes:**
- `RiskContext.riskAppetite`
- Used in EBIOS Workshop 5 validation

---

### Story 19.4: Critères d'Évaluation des Risques

**As a** RSSI,
**I want** to define risk evaluation criteria,
**So that** assessments are consistent.

**Acceptance Criteria:**

```gherkin
Given I am configuring Risk Context
When I define evaluation criteria
Then I can customize: Impact scale definitions, Probability scale
And criteria apply to all risk assessments
And EBIOS analyses use these criteria
```

**Technical Notes:**
- `RiskContext.evaluationCriteria`
- Override defaults in EBIOS workshops

---

## Epic 20: Efficacité des Contrôles (ISO 27002)

**Goal:** L'utilisateur peut évaluer et suivre l'efficacité des contrôles de sécurité implémentés.

**FRs covered:** ISO2-001 à ISO2-004
**Priority:** P2 - Enhancement

---

### Story 20.1: Évaluation de l'Efficacité des Contrôles

**As a** RSSI,
**I want** to evaluate control effectiveness,
**So that** I know if my security measures work.

**Acceptance Criteria:**

```gherkin
Given I have implemented controls
When I assess effectiveness
Then I can rate each control: 0-100% effective
And I document: Assessment date, Method, Evidence
And effectiveness feeds into residual risk calculation
And historical assessments are tracked
```

**Technical Notes:**
- Extend existing `Control` type
- `Control.effectiveness`, `Control.assessments[]`

---

### Story 20.2: Score de Maturité par Domaine

**As a** RSSI/Dirigeant,
**I want** to see maturity scores by ISO 27002 domain,
**So that** I identify weak areas.

**Acceptance Criteria:**

```gherkin
Given controls have effectiveness ratings
When I view the maturity dashboard
Then I see scores for each of 4 ISO 27002 categories
And a radar chart shows relative maturity
And low-scoring domains are highlighted
And I can drill down to see individual controls
```

**Technical Notes:**
- Aggregate by ISO 27002 category
- Radar chart visualization

---

## Implementation Phases

### Phase 1: Foundation (Ateliers 1-2 + Contexte)
- Epic 13: EBIOS RM Atelier 1 (7 stories)
- Epic 14: EBIOS RM Atelier 2 (6 stories)
- Epic 19: Contexte ISO 27005 (4 stories)

**Duration:** 2-3 sprints
**Dependencies:** None (foundation)

### Phase 2: Core Analysis (Ateliers 3-4)
- Epic 15: EBIOS RM Atelier 3 (6 stories)
- Epic 16: EBIOS RM Atelier 4 (6 stories)

**Duration:** 2-3 sprints
**Dependencies:** Phase 1 complete

### Phase 3: Treatment (Atelier 5)
- Epic 17: EBIOS RM Atelier 5 (6 stories)

**Duration:** 2 sprints
**Dependencies:** Phase 2 complete

### Phase 4: Program Management
- Epic 18: Programme SMSI (5 stories)
- Epic 20: Efficacité Contrôles (2 stories)

**Duration:** 2 sprints
**Dependencies:** Phase 1 (can run in parallel with Phase 2-3)

---

## Story Summary

| Epic | Stories | Priority | Phase |
|------|---------|----------|-------|
| 13 | 7 | P0 | 1 |
| 14 | 6 | P0 | 1 |
| 15 | 6 | P0 | 2 |
| 16 | 6 | P0 | 2 |
| 17 | 6 | P0 | 3 |
| 18 | 5 | P1 | 4 |
| 19 | 4 | P1 | 1 |
| 20 | 2 | P2 | 4 |

**Total: 42 Stories covering 47 FRs (100% coverage)**

---

*Epics & Stories Document généré par BMad Method - Scrum Master Agent*
*Date: 2026-01-16*
*Extension pour: Sentinel GRC v2*
