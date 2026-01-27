---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow_completed: true
completion_date: '2026-01-27'
inputDocuments: ['prd-nis2-completion-2026-01-27.md', 'architecture-nis2-completion-2026-01-27.md']
total_epics: 3
total_stories: 28
total_points: 88
---

# Epics & Stories - NIS2 Completion Modules

**Project:** Sentinel GRC v2 - NIS2 Completion
**Date:** 2026-01-27
**Version:** 1.0

---

## Summary

| Epic | Stories | Points | Sprint |
|------|---------|--------|--------|
| **Epic 1: Formation & Sensibilisation** | 12 | 34 | Sprint 1 |
| **Epic 2: Certificats & Crypto** | 6 | 16 | Sprint 2 |
| **Epic 3: Revue des Acces** | 10 | 23 | Sprint 2 |
| **Integration & Tests** | - | 15 | Sprint 3 |
| **TOTAL** | **28** | **88** | **5 weeks** |

---

## Epic 1: Formation & Sensibilisation Cyber

**Epic ID:** NIS2-TRN
**NIS2 Coverage:** Article 21.2(g)
**Priority:** High
**Sprint:** 1

### Description

Implementer un module complet de gestion des formations et de la sensibilisation cyber pour permettre aux organisations de demontrer leur conformite a l'Article 21.2(g) de NIS2.

### Acceptance Criteria (Epic Level)

- [ ] Catalogue de formations avec CRUD complet
- [ ] Systeme d'assignation avec tracking de progression
- [ ] Dashboard avec metriques de completion
- [ ] Integration avec le score de conformite
- [ ] Notifications automatiques de rappel

---

### Story 1.1: Types et Service Training

**ID:** NIS2-TRN-001
**Points:** 3
**Priority:** High

**Description:**
En tant que developpeur, je veux creer les types TypeScript et le service TrainingService afin de fournir la couche de donnees pour le module formation.

**Acceptance Criteria:**
- [ ] Types definis dans `src/types/training.ts`
  - TrainingCourse
  - TrainingAssignment
  - TrainingCampaign
  - TrainingStats
- [ ] TrainingService avec methodes CRUD dans `src/services/TrainingService.ts`
- [ ] Schema Zod dans `src/schemas/trainingSchema.ts`
- [ ] Tests unitaires avec >80% coverage

**Technical Notes:**
- Suivre le pattern service statique existant
- Utiliser `serverTimestamp()` pour createdAt/updatedAt
- Toujours filtrer par `organizationId`

**Files to Create/Modify:**
- `src/types/training.ts` (create)
- `src/services/TrainingService.ts` (create)
- `src/schemas/trainingSchema.ts` (create)
- `src/services/__tests__/TrainingService.test.ts` (create)

---

### Story 1.2: Training Zustand Store

**ID:** NIS2-TRN-002
**Points:** 2
**Priority:** High

**Description:**
En tant que developpeur, je veux creer le store Zustand pour le module training afin de gerer l'etat local de maniere performante.

**Acceptance Criteria:**
- [ ] Store cree dans `src/stores/trainingStore.ts`
- [ ] Selectors fins pour eviter les re-renders
- [ ] Actions pour setCourses, setAssignments, setStats
- [ ] Devtools integration pour debug

**Technical Notes:**
- Utiliser le pattern selector fin (pas de destructuration complete)
- Utiliser `shallow` pour les comparaisons d'objets

**Files to Create/Modify:**
- `src/stores/trainingStore.ts` (create)

---

### Story 1.3: Catalogue de Formations UI

**ID:** NIS2-TRN-003
**Points:** 5
**Priority:** High

**Description:**
En tant qu'admin, je veux voir et gerer le catalogue de formations afin d'avoir une bibliotheque de formations disponibles.

**Acceptance Criteria:**
- [ ] Liste des formations avec filtres (categorie, source)
- [ ] Recherche textuelle sur titre/description
- [ ] Bouton "Ajouter une formation"
- [ ] Actions: Voir, Modifier, Archiver
- [ ] Badge "Obligatoire" sur les formations requises
- [ ] Affichage de la duree et du framework mapping

