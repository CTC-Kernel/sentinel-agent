---
stepsCompleted: [1, 2]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/research/comprehensive-grc-research-2026-01-10.md'
workflowType: 'product-brief'
project_name: 'Sentinel GRC v2 - Extension EBIOS RM & ISO 27003'
date: '2026-01-16'
author: 'Thibaultllopis'
brief_type: 'extension'
parent_prd: 'prd.md'
integration_mode: 'seamless'
---

# Product Brief: Extension EBIOS RM & ISO 27003

**Module d'extension pour Sentinel GRC v2**

---

## Executive Summary

### Vision Produit

Transformer Sentinel GRC v2 en la **première plateforme GRC européenne** qui intègre nativement la **méthodologie EBIOS Risk Manager (EBIOS RM)** de l'ANSSI comme parcours utilisateur guidé, parfaitement aligné avec **ISO 27005** pour l'analyse de risques et **ISO 27003** pour la mise en œuvre programmatique du SMSI.

### Proposition de Valeur Unique

> "De l'analyse de risques EBIOS RM à la certification ISO 27001, un parcours unifié et intuitif."

**Différenciateurs clés :**

1. **EBIOS RM Natif** — Les 5 ateliers ANSSI comme workflow guidé pas-à-pas
2. **Alignement ISO Automatique** — Mapping bidirectionnel EBIOS RM ↔ ISO 27005 ↔ ISO 27001
3. **Intégration Transparente** — Extension de l'existant sans rupture
4. **UX Apple-like** — Interface intuitive pour RSSI et non-experts
5. **Conformité Européenne** — Aligné NIS2, DORA, et référentiels ANSSI

### Contexte Stratégique

**Pourquoi maintenant ?**
- EBIOS RM 2018 est la méthode officielle de l'ANSSI pour l'analyse de risques
- NIS2 et DORA exigent une approche risque documentée et traçable
- Aucun concurrent (Vanta, Drata, Secureframe) ne supporte EBIOS RM nativement
- Le marché européen PME/ETI attend une solution française complète

**Positionnement marché :**
- Différenciation absolue sur le segment GRC européen
- Complémentarité avec le Wizard SMSI existant (Epic 12)
- Renforcement de la proposition de valeur "multi-framework"

---

## Core Vision

### Problem Statement

**Le problème central :**

