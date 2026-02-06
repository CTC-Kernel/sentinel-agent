/**
 * CMDB Relationship Service
 *
 * Service for managing relationships between Configuration Items.
 * Handles relationship CRUD with validation and inverse management.
 *
 * @module services/CMDBRelationshipService
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
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { logAction } from '@/services/auditLogService';
import {
  CMDBRelationship,
  RelationshipType,
  CIClass,
  RELATIONSHIP_INVERSES,
  VALID_RELATIONSHIPS,
} from '@/types/cmdb';
import {
  createRelationshipSchema,
  updateRelationshipSchema,
  CreateRelationshipFormData,
  UpdateRelationshipFormData,
} from '@/schemas/cmdbSchema';
import { CMDBService } from './CMDBService';

const COLLECTION_NAME = 'cmdb_relationships';

/**
 * CMDB Relationship Service
 */
export class CMDBRelationshipService {
  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Validate that a relationship type is valid for the given CI classes
   */
  static isValidRelationship(
    sourceClass: CIClass,
    targetClass: CIClass,
    relationshipType: RelationshipType
  ): { valid: boolean; reason?: string } {
    const validTypes = VALID_RELATIONSHIPS[sourceClass];

    if (!validTypes.includes(relationshipType)) {
      return {
        valid: false,
        reason: `Relationship type '${relationshipType}' is not valid for source class '${sourceClass}'`,
      };
    }

    // Additional semantic validations
    if (relationshipType === 'runs_on' && targetClass !== 'Hardware') {
      return {
        valid: false,
        reason: `'runs_on' relationship target must be Hardware, got '${targetClass}'`,
      };
    }

    if (relationshipType === 'installed_on' && targetClass !== 'Hardware') {
      return {
        valid: false,
        reason: `'installed_on' relationship target must be Hardware, got '${targetClass}'`,
      };
    }

    return { valid: true };
  }

  /**
   * Check for duplicate relationship
   */
  static async checkDuplicate(
    organizationId: string,
    sourceId: string,
    targetId: string,
    relationshipType: RelationshipType
  ): Promise<boolean> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('organizationId', '==', organizationId),
      where('sourceId', '==', sourceId),
      where('targetId', '==', targetId),
      where('relationshipType', '==', relationshipType)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  // ===========================================================================
  // CREATE
  // ===========================================================================

  /**
   * Create a new relationship between CIs
   */
  static async createRelationship(
    organizationId: string,
    data: CreateRelationshipFormData,
    userId: string
  ): Promise<string> {
    // Validate input
    const validated = createRelationshipSchema.safeParse(data);
    if (!validated.success) {
      throw new Error(`Validation error: ${validated.error.message}`);
    }

    const relData = validated.data;

    // Verify CIs exist
    const [sourceCI, targetCI] = await Promise.all([
      CMDBService.getCI(organizationId, relData.sourceId),
      CMDBService.getCI(organizationId, relData.targetId),
    ]);

    if (!sourceCI) {
      throw new Error(`Source CI not found: ${relData.sourceId}`);
    }
    if (!targetCI) {
      throw new Error(`Target CI not found: ${relData.targetId}`);
    }

    // Validate relationship is semantically correct
    const validation = this.isValidRelationship(
      sourceCI.ciClass,
      targetCI.ciClass,
      relData.relationshipType
    );
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    // Check for duplicate
    const isDuplicate = await this.checkDuplicate(
      organizationId,
      relData.sourceId,
      relData.targetId,
      relData.relationshipType
    );
    if (isDuplicate) {
      throw new Error('Relationship already exists');
    }

    // Prepare relationship data
    const relationship: Omit<CMDBRelationship, 'id'> = {
      organizationId,
      sourceId: relData.sourceId,
      sourceCIClass: sourceCI.ciClass,
      targetId: relData.targetId,
      targetCIClass: targetCI.ciClass,
      relationshipType: relData.relationshipType,
      direction: relData.direction,
      inverseType: relData.inverseType,
      criticality: relData.criticality,
      status: relData.status,
      discoveredBy: relData.discoveredBy,
      confidence: relData.confidence,
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      createdBy: userId,
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), relationship);

