---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - 'prd-european-leader-strategy-2026-01-22.md'
  - 'architecture-european-leader-2026-01-22.md'
  - 'project-context.md'
workflowType: 'epics-and-stories'
project_name: 'sentinel-grc-v2-prod'
user_name: 'Thibaultllopis'
date: '2026-01-22'
status: 'completed'
version: '1.0'
total_epics: 5
total_stories: 28
estimated_sprints: 12
---

# Sentinel GRC - European Leader Strategy
## Epic & Story Breakdown

**Version:** 1.0
**Date:** 22 janvier 2026
**PRD Reference:** prd-european-leader-strategy-2026-01-22.md
**Architecture Reference:** architecture-european-leader-2026-01-22.md

---

## Overview

Ce document décompose les exigences du PRD "European Leader Strategy" en epics et stories implémentables, organisées pour une livraison incrémentale sur 12 sprints (6 mois).

### Summary

| Métrique | Valeur |
|----------|--------|
| **Total Epics** | 5 |
| **Total Stories** | 28 |
| **Sprints estimés** | 12 (2 semaines chacun) |
| **MVP Stories** | 15 |
| **Post-MVP Stories** | 13 |

---

## Requirements Inventory

### Functional Requirements (FR)

| ID | Requirement | Priority | Epic |
|----|-------------|----------|------|
| FR-01 | Activer/désactiver des frameworks réglementaires | P0 | Epic 1 |
| FR-02 | Afficher les exigences par framework | P0 | Epic 1 |
| FR-03 | Mapper contrôles ↔ exigences (cross-framework) | P0 | Epic 1 |
| FR-04 | Calculer score de conformité par framework | P0 | Epic 2 |
| FR-05 | Afficher dashboard avec jauges de score | P0 | Epic 2 |
| FR-06 | Suggérer actions prioritaires | P1 | Epic 2 |
| FR-07 | Chat conversationnel avec AI Copilot | P0 | Epic 3 |
| FR-08 | Générer documents de conformité via AI | P1 | Epic 3 |
| FR-09 | Alerter sur évolutions réglementaires | P2 | Epic 3 |
| FR-10 | Sélectionner template sectoriel | P0 | Epic 4 |
| FR-11 | Importer données depuis Excel/CSV | P1 | Epic 4 |
| FR-12 | Exporter rapports PDF | P1 | Epic 4 |
| FR-13 | Changer la langue de l'interface | P0 | Epic 5 |
| FR-14 | Afficher informations hébergement données | P1 | Epic 5 |

### Non-Functional Requirements (NFR)

| ID | Requirement | Target | Epic |
|----|-------------|--------|------|
| NFR-P1 | Page load time | <2s | All |
| NFR-P2 | API response time | P95 <500ms | All |
| NFR-P3 | AI Copilot response | P95 <5s | Epic 3 |
| NFR-S1 | Authentication | Firebase Auth + MFA | Infra |
| NFR-S2 | Data encryption | AES-256 / TLS 1.3 | Infra |
| NFR-M1 | Test coverage | >70% | All |
| NFR-A1 | Uptime SLA | 99.9% | Infra |

### FR Coverage Map

```
Epic 1 (Framework Engine)     → FR-01, FR-02, FR-03
Epic 2 (Compliance Dashboard) → FR-04, FR-05, FR-06
Epic 3 (AI Copilot)          → FR-07, FR-08, FR-09
Epic 4 (Templates & Import)   → FR-10, FR-11, FR-12
Epic 5 (Localization)        → FR-13, FR-14
```

---

## Epic List

| Epic | Title | Priority | Stories | Sprints |
|------|-------|----------|---------|---------|
| **1** | Multi-Framework Engine | P0 | 6 | 2-3 |
| **2** | Compliance Dashboard & Scoring | P0 | 6 | 2-3 |
| **3** | AI Compliance Copilot | P0 | 6 | 3-4 |
| **4** | Templates & Data Import | P1 | 5 | 2 |
| **5** | Localization & Sovereignty | P1 | 5 | 2 |

---

## Epic 1: Multi-Framework Engine

**Goal:** Permettre la gestion de conformité multi-framework (NIS2, DORA, RGPD, AI Act) avec cross-mapping des contrôles.

**Business Value:** Réduction de 60% des efforts de conformité grâce à la mutualisation des contrôles entre frameworks.

**Dependencies:** None (foundational)

