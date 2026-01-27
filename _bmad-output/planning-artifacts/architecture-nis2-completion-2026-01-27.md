---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflow_completed: true
completion_date: '2026-01-27'
inputDocuments: ['prd-nis2-completion-2026-01-27.md', 'project-context.md', 'architecture-european-leader-2026-01-22.md']
---

# Architecture Document - NIS2 Completion Modules

**Project:** Sentinel GRC v2 - NIS2 Completion
**Date:** 2026-01-27
**Version:** 1.0

---

## 1. Executive Summary

Ce document definit l'architecture technique des 2 modules NIS2 Completion :
- **Module A** : Formation & Sensibilisation Cyber
- **Module B** : Gouvernance Acces & Certificats

L'architecture s'integre dans l'ecosysteme existant de Sentinel GRC v2 en respectant les patterns etablis (services statiques, Zustand stores, Firestore collections, Cloud Functions v2).

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React 19)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │    Training     │  │  Certificates   │  │  Access Review  │         │
│  │    Module       │  │    Module       │  │    Module       │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
│  ┌────────▼────────────────────▼────────────────────▼────────┐         │
│  │                      Services Layer                        │         │
│  │  TrainingService │ CertificateService │ AccessReviewService│         │
│  └────────┬────────────────────┬────────────────────┬────────┘         │
│           │                    │                    │                   │
│  ┌────────▼────────────────────▼────────────────────▼────────┐         │
│  │                      Zustand Stores                        │         │
│  │  trainingStore  │ certificateStore │ accessReviewStore    │         │
│  └────────┬────────────────────┬────────────────────┬────────┘         │
└───────────┼────────────────────┼────────────────────┼───────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FIREBASE BACKEND                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                    Cloud Firestore                          │       │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │       │
│  │  │training_     │ │certificates  │ │access_review_│        │       │
│  │  │catalog       │ │              │ │campaigns     │        │       │
│  │  ├──────────────┤ ├──────────────┤ ├──────────────┤        │       │
│  │  │training_     │ │              │ │access_reviews│        │       │
│  │  │assignments   │ │              │ │              │        │       │
│  │  ├──────────────┤ │              │ ├──────────────┤        │       │
│  │  │training_     │ │              │ │dormant_      │        │       │
│  │  │campaigns     │ │              │ │accounts      │        │       │
│  │  └──────────────┘ └──────────────┘ └──────────────┘        │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                   Cloud Functions v2                        │       │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐              │       │
│  │  │Scheduled   │ │Triggers    │ │Callable    │              │       │
│  │  │- deadlines │ │- onComplete│ │- genCert   │              │       │
│  │  │- expiration│ │- onReview  │ │- export    │              │       │
│  │  │- dormant   │ │            │ │            │              │       │
│  │  └────────────┘ └────────────┘ └────────────┘              │       │
│  └─────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Integration avec l'Existant

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SENTINEL GRC V2 EXISTANT                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │  Score      │◄───│  Training   │    │ Certificates│                 │
│  │  Conformite │    │  Module     │    │   Module    │                 │
│  │  (existant) │    │   (NEW)     │    │   (NEW)     │                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                 │
│         │                  │                  │                         │
│         │    ┌─────────────▼──────────────────▼─────────────┐          │
│         │    │              Users Collection                 │          │
│         │    │         (employes, managers, roles)           │          │
│         │    └─────────────┬──────────────────┬─────────────┘          │
│         │                  │                  │                         │
│         │    ┌─────────────▼───┐    ┌────────▼──────────┐              │
│         │    │  Access Review  │    │     Assets        │              │
│         │    │    Module       │    │   (lien certs)    │              │
│         │    │    (NEW)        │    │   (existant)      │              │
│         │    └─────────────────┘    └───────────────────┘              │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              NOUVEAU CALCUL SCORE CONFORMITE                │       │
│  │  controls(35%) + risks(25%) + audits(20%) +                 │       │
│  │  documents(10%) + training(10%)                             │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Architecture

### 3.1 Firestore Collections Schema

#### 3.1.1 Training Collections

