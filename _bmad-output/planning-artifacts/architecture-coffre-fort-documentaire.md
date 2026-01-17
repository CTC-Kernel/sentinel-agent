---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: ['prd-coffre-fort-documentaire.md', 'audit-module-documentaire']
workflowType: 'architecture'
project_name: 'sentinel-grc-v2-prod'
module: 'coffre-fort-documentaire'
user_name: 'Thibaultllopis'
date: '2026-01-17'
status: 'ready-for-implementation'
---

# Architecture Decision Document - Coffre-Fort Documentaire

**Module:** Enterprise Document Vault
**Auteur:** Architecte + Thibaultllopis
**Date:** 2026-01-17
**Version:** 1.0

---

## 1. Executive Summary

Ce document définit les décisions architecturales pour transformer le module documentaire existant en un **coffre-fort numérique sécurisé** conforme aux standards ISO 27001 et RGPD.

### Principes Directeurs

1. **Security by Design** - Chiffrement à chaque couche
2. **Zero Trust** - Vérification à chaque accès
3. **Auditabilité** - Traçabilité complète et immutable
4. **Performance** - Latence minimale malgré le chiffrement
5. **Brownfield** - Extension de l'existant, pas de réécriture

---

## 2. Current State Analysis

### 2.1 Architecture Existante

```
┌─────────────────────────────────────────────────────────────────┐
│                    ÉTAT ACTUEL (Audit 2026-01-17)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend (React)                                               │
│  ├─ DocumentInspector.tsx (1 viewer principal)                  │
│  ├─ ApprovalFlow.tsx (workflow UI)                              │
│  ├─ DocumentForm.tsx (formulaire)                               │
│  ├─ DocumentVersionHistory.tsx                                  │
│  └─ FolderTree.tsx                                              │
│                                                                 │
│  Services                                                       │
│  ├─ DocumentWorkflowService.ts (state machine)                  │
│  ├─ documentService.ts (CRUD)                                   │
│  ├─ secureStorage.ts (chiffrement client-side seulement)        │
│  └─ externalStorageService.ts (OAuth integrations)              │
│                                                                 │
│  Backend (Firebase)                                             │
│  ├─ Firestore: documents, document_versions, document_folders   │
│  ├─ Storage: /documents/{orgId}/{docId}                         │
│  └─ Rules: RBAC collection-level                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Gaps Identifiés

| Gap | Impact | Solution Architecturale |
|-----|--------|-------------------------|
| Pas de chiffrement serveur | Critique | Cloud KMS + Cloud Function |
| RBAC collection-level only | Haute | Document-level ACL |
| Pas de legal hold | Critique | Firestore rules + metadata |
| Pas de retention policy | Haute | Scheduled Cloud Function |
| Hash non vérifié | Haute | Cloud Function on download |
| Audit trail basique | Moyenne | Collection séparée immutable |

---

## 3. Target Architecture

### 3.1 Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE CIBLE - COFFRE-FORT                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         FRONTEND (React)                           │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │ │
│  │  │ DocumentVault│ │Classification│ │ LegalHold   │               │ │
│  │  │ Inspector    │ │ Selector     │ │ Manager     │               │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘               │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │ │
│  │  │ Retention    │ │ eDiscovery   │ │ Signature   │               │ │
│  │  │ Dashboard    │ │ Search       │ │ Panel       │               │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      SERVICES LAYER                                │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │ │
│  │  │ VaultEncrypt │ │ VaultClassif │ │ VaultRetent  │               │ │
│  │  │ Service      │ │ Service      │ │ Service      │               │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘               │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │ │
│  │  │ VaultAudit   │ │ VaultSign    │ │ VaultDiscover│               │ │
│  │  │ Service      │ │ Service      │ │ Service      │               │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    FIREBASE BACKEND                                │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │ │
│  │  │  Firestore  │    │   Cloud     │    │  Cloud KMS  │            │ │
│  │  │  (Metadata) │◄───│  Functions  │───►│  (Keys)     │            │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘            │ │
│  │        │                   │                                       │ │
│  │        ▼                   ▼                                       │ │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │ │
│  │  │   Storage   │    │  Audit Logs │    │   Archive   │            │ │
│  │  │ (Encrypted) │    │ (Immutable) │    │   (Cold)    │            │ │
│  │  └─────────────┘    └─────────────┘    └─────────────┘            │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Flux de Données

```
UPLOAD FLOW:
┌──────┐    ┌──────────┐    ┌─────────────┐    ┌─────────┐    ┌─────────┐
│Client│───►│ CF:      │───►│ Cloud KMS   │───►│ Storage │───►│Firestore│
│      │    │ encrypt  │    │ AES-256-GCM │    │(cipher) │    │(metadata)
└──────┘    │ OnUpload │    └─────────────┘    └─────────┘    └─────────┘
            └──────────┘           │
                                   ▼
                           ┌─────────────┐
                           │  Hash +     │
                           │  Audit Log  │
                           └─────────────┘

