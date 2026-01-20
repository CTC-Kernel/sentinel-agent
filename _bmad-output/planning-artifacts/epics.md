---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['_bmad-output/planning-artifacts/prd.md', '_bmad-output/planning-artifacts/architecture.md', '_bmad-output/planning-artifacts/ux-design-specification.md', '_bmad-output/planning-artifacts/product-brief-sentinel-grc-2026-01-20.md']
workflowType: 'epics-and-stories'
workflow_completed: true
lastStep: 4
completedAt: '2026-01-10'
updatedAt: '2026-01-20'
version: '2.0'
project_name: 'Sentinel-GRC'
user_name: 'Thibaultllopis'
date: '2026-01-10'
validation_results:
  fr_coverage: '53/53 (100%)'
  stories_count: 75
  epics_count: 17
  architecture_alignment: 'passed'
  dependency_check: 'passed'
  q1q2_2026_adrs: 'ADR-008 to ADR-012 covered'
---

# Sentinel-GRC - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Sentinel-GRC, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**User Experience & Interface (FR1-FR5)**
- FR1: Tous les utilisateurs peuvent voir des messages d'erreur humanisés en français
- FR2: Tous les utilisateurs peuvent saisir des dates dans le format local (FR: dd/MM/yyyy, EN: MM/dd/yyyy)
- FR3: Tous les utilisateurs peuvent sauvegarder des formulaires en mode brouillon avant validation complète
- FR4: Tous les utilisateurs peuvent voir une validation en temps réel lors de la saisie
- FR5: Tous les utilisateurs peuvent effectuer des actions contextuelles depuis les listes (modifier, supprimer, dupliquer)

**Dashboards & Visualisation (FR6-FR11)**
- FR6: Les dirigeants peuvent voir un score de maturité global avec tendance sur le temps
- FR7: Les dirigeants peuvent voir les 3 KPIs critiques sans jargon technique
- FR8: Les RSSI peuvent voir les risques ouverts classés par criticité
- FR9: Les RSSI peuvent voir les incidents en cours et actions assignées
- FR10: Les project managers peuvent voir l'avancement du projet de conformité
- FR11: Tous les utilisateurs peuvent personnaliser leur dashboard selon leur rôle

**Gestion des Risques (FR12-FR16)**
- FR12: Les RSSI peuvent créer, modifier et supprimer des risques
- FR13: Les RSSI peuvent évaluer les risques selon une méthodologie (impact x probabilité)
- FR14: Les RSSI peuvent lier des risques à des contrôles de sécurité
- FR15: Les RSSI peuvent assigner des actions de traitement avec responsables et deadlines
- FR16: Tous les utilisateurs autorisés peuvent voir le registre des risques

**Multi-Framework Compliance (FR17-FR20)**
- FR17: Les administrateurs peuvent activer plusieurs frameworks de conformité (ISO 27001, NIS2, DORA, RGPD)
- FR18: Le système peut mapper automatiquement les contrôles entre frameworks
- FR19: Les RSSI peuvent voir les exigences partagées entre frameworks
- FR20: Les RSSI peuvent générer un Statement of Applicability (SoA)

**Audit & Preuves (FR21-FR25)**
- FR21: Les auditeurs internes peuvent créer et gérer des audits
- FR22: Les auditeurs peuvent lier des preuves aux contrôles audités
- FR23: Les auditeurs externes peuvent accéder au portail auditeur avec accès limité
- FR24: Les auditeurs peuvent utiliser une checklist interactive par domaine
- FR25: Tous les utilisateurs peuvent générer des dossiers de preuves automatiquement

**Gestion Documentaire (FR26-FR29)**
- FR26: Les utilisateurs autorisés peuvent créer, modifier et archiver des documents
- FR27: Les utilisateurs peuvent versionner les documents avec historique
- FR28: Les utilisateurs peuvent lier des documents aux contrôles et risques
- FR29: Le système peut générer des templates documentaires réglementaires

**Reporting & Export (FR30-FR32)**
- FR30: Les dirigeants peuvent générer des rapports automatiques pour le board
- FR31: Tous les utilisateurs peuvent exporter en PDF, Excel, CSV
- FR32: Les utilisateurs peuvent planifier des rapports récurrents

**Gestion de Projet (FR33-FR36)**
- FR33: Les project managers peuvent créer des plans projet avec jalons
- FR34: Les project managers peuvent assigner des actions avec deadlines
- FR35: Le système peut envoyer des rappels automatiques avant échéance
- FR36: Les utilisateurs assignés peuvent marquer les actions comme terminées

**Collaboration & Notifications (FR37-FR40)**
- FR37: Tous les utilisateurs peuvent recevoir des notifications sur leurs tâches
- FR38: Les utilisateurs peuvent commenter sur les entités (risques, audits, actions)
- FR39: Les utilisateurs peuvent @mentionner des collègues
- FR40: Le système peut notifier des alertes critiques (deadline, incident, baisse de score)

**Administration Tenant (FR41-FR45)**
- FR41: Les administrateurs peuvent créer et gérer les utilisateurs de leur organisation
- FR42: Les administrateurs peuvent assigner des rôles aux utilisateurs
- FR43: Les administrateurs peuvent importer des utilisateurs depuis CSV ou annuaire
- FR44: Les administrateurs peuvent configurer les paramètres de l'organisation
- FR45: Les administrateurs peuvent voir l'audit trail des actions utilisateur

**Authentification & Sécurité (FR46-FR49)**
- FR46: Tous les utilisateurs peuvent s'authentifier via email/mot de passe
- FR47: Les utilisateurs enterprise peuvent s'authentifier via SSO (Azure AD, Google)
- FR48: Tous les utilisateurs peuvent activer l'authentification multi-facteur
- FR49: Le système peut isoler les données par tenant (organisation)

**Wizard SMSI (FR50-FR53)**
- FR50: Les nouveaux utilisateurs peuvent suivre un parcours guidé pour implémenter ISO 27001
- FR51: Le wizard peut proposer des étapes progressives avec validation
- FR52: Le wizard peut estimer le temps restant jusqu'à certification
- FR53: Le wizard peut suggérer des contrôles selon le secteur d'activité

### Non-Functional Requirements

**Performance**
- NFR-P1: Page load time <2s
- NFR-P2: Time to Interactive <3s
- NFR-P3: API response time <500ms (p95)
- NFR-P4: Dashboard refresh <1s
- NFR-P5: Export génération <10s
- NFR-P6: Recherche <500ms