**Acceptance Criteria (Epic Level):**
- [ ] Utilisateur peut activer NIS2, DORA, RGPD
- [ ] Exigences affichées par framework avec filtres
- [ ] Contrôles mappés à plusieurs frameworks simultanément
- [ ] Vue matricielle cross-framework disponible

---

### Story 1.1: Créer le data model Framework

**As a** developer,
**I want** a Firestore data model for frameworks and requirements,
**So that** we can store and query regulatory data efficiently.

**Acceptance Criteria:**

**Given** the Firestore database
**When** I create the frameworks collection schema
**Then** it supports Framework, Requirement, and ControlMapping entities
**And** indexes are configured for common queries
**And** security rules enforce organization isolation

**Technical Notes:**
- Implement types in `src/types/framework.ts`
- Create Firestore collections: `frameworks`, `requirements`, `controlMappings`
- Add composite indexes for cross-framework queries

**Story Points:** 5

---

### Story 1.2: Implémenter FrameworkService

**As a** developer,
**I want** a FrameworkService with CRUD operations,
**So that** components can interact with framework data.

**Acceptance Criteria:**

**Given** the FrameworkService class
**When** I call `getFrameworks()`
**Then** it returns all available frameworks with metadata
**And** results are cached via TanStack Query

**Given** the FrameworkService class
**When** I call `getRequirements(frameworkId)`
**Then** it returns all requirements for that framework
**And** requirements are grouped by category

**Given** the FrameworkService class
**When** I call `getMappings(controlId)`
**Then** it returns all framework mappings for that control

**Technical Notes:**
- Follow static method pattern per project-context.md
- Use `ErrorLogger.handleErrorWithToast()` for errors
- Implement in `src/services/FrameworkService.ts`

**Story Points:** 5

---

### Story 1.3: Créer le composant FrameworkSelector

**As a** RSSI,
**I want** to activate frameworks relevant to my organization,
**So that** I only see applicable requirements.

**Acceptance Criteria:**

**Given** I am on the Framework settings page
**When** I view the framework list
**Then** I see all available frameworks (NIS2, DORA, RGPD, AI Act)
**And** each shows a description and requirement count

**Given** I toggle a framework to active
**When** the toggle changes
**Then** the framework is activated for my organization
**And** a success toast confirms the change
**And** the dashboard updates to include this framework

**Given** I have 0 frameworks active
**When** I view the compliance dashboard
**Then** I see an empty state prompting me to activate a framework

**Technical Notes:**
- Component: `src/features/frameworks/components/FrameworkSelector.tsx`
- Use glass-panel styling per design system
- Persist to Firestore `organizations/{orgId}/activeFrameworks`

**Story Points:** 5

---

### Story 1.4: Créer la vue RequirementsList

**As a** RSSI,
**I want** to browse requirements by framework,
**So that** I understand what I need to comply with.

**Acceptance Criteria:**

**Given** I select a framework (e.g., NIS2)
**When** the requirements list loads
**Then** I see all requirements grouped by category
**And** each requirement shows article reference, title, and criticality

**Given** I am viewing requirements
**When** I click on a requirement
**Then** I see the full description and linked controls
**And** I can navigate to each linked control

**Given** I am viewing requirements
**When** I use the filter controls
**Then** I can filter by category, criticality, and compliance status

**Technical Notes:**
- Component: `src/features/frameworks/components/RequirementsList.tsx`
- Use virtualized list for performance (>500 requirements)
- Implement category accordion pattern

**Story Points:** 8

---

### Story 1.5: Implémenter le Cross-Framework Mapping

**As a** RSSI,
**I want** to see which controls satisfy multiple frameworks,
**So that** I can optimize my compliance efforts.

**Acceptance Criteria:**

**Given** I am on the Mapping page
**When** I view a control
**Then** I see all frameworks it maps to with coverage percentage

**Given** I am viewing the mapping matrix
**When** I select "View by Control"
**Then** I see a table with controls as rows and frameworks as columns
**And** cells indicate mapping status (full, partial, none)

**Given** I am viewing the mapping matrix
**When** I hover over a mapped cell
**Then** I see the specific requirements covered

**Technical Notes:**
- Component: `src/features/frameworks/components/MappingMatrix.tsx`
- Use intersection logic for cross-framework coverage
- Export matrix to Excel (defer to Epic 4)

**Story Points:** 8

---

### Story 1.6: Seed NIS2 Framework Data

