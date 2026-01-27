---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
workflow_completed: true
completion_date: '2026-01-27'
inputDocuments: ['product-brief-nis2-completion-2026-01-27.md', 'project-context.md', 'audit-exhaustif-src-functions']
workflowType: 'prd'
project_type: 'web_modules'
domain: 'grc_compliance'
complexity: 'medium'
---

# Product Requirements Document - NIS2 Completion Modules

**Author:** Thibaultllopis
**Date:** 2026-01-27
**Version:** 1.0

---

## Executive Summary

Ce PRD definit les **2 modules manquants** pour atteindre une couverture **100% NIS2** (Directive EU 2022/2555, Article 21) dans Sentinel GRC v2.

### Contexte

L'audit exhaustif de Sentinel GRC v2 a revele une couverture NIS2 de **85%**. Les 3 gaps identifies concernent :
- **Art. 21.2g** : Formation et sensibilisation cyber (0% couvert)
- **Art. 21.2h** : Inventaire des certificats cryptographiques (partiel)
- **Art. 21.2i** : Revue periodique des droits d'acces (partiel)

### Ce qui existe DEJA (confirme par audit)

| Capacite | Implementation | Status |
|----------|----------------|--------|
| MFA Tracking | Agent `mfa_enabled` check | ✅ |
| Disk Encryption | Agent `disk_encryption` check | ✅ |
| Patches Management | Agent `patches_current` check | ✅ |
| Firewall | Agent `firewall_active` check | ✅ |
| Password Policy | Agent `password_policy` check | ✅ |
| Audit Logging | Agent + AuditLogService | ✅ |
| Document Encryption | encryptionService.ts | ✅ |
| Digital Signatures | signatureService.ts | ✅ |
| Session Monitoring | sessionMonitoringService.ts | ✅ |
| RBAC | aclService.ts | ✅ |
| CIS Benchmarks | Agent Windows/macOS/Linux | ✅ |

### Solution proposee

| Module | Gap adresse | Effort |
|--------|-------------|--------|
| **Module A : Formation & Sensibilisation** | Art. 21.2g | 34 pts |
| **Module B : Gouvernance Acces & Certificats** | Art. 21.2h/i | 39 pts |

**Effort total : 88 points (~5 semaines)**

---

## Project Classification

| Attribut | Valeur |
|----------|--------|
| **Type technique** | web_modules (Extension plateforme React) |
| **Domaine** | grc_compliance (Gouvernance, Risque, Conformite) |
| **Complexite** | MEDIUM |
| **Contexte** | Brownfield - Extension Sentinel GRC v2 existant |

### Stack technique (existante)

| Technology | Version | Role |
|------------|---------|------|
| React | ^19.2.1 | Frontend framework |
| TypeScript | ^5.7.2 | Type safety (strict mode) |
| Zustand | ^5.0.1 | State management |
| Firebase/Firestore | ^12.8.0 | Backend + Database |
| Tailwind CSS | ^3.4.1 | Styling (Apple design) |
| Vitest | ^2.1.8 | Testing |

---

## Success Criteria

### User Success

**Persona cible :** RSSI / DPO / Responsable Conformite / RH

| Critere | Metrique | Cible |
|---------|----------|-------|
| **Adoption formations** | % employes avec formations assignees | 100% |
| **Completion formations** | % formations completees a temps | ≥ 80% |
| **Certificats expires** | Nombre certificats expires en prod | 0 |
| **Revues completees** | % revues droits completees a deadline | ≥ 95% |
| **Comptes dormants** | Comptes dormants non traites | 0 |

**Moment "Aha!"** : Le RSSI voit son score NIS2 passer de 85% a 100% apres deploiement des modules.

**Succes emotionnel** : "J'ai enfin une preuve concrete de la sensibilisation de mes equipes pour l'audit NIS2."

### Business Success

| Horizon | Metrique | Cible |
|---------|----------|-------|
| **M+1** | Couverture NIS2 Art.21 | 100% |
| **M+3** | Organisations utilisant Module Formation | ≥ 50% |
| **M+3** | Formations completees par org | ≥ 10 |
| **M+6** | Revues de droits automatisees | ≥ 200/mois |

### Technical Success