**UI Components:**
- TrainingCatalog.tsx - Liste principale
- TrainingCourseCard.tsx - Card individuelle
- TrainingCourseFilters.tsx - Filtres

**Technical Notes:**
- Utiliser le composant Table existant
- Apple design system (glass-panel, rounded-2xl)

**Files to Create/Modify:**
- `src/components/training/TrainingCatalog.tsx` (create)
- `src/components/training/TrainingCourseCard.tsx` (create)

---

### Story 1.4: Formulaire Creation Formation

**ID:** NIS2-TRN-004
**Points:** 5
**Priority:** High

**Description:**
En tant qu'admin, je veux creer et modifier une formation afin d'enrichir le catalogue.

**Acceptance Criteria:**
- [ ] Formulaire avec champs: titre, description, categorie, source, duree
- [ ] Toggle "Formation obligatoire"
- [ ] Selection des roles cibles (multi-select)
- [ ] Mapping framework (NIS2, ISO27001)
- [ ] Type de contenu (video, document, quiz, lien externe)
- [ ] Validation Zod avec messages d'erreur
- [ ] Mode creation et edition

**Technical Notes:**
- Utiliser react-hook-form + zodResolver
- Drawer ou Modal selon le design existant

**Files to Create/Modify:**
- `src/components/training/TrainingCourseForm.tsx` (create)

---

### Story 1.5: Assignation de Formation

**ID:** NIS2-TRN-005
**Points:** 5
**Priority:** High

**Description:**
En tant que manager, je veux assigner une formation a un ou plusieurs employes afin de planifier leur sensibilisation.

**Acceptance Criteria:**
- [ ] Selection d'une formation depuis le catalogue
- [ ] Selection utilisateur(s) - individuel ou equipe
- [ ] Date limite (deadline) obligatoire
- [ ] Preview du nombre d'assignations a creer
- [ ] Confirmation avant creation
- [ ] Notification email aux assignes

**Technical Notes:**
- Assignation en batch si plusieurs utilisateurs
- Utiliser la collection users filtree par org

**Files to Create/Modify:**
- `src/components/training/TrainingAssignmentForm.tsx` (create)
- `src/hooks/training/useTrainingAssignment.ts` (create)

---

### Story 1.6: Page "Mes Formations" (Employe)

**ID:** NIS2-TRN-006
**Points:** 5
**Priority:** High

**Description:**
En tant qu'employe, je veux voir mes formations assignees et leur statut afin de suivre ma progression.

**Acceptance Criteria:**
- [ ] Liste de mes formations assignees
- [ ] Status visible (A faire, En cours, Termine, En retard)
- [ ] Date limite avec countdown
- [ ] Bouton "Commencer" ou "Continuer"
- [ ] Bouton "Marquer comme termine"
- [ ] Acces au contenu de la formation
- [ ] Telechargement attestation si complete

**Technical Notes:**
- Filtrer par userId courant
- Tri par deadline (plus urgent en premier)

**Files to Create/Modify:**
- `src/components/training/MyTrainingPage.tsx` (create)
- `src/components/training/TrainingProgressCard.tsx` (create)

---

### Story 1.7: Dashboard Formation

**ID:** NIS2-TRN-007
**Points:** 5
**Priority:** High

**Description:**
En tant que RSSI, je veux voir un dashboard des formations afin de suivre la conformite de mon organisation.

**Acceptance Criteria:**
- [ ] KPI Cards: Total, Completes, En retard, Taux completion
- [ ] Graphique completion par departement (bar chart)
- [ ] Liste des formations en retard avec actions
- [ ] Trend 30 jours (line chart)
- [ ] Export CSV des donnees

**Technical Notes:**
- Utiliser Recharts pour les graphiques
- Composants widget reutilisables

**Files to Create/Modify:**
- `src/components/training/TrainingDashboard.tsx` (create)
- `src/components/training/widgets/TrainingKPICards.tsx` (create)
- `src/components/training/widgets/TrainingByDepartment.tsx` (create)
- `src/components/training/widgets/TrainingOverdueList.tsx` (create)
- `src/hooks/training/useTrainingStats.ts` (create)

---

### Story 1.8: Campagnes de Formation

**ID:** NIS2-TRN-008
**Points:** 5
**Priority:** Medium

