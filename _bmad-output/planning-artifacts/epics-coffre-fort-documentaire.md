---
stepsCompleted: [1, 2, 3, 4, 5]
workflowType: 'epics-stories'
project_name: 'sentinel-grc-v2-prod'
module: 'coffre-fort-documentaire'
user_name: 'Thibaultllopis'
date: '2026-01-17'
status: 'ready-for-implementation'
source_documents:
  - prd-coffre-fort-documentaire.md
  - architecture-coffre-fort-documentaire.md
total_epics: 5
total_stories: 28
estimated_sprints: 10-12
---

# Epics & Stories - Module Coffre-Fort Documentaire

**Module:** Enterprise Document Vault
**Auteur:** Thibaultllopis
**Date:** 2026-01-17
**Version:** 1.0

---

## Vue d'Ensemble

Ce document détaille les Epics et Stories pour transformer le module documentaire existant en un **coffre-fort numérique sécurisé** conforme aux standards ISO 27001 et RGPD.

### Résumé des Epics

| Epic | Titre | Stories | Points | Sprints | Priority |
|------|-------|---------|--------|---------|----------|
| **23** | Chiffrement & Sécurité Documentaire | 6 | 26 | 3 | P0 |
| **24** | Classification & Contrôle d'Accès | 6 | 21 | 2.5 | P0 |
| **25** | Conformité Légale | 6 | 23 | 2.5 | P0/P1 |
| **26** | Intégrité & Signatures | 5 | 21 | 2 | P1 |
| **27** | Audit Trail & eDiscovery | 5 | 21 | 2 | P1/P2 |

### Dépendances entre Epics

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY GRAPH                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Epic 23 (Chiffrement)                                         │
│      │                                                           │
│      ├──────────► Epic 24 (Classification & ACL)                │
│      │               │                                           │
│      │               └──────────► Epic 25 (Legal Hold/Retention) │
│      │                               │                           │
│      └──────────────────────────────►│                          │
│                                       │                           │
│   Epic 26 (Intégrité & Signatures) ◄──┘                         │
│      │                                                           │
│      └──────────► Epic 27 (Audit & eDiscovery)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Ordre d'implémentation recommandé:**
1. **Epic 23** - Chiffrement (fondation sécurité)
2. **Epic 24** - Classification & ACL (dépend de 23)
3. **Epic 25** - Conformité Légale (dépend de 24)
4. **Epic 26** - Intégrité & Signatures (dépend de 23, 25)
5. **Epic 27** - Audit & eDiscovery (dépend de tous)

---

## Epic 23: Chiffrement & Sécurité Documentaire

**Description:** Implémenter le chiffrement serveur-side de tous les documents avec Google Cloud KMS, garantissant la confidentialité des données au repos et en transit.

**Objectif:** Aucun document ne doit être stocké en clair dans Cloud Storage. Le chiffrement/déchiffrement doit être transparent pour les utilisateurs autorisés.

**FRs couverts:** FR-VAULT-001, FR-VAULT-005 (partie chiffrement)

**Valeur utilisateur:** En tant que RSSI, je peux garantir que les documents critiques sont chiffrés avec des standards enterprise (AES-256-GCM) et que les clés sont gérées de manière sécurisée.

---

### Story 23.1: Configuration Infrastructure Cloud KMS

**Titre:** Configurer l'infrastructure Cloud KMS pour la gestion des clés de chiffrement

**Description:**
As a DevOps engineer,
I want to set up Google Cloud KMS key rings and crypto keys,
So that the application can encrypt/decrypt documents securely.

**Acceptance Criteria:**

```gherkin
Given I am setting up the vault infrastructure
When I deploy the KMS configuration
Then a key ring "sentinel-vault" should be created in the project
And a crypto key "documents-key" should be created with AES-256-GCM algorithm
And key rotation should be configured for every 90 days
And IAM permissions should be set for Cloud Functions service account

Given the KMS is configured
When I check the key status
Then the key should show as "ENABLED"
And the primary version should be active
And audit logging should be enabled for key operations

Given a key rotation occurs
When the new version is created
Then all new encryptions should use the new version
And existing documents should still be decryptable with old versions
```

**Technical Notes:**
- Créer le key ring dans `europe-west1` pour conformité RGPD
- Configurer les rôles IAM: `roles/cloudkms.cryptoKeyEncrypterDecrypter`
- Activer Cloud Audit Logs pour les opérations KMS
- Documenter la procédure de rotation d'urgence

**Story Points:** 3
**Priority:** P0

---

### Story 23.2: Cloud Function - Chiffrement à l'Upload

**Titre:** Implémenter la Cloud Function de chiffrement automatique à l'upload

**Description:**
As a system,
I want to automatically encrypt documents when they are uploaded to Cloud Storage,
So that no document is ever stored in plaintext.

**Acceptance Criteria:**