    // Create inverse relationship if bidirectional
    if (relData.direction === 'bidirectional') {
      const inverseType = relData.inverseType || RELATIONSHIP_INVERSES[relData.relationshipType];
      if (inverseType) {
        const inverseRelationship: Omit<CMDBRelationship, 'id'> = {
          ...relationship,
          sourceId: relData.targetId,
          sourceCIClass: targetCI.ciClass,
          targetId: relData.sourceId,
          targetCIClass: sourceCI.ciClass,
          relationshipType: inverseType,
          inverseType: relData.relationshipType,
        };
        await addDoc(collection(db, COLLECTION_NAME), inverseRelationship);
      }
    }

    // Audit log
    await logAction({
      action: 'create',
      entityType: 'cmdb_relationship',
      entityId: docRef.id,
      userId,
      organizationId,
      after: { id: docRef.id, ...relationship },
      metadata: {
        sourceCI: sourceCI.name,
        targetCI: targetCI.name,
        relationshipType: relData.relationshipType,
      },
    });

    return docRef.id;
  }

  // ===========================================================================
  // READ
  // ===========================================================================

  /**
   * Get a relationship by ID
   */
  static async getRelationship(
    organizationId: string,
    relationshipId: string
  ): Promise<CMDBRelationship | null> {
    const docRef = doc(db, COLLECTION_NAME, relationshipId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    if (data.organizationId !== organizationId) {
      throw new Error('Access denied');
    }

    return { id: docSnap.id, ...data } as CMDBRelationship;
  }

  /**
   * Get all relationships for a CI
   */
  static async getRelationshipsForCI(
    organizationId: string,
    ciId: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): Promise<CMDBRelationship[]> {
    const relationships: CMDBRelationship[] = [];

    if (direction === 'outgoing' || direction === 'both') {
      const outgoingQuery = query(
        collection(db, COLLECTION_NAME),
        where('organizationId', '==', organizationId),
        where('sourceId', '==', ciId),
        where('status', '==', 'Active'),
        orderBy('relationshipType')
      );

      const outgoingSnapshot = await getDocs(outgoingQuery);
      outgoingSnapshot.forEach((docSnap) => {
        relationships.push({ id: docSnap.id, ...docSnap.data() } as CMDBRelationship);
      });
    }

    if (direction === 'incoming' || direction === 'both') {
      const incomingQuery = query(
        collection(db, COLLECTION_NAME),
        where('organizationId', '==', organizationId),
        where('targetId', '==', ciId),
        where('status', '==', 'Active'),
        orderBy('relationshipType')
      );

      const incomingSnapshot = await getDocs(incomingQuery);
      incomingSnapshot.forEach((docSnap) => {
        relationships.push({ id: docSnap.id, ...docSnap.data() } as CMDBRelationship);
      });
    }

    return relationships;
  }

  /**
   * Get dependent CIs (CIs that depend on the given CI)
   */
  static async getDependentCIs(
    organizationId: string,
    ciId: string
  ): Promise<{ ci: any; relationship: CMDBRelationship }[]> {
    const dependencyTypes: RelationshipType[] = [
      'depends_on',
      'uses',
      'runs_on',
      'hosted_on',
      'installed_on',
    ];

    const q = query(
      collection(db, COLLECTION_NAME),
      where('organizationId', '==', organizationId),
      where('targetId', '==', ciId),
      where('status', '==', 'Active')
    );

    const snapshot = await getDocs(q);
    const results: { ci: any; relationship: CMDBRelationship }[] = [];

    for (const docSnap of snapshot.docs) {
      const rel = { id: docSnap.id, ...docSnap.data() } as CMDBRelationship;

      if (dependencyTypes.includes(rel.relationshipType)) {
        const ci = await CMDBService.getCI(organizationId, rel.sourceId);
        if (ci) {
          results.push({ ci, relationship: rel });
        }
      }
    }

    return results;
  }

  // ===========================================================================
  // UPDATE
  // ===========================================================================

  /**
   * Update a relationship
   */
  static async updateRelationship(
    organizationId: string,
    relationshipId: string,
    updates: UpdateRelationshipFormData,
    userId: string
  ): Promise<void> {
    const currentRel = await this.getRelationship(organizationId, relationshipId);
    if (!currentRel) {
      throw new Error('Relationship not found');
    }

    const validated = updateRelationshipSchema.safeParse(updates);
    if (!validated.success) {
      throw new Error(`Validation error: ${validated.error.message}`);
    }

    const updateData = {
      ...validated.data,
      updatedAt: serverTimestamp(),
    };

    const docRef = doc(db, COLLECTION_NAME, relationshipId);
    await updateDoc(docRef, updateData);

    await logAction({
      action: 'update',
      entityType: 'cmdb_relationship',
      entityId: relationshipId,
      userId,
      organizationId,
      before: currentRel,
      after: { ...currentRel, ...updateData },
    });
  }

  /**
   * Validate a pending relationship
   */
  static async validateRelationship(
    organizationId: string,
    relationshipId: string,
    userId: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, relationshipId);
    await updateDoc(docRef, {
      status: 'Active',
      validatedBy: userId,
      validatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logAction({
      action: 'status_change',
      entityType: 'cmdb_relationship',
      entityId: relationshipId,
      userId,
      organizationId,
      metadata: { action: 'validate' },
    });
  }

  // ===========================================================================
  // DELETE
  // ===========================================================================

  /**
   * Delete a relationship
   */
  static async deleteRelationship(
    organizationId: string,
    relationshipId: string,
    userId: string
  ): Promise<void> {
    const currentRel = await this.getRelationship(organizationId, relationshipId);
    if (!currentRel) {
      throw new Error('Relationship not found');
    }

    const docRef = doc(db, COLLECTION_NAME, relationshipId);
    await deleteDoc(docRef);

    await logAction({
      action: 'delete',
      entityType: 'cmdb_relationship',
      entityId: relationshipId,
      userId,
      organizationId,
      before: currentRel,
    });
  }

  /**
   * Delete all relationships for a CI (when CI is deleted)
   */
  static async deleteRelationshipsForCI(
    organizationId: string,
    ciId: string,
    userId: string
  ): Promise<number> {
    const relationships = await this.getRelationshipsForCI(organizationId, ciId, 'both');

    const batch = writeBatch(db);
    let count = 0;

    for (const rel of relationships) {
      batch.delete(doc(db, COLLECTION_NAME, rel.id));
      count++;
    }

    if (count > 0) {
      await batch.commit();

      await logAction({
        action: 'delete',
        entityType: 'cmdb_relationship',
        entityId: ciId,
        userId,
        organizationId,
        metadata: { bulkDelete: true, count },
      });
    }

    return count;
  }

  // ===========================================================================
  // INFERENCE
  // ===========================================================================

  /**
   * Infer relationship from agent data (runs_on, connects_to)
   */
  static async inferRelationship(
    organizationId: string,
    sourceId: string,
    targetId: string,
    relationshipType: RelationshipType,
    confidence: number
  ): Promise<string | null> {
    // Check if relationship already exists
    const isDuplicate = await this.checkDuplicate(
      organizationId,
      sourceId,
      targetId,
      relationshipType
    );

    if (isDuplicate) {
      return null; // Skip if already exists
    }

    const [sourceCI, targetCI] = await Promise.all([
      CMDBService.getCI(organizationId, sourceId),
      CMDBService.getCI(organizationId, targetId),
    ]);

    if (!sourceCI || !targetCI) {
      return null;
    }

    const relData: CreateRelationshipFormData = {
      sourceId,
      sourceCIClass: sourceCI.ciClass,
      targetId,
      targetCIClass: targetCI.ciClass,
      relationshipType,
      direction: 'unidirectional',
      criticality: 'Medium',
      status: 'Pending_Validation',
      discoveredBy: 'Inference',
      confidence,
    };

    return this.createRelationship(organizationId, relData, 'system');
  }
}