| Critere | Metrique | Cible |
|---------|----------|-------|
| **Performance** | Temps chargement dashboard | < 2s |
| **Fiabilite** | Uptime Cloud Functions | ≥ 99.9% |
| **Tests** | Coverage code | ≥ 70% |
| **Qualite** | Erreurs TypeScript | 0 |
| **i18n** | Langues supportees | FR + EN |

---

## Functional Requirements

---

## Module A : Formation & Sensibilisation Cyber

### A.1 Vue d'ensemble

**Objectif :** Permettre aux organisations de demontrer la conformite NIS2 Art. 21.2g via un tracking complet des formations et de la sensibilisation cyber du personnel.

**Reglementation :** NIS2 Article 21.2(g) exige des "pratiques de base en matiere d'hygiene informatique et de formation a la cybersecurite".

### A.2 Fonctionnalites detaillees

#### A.2.1 Catalogue de Formations (TRN-CAT)

**Description :** Bibliotheque centralisee de formations disponibles pour l'organisation.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| TRN-CAT-1 | En tant qu'admin, je veux creer une formation avec titre, description, duree et contenu afin de l'ajouter au catalogue | Haute |
| TRN-CAT-2 | En tant qu'admin, je veux categoriser les formations (securite, compliance, awareness, technique) afin de faciliter la navigation | Haute |
| TRN-CAT-3 | En tant qu'admin, je veux marquer certaines formations comme obligatoires afin d'imposer leur completion | Haute |
| TRN-CAT-4 | En tant qu'admin, je veux associer des formations a des frameworks (NIS2, ISO27001) afin de mapper la couverture reglementaire | Haute |
| TRN-CAT-5 | En tant qu'admin, je veux importer des formations externes (ANSSI, CNIL) via URL afin d'enrichir le catalogue | Moyenne |

**Regles metier :**
- Une formation doit avoir : titre (3-100 car), description, duree (min), categorie
- Les formations obligatoires s'appliquent a tous les nouveaux employes
- Le mapping framework est optionnel mais recommande
- Sources supportees : internal, anssi, cnil, external

**Criteres d'acceptance :**
- [ ] CRUD complet sur les formations
- [ ] Filtrage par categorie et source
- [ ] Recherche textuelle sur titre/description
- [ ] Preview du contenu avant assignation
- [ ] Export liste formations (CSV)

#### A.2.2 Assignation & Tracking (TRN-ASN)

**Description :** Systeme d'assignation de formations aux employes avec suivi de progression.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| TRN-ASN-1 | En tant que manager, je veux assigner une formation a un employe avec une deadline afin de garantir sa completion | Haute |
| TRN-ASN-2 | En tant que manager, je veux assigner une formation a toute mon equipe en une action afin de gagner du temps | Haute |
| TRN-ASN-3 | En tant qu'employe, je veux voir mes formations assignees et leurs deadlines afin de m'organiser | Haute |
| TRN-ASN-4 | En tant qu'employe, je veux marquer une formation comme terminee afin de mettre a jour mon statut | Haute |
| TRN-ASN-5 | En tant que systeme, je veux envoyer des rappels 7j et 1j avant la deadline afin de maximiser la completion | Haute |
| TRN-ASN-6 | En tant que manager, je veux voir le statut de completion de mon equipe afin d'identifier les retardataires | Haute |

**Regles metier :**
- Status possibles : assigned → in_progress → completed | overdue
- Une formation est overdue si deadline < now ET status != completed
- Les formations obligatoires sont auto-assignees aux nouveaux utilisateurs
- Un employe peut avoir plusieurs formations en parallele
- La completion peut etre auto (quiz) ou manuelle (declaration)

**Criteres d'acceptance :**
- [ ] Assignation individuelle et en masse
- [ ] Emails de notification (assignation, rappel, overdue)
- [ ] Dashboard employe "Mes formations"
- [ ] Status temps reel (assigned/in_progress/completed/overdue)
- [ ] Historique des completions par utilisateur

#### A.2.3 Campagnes de Sensibilisation (TRN-CMP)

**Description :** Planification de campagnes recurrentes de sensibilisation (ex: Mois Cyber, Phishing trimest

riel).

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| TRN-CMP-1 | En tant qu'admin, je veux creer une campagne avec date debut/fin et formations incluses afin de structurer la sensibilisation | Haute |
| TRN-CMP-2 | En tant qu'admin, je veux definir une recurrence (mensuelle, trimestrielle, annuelle) afin d'automatiser les campagnes | Moyenne |
| TRN-CMP-3 | En tant qu'admin, je veux cibler une campagne par departement/role afin de personnaliser le contenu | Moyenne |
| TRN-CMP-4 | En tant qu'admin, je veux voir le taux de completion d'une campagne en temps reel afin de mesurer l'efficacite | Haute |

