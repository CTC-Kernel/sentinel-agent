# Sentinel GRC - Index du Projet

**Date:** 2026-01-23
**Version:** 1.0
**Derniere mise a jour:** Audit complet de coherence

---

## Vue d'Ensemble du Projet

| Attribut | Valeur |
|----------|--------|
| **Nom** | Sentinel GRC |
| **Type** | SaaS B2B - Plateforme GRC |
| **Stack Frontend** | React + TypeScript + Vite |
| **Stack Backend** | Firebase (Firestore, Functions, Auth, Storage) |
| **Mobile** | React Native (Expo) |
| **Hebergement** | Firebase europe-west1 |

---

## Metriques du Code Source

| Categorie | Quantite | Localisation |
|-----------|----------|--------------|
| Fichiers TS/TSX | 1,144 | `src/` |
| Cloud Functions | 46 | `functions/` |
| Composants | 60 modules | `src/components/` |
| Services | 109 | `src/services/` |
| Hooks | 96 | `src/hooks/` |
| Views | 47 | `src/views/` |
| Schemas Zod | 27 | `src/schemas/` |
| Types | 41 | `src/types/` |
| Utils | 44 | `src/utils/` |

---

## Modules Fonctionnels Implementes

### Core Platform

| Module | Composants | Services | Status |
|--------|------------|----------|--------|
| Dashboard | `dashboard/` | `dashboardService.ts`, `scoreService.ts` | DONE |
| Assets | `assets/` | `assetService.ts`, `classificationService.ts` | DONE |
| Risks | `risks/` | `RiskRemediationService.ts` | DONE |
| Controls | `controls/` | `ComplianceService.ts` | DONE |
| Documents | `documents/` | `documentService.ts`, `DocumentWorkflowService.ts` | DONE |
| Compliance | `compliance/` | `CompliancePackService.ts`, `FrameworkService.ts` | DONE |
| Audits | `audits/` | `auditService.ts`, `AuditPlannerService.ts` | DONE |

### Advanced Modules

| Module | Composants | Services | Status |
|--------|------------|----------|--------|
| EBIOS-RM | `ebios/` | `ebiosService.ts`, `EbiosReportService.ts` | DONE |
| DORA ICT | `dora/` | `DORAExportService.ts`, `ICTProviderService.ts` | DONE |
| Homologation | `homologation/` | `HomologationService.ts`, `HomologationDocumentService.ts` | DONE |
| FAIR/Monte Carlo | `fair/` | `FAIRService.ts`, `MonteCarloService.ts`, `ROICalculatorService.ts` | DONE |
| Voxel 3D | `voxel/` | `voxel/` (services), `voxelExportService.ts` | PARTIAL |
| SMSI Wizard | `smsi/` | `SMSIService.ts` | DONE |
| TPRM/Suppliers | `suppliers/`, `vendor-*` | `SupplierService.ts`, `VendorAssessmentService.ts`, `VendorScoringService.ts` | DONE |

### Enterprise Features

| Module | Composants | Services | Status |
|--------|------------|----------|--------|
| Auth/SSO | `auth/` | `e2eAuthService.ts`, `tokenService.ts` | DONE |
| Admin | `admin/` | `adminService.ts`, `organizationService.ts` | DONE |
| Team | `team/` | `usageAnalytics.ts` | DONE |
| Notifications | `notifications/` | `notificationService.ts`, `pushNotificationService.ts` | DONE |
| Incidents | `incidents/` | `incidentService.ts`, `incidentPlaybookService.ts` | DONE |
| Privacy/RGPD | `privacy/` | `PrivacyService.ts`, `aiPrivacyService.ts` | DONE |
| Continuity | `continuity/` | - | PARTIAL |
| Reports | `reports/` | `scheduledReportsService.ts`, `PdfExportService.ts`, `excelExportService.ts` | DONE |

### Integrations

| Integration | Status |
|-------------|--------|
| Google Calendar | `googleCalendarService.ts` |
| Obsidian | `ObsidianService.ts` |
| NVD (CVE) | `NVDService.ts` |
| Threat Feeds | `ThreatFeedService.ts` |
| Email/SMTP | `emailService.ts` |
| Stripe | `functions/stripe/` |

---

## Documents de Planification

### Plateforme SaaS (Core)

| Document | Fichier | Status |
|----------|---------|--------|
| Product Brief | `product-brief-sentinel-grc-2026-01-20.md` | OK |
| PRD v2.0 | `prd.md` | OK |
| Architecture v2.0 | `architecture.md` | OK |
| UX Design | `ux-design-specification.md` | OK |
| Epics & Stories | `epics.md` | OK |
| Sprint Status | `sprint-status-saas-platform.yaml` | **NOUVEAU** |

### Agent GRC (Endpoint)

| Document | Fichier | Status |
|----------|---------|--------|
| Product Brief | (dans PRD) | OK |
| PRD | `prd-agent-grc.md` | OK |
| Architecture | `architecture-agent-grc.md` | OK |
| Epics | `epics-agent-grc.md` | OK |
| Sprint Status | `sprint-status.yaml` | OK (actif) |

### Module Voxel

| Document | Fichier | Status |
|----------|---------|--------|
| Product Brief | `product-brief-voxel-module-2026-01-22.md` | OK |
| PRD | `prd-voxel-module-2026-01-22.md` | OK |
| UX Design | `ux-design-voxel-module-2026-01-22.md` | OK |
| Architecture | `architecture-voxel-module-2026-01-22.md` | OK |
| Epics | `epics-voxel-module-2026-01-22.md` | OK |

### European Leader Strategy