**As a** product owner,
**I want** NIS2 framework data pre-loaded,
**So that** users can immediately start their NIS2 compliance journey.

**Acceptance Criteria:**

**Given** a new organization activates NIS2
**When** they view NIS2 requirements
**Then** they see all 21 articles with sub-requirements
**And** requirements are categorized (governance, risk, incident, etc.)
**And** each has criticality assigned (high/medium/low)

**Given** the NIS2 data
**When** I check the control mappings
**Then** each requirement has suggested control templates

**Technical Notes:**
- Create seed script: `scripts/seed-nis2.ts`
- Source: Official NIS2 directive text
- Include French and English translations
- Run via Cloud Function or admin script

**Story Points:** 8

---

## Epic 2: Compliance Dashboard & Scoring

**Goal:** Fournir une vue unifiée du niveau de conformité avec scores gamifiés et actions prioritaires.

**Business Value:** Visibilité instantanée sur la posture de conformité, motivation via gamification.

**Dependencies:** Epic 1 (Framework Engine)

**Acceptance Criteria (Epic Level):**
- [ ] Dashboard affiche score global et par framework
- [ ] Jauge visuelle style Apple Health
- [ ] Trend sur 30 jours visible
- [ ] Actions prioritaires suggérées

---

### Story 2.1: Implémenter le ScoringEngine

**As a** developer,
**I want** a scoring algorithm that calculates compliance scores,
**So that** users see accurate, real-time compliance metrics.

**Acceptance Criteria:**

**Given** an organization with assessments
**When** the ScoringEngine calculates
**Then** it returns a score 0-100 per framework
**And** scoring is weighted by criticality (high=3x, medium=2x, low=1x)
**And** calculation completes in <100ms

**Given** an assessment is updated
**When** the Firestore trigger fires
**Then** the score is recalculated automatically
**And** the new score is written to `complianceScores` collection

**Technical Notes:**
- Cloud Function: `functions/src/triggers/onAssessmentWrite.ts`
- Algorithm in `functions/src/lib/scoring.ts`
- Denormalize scores for fast reads

**Story Points:** 8

---

### Story 2.2: Créer le composant ComplianceGauge

**As a** RSSI,
**I want** a visual gauge showing my compliance score,
**So that** I understand my posture at a glance.

**Acceptance Criteria:**

**Given** I am on the dashboard
**When** I view the ComplianceGauge
**Then** I see a circular gauge with my overall score (0-100)
**And** the color indicates status (green >75, orange 50-75, red <50)
**And** the gauge animates smoothly when score changes

**Given** I have multiple frameworks active
**When** I view the dashboard
**Then** I see mini-gauges for each framework
**And** clicking a mini-gauge shows detailed breakdown

**Technical Notes:**
- Component: `src/features/dashboard/components/ComplianceGauge.tsx`
- Use SVG for smooth animations
- Respect `prefers-reduced-motion`
- Apple Health visual inspiration

**Story Points:** 5

---

### Story 2.3: Créer le composant TrendChart

**As a** RSSI,
**I want** to see my compliance trend over time,
**So that** I can track improvement or regression.

**Acceptance Criteria:**

**Given** I am on the dashboard
**When** I view the TrendChart
**Then** I see a 30-day line chart of my overall score
**And** I can toggle between frameworks

**Given** the trend shows improvement
**When** I view the chart
**Then** I see a green indicator with "+X points this month"

**Given** the trend shows decline
**When** I view the chart
**Then** I see a red indicator with "-X points this month"

**Technical Notes:**
- Component: `src/features/dashboard/components/TrendChart.tsx`
- Use lightweight chart library (recharts or visx)
- Pull from `complianceScores` history

**Story Points:** 5

---

### Story 2.4: Créer le composant ActionsList

**As a** RSSI,
**I want** prioritized action recommendations,
**So that** I know where to focus my efforts.

**Acceptance Criteria:**

**Given** I am on the dashboard
**When** I view the ActionsList
**Then** I see 3-5 recommended actions sorted by impact
**And** each action shows potential score improvement

**Given** an action is displayed
**When** I click on it
**Then** I navigate to the relevant control or requirement

**Given** I complete an action
**When** I return to the dashboard
**Then** the action is removed and replaced with the next priority

**Technical Notes:**
- Component: `src/features/dashboard/components/ActionsList.tsx`
- Algorithm: prioritize by (criticality × gap_size)
- Link to control assessment flow

