# Story 23.1: Configuration Infrastructure Cloud KMS

## Metadata
- **Story ID:** 23.1
- **Epic:** 23 - Chiffrement & Sécurité Documentaire
- **Priority:** P0
- **Story Points:** 3
- **Status:** in-progress
- **Created:** 2026-01-17
- **FR Reference:** FR-VAULT-001

## Description

**As a** DevOps engineer,
**I want to** set up Google Cloud KMS key rings and crypto keys,
**So that** the application can encrypt/decrypt documents securely.

## Acceptance Criteria

### AC1: Key Ring & Crypto Key Creation
```gherkin
Given I am setting up the vault infrastructure
When I deploy the KMS configuration
Then a key ring "sentinel-vault" should be created in the project
And a crypto key "documents-key" should be created with AES-256-GCM algorithm
And key rotation should be configured for every 90 days
And IAM permissions should be set for Cloud Functions service account
```

### AC2: Key Status Verification
```gherkin
Given the KMS is configured
When I check the key status
Then the key should show as "ENABLED"
And the primary version should be active
And audit logging should be enabled for key operations
```

### AC3: Key Rotation Support
```gherkin
Given a key rotation occurs
When the new version is created
Then all new encryptions should use the new version
And existing documents should still be decryptable with old versions
```

## Technical Implementation

### 1. Types & Interfaces

```typescript
// src/types/vault.ts
export interface EncryptionConfig {
  keyRingId: string;
  cryptoKeyId: string;
  location: string;
  projectId: string;
}

export interface DocumentEncryptionMetadata {
  encrypted: boolean;
  keyVersion: string;
  encryptedAt: Timestamp;
  algorithm: 'AES-256-GCM';
  hash: string; // SHA-256 of original content
}

export interface EncryptionStatus {
  isEncrypted: boolean;
  keyVersion?: string;
  encryptedAt?: Date;
  integrityVerified?: boolean;
}
```

### 2. Vault Configuration Service

```typescript
// src/services/vaultConfig.ts
export const VAULT_CONFIG: EncryptionConfig = {
  keyRingId: 'sentinel-vault',
  cryptoKeyId: 'documents-key',
  location: 'europe-west1', // RGPD compliance
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
};

export const getKeyPath = (): string => {
  const { projectId, location, keyRingId, cryptoKeyId } = VAULT_CONFIG;
  return `projects/${projectId}/locations/${location}/keyRings/${keyRingId}/cryptoKeys/${cryptoKeyId}`;
};
```

### 3. Cloud Function Initialization Check

```typescript
// functions/src/vault/checkKmsSetup.ts
import { KeyManagementServiceClient } from '@google-cloud/kms';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const checkKmsSetup = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const kmsClient = new KeyManagementServiceClient();
  const keyPath = getKeyPath();

  try {
    const [cryptoKey] = await kmsClient.getCryptoKey({ name: keyPath });

    return {
      status: 'ready',
      keyName: cryptoKey.name,
      purpose: cryptoKey.purpose,
      primaryVersion: cryptoKey.primary?.name,
      rotationPeriod: cryptoKey.rotationPeriod?.seconds,
      nextRotation: cryptoKey.nextRotationTime,
    };
  } catch (error) {
    return {
      status: 'not_configured',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
```

### 4. Terraform/GCloud Setup Script

```bash
#!/bin/bash
# scripts/setup-kms.sh

PROJECT_ID="sentinel-grc-prod"
LOCATION="europe-west1"
KEY_RING="sentinel-vault"
KEY_NAME="documents-key"
SERVICE_ACCOUNT="firebase-functions@${PROJECT_ID}.iam.gserviceaccount.com"

# Create key ring
gcloud kms keyrings create ${KEY_RING} \
  --location=${LOCATION} \
  --project=${PROJECT_ID}

# Create crypto key with automatic rotation
gcloud kms keys create ${KEY_NAME} \
  --location=${LOCATION} \
  --keyring=${KEY_RING} \
  --purpose=encryption \
  --rotation-period=7776000s \
  --next-rotation-time=$(date -u -v+90d +"%Y-%m-%dT%H:%M:%SZ") \
  --project=${PROJECT_ID}

# Grant encrypt/decrypt to Cloud Functions service account
gcloud kms keys add-iam-policy-binding ${KEY_NAME} \
  --location=${LOCATION} \
  --keyring=${KEY_RING} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" \
  --project=${PROJECT_ID}

# Enable audit logging
gcloud logging sinks create kms-audit-sink \
  storage.googleapis.com/${PROJECT_ID}-audit-logs \
  --log-filter='resource.type="cloudkms_cryptokey"' \
  --project=${PROJECT_ID}

echo "KMS setup complete!"
```

### 5. Document Type Extension

```typescript
// src/types/documents.ts (extension)
export interface Document {
  // ... existing fields ...

  // New encryption fields
  encryption?: DocumentEncryptionMetadata;
}
```

## Tasks

- [x] Create `src/types/vault.ts` with encryption types
- [x] Create `src/services/vaultConfig.ts` with KMS configuration
- [x] Create `functions/src/vault/checkKmsSetup.ts` Cloud Function
- [x] Create `scripts/setup-kms.sh` for infrastructure setup
- [x] Update `src/types/documents.ts` with encryption metadata
- [x] Add environment variables documentation
- [ ] Test KMS connectivity from Cloud Functions
- [ ] Document emergency key rotation procedure

## Dependencies

- Google Cloud KMS API enabled
- Firebase Cloud Functions v2
- IAM permissions configured

## Definition of Done

- [ ] KMS key ring and crypto key created in europe-west1
- [ ] Key rotation configured for 90 days
- [ ] IAM permissions set for Cloud Functions
- [ ] Audit logging enabled
- [ ] `checkKmsSetup` Cloud Function deployed and working
- [ ] Types exported and available for other stories
- [ ] Setup script documented and tested

## Notes

- Using `europe-west1` for RGPD compliance
- 90-day rotation is a balance between security and operational overhead
- Old key versions are kept for decrypting existing documents
- Emergency rotation procedure should be documented in runbook