```gherkin
Given a user uploads a new document
When the file lands in Cloud Storage
Then the encryptOnUpload Cloud Function should be triggered
And the file content should be encrypted using Cloud KMS
And the encrypted content should replace the original file
And the file metadata should include "encrypted: true" and "keyVersion: X"

Given a document of 10MB is uploaded
When the encryption process runs
Then it should complete in less than 500ms
And the encrypted file should have a .enc extension or metadata marker

Given the encryption fails (KMS unavailable)
When the error is caught
Then the document should be marked as "pending_encryption"
And an alert should be sent to the ops team
And a retry mechanism should attempt encryption within 5 minutes

Given a document is already encrypted
When a new version is uploaded
Then only the new version should be encrypted
And both versions should remain accessible
```

**Technical Notes:**
```typescript
// functions/src/vault/encryptOnUpload.ts
export const encryptOnUpload = onObjectFinalized(
  { bucket: 'sentinel-documents' },
  async (event) => {
    // Skip if already encrypted
    if (event.data.metadata?.encrypted === 'true') return;

    // Encrypt with KMS
    const kms = new KeyManagementServiceClient();
    // ... implementation
  }
);
```
- Utiliser streaming pour les gros fichiers (>100MB)
- Implémenter un circuit breaker pour KMS
- Logs structurés pour debugging

**Story Points:** 5
**Priority:** P0

---

### Story 23.3: Cloud Function - Déchiffrement au Téléchargement

**Titre:** Implémenter la Cloud Function de déchiffrement sécurisé au téléchargement

**Description:**
As an authorized user,
I want to download documents transparently,
So that I can access content without manual decryption steps.

**Acceptance Criteria:**

```gherkin
Given I am an authorized user with download permission
When I request to download an encrypted document
Then the decryptOnDownload function should be called
And my authorization should be verified against ACL
And the document should be decrypted using Cloud KMS
And the decrypted content should be streamed to me

Given I am NOT authorized to download
When I request the document
Then I should receive a 403 Forbidden error
And an audit log entry "access_denied" should be created
And the download should not proceed

Given a document of 10MB is requested
When the decryption process runs
Then it should complete in less than 300ms
And the content should be streamed (not buffered in memory)

Given the decryption fails (hash mismatch)
When the integrity check fails
Then I should receive an error "Document integrity compromised"
And a critical alert should be sent
And the incident should be logged with full details
```

**Technical Notes:**
- Implémenter comme HTTPS callable function
- Vérifier l'intégrité (hash) avant de retourner le contenu
- Streaming response pour éviter memory issues
- Cache le résultat déchiffré en mémoire pour 5 minutes (par session)

**Story Points:** 5
**Priority:** P0

---

### Story 23.4: Migration des Documents Existants

**Titre:** Batch job pour chiffrer les documents existants

**Description:**
As a system administrator,
I want to migrate existing unencrypted documents to encrypted storage,
So that all historical data is protected.

**Acceptance Criteria:**

```gherkin
Given there are 1000 unencrypted documents in storage
When I run the migration batch job
Then documents should be processed in batches of 100
And each document should be encrypted with current key version
And the original hash should be preserved for integrity verification
And a migration report should be generated

Given the migration is running
When I check the status
Then I should see progress (X/Y documents migrated)
And estimated time remaining
And any errors encountered

Given a document fails to migrate
When the error is logged
Then the document should be marked as "migration_failed"
And it should be retried in the next batch
And after 3 failures, it should be flagged for manual review

Given the migration completes successfully
When I verify the results
Then 100% of documents should be encrypted
And all documents should remain accessible
And performance should not be degraded
```

**Technical Notes:**
- Cloud Function scheduled ou job manuel via Cloud Run
- Rate limiting pour éviter KMS quota issues
- Dry-run mode pour validation avant migration réelle
- Rollback plan: conserver backup non-chiffré 7 jours

**Story Points:** 5
**Priority:** P0

---

### Story 23.5: UI - Indicateur de Chiffrement

**Titre:** Afficher l'état de chiffrement dans l'interface utilisateur

**Description:**
As a user viewing documents,
I want to see the encryption status clearly,
So that I have confidence my documents are protected.

**Acceptance Criteria:**

```gherkin
Given I am viewing a document in DocumentInspector
When the document is encrypted
Then I should see a lock icon (🔒) next to the document title
And a tooltip should show "Chiffré avec AES-256 - Clé gérée par Google Cloud KMS"
And the encryption date should be displayed in the metadata panel

Given I am viewing the document list
When I look at the status column
Then encrypted documents should show a green lock icon
And unencrypted documents should show a warning icon (⚠️)
And pending encryption should show a spinner

Given I am an admin viewing document details
When I expand the security section
Then I should see the key version used
And the encryption timestamp
And the hash value for integrity
```

**Technical Notes:**
- Étendre DocumentInspector.tsx avec un nouveau section "Security"
- Composant `<EncryptionBadge status={doc.encrypted} />`
- Utiliser les styles Apple glass-panel pour le panneau de sécurité

**Story Points:** 3
**Priority:** P1

---

### Story 23.6: Tests de Sécurité - Chiffrement

**Titre:** Suite de tests pour valider la sécurité du chiffrement

**Description:**
As a security engineer,
I want comprehensive tests for the encryption system,
So that I can ensure no security regressions occur.

**Acceptance Criteria:**