**Story Points:** 5

---

### Story 2.5: Implémenter le Compliance Store (Zustand)

**As a** developer,
**I want** a Zustand store for compliance state,
**So that** components can share compliance data efficiently.

**Acceptance Criteria:**

**Given** the complianceStore
**When** I call `fetchScores(orgId)`
**Then** it loads all scores from Firestore
**And** scores are available via selectors

**Given** scores are loaded
**When** I call `getScoreByFramework(frameworkId)`
**Then** it returns the specific score or null

**Given** the store is initialized
**When** I call `subscribeToScores(orgId)`
**Then** it returns an unsubscribe function
**And** scores update in real-time on Firestore changes

**Technical Notes:**
- Store: `src/stores/complianceStore.ts`
- Use fine-grained selectors per project-context.md
- Integrate with TanStack Query for caching

**Story Points:** 5

---

### Story 2.6: Créer la page Dashboard unifiée

**As a** RSSI,
**I want** a single dashboard page with all compliance insights,
**So that** I have a command center for my GRC activities.

**Acceptance Criteria:**

**Given** I navigate to /dashboard
**When** the page loads
**Then** I see the ComplianceGauge, TrendChart, and ActionsList
**And** page loads in <2s (NFR-P1)

**Given** I have no frameworks active
**When** I view the dashboard
**Then** I see an onboarding prompt to activate frameworks

**Given** I am on mobile
**When** I view the dashboard
**Then** components stack vertically and remain usable

**Technical Notes:**
- Page: `src/views/ComplianceDashboard.tsx`
- Use responsive grid layout
- Lazy load charts for performance

**Story Points:** 5

---

## Epic 3: AI Compliance Copilot

**Goal:** Assistant IA conversationnel pour guider la conformité, répondre aux questions et générer des documents.

**Business Value:** Réduction de 80% du temps de recherche réglementaire, accélération de la documentation.

**Dependencies:** Epic 1 (for context), Claude API access

**Acceptance Criteria (Epic Level):**
- [ ] Chat fonctionnel avec réponses <5s
- [ ] Citations des articles de loi incluses
- [ ] Génération de documents (politique, procédure)
- [ ] Historique des conversations persisté

---

### Story 3.1: Configurer Claude API et RAG Pipeline

**As a** developer,
**I want** Claude API integrated with a RAG pipeline,
**So that** the Copilot can answer with regulatory context.

**Acceptance Criteria:**

**Given** the Cloud Function environment
**When** I configure Claude API
**Then** API key is stored in Secret Manager
**And** requests are authenticated correctly

**Given** the RAG pipeline
**When** a user asks a question
**Then** relevant regulatory documents are retrieved from Pinecone
**And** context is included in the Claude prompt

**Given** the vector database
**When** I query for "NIS2 incident reporting"
**Then** relevant NIS2 articles are returned with similarity scores

**Technical Notes:**
- Cloud Function: `functions/src/callable/copilot.ts`
- Vector DB: Pinecone (EU region)
- Embeddings: text-embedding-3-small
- Store Claude key in Firebase Secret Manager

**Story Points:** 8

---

### Story 3.2: Créer le composant CopilotPanel

**As a** RSSI,
**I want** a chat interface to ask compliance questions,
**So that** I get instant answers without searching documentation.

**Acceptance Criteria:**

**Given** I am on any page
**When** I click the Copilot icon
**Then** a slide-out panel opens with chat interface

**Given** the chat panel is open
**When** I type a question and press Enter
**Then** my message appears in the chat
**And** a loading indicator shows while waiting
**And** the response streams in progressively

**Given** a response is displayed
**When** it includes citations
**Then** citations are clickable links to the source

**Technical Notes:**
- Component: `src/features/copilot/components/CopilotPanel.tsx`
- Use SSE for streaming responses
- Panel slides from right side
- Keyboard shortcut: Cmd+K to open

**Story Points:** 8

---

### Story 3.3: Implémenter le message streaming

**As a** RSSI,
**I want** AI responses to stream in real-time,
**So that** I see progress and don't wait for full response.

**Acceptance Criteria:**

**Given** I send a message
**When** the AI starts responding
**Then** text streams word-by-word
**And** I can see the response building

**Given** streaming is in progress
**When** I scroll up
**Then** streaming continues without interruption

**Given** an error occurs during streaming
**When** the connection fails
**Then** I see an error message with retry option