DOWNLOAD FLOW:
┌──────┐    ┌──────────┐    ┌─────────────┐    ┌─────────┐    ┌─────────┐
│Client│◄───│ CF:      │◄───│ Cloud KMS   │◄───│ Storage │◄───│ ACL     │
│      │    │ decrypt  │    │ Decrypt     │    │(cipher) │    │ Check   │
└──────┘    │ +Verify  │    └─────────────┘    └─────────┘    └─────────┘
            └──────────┘           │
                                   ▼
                           ┌─────────────┐
                           │  Hash       │
                           │  Verify     │
                           └─────────────┘
```

---

## 4. Key Architecture Decisions (ADRs)

### ADR-VAULT-001: Chiffrement via Cloud KMS

**Contexte:** Les documents doivent être chiffrés au repos pour conformité ISO 27001 A.8.24.

**Décision:** Utiliser Google Cloud KMS avec chiffrement AES-256-GCM.

**Alternatives considérées:**
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Firebase client-side | Simple | Clé exposée, pas de rotation | ❌ |
| Cloud KMS | Rotation auto, audit, HSM-backed | Coût, latence | ✅ |
| Self-managed keys | Contrôle total | Complexité, risque | ❌ |
| Third-party (Vault) | Features avancées | Dépendance externe | ❌ |

**Implémentation:**
```typescript
// Cloud Function: encryptOnUpload
import { KeyManagementServiceClient } from '@google-cloud/kms';

const kms = new KeyManagementServiceClient();
const keyName = `projects/${PROJECT}/locations/global/keyRings/vault/cryptoKeys/documents`;

export const encryptOnUpload = onObjectFinalized(
  { bucket: 'sentinel-documents' },
  async (event) => {
    const file = storage.bucket(event.bucket).file(event.name);
    const [content] = await file.download();

    // Encrypt with KMS
    const [encryptResponse] = await kms.encrypt({
      name: keyName,
      plaintext: content,
    });

    // Calculate hash before encryption for integrity
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    // Replace with encrypted content
    await file.save(encryptResponse.ciphertext, {
      metadata: {
        encrypted: 'true',
        keyVersion: encryptResponse.name,
        originalHash: hash,
      }
    });

    // Update Firestore metadata
    await db.collection('documents').doc(docId).update({
      encrypted: true,
      hash: hash,
      encryptedAt: FieldValue.serverTimestamp(),
    });
  }
);
```

**Conséquences:**
- Latence +200-300ms par opération
- Coût: ~$0.03/10000 opérations
- Rotation automatique des clés tous les 90 jours

---

### ADR-VAULT-002: Classification avec RBAC Étendu

**Contexte:** Les documents doivent avoir des niveaux de classification avec accès différencié.

**Décision:** 4 niveaux de classification avec mapping RBAC automatique.

**Data Model:**
```typescript
interface DocumentClassification {
  level: 'public' | 'internal' | 'confidential' | 'secret';
  classifiedBy: string;
  classifiedAt: Timestamp;
  justification?: string;
  autoClassified: boolean; // True if AI-suggested
}

// RBAC Mapping
const CLASSIFICATION_RBAC: Record<ClassificationLevel, Role[]> = {
  public: ['user', 'auditor', 'project_manager', 'rssi', 'admin', 'super_admin'],
  internal: ['user', 'auditor', 'project_manager', 'rssi', 'admin', 'super_admin'],
  confidential: ['project_manager', 'rssi', 'admin', 'super_admin'],
  secret: ['rssi', 'admin', 'super_admin'],
};
```

**Firestore Rules:**
```javascript
function canAccessClassification(classification, role) {
  return (classification == 'public') ||
         (classification == 'internal') ||
         (classification == 'confidential' && role in ['project_manager', 'rssi', 'admin', 'super_admin']) ||
         (classification == 'secret' && role in ['rssi', 'admin', 'super_admin']);
}