**Description:**
En tant qu'admin, je veux creer des campagnes de sensibilisation afin de planifier des formations groupees.

**Acceptance Criteria:**
- [ ] Liste des campagnes (actives, terminees)
- [ ] Creation campagne: nom, dates, formations incluses
- [ ] Scope: tous, departement, role
- [ ] Recurrence optionnelle (mensuelle, trimestrielle)
- [ ] Vue detail avec progression
- [ ] Lancement manuel ou automatique

**Files to Create/Modify:**
- `src/components/training/TrainingCampaignList.tsx` (create)
- `src/components/training/TrainingCampaignForm.tsx` (create)
- `src/components/training/TrainingCampaignDetail.tsx` (create)

---

### Story 1.9: Generation Attestation PDF

**ID:** NIS2-TRN-009
**Points:** 3
**Priority:** Medium

**Description:**
En tant qu'employe, je veux telecharger une attestation de completion afin de prouver ma formation.

**Acceptance Criteria:**
- [ ] PDF genere avec nom, formation, date, score
- [ ] Logo organisation
- [ ] QR code de verification
- [ ] Signature numerique (hash)
- [ ] Stockage dans Firebase Storage
- [ ] Lien de telechargement dans l'UI

**Technical Notes:**
- Utiliser pdf-lib ou jspdf existant
- Cloud Function callable pour generation

**Files to Create/Modify:**
- `functions/src/training/generateCertificate.ts` (create)
- `src/components/training/TrainingCertificate.tsx` (create)

---

### Story 1.10: Cloud Functions Training

**ID:** NIS2-TRN-010
**Points:** 3
**Priority:** High

**Description:**
En tant que systeme, je veux des Cloud Functions pour automatiser les rappels et les mises a jour de statut.

**Acceptance Criteria:**
- [ ] `checkTrainingDeadlines` - Scheduled daily, marque les overdue
- [ ] `sendTrainingReminders` - Scheduled daily, envoie rappels 7j/1j
- [ ] `onTrainingComplete` - Trigger, flag recalcul score
- [ ] Logs structures pour monitoring

**Files to Create/Modify:**
- `functions/src/training/checkDeadlines.ts` (create)
- `functions/src/training/sendReminders.ts` (create)
- `functions/src/training/onAssignmentComplete.ts` (create)
- `functions/src/training/index.ts` (create)

---

### Story 1.11: Integration Score Conformite

**ID:** NIS2-TRN-011
**Points:** 2
**Priority:** High

**Description:**
En tant que systeme, je veux que le score formation impacte le score de conformite global afin de refleter la realite NIS2.

**Acceptance Criteria:**
- [ ] Modification formule: training = 10%
- [ ] Ajustement autres poids (controls 35%, risks 25%)
- [ ] Score training = completedAssignments / totalAssignments
- [ ] Affichage dans breakdown score
- [ ] Tests de non-regression

**Files to Create/Modify:**
- `functions/callable/calculateComplianceScore.js` (modify)
- `src/types/score.types.ts` (modify if needed)

---

### Story 1.12: i18n Module Formation

**ID:** NIS2-TRN-012
**Points:** 1
**Priority:** Medium

**Description:**
En tant qu'utilisateur, je veux que le module formation soit disponible en francais et anglais.

**Acceptance Criteria:**
- [ ] Toutes les strings dans les fichiers de locale
- [ ] FR et EN complets
- [ ] Pas de strings hardcodees

**Files to Create/Modify:**
- `public/locales/fr/training.json` (create)
- `public/locales/en/training.json` (create)

---

## Epic 2: Inventaire Certificats & Cryptographie

**Epic ID:** NIS2-CRT
**NIS2 Coverage:** Article 21.2(h)
**Priority:** High
**Sprint:** 2

### Description

Implementer un module de gestion des certificats SSL/TLS pour permettre aux organisations de demontrer leur conformite a l'Article 21.2(h) de NIS2 concernant la cryptographie.

### Acceptance Criteria (Epic Level)

- [ ] Inventaire centralise des certificats
- [ ] Alertes d'expiration automatiques
- [ ] Dashboard de l'etat cryptographique
- [ ] Lien optionnel avec les actifs

