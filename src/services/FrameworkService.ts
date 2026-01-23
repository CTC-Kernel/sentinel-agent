/**
 * Framework Service
 * Implements ADR-001: Multi-Framework Data Model
 *
 * Service for managing regulatory frameworks (NIS2, DORA, RGPD, AI Act)
 * with cross-framework mapping capabilities.
 *
 * @see Story EU-1.2: Implémenter FrameworkService
 */

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  writeBatch,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import type {
  RegulatoryFramework,
  Requirement,
  ControlMapping,
  ActiveFramework,
  RequirementsByCategory,
  ControlWithMappings,
  RegulatoryFrameworkCode,
  RequirementCategory,
} from '../types/framework';
import { CATEGORY_LABELS } from '../types/framework';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Firestore Timestamp to ISO string
 */
function convertTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (ts.toDate) return ts.toDate().toISOString();
  if (ts.seconds) return new Date(ts.seconds * 1000).toISOString();
  return undefined;
}

/**
 * Convert Firestore document to Framework type
 */
function docToFramework(doc: DocumentData, id: string): RegulatoryFramework {
  return {
    ...doc,
    id,
    effectiveDate: convertTimestamp(doc.effectiveDate) || doc.effectiveDate,
    createdAt: convertTimestamp(doc.createdAt),
    updatedAt: convertTimestamp(doc.updatedAt),
  } as RegulatoryFramework;
}

/**
 * Convert Firestore document to Requirement type
 */
function docToRequirement(doc: DocumentData, id: string): Requirement {
  return {
    ...doc,
    id,
    createdAt: convertTimestamp(doc.createdAt),
    updatedAt: convertTimestamp(doc.updatedAt),
  } as Requirement;
}

/**
 * Convert Firestore document to ControlMapping type
 */
function docToMapping(doc: DocumentData, id: string): ControlMapping {
  return {
    ...doc,
    id,
    createdAt: convertTimestamp(doc.createdAt),
    updatedAt: convertTimestamp(doc.updatedAt),
  } as ControlMapping;
}

// ============================================================================
// Framework Service Class
// ============================================================================

/**
 * Service for regulatory framework operations
 */
export class FrameworkService {
  // ============================================================================
  // Framework CRUD Operations
  // ============================================================================