**Regles metier :**
- Une campagne contient 1+ formations
- Scope : all | department | role
- Recurrence optionnelle avec cron-like scheduling
- Les formations de campagne creent des assignations automatiques

**Criteres d'acceptance :**
- [ ] Creation campagne avec wizard step-by-step
- [ ] Selection des formations a inclure
- [ ] Ciblage par scope (tout le monde, departement, role)
- [ ] Dashboard progression campagne
- [ ] Rapport final de campagne exportable

#### A.2.4 Dashboard & Reporting (TRN-DSH)

**Description :** Tableaux de bord et rapports pour le suivi de la conformite formation.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| TRN-DSH-1 | En tant que RSSI, je veux voir le taux de completion global afin d'evaluer la maturite securite | Haute |
| TRN-DSH-2 | En tant que RSSI, je veux voir la completion par departement afin d'identifier les zones a risque | Haute |
| TRN-DSH-3 | En tant qu'auditeur, je veux exporter un rapport de conformite formation afin de prouver NIS2 Art.21.2g | Haute |
| TRN-DSH-4 | En tant que RSSI, je veux voir l'evolution du taux de completion sur 12 mois afin de mesurer la tendance | Moyenne |

**Metriques affichees :**
- Taux completion global (%)
- Completion par departement (barre chart)
- Formations en retard (count + liste)
- Top formations les plus completees
- Trend 30/90/365 jours

**Criteres d'acceptance :**
- [ ] KPI cards (completion, en retard, en cours)
- [ ] Chart completion par departement
- [ ] Liste formations overdue avec actions
- [ ] Export PDF rapport conformite
- [ ] Export CSV donnees brutes

#### A.2.5 Attestations & Certificats (TRN-CRT)

**Description :** Generation d'attestations de completion pour preuves d'audit.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| TRN-CRT-1 | En tant qu'employe, je veux telecharger une attestation PDF apres completion afin de prouver ma formation | Moyenne |
| TRN-CRT-2 | En tant qu'admin, je veux generer des attestations en masse pour un audit afin de fournir les preuves | Moyenne |

**Contenu attestation :**
- Nom employe
- Formation completee
- Date de completion
- Score (si quiz)
- Signature numerique organisation
- QR code verification

**Criteres d'acceptance :**
- [ ] Generation PDF individuelle
- [ ] Generation batch pour audit
- [ ] Template personnalisable (logo, signature)
- [ ] QR code de verification en ligne
- [ ] Stockage dans documents/preuves

#### A.2.6 Integration Score Conformite (TRN-SCR)

**Description :** Impact du module formation sur le score de conformite global.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| TRN-SCR-1 | En tant que systeme, je veux inclure le score formation dans le calcul du score global afin de refleter la conformite complete | Haute |
| TRN-SCR-2 | En tant que RSSI, je veux voir la contribution formation au score NIS2 afin de comprendre les leviers d'amelioration | Haute |

**Formule score formation :**
```
trainingScore = (completedAssignments / totalAssignments) * 100
```

**Nouvelle ponderation score global :**
```
globalScore = controls(35%) + risks(25%) + audits(20%) + documents(10%) + training(10%)
```

**Criteres d'acceptance :**
- [ ] Score formation calcule en temps reel
- [ ] Trigger recalcul sur completion
- [ ] Affichage contribution dans breakdown score
- [ ] Score par framework (NIS2, ISO27001)

---

## Module B : Gouvernance Acces & Certificats

### B.1 Vue d'ensemble