---

### Story 2.1: Types et Service Certificates

**ID:** NIS2-CRT-001
**Points:** 3
**Priority:** High

**Description:**
En tant que developpeur, je veux creer les types et le service pour les certificats afin de fournir la couche donnees.

**Acceptance Criteria:**
- [ ] Types dans `src/types/certificates.ts`
- [ ] CertificateService avec CRUD
- [ ] Schema Zod de validation
- [ ] Tests unitaires

**Files to Create/Modify:**
- `src/types/certificates.ts` (create)
- `src/services/CertificateService.ts` (create)
- `src/schemas/certificateSchema.ts` (create)

---

### Story 2.2: Liste des Certificats

**ID:** NIS2-CRT-002
**Points:** 3
**Priority:** High

**Description:**
En tant qu'ops, je veux voir la liste de tous les certificats afin de les gerer.

**Acceptance Criteria:**
- [ ] Table avec: Nom, Domaines, Emetteur, Expiration, Status
- [ ] Tri par date d'expiration
- [ ] Filtres par status (valid, expiring, expired)
- [ ] Badge de status colore
- [ ] Actions: Voir, Modifier, Supprimer

**Files to Create/Modify:**
- `src/components/certificates/CertificateList.tsx` (create)

---

### Story 2.3: Formulaire Certificat

**ID:** NIS2-CRT-003
**Points:** 3
**Priority:** High

**Description:**
En tant qu'ops, je veux ajouter et modifier un certificat afin de maintenir l'inventaire a jour.

**Acceptance Criteria:**
- [ ] Champs: Nom, Domaines (multi), Emetteur, Serial, Dates validite
- [ ] Algorithme et taille de cle
- [ ] Lien optionnel avec un actif
- [ ] Notes libres
- [ ] Validation des dates

**Files to Create/Modify:**
- `src/components/certificates/CertificateForm.tsx` (create)

---

### Story 2.4: Dashboard Certificats

**ID:** NIS2-CRT-004
**Points:** 3
**Priority:** High

**Description:**
En tant que RSSI, je veux un dashboard de l'etat crypto afin d'avoir une vue globale.

**Acceptance Criteria:**
- [ ] KPI Cards: Total, Expiring <30j, Expired
- [ ] Liste certificats expirant avec countdown
- [ ] Chart repartition par algorithme
- [ ] Export rapport PDF

**Files to Create/Modify:**
- `src/components/certificates/CertificateDashboard.tsx` (create)
- `src/components/certificates/widgets/CertificateKPICards.tsx` (create)
- `src/components/certificates/widgets/CertificateExpiringList.tsx` (create)

---

### Story 2.5: Cloud Function Expiration

**ID:** NIS2-CRT-005
**Points:** 2
**Priority:** High

**Description:**
En tant que systeme, je veux verifier quotidiennement les certificats afin d'envoyer des alertes.

**Acceptance Criteria:**
- [ ] Check daily a 7h
- [ ] Mise a jour status (valid → expiring_soon → expired)
- [ ] Envoi email a 30j, 15j, 7j
- [ ] Flag pour ne pas re-envoyer

**Files to Create/Modify:**
- `functions/src/certificates/checkExpiration.ts` (create)
- `functions/src/certificates/index.ts` (create)

---

### Story 2.6: Import CSV Certificats

**ID:** NIS2-CRT-006
**Points:** 2
**Priority:** Medium

**Description:**
En tant qu'admin, je veux importer des certificats par CSV afin d'initialiser l'inventaire rapidement.

**Acceptance Criteria:**
- [ ] Template CSV telechargeable
- [ ] Upload et parsing
- [ ] Preview avant import
- [ ] Rapport d'import (succes/erreurs)

**Files to Create/Modify:**
- `src/components/certificates/CertificateImport.tsx` (create)

---

## Epic 3: Revue des Droits d'Acces

**Epic ID:** NIS2-ARV
**NIS2 Coverage:** Article 21.2(i)
**Priority:** High
**Sprint:** 2

### Description

Implementer un module de revue periodique des droits d'acces pour permettre aux organisations de demontrer leur conformite a l'Article 21.2(i) de NIS2.