**Technical Notes:**
- Use Server-Sent Events (SSE)
- Cloud Function with streaming response
- Handle reconnection gracefully

**Story Points:** 5

---

### Story 3.4: Ajouter les actions contextuelles

**As a** RSSI,
**I want** actionable buttons in AI responses,
**So that** I can act on recommendations immediately.

**Acceptance Criteria:**

**Given** the AI recommends creating a control
**When** the response renders
**Then** I see a "Create Control" button
**And** clicking it opens the control creation form pre-filled

**Given** the AI references a specific requirement
**When** I see the citation
**Then** clicking it navigates to that requirement

**Given** the AI suggests an assessment
**When** I click "Start Assessment"
**Then** I navigate to the assessment form for that control

**Technical Notes:**
- Parse response for action markers
- Component: `src/features/copilot/components/ActionButton.tsx`
- Define action types: create_control, view_requirement, start_assessment

**Story Points:** 5

---

### Story 3.5: Implémenter la génération de documents

**As a** RSSI,
**I want** the AI to generate compliance documents,
**So that** I save time on documentation.

**Acceptance Criteria:**

**Given** I ask "Generate a security policy for NIS2"
**When** the AI processes the request
**Then** it generates a policy document tailored to my organization
**And** the document appears in a preview modal

**Given** a document is generated
**When** I click "Download"
**Then** I receive a Word document (.docx)
**And** the document includes my organization name and date

**Given** a document is generated
**When** I click "Edit"
**Then** I can modify the content before downloading

**Technical Notes:**
- Cloud Function: `functions/src/callable/generateDocument.ts`
- Use docx library for Word generation
- Template types: policy, procedure, risk_assessment

**Story Points:** 8

---

### Story 3.6: Persister l'historique des conversations

**As a** RSSI,
**I want** my conversation history saved,
**So that** I can reference past answers.

**Acceptance Criteria:**

**Given** I have a conversation
**When** I close and reopen the Copilot
**Then** my conversation history is preserved

**Given** I have multiple conversations
**When** I view history
**Then** I see a list of past conversations with dates
**And** I can switch between them

**Given** I want to start fresh
**When** I click "New Conversation"
**Then** a new conversation starts
**And** the previous one is saved in history

**Technical Notes:**
- Collection: `copilotConversations/{conversationId}/messages`
- Store user and assistant messages
- Limit history to 50 conversations per user

**Story Points:** 5

---

## Epic 4: Templates & Data Import

**Goal:** Accélérer l'onboarding avec des templates sectoriels et l'import de données existantes.

**Business Value:** Time-to-value réduit de 3 mois à 1 semaine.

**Dependencies:** Epic 1 (Framework Engine)

**Acceptance Criteria (Epic Level):**
- [ ] 5 templates sectoriels disponibles
- [ ] Import Excel fonctionnel avec mapping
- [ ] Export PDF des rapports

---

### Story 4.1: Créer le catalogue de templates

**As a** nouveau client,
**I want** to choose a template for my industry,
**So that** I start with relevant controls pre-configured.

**Acceptance Criteria:**

**Given** I am in the onboarding flow
**When** I reach the template selection step
**Then** I see 5+ industry templates (Industrie, Finance, Santé, Tech, Public)
**And** each shows description and control count

**Given** I select a template
**When** I click "Preview"
**Then** I see the list of controls included
**And** I can proceed or go back

**Given** I confirm a template
**When** the activation completes
**Then** controls are created in my organization
**And** framework mappings are applied

**Technical Notes:**
- Component: `src/features/templates/components/TemplateCatalog.tsx`
- Store templates in `templates` collection
- Use batch writes for control creation

**Story Points:** 8

---

### Story 4.2: Implémenter l'import Excel/CSV

**As a** RSSI,
**I want** to import my existing control inventory from Excel,
**So that** I don't re-enter data manually.

**Acceptance Criteria:**

**Given** I am on the Import page
**When** I upload an Excel file
**Then** the system parses the file and shows preview
**And** I see column mapping suggestions

**Given** columns are mapped
**When** I click "Validate"
**Then** I see a report of valid/invalid rows
**And** I can fix errors before importing

**Given** validation passes
**When** I click "Import"
**Then** controls are created in my organization
**And** I see a success summary with count

**Technical Notes:**
- Cloud Function: `functions/src/callable/importData.ts`
- Use SheetJS for Excel parsing
- Support .xlsx and .csv formats
- Maximum 10,000 rows per import