```typescript
// Collection: organizations/{orgId}/training_catalog
interface TrainingCourse {
  id: string;                    // Auto-generated
  organizationId: string;        // Parent org (denormalized)

  // Core fields
  title: string;                 // 3-100 chars
  description: string;           // Markdown supported
  category: TrainingCategory;    // Enum
  source: TrainingSource;        // Enum
  duration: number;              // Minutes

  // Configuration
  isRequired: boolean;           // Auto-assign to new users
  targetRoles: string[];         // Role-based targeting

  // Content
  content: {
    type: 'video' | 'document' | 'quiz' | 'external_link';
    url?: string;                // External URL or Storage path
    quizId?: string;             // Reference to quiz
  };

  // Framework mapping
  frameworkMappings: {
    nis2?: string[];             // ['21.2g']
    iso27001?: string[];         // ['A.7.2.2']
    dora?: string[];
  };

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  isArchived: boolean;
}

type TrainingCategory = 'security' | 'compliance' | 'awareness' | 'technical';
type TrainingSource = 'anssi' | 'cnil' | 'internal' | 'external';

// Collection: organizations/{orgId}/training_assignments
interface TrainingAssignment {
  id: string;
  organizationId: string;

  // References
  userId: string;                // Assigned user
  courseId: string;              // Training course
  campaignId?: string;           // Optional campaign reference

  // Assignment info
  assignedBy: string;
  assignedAt: Timestamp;
  dueDate: Timestamp;

  // Progress
  status: AssignmentStatus;
  startedAt?: Timestamp;
  completedAt?: Timestamp;

  // Results
  score?: number;                // 0-100 if quiz
  timeSpent?: number;            // Minutes
  certificateUrl?: string;       // Storage path to PDF

  // Metadata
  remindersSent: number;         // Count of reminders
  lastReminderAt?: Timestamp;
}

type AssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'overdue';

// Collection: organizations/{orgId}/training_campaigns
interface TrainingCampaign {
  id: string;
  organizationId: string;

  // Campaign info
  name: string;
  description?: string;

  // Timing
  startDate: Timestamp;
  endDate: Timestamp;

  // Scope
  scope: 'all' | 'department' | 'role';
  scopeFilter?: string[];        // Department IDs or role names

  // Content
  courseIds: string[];           // Courses included

  // Recurrence
  recurrence?: {
    enabled: boolean;
    frequency: 'monthly' | 'quarterly' | 'yearly';
    nextOccurrence?: Timestamp;
  };

  // Progress
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  progress: {
    totalAssignments: number;
    completed: number;
    overdue: number;
  };

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
}
```

#### 3.1.2 Certificates Collection

```typescript
// Collection: organizations/{orgId}/certificates
interface Certificate {
  id: string;
  organizationId: string;

  // Certificate info
  name: string;                  // Friendly name
  domains: string[];             // Covered domains

  // Issuer
  issuer: string;
  serialNumber: string;

  // Validity
  validFrom: Timestamp;
  validTo: Timestamp;

  // Technical
  algorithm: string;             // RSA, ECDSA, etc.
  keySize: number;               // 2048, 4096, etc.
  fingerprint?: string;          // SHA-256 fingerprint

  // Links
  linkedAssetId?: string;        // Reference to assets collection

  // Status (computed)
  status: CertificateStatus;
  daysUntilExpiry: number;       // Computed field

  // Alerts
  renewalReminder: boolean;
  alertsSent: {
    thirtyDay: boolean;
    fifteenDay: boolean;
    sevenDay: boolean;
  };

  // Metadata
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

type CertificateStatus = 'valid' | 'expiring_soon' | 'expired' | 'revoked';
```

#### 3.1.3 Access Review Collections

```typescript
// Collection: organizations/{orgId}/access_review_campaigns
interface AccessReviewCampaign {
  id: string;
  organizationId: string;

  // Campaign info
  name: string;
  description?: string;

  // Timing
  startDate: Timestamp;
  dueDate: Timestamp;

  // Scope
  scope: 'all' | 'department' | 'role';
  scopeFilter?: string[];

  // Recurrence
  recurrence?: {
    enabled: boolean;
    frequencyDays: number;       // 90 for quarterly
    nextOccurrence?: Timestamp;
  };

  // Status
  status: 'draft' | 'active' | 'completed' | 'cancelled';

  // Progress
  progress: {
    totalReviews: number;
    completed: number;
    approved: number;
    revoked: number;
    escalated: number;
  };

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  completedAt?: Timestamp;
}

// Collection: organizations/{orgId}/access_reviews
interface AccessReview {
  id: string;
  organizationId: string;
  campaignId: string;

  // Subject
  userId: string;                // User being reviewed
  userEmail: string;             // Denormalized
  userDepartment?: string;       // Denormalized

  // Reviewer
  reviewerId: string;            // Manager
  reviewerEmail: string;         // Denormalized

  // Status
  status: ReviewStatus;

  // Permissions reviewed
  permissions: PermissionReview[];

  // Summary
  summary?: {
    kept: number;
    revoked: number;
    escalated: number;
  };

  // Metadata
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
  notes?: string;
}

type ReviewStatus = 'pending' | 'in_progress' | 'completed' | 'escalated';

interface PermissionReview {
  resource: string;              // App/system name
  permission: string;            // Role/permission name
  grantedAt?: Timestamp;
  lastUsed?: Timestamp;
  decision: 'keep' | 'revoke' | 'escalate' | 'pending';
  reason?: string;               // Required for revoke
}

// Collection: organizations/{orgId}/dormant_accounts
interface DormantAccount {
  id: string;
  organizationId: string;

  // User info
  userId: string;
  email: string;
  displayName: string;
  department?: string;

  // Activity
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;
  daysSinceLogin: number;        // Computed

  // Detection
  detectedAt: Timestamp;
  detectionReason: 'no_login_90d' | 'never_logged_in';

  // Resolution
  status: 'detected' | 'contacted' | 'disabled' | 'deleted' | 'excluded';
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  resolution?: string;

  // Exclusion
  excluded: boolean;
  excludeReason?: string;        // e.g., "Service account"
}
```