### Acceptance Criteria (Epic Level)

- [ ] Campagnes de revue planifiables
- [ ] Workflow manager pour approbation/revocation
- [ ] Detection des comptes dormants
- [ ] Rapports d'audit exportables

---

### Story 3.1: Types et Service AccessReview

**ID:** NIS2-ARV-001
**Points:** 3
**Priority:** High

**Description:**
En tant que developpeur, je veux creer les types et le service pour la revue des acces.

**Acceptance Criteria:**
- [ ] Types: AccessReviewCampaign, AccessReview, DormantAccount
- [ ] AccessReviewService avec CRUD
- [ ] Schema Zod
- [ ] Tests unitaires

**Files to Create/Modify:**
- `src/types/accessReview.ts` (create)
- `src/services/AccessReviewService.ts` (create)
- `src/schemas/accessReviewSchema.ts` (create)

---

### Story 3.2: Liste des Campagnes

**ID:** NIS2-ARV-002
**Points:** 2
**Priority:** High

**Description:**
En tant qu'admin, je veux voir la liste des campagnes de revue afin de les gerer.

**Acceptance Criteria:**
- [ ] Table: Nom, Dates, Scope, Status, Progression
- [ ] Filtres par status
- [ ] Actions: Voir detail, Annuler

**Files to Create/Modify:**
- `src/components/access-review/AccessReviewCampaignList.tsx` (create)

---

### Story 3.3: Creation Campagne

**ID:** NIS2-ARV-003
**Points:** 3
**Priority:** High

**Description:**
En tant qu'admin, je veux creer une campagne de revue afin de lancer le processus.

**Acceptance Criteria:**
- [ ] Wizard: Nom, Dates, Scope
- [ ] Selection departement/role si scope specifique
- [ ] Recurrence optionnelle (90 jours)
- [ ] Preview du nombre de revues a creer
- [ ] Lancement immediat ou programme

**Files to Create/Modify:**
- `src/components/access-review/AccessReviewCampaignForm.tsx` (create)

---

### Story 3.4: Detail Campagne

**ID:** NIS2-ARV-004
**Points:** 2
**Priority:** High

**Description:**
En tant qu'admin, je veux voir le detail d'une campagne afin de suivre sa progression.

**Acceptance Criteria:**
- [ ] Progress bar globale
- [ ] Breakdown par manager
- [ ] Liste des revues en retard
- [ ] Actions: Relancer rappels, Cloturer

**Files to Create/Modify:**
- `src/components/access-review/AccessReviewCampaignDetail.tsx` (create)

---

### Story 3.5: Workflow Manager

**ID:** NIS2-ARV-005
**Points:** 5
**Priority:** High

**Description:**
En tant que manager, je veux revoir les droits de mon equipe afin de valider leurs acces.

**Acceptance Criteria:**
- [ ] Liste de mes employes a revoir
- [ ] Pour chaque employe: permissions actuelles
- [ ] Boutons: Garder, Revoquer, Escalader
- [ ] Justification obligatoire pour revocation
- [ ] Progression (x/y revus)
- [ ] Soumission finale

**Files to Create/Modify:**
- `src/components/access-review/ManagerReviewWorkflow.tsx` (create)
- `src/components/access-review/PermissionReviewCard.tsx` (create)
- `src/components/access-review/ReviewDecisionButtons.tsx` (create)

---

### Story 3.6: Detection Comptes Dormants

**ID:** NIS2-ARV-006
**Points:** 3
**Priority:** High

**Description:**
En tant que systeme, je veux detecter les comptes dormants afin de les signaler.

**Acceptance Criteria:**
- [ ] Cloud Function weekly
- [ ] Detection: lastLogin > 90j OU jamais connecte >30j
- [ ] Creation entree dormant_accounts
- [ ] Notification admins

**Files to Create/Modify:**
- `functions/src/access-review/detectDormant.ts` (create)

---

### Story 3.7: Liste Comptes Dormants

**ID:** NIS2-ARV-007
**Points:** 2
**Priority:** High

**Description:**
En tant qu'admin, je veux voir la liste des comptes dormants afin de les traiter.