**Story Points:** 8

---

### Story 4.3: Créer l'export PDF des rapports

**As a** RSSI,
**I want** to export compliance reports as PDF,
**So that** I can share with auditors and management.

**Acceptance Criteria:**

**Given** I am on the Reports page
**When** I select "Compliance Summary Report"
**Then** I see a preview of the report content

**Given** I click "Export PDF"
**When** the generation completes
**Then** I download a professionally formatted PDF
**And** it includes score gauges, charts, and control status

**Given** I select a framework-specific report
**When** I export
**Then** the PDF shows only that framework's requirements and status

**Technical Notes:**
- Cloud Function: `functions/src/callable/exportReport.ts`
- Use Puppeteer for HTML-to-PDF
- Include organization logo if uploaded

**Story Points:** 8

---

### Story 4.4: Seed templates sectoriels

**As a** product owner,
**I want** 5 industry templates ready at launch,
**So that** users can onboard quickly.

**Acceptance Criteria:**

**Given** the template catalog
**When** a user views it
**Then** they see: Industrie, Finance, Santé, Tech/SaaS, Collectivités

**Given** each template
**When** activated
**Then** it creates 100-250 controls with proper mappings

**Technical Notes:**
- Create seed scripts for each template
- Map controls to NIS2, DORA, RGPD as appropriate
- Include French descriptions

**Story Points:** 13

---

### Story 4.5: Ajouter le mapping intelligent à l'import

**As a** RSSI,
**I want** the import to suggest framework mappings,
**So that** my imported controls are linked to requirements.

**Acceptance Criteria:**

**Given** I import controls
**When** a control name matches a known pattern
**Then** the system suggests framework mappings
**And** I can accept or reject suggestions

**Given** I accept suggestions
**When** the import completes
**Then** controls are mapped to suggested requirements

**Technical Notes:**
- Use keyword matching for suggestions
- Allow manual mapping override
- Log mapping decisions for ML improvement

**Story Points:** 5

---

## Epic 5: Localization & Sovereignty

**Goal:** Support multi-langue (FR/EN/DE) et garantir la souveraineté des données.

**Business Value:** Accès au marché DACH, conformité RGPD renforcée, éligibilité SecNumCloud.

**Dependencies:** None (can run in parallel)

**Acceptance Criteria (Epic Level):**
- [ ] Interface disponible en FR, EN, DE
- [ ] Contenu réglementaire localisé
- [ ] Page Data Residency avec infos hébergement

---

### Story 5.1: Configurer react-i18next

**As a** developer,
**I want** i18n infrastructure in place,
**So that** we can add translations incrementally.

**Acceptance Criteria:**

**Given** the application
**When** I configure react-i18next
**Then** translations load from JSON files
**And** language detection works (browser preference)
**And** fallback chain is EN → FR → key

**Given** a missing translation
**When** the key is rendered
**Then** it falls back gracefully
**And** missing keys are logged in development

**Technical Notes:**
- Install react-i18next
- Structure: `public/locales/{lang}/{namespace}.json`
- Namespaces: common, dashboard, frameworks, copilot

**Story Points:** 3

---

### Story 5.2: Traduire l'interface en EN/FR

**As a** user,
**I want** the interface in my preferred language,
**So that** I understand all features.

**Acceptance Criteria:**

**Given** my browser is set to French
**When** I load the app
**Then** all UI text is in French

**Given** I change language in settings
**When** I select English
**Then** the interface switches to English immediately
**And** my preference is saved

**Given** I view the Copilot
**When** I chat
**Then** responses are in my selected language

**Technical Notes:**
- Create translation files for all namespaces
- Ensure date/number formatting respects locale
- Test RTL readiness (for future Arabic support)

**Story Points:** 8

---

### Story 5.3: Ajouter la traduction allemande

**As a** German user,
**I want** the interface in German,
**So that** I can use the product in my language.

**Acceptance Criteria:**

**Given** I select German in settings
**When** the language changes
**Then** all UI text is in German
**And** regulatory content (NIS2, DORA) is in German

**Given** I use the Copilot in German
**When** I ask questions
**Then** responses are in German
**And** citations reference German translations of articles

**Technical Notes:**
- Hire/contract German translator
- Translate all namespaces
- German NIS2 directive as source for regulatory content

**Story Points:** 8

---