### 3.2 Firestore Indexes

```javascript
// firestore.indexes.json additions
{
  "indexes": [
    // Training assignments - by user
    {
      "collectionGroup": "training_assignments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    // Training assignments - overdue
    {
      "collectionGroup": "training_assignments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ]
    },
    // Certificates - expiring
    {
      "collectionGroup": "certificates",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "validTo", "order": "ASCENDING" }
      ]
    },
    // Access reviews - by campaign
    {
      "collectionGroup": "access_reviews",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "campaignId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    // Access reviews - by reviewer
    {
      "collectionGroup": "access_reviews",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "reviewerId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    // Dormant accounts - active
    {
      "collectionGroup": "dormant_accounts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "detectedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### 3.3 Firestore Security Rules

```javascript
// firestore.rules additions
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Training Catalog - Admin only write, all org read
    match /organizations/{orgId}/training_catalog/{courseId} {
      allow read: if isOrgMember(orgId);
      allow write: if isOrgAdmin(orgId);
    }

    // Training Assignments - User can read own, admin can write
    match /organizations/{orgId}/training_assignments/{assignmentId} {
      allow read: if isOrgMember(orgId) &&
                    (resource.data.userId == request.auth.uid || isOrgAdmin(orgId));
      allow create: if isOrgAdmin(orgId) || isManager(orgId);
      allow update: if isOrgMember(orgId) &&
                      (resource.data.userId == request.auth.uid || isOrgAdmin(orgId));
      allow delete: if isOrgAdmin(orgId);
    }

    // Training Campaigns - Admin only
    match /organizations/{orgId}/training_campaigns/{campaignId} {
      allow read: if isOrgMember(orgId);
      allow write: if isOrgAdmin(orgId);
    }

    // Certificates - Admin and RSSI
    match /organizations/{orgId}/certificates/{certId} {
      allow read: if isOrgMember(orgId);
      allow write: if isOrgAdmin(orgId) || hasRole(orgId, 'rssi');
    }

    // Access Review Campaigns - Admin only
    match /organizations/{orgId}/access_review_campaigns/{campaignId} {
      allow read: if isOrgMember(orgId);
      allow write: if isOrgAdmin(orgId);
    }

    // Access Reviews - Reviewer can update own reviews
    match /organizations/{orgId}/access_reviews/{reviewId} {
      allow read: if isOrgMember(orgId) &&
                    (resource.data.reviewerId == request.auth.uid || isOrgAdmin(orgId));
      allow update: if resource.data.reviewerId == request.auth.uid || isOrgAdmin(orgId);
      allow create, delete: if isOrgAdmin(orgId);
    }

    // Dormant Accounts - Admin only
    match /organizations/{orgId}/dormant_accounts/{accountId} {
      allow read: if isOrgAdmin(orgId);
      allow write: if isOrgAdmin(orgId);
    }

    // Helper functions
    function isOrgMember(orgId) {
      return request.auth != null &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.organizationId == orgId;
    }

    function isOrgAdmin(orgId) {
      return isOrgMember(orgId) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'super_admin'];
    }

    function isManager(orgId) {
      return isOrgMember(orgId) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager';
    }

    function hasRole(orgId, role) {
      return isOrgMember(orgId) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }
  }
}
```

---

## 4. Component Architecture

### 4.1 Frontend Structure

```
src/
├── components/
│   ├── training/
│   │   ├── index.ts                      # Barrel exports
│   │   │
│   │   ├── TrainingDashboard.tsx         # Main dashboard page
│   │   ├── TrainingCatalog.tsx           # Course catalog list
│   │   ├── TrainingCourseForm.tsx        # Create/edit course
│   │   ├── TrainingCourseCard.tsx        # Course display card
│   │   │
│   │   ├── TrainingAssignmentForm.tsx    # Assign training modal
│   │   ├── TrainingAssignmentList.tsx    # List of assignments
│   │   ├── TrainingProgressCard.tsx      # User progress display
│   │   │
│   │   ├── TrainingCampaignList.tsx      # Campaign list
│   │   ├── TrainingCampaignForm.tsx      # Create campaign wizard
│   │   ├── TrainingCampaignDetail.tsx    # Campaign detail view
│   │   │
│   │   ├── MyTrainingPage.tsx            # Employee "My trainings" view
│   │   ├── TrainingCertificate.tsx       # Certificate/attestation view
│   │   │
│   │   └── widgets/
│   │       ├── TrainingKPICards.tsx      # KPI summary cards
│   │       ├── TrainingByDepartment.tsx  # Department chart
│   │       ├── TrainingOverdueList.tsx   # Overdue assignments
│   │       └── TrainingTrendChart.tsx    # 30-day trend
│   │
│   ├── certificates/
│   │   ├── index.ts
│   │   │
│   │   ├── CertificateDashboard.tsx      # Main dashboard
│   │   ├── CertificateList.tsx           # Certificate table
│   │   ├── CertificateForm.tsx           # Add/edit certificate
│   │   ├── CertificateDetail.tsx         # Certificate detail view
│   │   ├── CertificateImport.tsx         # CSV import
│   │   │
│   │   └── widgets/
│   │       ├── CertificateKPICards.tsx   # KPI cards
│   │       ├── CertificateExpiringList.tsx # Expiring soon list
│   │       └── CertificateAlgorithmChart.tsx # Algorithm distribution
│   │
│   └── access-review/
│       ├── index.ts
│       │
│       ├── AccessReviewDashboard.tsx     # Main dashboard
│       ├── AccessReviewCampaignList.tsx  # Campaign list
│       ├── AccessReviewCampaignForm.tsx  # Create campaign
│       ├── AccessReviewCampaignDetail.tsx # Campaign detail
│       │
│       ├── ManagerReviewWorkflow.tsx     # Manager review interface
│       ├── PermissionReviewCard.tsx      # Single permission review
│       ├── ReviewDecisionButtons.tsx     # Keep/Revoke/Escalate
│       │
│       ├── DormantAccountsList.tsx       # Dormant accounts table
│       ├── DormantAccountActions.tsx     # Action buttons
│       │
│       ├── AccessReviewReport.tsx        # Export/report view
│       │
│       └── widgets/
│           ├── ReviewProgressBar.tsx     # Campaign progress
│           ├── ReviewByManager.tsx       # By manager breakdown
│           └── DormantAccountsAlert.tsx  # Alert widget
│
├── services/
│   ├── TrainingService.ts
│   ├── CertificateService.ts
│   └── AccessReviewService.ts
│
├── hooks/
│   ├── training/
│   │   ├── useTrainingCatalog.ts
│   │   ├── useTrainingAssignments.ts
│   │   ├── useTrainingCampaigns.ts
│   │   ├── useMyTraining.ts
│   │   └── useTrainingStats.ts
│   │
│   ├── certificates/
│   │   ├── useCertificates.ts
│   │   ├── useCertificateAlerts.ts
│   │   └── useCertificateStats.ts
│   │
│   └── access-review/
│       ├── useAccessReviewCampaigns.ts
│       ├── useAccessReviews.ts
│       ├── useManagerReviews.ts
│       ├── useDormantAccounts.ts
│       └── useAccessReviewStats.ts
│
├── stores/
│   ├── trainingStore.ts
│   ├── certificateStore.ts
│   └── accessReviewStore.ts
│
├── types/
│   ├── training.ts
│   ├── certificates.ts
│   └── accessReview.ts
│
└── schemas/
    ├── trainingSchema.ts
    ├── certificateSchema.ts
    └── accessReviewSchema.ts