```gherkin
Given the encryption Cloud Function is deployed
When I run the security test suite
Then all tests should pass with 100% coverage on security paths

Given an encrypted file in storage
When I attempt to read it directly (bypassing Cloud Function)
Then I should only see encrypted ciphertext
And it should not be decodable without KMS

Given a compromised file (modified ciphertext)
When decryption is attempted
Then it should fail with integrity error
And an alert should be triggered

Given key rotation occurs
When old documents are accessed
Then they should still decrypt correctly
And new documents should use new key version
```

**Technical Notes:**
- Tests avec Firebase Emulator Suite
- Security rules testing avec `@firebase/rules-unit-testing`
- Penetration test manuel documenté

**Story Points:** 5
**Priority:** P0

---

## Epic 24: Classification & Contrôle d'Accès

**Description:** Implémenter un système de classification à 4 niveaux avec contrôle d'accès granulaire au niveau document, permettant de restreindre l'accès selon la sensibilité des informations.

**Objectif:** Chaque document doit avoir une classification (Public/Interne/Confidentiel/Secret) avec RBAC automatique et possibilité de permissions spécifiques par document.

**FRs couverts:** FR-VAULT-002, FR-VAULT-007

**Valeur utilisateur:** En tant que RSSI, je peux contrôler qui accède à quoi avec une granularité fine, garantissant le principe du moindre privilège.

---

### Story 24.1: Modèle de Données - Classification

**Titre:** Étendre le modèle de données Document avec la classification

**Description:**
As a developer,
I want to extend the Document type with classification fields,
So that documents can be properly categorized and access-controlled.

**Acceptance Criteria:**

```gherkin
Given I update the Document type
When I add classification fields
Then the following fields should be added:
  | Field | Type | Required |
  | classification.level | enum | yes |
  | classification.classifiedBy | string | yes |
  | classification.classifiedAt | Timestamp | yes |
  | classification.justification | string | no |
  | classification.autoClassified | boolean | yes |

Given a new document is created
When no classification is provided
Then the default should be "internal"
And autoClassified should be false

Given Firestore rules are updated
When a user tries to access a "secret" document
Then access should only be granted if role is "rssi", "admin", or "super_admin"
```

**Technical Notes:**
```typescript
// src/types/vault.ts
type ClassificationLevel = 'public' | 'internal' | 'confidential' | 'secret';

interface DocumentClassification {
  level: ClassificationLevel;
  classifiedBy: string;
  classifiedAt: Timestamp;
  justification?: string;
  autoClassified: boolean;
}
```
- Ajouter index Firestore sur `classification.level`
- Migration script pour documents existants (default: internal)

**Story Points:** 3
**Priority:** P0

---

### Story 24.2: UI - Sélecteur de Classification

**Titre:** Composant de sélection de classification pour l'upload et l'édition

**Description:**
As a document owner,
I want to classify my documents during upload or editing,
So that appropriate access controls are applied.

**Acceptance Criteria:**

```gherkin
Given I am uploading a new document
When I reach the classification step
Then I should see a dropdown with 4 options:
  | Level | Icon | Description |
  | Public | 🌍 | Accessible à tous |
  | Interne | 🏢 | Employés uniquement |
  | Confidentiel | 🔐 | Managers et RSSI |
  | Secret | ⛔ | Direction uniquement |

Given I select "Confidentiel" or higher
When I try to save
Then I should be prompted to provide a justification
And the justification should be mandatory

Given I change a document from "Public" to "Secret"
When I save the change
Then an audit log entry should be created
And all users without proper access should be notified they lost access
```

**Technical Notes:**
- Composant `<ClassificationSelector value={level} onChange={...} />`
- Style Apple avec icônes colorées et tooltips explicatifs
- Intégration dans DocumentForm.tsx et QuickUpload

**Story Points:** 3
**Priority:** P0

---

### Story 24.3: Firestore Rules - Classification RBAC

**Titre:** Implémenter les règles Firestore pour le contrôle d'accès par classification

**Description:**
As a system,
I want to enforce access control based on document classification,
So that unauthorized users cannot access sensitive documents.

**Acceptance Criteria:**

```gherkin
Given a document with classification "public"
When any authenticated user requests read access
Then access should be granted

Given a document with classification "internal"
When a user with role "user" requests read access
Then access should be granted
When an unauthenticated user requests access
Then access should be denied

Given a document with classification "confidential"
When a user with role "user" requests read access
Then access should be denied with "Insufficient permissions"
When a user with role "project_manager" requests access
Then access should be granted

Given a document with classification "secret"
When a user with role "project_manager" requests access
Then access should be denied
When a user with role "rssi" or "admin" requests access
Then access should be granted
```

**Technical Notes:**
```javascript
// firestore.rules
function canAccessClassification(classification, role) {
  return (classification == 'public') ||
         (classification == 'internal') ||
         (classification == 'confidential' &&
          role in ['project_manager', 'rssi', 'admin', 'super_admin']) ||
         (classification == 'secret' &&
          role in ['rssi', 'admin', 'super_admin']);
}
```

**Story Points:** 3
**Priority:** P0

---

### Story 24.4: Modèle de Données - Document ACL

**Titre:** Implémenter les ACL au niveau document pour permissions granulaires

**Description:**
As a document owner,
I want to grant specific permissions to specific users,
So that I can override default classification-based access.

**Acceptance Criteria:**