Les organisations européennes qui doivent se conformer à ISO 27001 via la méthodologie EBIOS RM (recommandée par l'ANSSI) n'ont pas d'outil intégré pour :

1. **Suivre les 5 ateliers EBIOS RM** de manière structurée et guidée
2. **Connecter l'analyse de risques** aux contrôles ISO 27001/27002
3. **Piloter le programme SMSI** selon ISO 27003 avec le cycle PDCA
4. **Mesurer l'efficacité** des mesures de sécurité déployées
5. **Maintenir la traçabilité** entre risques, scénarios, et traitements

### Problem Impact

**Conséquences pour les organisations :**

| Impact | Description | Coût |
|--------|-------------|------|
| **Fragmentation** | Tableurs Excel, documents Word éparpillés | Perte de productivité |
| **Incohérence** | Pas de lien entre ateliers EBIOS et registre de risques | Risque d'audit |
| **Temps perdu** | Reconstitution du parcours pour chaque audit | 2-3 jours/audit |
| **Expertise requise** | Seuls les experts EBIOS peuvent utiliser la méthode | Dépendance consultant |
| **Compliance gap** | Difficulté à prouver l'alignement ISO 27005 | Non-conformité |

### Why Existing Solutions Fall Short

**Analyse des solutions actuelles :**

| Solution | Limitation pour EBIOS RM |
|----------|-------------------------|
| **Vanta/Drata** | US-centric, pas de support EBIOS RM |
| **Excel/Word** | Pas de traçabilité, maintenance manuelle |
| **Outils EBIOS dédiés** | Pas d'intégration GRC, silos |
| **Sentinel GRC v2 actuel** | Gestion risques générique, pas de workflow EBIOS |

### Proposed Solution

**Architecture de la solution :**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SENTINEL GRC v2 - EBIOS RM MODULE                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    PARCOURS EBIOS RM GUIDÉ                       │   │
│  │                                                                  │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────┐ │   │
│  │  │ATELIER 1│─▶│ATELIER 2│─▶│ATELIER 3│─▶│ATELIER 4│─▶│ATELIER│ │   │
│  │  │ Cadrage │  │ Sources │  │Scénarios│  │Scénarios│  │  5    │ │   │
│  │  │         │  │   de    │  │Stratég. │  │ Opérat. │  │Traite.│ │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └───┬───┘ │   │
│  │       │            │            │            │            │     │   │
│  │       ▼            ▼            ▼            ▼            ▼     │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │           REGISTRE DE RISQUES UNIFIÉ (EXISTANT)         │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    PROGRAMME SMSI (ISO 27003)                    │   │
│  │                                                                  │   │
│  │     ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐       │   │
│  │     │  PLAN  │───▶│   DO   │───▶│ CHECK  │───▶│  ACT   │       │   │
│  │     │Planif. │    │Déploy. │    │Audit   │    │Amélio. │       │   │
│  │     └────────┘    └────────┘    └────────┘    └────────┘       │   │
│  │           │              │             │             │          │   │
│  │           ▼              ▼             ▼             ▼          │   │
│  │     ┌─────────────────────────────────────────────────────┐    │   │
│  │     │            DASHBOARD PROGRAMME SMSI                  │    │   │
│  │     └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                 ALIGNEMENT ISO 27005 / ISO 27002                 │   │
│  │                                                                  │   │
│  │  Risk Context ──▶ Risk Assessment ──▶ Risk Treatment ──▶ Review │   │
│  │       │                  │                  │               │    │   │
│  │       ▼                  ▼                  ▼               ▼    │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │           CONTRÔLES ISO 27002 (93 CONTRÔLES)            │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Differentiators

| Différenciateur | Description | Avantage Compétitif |
|-----------------|-------------|---------------------|
| **EBIOS RM Natif** | 5 ateliers comme workflow guidé | Unique sur le marché |
| **Intégration Totale** | Connexion bidirectionnelle avec registre risques | Zéro double saisie |
| **ISO 27005 Aligné** | Contexte de risque complet | Conformité audit |
| **ISO 27003 Programme** | Pilotage PDCA du SMSI | Vue management |
| **UX Intuitive** | Non-experts peuvent utiliser EBIOS | Adoption facilitée |
| **Traçabilité Complète** | Audit trail de bout en bout | Certification ready |

---

## Target Users

### Personas Principaux

#### Persona 1: Sarah Martin — RSSI PME/ETI

**Profil:**
- RSSI d'une entreprise de 80-200 personnes
- Doit implémenter EBIOS RM pour la première fois
- Connaissance théorique d'EBIOS mais peu de pratique
- Sous pression : NIS2 + ISO 27001 à obtenir en 12 mois

**Besoins:**
- Parcours guidé pas-à-pas pour chaque atelier EBIOS
- Templates et exemples pour chaque livrable
- Connexion automatique entre ateliers et registre de risques
- Estimation du temps restant pour finir l'analyse

**Frustrations actuelles:**
- "Je passe plus de temps à structurer mes tableaux qu'à analyser les risques"
- "Je ne sais jamais si j'ai oublié une étape EBIOS"
- "L'auditeur me demande la traçabilité et je dois tout reconstituer"

#### Persona 2: Philippe Durand — Dirigeant/COMEX

**Profil:**
- CEO/DG d'une ETI industrielle
- Client majeur exige ISO 27001 sous 18 mois
- Ne connaît pas EBIOS mais doit suivre l'avancement
- Veut des KPIs simples et actionnables

**Besoins:**
- Dashboard synthétique de l'avancement EBIOS RM
- Score de maturité évolutif (style Apple Health)
- Alertes si le projet prend du retard
- Rapports automatiques pour le board

**Frustrations actuelles:**
- "Je ne comprends pas où on en est dans ce projet EBIOS"
- "Je ne sais pas si on sera prêt pour l'audit"

#### Persona 3: Marc Leroy — Auditeur/Consultant

**Profil:**
- Auditeur ISO 27001 ou consultant EBIOS RM
- Doit vérifier la conformité de la démarche EBIOS
- Besoin d'accéder aux preuves organisées

**Besoins:**
- Vue structurée des 5 ateliers complétés
- Accès aux livrables de chaque atelier
- Traçabilité risques → scénarios → traitements
- Export du dossier EBIOS complet

---

## User Journeys

### Journey 1: Sarah — Première analyse EBIOS RM complète

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PARCOURS UTILISATEUR: ANALYSE EBIOS RM COMPLÈTE (Sarah, RSSI)          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ SEMAINE 1-2: ATELIER 1 - CADRAGE                                       │
│ ───────────────────────────────────────                                 │
│ 1. Sarah clique "Nouvelle analyse EBIOS RM" depuis le dashboard        │
│ 2. Le wizard l'accueille : "Bienvenue ! Commençons par cadrer."        │
│ 3. Questions guidées : Périmètre, Missions essentielles, Biens supports│
│ 4. Sarah remplit avec suggestions IA basées sur son secteur            │
│ 5. Validation automatique de la complétude                             │
│ 6. Génération du livrable "Note de cadrage"                            │
│ 7. Score d'avancement : 20% ✓                                          │
│                                                                         │
│ SEMAINE 2-3: ATELIER 2 - SOURCES DE RISQUE                             │
│ ───────────────────────────────────────────                             │
│ 1. Transition guidée : "Passons aux sources de risque"                 │
│ 2. Bibliothèque de sources de risque ANSSI pré-chargée                 │
│ 3. Sarah sélectionne les sources pertinentes (cybercriminels, etc.)    │
│ 4. Définition des objectifs visés par chaque source                    │
│ 5. Couples SR/OV générés avec matrice de pertinence                    │
│ 6. Score d'avancement : 40% ✓                                          │
│                                                                         │
│ SEMAINE 3-4: ATELIER 3 - SCÉNARIOS STRATÉGIQUES                        │
│ ───────────────────────────────────────────────                         │
│ 1. Construction des scénarios de haut niveau                           │
│ 2. Cartographie de l'écosystème (parties prenantes)                    │
│ 3. Chemins d'attaque via l'écosystème                                  │
│ 4. Évaluation de la gravité des scénarios                              │
│ 5. Visualisation graphique des chemins d'attaque                       │
│ 6. Score d'avancement : 60% ✓                                          │
│                                                                         │
│ SEMAINE 4-5: ATELIER 4 - SCÉNARIOS OPÉRATIONNELS                       │
│ ────────────────────────────────────────────────                        │
│ 1. Déclinaison des scénarios stratégiques en modes opératoires         │
│ 2. Séquences d'attaque détaillées                                      │
│ 3. Évaluation de la vraisemblance                                      │
│ 4. Calcul du niveau de risque (Gravité × Vraisemblance)                │
│ 5. Connexion automatique au registre de risques existant               │
│ 6. Score d'avancement : 80% ✓                                          │
│                                                                         │
│ SEMAINE 5-6: ATELIER 5 - TRAITEMENT DU RISQUE                          │
│ ────────────────────────────────────────────                            │
│ 1. Plan de traitement des risques                                       │
│ 2. Sélection des mesures de sécurité (ISO 27002)                       │
│ 3. Mapping automatique risques EBIOS → contrôles ISO 27001             │
│ 4. Calcul des risques résiduels                                        │
│ 5. Génération de la synthèse EBIOS RM complète                         │
│ 6. Score d'avancement : 100% ✓ 🎉                                      │
│                                                                         │
│ RÉSULTAT: Analyse EBIOS RM complète, connectée au SMSI, audit-ready    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Journey 2: Philippe — Suivi du programme SMSI

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PARCOURS UTILISATEUR: PILOTAGE SMSI (Philippe, Dirigeant)              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ 1. Philippe se connecte (1x/semaine)                                   │
│ 2. Dashboard dirigeant affiche :                                        │
│    - Score Global SMSI : 67% (↑5% cette semaine)                       │
│    - Avancement EBIOS RM : Atelier 4/5 en cours                        │
│    - Risques critiques : 3 (stable)                                    │
│    - Prochaine étape : "Finaliser scénarios opérationnels"             │
│                                                                         │
│ 3. Philippe clique sur "Rapport Board"                                 │
│ 4. Rapport automatique généré :                                         │
│    - Résumé exécutif en langage non-technique                          │
│    - Graphique d'avancement PDCA                                        │
│    - Projection date de certification                                   │
│                                                                         │
│ 5. Philippe partage le rapport par email en 2 clics                    │
│                                                                         │
│ RÉSULTAT: Visibilité complète en <5 minutes, sans jargon technique     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Functional Requirements

### Module EBIOS RM — 5 Ateliers

#### Atelier 1: Cadrage et Socle de Sécurité

| ID | Requirement | Priorité |
|----|-------------|----------|
| EBIOS-001 | L'utilisateur peut créer une nouvelle analyse EBIOS RM | P0 |
| EBIOS-002 | L'utilisateur peut définir le périmètre de l'analyse (missions essentielles) | P0 |
| EBIOS-003 | L'utilisateur peut identifier les biens supports (SI, locaux, personnel) | P0 |
| EBIOS-004 | L'utilisateur peut définir les événements redoutés | P0 |
| EBIOS-005 | L'utilisateur peut évaluer le socle de sécurité (maturité actuelle) | P0 |
| EBIOS-006 | Le système génère automatiquement la "Note de cadrage" | P1 |
| EBIOS-007 | L'utilisateur peut lier des actifs existants aux biens supports | P1 |

#### Atelier 2: Sources de Risque

| ID | Requirement | Priorité |
|----|-------------|----------|
| EBIOS-010 | L'utilisateur peut sélectionner des sources de risque depuis la bibliothèque ANSSI | P0 |
| EBIOS-011 | L'utilisateur peut créer des sources de risque personnalisées | P0 |
| EBIOS-012 | L'utilisateur peut définir les objectifs visés (OV) par source | P0 |
| EBIOS-013 | Le système génère les couples SR/OV avec matrice de pertinence | P0 |
| EBIOS-014 | L'utilisateur peut évaluer la pertinence de chaque couple SR/OV | P1 |
| EBIOS-015 | Le système propose des sources de risque selon le secteur d'activité | P2 |

#### Atelier 3: Scénarios Stratégiques

| ID | Requirement | Priorité |
|----|-------------|----------|
| EBIOS-020 | L'utilisateur peut cartographier l'écosystème (parties prenantes) | P0 |
| EBIOS-021 | L'utilisateur peut définir les chemins d'attaque via l'écosystème | P0 |
| EBIOS-022 | L'utilisateur peut construire des scénarios stratégiques | P0 |
| EBIOS-023 | L'utilisateur peut évaluer la gravité des scénarios stratégiques | P0 |
| EBIOS-024 | Le système visualise graphiquement la cartographie de l'écosystème | P1 |
| EBIOS-025 | Le système propose des scénarios types selon le secteur | P2 |

#### Atelier 4: Scénarios Opérationnels

| ID | Requirement | Priorité |
|----|-------------|----------|
| EBIOS-030 | L'utilisateur peut décliner les scénarios stratégiques en modes opératoires | P0 |
| EBIOS-031 | L'utilisateur peut définir les séquences d'attaque (techniques MITRE ATT&CK) | P0 |
| EBIOS-032 | L'utilisateur peut évaluer la vraisemblance des scénarios opérationnels | P0 |
| EBIOS-033 | Le système calcule le niveau de risque (Gravité × Vraisemblance) | P0 |
| EBIOS-034 | Le système crée automatiquement les risques dans le registre existant | P0 |
| EBIOS-035 | Le système propose des techniques d'attaque depuis la base MITRE | P1 |

#### Atelier 5: Traitement du Risque

| ID | Requirement | Priorité |
|----|-------------|----------|
| EBIOS-040 | L'utilisateur peut définir le plan de traitement des risques | P0 |
| EBIOS-041 | L'utilisateur peut sélectionner les mesures de sécurité (ISO 27002) | P0 |
| EBIOS-042 | Le système mappe automatiquement les risques EBIOS aux contrôles ISO 27001 | P0 |
| EBIOS-043 | L'utilisateur peut calculer les risques résiduels | P0 |
| EBIOS-044 | Le système génère la synthèse EBIOS RM complète | P0 |
| EBIOS-045 | L'utilisateur peut exporter le dossier EBIOS en PDF | P1 |

### Module ISO 27003 — Programme SMSI

| ID | Requirement | Priorité |
|----|-------------|----------|
| ISO3-001 | L'utilisateur peut créer un programme SMSI avec phases PDCA | P0 |
| ISO3-002 | L'utilisateur peut définir des jalons pour chaque phase | P0 |
| ISO3-003 | Le système affiche l'avancement global du programme | P0 |
| ISO3-004 | L'utilisateur peut assigner des responsables aux phases | P1 |
| ISO3-005 | Le système envoie des alertes sur les jalons en retard | P1 |
| ISO3-006 | Le système génère des rapports d'avancement automatiques | P1 |
| ISO3-007 | L'utilisateur peut documenter les revues de direction | P2 |

### Module ISO 27005 — Contexte de Risque

| ID | Requirement | Priorité |
|----|-------------|----------|
| ISO5-001 | L'utilisateur peut définir le contexte business (activités, objectifs) | P0 |
| ISO5-002 | L'utilisateur peut définir le contexte réglementaire (obligations) | P0 |
| ISO5-003 | L'utilisateur peut définir l'appétit au risque de l'organisation | P0 |
| ISO5-004 | L'utilisateur peut définir les critères d'évaluation des risques | P0 |
| ISO5-005 | Le système stocke le contexte comme référence pour toutes les analyses | P1 |

### Module ISO 27002 — Efficacité des Contrôles

| ID | Requirement | Priorité |
|----|-------------|----------|
| ISO2-001 | L'utilisateur peut évaluer l'efficacité de chaque contrôle | P1 |
| ISO2-002 | Le système calcule un score de maturité par domaine ISO 27002 | P1 |
| ISO2-003 | L'utilisateur peut définir des objectifs d'efficacité | P2 |
| ISO2-004 | Le système identifie les contrôles sous-performants | P2 |

---

## Integration Requirements

### Intégration avec l'Existant

| Intégration | Description | Impact |
|-------------|-------------|--------|
| **Registre de Risques** | Les risques EBIOS créent des entrées dans le registre existant | Zéro double saisie |
| **Actifs** | Les biens supports EBIOS se connectent aux actifs existants | Cohérence des données |
| **Contrôles** | Le traitement EBIOS lie aux contrôles ISO 27001 existants | Traçabilité complète |
| **Dashboard** | Nouveaux widgets EBIOS dans le dashboard existant | Vue unifiée |
| **Score Global** | Le score EBIOS contribue au score de conformité global | KPI cohérent |
| **Audit Trail** | Toutes les actions EBIOS sont tracées | Conformité audit |

### Non-Breaking Changes

| Garantie | Description |
|----------|-------------|
| **Rétrocompatibilité** | Toutes les fonctionnalités existantes restent opérationnelles |
| **Données préservées** | Aucune perte de données, migrations additives uniquement |
| **UX cohérente** | Nouveaux modules alignés sur le design system Apple existant |
| **Tests verts** | 100% des tests existants passent en permanence |

---

## Success Criteria

### Métriques de Succès

| Métrique | Baseline | Cible | Mesure |
|----------|----------|-------|--------|
| Temps pour compléter EBIOS RM | 6-8 semaines (manuel) | 4-5 semaines | Analytics |
| Erreurs de traçabilité audit | Fréquentes | 0 | Feedback audit |
| Adoption par les RSSI | N/A | 80% | Usage stats |
| NPS module EBIOS | N/A | >50 | Survey |
| Conformité ISO 27005 | Partielle | 100% | Audit |

### Definition of Done

- [ ] Les 5 ateliers EBIOS RM sont implémentés et fonctionnels
- [ ] L'intégration avec le registre de risques existant est opérationnelle
- [ ] Le module ISO 27003 Programme SMSI est disponible
- [ ] Le contexte ISO 27005 est paramétrable
- [ ] Les tests automatisés couvrent >70% du nouveau code
- [ ] La documentation utilisateur est complète (FR/EN)
- [ ] Aucune régression sur les fonctionnalités existantes

---

## Technical Considerations

### Architecture Proposée

**Nouvelles Collections Firestore:**
```
tenants/{tenantId}/
  ├── ebiosAnalyses/           # Analyses EBIOS RM
  │   └── {analysisId}/
  │       ├── workshops/       # Données des 5 ateliers
  │       ├── scenarios/       # Scénarios stratégiques et opérationnels
  │       └── treatments/      # Plans de traitement
  ├── riskSources/             # Sources de risque (SR)
  ├── targetedObjectives/      # Objectifs visés (OV)
  ├── ecosystem/               # Cartographie écosystème
  └── smsiProgram/             # Programme SMSI (PDCA)
```

**Nouveaux Composants UI:**
```
src/components/
  ├── ebios/
  │   ├── EbiosWizard.tsx           # Wizard principal
  │   ├── WorkshopStepper.tsx       # Navigation ateliers
  │   ├── RiskSourceSelector.tsx    # Sélection SR
  │   ├── ScenarioBuilder.tsx       # Construction scénarios
  │   ├── EcosystemMap.tsx          # Cartographie parties prenantes
  │   └── TreatmentPlan.tsx         # Plan de traitement
  └── smsi-program/
      ├── PDCATimeline.tsx          # Timeline PDCA
      └── ProgramDashboard.tsx      # Dashboard programme
```

### Alignement ADRs Existants

| ADR | Application au module EBIOS |
|-----|----------------------------|
| ADR-001 (Locale) | Tous les formulaires EBIOS utilisent localeConfig |
| ADR-002 (Draft/Auto-save) | Chaque atelier supporte le mode brouillon |
| ADR-003 (Score) | Score EBIOS contribue au score global |
| ADR-004 (Dashboard) | Widgets EBIOS dans dashboard configurable |
| ADR-007 (Notifications) | Alertes sur les jalons SMSI |

---

## Risks & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Complexité EBIOS RM | Haute | Moyen | UX guidée pas-à-pas, tooltips, aide contextuelle |
| Adoption utilisateurs | Moyenne | Haute | Parcours progressif, templates pré-remplis |
| Performance (données volumineuses) | Faible | Moyen | Pagination, lazy loading, indexation Firestore |
| Intégration existant | Faible | Haute | Tests d'intégration, feature flags |

---

## Timeline Estimée

| Phase | Contenu | Durée |
|-------|---------|-------|
| **Phase 1** | Atelier 1 (Cadrage) + Atelier 2 (Sources) | 2-3 sprints |
| **Phase 2** | Atelier 3 (Scénarios Stratégiques) + Intégration Écosystème | 2 sprints |
| **Phase 3** | Atelier 4 (Scénarios Opérationnels) + Intégration Registre | 2 sprints |
| **Phase 4** | Atelier 5 (Traitement) + ISO 27002 Mapping | 2 sprints |
| **Phase 5** | Programme SMSI (ISO 27003) + Dashboard | 2 sprints |
| **Phase 6** | Polish, Tests, Documentation | 1-2 sprints |

---

*Product Brief généré par BMad Method - Business Analyst Agent*
*Date: 2026-01-16*
*Extension pour: Sentinel GRC v2*