match /documents/{docId} {
  allow read: if canRead(resource.data.organizationId) &&
    canAccessClassification(resource.data.classification.level, request.auth.token.role);
}
```

---

### ADR-VAULT-003: Legal Hold Implementation

**Contexte:** Les documents doivent pouvoir être gelés pour procédures légales (eDiscovery).

**Décision:** Metadata-based hold avec Firestore rules enforcement.

**Data Model:**
```typescript
interface LegalHold {
  id: string;
  name: string;
  reason: string;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  documentIds: string[];
  status: 'active' | 'released';
  releasedBy?: string;
  releasedAt?: Timestamp;
  releaseReason?: string;
}

// Document extension
interface Document {
  // ... existing fields
  legalHoldIds?: string[]; // References to active holds
  isUnderHold?: boolean;   // Computed field for quick check
}
```

**Firestore Rules:**
```javascript
match /documents/{docId} {
  // Block delete if under legal hold
  allow delete: if !resource.data.isUnderHold;

  // Block content modification if under hold (metadata OK)
  allow update: if !resource.data.isUnderHold ||
    !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['content', 'url', 'version']);
}

match /legal_holds/{holdId} {
  // Only admin can create/release holds
  allow create, update: if request.auth.token.role == 'admin';
  allow delete: if false; // Never delete, only release
}
```

---

### ADR-VAULT-004: Retention Policy Engine

**Contexte:** Les documents doivent être archivés/supprimés selon des règles configurables.

**Décision:** Cloud Function scheduled + Cold Storage tier.

**Data Model:**
```typescript
interface RetentionPolicy {
  id: string;
  name: string;
  documentType: DocumentType;
  retentionDays: number;
  action: 'archive' | 'delete' | 'notify';
  notifyDaysBefore: number;
  exceptions: {
    classifications: ClassificationLevel[];
    legalHold: boolean; // Always exempt if under hold
  };
  createdBy: string;
  createdAt: Timestamp;
}

interface RetentionExecution {
  id: string;
  policyId: string;
  documentId: string;
  action: 'archived' | 'deleted' | 'notified' | 'skipped';
  reason?: string; // Why skipped (hold, exception)
  executedAt: Timestamp;
  certificateUrl?: string; // For deletion certificate
}
```

**Cloud Function:**
```typescript
// Scheduled: Every day at 2 AM
export const applyRetentionPolicies = onSchedule('0 2 * * *', async () => {
  const policies = await db.collection('retention_policies').get();

  for (const policy of policies.docs) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.data().retentionDays);

    const expiredDocs = await db.collection('documents')
      .where('type', '==', policy.data().documentType)
      .where('createdAt', '<', cutoffDate)
      .where('isUnderHold', '!=', true)
      .get();

    for (const doc of expiredDocs.docs) {
      await executeRetentionAction(doc, policy.data());
    }
  }
});

async function executeRetentionAction(doc, policy) {
  switch (policy.action) {
    case 'archive':
      await archiveToColdstorage(doc);
      break;
    case 'delete':
      await secureDelete(doc);
      await generateDeletionCertificate(doc);
      break;
    case 'notify':
      await notifyOwner(doc, policy.notifyDaysBefore);
      break;
  }

  await logRetentionExecution(doc, policy);
}
```

---

### ADR-VAULT-005: Audit Trail Architecture

**Contexte:** Toutes les actions doivent être tracées de manière immutable pour conformité.

**Décision:** Collection Firestore séparée avec règles d'écriture seule.

**Data Model:**
```typescript
interface DocumentAuditLog {
  id: string;
  documentId: string;
  organizationId: string;
  action: DocumentAction;
  userId: string;
  userEmail: string;
  userRole: string;
  timestamp: Timestamp;
  metadata: {
    ip?: string;
    userAgent?: string;
    previousValue?: any;
    newValue?: any;
    reason?: string;
  };
  integrity: {
    hash: string; // SHA-256 of log entry
    previousLogHash: string; // Chain integrity
  };
}

type DocumentAction =
  | 'create' | 'read' | 'update' | 'delete'
  | 'download' | 'print' | 'share'
  | 'classify' | 'declassify'
  | 'sign' | 'approve' | 'reject'
  | 'hold_apply' | 'hold_release'
  | 'retention_archive' | 'retention_delete'
  | 'access_denied';