**Acceptance Criteria:**
- [ ] Table: User, Derniere connexion, Jours inactifs, Status
- [ ] Actions: Contacter, Desactiver, Supprimer, Exclure
- [ ] Filtres par status

**Files to Create/Modify:**
- `src/components/access-review/DormantAccountsList.tsx` (create)
- `src/components/access-review/DormantAccountActions.tsx` (create)

---

### Story 3.8: Dashboard Revue des Acces

**ID:** NIS2-ARV-008
**Points:** 3
**Priority:** High

**Description:**
En tant que RSSI, je veux un dashboard de la revue des acces afin de suivre la conformite.

**Acceptance Criteria:**
- [ ] KPI: Campagnes actives, Revues en cours, Comptes dormants
- [ ] Campagne en cours avec progression
- [ ] Historique des campagnes
- [ ] Alerte si pas de revue depuis >90j

**Files to Create/Modify:**
- `src/components/access-review/AccessReviewDashboard.tsx` (create)
- `src/components/access-review/widgets/ReviewProgressBar.tsx` (create)

---

### Story 3.9: Export Rapport Audit

**ID:** NIS2-ARV-009
**Points:** 2
**Priority:** High

**Description:**
En tant qu'auditeur, je veux exporter un rapport de revue afin de prouver la conformite NIS2.

**Acceptance Criteria:**
- [ ] PDF avec: periode, scope, stats, detail par manager
- [ ] Liste des revocations avec justifications
- [ ] Comptes dormants traites
- [ ] Signature/hash du rapport

**Files to Create/Modify:**
- `src/components/access-review/AccessReviewReport.tsx` (create)
- `functions/src/access-review/generateReport.ts` (create)

---

### Story 3.10: Cloud Functions Revue

**ID:** NIS2-ARV-010
**Points:** 2
**Priority:** High

**Description:**
En tant que systeme, je veux des Cloud Functions pour automatiser les rappels de revue.

**Acceptance Criteria:**
- [ ] `checkAccessReviewDeadlines` - Daily, rappels managers
- [ ] `onReviewComplete` - Trigger, update campaign progress

**Files to Create/Modify:**
- `functions/src/access-review/checkDeadlines.ts` (create)
- `functions/src/access-review/onReviewComplete.ts` (create)
- `functions/src/access-review/index.ts` (create)

---

## Sprint 3: Integration & Tests

### Story INT-001: Navigation Integration

**ID:** NIS2-INT-001
**Points:** 2
**Priority:** High

**Description:**
Integrer les nouveaux modules dans la navigation de l'application.

**Acceptance Criteria:**
- [ ] Menu Formation avec sous-menus
- [ ] Menu Certificats avec sous-menus
- [ ] Menu Revue des Acces avec sous-menus
- [ ] Permissions RBAC configurees

**Files to Create/Modify:**
- `src/config/navigation.ts` (modify)
- `src/utils/permissions.ts` (modify)

---

### Story INT-002: Widget Dashboard Principal

**ID:** NIS2-INT-002
**Points:** 2
**Priority:** Medium

**Description:**
Ajouter un widget NIS2 Compliance au dashboard principal.

**Acceptance Criteria:**
- [ ] Widget affichant couverture Art. 21.2g/h/i
- [ ] Indicateurs visuels (vert/orange/rouge)
- [ ] Lien vers chaque module

**Files to Create/Modify:**
- `src/components/dashboard/widgets/NIS2ComplianceWidget.tsx` (create)
- `src/views/Dashboard.tsx` (modify)

---

### Story INT-003: Tests Unitaires

**ID:** NIS2-INT-003
**Points:** 5
**Priority:** High

**Description:**
Ecrire les tests unitaires pour atteindre >70% de coverage.

**Acceptance Criteria:**
- [ ] Tests TrainingService (>80%)
- [ ] Tests CertificateService (>80%)
- [ ] Tests AccessReviewService (>80%)
- [ ] Tests hooks principaux
- [ ] Coverage global >70%

---

### Story INT-004: Tests E2E

**ID:** NIS2-INT-004
**Points:** 3
**Priority:** High

**Description:**
Ecrire les tests E2E pour les parcours critiques.