```

### 4.2 Service Layer Pattern

```typescript
// src/services/TrainingService.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ErrorLogger } from '@/services/errorLogger';
import type { TrainingCourse, TrainingAssignment, TrainingCampaign } from '@/types/training';

export class TrainingService {
  private static readonly CATALOG_COLLECTION = 'training_catalog';
  private static readonly ASSIGNMENTS_COLLECTION = 'training_assignments';
  private static readonly CAMPAIGNS_COLLECTION = 'training_campaigns';

  // ============ CATALOG ============

  static async getCourses(organizationId: string): Promise<TrainingCourse[]> {
    try {
      const q = query(
        collection(db, `organizations/${organizationId}/${this.CATALOG_COLLECTION}`),
        where('isArchived', '==', false)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingCourse));
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.getCourses', { organizationId });
      throw error;
    }
  }

  static async createCourse(
    organizationId: string,
    course: Omit<TrainingCourse, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(
        collection(db, `organizations/${organizationId}/${this.CATALOG_COLLECTION}`),
        {
          ...course,
          organizationId,
          isArchived: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.createCourse', { organizationId });
      throw error;
    }
  }

  // ============ ASSIGNMENTS ============

  static async assignTraining(
    organizationId: string,
    userId: string,
    courseId: string,
    assignedBy: string,
    dueDate: Date,
    campaignId?: string
  ): Promise<string> {
    try {
      const docRef = await addDoc(
        collection(db, `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}`),
        {
          organizationId,
          userId,
          courseId,
          campaignId: campaignId || null,
          assignedBy,
          assignedAt: serverTimestamp(),
          dueDate: Timestamp.fromDate(dueDate),
          status: 'assigned',
          remindersSent: 0,
        }
      );
      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.assignTraining', { organizationId, userId, courseId });
      throw error;
    }
  }

  static async completeAssignment(
    organizationId: string,
    assignmentId: string,
    score?: number
  ): Promise<void> {
    try {
      await updateDoc(
        doc(db, `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}/${assignmentId}`),
        {
          status: 'completed',
          completedAt: serverTimestamp(),
          score: score || null,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.completeAssignment', { organizationId, assignmentId });
      throw error;
    }
  }

  static async getUserAssignments(
    organizationId: string,
    userId: string
  ): Promise<TrainingAssignment[]> {
    try {
      const q = query(
        collection(db, `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}`),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingAssignment));
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.getUserAssignments', { organizationId, userId });
      throw error;
    }
  }

  // ============ STATISTICS ============

  static async getTrainingStats(organizationId: string): Promise<TrainingStats> {
    try {
      const assignments = await this.getAllAssignments(organizationId);

      const total = assignments.length;
      const completed = assignments.filter(a => a.status === 'completed').length;
      const overdue = assignments.filter(a => a.status === 'overdue').length;
      const inProgress = assignments.filter(a => a.status === 'in_progress').length;

      return {
        total,
        completed,
        overdue,
        inProgress,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.getTrainingStats', { organizationId });
      throw error;
    }
  }

  private static async getAllAssignments(organizationId: string): Promise<TrainingAssignment[]> {
    const q = query(
      collection(db, `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}`)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingAssignment));
  }
}

interface TrainingStats {
  total: number;
  completed: number;
  overdue: number;
  inProgress: number;
  completionRate: number;
}
```

### 4.3 Zustand Store Pattern

```typescript
// src/stores/trainingStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TrainingCourse, TrainingAssignment, TrainingStats } from '@/types/training';

interface TrainingState {
  // Data
  courses: TrainingCourse[];
  assignments: TrainingAssignment[];
  stats: TrainingStats | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  selectedCourseId: string | null;

  // Actions
  setCourses: (courses: TrainingCourse[]) => void;
  setAssignments: (assignments: TrainingAssignment[]) => void;
  setStats: (stats: TrainingStats) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectCourse: (courseId: string | null) => void;

  // Computed (via selectors)
  getOverdueAssignments: () => TrainingAssignment[];
  getCompletionRate: () => number;
}

export const useTrainingStore = create<TrainingState>()(
  devtools(
    (set, get) => ({
      // Initial state
      courses: [],
      assignments: [],
      stats: null,
      isLoading: false,
      error: null,
      selectedCourseId: null,

      // Actions
      setCourses: (courses) => set({ courses }),
      setAssignments: (assignments) => set({ assignments }),
      setStats: (stats) => set({ stats }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      selectCourse: (selectedCourseId) => set({ selectedCourseId }),

      // Computed
      getOverdueAssignments: () => {
        return get().assignments.filter(a => a.status === 'overdue');
      },
      getCompletionRate: () => {
        const { assignments } = get();
        if (assignments.length === 0) return 0;
        const completed = assignments.filter(a => a.status === 'completed').length;
        return Math.round((completed / assignments.length) * 100);
      },
    }),
    { name: 'training-store' }
  )
);

// Selectors (for fine-grained subscriptions)
export const selectCourses = (state: TrainingState) => state.courses;
export const selectAssignments = (state: TrainingState) => state.assignments;
export const selectStats = (state: TrainingState) => state.stats;
export const selectIsLoading = (state: TrainingState) => state.isLoading;
```

---

## 5. Cloud Functions Architecture

### 5.1 Functions Structure

```
functions/
├── src/
│   ├── training/
│   │   ├── index.ts                  # Exports
│   │   ├── checkDeadlines.ts         # Scheduled: check overdue
│   │   ├── onAssignmentComplete.ts   # Trigger: update score
│   │   ├── generateCertificate.ts    # Callable: PDF generation
│   │   └── sendReminders.ts          # Scheduled: send reminders
│   │
│   ├── certificates/
│   │   ├── index.ts
│   │   ├── checkExpiration.ts        # Scheduled: check expiring
│   │   └── sendAlerts.ts             # Trigger: send alerts
│   │
│   ├── access-review/
│   │   ├── index.ts
│   │   ├── checkDeadlines.ts         # Scheduled: check campaign deadlines
│   │   ├── detectDormant.ts          # Scheduled: detect dormant accounts
│   │   ├── onReviewComplete.ts       # Trigger: update campaign progress
│   │   └── generateReport.ts         # Callable: PDF report
│   │
│   └── index.ts                      # Main exports
```

### 5.2 Function Implementations

```typescript
// functions/src/training/checkDeadlines.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

export const checkTrainingDeadlines = onSchedule(
  {
    schedule: 'every day 08:00',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
  },
  async () => {
    const now = Timestamp.now();

    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();

    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;

      // Find assignments that are overdue but not marked as such
      const assignmentsRef = db.collection(`organizations/${orgId}/training_assignments`);
      const overdueQuery = assignmentsRef
        .where('status', 'in', ['assigned', 'in_progress'])
        .where('dueDate', '<', now);

      const overdueSnapshot = await overdueQuery.get();

      // Batch update to overdue status
      const batch = db.batch();

      for (const doc of overdueSnapshot.docs) {
        batch.update(doc.ref, {
          status: 'overdue',
          updatedAt: now
        });
      }

      await batch.commit();

      console.log(`Updated ${overdueSnapshot.size} overdue assignments for org ${orgId}`);
    }
  }
);

// functions/src/training/onAssignmentComplete.ts
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

export const onTrainingAssignmentComplete = onDocumentUpdated(
  {
    document: 'organizations/{orgId}/training_assignments/{assignmentId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // Only trigger on status change to 'completed'
    if (before?.status !== 'completed' && after?.status === 'completed') {
      const orgId = event.params.orgId;

      // Trigger compliance score recalculation
      const scoreRef = db.doc(`organizations/${orgId}/complianceScores/current`);
      await scoreRef.update({
        needsRecalculation: true,
        lastTrainingUpdate: new Date(),
      });

      console.log(`Training completed, flagged score recalculation for org ${orgId}`);
    }
  }
);

// functions/src/certificates/checkExpiration.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

export const checkCertificateExpiration = onSchedule(
  {
    schedule: 'every day 07:00',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
  },
  async () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const orgsSnapshot = await db.collection('organizations').get();

    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const certsRef = db.collection(`organizations/${orgId}/certificates`);

      // Get certificates expiring within 30 days
      const expiringQuery = certsRef
        .where('status', '==', 'valid')
        .where('validTo', '<=', Timestamp.fromDate(thirtyDaysFromNow));

      const expiringSnapshot = await expiringQuery.get();

      for (const certDoc of expiringSnapshot.docs) {
        const cert = certDoc.data();
        const validTo = cert.validTo.toDate();
        const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        let newStatus = 'valid';
        let alertType = null;

        if (daysUntilExpiry <= 0) {
          newStatus = 'expired';
        } else if (daysUntilExpiry <= 7) {
          newStatus = 'expiring_soon';
          alertType = 'sevenDay';
        } else if (daysUntilExpiry <= 15) {
          newStatus = 'expiring_soon';
          alertType = 'fifteenDay';
        } else if (daysUntilExpiry <= 30) {
          newStatus = 'expiring_soon';
          alertType = 'thirtyDay';
        }

        // Update certificate status
        await certDoc.ref.update({
          status: newStatus,
          daysUntilExpiry,
        });

        // Send alert if needed and not already sent
        if (alertType && !cert.alertsSent?.[alertType]) {
          await sendCertificateAlert(orgId, cert, daysUntilExpiry);
          await certDoc.ref.update({
            [`alertsSent.${alertType}`]: true,
          });
        }
      }
    }
  }
);