```

**Firestore Rules:**
```javascript
match /document_audit_logs/{logId} {
  // Only Cloud Functions can write (via admin SDK)
  allow read: if canRead(resource.data.organizationId) &&
    request.auth.token.role in ['admin', 'rssi', 'auditor'];
  allow write: if false; // Admin SDK only
}
```

**Service:**
```typescript
// VaultAuditService.ts
class VaultAuditService {
  private static lastHash: string = '';

  static async log(action: DocumentAction, documentId: string, metadata?: any) {
    const logEntry: DocumentAuditLog = {
      id: uuidv4(),
      documentId,
      organizationId: getCurrentOrgId(),
      action,
      userId: getCurrentUserId(),
      userEmail: getCurrentUserEmail(),
      userRole: getCurrentUserRole(),
      timestamp: serverTimestamp(),
      metadata: {
        ...metadata,
        ip: await getClientIP(),
        userAgent: navigator.userAgent,
      },
      integrity: {
        hash: '', // Computed below
        previousLogHash: this.lastHash,
      },
    };

    // Compute integrity hash
    logEntry.integrity.hash = this.computeHash(logEntry);
    this.lastHash = logEntry.integrity.hash;

    // Write via Cloud Function (admin SDK)
    await httpsCallable(functions, 'writeAuditLog')(logEntry);
  }

