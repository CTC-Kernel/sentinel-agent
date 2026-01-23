# PRD - Extension EBIOS RM & ISO 27003

**Sentinel GRC v2 - Module de Methodologie de Risques**

**Version:** 1.0
**Date:** 2026-01-23
**Statut:** Ready for Implementation
**Auteur:** Genere depuis Product Brief + Architecture

---

## Executive Summary

### Le Probleme

Les organisations europeennes qui doivent se conformer a ISO 27001 via la methodologie EBIOS RM (recommandee par l'ANSSI) n'ont pas d'outil integre pour:

1. **Suivre les 5 ateliers EBIOS RM** de maniere structuree et guidee
2. **Connecter l'analyse de risques** aux controles ISO 27001/27002
3. **Piloter le programme SMSI** selon ISO 27003 avec le cycle PDCA
4. **Mesurer l'efficacite** des mesures de securite deployees
5. **Maintenir la tracabilite** entre risques, scenarios, et traitements

### La Solution

Transformer Sentinel GRC v2 en la **premiere plateforme GRC europeenne** qui integre nativement:

1. **EBIOS RM** - Les 5 ateliers ANSSI comme workflow guide pas-a-pas
2. **ISO 27005** - Contexte de risque complet
3. **ISO 27003** - Programme SMSI avec pilotage PDCA
4. **ISO 27002** - Mapping controles et efficacite

### Differenciateurs

| Fonctionnalite | Sentinel GRC | Concurrents (Vanta/Drata) |
|----------------|--------------|---------------------------|
| EBIOS RM Natif | 5 ateliers guides | NON |
| Bibliotheque ANSSI | Sources de risque pre-chargees | NON |
| Mapping ISO automatique | EBIOS ↔ ISO 27001 ↔ ISO 27002 | Partiel |
| Programme SMSI (PDCA) | Dashboard integre | NON |
| Localisation FR | Native | EN only |

---

## Project Classification

**Type:** Extension Module (Additive)
**Priorite:** P0 - Differenciateur marche EU
**Complexite:** Haute
**Effort estime:** 10-12 sprints

### Alignement Strategique

| Initiative | Contribution |
|------------|--------------|
| European Leader Strategy | Differentiation absolue marche EU |
| Multi-Framework Engine | +1 framework (EBIOS RM/ISO 27005) |
| Vertical Public | Methodologie officielle ANSSI |

---

## User Personas

### Persona 1: Sarah Martin - RSSI PME/ETI

| Attribut | Valeur |
|----------|--------|
| Role | RSSI (80-200 personnes) |
| Contexte | Premiere implementation EBIOS RM |
| Pression | NIS2 + ISO 27001 en 12 mois |
| Frustration | "Je passe plus de temps a structurer qu'a analyser" |
| Besoin | Parcours guide, templates, connexion automatique |

### Persona 2: Philippe Durand - Dirigeant/COMEX

| Attribut | Valeur |
|----------|--------|
| Role | CEO/DG ETI industrielle |
| Contexte | Client exige ISO 27001 sous 18 mois |
| Frustration | "Je ne comprends pas ou on en est" |
| Besoin | Dashboard synthetique, score de maturite, alertes |

### Persona 3: Marc Leroy - Auditeur/Consultant

| Attribut | Valeur |
|----------|--------|
| Role | Auditeur ISO 27001 |
| Contexte | Verification conformite EBIOS |
| Besoin | Vue structuree 5 ateliers, export dossier complet |

---

## Functional Requirements

### Module EBIOS RM - Ateliers 1-5

#### Atelier 1: Cadrage et Socle de Securite

| ID | Requirement | Priorite |
|----|-------------|----------|
| EBIOS-001 | Creer une nouvelle analyse EBIOS RM | P0 |
| EBIOS-002 | Definir le perimetre (missions essentielles) | P0 |
| EBIOS-003 | Identifier les biens supports (SI, locaux, personnel) | P0 |
| EBIOS-004 | Definir les evenements redoutes | P0 |
| EBIOS-005 | Evaluer le socle de securite (maturite) | P0 |
| EBIOS-006 | Generer la "Note de cadrage" automatiquement | P1 |
| EBIOS-007 | Lier aux actifs existants du registre | P1 |

#### Atelier 2: Sources de Risque

| ID | Requirement | Priorite |
|----|-------------|----------|
| EBIOS-010 | Selectionner sources de risque depuis bibliotheque ANSSI | P0 |
| EBIOS-011 | Creer des sources de risque personnalisees | P0 |
| EBIOS-012 | Definir les objectifs vises (OV) par source | P0 |
| EBIOS-013 | Generer les couples SR/OV avec matrice de pertinence | P0 |
| EBIOS-014 | Evaluer la pertinence de chaque couple SR/OV | P1 |
| EBIOS-015 | Proposer sources de risque selon le secteur | P2 |

#### Atelier 3: Scenarios Strategiques

| ID | Requirement | Priorite |
|----|-------------|----------|
| EBIOS-020 | Cartographier l'ecosysteme (parties prenantes) | P0 |
| EBIOS-021 | Definir les chemins d'attaque via l'ecosysteme | P0 |
| EBIOS-022 | Construire des scenarios strategiques | P0 |
| EBIOS-023 | Evaluer la gravite des scenarios strategiques | P0 |
| EBIOS-024 | Visualisation graphique de l'ecosysteme (ReactFlow) | P1 |
| EBIOS-025 | Suggestions scenarios types selon secteur | P2 |

#### Atelier 4: Scenarios Operationnels

| ID | Requirement | Priorite |
|----|-------------|----------|
| EBIOS-030 | Decliner scenarios strategiques en modes operatoires | P0 |
| EBIOS-031 | Definir sequences d'attaque (MITRE ATT&CK) | P0 |
| EBIOS-032 | Evaluer la vraisemblance des scenarios operationnels | P0 |
| EBIOS-033 | Calculer le niveau de risque (Gravite x Vraisemblance) | P0 |
| EBIOS-034 | Creer automatiquement risques dans registre existant | P0 |
| EBIOS-035 | Proposer techniques MITRE selon contexte | P1 |

#### Atelier 5: Traitement du Risque

| ID | Requirement | Priorite |
|----|-------------|----------|
| EBIOS-040 | Definir plan de traitement des risques | P0 |
| EBIOS-041 | Selectionner mesures de securite (ISO 27002) | P0 |
| EBIOS-042 | Mapper automatiquement risques EBIOS aux controles ISO | P0 |
| EBIOS-043 | Calculer les risques residuels | P0 |
| EBIOS-044 | Generer la synthese EBIOS RM complete | P0 |
| EBIOS-045 | Exporter le dossier EBIOS en PDF | P1 |

### Module ISO 27003 - Programme SMSI

| ID | Requirement | Priorite |
|----|-------------|----------|
| ISO3-001 | Creer programme SMSI avec phases PDCA | P0 |
| ISO3-002 | Definir jalons pour chaque phase | P0 |
| ISO3-003 | Afficher l'avancement global du programme | P0 |
| ISO3-004 | Assigner responsables aux phases | P1 |
| ISO3-005 | Alertes sur jalons en retard | P1 |
| ISO3-006 | Rapports d'avancement automatiques | P1 |
| ISO3-007 | Documenter les revues de direction | P2 |

### Module ISO 27005 - Contexte de Risque

| ID | Requirement | Priorite |
|----|-------------|----------|
| ISO5-001 | Definir contexte business (activites, objectifs) | P0 |
| ISO5-002 | Definir contexte reglementaire (obligations) | P0 |
| ISO5-003 | Definir l'appetit au risque de l'organisation | P0 |
| ISO5-004 | Definir les criteres d'evaluation des risques | P0 |
| ISO5-005 | Stocker contexte comme reference pour analyses | P1 |

### Module ISO 27002 - Efficacite Controles

| ID | Requirement | Priorite |
|----|-------------|----------|
| ISO2-001 | Evaluer l'efficacite de chaque controle | P1 |
| ISO2-002 | Calculer score de maturite par domaine ISO 27002 | P1 |
| ISO2-003 | Definir objectifs d'efficacite | P2 |
| ISO2-004 | Identifier controles sous-performants | P2 |

---

## Technical Architecture

### Nouvelles Collections Firestore

```
tenants/{tenantId}/
├── ebiosAnalyses/           # Analyses EBIOS RM
│   └── {analysisId}/
│       ├── workshops/       # Donnees des 5 ateliers
│       ├── scenarios/       # Scenarios strategiques + operationnels
│       └── treatments/      # Plans de traitement
├── riskSources/             # Sources de risque (SR) custom
├── targetedObjectives/      # Objectifs vises (OV) custom
├── ecosystemParties/        # Parties prenantes ecosysteme
├── smsiProgram/             # Programme SMSI (1 par tenant)
│   └── milestones/          # Jalons du programme
└── riskContexts/            # Contexte ISO 27005

# Collection globale (read-only)
ebiosLibrary/                # Bibliotheque ANSSI
├── riskSources/             # Sources standard
└── targetedObjectives/      # Objectifs standard
```

### Nouveaux Composants

```
src/components/
├── ebios/
│   ├── EbiosWizard.tsx          # Wizard principal
│   ├── WorkshopStepper.tsx      # Navigation ateliers
│   ├── workshop1/               # Cadrage
│   ├── workshop2/               # Sources
│   ├── workshop3/               # Scenarios strategiques
│   ├── workshop4/               # Scenarios operationnels
│   └── workshop5/               # Traitement
├── smsi-program/
│   ├── SMSIProgramDashboard.tsx
│   ├── PDCATimeline.tsx
│   └── MilestoneList.tsx
└── dashboard/widgets/
    ├── EbiosProgressWidget.tsx
    └── SMSIProgramWidget.tsx
```

### ADRs d'Extension

| ADR | Decision |
|-----|----------|
| ADR-E001 | State Machine pour progression ateliers |
| ADR-E002 | Bibliotheque SR/OV avec donnees ANSSI |
| ADR-E003 | Visualisation ecosysteme (ReactFlow) |
| ADR-E004 | Integration MITRE ATT&CK existante |
| ADR-E005 | Integration bidirectionnelle registre risques |
| ADR-E006 | Programme SMSI avec PDCA |
| ADR-E007 | Score EBIOS contribuant au score global |

---

## Integration avec l'Existant

| Module Existant | Integration |
|-----------------|-------------|
| Registre de Risques | Creation auto depuis scenarios operationnels |
| Actifs | Liaison biens supports EBIOS ↔ actifs |
| Controles | Mapping traitement EBIOS ↔ controles ISO 27001 |
| Dashboard | Nouveaux widgets EBIOS + SMSI |
| Score Global | Score EBIOS (20% du total) |
| Audit Trail | Toutes actions EBIOS tracees |

### Garanties Non-Breaking

| Garantie | Description |
|----------|-------------|
| Retrocompatibilite | Toutes fonctionnalites existantes operationnelles |
| Donnees preservees | Migrations additives uniquement |
| UX coherente | Design system Apple existant |
| Tests verts | 100% tests existants passent |

---

## Success Metrics

| Metrique | Baseline | Cible |
|----------|----------|-------|
| Temps completion EBIOS RM | 6-8 semaines (manuel) | 4-5 semaines |
| Erreurs tracabilite audit | Frequentes | 0 |
| Adoption RSSI | N/A | 80% |
| NPS module EBIOS | N/A | >50 |
| Conformite ISO 27005 | Partielle | 100% |

---

## Roadmap Implementation

### Phase 1: Foundation (Sprints 1-3)

- Epic 13: EBIOS RM Atelier 1 - Cadrage (7 stories)
- Epic 14: EBIOS RM Atelier 2 - Sources (6 stories)
- Epic 19: Contexte ISO 27005 (4 stories)

### Phase 2: Core Analysis (Sprints 4-6)

- Epic 15: EBIOS RM Atelier 3 - Scenarios Strategiques (6 stories)
- Epic 16: EBIOS RM Atelier 4 - Scenarios Operationnels (6 stories)

### Phase 3: Treatment (Sprints 7-8)

- Epic 17: EBIOS RM Atelier 5 - Traitement (6 stories)

### Phase 4: Program Management (Sprints 9-10)

- Epic 18: Programme SMSI ISO 27003 (5 stories)
- Epic 20: Efficacite Controles ISO 27002 (2 stories)

**Total: 8 Epics, 42 Stories couvrant 47 FRs (100%)**

---

## Risks & Mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Complexite EBIOS RM | Haute | Moyen | UX guidee, tooltips, aide contextuelle |
| Adoption utilisateurs | Moyenne | Haute | Parcours progressif, templates pre-remplis |
| Performance (donnees volumineuses) | Faible | Moyen | Pagination, lazy loading, indexation |
| Integration existant | Faible | Haute | Tests d'integration, feature flags |

---

## Dependencies

### Externes
- Bibliotheque ANSSI (sources de risque, objectifs vises)
- ReactFlow (visualisation ecosysteme)
- MITRE ATT&CK (techniques existantes dans la plateforme)

### Internes
- Module Risques existant (extension)
- Module Controles existant (mapping)
- Score Service existant (contribution)
- Notification Service existant (alertes SMSI)

---

*PRD genere le 2026-01-23 pour combler la documentation manquante*
*Base sur: Product Brief + Architecture + Epics EBIOS RM*