async function sendCertificateAlert(orgId: string, cert: any, daysUntilExpiry: number) {
  // Add to notification queue
  await db.collection('mail_queue').add({
    to: await getOrgAdminEmails(orgId),
    template: 'certificate-expiring',
    data: {
      certificateName: cert.name,
      domains: cert.domains.join(', '),
      daysUntilExpiry,
      expiryDate: cert.validTo.toDate().toISOString(),
    },
    createdAt: new Date(),
    status: 'pending',
  });
}

async function getOrgAdminEmails(orgId: string): Promise<string[]> {
  const usersRef = db.collection('users');
  const adminsQuery = usersRef
    .where('organizationId', '==', orgId)
    .where('role', 'in', ['admin', 'rssi']);

  const snapshot = await adminsQuery.get();
  return snapshot.docs.map(doc => doc.data().email);
}
```

---

## 6. Integration Architecture

### 6.1 Score Conformite Integration

```typescript
// Modification de calculateComplianceScore.js existant

// Nouvelle formule avec training
const WEIGHTS = {
  controls: 0.35,    // Reduit de 0.40
  risks: 0.25,       // Reduit de 0.30
  audits: 0.20,      // Inchange
  documents: 0.10,   // Inchange
  training: 0.10,    // NOUVEAU
};

async function calculateTrainingScore(orgId: string): Promise<number> {
  const assignmentsRef = db.collection(`organizations/${orgId}/training_assignments`);
  const snapshot = await assignmentsRef.get();

  if (snapshot.empty) return 100; // No training required = compliant

  const assignments = snapshot.docs.map(doc => doc.data());
  const completed = assignments.filter(a => a.status === 'completed').length;

  return Math.round((completed / assignments.length) * 100);
}