### Story 5.4: Créer la page Data Residency

**As a** DPO,
**I want** to see where my data is hosted,
**So that** I can verify GDPR compliance.

**Acceptance Criteria:**

**Given** I navigate to Settings > Data Residency
**When** the page loads
**Then** I see the datacenter location (e.g., Belgium, eur3)
**And** I see the hosting provider (Google Cloud)

**Given** I want proof of location
**When** I click "Download Certificate"
**Then** I receive a PDF attestation of data residency

**Given** SecNumCloud is available
**When** I view the page
**Then** I see information about the SecNumCloud option

**Technical Notes:**
- Page: `src/views/DataResidency.tsx`
- Pull region from Firebase config
- Generate attestation PDF dynamically

**Story Points:** 5

---

### Story 5.5: Localiser le contenu réglementaire

**As a** German RSSI,
**I want** NIS2/DORA requirements in German,
**So that** I reference official translations.

**Acceptance Criteria:**

**Given** I have German selected
**When** I view NIS2 requirements
**Then** article text is in German
**And** matches official German NIS2 translation

**Given** I have French selected
**When** I view DORA requirements
**Then** article text is in French

**Technical Notes:**
- Store translations in Firestore (localized subcollections)
- Source from EUR-Lex official translations
- Fall back to English if translation unavailable

**Story Points:** 8

---

## Sprint Planning Recommendation

### MVP (Sprints 1-6)

| Sprint | Epics/Stories | Goal |
|--------|---------------|------|
| **1** | 1.1, 1.2, 1.6 | Framework data model + NIS2 seed |
| **2** | 1.3, 1.4, 1.5 | Framework UI components |
| **3** | 2.1, 2.5 | Scoring engine + store |
| **4** | 2.2, 2.3, 2.4, 2.6 | Dashboard UI |
| **5** | 3.1, 3.2 | Copilot backend + UI |
| **6** | 3.3, 3.4, 3.6 | Copilot streaming + history |

### Post-MVP (Sprints 7-12)

| Sprint | Epics/Stories | Goal |
|--------|---------------|------|
| **7** | 3.5 | Document generation |
| **8** | 4.1, 4.4 | Templates catalog + seed |
| **9** | 4.2, 4.3, 4.5 | Import/Export |
| **10** | 5.1, 5.2 | i18n FR/EN |
| **11** | 5.3, 5.5 | German localization |
| **12** | 5.4 + Polish | Data residency + final polish |

---

## Appendix: Story Status Tracker

| Story | Status | Assignee | Sprint |
|-------|--------|----------|--------|
| 1.1 | 🔵 To Do | - | 1 |
| 1.2 | 🔵 To Do | - | 1 |
| 1.3 | 🔵 To Do | - | 2 |
| 1.4 | 🔵 To Do | - | 2 |
| 1.5 | 🔵 To Do | - | 2 |
| 1.6 | 🔵 To Do | - | 1 |
| 2.1 | 🔵 To Do | - | 3 |
| 2.2 | 🔵 To Do | - | 4 |
| 2.3 | 🔵 To Do | - | 4 |
| 2.4 | 🔵 To Do | - | 4 |
| 2.5 | 🔵 To Do | - | 3 |
| 2.6 | 🔵 To Do | - | 4 |
| 3.1 | 🔵 To Do | - | 5 |
| 3.2 | 🔵 To Do | - | 5 |
| 3.3 | 🔵 To Do | - | 6 |
| 3.4 | 🔵 To Do | - | 6 |
| 3.5 | 🔵 To Do | - | 7 |
| 3.6 | 🔵 To Do | - | 6 |
| 4.1 | 🔵 To Do | - | 8 |
| 4.2 | 🔵 To Do | - | 9 |
| 4.3 | 🔵 To Do | - | 9 |
| 4.4 | 🔵 To Do | - | 8 |
| 4.5 | 🔵 To Do | - | 9 |
| 5.1 | 🔵 To Do | - | 10 |
| 5.2 | 🔵 To Do | - | 10 |
| 5.3 | 🔵 To Do | - | 11 |
| 5.4 | 🔵 To Do | - | 12 |
| 5.5 | 🔵 To Do | - | 11 |

**Legend:** 🔵 To Do | 🟡 In Progress | 🟢 Done | 🔴 Blocked

---

*Epics & Stories v1.0*
*Sentinel GRC - European Leader Strategy*
*22 janvier 2026*