  /**
   * Get all available frameworks
   */
  static async getFrameworks(): Promise<RegulatoryFramework[]> {
    try {
      const q = query(
        collection(db, 'frameworks'),
        where('isActive', '==', true),
        orderBy('displayOrder', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => docToFramework(doc.data(), doc.id));
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.getFrameworks', {
        component: 'FrameworkService',
        action: 'getFrameworks',
      });
      throw error;
    }
  }

  /**
   * Get a framework by ID
   */
  static async getFramework(frameworkId: string): Promise<RegulatoryFramework | null> {
    try {
      const docRef = doc(db, 'frameworks', frameworkId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return docToFramework(docSnap.data(), docSnap.id);
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.getFramework', {
        component: 'FrameworkService',
        action: 'getFramework',
        metadata: { frameworkId },
      });
      throw error;
    }
  }

  /**
   * Subscribe to frameworks (real-time updates)
   */
  static subscribeToFrameworks(
    callback: (frameworks: RegulatoryFramework[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'frameworks'),
      where('isActive', '==', true),
      orderBy('displayOrder', 'asc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const frameworks = snapshot.docs.map((doc) =>
          docToFramework(doc.data(), doc.id)
        );
        callback(frameworks);
      },
      (error) => {
        ErrorLogger.error(error, 'FrameworkService.subscribeToFrameworks', {
          component: 'FrameworkService',
          action: 'subscribeToFrameworks',
        });
      }
    );
  }

  // ============================================================================
  // Requirement Operations
  // ============================================================================

  /**
   * Get all requirements for a framework
   */
  static async getRequirements(frameworkId: string): Promise<Requirement[]> {
    try {
      const q = query(
        collection(db, 'requirements'),
        where('frameworkId', '==', frameworkId),
        orderBy('order', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => docToRequirement(doc.data(), doc.id));
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.getRequirements', {
        component: 'FrameworkService',
        action: 'getRequirements',
        metadata: { frameworkId },
      });
      throw error;
    }
  }

  /**
   * Get requirements grouped by category
   */
  static async getRequirementsByCategory(
    frameworkId: string,
    locale: 'en' | 'fr' | 'de' = 'fr'
  ): Promise<RequirementsByCategory[]> {
    try {
      const requirements = await this.getRequirements(frameworkId);

      // Group by category
      const grouped = new Map<RequirementCategory, Requirement[]>();

      for (const req of requirements) {
        const existing = grouped.get(req.category) || [];
        existing.push(req);
        grouped.set(req.category, existing);
      }

      // Convert to array with labels
      const result: RequirementsByCategory[] = [];

      for (const [category, reqs] of grouped) {
        const labels = CATEGORY_LABELS[category];
        result.push({
          category,
          categoryLabel: labels?.[locale] || category,
          requirements: reqs,
          count: reqs.length,
        });
      }

      // Sort by first requirement's order in each category
      result.sort((a, b) => {
        const orderA = a.requirements[0]?.order || 0;
        const orderB = b.requirements[0]?.order || 0;
        return orderA - orderB;
      });

      return result;
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.getRequirementsByCategory', {
        component: 'FrameworkService',
        action: 'getRequirementsByCategory',
        metadata: { frameworkId, locale },
      });
      throw error;
    }
  }

  /**
   * Get a single requirement by ID
   */
  static async getRequirement(requirementId: string): Promise<Requirement | null> {
    try {
      const docRef = doc(db, 'requirements', requirementId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return docToRequirement(docSnap.data(), docSnap.id);
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.getRequirement', {
        component: 'FrameworkService',
        action: 'getRequirement',
        metadata: { requirementId },
      });
      throw error;
    }
  }

  /**
   * Subscribe to requirements for a framework (real-time updates)
   */
  static subscribeToRequirements(
    frameworkId: string,
    callback: (requirements: Requirement[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'requirements'),
      where('frameworkId', '==', frameworkId),
      orderBy('order', 'asc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const requirements = snapshot.docs.map((doc) =>
          docToRequirement(doc.data(), doc.id)
        );
        callback(requirements);
      },
      (error) => {
        ErrorLogger.error(error, 'FrameworkService.subscribeToRequirements', {
          component: 'FrameworkService',
          action: 'subscribeToRequirements',
          metadata: { frameworkId },
        });
      }
    );
  }

  // ============================================================================
  // Control Mapping Operations
  // ============================================================================

  /**
   * Get all mappings for a control (cross-framework)
   */
  static async getMappings(
    organizationId: string,
    controlId: string
  ): Promise<ControlMapping[]> {
    try {
      const q = query(
        collection(db, 'controlMappings'),
        where('organizationId', '==', organizationId),
        where('controlId', '==', controlId)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => docToMapping(doc.data(), doc.id));
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.getMappings', {
        component: 'FrameworkService',
        action: 'getMappings',
        metadata: { organizationId, controlId },
      });
      throw error;
    }
  }

  /**
   * Get all mappings for a requirement
   */
  static async getMappingsByRequirement(
    organizationId: string,
    requirementId: string
  ): Promise<ControlMapping[]> {
    try {
      const q = query(
        collection(db, 'controlMappings'),
        where('organizationId', '==', organizationId),
        where('requirementId', '==', requirementId)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => docToMapping(doc.data(), doc.id));
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.getMappingsByRequirement', {
        component: 'FrameworkService',
        action: 'getMappingsByRequirement',
        metadata: { organizationId, requirementId },
      });
      throw error;
    }
  }

  /**
   * Get all mappings for a framework
   */
  static async getMappingsByFramework(
    organizationId: string,
    frameworkId: string
  ): Promise<ControlMapping[]> {
    try {
      const q = query(
        collection(db, 'controlMappings'),
        where('organizationId', '==', organizationId),
        where('frameworkId', '==', frameworkId)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => docToMapping(doc.data(), doc.id));
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.getMappingsByFramework', {
        component: 'FrameworkService',
        action: 'getMappingsByFramework',
        metadata: { organizationId, frameworkId },
      });
      throw error;
    }
  }

  /**
   * Create a control mapping
   */
  static async createMapping(
    mapping: Omit<ControlMapping, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ControlMapping> {
    try {
      const mappingRef = doc(collection(db, 'controlMappings'));
      const now = new Date().toISOString();

      const newMapping: ControlMapping = {
        ...mapping,
        id: mappingRef.id,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(mappingRef, newMapping);
      return newMapping;
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.createMapping', {
        component: 'FrameworkService',
        action: 'createMapping',
        metadata: { controlId: mapping.controlId, requirementId: mapping.requirementId },
      });
      throw error;
    }
  }

  /**
   * Update a control mapping
   */
  static async updateMapping(
    mappingId: string,
    updates: Partial<Pick<ControlMapping, 'coveragePercentage' | 'coverageStatus' | 'notes' | 'isValidated'>>
  ): Promise<void> {
    try {
      const docRef = doc(db, 'controlMappings', mappingId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.updateMapping', {
        component: 'FrameworkService',
        action: 'updateMapping',
        metadata: { mappingId },
      });
      throw error;
    }
  }

  /**
   * Delete a control mapping
   */
  static async deleteMapping(mappingId: string): Promise<void> {
    try {
      const docRef = doc(db, 'controlMappings', mappingId);
      await deleteDoc(docRef);
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.deleteMapping', {
        component: 'FrameworkService',
        action: 'deleteMapping',
        metadata: { mappingId },
      });
      throw error;
    }
  }

  /**
   * Subscribe to mappings for a control (real-time updates)
   */
  static subscribeToMappings(
    organizationId: string,
    controlId: string,
    callback: (mappings: ControlMapping[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'controlMappings'),
      where('organizationId', '==', organizationId),
      where('controlId', '==', controlId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const mappings = snapshot.docs.map((doc) =>
          docToMapping(doc.data(), doc.id)
        );
        callback(mappings);
      },
      (error) => {
        ErrorLogger.error(error, 'FrameworkService.subscribeToMappings', {
          component: 'FrameworkService',
          action: 'subscribeToMappings',
          metadata: { organizationId, controlId },
        });
      }
    );
  }

  // ============================================================================
  // Active Framework Operations (Organization-specific)
  // ============================================================================

  /**
   * Get active frameworks for an organization
   */
  static async getActiveFrameworks(organizationId: string): Promise<ActiveFramework[]> {
    try {
      const q = query(
        collection(db, 'organizations', organizationId, 'activeFrameworks'),
        orderBy('activatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        ...doc.data(),
        frameworkId: doc.id,
      })) as ActiveFramework[];
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.getActiveFrameworks', {
        component: 'FrameworkService',
        action: 'getActiveFrameworks',
        organizationId,
      });
      throw error;
    }
  }

  /**
   * Activate a framework for an organization
   */
  static async activateFramework(
    organizationId: string,
    frameworkId: string,
    frameworkCode: RegulatoryFrameworkCode,
    userId: string,
    options?: {
      targetComplianceDate?: string;
      notes?: string;
    }
  ): Promise<ActiveFramework> {
    try {
      const docRef = doc(db, 'organizations', organizationId, 'activeFrameworks', frameworkId);
      const now = new Date().toISOString();

      const activeFramework: ActiveFramework = {
        frameworkId,
        frameworkCode,
        activatedAt: now,
        activatedBy: userId,
        targetComplianceDate: options?.targetComplianceDate,
        notes: options?.notes,
      };

      await setDoc(docRef, activeFramework);
      return activeFramework;
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.activateFramework', {
        component: 'FrameworkService',
        action: 'activateFramework',
        organizationId,
        metadata: { frameworkId, frameworkCode },
      });
      throw error;
    }
  }

  /**
   * Deactivate a framework for an organization
   */
  static async deactivateFramework(
    organizationId: string,
    frameworkId: string
  ): Promise<void> {
    try {
      const docRef = doc(db, 'organizations', organizationId, 'activeFrameworks', frameworkId);
      await deleteDoc(docRef);
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.deactivateFramework', {
        component: 'FrameworkService',
        action: 'deactivateFramework',
        organizationId,
        metadata: { frameworkId },
      });
      throw error;
    }
  }

  /**
   * Subscribe to active frameworks (real-time updates)
   */
  static subscribeToActiveFrameworks(
    organizationId: string,
    callback: (activeFrameworks: ActiveFramework[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'organizations', organizationId, 'activeFrameworks'),
      orderBy('activatedAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const activeFrameworks = snapshot.docs.map((doc) => ({
          ...doc.data(),
          frameworkId: doc.id,
        })) as ActiveFramework[];
        callback(activeFrameworks);
      },
      (error) => {
        ErrorLogger.error(error, 'FrameworkService.subscribeToActiveFrameworks', {
          component: 'FrameworkService',
          action: 'subscribeToActiveFrameworks',
          organizationId,
        });
      }
    );
  }

  // ============================================================================
  // Cross-Framework Analysis
  // ============================================================================

  /**
   * Get control with all its framework mappings
   */
  static async getControlWithMappings(
    organizationId: string,
    controlId: string,
    controlCode: string,
    controlName: string
  ): Promise<ControlWithMappings> {
    try {
      const mappings = await this.getMappings(organizationId, controlId);

      // Group mappings by framework
      const frameworkMap = new Map<string, {
        frameworkCode: RegulatoryFrameworkCode;
        coveragePercentage: number;
        count: number;
      }>();

      for (const mapping of mappings) {
        const existing = frameworkMap.get(mapping.frameworkId);
        if (existing) {
          existing.coveragePercentage = Math.max(existing.coveragePercentage, mapping.coveragePercentage);
          existing.count++;
        } else {
          frameworkMap.set(mapping.frameworkId, {
            frameworkCode: mapping.frameworkId.split('-')[0].toUpperCase() as RegulatoryFrameworkCode,
            coveragePercentage: mapping.coveragePercentage,
            count: 1,
          });
        }
      }

      return {
        controlId,
        controlCode,
        controlName,
        mappings: Array.from(frameworkMap.entries()).map(([frameworkId, data]) => ({
          frameworkId,
          frameworkCode: data.frameworkCode,
          coveragePercentage: data.coveragePercentage,
          requirementCount: data.count,
        })),
      };
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.getControlWithMappings', {
        component: 'FrameworkService',
        action: 'getControlWithMappings',
        organizationId,
        metadata: { controlId },
      });
      throw error;
    }
  }

  /**
   * Batch create mappings (for import or template application)
   */
  static async batchCreateMappings(
    mappings: Omit<ControlMapping, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<ControlMapping[]> {
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const createdMappings: ControlMapping[] = [];

      for (const mapping of mappings) {
        const mappingRef = doc(collection(db, 'controlMappings'));
        const newMapping: ControlMapping = {
          ...mapping,
          id: mappingRef.id,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(mappingRef, newMapping);
        createdMappings.push(newMapping);
      }

      await batch.commit();
      return createdMappings;
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.batchCreateMappings', {
        component: 'FrameworkService',
        action: 'batchCreateMappings',
        metadata: { count: mappings.length },
      });
      throw error;
    }
  }

  // ============================================================================
  // Framework Seeding (Admin only)
  // ============================================================================

  /**
   * Seed NIS2 framework data via Cloud Function
   * @returns Promise with seeding result
   */
  static async seedNIS2Framework(): Promise<{
    success: boolean;
    frameworkId: string;
    requirementCount: number;
    message: string;
  }> {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions(undefined, 'europe-west1');
      const seedFn = httpsCallable<unknown, {
        success: boolean;
        frameworkId: string;
        requirementCount: number;
        message: string;
      }>(functions, 'seedNIS2Framework');

      const result = await seedFn();
      return result.data;
    } catch (error) {
      ErrorLogger.error(error, 'FrameworkService.seedNIS2Framework', {
        component: 'FrameworkService',
        action: 'seedNIS2Framework',
      });
      throw error;
    }
  }
}