// Dans le calcul principal
const trainingScore = await calculateTrainingScore(orgId);

const globalScore =
  (controlsScore * WEIGHTS.controls) +
  (risksScore * WEIGHTS.risks) +
  (auditsScore * WEIGHTS.audits) +
  (documentsScore * WEIGHTS.documents) +
  (trainingScore * WEIGHTS.training);
```

### 6.2 Navigation Integration

```typescript
// src/config/navigation.ts - Ajouts

export const complianceNavigation = [
  // ... existing items ...

  {
    name: 'Formation',
    href: '/training',
    icon: AcademicCapIcon,
    children: [
      { name: 'Dashboard', href: '/training' },
      { name: 'Catalogue', href: '/training/catalog' },
      { name: 'Mes formations', href: '/training/my-training' },
      { name: 'Campagnes', href: '/training/campaigns' },
    ],
  },
  {
    name: 'Certificats',
    href: '/certificates',
    icon: ShieldCheckIcon,
    children: [
      { name: 'Dashboard', href: '/certificates' },
      { name: 'Inventaire', href: '/certificates/list' },
    ],
  },
  {
    name: 'Revue des Acces',
    href: '/access-review',
    icon: UserGroupIcon,
    children: [
      { name: 'Dashboard', href: '/access-review' },
      { name: 'Campagnes', href: '/access-review/campaigns' },
      { name: 'Mes revues', href: '/access-review/my-reviews' },
      { name: 'Comptes dormants', href: '/access-review/dormant' },
    ],
  },
];
```

### 6.3 Dashboard Widget Integration

```typescript
// Nouveau widget pour le dashboard principal
// src/components/dashboard/widgets/NIS2ComplianceWidget.tsx

