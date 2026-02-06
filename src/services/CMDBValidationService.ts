/**
 * CMDB Validation Service
 *
 * Service for managing the CMDB validation queue.
 * Handles pending CI validations, approvals, rejections, and merges.
 *
 * @module services/CMDBValidationService
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';
import {
  CMDBValidationItem,
  ConfigurationItem,
  CIClass,
} from '@/types/cmdb';
import { CMDBService } from './CMDBService';

const COLLECTION_NAME = 'cmdb_reconciliation_queue';

/**
 * CMDB Validation Service - Static methods for validation queue operations
 */
export class CMDBValidationService {
  /**
   * Get pending validation items
   */
  static async getPendingItems(
    organizationId: string,
    limitCount: number = 50
  ): Promise<CMDBValidationItem[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('organizationId', '==', organizationId),
      where('status', '==', 'Pending'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const items: CMDBValidationItem[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      items.push({
        id: docSnap.id,
        organizationId: data.organizationId,
        discoveredCI: data.discoveredCI,
        matchResult: data.matchResult,
        status: data.status,
        createdAt: data.createdAt?.toDate() || new Date(),
        processedAt: data.processedAt?.toDate(),
        processedBy: data.processedBy,
        resolution: data.resolution,
        notes: data.notes,
      });
    });

    return items;
  }

  /**
   * Get a single validation item by ID
   */
  static async getValidationItem(
    organizationId: string,
    itemId: string
  ): Promise<CMDBValidationItem | null> {
    const docRef = doc(db, COLLECTION_NAME, itemId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();

    // Security: Verify organization access
    if (data.organizationId !== organizationId) {
      throw new Error('Access denied: Item belongs to different organization');
    }

    return {
      id: docSnap.id,
      organizationId: data.organizationId,
      discoveredCI: data.discoveredCI,
      matchResult: data.matchResult,
      status: data.status,
      createdAt: data.createdAt?.toDate() || new Date(),
      processedAt: data.processedAt?.toDate(),
      processedBy: data.processedBy,
      resolution: data.resolution,
      notes: data.notes,
    };
  }

  /**
   * Add a new item to the validation queue
   */
  static async addToQueue(
    organizationId: string,
    discoveredCI: Partial<ConfigurationItem>,
    matchResult: CMDBValidationItem['matchResult']
  ): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      organizationId,
      discoveredCI,
      matchResult,
      status: 'Pending',
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  }

  /**
   * Approve a validation item - creates a new CI
   */
  static async approveItem(
    organizationId: string,
    itemId: string,
    userId: string,
    notes?: string
  ): Promise<string> {
    const item = await this.getValidationItem(organizationId, itemId);
    if (!item) {
      throw new Error('Validation item not found');
    }

    if (item.status !== 'Pending') {
      throw new Error('Item has already been processed');
    }

    // Create the new CI
    const ciData = {
      ciClass: (item.discoveredCI.ciClass || 'Hardware') as CIClass,
      ciType: item.discoveredCI.ciType || 'Unknown',
      name: item.discoveredCI.name || 'Unnamed CI',
      description: item.discoveredCI.description,
      status: 'In_Use' as const,
      environment: item.discoveredCI.environment || 'Production' as const,
      criticality: item.discoveredCI.criticality || 'Medium' as const,
      ownerId: userId,
      fingerprint: item.discoveredCI.fingerprint || {},
      discoverySource: item.discoveredCI.discoverySource || 'Manual' as const,
      attributes: item.discoveredCI.attributes || {},
    };

    const ciId = await CMDBService.createCI(organizationId, ciData, userId);

    // Update the validation item
    const docRef = doc(db, COLLECTION_NAME, itemId);
    await updateDoc(docRef, {
      status: 'Approved',
      processedAt: serverTimestamp(),
      processedBy: userId,
      resolution: { action: 'approve', createdCIId: ciId },
      notes,
    });

    // Log activity
    await CMDBService.logActivity(organizationId, {
      type: 'approve',
      message: `CI "${ciData.name}" approved from validation queue`,
      ciId,
      ciName: ciData.name,
      userId,
    });

    return ciId;
  }

  /**
   * Reject a validation item
   */
  static async rejectItem(
    organizationId: string,
    itemId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    const item = await this.getValidationItem(organizationId, itemId);
    if (!item) {
      throw new Error('Validation item not found');
    }

    if (item.status !== 'Pending') {
      throw new Error('Item has already been processed');
    }

    const docRef = doc(db, COLLECTION_NAME, itemId);
    await updateDoc(docRef, {
      status: 'Rejected',
      processedAt: serverTimestamp(),
      processedBy: userId,
      resolution: { action: 'reject', reason },
      notes: reason,
    });

    // Log activity
    await CMDBService.logActivity(organizationId, {
      type: 'reject',
      message: `CI "${item.discoveredCI.name}" rejected: ${reason}`,
      ciName: item.discoveredCI.name,
      userId,
    });
  }

  /**
   * Merge a validation item with an existing CI
   */
  static async mergeItem(
    organizationId: string,
    itemId: string,
    targetCIId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    const item = await this.getValidationItem(organizationId, itemId);
    if (!item) {
      throw new Error('Validation item not found');
    }

    if (item.status !== 'Pending') {
      throw new Error('Item has already been processed');
    }

    // Get target CI
    const targetCI = await CMDBService.getCI(organizationId, targetCIId);
    if (!targetCI) {
      throw new Error('Target CI not found');
    }

    // Merge discovered data with existing CI
    const mergeData: Partial<ConfigurationItem> = {};

    // Merge fingerprint (new data takes precedence for empty fields)
    if (item.discoveredCI.fingerprint) {
      const mergedFingerprint = { ...targetCI.fingerprint };
      Object.entries(item.discoveredCI.fingerprint).forEach(([key, value]) => {
        if (value && !mergedFingerprint[key as keyof typeof mergedFingerprint]) {
          (mergedFingerprint as Record<string, unknown>)[key] = value;
        }
      });
      mergeData.fingerprint = mergedFingerprint;
    }

    // Merge attributes
    if (item.discoveredCI.attributes) {
      mergeData.attributes = {
        ...targetCI.attributes,
        ...item.discoveredCI.attributes,
      };
    }

    // Update target CI
    await CMDBService.updateCI(organizationId, targetCIId, mergeData, userId);

    // Update validation item
    const docRef = doc(db, COLLECTION_NAME, itemId);
    await updateDoc(docRef, {
      status: 'Merged',
      processedAt: serverTimestamp(),
      processedBy: userId,
      resolution: { action: 'merge', targetCIId },
      notes,
    });

    // Log activity
    await CMDBService.logActivity(organizationId, {
      type: 'reconcile',
      message: `CI "${item.discoveredCI.name}" merged with "${targetCI.name}"`,
      ciId: targetCIId,
      ciName: targetCI.name,
      userId,
      metadata: { sourceName: item.discoveredCI.name },
    });
  }

  /**
   * Delete a validation item (hard delete)
   */
  static async deleteItem(
    organizationId: string,
    itemId: string
  ): Promise<void> {
    const item = await this.getValidationItem(organizationId, itemId);
    if (!item) {
      throw new Error('Validation item not found');
    }

    const docRef = doc(db, COLLECTION_NAME, itemId);
    await deleteDoc(docRef);
  }

  /**
   * Get pending count
   */
  static async getPendingCount(organizationId: string): Promise<number> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('organizationId', '==', organizationId),
      where('status', '==', 'Pending')
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  }
}