**Security (NFR-S1 à NFR-S11)**
- NFR-S1: Authentification multi-facteur disponible pour tous les utilisateurs
- NFR-S2: Sessions expirées après 8h d'inactivité
- NFR-S3: Verrouillage de compte après 5 tentatives échouées
- NFR-S4: Mots de passe minimum 12 caractères avec complexité
- NFR-S5: Données chiffrées en transit (TLS 1.3)
- NFR-S6: Données chiffrées au repos (AES-256)
- NFR-S7: Isolation des données par tenant (organizationId)
- NFR-S8: Aucune donnée client accessible sans autorisation explicite
- NFR-S9: Hébergement en Europe (Firebase europe-west1)
- NFR-S10: Conformité RGPD (droit à l'effacement, portabilité)
- NFR-S11: Audit trail non-modifiable pour toutes les actions

**Scalability (NFR-SC1 à NFR-SC3)**
- NFR-SC1: Architecture auto-scaling (Firebase)
- NFR-SC2: Pas de dégradation performance >10% avec charge 10x
- NFR-SC3: Ajout de tenant sans intervention manuelle

**Reliability (NFR-R1 à NFR-R3)**
- NFR-R1: Backup automatique quotidien
- NFR-R2: Restore testable par tenant
- NFR-R3: Multi-région Firebase (failover automatique)

**Accessibility (NFR-A1 à NFR-A5)**
- NFR-A1: Conformité WCAG 2.1 AA minimum
- NFR-A2: Navigation clavier complète
- NFR-A3: Contraste texte minimum 4.5:1
- NFR-A4: Labels ARIA pour les lecteurs d'écran
- NFR-A5: Textes alternatifs pour toutes les images

**Internationalization (NFR-I1 à NFR-I4)**
- NFR-I1: Interface disponible en français et anglais
- NFR-I2: Formats de date/nombre selon la locale utilisateur
- NFR-I3: Architecture extensible pour autres langues
- NFR-I4: Documentation utilisateur en français et anglais

**Maintainability (NFR-M1 à NFR-M4)**
- NFR-M1: Code couvert par tests automatisés >70%
- NFR-M2: Documentation technique à jour
- NFR-M3: Déploiement sans downtime (blue-green)
- NFR-M4: Rollback possible en <15min

### Additional Requirements

**From Architecture (ADRs):**
- ADR-001: Locale Configuration Centralisée - `src/config/localeConfig.ts` comme source unique de vérité pour formats FR/EN
- ADR-002: Système Draft/Auto-save - Status draft + auto-save 30s debounced pour tous les formulaires
- ADR-003: Score de Conformité Global - Calcul composite avec Cloud Function, visualisation Apple Health
- ADR-004: Dashboard Configurable par Rôle - Widgets configurables avec defaults par rôle (react-grid-layout)
- ADR-005: Multi-Framework Mapping Engine - Moteur de mapping contrôles → frameworks avec gap analysis
- ADR-006: Wizard SMSI Architecture - State machine 8 étapes avec stepper horizontal
- ADR-007: Système de Notifications Real-time - Firestore onSnapshot + email digest

**From UX Design:**
- UX-001: Design System avec tokens CSS (Inter font, #2563EB primary, 4px base spacing)
- UX-002: Responsive breakpoints (mobile <768px, tablet 768-1023px, desktop 1024+)
- UX-003: WCAG 2.1 AA accessibility compliance
- UX-004: Core Components (Button, Card, Input, Table, Modal, Toast, Badge, Avatar)
- UX-005: Feature Components (ScoreGauge, RiskCard, AuditChecklist, WizardStepper, DashboardWidget)
- UX-006: Navigation sidebar 240px avec collapse mobile
- UX-007: Skeleton loading states pour tous les contenus

**Q1-Q2 2026 Priorities (ADR-008 to ADR-012):**
- ADR-008: Registre ICT automatisé DORA Art. 28 (Finance vertical) - P0
- ADR-009: Connecteur SCADA/ICS pour assets OT (Industrie vertical) - P1
- ADR-010: Module Third-Party Risk Management avec questionnaires - P1
- ADR-011: Templates Homologation ANSSI pour secteur public - P0
- ADR-012: Quantification financière avancée (FAIR, Monte Carlo) - P1

**Brownfield Constraints (Existing Codebase):**
- EXIST-001: 14 modules fonctionnels existants à préserver
- EXIST-002: 377 composants React existants
- EXIST-003: RBAC 6 rôles déjà implémenté (permissions.ts)
- EXIST-004: Multi-tenant via Firestore subcollections existant
- EXIST-005: 40+ Cloud Functions existantes

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Messages erreur humanisés FR |
| FR2 | Epic 1 | Formats date locale FR/EN |
| FR3 | Epic 1 | Mode brouillon formulaires |
| FR4 | Epic 1 | Validation temps réel |
| FR5 | Epic 1 | Actions contextuelles listes |
| FR6 | Epic 2 | Score maturité global tendance |
| FR7 | Epic 2 | 3 KPIs dirigeants |
| FR8 | Epic 2 | Risques par criticité RSSI |
| FR9 | Epic 2 | Incidents et actions RSSI |
| FR10 | Epic 2 | Avancement projet PM |
| FR11 | Epic 2 | Dashboard personnalisable |
| FR12 | Epic 3 | CRUD risques |
| FR13 | Epic 3 | Évaluation risques impact x proba |
| FR14 | Epic 3 | Liaison risques-contrôles |
| FR15 | Epic 3 | Actions traitement risques |
| FR16 | Epic 3 | Vue registre risques |
| FR17 | Epic 4 | Activation multi-framework |
| FR18 | Epic 4 | Mapping automatique contrôles |
| FR19 | Epic 4 | Vue exigences partagées |
| FR20 | Epic 4 | Génération SoA |
| FR21 | Epic 5 | Gestion audits internes |
| FR22 | Epic 5 | Liaison preuves-contrôles |
| FR23 | Epic 5 | Portail auditeur externe |
| FR24 | Epic 5 | Checklist interactive |
| FR25 | Epic 5 | Dossiers preuves auto |
| FR26 | Epic 6 | CRUD documents |
| FR27 | Epic 6 | Versionnage historique |
| FR28 | Epic 6 | Liaison documents-contrôles |
| FR29 | Epic 6 | Templates réglementaires |
| FR30 | Epic 7 | Rapports automatiques board |
| FR31 | Epic 7 | Export PDF/Excel/CSV |
| FR32 | Epic 7 | Rapports planifiés |
| FR33 | Epic 8 | Plans projet jalons |
| FR34 | Epic 8 | Actions avec deadlines |
| FR35 | Epic 8 | Rappels automatiques |
| FR36 | Epic 8 | Marquage actions terminées |
| FR37 | Epic 9 | Notifications tâches |
| FR38 | Epic 9 | Commentaires entités |
| FR39 | Epic 9 | @mentions collègues |
| FR40 | Epic 9 | Alertes critiques |
| FR41 | Epic 10 | Gestion utilisateurs |
| FR42 | Epic 10 | Attribution rôles |
| FR43 | Epic 10 | Import users CSV |
| FR44 | Epic 10 | Config organisation |
| FR45 | Epic 10 | Audit trail |
| FR46 | Epic 11 | Auth email/password |
| FR47 | Epic 11 | SSO Azure/Google |
| FR48 | Epic 11 | MFA |
| FR49 | Epic 11 | Isolation tenant |
| FR50 | Epic 12 | Wizard SMSI guidé |
| FR51 | Epic 12 | Étapes progressives |
| FR52 | Epic 12 | Estimation temps |
| FR53 | Epic 12 | Suggestions secteur |

**Coverage:** 53/53 FRs mapped (100%)

## Epic List

### Epic 1: Foundation UX & Locale
**Goal:** Les utilisateurs peuvent travailler sans frustrations UX liées aux formats et validations.

Les utilisateurs voient des messages d'erreur clairs en français, saisissent des dates dans leur format local (FR/EN), sauvegardent en brouillon, bénéficient de validation temps réel, et effectuent des actions contextuelles depuis les listes.

**FRs covered:** FR1, FR2, FR3, FR4, FR5
**ADRs:** ADR-001 (Locale Config), ADR-002 (Draft/Auto-save)
**Priority:** P0 - MVP Quick Win

---

### Epic 2: Compliance Score Dashboard
**Goal:** Les dirigeants et RSSI voient leur état de conformité en un coup d'oeil avec dashboards personnalisés.

Score de maturité global style Apple Health avec tendance, KPIs critiques pour dirigeants, vue risques et incidents pour RSSI, avancement projet pour PM, dashboards configurables par rôle.

**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11
**ADRs:** ADR-003 (Score Global), ADR-004 (Dashboard Configurable)
**Priority:** P1 - MVP Core

---

### Epic 3: Risk Management Enhancement
**Goal:** Les RSSI gèrent efficacement le cycle de vie complet des risques.

CRUD complet sur les risques, évaluation impact x probabilité, liaison aux contrôles de sécurité, assignation d'actions de traitement, vue registre pour tous les utilisateurs autorisés.

**FRs covered:** FR12, FR13, FR14, FR15, FR16
**Priority:** P1 - Core

---

### Epic 4: Multi-Framework Compliance Engine
**Goal:** Les organisations gèrent simultanément plusieurs référentiels de conformité.

Activation multi-framework (ISO 27001, NIS2, DORA, RGPD), mapping automatique des contrôles entre frameworks, vue des exigences partagées, génération du Statement of Applicability.

**FRs covered:** FR17, FR18, FR19, FR20
**ADRs:** ADR-005 (Multi-Framework Mapping)
**Priority:** P1 - Différenciateur EU

---

### Epic 5: Audit & Evidence Management
**Goal:** Les auditeurs planifient et exécutent les audits avec preuves parfaitement organisées.

Gestion des audits internes, liaison preuves aux contrôles, portail auditeur externe avec accès limité, checklist interactive par domaine, génération automatique des dossiers de preuves.

**FRs covered:** FR21, FR22, FR23, FR24, FR25
**Priority:** P1 - Core

---

### Epic 6: Document Lifecycle Management
**Goal:** Les utilisateurs gèrent le cycle de vie documentaire complet avec traçabilité.

CRUD documents, versionnage avec historique, liaison aux contrôles et risques, génération de templates documentaires réglementaires.

**FRs covered:** FR26, FR27, FR28, FR29
**Priority:** P2 - Enhancement

---

### Epic 7: Executive Reporting
**Goal:** Les dirigeants génèrent des rapports automatiques pour le board.

Rapports automatiques direction, export multi-format (PDF, Excel, CSV), planification de rapports récurrents.

**FRs covered:** FR30, FR31, FR32
**Priority:** P2 - Value Add

---

### Epic 8: Project & Action Tracking
**Goal:** Les project managers pilotent efficacement les projets de conformité.

Plans projet avec jalons, assignation d'actions avec deadlines, rappels automatiques avant échéance, marquage des actions terminées.

**FRs covered:** FR33, FR34, FR35, FR36
**Priority:** P2 - Enhancement

---

### Epic 9: Real-time Collaboration
**Goal:** Les équipes collaborent efficacement avec notifications et mentions.

Notifications sur tâches, commentaires sur entités (risques, audits, actions), @mentions de collègues, alertes critiques (deadline, incident, baisse score).

**FRs covered:** FR37, FR38, FR39, FR40
**ADRs:** ADR-007 (Notifications Real-time)
**Priority:** P2 - Engagement

---

### Epic 10: Tenant Administration
**Goal:** Les administrateurs gèrent leur organisation de manière autonome.

Gestion des utilisateurs, attribution des rôles, import depuis CSV ou annuaire, configuration organisation, consultation de l'audit trail.

**FRs covered:** FR41, FR42, FR43, FR44, FR45
**Priority:** P2 - Enterprise

---

### Epic 11: Enterprise Authentication
**Goal:** Les entreprises utilisent leur SSO avec sécurité renforcée.

Authentification email/password, SSO Azure AD et Google, authentification multi-facteur, isolation données par tenant.

**FRs covered:** FR46, FR47, FR48, FR49
**Priority:** P3 - Enterprise Tier

---

### Epic 12: SMSI Wizard (Innovation)
**Goal:** Les nouveaux utilisateurs implémentent ISO 27001 avec guidance pas-à-pas unique sur le marché.

Parcours guidé implémentation ISO 27001, étapes progressives avec validation, estimation temps restant jusqu'à certification, suggestions de contrôles selon secteur d'activité.

**FRs covered:** FR50, FR51, FR52, FR53
**ADRs:** ADR-006 (Wizard SMSI Architecture)
**Priority:** P2 - Différenciateur Majeur

---

## Epic Summary

| Epic | Title | FRs | Priority | Phase |
|------|-------|-----|----------|-------|
| 1 | Foundation UX & Locale | 5 | P0 | MVP |
| 2 | Compliance Score Dashboard | 6 | P1 | MVP |
| 3 | Risk Management Enhancement | 5 | P1 | Core |
| 4 | Multi-Framework Compliance | 4 | P1 | Core |
| 5 | Audit & Evidence Management | 5 | P1 | Core |
| 6 | Document Lifecycle | 4 | P2 | Growth |
| 7 | Executive Reporting | 3 | P2 | Growth |
| 8 | Project & Action Tracking | 4 | P2 | Growth |
| 9 | Real-time Collaboration | 4 | P2 | Growth |
| 10 | Tenant Administration | 5 | P2 | Enterprise |
| 11 | Enterprise Authentication | 4 | P3 | Enterprise |
| 12 | SMSI Wizard | 4 | P2 | Innovation |

**Total: 12 Epics covering 53 FRs**

---

# Detailed Epic Stories

## Epic 1: Foundation UX & Locale

**Goal:** Les utilisateurs peuvent travailler sans frustrations UX liées aux formats et validations.

### Story 1.1: Locale Configuration Centralisée

As a **developer**,
I want **a centralized locale configuration file**,
So that **all date and number formats are consistent across the application**.

**Acceptance Criteria:**

**Given** the application is loaded
**When** the user's locale is detected (FR or EN)
**Then** all dates display in the correct format (FR: dd/MM/yyyy, EN: MM/dd/yyyy)
**And** all numbers use the correct decimal separator (FR: comma, EN: period)
**And** Zod validation schemas use locale-aware date parsing

**Technical Notes:**
- Create `src/config/localeConfig.ts` per ADR-001
- Integrate with i18next and date-fns
- Update all Zod schemas to use localeConfig

---

### Story 1.2: Humanized Error Messages

As a **user**,
I want **clear, humanized error messages in my language**,
So that **I understand what went wrong and how to fix it**.

**Acceptance Criteria:**

**Given** the user submits a form with validation errors
**When** the validation fails
**Then** error messages display in the user's language (FR/EN)
**And** messages are human-readable (not technical jargon)
**And** messages suggest how to fix the error
**And** error messages appear next to the relevant field

---

### Story 1.3: Draft Mode for Forms

As a **user**,
I want **to save my work as a draft before completing all fields**,
So that **I don't lose my progress if I need to leave**.

**Acceptance Criteria:**

**Given** the user is filling out a complex form (Risk, Asset, Audit, etc.)
**When** the user clicks "Save as Draft"
**Then** the form is saved with status "draft"
**And** validation is relaxed (only title required)
**And** a "Draft" badge appears in the list view
**And** the user can return and continue editing later

---

### Story 1.4: Auto-save with Visual Indicator

As a **user**,
I want **my work to be automatically saved**,
So that **I never lose data unexpectedly**.

**Acceptance Criteria:**

**Given** the user is editing a form
**When** the user types and pauses for 30 seconds
**Then** the form auto-saves with debouncing
**And** a visual indicator shows "Saving..." then "Saved ✓"
**And** if auto-save fails, an error indicator appears
**And** the user is warned before leaving with unsaved changes

---

### Story 1.5: Live Form Validation

As a **user**,
I want **to see validation feedback as I type**,
So that **I can correct errors immediately**.

**Acceptance Criteria:**

**Given** the user is filling out a form field
**When** the user finishes typing (on blur or after delay)
**Then** validation runs immediately
**And** valid fields show a green checkmark
**And** invalid fields show a red error with message
**And** the submit button state reflects overall form validity

---

### Story 1.6: Contextual Actions in Lists

As a **user**,
I want **to perform actions directly from list views**,
So that **I can work more efficiently without navigating to detail pages**.

**Acceptance Criteria:**

**Given** the user views a list of entities (Risks, Assets, Actions, etc.)
**When** the user hovers or clicks on a row
**Then** contextual action buttons appear (Edit, Delete, Duplicate, etc.)
**And** clicking Edit opens the edit form
**And** clicking Delete shows a confirmation dialog
**And** clicking Duplicate creates a copy with "(Copy)" suffix

---

## Epic 2: Compliance Score Dashboard

**Goal:** Les dirigeants et RSSI voient leur état de conformité en un coup d'oeil avec dashboards personnalisés.

### Story 2.1: Global Compliance Score Calculation

As a **system**,
I want **to calculate a global compliance score**,
So that **users can see their overall conformity status**.

**Acceptance Criteria:**

**Given** a tenant has risks, controls, documents, and audits
**When** any of these entities change
**Then** the compliance score is recalculated via Cloud Function
**And** the score is cached in Firestore for fast dashboard loading
**And** the score ranges from 0-100
**And** breakdown by category (risks, controls, docs, audits) is available

---

### Story 2.2: Apple Health Style Score Gauge

As a **dirigeant**,
I want **to see my compliance score as a visual gauge**,
So that **I understand my organization's health at a glance**.

**Acceptance Criteria:**

**Given** the user views the dashboard
**When** the ScoreGauge component renders
**Then** an animated circular gauge displays the score
**And** color reflects status (<50 red, 50-75 orange, >75 green)
**And** a sparkline shows 30-day trend
**And** clicking the gauge shows detailed breakdown

---

### Story 2.3: Executive KPI Cards

As a **dirigeant**,
I want **to see 3 critical KPIs without technical jargon**,
So that **I can quickly assess what needs attention**.

**Acceptance Criteria:**

**Given** the user has role "direction"
**When** they view their dashboard
**Then** 3 KPI cards display: Score Global, Risques Critiques, Audits En Cours
**And** each card uses simple language (no ISO jargon)
**And** numbers are large and prominent
**And** trend arrows indicate direction (up/down/stable)

---

### Story 2.4: RSSI Risk & Incident View

As a **RSSI**,
I want **to see my critical risks and active incidents**,
So that **I can prioritize my security work**.

**Acceptance Criteria:**

**Given** the user has role "rssi"
**When** they view their dashboard
**Then** widgets show: Risques Critiques (count + list), Incidents Actifs, Actions Assignées
**And** risks are sorted by criticality (impact x probability)
**And** clicking an item navigates to its detail page
**And** counts update in real-time

---

### Story 2.5: Project Manager Progress View

As a **project_manager**,
I want **to see my project compliance progress**,
So that **I can track deadlines and milestones**.

**Acceptance Criteria:**

**Given** the user has role "project_manager"
**When** they view their dashboard
**Then** widgets show: Actions Overdue, Project Timeline, Milestone Progress
**And** overdue items are highlighted in red
**And** progress bars show completion percentage
**And** upcoming deadlines are visible

---

### Story 2.6: Configurable Dashboard Widgets

As a **user**,
I want **to customize my dashboard layout**,
So that **I see the information most relevant to me**.

**Acceptance Criteria:**

**Given** the user clicks "Personnaliser" on their dashboard
**When** the edit mode activates
**Then** widgets become draggable and resizable
**And** user can add new widgets from a catalog
**And** user can remove unwanted widgets
**And** layout is saved to their profile
**And** "Reset to defaults" restores role-based defaults

---

## Epic 3: Risk Management Enhancement

**Goal:** Les RSSI gèrent efficacement le cycle de vie complet des risques.

### Story 3.1: Enhanced Risk Creation Form

As a **RSSI**,
I want **to create risks with all required fields**,
So that **I have complete risk documentation**.

**Acceptance Criteria:**

**Given** the user navigates to Risks > Create
**When** they fill out the risk form
**Then** they can enter: Title, Description, Category, Owner
**And** form supports draft mode and auto-save
**And** validation uses locale-aware formats
**And** the risk is created with status "draft" or "published"

---

### Story 3.2: Risk Evaluation Matrix

As a **RSSI**,
I want **to evaluate risks using impact x probability**,
So that **I can calculate criticality**.

**Acceptance Criteria:**

**Given** the user is editing a risk
**When** they select Impact (1-5) and Probability (1-5)
**Then** Criticality is auto-calculated (Impact × Probability)
**And** a visual matrix shows the risk position
**And** color coding indicates severity level
**And** the risk level updates automatically

---

### Story 3.3: Link Risks to Controls

As a **RSSI**,
I want **to link risks to security controls**,
So that **I can track mitigation**.

**Acceptance Criteria:**

**Given** the user is editing a risk
**When** they add a control link
**Then** they can search and select from existing controls
**And** multiple controls can be linked
**And** linked controls display on the risk detail page
**And** residual risk can be calculated based on control effectiveness

---

### Story 3.4: Risk Treatment Actions

As a **RSSI**,
I want **to assign treatment actions for risks**,
So that **risks are addressed and tracked**.

**Acceptance Criteria:**

**Given** the user is viewing a risk
**When** they click "Add Treatment Action"
**Then** they can create an action with: Title, Description, Owner, Deadline
**And** the action is linked to the risk
**And** action status (To Do, In Progress, Done) is trackable
**And** notifications are sent to the owner

---

### Story 3.5: Risk Register View

As an **authorized user**,
I want **to view the complete risk register**,
So that **I have visibility into all risks**.

**Acceptance Criteria:**

**Given** the user has permission to view risks
**When** they navigate to the Risk Register
**Then** all risks display in a sortable, filterable table
**And** columns include: Title, Category, Criticality, Status, Owner
**And** filters allow by: Status, Category, Criticality Level
**And** export to Excel/PDF is available

---

## Epic 4: Multi-Framework Compliance Engine

**Goal:** Les organisations gèrent simultanément plusieurs référentiels de conformité.

### Story 4.1: Framework Activation

As an **administrator**,
I want **to activate multiple compliance frameworks**,
So that **my organization tracks all required standards**.

**Acceptance Criteria:**

**Given** the user is in Organization Settings
**When** they access Framework Configuration
**Then** they can enable/disable: ISO 27001, NIS2, DORA, RGPD
**And** enabled frameworks appear in the compliance module
**And** relevant controls are loaded for each framework
**And** subscription tier limits the number of frameworks

---

### Story 4.2: Cross-Framework Control Mapping

As a **RSSI**,
I want **to see how controls map across frameworks**,
So that **I can efficiently manage compliance**.

**Acceptance Criteria:**

**Given** the user views a control
**When** multiple frameworks are enabled
**Then** the control shows which frameworks it satisfies
**And** a mapping matrix displays control → framework relationships
**And** coverage percentage is calculated per framework
**And** gaps are highlighted where controls are missing

---

### Story 4.3: Shared Requirements View

As a **RSSI**,
I want **to see requirements shared between frameworks**,
So that **I avoid duplicate work**.

**Acceptance Criteria:**

**Given** the user has multiple frameworks enabled
**When** they view the Shared Requirements page
**Then** requirements that overlap are grouped together
**And** implementing one control can satisfy multiple requirements
**And** effort savings are calculated and displayed

---

### Story 4.4: Statement of Applicability (SoA) Generation

As a **RSSI**,
I want **to generate a Statement of Applicability**,
So that **I have documentation for ISO 27001 certification**.

**Acceptance Criteria:**

**Given** the user has ISO 27001 framework enabled
**When** they click "Generate SoA"
**Then** a SoA document is generated with all Annex A controls
**And** each control shows: Applicable (Yes/No), Justification, Status
**And** the document can be exported as PDF
**And** the SoA tracks version history

---

## Epic 5: Audit & Evidence Management

**Goal:** Les auditeurs planifient et exécutent les audits avec preuves parfaitement organisées.

### Story 5.1: Internal Audit Creation

As an **internal auditor**,
I want **to create and manage audits**,
So that **I can plan and track audit activities**.

**Acceptance Criteria:**

**Given** the user has auditor role
**When** they create a new audit
**Then** they can specify: Title, Scope, Date Range, Auditor, Status
**And** the audit appears in the audit list
**And** audit status progresses: Planned → In Progress → Complete

---

### Story 5.2: Evidence Linking to Controls

As an **auditor**,
I want **to link evidence to audited controls**,
So that **compliance is documented**.

**Acceptance Criteria:**

**Given** the user is conducting an audit
**When** they select a control to audit
**Then** they can upload or link evidence (files, screenshots, documents)
**And** evidence is associated with the specific control
**And** evidence has metadata: Date, Uploader, Description
**And** evidence files are stored securely in Firebase Storage

---

### Story 5.3: External Auditor Portal

As an **external auditor**,
I want **to access a limited portal to review evidence**,
So that **I can conduct my audit efficiently**.

**Acceptance Criteria:**

**Given** an external audit is scheduled
**When** the auditor receives their portal link
**Then** they can login with limited credentials
**And** they only see assigned audit scope
**And** they can view evidence but not modify it
**And** their access expires after the audit period

---

### Story 5.4: Interactive Audit Checklist

As an **auditor**,
I want **to use an interactive checklist by domain**,
So that **I can systematically verify compliance**.

**Acceptance Criteria:**

**Given** the user is conducting an audit
**When** they view the audit checklist
**Then** controls are organized by ISO 27001 domain
**And** each control has: Check (compliant/non-compliant), Notes, Evidence link
**And** progress is tracked (X/Y controls verified)
**And** non-compliant items are flagged for follow-up

---

### Story 5.5: Automatic Evidence Dossier Generation

As a **user**,
I want **to generate an evidence dossier automatically**,
So that **I have organized proof for auditors**.

**Acceptance Criteria:**

**Given** the user has linked evidence to controls
**When** they click "Generate Evidence Dossier"
**Then** a PDF is generated with all evidence organized by domain
**And** the dossier includes: Control name, Evidence list, Status
**And** table of contents provides easy navigation
**And** the file can be downloaded or shared

---

## Epic 6: Document Lifecycle Management

**Goal:** Les utilisateurs gèrent le cycle de vie documentaire complet avec traçabilité.

### Story 6.1: Document CRUD Operations

As an **authorized user**,
I want **to create, edit, and archive documents**,
So that **I can manage security policies and procedures**.

**Acceptance Criteria:**

**Given** the user has document permissions
**When** they access the Documents module
**Then** they can create new documents with: Title, Type, Content, Owner
**And** they can edit existing documents
**And** they can archive outdated documents
**And** archived documents are retained but hidden from active view

---

### Story 6.2: Document Version History

As a **user**,
I want **to see version history of documents**,
So that **I can track changes over time**.

**Acceptance Criteria:**

**Given** the user views a document
**When** they click "Version History"
**Then** all versions are listed with: Date, Author, Change Summary
**And** previous versions can be viewed
**And** previous versions can be restored
**And** version comparison is available

---

### Story 6.3: Document Linking to Controls and Risks

As a **user**,
I want **to link documents to controls and risks**,
So that **relationships are traceable**.

**Acceptance Criteria:**

**Given** the user is editing a document
**When** they add links
**Then** they can link to existing controls
**And** they can link to existing risks
**And** linked items display on the document detail page
**And** the document appears in linked items' related documents section

---

### Story 6.4: Regulatory Document Templates

As a **user**,
I want **to generate documents from regulatory templates**,
So that **I have compliant starting points**.

**Acceptance Criteria:**

**Given** the user clicks "Create from Template"
**When** they select a template type (Policy, Procedure, etc.)
**Then** a pre-filled document is created with regulatory structure
**And** placeholders indicate required customization
**And** templates are available for ISO 27001 required documents

---

## Epic 7: Executive Reporting

**Goal:** Les dirigeants génèrent des rapports automatiques pour le board.

### Story 7.1: Automatic Executive Report Generation

As a **dirigeant**,
I want **to generate automatic reports for the board**,
So that **I can present our compliance status**.

**Acceptance Criteria:**

**Given** the user has direction role
**When** they click "Generate Board Report"
**Then** a report is generated with: Executive Summary, Score, Key Risks, Progress
**And** language is non-technical (suitable for board)
**And** charts and visuals summarize data
**And** the report covers the selected time period

---

### Story 7.2: Multi-Format Export

As a **user**,
I want **to export data in multiple formats**,
So that **I can use it in other tools**.

**Acceptance Criteria:**

**Given** the user views any data list or report
**When** they click Export
**Then** they can choose: PDF, Excel, CSV
**And** the export includes all visible columns
**And** filters are applied to the export
**And** large exports show a progress indicator

---

### Story 7.3: Scheduled Recurring Reports

As a **user**,
I want **to schedule recurring reports**,
So that **I receive regular updates automatically**.

**Acceptance Criteria:**

**Given** the user creates a report
**When** they click "Schedule"
**Then** they can set frequency: Weekly, Monthly, Quarterly
**And** they specify recipients (email addresses)
**And** reports are generated and emailed automatically
**And** scheduled reports can be edited or cancelled

---

## Epic 8: Project & Action Tracking

**Goal:** Les project managers pilotent efficacement les projets de conformité.

### Story 8.1: Project Plans with Milestones

As a **project_manager**,
I want **to create project plans with milestones**,
So that **I can track compliance initiatives**.

**Acceptance Criteria:**

**Given** the user has PM role
**When** they create a project
**Then** they can add milestones with: Name, Date, Description
**And** milestones display on a timeline view
**And** progress is tracked (X% complete)
**And** milestones can be marked complete

---

### Story 8.2: Action Assignment with Deadlines

As a **project_manager**,
I want **to assign actions with deadlines**,
So that **tasks are tracked and completed**.

**Acceptance Criteria:**

**Given** the user is managing a project
**When** they create an action
**Then** they can assign: Title, Description, Owner, Deadline, Priority
**And** the owner receives a notification
**And** the action appears in the owner's task list
**And** overdue actions are highlighted

---

### Story 8.3: Automatic Deadline Reminders

As a **system**,
I want **to send automatic reminders before deadlines**,
So that **tasks are completed on time**.

**Acceptance Criteria:**

**Given** an action has a deadline
**When** the deadline is approaching (7 days, 3 days, 1 day)
**Then** the owner receives reminder notifications
**And** reminders include action details and link
**And** overdue items receive daily reminders
**And** notification preferences are configurable

---

### Story 8.4: Action Completion Tracking

As an **assigned user**,
I want **to mark actions as completed**,
So that **progress is tracked**.

**Acceptance Criteria:**

**Given** the user has an assigned action
**When** they complete the work
**Then** they can mark the action as "Done"
**And** completion date is recorded
**And** the project progress updates
**And** the assigner is notified of completion

---

## Epic 9: Real-time Collaboration

**Goal:** Les équipes collaborent efficacement avec notifications et mentions.

### Story 9.1: Task Notifications

As a **user**,
I want **to receive notifications about my tasks**,
So that **I stay informed**.

**Acceptance Criteria:**

**Given** the user has assigned tasks or mentions
**When** relevant events occur
**Then** a notification bell shows unread count
**And** clicking the bell shows recent notifications
**And** clicking a notification navigates to the item
**And** notifications can be marked as read

---

### Story 9.2: Entity Comments

As a **user**,
I want **to comment on entities**,
So that **I can collaborate with my team**.

**Acceptance Criteria:**

**Given** the user views a risk, audit, or action
**When** they add a comment
**Then** the comment is saved with timestamp and author
**And** comments display in chronological order
**And** comments can be edited or deleted by author
**And** other users see comments in real-time

---

### Story 9.3: @Mention Colleagues

As a **user**,
I want **to @mention colleagues in comments**,
So that **I can get their attention**.

**Acceptance Criteria:**

**Given** the user is writing a comment
**When** they type "@"
**Then** an autocomplete shows team members
**And** selecting a member creates a mention link
**And** the mentioned user receives a notification
**And** clicking the mention navigates to user profile

---

### Story 9.4: Critical Alert Notifications

As a **system**,
I want **to notify users of critical events**,
So that **urgent issues are addressed quickly**.

**Acceptance Criteria:**

**Given** a critical event occurs (risk critical, deadline missed, incident created)
**When** the event is detected
**Then** relevant users receive immediate notifications
**And** critical notifications are highlighted differently
**And** email notifications are sent for critical items
**And** notification preferences can be configured

---

## Epic 10: Tenant Administration

**Goal:** Les administrateurs gèrent leur organisation de manière autonome.

### Story 10.1: User Management

As an **administrator**,
I want **to manage users in my organization**,
So that **I control access**.

**Acceptance Criteria:**

**Given** the user has admin role
**When** they access User Management
**Then** they can view all organization users
**And** they can invite new users via email
**And** they can deactivate users
**And** they can reset user passwords

---

### Story 10.2: Role Assignment

As an **administrator**,
I want **to assign roles to users**,
So that **permissions are appropriate**.

**Acceptance Criteria:**

**Given** the user views a user profile
**When** they click "Change Role"
**Then** they can select from available roles (admin, rssi, auditor, pm, direction, user)
**And** the role change takes effect immediately
**And** the user's permissions update accordingly

---

### Story 10.3: CSV User Import

As an **administrator**,
I want **to import users from CSV**,
So that **I can onboard many users quickly**.

**Acceptance Criteria:**

**Given** the user has a CSV file with user data
**When** they upload the CSV
**Then** the system validates the format
**And** users are created with specified roles
**And** invitation emails are sent to new users
**And** a summary shows success/failure count

---

### Story 10.4: Organization Settings

As an **administrator**,
I want **to configure organization settings**,
So that **the platform matches our needs**.

**Acceptance Criteria:**

**Given** the user accesses Organization Settings
**When** they modify settings
**Then** they can update: Organization Name, Logo, Timezone, Language Preference
**And** they can configure notification preferences
**And** changes are saved and applied

---

### Story 10.5: Audit Trail Viewing

As an **administrator**,
I want **to view the audit trail**,
So that **I can track user actions**.

**Acceptance Criteria:**

**Given** the user accesses Audit Trail
**When** they view the log
**Then** all user actions are listed with: User, Action, Entity, Timestamp
**And** the log is searchable and filterable
**And** the log cannot be modified or deleted
**And** the log can be exported for compliance

---

## Epic 11: Enterprise Authentication

**Goal:** Les entreprises utilisent leur SSO avec sécurité renforcée.

### Story 11.1: Email/Password Authentication

As a **user**,
I want **to login with email and password**,
So that **I can access the application**.

**Acceptance Criteria:**

**Given** the user has an account
**When** they enter email and password
**Then** they are authenticated and redirected to dashboard
**And** failed logins show appropriate error messages
**And** account locks after 5 failed attempts
**And** password reset is available via email

---

### Story 11.2: SSO Integration (Azure AD/Google)

As an **enterprise user**,
I want **to login via SSO**,
So that **I use my corporate credentials**.

**Acceptance Criteria:**

**Given** the organization has SSO configured
**When** the user clicks "Login with SSO"
**Then** they are redirected to their identity provider
**And** after authentication, they return to the app
**And** user profile is created/updated from SSO claims
**And** SSO is available for Azure AD and Google Workspace

---

### Story 11.3: Multi-Factor Authentication

As a **user**,
I want **to enable MFA on my account**,
So that **my account is more secure**.

**Acceptance Criteria:**

**Given** the user accesses Security Settings
**When** they enable MFA
**Then** they can set up TOTP (Google Authenticator, etc.)
**And** on next login, MFA code is required
**And** recovery codes are provided for backup
**And** MFA can be disabled with re-authentication

---

### Story 11.4: Tenant Data Isolation

As a **system**,
I want **to ensure tenant data is isolated**,
So that **organizations cannot access each other's data**.

**Acceptance Criteria:**

**Given** a user is authenticated
**When** they access any data
**Then** queries include tenantId filter automatically
**And** Firestore rules enforce tenant isolation
**And** cross-tenant data access is blocked
**And** audit logs track any isolation attempts

---

## Epic 12: SMSI Wizard (Innovation)

**Goal:** Les nouveaux utilisateurs implémentent ISO 27001 avec guidance pas-à-pas unique sur le marché.

### Story 12.1: Wizard Entry Point

As a **new user**,
I want **to start the SMSI implementation wizard**,
So that **I can begin my ISO 27001 journey**.

**Acceptance Criteria:**

**Given** a new tenant or user without SMSI setup
**When** they access the dashboard
**Then** a prominent "Start SMSI Wizard" call-to-action is displayed
**And** clicking it starts the wizard at Step 1
**And** returning users can continue from where they left off
**And** a progress indicator shows overall completion

---

### Story 12.2: Scope Definition Step

As a **user**,
I want **to define my SMSI scope**,
So that **I know what my security management covers**.

**Acceptance Criteria:**

**Given** the user is on Wizard Step 1: Scope
**When** they answer scope questions
**Then** they can define: Business Areas, Locations, Technologies
**And** guidance explains why scope is important
**And** examples help them understand
**And** they can save and continue or save draft

---

### Story 12.3: Progressive Step Validation

As a **user**,
I want **to complete steps progressively with validation**,
So that **I don't miss important elements**.

**Acceptance Criteria:**

**Given** the user completes a wizard step
**When** they click "Next"
**Then** the step is validated for completeness
**And** incomplete items are highlighted
**And** the user can proceed to the next step
**And** a stepper shows current position (Step X of 8)

---

### Story 12.4: Time to Certification Estimate

As a **user**,
I want **to see estimated time to certification**,
So that **I can plan my compliance project**.

**Acceptance Criteria:**

**Given** the user is progressing through the wizard
**When** they view the progress dashboard
**Then** an estimated time to certification is displayed
**And** the estimate updates based on completion speed
**And** the estimate considers industry benchmarks
**And** tips for acceleration are provided

---

### Story 12.5: Sector-Based Control Suggestions

As a **user**,
I want **to receive control suggestions based on my sector**,
So that **I implement relevant controls**.

**Acceptance Criteria:**

**Given** the user is on the Control Selection step
**When** they specify their industry sector
**Then** relevant controls are suggested with higher priority
**And** explanations indicate why controls are relevant
**And** the user can accept or dismiss suggestions
**And** suggestions are based on sector best practices

---

# Story Summary

| Epic | Stories | FRs Covered |
|------|---------|-------------|
| 1. Foundation UX & Locale | 6 | FR1-FR5 |
| 2. Compliance Score Dashboard | 6 | FR6-FR11 |
| 3. Risk Management Enhancement | 5 | FR12-FR16 |
| 4. Multi-Framework Compliance | 4 | FR17-FR20 |
| 5. Audit & Evidence Management | 5 | FR21-FR25 |
| 6. Document Lifecycle | 4 | FR26-FR29 |
| 7. Executive Reporting | 3 | FR30-FR32 |
| 8. Project & Action Tracking | 4 | FR33-FR36 |
| 9. Real-time Collaboration | 4 | FR37-FR40 |
| 10. Tenant Administration | 5 | FR41-FR45 |
| 11. Enterprise Authentication | 4 | FR46-FR49 |
| 12. SMSI Wizard | 5 | FR50-FR53 |

**Total: 55 Stories covering 53 FRs (Core)**

---

# Q1-Q2 2026 Epics (Vertical Priorities)

## Epic 13: DORA ICT Register (Finance)

**Goal:** Les institutions financières gèrent leur registre ICT DORA-compliant pour le reporting ESA.

**ADR:** ADR-008
**Priority:** P0 - Deadline réglementaire 30 avril 2025
**Vertical:** Finance (DORA)

### Story 13.1: ICT Provider Management

As a **RSSI Finance**,
I want **to manage my ICT providers inventory**,
So that **I maintain a complete DORA-compliant register**.

**Acceptance Criteria:**

**Given** the user has DORA framework enabled
**When** they access ICT Providers
**Then** they can create providers with: Name, Category (critical/important/standard), Services
**And** contract information is captured: Start date, End date, Exit strategy, Audit rights
**And** compliance info is tracked: DORA-compliant, Certifications, EU location

---

### Story 13.2: ICT Risk Assessment

As a **RSSI Finance**,
I want **to assess concentration and substitutability risks**,
So that **I comply with DORA requirements**.

**Acceptance Criteria:**

**Given** the user views an ICT provider
**When** they complete the risk assessment
**Then** concentration risk is calculated (0-100)
**And** substitutability is evaluated (low/medium/high)
**And** last assessment date is tracked
**And** alerts trigger when reassessment is due

---

### Story 13.3: DORA Register Export

As a **RSSI Finance**,
I want **to export my ICT register in ESA-compliant format**,
So that **I can submit regulatory reports**.

**Acceptance Criteria:**

**Given** the user has ICT providers configured
**When** they click "Export DORA Register"
**Then** an ESA-compliant report is generated (XML/JSON)
**And** report includes: Entity info, All providers, Concentration analysis
**And** generation timestamp is recorded
**And** historical exports are archived

---

### Story 13.4: Contract Expiration Alerts

As a **RSSI Finance**,
I want **to receive alerts for expiring contracts**,
So that **I maintain continuous compliance**.

**Acceptance Criteria:**

**Given** ICT provider contracts have end dates
**When** a contract expires within 90/60/30 days
**Then** the responsible user receives alert notifications
**And** the provider is flagged in the dashboard
**And** alerts include contract details and renewal actions

---

## Epic 14: SCADA/ICS Integration (Industrie)

**Goal:** Les RSSI industriels obtiennent une visibilité complète sur leurs assets OT.

**ADR:** ADR-009
**Priority:** P1 - NIS2 Compliance
**Vertical:** Industrie (NIS2)

### Story 14.1: OT Asset Import Wizard

As a **RSSI Industrie**,
I want **to import my SCADA/ICS inventory**,
So that **I have visibility on OT assets**.

**Acceptance Criteria:**

**Given** the user accesses Assets > OT Import
**When** they upload a CSV with OT assets
**Then** assets are created with OT metadata: Protocol, Manufacturer, Model, Firmware
**And** network segment is captured (IT/OT/DMZ)
**And** criticality level is assigned (safety/production/monitoring)
**And** import validation shows success/error summary

---

### Story 14.2: OT Connector Configuration

As a **RSSI Industrie**,
I want **to configure automated OT asset sync**,
So that **my inventory stays current**.

**Acceptance Criteria:**

**Given** the user has OT systems with APIs
**When** they configure a connector
**Then** they can select type: Modbus, OPC-UA, CSV import, API
**And** sync schedule is configurable
**And** connector status shows: Active, Error, Paused
**And** last sync timestamp is displayed

---

### Story 14.3: IT/OT Voxel Mapping

As a **RSSI Industrie**,
I want **to visualize IT and OT assets in Voxel 3D**,
So that **I understand my full infrastructure**.

**Acceptance Criteria:**

**Given** the user has both IT and OT assets
**When** they view the Voxel map
**Then** OT assets display with distinct visual style
**And** IT-OT connections are visible
**And** network segmentation (DMZ) is represented
**And** filtering by IT/OT/DMZ is available

---

### Story 14.4: OT Vulnerability Correlation

As a **RSSI Industrie**,
I want **to correlate vulnerabilities with OT assets**,
So that **I prioritize industrial risks**.

**Acceptance Criteria:**

**Given** the user has OT assets with firmware versions
**When** vulnerabilities are detected for those versions
**Then** alerts link vulnerabilities to specific OT assets
**And** production criticality influences risk score
**And** remediation suggestions consider OT constraints

---

## Epic 15: Third-Party Risk Management

**Goal:** Les RSSI évaluent et surveillent les risques fournisseurs de manière systématique.

**ADR:** ADR-010
**Priority:** P1 - 85% RSSI gap
**Vertical:** Tous

### Story 15.1: Vendor Assessment Creation

As a **RSSI**,
I want **to create vendor risk assessments**,
So that **I evaluate third-party security**.

**Acceptance Criteria:**

**Given** the user accesses Suppliers > Assessments
**When** they create a new assessment
**Then** they can select a vendor and questionnaire template
**And** templates exist for: ISO 27001, NIS2, DORA, HDS, General
**And** assessment status tracks: Pending, In Progress, Completed, Expired
**And** next review date is scheduled

---

### Story 15.2: Vendor Self-Service Portal

As a **vendor contact**,
I want **to complete security questionnaires online**,
So that **I provide assessment information efficiently**.

**Acceptance Criteria:**

**Given** an assessment is assigned to a vendor
**When** the vendor receives the portal link
**Then** they can login with limited credentials
**And** they see only their assigned questionnaire
**And** they can save progress and submit when complete
**And** their access expires after submission or deadline

---

### Story 15.3: Automated Vendor Scoring

As a **RSSI**,
I want **to see automatic risk scores for vendors**,
So that **I can prioritize high-risk relationships**.

**Acceptance Criteria:**

**Given** a vendor completes their questionnaire
**When** the assessment is submitted
**Then** an automatic score is calculated (0-100)
**And** inherent and residual risk levels are assigned
**And** scoring weights are configurable per template
**And** vendors can be compared on a dashboard

---

### Story 15.4: Vendor Concentration Dashboard

As a **RSSI**,
I want **to visualize vendor concentration risks**,
So that **I avoid dangerous dependencies**.

**Acceptance Criteria:**

**Given** the user has multiple vendors assessed
**When** they view the TPRM dashboard
**Then** concentration by category is visualized
**And** high-dependency vendors are highlighted
**And** single points of failure are identified
**And** diversification recommendations are provided

---

## Epic 16: ANSSI Homologation (Public)

**Goal:** Les collectivités génèrent des dossiers d'homologation conformes aux exigences ANSSI.

**ADR:** ADR-011
**Priority:** P0 - Strong demand from public sector
**Vertical:** Public (RGS)

### Story 16.1: Homologation Level Selector

As a **RSSI Collectivité**,
I want **to determine the appropriate homologation level**,
So that **I follow ANSSI guidelines**.

**Acceptance Criteria:**

**Given** the user starts a new homologation dossier
**When** they answer the level determination questions
**Then** the system recommends: Étoile, Simple, Standard, or Renforcé
**And** justification explains the recommendation
**And** the user can override with justification
**And** selected level determines required documents

---

### Story 16.2: Homologation Document Generation

As a **RSSI Collectivité**,
I want **to generate required homologation documents**,
So that **I have ANSSI-compliant dossiers**.

**Acceptance Criteria:**

**Given** a homologation dossier is created
**When** the user clicks "Generate Documents"
**Then** the 5 required documents are generated:
- Stratégie d'homologation
- Analyse de risques (linked to EBIOS)
- Plan d'action
- Décision d'homologation
- Attestation
**And** documents are pre-filled from Sentinel data
**And** PDFs can be downloaded or shared

---

### Story 16.3: Homologation Validity Tracking

As a **RSSI Collectivité**,
I want **to track homologation validity periods**,
So that **I renew before expiration**.

**Acceptance Criteria:**

**Given** a system is homologated
**When** the validity period is set
**Then** start, end, and renewal dates are tracked
**And** alerts trigger at 90/60/30 days before expiration
**And** renewal workflow can be initiated from alert
**And** historical homologations are archived

---

### Story 16.4: EBIOS-Homologation Link

As a **RSSI Collectivité**,
I want **to link EBIOS risk analysis to homologation dossiers**,
So that **documents are consistent**.

**Acceptance Criteria:**

**Given** the user has an EBIOS analysis for a system
**When** they create a homologation dossier
**Then** the EBIOS analysis can be linked
**And** risk analysis document pulls from EBIOS data
**And** changes to EBIOS flag the homologation for review
**And** version history maintains audit trail

---

## Epic 17: Financial Risk Quantification

**Goal:** Les RSSI quantifient les risques en euros pour justifier les investissements au COMEX.

**ADR:** ADR-012
**Priority:** P1 - COMEX justification
**Vertical:** Tous

### Story 17.1: FAIR Model Configuration

As a **RSSI**,
I want **to configure FAIR risk quantification models**,
So that **I can calculate financial impact**.

**Acceptance Criteria:**

**Given** the user views a risk
**When** they enable financial quantification
**Then** they can input FAIR parameters:
- Loss Event Frequency (distribution)
- Loss Magnitude (distribution)
- Threat Capability
- Control Strength
**And** simplified presets are available for non-experts
**And** the model saves with the risk

---

### Story 17.2: Monte Carlo Simulation

As a **RSSI**,
I want **to run Monte Carlo simulations**,
So that **I get probabilistic financial estimates**.

**Acceptance Criteria:**

**Given** a risk has FAIR parameters configured
**When** the user clicks "Run Simulation"
**Then** 1000+ iterations are executed
**And** results show: ALE (Annualized Loss Expectancy) in €
**And** VaR is displayed: P90, P95, P99
**And** distribution chart visualizes the results
**And** confidence interval is indicated

---

### Story 17.3: Security ROI Calculator

As a **RSSI**,
I want **to calculate ROI for security investments**,
So that **I can justify budget requests**.

**Acceptance Criteria:**

**Given** the user proposes a security investment
**When** they enter investment details
**Then** they can specify: Cost, Risks addressed
**And** risk reduction (before/after) is calculated
**And** savings are computed (risk reduction × ALE)
**And** payback period and NPV are displayed
**And** a comparison chart shows investment impact

---

### Story 17.4: COMEX Financial Dashboard

As a **Dirigeant**,
I want **to see financial risk exposure on my dashboard**,
So that **I understand cyber risk in business terms**.

**Acceptance Criteria:**

**Given** the user has direction role
**When** they view their dashboard
**Then** a widget shows: Total Risk Exposure (€), Top 5 Risks by €, ROI of Controls
**And** numbers are in business language (no jargon)
**And** trend shows exposure evolution
**And** clicking drills down to risk details

---

# Q1-Q2 2026 Story Summary

| Epic | Title | Stories | ADR | Priority | Vertical |
|------|-------|---------|-----|----------|----------|
| 13 | DORA ICT Register | 4 | ADR-008 | P0 | Finance |
| 14 | SCADA/ICS Integration | 4 | ADR-009 | P1 | Industrie |
| 15 | Third-Party Risk Management | 4 | ADR-010 | P1 | Tous |
| 16 | ANSSI Homologation | 4 | ADR-011 | P0 | Public |
| 17 | Financial Risk Quantification | 4 | ADR-012 | P1 | Tous |

**Q1-Q2 2026 Total: 20 New Stories across 5 Epics**

---

# Complete Document Summary

| Category | Count |
|----------|-------|
| Core Epics (1-12) | 12 |
| Q1-Q2 2026 Epics (13-17) | 5 |
| **Total Epics** | **17** |
| Core Stories | 55 |
| Q1-Q2 2026 Stories | 20 |
| **Total Stories** | **75** |
| FRs Covered | 53/53 (100%) |
| ADRs Covered | ADR-001 to ADR-012 |

**Document Version:** 2.0
**Updated:** 2026-01-20