```gherkin
Given I own a "confidential" document
When I want to share it with a specific "user" role person
Then I should be able to add them to the document ACL
And they should have access even without "project_manager" role

Given I add a user to the ACL with "read" permission
When they try to download the document
Then access should be denied (read only, not download)

Given I set an expiration date on an ACL entry
When the date passes
Then the user should lose access automatically
And an audit log should record the expiration

Given an ACL entry exists
When I revoke it manually
Then access should be revoked immediately
And the user should see "Access revoked" if they try to access
```

**Technical Notes:**
```typescript
interface DocumentACL {
  defaultAccess: 'classification' | 'explicit';
  permissions: Array<{
    principalType: 'user' | 'role' | 'group';
    principalId: string;
    access: 'read' | 'download' | 'edit' | 'delete' | 'share' | 'admin';
    grantedBy: string;
    grantedAt: Timestamp;
    expiresAt?: Timestamp;
  }>;
}
```

**Story Points:** 5
**Priority:** P1

---

### Story 24.5: UI - Gestion des Permissions Document

**Titre:** Interface de gestion des permissions au niveau document

**Description:**
As a document owner or admin,
I want to manage document-level permissions through the UI,
So that I can control access without editing raw data.

**Acceptance Criteria:**

```gherkin
Given I am viewing a document I own
When I click on "Gérer les accès"
Then I should see a panel with:
  - Current classification and default access
  - List of explicit permissions (users with specific access)
  - Button to add new permission

Given I add a new permission
When I search for a user
Then I should see autocomplete suggestions from the organization
And I should be able to select permission level (read/download/edit/share/admin)
And I should be able to set an optional expiration date

Given I want to share externally
When I click "Partager en externe"
Then I should be able to generate a secure link
And set a password (optional)
And set expiration (mandatory)
And limit download count (optional)
```

**Technical Notes:**
- Nouveau composant `<DocumentPermissionsPanel documentId={...} />`
- Intégrer dans DocumentInspector comme onglet "Accès"
- Utiliser combobox pour recherche utilisateurs avec debounce

**Story Points:** 5
**Priority:** P1

---

### Story 24.6: Tests - Classification & ACL

**Titre:** Suite de tests pour la classification et les ACL

**Description:**
As a QA engineer,
I want comprehensive tests for the access control system,
So that I can ensure no unauthorized access is possible.

**Acceptance Criteria:**

```gherkin
Given the classification system is deployed
When I run the access control test suite
Then all combinations of role × classification should be tested
And all tests should pass

Given an ACL with expiration
When I simulate time passing
Then access should be correctly revoked after expiration

Given a user is removed from organization
When they try to access previously shared documents
Then access should be denied
And their ACL entries should be cleaned up
```

**Technical Notes:**
- Tests Firestore rules avec tous les cas limites
- Tests E2E pour le flow UI de partage
- Tests de performance avec 1000+ ACL entries

**Story Points:** 2
**Priority:** P0

---

## Epic 25: Conformité Légale

**Description:** Implémenter les fonctionnalités de Legal Hold (gel juridique) et Retention Policy (politique de conservation) pour assurer la conformité RGPD et les exigences eDiscovery.

**Objectif:** Les documents peuvent être gelés pour procédures légales, et le cycle de vie des documents est géré automatiquement selon des règles configurables.

**FRs couverts:** FR-VAULT-003, FR-VAULT-004, FR-VAULT-009 (partie conformité)

**Valeur utilisateur:** En tant que DPO, je peux répondre aux demandes légales et garantir la conformité des durées de conservation.

---

### Story 25.1: Modèle de Données - Legal Hold

**Titre:** Créer le modèle de données pour les Legal Holds

**Description:**
As a developer,
I want to define the data model for legal holds,
So that documents can be frozen for legal proceedings.

**Acceptance Criteria:**

```gherkin
Given I create the legal_holds collection
When I define the schema
Then it should include:
  | Field | Type | Required |
  | id | string | yes |
  | name | string | yes |
  | reason | string | yes |
  | createdBy | string | yes |
  | createdAt | Timestamp | yes |
  | expiresAt | Timestamp | no |
  | documentIds | string[] | yes |
  | status | enum | yes |
  | releasedBy | string | no |
  | releasedAt | Timestamp | no |
  | releaseReason | string | no |

Given I update the Document type
When I add legal hold fields
Then it should include:
  | Field | Type |
  | legalHoldIds | string[] |
  | isUnderHold | boolean |
```

**Technical Notes:**
- Collection séparée `legal_holds` pour traçabilité
- Champ dénormalisé `isUnderHold` sur Document pour performance
- Index composite sur `(organizationId, status)`

**Story Points:** 2
**Priority:** P0

---

### Story 25.2: Firestore Rules - Legal Hold Protection

**Titre:** Implémenter les règles Firestore bloquant modification/suppression des documents sous hold

**Description:**
As a system,
I want to prevent any modification or deletion of documents under legal hold,
So that evidence is preserved for legal proceedings.

**Acceptance Criteria:**