import { useTrainingStats } from '@/hooks/training/useTrainingStats';
import { useCertificateStats } from '@/hooks/certificates/useCertificateStats';
import { useAccessReviewStats } from '@/hooks/access-review/useAccessReviewStats';

export function NIS2ComplianceWidget() {
  const { stats: trainingStats } = useTrainingStats();
  const { stats: certStats } = useCertificateStats();
  const { stats: reviewStats } = useAccessReviewStats();

  const nis2Coverage = calculateNIS2Coverage(trainingStats, certStats, reviewStats);

  return (
    <div className="glass-panel p-6 rounded-2xl">
      <h3 className="text-lg font-semibold mb-4">Couverture NIS2 Art. 21</h3>

      <div className="space-y-3">
        <CoverageItem
          label="21.2g Formation"
          value={trainingStats?.completionRate ?? 0}
          status={trainingStats?.completionRate >= 80 ? 'ok' : 'warning'}
        />
        <CoverageItem
          label="21.2h Cryptographie"
          value={certStats?.healthScore ?? 0}
          status={certStats?.expiredCount === 0 ? 'ok' : 'error'}
        />
        <CoverageItem
          label="21.2i Controle Acces"
          value={reviewStats?.completionRate ?? 0}
          status={reviewStats?.overdueReviews === 0 ? 'ok' : 'warning'}
        />
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Couverture globale</span>
          <span className="text-2xl font-bold text-green-600">{nis2Coverage}%</span>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. ADR - Architecture Decision Records

### ADR-009: Training Module Data Model

**Status:** Accepted

**Context:** Need to track employee training for NIS2 Art. 21.2g compliance.

**Decision:**
- Separate collections for catalog, assignments, and campaigns
- Assignments link users to courses with status tracking
- Campaigns can auto-generate assignments

**Consequences:**
- (+) Clear separation of concerns
- (+) Easy to query user's training status
- (+) Supports both individual and campaign-based assignments
- (-) Need to maintain consistency between collections

### ADR-010: Certificate Inventory Scope

**Status:** Accepted

**Context:** Need to track cryptographic certificates for NIS2 Art. 21.2h.

**Decision:**
- Manual entry first, automated scan as future enhancement
- Link to assets collection optional
- Status computed from validity dates

**Consequences:**
- (+) Quick to implement
- (+) No external dependencies
- (-) Initial data entry burden
- (-) May miss certificates not manually added

### ADR-011: Access Review Workflow

**Status:** Accepted

**Context:** Need periodic access review for NIS2 Art. 21.2i.

**Decision:**
- Campaign-based approach with deadlines
- Manager reviews their direct reports
- Three actions: keep, revoke, escalate

**Consequences:**
- (+) Clear accountability (manager signs off)
- (+) Audit trail for compliance
- (+) Escalation path for edge cases
- (-) Requires manager engagement

### ADR-012: Score Conformite Weight Adjustment

**Status:** Accepted

**Context:** Adding training to compliance score calculation.

**Decision:**
- Reduce controls weight from 40% to 35%
- Reduce risks weight from 30% to 25%
- Add training at 10%
- Keep audits (20%) and documents (10%) unchanged

**Consequences:**
- (+) Training now impacts overall compliance
- (+) Incentivizes training completion
- (-) Existing scores will change after deployment
- (-) Need communication to users about formula change

---

## 8. Testing Strategy

### 8.1 Unit Tests

```typescript
// src/services/__tests__/TrainingService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrainingService } from '../TrainingService';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: () => 'mock-timestamp',
}));

describe('TrainingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCourses', () => {
    it('should return courses filtered by organization', async () => {
      // Arrange
      const mockCourses = [
        { id: '1', title: 'Security Basics', category: 'security' },
        { id: '2', title: 'GDPR Training', category: 'compliance' },
      ];

      const getDocs = vi.mocked(await import('firebase/firestore')).getDocs;
      getDocs.mockResolvedValue({
        docs: mockCourses.map(c => ({ id: c.id, data: () => c })),
      } as any);

      // Act
      const result = await TrainingService.getCourses('org-123');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Security Basics');
    });
  });

  describe('assignTraining', () => {
    it('should create assignment with correct status', async () => {
      // Arrange
      const addDoc = vi.mocked(await import('firebase/firestore')).addDoc;
      addDoc.mockResolvedValue({ id: 'assignment-123' } as any);

      // Act
      const result = await TrainingService.assignTraining(
        'org-123',
        'user-456',
        'course-789',
        'admin-001',
        new Date('2026-02-15')
      );

      // Assert
      expect(result).toBe('assignment-123');
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'assigned',
          userId: 'user-456',
          courseId: 'course-789',
        })
      );
    });
  });

  describe('getTrainingStats', () => {
    it('should calculate completion rate correctly', async () => {
      // Arrange
      const mockAssignments = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'in_progress' },
        { status: 'overdue' },
      ];

      const getDocs = vi.mocked(await import('firebase/firestore')).getDocs;
      getDocs.mockResolvedValue({
        docs: mockAssignments.map((a, i) => ({ id: `${i}`, data: () => a })),
      } as any);

      // Act
      const stats = await TrainingService.getTrainingStats('org-123');

      // Assert
      expect(stats.total).toBe(4);
      expect(stats.completed).toBe(2);
      expect(stats.completionRate).toBe(50);
    });
  });
});
```

### 8.2 Integration Tests

```typescript
// src/components/training/__tests__/TrainingDashboard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TrainingDashboard } from '../TrainingDashboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('TrainingDashboard', () => {
  it('should display KPI cards with stats', async () => {
    // Arrange
    vi.mock('@/hooks/training/useTrainingStats', () => ({
      useTrainingStats: () => ({
        stats: {
          total: 100,
          completed: 75,
          overdue: 5,
          completionRate: 75,
        },
        isLoading: false,
      }),
    }));

    // Act
    render(<TrainingDashboard />, { wrapper });

    // Assert
    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument(); // Overdue
    });
  });
});
```

---

## 9. Deployment & Migration

### 9.1 Deployment Checklist

- [ ] Deploy Firestore indexes
- [ ] Deploy security rules
- [ ] Deploy Cloud Functions
- [ ] Update compliance score calculation
- [ ] Add navigation items
- [ ] Deploy frontend components
- [ ] Run data migration (if needed)
- [ ] Update documentation

### 9.2 Rollback Plan

1. Revert Cloud Functions to previous version
2. Revert compliance score calculation
3. Hide navigation items via feature flag
4. Keep Firestore collections (no data loss)

---

## 10. Monitoring & Observability

### 10.1 Key Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Training completion rate | Firestore | < 50% for 7 days |
| Certificates expiring | Cloud Function | Any expired |
| Access reviews overdue | Cloud Function | > 10% overdue |
| Cloud Function errors | Cloud Logging | > 1% error rate |

### 10.2 Logging

```typescript
// Structured logging pattern
console.log(JSON.stringify({
  severity: 'INFO',
  module: 'training',
  action: 'assignment_created',
  organizationId: orgId,
  userId: userId,
  courseId: courseId,
  timestamp: new Date().toISOString(),
}));
```

---

_Document genere le 2026-01-27_
_Sentinel GRC v2 - NIS2 Completion Architecture_