**Objectif :** Completer la couverture NIS2 Art. 21.2h (cryptographie) et 21.2i (controle d'acces) via l'inventaire des certificats et la revue periodique des droits.

### B.2 Sous-module : Inventaire Certificats (CRT)

#### B.2.1 Gestion des Certificats (CRT-MGT)

**Description :** Inventaire centralise des certificats SSL/TLS de l'organisation.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| CRT-MGT-1 | En tant qu'ops, je veux ajouter un certificat avec ses metadonnees afin de le tracker | Haute |
| CRT-MGT-2 | En tant qu'ops, je veux voir tous les certificats avec leur date d'expiration afin de planifier les renouvellements | Haute |
| CRT-MGT-3 | En tant qu'ops, je veux associer un certificat a un actif afin de tracer les dependances | Moyenne |
| CRT-MGT-4 | En tant qu'admin, je veux importer des certificats en masse (CSV) afin d'initialiser l'inventaire | Moyenne |

**Donnees certificat :**
- Nom (identifiant interne)
- Domaine(s) couverts
- Emetteur (issuer)
- Numero de serie
- Date validite (from/to)
- Algorithme + taille cle
- Actif associe (optionnel)
- Notes

**Criteres d'acceptance :**
- [ ] CRUD complet certificats
- [ ] Calcul automatique status (valid/expiring_soon/expired)
- [ ] Lien avec module assets
- [ ] Import CSV
- [ ] Export liste certificats

#### B.2.2 Alertes Expiration (CRT-ALR)

**Description :** Systeme d'alertes automatiques avant expiration des certificats.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| CRT-ALR-1 | En tant qu'ops, je veux recevoir une alerte 30 jours avant expiration afin de planifier le renouvellement | Haute |
| CRT-ALR-2 | En tant qu'ops, je veux recevoir des rappels a 15j et 7j afin de ne pas oublier | Haute |
| CRT-ALR-3 | En tant qu'admin, je veux configurer les seuils d'alerte afin de les adapter a mon organisation | Moyenne |

**Seuils par defaut :**
- 30 jours : notification standard
- 15 jours : notification warning
- 7 jours : notification critique
- 0 jours : alerte expired

**Criteres d'acceptance :**
- [ ] Cloud function daily check
- [ ] Emails aux responsables
- [ ] Notifications in-app
- [ ] Configuration seuils par org
- [ ] Dashboard certificats expirant

#### B.2.3 Dashboard Crypto (CRT-DSH)

**Description :** Vue centralisee de l'etat cryptographique de l'organisation.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| CRT-DSH-1 | En tant que RSSI, je veux voir un dashboard de l'etat crypto afin d'avoir une vue globale | Haute |
| CRT-DSH-2 | En tant qu'auditeur, je veux exporter l'inventaire crypto afin de prouver NIS2 Art.21.2h | Haute |

**Metriques affichees :**
- Total certificats
- Certificats expirant <30j
- Certificats expires
- Repartition par emetteur
- Repartition par algorithme

**Criteres d'acceptance :**
- [ ] KPI cards (total, expiring, expired)
- [ ] Liste certificats expirant avec countdown
- [ ] Chart repartition algorithmes
- [ ] Export PDF rapport crypto
- [ ] Export CSV inventaire

### B.3 Sous-module : Revue des Droits (ARV)

#### B.3.1 Campagnes de Revue (ARV-CMP)

**Description :** Systeme de campagnes periodiques de revue des droits d'acces.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| ARV-CMP-1 | En tant qu'admin, je veux creer une campagne de revue des droits avec une deadline afin de declencher le processus | Haute |
| ARV-CMP-2 | En tant qu'admin, je veux definir le scope de la campagne (all, departement) afin de cibler les revues | Haute |
| ARV-CMP-3 | En tant qu'admin, je veux planifier des campagnes recurrentes (90 jours) afin d'automatiser la conformite | Haute |
| ARV-CMP-4 | En tant qu'admin, je veux suivre la progression d'une campagne en temps reel afin d'identifier les retardataires | Haute |

**Regles metier :**
- Frequence recommandee : 90 jours (NIS2)
- Scope : all | department | role
- Une campagne genere des revues pour chaque couple manager-employe
- Deadline obligatoire

**Criteres d'acceptance :**
- [ ] Creation campagne avec wizard
- [ ] Selection scope (tout/departement/role)
- [ ] Planification recurrence optionnelle
- [ ] Dashboard progression campagne
- [ ] Notifications managers

#### B.3.2 Workflow Manager (ARV-WFL)

**Description :** Interface manager pour revoir et valider les droits de son equipe.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| ARV-WFL-1 | En tant que manager, je veux voir la liste des employes de mon equipe a revoir afin de traiter la campagne | Haute |
| ARV-WFL-2 | En tant que manager, je veux voir les permissions actuelles de chaque employe afin de prendre une decision | Haute |
| ARV-WFL-3 | En tant que manager, je veux approuver ou revoquer chaque permission afin de valider les acces | Haute |
| ARV-WFL-4 | En tant que manager, je veux escalader une decision incertaine afin de la faire traiter par un admin | Moyenne |
| ARV-WFL-5 | En tant que manager, je veux ajouter une justification a mes decisions afin de documenter l'audit trail | Haute |

**Decisions possibles :**
- `keep` : Maintenir l'acces
- `revoke` : Revoquer l'acces
- `escalate` : Escalader a l'admin

**Criteres d'acceptance :**
- [ ] Liste employes a revoir
- [ ] Detail permissions par employe
- [ ] Boutons keep/revoke/escalate
- [ ] Champ justification obligatoire pour revoke
- [ ] Progression revue (x/y employes)
- [ ] Notification completion

#### B.3.3 Detection Comptes Dormants (ARV-DRM)

**Description :** Detection automatique des comptes inactifs depuis plus de 90 jours.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| ARV-DRM-1 | En tant que systeme, je veux detecter les comptes inactifs >90j afin de les signaler | Haute |
| ARV-DRM-2 | En tant qu'admin, je veux voir la liste des comptes dormants afin de les traiter | Haute |
| ARV-DRM-3 | En tant qu'admin, je veux desactiver ou supprimer un compte dormant afin de reduire les risques | Haute |

**Definition compte dormant :**
- lastLoginAt < now - 90 jours
- OU createdAt > 30j ET lastLoginAt == null (jamais connecte)

**Criteres d'acceptance :**
- [ ] Cloud function weekly detection
- [ ] Liste comptes dormants
- [ ] Actions : contacter, desactiver, supprimer
- [ ] Audit trail des actions
- [ ] Exclusion possible (comptes service)

#### B.3.4 Reporting Audit (ARV-RPT)

**Description :** Rapports de revue des droits pour preuves d'audit NIS2.

**User Stories :**

| ID | Story | Priorite |
|----|-------|----------|
| ARV-RPT-1 | En tant qu'auditeur, je veux exporter un rapport de campagne de revue afin de prouver NIS2 Art.21.2i | Haute |
| ARV-RPT-2 | En tant que RSSI, je veux voir l'historique des revues afin de demontrer la conformite continue | Haute |

**Contenu rapport :**
- Periode de la campagne
- Scope couvert
- Statistiques (total/approved/revoked/escalated)
- Detail par manager
- Liste des revocations avec justifications
- Comptes dormants traites

**Criteres d'acceptance :**
- [ ] Export PDF rapport campagne
- [ ] Export CSV donnees brutes
- [ ] Historique campagnes passees
- [ ] Graphique tendance revocations

---

## Non-Functional Requirements

### NFR-1 : Performance

| Metrique | Cible |
|----------|-------|
| Temps chargement dashboard training | < 2s |
| Temps chargement dashboard certificats | < 1.5s |
| Temps chargement revue manager (50 employes) | < 3s |
| Temps generation PDF attestation | < 5s |

### NFR-2 : Securite

| Exigence | Implementation |
|----------|----------------|
| Isolation multi-tenant | Toutes queries filtrees par `organizationId` |
| RBAC | Permissions granulaires par module |
| Audit trail | Toutes actions loguees |
| Donnees sensibles | Pas de PII dans logs |

### NFR-3 : Fiabilite

| Metrique | Cible |
|----------|-------|
| Uptime Cloud Functions | ≥ 99.9% |
| Taux erreur API | < 0.1% |
| Delai notifications | < 5 min |

### NFR-4 : Maintenabilite

| Exigence | Implementation |
|----------|----------------|
| Tests | Coverage ≥ 70% |
| TypeScript | Strict mode, 0 `any` |
| Documentation | JSDoc sur fonctions publiques |
| i18n | Toutes strings dans locales FR/EN |

### NFR-5 : Accessibilite

| Exigence | Standard |
|----------|----------|
| Conformite | WCAG 2.1 AA |
| Navigation clavier | Tous elements interactifs |
| Screen readers | Labels ARIA |
| Contraste | ≥ 4.5:1 |

---

## Technical Architecture

### Data Model

#### Collections Firestore

```
organizations/{orgId}/
├── training_catalog/{courseId}
├── training_assignments/{assignmentId}
├── training_campaigns/{campaignId}
├── certificates/{certId}
├── access_review_campaigns/{campaignId}
├── access_reviews/{reviewId}
└── dormant_accounts/{accountId}
```

#### Types TypeScript

```typescript
// types/training.ts
interface TrainingCourse {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  category: 'security' | 'compliance' | 'awareness' | 'technical';
  source: 'anssi' | 'cnil' | 'internal' | 'external';
  duration: number;
  isRequired: boolean;
  targetRoles: string[];
  frameworkMappings: {
    nis2?: string[];
    iso27001?: string[];
  };
  content: {
    type: 'video' | 'document' | 'quiz' | 'external_link';
    url?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface TrainingAssignment {
  id: string;
  organizationId: string;
  userId: string;
  courseId: string;
  assignedBy: string;
  assignedAt: Timestamp;
  dueDate: Timestamp;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue';
  completedAt?: Timestamp;
  score?: number;
  certificateUrl?: string;
}

// types/certificates.ts
interface Certificate {
  id: string;
  organizationId: string;
  name: string;
  domains: string[];
  issuer: string;
  serialNumber: string;
  validFrom: Timestamp;
  validTo: Timestamp;
  algorithm: string;
  keySize: number;
  linkedAssetId?: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'revoked';
  renewalReminder: boolean;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// types/accessReview.ts
interface AccessReviewCampaign {
  id: string;
  organizationId: string;
  name: string;
  startDate: Timestamp;
  dueDate: Timestamp;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  scope: 'all' | 'department' | 'role';
  scopeFilter?: string[];
  progress: {
    total: number;
    completed: number;
    approved: number;
    revoked: number;
  };
  createdBy: string;
  createdAt: Timestamp;
}

interface AccessReview {
  id: string;
  organizationId: string;
  campaignId: string;
  userId: string;
  reviewerId: string;
  status: 'pending' | 'approved' | 'revoked' | 'escalated';
  permissions: {
    resource: string;
    level: string;
    decision: 'keep' | 'revoke' | 'escalate';
    reason?: string;
  }[];
  reviewedAt?: Timestamp;
  createdAt: Timestamp;
}
```

### Cloud Functions

| Function | Type | Schedule | Purpose |
|----------|------|----------|---------|
| `checkTrainingDeadlines` | Scheduled | Daily 8am | Rappels formations |
| `onTrainingComplete` | Trigger | onCreate | Update score + generate cert |
| `checkCertificateExpiration` | Scheduled | Daily 7am | Alertes expiration |
| `checkAccessReviewDeadlines` | Scheduled | Daily 8am | Rappels managers |
| `detectDormantAccounts` | Scheduled | Weekly Mon | Detection comptes dormants |
| `onAccessReviewComplete` | Trigger | onUpdate | Update audit trail |
| `generateTrainingCertificate` | Callable | On-demand | PDF attestation |
| `exportAccessReviewReport` | Callable | On-demand | PDF rapport audit |

### Component Architecture

```
src/components/
├── training/
│   ├── TrainingDashboard.tsx       # Dashboard principal
│   ├── TrainingCatalog.tsx         # Liste formations
│   ├── TrainingCourseForm.tsx      # CRUD formation
│   ├── TrainingAssignmentForm.tsx  # Assignation
│   ├── TrainingProgress.tsx        # Progress employe
│   ├── TrainingCampaignManager.tsx # Gestion campagnes
│   ├── TrainingCertificate.tsx     # Attestation
│   └── widgets/
│       ├── TrainingKPICards.tsx
│       ├── TrainingByDepartment.tsx
│       └── TrainingOverdueList.tsx
│
├── certificates/
│   ├── CertificateDashboard.tsx
│   ├── CertificateList.tsx
│   ├── CertificateForm.tsx
│   ├── CertificateAlerts.tsx
│   └── widgets/
│       ├── CertificateKPICards.tsx
│       └── CertificateExpiringList.tsx
│
└── access-review/
    ├── AccessReviewDashboard.tsx
    ├── AccessReviewCampaignForm.tsx
    ├── ManagerReviewWorkflow.tsx
    ├── DormantAccountsList.tsx
    ├── AccessReviewReport.tsx
    └── widgets/
        ├── ReviewProgressBar.tsx
        └── ReviewByManager.tsx
```

---

## Implementation Plan

### Sprint 1 (Semaines 1-2) : Module Formation Core

| Story ID | Description | Points | Owner |
|----------|-------------|--------|-------|
| TRN-CAT-1 | TrainingService + types | 5 | Dev |
| TRN-CAT-2 | TrainingCatalog CRUD UI | 8 | Dev |
| TRN-ASN-1 | TrainingAssignment service | 5 | Dev |
| TRN-ASN-3 | Dashboard "Mes formations" | 5 | Dev |
| TRN-DSH-1 | TrainingDashboard KPIs | 5 | Dev |
| TRN-SCR-1 | Integration score conformite | 3 | Dev |
| TRN-001 | Cloud function rappels | 3 | Dev |

**Total Sprint 1 : 34 points**

### Sprint 2 (Semaines 3-4) : Certificats + Revue Droits

| Story ID | Description | Points | Owner |
|----------|-------------|--------|-------|
| CRT-MGT-1 | CertificateService + types | 5 | Dev |
| CRT-MGT-2 | CertificateList + Form | 5 | Dev |
| CRT-ALR-1 | Cloud function expiration | 3 | Dev |
| CRT-DSH-1 | CertificateDashboard | 3 | Dev |
| ARV-CMP-1 | AccessReviewService + types | 5 | Dev |
| ARV-CMP-2 | Campaign creation UI | 5 | Dev |
| ARV-WFL-1 | ManagerReviewWorkflow | 8 | Dev |
| ARV-DRM-1 | Dormant accounts detection | 3 | Dev |
| ARV-RPT-1 | Export rapport audit | 2 | Dev |

**Total Sprint 2 : 39 points**

### Sprint 3 (Semaine 5) : Integration & Polish

| Story ID | Description | Points | Owner |
|----------|-------------|--------|-------|
| INT-001 | Integration menu navigation | 2 | Dev |
| INT-002 | Tests unitaires (>70%) | 5 | Dev |
| INT-003 | Tests E2E critiques | 3 | Dev |
| INT-004 | i18n FR/EN | 3 | Dev |
| INT-005 | Documentation utilisateur | 2 | Dev |

**Total Sprint 3 : 15 points**

**TOTAL PROJET : 88 points**

---

## Risks & Mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Adoption faible module formation | Moyenne | Moyen | Gamification, rappels automatiques, formations courtes |
| Donnees certificats incompletes | Haute | Moyen | Import CSV, saisie manuelle guidee, scan futur |
| Resistance managers revue droits | Moyenne | Moyen | UI simple, delegation possible, deadline claire |
| Surcharge score conformite | Basse | Bas | Ponderation configurable par org |
| Performance avec gros volumes | Basse | Moyen | Pagination, indexes Firestore, caching |

---

## Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Faut-il un module quiz integre ou lien externe suffit ? | Product | Open |
| 2 | Integration avec LMS externes (Moodle, etc.) en roadmap ? | Product | Open |
| 3 | Scan automatique des certificats serveur en V2 ? | Tech | Open |
| 4 | Integration avec IAM (Azure AD, Okta) pour revue droits ? | Tech | Open |

---

## Appendix

### A. Mapping NIS2 Article 21

| Article | Exigence | Module | Coverage |
|---------|----------|--------|----------|
| 21.2(a) | Politiques securite | Existant (Risks) | ✅ 100% |
| 21.2(b) | Gestion incidents | Existant (Incidents) | ✅ 100% |
| 21.2(c) | Continuite | Existant (BCP/DRP) | ✅ 100% |
| 21.2(d) | Supply chain | Existant (Suppliers) | ✅ 100% |
| 21.2(e) | Maintenance | Existant (Agent) | ✅ 100% |
| 21.2(f) | Efficacite | Existant (Score) | ✅ 100% |
| 21.2(g) | Formation | **Module A** | ✅ NEW |
| 21.2(h) | Cryptographie | **Module B.1** | ✅ NEW |
| 21.2(i) | Controle acces | **Module B.2** | ✅ NEW |
| 21.2(j) | MFA | Existant (Agent) | ✅ 100% |

### B. References

- [NIS2 Directive (EU) 2022/2555](https://eur-lex.europa.eu/eli/dir/2022/2555)
- [ANSSI Recommandations Formation](https://www.ssi.gouv.fr/)
- [ISO 27001:2022 A.6.3 Information security awareness](https://www.iso.org/)

---

_Document genere le 2026-01-27_
_Sentinel GRC v2 - NIS2 Completion PRD_