**Acceptance Criteria:**
- [ ] E2E: Creer et assigner une formation
- [ ] E2E: Ajouter un certificat et voir l'alerte
- [ ] E2E: Completer une revue de droits

**Files to Create/Modify:**
- `tests/e2e/training.spec.ts` (create)
- `tests/e2e/certificates.spec.ts` (create)
- `tests/e2e/access-review.spec.ts` (create)

---

### Story INT-005: i18n Complet

**ID:** NIS2-INT-005
**Points:** 2
**Priority:** Medium

**Description:**
Completer les traductions FR/EN pour tous les modules.

**Acceptance Criteria:**
- [ ] Toutes les strings traduites
- [ ] Verification aucune string hardcodee
- [ ] Review par native speaker

**Files to Create/Modify:**
- `public/locales/fr/*.json` (modify)
- `public/locales/en/*.json` (modify)

---

### Story INT-006: Documentation

**ID:** NIS2-INT-006
**Points:** 1
**Priority:** Low

**Description:**
Documenter les nouveaux modules pour les utilisateurs.

**Acceptance Criteria:**
- [ ] Guide utilisateur Formation
- [ ] Guide utilisateur Certificats
- [ ] Guide utilisateur Revue des Acces
- [ ] Screenshots

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              SPRINT 1                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TRN-001 (Types) ──┬──► TRN-002 (Store)                                │
│                    │                                                    │
│                    ├──► TRN-003 (Catalog) ──► TRN-004 (Form)           │
│                    │                                                    │
│                    ├──► TRN-005 (Assignment) ──► TRN-006 (My Training) │
│                    │                                                    │
│                    ├──► TRN-007 (Dashboard)                            │
│                    │                                                    │
│                    └──► TRN-010 (Functions) ──► TRN-011 (Score)        │
│                                                                         │
│  TRN-008 (Campaigns) ──► TRN-009 (Certificate PDF)                     │
│                                                                         │
│  TRN-012 (i18n) - parallelisable                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              SPRINT 2                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CRT-001 (Types) ──┬──► CRT-002 (List) ──► CRT-003 (Form)              │
│                    │                                                    │
│                    ├──► CRT-004 (Dashboard)                            │
│                    │                                                    │
│                    └──► CRT-005 (Functions)                            │
│                                                                         │
│  CRT-006 (Import) - parallelisable                                     │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────     │
│                                                                         │
│  ARV-001 (Types) ──┬──► ARV-002 (Campaign List)                        │
│                    │                                                    │
│                    ├──► ARV-003 (Campaign Form) ──► ARV-004 (Detail)   │
│                    │                                                    │
│                    ├──► ARV-005 (Manager Workflow)                     │
│                    │                                                    │
│                    ├──► ARV-006 (Dormant Detection) ──► ARV-007 (List) │
│                    │                                                    │
│                    ├──► ARV-008 (Dashboard)                            │
│                    │                                                    │
│                    └──► ARV-009 (Report) + ARV-010 (Functions)         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              SPRINT 3                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  INT-001 (Navigation) ──► INT-002 (Widget)                             │
│                                                                         │
│  INT-003 (Unit Tests) ──► INT-004 (E2E Tests)                          │
│                                                                         │
│  INT-005 (i18n) + INT-006 (Docs) - parallelisables                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Definition of Done (Global)

Chaque story est consideree "Done" quand :

- [ ] Code implemente et fonctionnel
- [ ] Tests unitaires ecrits et passants
- [ ] Pas d'erreurs TypeScript
- [ ] Pas d'erreurs ESLint
- [ ] i18n complete (FR + EN)
- [ ] Code review approuvee
- [ ] Documentation mise a jour si necessaire
- [ ] Deploye en environnement de test
- [ ] Acceptance criteria valides

---

## Risks & Mitigations

| Risk | Story Impact | Mitigation |
|------|--------------|------------|
| Complexite workflow manager | ARV-005 | Commencer par version simplifiee |
| Performance avec beaucoup d'assignations | TRN-007 | Pagination + indexes Firestore |
| Integration score existant | TRN-011 | Tests de non-regression |

---

_Document genere le 2026-01-27_
_Sentinel GRC v2 - NIS2 Completion Epics & Stories_