```gherkin
Given a document is under legal hold
When any user (including admin) tries to delete it
Then the operation should be rejected
And the error should be "Document under legal hold - deletion blocked"

Given a document is under legal hold
When a user tries to modify the content
Then the operation should be rejected
And the error should be "Document under legal hold - content modification blocked"

Given a document is under legal hold
When a user tries to update metadata (title, classification)
Then the operation should be allowed (metadata updates OK)

Given a legal hold is released
When the same user tries to delete the document
Then the operation should be allowed (if they have delete permission)
```

**Technical Notes:**
```javascript
// firestore.rules
match /documents/{docId} {
  allow delete: if !resource.data.isUnderHold;
  allow update: if !resource.data.isUnderHold ||
    !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['content', 'url', 'version', 'hash']);
}
```

**Story Points:** 3
**Priority:** P0

---

### Story 25.3: UI - Gestion des Legal Holds (Admin)

**Titre:** Interface d'administration pour créer et gérer les Legal Holds

**Description:**
As a legal/compliance admin,
I want to create and manage legal holds through a dedicated interface,
So that I can respond to legal requests efficiently.

**Acceptance Criteria:**

```gherkin
Given I am an admin
When I navigate to "Administration > Legal Holds"
Then I should see a list of active and released holds
And I should see a button "Créer un Legal Hold"

Given I click "Créer un Legal Hold"
When I fill the form
Then I should provide:
  - Name (mandatory)
  - Reason (mandatory, detailed description)
  - Expiration date (optional)
Then I should search and select documents to include
And I should see a preview of affected documents count

Given a Legal Hold is active
When I view its details
Then I should see all documents included
And I should see the hold metadata
And I should have a button "Libérer le hold" (requires reason)

Given I release a hold
When I provide a reason
Then all documents should be unfrozen
And an audit log should record the release
And document owners should be notified
```

**Technical Notes:**
- Nouvelle page `/admin/legal-holds`
- Composant `<LegalHoldForm />` avec recherche documents
- Liste avec DataTable, filtres par status
- Confirmation modale pour release avec champ reason

**Story Points:** 5
**Priority:** P0

---

### Story 25.4: Modèle de Données - Retention Policy

**Titre:** Créer le modèle de données pour les politiques de conservation

**Description:**
As a developer,
I want to define the data model for retention policies,
So that document lifecycle can be managed automatically.

**Acceptance Criteria:**

```gherkin
Given I create the retention_policies collection
When I define the schema
Then it should include:
  | Field | Type | Required |
  | id | string | yes |
  | name | string | yes |
  | documentType | DocumentType | yes |
  | retentionDays | number | yes |
  | action | enum | yes |
  | notifyDaysBefore | number | yes |
  | exceptions | object | no |
  | createdBy | string | yes |
  | createdAt | Timestamp | yes |

Given I create the retention_executions collection
When I log an execution
Then it should track:
  - Policy applied
  - Document affected
  - Action taken
  - Certificate URL (for deletions)
```

**Technical Notes:**
- Actions: 'archive' | 'delete' | 'notify'
- Default policies créées à l'installation:
  - Politique: 5 ans → archive
  - Procédure: 3 ans → archive
  - Preuve audit: 7 ans → archive
  - Rapport: 2 ans → delete

**Story Points:** 2
**Priority:** P1

---

### Story 25.5: Cloud Function - Retention Policy Engine

**Titre:** Implémenter le job scheduled pour appliquer les politiques de conservation

**Description:**
As a system,
I want to automatically apply retention policies daily,
So that document lifecycle is managed without manual intervention.

**Acceptance Criteria:**

```gherkin
Given retention policies are configured
When the scheduled job runs at 2 AM
Then it should query all documents past retention date
And apply the configured action to each

Given a document is past retention and action is "archive"
When the job processes it
Then the document should be moved to cold storage
And metadata should be updated with archiveLocation
And owner should be notified

Given a document is past retention and action is "delete"
When the job processes it
Then the document should be securely deleted
And a deletion certificate should be generated
And the certificate should be stored for 10 years

Given a document is under legal hold
When the job processes it
Then the document should be SKIPPED
And a log entry should record "skipped: legal hold"

Given a document is 30 days before retention
When notification is enabled
Then the owner should receive an email notification
And they should have the option to request extension
```

**Technical Notes:**
```typescript
// functions/src/vault/applyRetentionPolicies.ts
export const applyRetentionPolicies = onSchedule(
  { schedule: '0 2 * * *', timeZone: 'Europe/Paris' },
  async () => {
    // Implementation
  }
);
```
- Batching pour éviter timeout (max 540s)
- Métriques pour monitoring (docs processed, archived, deleted)
- Alerting si erreur critique

**Story Points:** 5
**Priority:** P1

---

### Story 25.6: UI - Dashboard Retention

**Titre:** Interface de gestion et monitoring des politiques de conservation

**Description:**
As a compliance officer,
I want to manage retention policies and monitor their execution,
So that I can ensure document lifecycle compliance.

**Acceptance Criteria:**

```gherkin
Given I am a compliance officer
When I navigate to "Conformité > Rétention"
Then I should see:
  - Liste des politiques actives
  - Statistiques: documents par état (actif, à archiver, à supprimer)
  - Historique des exécutions récentes

Given I create a new retention policy
When I fill the form
Then I should specify:
  - Type de document concerné
  - Durée de conservation (jours)
  - Action (archiver/supprimer/notifier)
  - Exceptions (classifications, legal hold)

Given I view the dashboard
When documents are proche de l'expiration
Then I should see une alerte visuelle
And I should be able to voir la liste détaillée
And I should pouvoir demander une extension pour certains documents

Given a document is deleted by retention
When I access the execution log
Then I should be able to download the deletion certificate
```

