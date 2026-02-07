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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';
import {
  CMDBRelationship,
  RelationshipType,
  CIClass,
  RELATIONSHIP_INVERSES,
  VALID_RELATIONSHIPS,
  ConfigurationItem,
} from '@/types/cmdb';
import {
  createRelationshipSchema,
  updateRelationshipSchema,
  CreateRelationshipFormData,
  UpdateRelationshipFormData,
} from '@/schemas/cmdbSchema';
import { CMDBService } from './CMDBService';
import { ErrorLogger } from './errorLogger';

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
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('organizationId', '==', organizationId),
        where('sourceId', '==', sourceId),
        where('targetId', '==', targetId),
        where('relationshipType', '==', relationshipType)
      );

      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la verification de doublon');
      throw error;
    }
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
    try {
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
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        createdBy: userId,
      };

      try {
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

      // Audit logging
      await CMDBService.logActivity(organizationId, {
        type: 'create',
        message: `Relation "${relData.relationshipType}" créée entre ${sourceCI.name} et ${targetCI.name}`,
        ciId: relData.sourceId,
        ciName: sourceCI.name,
        userId,
        metadata: {
          relationshipId: docRef.id,
          targetCiId: relData.targetId,
          targetCiName: targetCI.name,
          relationshipType: relData.relationshipType,
        },
      });

      return docRef.id;
      } catch (error) {
        ErrorLogger.handleErrorWithToast(error, 'Erreur lors de l\'enregistrement Firestore de la relation');
        throw error;
      }
  
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la creation de la relation');
      throw error;
    }
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
    try {
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
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la recuperation de la relation');
      throw error;
    }
  }

  /**
   * Get all relationships for a CI
   */
  static async getRelationshipsForCI(
    organizationId: string,
    ciId: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): Promise<CMDBRelationship[]> {
    try {
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
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la recuperation des relations du CI');
      throw error;
    }
  }

  /**
   * Get dependent CIs (CIs that depend on the given CI)
   */
  static async getDependentCIs(
    organizationId: string,
    ciId: string
  ): Promise<{ ci: ConfigurationItem; relationship: CMDBRelationship }[]> {
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

    try {
      const snapshot = await getDocs(q);
      const results: { ci: ConfigurationItem; relationship: CMDBRelationship }[] = [];

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
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la recuperation des CI dependants');
      throw error;
    }
  }

  /**
   * Get upstream dependencies (CIs that this CI depends on)
   */
  static async getUpstreamDependencies(
    organizationId: string,
    ciId: string
  ): Promise<CMDBRelationship[]> {
    const dependencyTypes: RelationshipType[] = [
      'depends_on',
      'uses',
      'runs_on',
      'hosted_on',
      'installed_on',
    ];

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('organizationId', '==', organizationId),
        where('sourceId', '==', ciId),
        where('status', '==', 'Active')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as CMDBRelationship))
        .filter((rel) => dependencyTypes.includes(rel.relationshipType));
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la recuperation des dependances amont');
      throw error;
    }
  }

  /**
   * Get downstream dependents (CIs that depend on this CI)
   */
  static async getDownstreamDependents(
    organizationId: string,
    ciId: string
  ): Promise<CMDBRelationship[]> {
    const dependencyTypes: RelationshipType[] = [
      'depends_on',
      'uses',
      'runs_on',
      'hosted_on',
      'installed_on',
    ];

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('organizationId', '==', organizationId),
        where('targetId', '==', ciId),
        where('status', '==', 'Active')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as CMDBRelationship))
        .filter((rel) => dependencyTypes.includes(rel.relationshipType));
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la recuperation des dependances aval');
      throw error;
    }
  }

  /**
   * Get relationship graph for visualization
   */
  static async getRelationshipGraph(
    organizationId: string,
    rootCIId: string,
    depth: number = 2
  ): Promise<{ nodes: Set<string>; edges: CMDBRelationship[] }> {
    const nodes = new Set<string>([rootCIId]);
    const edges: CMDBRelationship[] = [];
    const visited = new Set<string>();
    const queue: { ciId: string; currentDepth: number }[] = [
      { ciId: rootCIId, currentDepth: 0 },
    ];

    while (queue.length > 0) {
      const { ciId, currentDepth } = queue.shift()!;

      if (visited.has(ciId) || currentDepth >= depth) continue;
      visited.add(ciId);

      // Get all relationships for this CI
      const rels = await this.getRelationshipsForCI(organizationId, ciId);

      for (const rel of rels) {
        edges.push(rel);
        const otherId = rel.sourceId === ciId ? rel.targetId : rel.sourceId;
        nodes.add(otherId);

        if (!visited.has(otherId)) {
          queue.push({ ciId: otherId, currentDepth: currentDepth + 1 });
        }
      }
    }

    return { nodes, edges };
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
    try {
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

      // Audit logging
      await CMDBService.logActivity(organizationId, {
        type: 'update',
        message: `Relation "${currentRel.relationshipType}" mise à jour`,
        ciId: currentRel.sourceId,
        userId,
        metadata: {
          relationshipId,
          changedFields: Object.keys(validated.data),
        },
      });
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la mise a jour de la relation');
      throw error;
    }
  }

  /**
   * Validate a pending relationship
   */
  static async validateRelationship(
    organizationId: string,
    relationshipId: string,
    userId: string
  ): Promise<void> {
    try {
      const currentRel = await this.getRelationship(organizationId, relationshipId);

      const docRef = doc(db, COLLECTION_NAME, relationshipId);
      await updateDoc(docRef, {
        status: 'Active',
        validatedBy: userId,
        validatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Audit logging
      if (currentRel) {
        await CMDBService.logActivity(organizationId, {
          type: 'approve',
          message: `Relation "${currentRel.relationshipType}" validée`,
          ciId: currentRel.sourceId,
          userId,
          metadata: {
            relationshipId,
            targetCiId: currentRel.targetId,
          },
        });
      }
  
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la mise a jour de la relation');
      throw error;
    }
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
    try {
      const currentRel = await this.getRelationship(organizationId, relationshipId);
      if (!currentRel) {
        throw new Error('Relationship not found');
      }

      const docRef = doc(db, COLLECTION_NAME, relationshipId);
      await deleteDoc(docRef);

      // Audit logging
      await CMDBService.logActivity(organizationId, {
        type: 'delete',
        message: `Relation "${currentRel.relationshipType}" supprimée`,
        ciId: currentRel.sourceId,
        userId,
        metadata: {
          relationshipId,
          targetCiId: currentRel.targetId,
        },
      });
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la suppression de la relation');
      throw error;
    }
  }

  /**
   * Delete all relationships for a CI (when CI is deleted)
   */
  static async deleteRelationshipsForCI(
    organizationId: string,
    ciId: string,
    userId: string
  ): Promise<number> {
    try {
      const relationships = await this.getRelationshipsForCI(organizationId, ciId, 'both');

      const batch = writeBatch(db);
      let count = 0;

      for (const rel of relationships) {
        batch.delete(doc(db, COLLECTION_NAME, rel.id));
        count++;
      }

      if (count > 0) {
        await batch.commit();

        // Audit logging
        await CMDBService.logActivity(organizationId, {
          type: 'delete',
          message: `${count} relation(s) supprimée(s) pour le CI`,
          ciId,
          userId,
          metadata: {
            deletedCount: count,
            relationshipIds: relationships.map((r) => r.id),
          },
        });
      }

      return count;
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la suppression des relations du CI');
      throw error;
    }
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
    try {
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
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, "Erreur lors de l'inference de la relation");
      throw error;
    }
  }
}