  private static computeHash(entry: DocumentAuditLog): string {
    const payload = JSON.stringify({
      documentId: entry.documentId,
      action: entry.action,
      userId: entry.userId,
      timestamp: entry.timestamp,
      previousHash: entry.integrity.previousLogHash,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
```

---

### ADR-VAULT-006: Document-Level ACL

**Contexte:** Le RBAC collection-level ne suffit pas pour contrôle granulaire.

**Décision:** ACL embarqué dans le document avec Firestore rules.

**Data Model:**
```typescript
interface DocumentACL {
  // Default access based on classification
  defaultAccess: 'classification' | 'explicit';

  // Explicit permissions
  permissions: Array<{
    principalType: 'user' | 'role' | 'group';
    principalId: string;
    access: 'read' | 'download' | 'edit' | 'delete' | 'share' | 'admin';
    grantedBy: string;
    grantedAt: Timestamp;
    expiresAt?: Timestamp;
  }>;

  // External shares
  externalShares: Array<{
    id: string;
    email?: string;
    accessCode?: string; // Hashed
    permissions: ('read' | 'download')[];
    expiresAt: Timestamp;
    maxDownloads?: number;
    downloadCount: number;
    createdBy: string;
    createdAt: Timestamp;
  }>;
}
```

**Firestore Rules:**
```javascript
function hasDocumentAccess(doc, requiredAccess) {
  let userId = request.auth.uid;
  let userRole = request.auth.token.role;
  let userEmail = request.auth.token.email;

  // Check explicit permissions
  let permissions = doc.acl.permissions;
  for (let perm in permissions) {
    if ((perm.principalType == 'user' && perm.principalId == userId) ||
        (perm.principalType == 'role' && perm.principalId == userRole)) {
      if (perm.access == requiredAccess || perm.access == 'admin') {
        if (!perm.expiresAt || perm.expiresAt > request.time) {
          return true;
        }
      }
    }
  }

  // Fallback to classification-based access
  if (doc.acl.defaultAccess == 'classification') {
    return canAccessClassification(doc.classification.level, userRole);
  }

  return false;
}
```

---

## 5. Data Model Extensions

### 5.1 Document Type (Extended)

```typescript
interface Document {
  // === EXISTING FIELDS ===
  id: string;
  organizationId: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  version: string;
  url?: string;
  owner: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;

  // === NEW VAULT FIELDS ===

  // Encryption
  encrypted: boolean;
  encryptedAt?: Timestamp;
  keyVersion?: string;

  // Integrity
  hash: string; // SHA-256
  hashVerifiedAt?: Timestamp;

  // Classification
  classification: DocumentClassification;

  // Legal Hold
  legalHoldIds?: string[];
  isUnderHold: boolean;

  // Retention
  retentionPolicyId?: string;
  retentionExpiresAt?: Timestamp;
  archivedAt?: Timestamp;
  archiveLocation?: string;

  // ACL
  acl: DocumentACL;

  // Signatures
  signatures?: DocumentSignature[];
  signatureRequired: boolean;
  signatureWorkflow?: 'sequential' | 'parallel';

  // Watermark
  watermarkEnabled: boolean;
  watermarkText?: string;

  // DRM
  downloadLimit?: number;
  downloadCount: number;
  viewOnly: boolean;
  printDisabled: boolean;
}
```

### 5.2 New Collections

```typescript
// Firestore Collections
collections:
  - documents          // Extended with vault fields
  - document_versions  // Existing
  - document_folders   // Existing
  - document_audit_logs // NEW - Immutable audit trail
  - legal_holds        // NEW - Legal hold management
  - retention_policies // NEW - Retention rules
  - retention_executions // NEW - Execution history
  - document_signatures // NEW - PKI signatures
  - external_shares    // NEW - External access management
```

---

## 6. API Design

### 6.1 Cloud Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `encryptOnUpload` | Storage finalize | Chiffre les fichiers uploadés |
| `decryptOnDownload` | HTTPS callable | Déchiffre pour téléchargement |
| `verifyIntegrity` | HTTPS callable | Vérifie hash du document |
| `applyRetentionPolicies` | Schedule (daily) | Applique retention rules |
| `archiveDocument` | HTTPS callable | Archive vers cold storage |
| `secureDelete` | HTTPS callable | Suppression sécurisée |
| `writeAuditLog` | HTTPS callable | Écrit log immutable |
| `generateCertificate` | HTTPS callable | Génère certificat de destruction |
| `classifyDocument` | HTTPS callable | Classification IA auto |
| `signDocument` | HTTPS callable | Applique signature PKI |

### 6.2 Service Interfaces

```typescript
// VaultEncryptionService
interface IVaultEncryptionService {
  encrypt(documentId: string): Promise<void>;
  decrypt(documentId: string): Promise<Buffer>;
  rotateKey(documentId: string): Promise<void>;
  getKeyInfo(documentId: string): Promise<KeyInfo>;
}

// VaultClassificationService
interface IVaultClassificationService {
  classify(documentId: string, level: ClassificationLevel, justification?: string): Promise<void>;
  suggestClassification(documentId: string): Promise<ClassificationSuggestion>;
  bulkClassify(documentIds: string[], level: ClassificationLevel): Promise<void>;
}

// VaultRetentionService
interface IVaultRetentionService {
  createPolicy(policy: RetentionPolicy): Promise<string>;
  applyPolicy(documentId: string, policyId: string): Promise<void>;
  archive(documentId: string): Promise<string>; // Returns archive URL
  secureDelete(documentId: string): Promise<DeletionCertificate>;
}

// VaultAuditService
interface IVaultAuditService {
  log(action: DocumentAction, documentId: string, metadata?: any): Promise<void>;
  query(filters: AuditQueryFilters): Promise<DocumentAuditLog[]>;
  export(filters: AuditQueryFilters, format: 'csv' | 'pdf'): Promise<string>;
  verifyChain(documentId: string): Promise<ChainVerificationResult>;
}

// VaultSignatureService
interface IVaultSignatureService {
  requestSignature(documentId: string, signers: Signer[]): Promise<string>;
  sign(documentId: string, signatureData: SignatureData): Promise<void>;
  verify(documentId: string): Promise<SignatureVerification>;
  getTimestamp(documentId: string): Promise<Timestamp>;
}
```

---

## 7. Security Considerations

### 7.1 Threat Model

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Data breach (storage) | Critical | KMS encryption |
| Unauthorized access | High | ACL + Classification |
| Data tampering | High | Hash verification |
| Audit log manipulation | High | Immutable logs + chain |
| Key compromise | Critical | KMS rotation + HSM |
| Insider threat | High | Audit + least privilege |

### 7.2 Security Controls

```typescript
// Security checklist per operation
const SECURITY_CONTROLS = {
  upload: ['authenticate', 'authorize', 'encrypt', 'hash', 'audit'],
  download: ['authenticate', 'authorize', 'checkHold', 'decrypt', 'verifyHash', 'watermark', 'audit'],
  delete: ['authenticate', 'authorize', 'checkHold', 'checkRetention', 'audit', 'certificate'],
  share: ['authenticate', 'authorize', 'checkClassification', 'generateLink', 'audit'],
};
```

---

## 8. Performance Considerations

### 8.1 Latency Budget

| Operation | Current | Target | Strategy |
|-----------|---------|--------|----------|
| Upload (10MB) | 2s | 3s | Async encryption |
| Download (10MB) | 1s | 2s | Stream decryption |
| Classification | N/A | 500ms | Cache AI model |
| Audit log write | N/A | 100ms | Async, batch |
| Search | 1s | 2s | Algolia index |

### 8.2 Caching Strategy

```typescript
// Cache layers
const CACHE_CONFIG = {
  // Client-side (localStorage)
  classification_suggestions: { ttl: '1h' },
  acl_check_results: { ttl: '5m' },

  // Server-side (Redis/Memcache)
  decrypted_documents: { ttl: '10m', max_size: '100MB' },
  audit_log_hashes: { ttl: '1d' },

  // CDN (Cloud CDN)
  public_documents: { ttl: '1h' },
};
```

---

## 9. Migration Strategy

### 9.1 Phases

```
Phase 1: Schema Extension (Sprint 1)
├─ Add new fields to Document type (optional, with defaults)
├─ Create new collections (audit_logs, legal_holds, etc.)
├─ Deploy Cloud Functions (inactive triggers)
└─ No user impact

Phase 2: Encryption Migration (Sprint 2-3)
├─ Enable encryption for NEW documents
├─ Batch job to encrypt existing documents
├─ Verify all documents encrypted
└─ User impact: slight upload latency

Phase 3: Classification & ACL (Sprint 4)
├─ Deploy classification UI
├─ Default all existing to "internal"
├─ Enable ACL enforcement
└─ User training required

Phase 4: Full Enforcement (Sprint 5+)
├─ Enable legal hold
├─ Enable retention policies
├─ Audit trail mandatory
└─ Compliance validated
```

### 9.2 Rollback Plan

```typescript
// Feature flags for gradual rollout
const VAULT_FEATURES = {
  encryption: { enabled: true, rollback: 'disable_encrypt_trigger' },
  classification: { enabled: true, rollback: 'classification_optional' },
  legal_hold: { enabled: true, rollback: 'hold_advisory_only' },
  retention: { enabled: false, rollback: 'disable_retention_job' },
  audit_chain: { enabled: true, rollback: 'simple_audit' },
};
```

---

## 10. Testing Strategy

### 10.1 Test Categories

| Category | Coverage | Tools |
|----------|----------|-------|
| Unit (Services) | 80% | Vitest |
| Integration (Functions) | 70% | Firebase Emulator |
| Security | 100% rules | Rules Unit Testing |
| E2E | Critical paths | Playwright |
| Performance | Key operations | k6 |

### 10.2 Security Test Cases

```typescript
// Critical security tests
describe('VaultSecurity', () => {
  test('cannot access secret without proper role');
  test('cannot delete document under legal hold');
  test('cannot bypass classification via direct Firestore');
  test('audit log is immutable');
  test('encrypted file cannot be read without KMS');
  test('external share expires correctly');
  test('download limit enforced');
});
```

---

## 11. Observability

### 11.1 Metrics

```typescript
// Key metrics to track
const VAULT_METRICS = [
  'vault.documents.encrypted.total',
  'vault.documents.classified.by_level',
  'vault.encryption.latency_ms',
  'vault.decryption.latency_ms',
  'vault.audit.logs_written.total',
  'vault.holds.active.count',
  'vault.retention.actions.by_type',
  'vault.access.denied.count',
];
```

### 11.2 Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Encryption failure | Error rate >1% | Critical |
| Hash mismatch | Any occurrence | Critical |
| Mass download | >50 docs/user/hour | High |
| Audit chain break | Chain verification fail | Critical |
| KMS quota | >80% usage | Medium |

---

## 12. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **E2EE** | End-to-end encryption |
| **KMS** | Key Management Service |
| **HSM** | Hardware Security Module |
| **Legal Hold** | Freeze document for legal proceedings |
| **Retention** | Document lifecycle management |
| **ACL** | Access Control List |
| **PKI** | Public Key Infrastructure |

### B. References

- [Google Cloud KMS Documentation](https://cloud.google.com/kms/docs)
- [ISO 27001:2022 Annex A](https://www.iso.org/standard/27001)
- [RGPD Articles 17, 20, 32](https://gdpr-info.eu/)
- [eIDAS Regulation](https://ec.europa.eu/digital-building-blocks/wikis/display/DIGITAL/eIDAS+Regulation)

---

**Document validé par:** Architecte + Thibaultllopis
**Statut:** Ready for Implementation
**Prochaine étape:** Création des Epics & Stories