**Technical Notes:**
- Page `/compliance/retention`
- Charts avec recharts pour statistiques
- DataTable pour historique exécutions
- Export PDF des certificats de destruction

**Story Points:** 5
**Priority:** P1

---

## Epic 26: Intégrité & Signatures

**Description:** Implémenter la vérification d'intégrité cryptographique (hash SHA-256) et les signatures électroniques avec valeur probante (eIDAS).

**Objectif:** Chaque document a une empreinte cryptographique vérifiable, et les documents critiques peuvent être signés électroniquement avec horodatage certifié.

**FRs couverts:** FR-VAULT-005, FR-VAULT-006

**Valeur utilisateur:** En tant que Direction, je peux signer des documents avec valeur légale. En tant qu'Auditeur, je peux vérifier qu'un document n'a pas été altéré.

---

### Story 26.1: Cloud Function - Hash à l'Upload

**Titre:** Calculer et stocker le hash SHA-256 à l'upload de chaque document

**Description:**
As a system,
I want to calculate a cryptographic hash for every uploaded document,
So that document integrity can be verified at any time.

**Acceptance Criteria:**

```gherkin
Given a user uploads a new document
When the upload completes
Then a SHA-256 hash should be calculated on the original content
And the hash should be stored in Firestore document metadata
And the hash should be stored in Storage file metadata
And both hashes should match

Given a document version is created
When the new version is uploaded
Then a new hash should be calculated for the new version
And the old version hash should be preserved

Given the hash calculation fails
When an error occurs
Then the document should be marked as "integrity_pending"
And a retry should be attempted
```

**Technical Notes:**
```typescript
// Hash avant chiffrement pour vérification
const originalHash = crypto.createHash('sha256')
  .update(originalContent)
  .digest('hex');
```
- Calculer le hash AVANT le chiffrement (sur contenu clair)
- Stocker dans Document.hash et Storage.metadata.originalHash

**Story Points:** 3
**Priority:** P1

---

### Story 26.2: Vérification d'Intégrité au Téléchargement

**Titre:** Vérifier automatiquement l'intégrité au téléchargement

**Description:**
As a user downloading a document,
I want the system to automatically verify document integrity,
So that I know the document hasn't been tampered with.

**Acceptance Criteria:**

```gherkin
Given I download an encrypted document
When the document is decrypted
Then the hash should be recalculated on the decrypted content
And it should be compared to the stored hash
And if they match, the download should proceed

Given the hash verification fails
When a mismatch is detected
Then the download should be blocked
And an error message should inform me "Document integrity compromised"
And a critical alert should be sent to security team
And an audit log entry should be created with details

Given I am an admin investigating an integrity issue
When I view the document details
Then I should see the expected hash and actual hash
And I should see when integrity was last verified
And I should see the verification history
```

**Technical Notes:**
- Intégrer dans decryptOnDownload Cloud Function
- Ne jamais retourner un document avec hash mismatch
- Alerting via Cloud Monitoring

**Story Points:** 3
**Priority:** P1

---

### Story 26.3: UI - Certificat d'Intégrité

**Titre:** Permettre le téléchargement d'un certificat d'intégrité

**Description:**
As an auditor,
I want to download an integrity certificate for any document,
So that I have proof of document authenticity.

**Acceptance Criteria:**

```gherkin
Given I am viewing a document
When I click "Certificat d'intégrité"
Then a PDF should be generated containing:
  - Document title and ID
  - SHA-256 hash value
  - Upload date and uploader
  - All versions with their hashes
  - QR code linking to verification page
  - Timestamp of certificate generation

Given I have a certificate
When I scan the QR code
Then I should be taken to a verification page
And I should be able to paste a hash to verify
And the system should confirm if it matches

Given I want to verify externally
When I use any SHA-256 tool on the document
Then the hash should match the one in the certificate
```

**Technical Notes:**
- Générer PDF avec @react-pdf/renderer ou jsPDF
- QR code avec qrcode library
- Page publique `/verify/{documentId}` pour vérification

**Story Points:** 3
**Priority:** P1

---

### Story 26.4: Intégration Signature Électronique (Architecture)

**Titre:** Définir l'architecture d'intégration avec un fournisseur PKI

**Description:**
As an architect,
I want to design the signature integration architecture,
So that we can implement eIDAS-compliant electronic signatures.

**Acceptance Criteria:**

```gherkin
Given we need electronic signatures
When I evaluate PKI providers
Then I should assess:
  - Certigna (French, eIDAS qualified)
  - DocuSign (International, eIDAS advanced)
  - Yousign (French, simple integration)

Given a provider is selected
When I design the integration
Then the architecture should support:
  - Single signature
  - Multi-signature (sequential and parallel)
  - Timestamping (TSA)
  - Long-term validation (LTV)
  - Signature verification

Given the integration is designed
When I document it
Then I should produce:
  - Sequence diagrams for sign flow
  - Data model for signatures
  - API contracts
  - Security considerations
```