| Document | Fichier | Status |
|----------|---------|--------|
| Product Brief | `product-brief-sentinel-grc-european-leader-2026-01-22.md` | OK |
| PRD | `prd-european-leader-strategy-2026-01-22.md` | OK |
| Architecture | `architecture-european-leader-2026-01-22.md` | OK |
| Epics | `epics-european-leader-2026-01-22.md` | OK |

### EBIOS-RM + ISO27003

| Document | Fichier | Status |
|----------|---------|--------|
| Product Brief | `product-brief-ebios-rm-iso27003-2026-01-16.md` | OK |
| PRD | `prd-ebios-rm-iso27003.md` | **NOUVEAU** |
| Architecture | `architecture-ebios-rm-iso27003-2026-01-16.md` | OK |
| Epics | `epics-ebios-rm-iso27003-2026-01-16.md` | OK |

### Coffre-fort Documentaire

| Document | Fichier | Status |
|----------|---------|--------|
| Product Brief | `product-brief-coffre-fort-documentaire.md` | **NOUVEAU** |
| PRD | `prd-coffre-fort-documentaire.md` | OK |
| Architecture | `architecture-coffre-fort-documentaire.md` | OK |
| Epics | `epics-coffre-fort-documentaire.md` | OK |

---

### Application Mobile (Expo)

| Document | Fichier | Status |
|----------|---------|--------|
| PRD | `prd-mobile-app.md` | **NOUVEAU** |

---

## Documents d'Audit et Tracking

| Document | Fichier | Date |
|----------|---------|------|
| Rapport d'Audit | `AUDIT-REPORT-2026-01-23.md` | 2026-01-23 |
| Carte des Dependances | `ecosystem-dependencies.md` | 2026-01-23 |
| Index Projet | `PROJECT-INDEX.md` | 2026-01-23 |
| Sprint Status SaaS | `sprint-status-saas-platform.yaml` | 2026-01-23 |
| Sprint Status Voxel | `sprint-status-voxel-module.yaml` | 2026-01-23 |
| Plan Execution EU | `execution-plan-european-leader.md` | 2026-01-23 |
| Guide Nettoyage | `../../../README-CLEANUP.md` | 2026-01-23 |

## Dossier Archive

| Fichier | Raison Archivage |
|---------|------------------|
| `archive/prd-voxel-intelligence-engine.md` | Remplace par voxel-module-2026-01-22 |
| `archive/architecture-voxel-intelligence-engine.md` | Remplace par voxel-module-2026-01-22 |
| `archive/epics-voxel-intelligence-engine.md` | Remplace par voxel-module-2026-01-22 |
| `archive/ARCHIVED-voxel-intelligence-engine.md` | Marqueur d'archivage |

---

## Structure des Repertoires

```
sentinel-grc-v2-prod/
├── _bmad/                    # Configuration BMAD
├── _bmad-output/             # Artefacts BMAD
│   ├── planning-artifacts/   # PRDs, Architecture, Epics
│   └── implementation-artifacts/ # Stories detaillees
├── src/                      # Code source frontend
│   ├── components/           # 60 modules de composants
│   ├── services/             # 109 services
│   ├── hooks/                # 96 hooks
│   ├── views/                # 47 vues
│   ├── schemas/              # Schemas Zod
│   ├── types/                # Types TypeScript
│   └── utils/                # Utilitaires
├── functions/                # Cloud Functions Firebase
│   ├── ai/                   # Fonctions IA
│   ├── auth/                 # Authentification
│   ├── triggers/             # Triggers Firestore
│   ├── scheduled/            # Taches planifiees
│   └── ...
├── mobile/                   # Application mobile (Expo)
├── 3D/                       # Assets 3D Voxel
└── coverage/                 # Rapports de couverture tests
```

---

## Cloud Functions (46)

| Categorie | Fonctions |
|-----------|-----------|
| `ai/` | IA et traitement automatise |
| `auth/` | Authentification et SSO |
| `callable/` | Fonctions appelables |
| `integrations/` | Integrations externes |
| `notifications/` | Push et email |
| `organizations/` | Gestion multi-tenant |
| `scheduled/` | Taches CRON |
| `stripe/` | Paiements et subscriptions |
| `triggers/` | Triggers Firestore |
| `users/` | Gestion utilisateurs |
| `vault/` | Coffre-fort documentaire |
| `voxel/` | Backend Voxel 3D |

---

## Application Mobile (Documentee)

| Fichier | Description |
|---------|-------------|
| `mobile/app/` | Navigation et ecrans |
| `mobile/components/` | Composants React Native |
| `mobile/services/` | Services partages |
| `mobile/App.tsx` | Point d'entree |
| `mobile/firebaseConfig.ts` | Configuration Firebase |

**Documentation:** Voir `prd-mobile-app.md`

---

## Hierarchy Documents Contexte

| Document | Role | Localisation |
|----------|------|--------------|
| **CLAUDE.md** | Quick reference pour Claude Code | Racine projet |
| **project-context.md** | Regles detaillees AI agents | `_bmad-output/` |
| **Architecture docs** | ADRs, decisions techniques | `planning-artifacts/` |

---

## Changelog

| Date | Version | Modification |
|------|---------|--------------|
| 2026-01-23 | 1.0 | Creation initiale lors de l'audit |
| 2026-01-23 | 1.1 | Ajout PRD EBIOS-RM, Brief Coffre-fort |
| 2026-01-23 | 1.2 | Archivage fichiers Voxel, clarification hierarchie docs |

---

*Index genere automatiquement lors de l'audit de coherence du 2026-01-23*
*Derniere mise a jour: 2026-01-23 v1.2*