**Technical Notes:**
- ADR pour choix du provider
- Préférer API REST avec webhooks
- Stocker uniquement les références, pas les certificats
- Budget à valider: ~0.50€/signature

**Story Points:** 5
**Priority:** P1

---

### Story 26.5: UI - Workflow de Signature

**Titre:** Interface pour demander et appliquer des signatures électroniques

**Description:**
As a document owner,
I want to request electronic signatures on my documents,
So that they have legal value.

**Acceptance Criteria:**

```gherkin
Given I own a document requiring signature
When I click "Demander signature"
Then I should be able to:
  - Select signers from organization or enter external emails
  - Choose workflow type (sequential/parallel)
  - Set deadline for signing
  - Add a message to signers

Given I am a designated signer
When I receive the signing request
Then I should see a notification in-app and by email
And I should be able to view the document
And I should be able to sign with my certificate or simple signature

Given all signatures are collected
When the process completes
Then the document should be marked as "Signed"
And a timestamped signature block should be added
And all parties should be notified
And an audit log should record the signing

Given I view a signed document
When I check the signatures
Then I should see all signers with their signature dates
And I should be able to verify each signature
And I should be able to download the signed PDF
```

**Technical Notes:**
- Intégration selon provider choisi en 26.4
- Composant `<SignatureRequestModal documentId={...} />`
- Status tracking dans document: pending_signature → signed
- Webhook handler pour mises à jour asynchrones

**Story Points:** 8
**Priority:** P1

---

## Epic 27: Audit Trail & eDiscovery

**Description:** Implémenter un système d'audit trail complet et immutable, avec des outils de recherche avancée pour répondre aux demandes eDiscovery et audits de conformité.

**Objectif:** Toutes les actions sur les documents sont tracées de manière inviolable, et les auditeurs peuvent rechercher/exporter des preuves efficacement.

**FRs couverts:** FR-VAULT-008 (watermarking), FR-VAULT-009 (audit), FR-VAULT-010 (eDiscovery)

**Valeur utilisateur:** En tant que DPO, je peux répondre à une demande RGPD en moins de 10 minutes. En tant qu'Auditeur, j'ai des preuves irréfutables.

---

### Story 27.1: Audit Trail - Collection Immutable

**Titre:** Créer la collection d'audit logs immutable avec chaînage cryptographique

**Description:**
As a system,
I want to record all document actions in an immutable audit log,
So that there is an irrefutable record of all activities.

**Acceptance Criteria:**

```gherkin
Given any action occurs on a document
When the action completes
Then an audit log entry should be created
And it should include: action, userId, documentId, timestamp, IP, userAgent
And it should include a hash linking to the previous entry (chain)

Given an audit log entry is created
When anyone tries to modify it
Then the modification should be blocked by Firestore rules
And only read access should be allowed

Given the audit chain exists
When I verify the chain integrity
Then each entry's previousLogHash should match the previous entry's hash
And any tampering should be detectable

Given I query the audit logs
When I filter by document, user, action, or date range
Then I should get relevant results efficiently
```

**Technical Notes:**
```typescript
interface DocumentAuditLog {
  id: string;
  documentId: string;
  action: DocumentAction;
  userId: string;
  timestamp: Timestamp;
  metadata: { ip?: string; userAgent?: string; ... };
  integrity: { hash: string; previousLogHash: string; };
}
```
- Cloud Function pour écrire (admin SDK)
- Firestore rules: `allow write: if false;`

**Story Points:** 5
**Priority:** P1

---

### Story 27.2: VaultAuditService - Client-Side Integration

**Titre:** Service client pour logger les actions automatiquement

**Description:**
As a developer,
I want a service that automatically logs document actions,
So that I don't have to manually add logging code everywhere.

**Acceptance Criteria:**

```gherkin
Given a user views a document (read)
When the DocumentInspector opens
Then VaultAuditService.log('read', documentId) should be called automatically

Given a user downloads a document
When the download starts
Then VaultAuditService.log('download', documentId) should be called

Given a user is denied access
When they try to access a restricted document
Then VaultAuditService.log('access_denied', documentId, { reason }) should be called

Given any logging call
When metadata is included
Then client IP should be captured (via Cloud Function)
And user agent should be captured
And any additional context should be included
```

**Technical Notes:**
```typescript
// src/services/VaultAuditService.ts
class VaultAuditService {
  static async log(
    action: DocumentAction,
    documentId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await httpsCallable(functions, 'writeAuditLog')({
      action, documentId, metadata
    });
  }
}
```
- Intégrer dans tous les hooks document (useDocument, useDownload, etc.)
- Batching pour performance (max 5 logs/request)

**Story Points:** 3
**Priority:** P1

---

### Story 27.3: UI - Visualisation Audit Trail

**Titre:** Interface de visualisation et recherche des logs d'audit

**Description:**
As an auditor or admin,
I want to view and search the document audit trail,
So that I can investigate activities and generate compliance reports.

**Acceptance Criteria:**

```gherkin
Given I am an admin or auditor
When I navigate to "Audit > Historique Documents"
Then I should see a timeline of recent actions
And I should be able to filter by:
  - Date range
  - User
  - Document
  - Action type
  - Classification level

Given I view a specific document's audit trail
When I click on "Historique" in DocumentInspector
Then I should see all actions on this document
And each entry should show: who, what, when, from where

Given I want to export audit data
When I click "Exporter"
Then I should be able to choose CSV or PDF format
And the export should include all filtered results
And the export should include a chain integrity verification result

Given I suspect log tampering
When I run "Vérifier l'intégrité de la chaîne"
Then the system should verify all hash links
And report any breaks in the chain
And highlight any suspicious entries
```

**Technical Notes:**
- Page `/audit/documents`
- Timeline component avec virtualization (react-window)
- Export avec streaming pour gros volumes
- Vérification chaîne côté serveur (Cloud Function)

**Story Points:** 5
**Priority:** P1

---

### Story 27.4: eDiscovery - Recherche Avancée

**Titre:** Moteur de recherche full-text pour eDiscovery

**Description:**
As a DPO or legal officer,
I want to search across all documents with advanced filters,
So that I can respond to legal requests and RGPD demands.

**Acceptance Criteria:**

```gherkin
Given I need to find documents related to a person
When I search with their name or email
Then I should find all documents where they are:
  - Owner
  - Mentioned in content (full-text)
  - Mentioned in metadata
  - Have access via ACL

Given I need to export for eDiscovery
When I select documents and click "Export eDiscovery"
Then a ZIP should be generated containing:
  - All selected documents (decrypted)
  - Index file (CSV with metadata)
  - Audit trail for each document
  - Integrity certificates
  - Summary report

Given I need a RGPD compliance report
When I click "Rapport RGPD"
Then I should see:
  - Documents containing personal data (estimated)
  - Retention status of these documents
  - Access history for the person
  - Options: export, anonymize, delete

Given I have 10,000 documents
When I perform a search
Then results should return in less than 2 seconds
And pagination should allow browsing all results
```

**Technical Notes:**
- Intégration Algolia ou Elasticsearch pour full-text
- Indexer titre, description, tags, et contenu OCR
- Cloud Function pour génération ZIP en background
- Rate limiting sur export (1/minute)

**Story Points:** 8
**Priority:** P2

---

### Story 27.5: Watermarking au Téléchargement

**Titre:** Appliquer automatiquement un watermark aux documents téléchargés

**Description:**
As a RSSI,
I want downloaded documents to be watermarked,
So that leaked documents can be traced back to the source.

**Acceptance Criteria:**

```gherkin
Given a document has watermarkEnabled = true
When an authorized user downloads it
Then a watermark should be applied containing:
  - User name and email
  - Download date and time
  - Document ID (partial)
  - Optional: IP address

Given the document is a PDF
When the watermark is applied
Then it should be:
  - Visible as diagonal text across each page
  - Semi-transparent (not blocking content)
  - Difficult to remove without destroying content

Given an external user downloads via shared link
When the download occurs
Then the watermark should show:
  - "EXTERNAL ACCESS"
  - Share link ID
  - IP address

Given a document is downloaded for printing
When print is disabled
Then the print function should be blocked (via PDF properties)
And a warning should be shown to the user
```

**Technical Notes:**
- pdf-lib ou pdfkit pour modification PDF
- Pour images: Sharp avec text overlay
- Watermark invisible: metadata embedding
- Cloud Function pour traitement

**Story Points:** 5
**Priority:** P2

---

## Annexes

### A. Estimation Totale

| Epic | Stories | Story Points | Sprints Estimés |
|------|---------|--------------|-----------------|
| 23 | 6 | 26 | 3 |
| 24 | 6 | 21 | 2.5 |
| 25 | 6 | 23 | 2.5 |
| 26 | 5 | 22 | 2.5 |
| 27 | 5 | 26 | 3 |
| **Total** | **28** | **118** | **13.5** |

*Vélocité estimée: 8-10 points/sprint*

### B. Mapping FRs → Stories

| FR | Stories |
|----|---------|
| FR-VAULT-001 | 23.1, 23.2, 23.3, 23.4, 23.5, 23.6 |
| FR-VAULT-002 | 24.1, 24.2, 24.3 |
| FR-VAULT-003 | 25.1, 25.2, 25.3 |
| FR-VAULT-004 | 25.4, 25.5, 25.6 |
| FR-VAULT-005 | 26.1, 26.2, 26.3 |
| FR-VAULT-006 | 26.4, 26.5 |
| FR-VAULT-007 | 24.4, 24.5, 24.6 |
| FR-VAULT-008 | 27.5 |
| FR-VAULT-009 | 27.1, 27.2, 27.3 |
| FR-VAULT-010 | 27.4 |

### C. Risques par Epic

| Epic | Risque Principal | Mitigation |
|------|------------------|------------|
| 23 | Performance chiffrement | Streaming, cache |
| 24 | Complexité rules Firestore | Tests exhaustifs |
| 25 | Conflits legal hold/retention | Priorité au hold |
| 26 | Coût signatures | Limiter aux docs critiques |
| 27 | Volume données audit | Archivage > 1 an |

---

**Document créé par:** Thibaultllopis
**Statut:** Ready for Implementation
**Prochaine étape:** Sprint Planning - Epic 23
