/**
 * Relationship Service - Manages bidirectional entity relationships
 *
 * Ensures atomic synchronization of references between entities using
 * Firestore batch operations to prevent orphan references.
 *
 * @module relationshipService
 */

import { doc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';

/**
 * Relationship types supported by the service
 */
export type RelationshipType =
    | 'risk-control'
    | 'risk-asset'
    | 'risk-supplier'
    | 'risk-project'
    | 'risk-audit'
    | 'control-asset'
    | 'control-supplier'
    | 'control-audit'
    | 'audit-project'
    | 'audit-document'
    | 'incident-risk'
    | 'incident-asset'
    | 'supplier-incident';

/**
 * Configuration for each relationship type
 */
const RELATIONSHIP_CONFIG: Record<RelationshipType, {
    collection1: string;
    field1: string;
    collection2: string;
    field2: string;
}> = {
    'risk-control': {
        collection1: 'risks',
        field1: 'mitigationControlIds',
        collection2: 'controls',
        field2: 'relatedRiskIds'
    },
    'risk-asset': {
        collection1: 'risks',
        field1: 'assetId',
        collection2: 'assets',
        field2: 'relatedRiskIds'
    },
    'risk-supplier': {
        collection1: 'risks',
        field1: 'relatedSupplierIds',
        collection2: 'suppliers',
        field2: 'relatedRiskIds'
    },
    'risk-project': {
        collection1: 'risks',
        field1: 'relatedProjectIds',
        collection2: 'projects',
        field2: 'relatedRiskIds'
    },
    'risk-audit': {
        collection1: 'risks',
        field1: 'relatedAuditIds',
        collection2: 'audits',
        field2: 'relatedRiskIds'
    },
    'control-asset': {
        collection1: 'controls',
        field1: 'relatedAssetIds',
        collection2: 'assets',
        field2: 'relatedControlIds'
    },
    'control-supplier': {
        collection1: 'controls',
        field1: 'relatedSupplierIds',
        collection2: 'suppliers',
        field2: 'relatedControlIds'
    },
    'control-audit': {
        collection1: 'controls',
        field1: 'relatedAuditIds',
        collection2: 'audits',
        field2: 'relatedControlIds'
    },
    'audit-project': {
        collection1: 'audits',
        field1: 'relatedProjectIds',
        collection2: 'projects',
        field2: 'relatedAuditIds'
    },
    'audit-document': {
        collection1: 'audits',
        field1: 'relatedDocumentIds',
        collection2: 'documents',
        field2: 'relatedAuditIds'
    },
    'incident-risk': {
        collection1: 'incidents',
        field1: 'relatedRiskIds',
        collection2: 'risks',
        field2: 'sourceIncidentId'
    },
    'incident-asset': {
        collection1: 'incidents',
        field1: 'affectedAssetIds',
        collection2: 'assets',
        field2: 'relatedIncidentIds'
    },
    'supplier-incident': {
        collection1: 'suppliers',
        field1: 'relatedIncidentIds',
        collection2: 'supplier_incidents',
        field2: 'supplierId'
    }
};

export class RelationshipService {
    /**
     * Link two entities bidirectionally using atomic batch operation
     *
     * @param type - The relationship type
     * @param id1 - ID of the first entity
     * @param id2 - ID of the second entity
     * @throws Error if the batch operation fails
     *
     * @example
     * ```typescript
     * await RelationshipService.link('risk-control', riskId, controlId);
     * // Both Risk.mitigationControlIds and Control.relatedRiskIds are updated
     * ```
     */
    static async link(type: RelationshipType, id1: string, id2: string): Promise<void> {
        const config = RELATIONSHIP_CONFIG[type];
        if (!config) {
            throw new Error(`Unknown relationship type: ${type}`);
        }

        try {
            const batch = writeBatch(db);

            // Update first entity
            batch.update(doc(db, config.collection1, id1), {
                [config.field1]: arrayUnion(id2)
            });

            // Update second entity
            batch.update(doc(db, config.collection2, id2), {
                [config.field2]: arrayUnion(id1)
            });

            await batch.commit();
        } catch (error) {
            ErrorLogger.error(error, `RelationshipService.link.${type}`);
            throw error;
        }
    }

    /**
     * Unlink two entities bidirectionally using atomic batch operation
     *
     * @param type - The relationship type
     * @param id1 - ID of the first entity
     * @param id2 - ID of the second entity
     * @throws Error if the batch operation fails
     */
    static async unlink(type: RelationshipType, id1: string, id2: string): Promise<void> {
        const config = RELATIONSHIP_CONFIG[type];
        if (!config) {
            throw new Error(`Unknown relationship type: ${type}`);
        }

        try {
            const batch = writeBatch(db);

            // Remove from first entity
            batch.update(doc(db, config.collection1, id1), {
                [config.field1]: arrayRemove(id2)
            });

            // Remove from second entity
            batch.update(doc(db, config.collection2, id2), {
                [config.field2]: arrayRemove(id1)
            });

            await batch.commit();
        } catch (error) {
            ErrorLogger.error(error, `RelationshipService.unlink.${type}`);
            throw error;
        }
    }

    /**
     * Link multiple entities of the same type in a single batch
     *
     * @param type - The relationship type
     * @param id1 - ID of the primary entity
     * @param ids - Array of IDs to link
     * @throws Error if the batch operation fails
     *
     * @example
     * ```typescript
     * await RelationshipService.linkMany('risk-control', riskId, [ctrl1, ctrl2, ctrl3]);
     * ```
     */
    static async linkMany(type: RelationshipType, id1: string, ids: string[]): Promise<void> {
        if (ids.length === 0) return;

        const config = RELATIONSHIP_CONFIG[type];
        if (!config) {
            throw new Error(`Unknown relationship type: ${type}`);
        }

        try {
            // Firestore batch limit is 500 operations
            const BATCH_SIZE = 250; // 2 ops per link

            for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                const chunk = ids.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(db);

                // Update primary entity with all IDs
                batch.update(doc(db, config.collection1, id1), {
                    [config.field1]: arrayUnion(...chunk)
                });

                // Update each secondary entity
                for (const id2 of chunk) {
                    batch.update(doc(db, config.collection2, id2), {
                        [config.field2]: arrayUnion(id1)
                    });
                }

                await batch.commit();
            }
        } catch (error) {
            ErrorLogger.error(error, `RelationshipService.linkMany.${type}`);
            throw error;
        }
    }

    /**
     * Unlink multiple entities of the same type in a single batch
     *
     * @param type - The relationship type
     * @param id1 - ID of the primary entity
     * @param ids - Array of IDs to unlink
     */
    static async unlinkMany(type: RelationshipType, id1: string, ids: string[]): Promise<void> {
        if (ids.length === 0) return;

        const config = RELATIONSHIP_CONFIG[type];
        if (!config) {
            throw new Error(`Unknown relationship type: ${type}`);
        }

        try {
            const BATCH_SIZE = 250;

            for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                const chunk = ids.slice(i, i + BATCH_SIZE);
                const batch = writeBatch(db);

                // Remove all IDs from primary entity
                batch.update(doc(db, config.collection1, id1), {
                    [config.field1]: arrayRemove(...chunk)
                });

                // Remove primary ID from each secondary entity
                for (const id2 of chunk) {
                    batch.update(doc(db, config.collection2, id2), {
                        [config.field2]: arrayRemove(id1)
                    });
                }

                await batch.commit();
            }
        } catch (error) {
            ErrorLogger.error(error, `RelationshipService.unlinkMany.${type}`);
            throw error;
        }
    }

    /**
     * Sync relationships - adds new links and removes stale ones
     *
     * @param type - The relationship type
     * @param id1 - ID of the primary entity
     * @param currentIds - Current array of linked IDs
     * @param newIds - New array of IDs that should be linked
     */
    static async sync(
        type: RelationshipType,
        id1: string,
        currentIds: string[],
        newIds: string[]
    ): Promise<void> {
        const toAdd = newIds.filter(id => !currentIds.includes(id));
        const toRemove = currentIds.filter(id => !newIds.includes(id));

        // Execute in parallel for better performance
        await Promise.all([
            toAdd.length > 0 ? this.linkMany(type, id1, toAdd) : Promise.resolve(),
            toRemove.length > 0 ? this.unlinkMany(type, id1, toRemove) : Promise.resolve()
        ]);
    }

    /**
     * Cleanup all references to an entity before deletion
     *
     * @param collection - Collection name of the entity being deleted
     * @param entityId - ID of the entity being deleted
     * @param relationships - Array of relationship types to clean up
     *
     * @example
     * ```typescript
     * await RelationshipService.cleanupBeforeDelete('risks', riskId, [
     *     'risk-control',
     *     'risk-asset',
     *     'risk-supplier'
     * ]);
     * ```
     */
    static async cleanupBeforeDelete(
        collection: string,
        entityId: string,
        linkedIds: Record<string, string[]>
    ): Promise<void> {
        try {
            const batch = writeBatch(db);
            let opCount = 0;

            for (const [targetCollection, ids] of Object.entries(linkedIds)) {
                for (const targetId of ids) {
                    // Determine the correct field to remove from
                    const fieldToRemove = this.getBackReferenceField(collection, targetCollection);
                    if (fieldToRemove) {
                        batch.update(doc(db, targetCollection, targetId), {
                            [fieldToRemove]: arrayRemove(entityId)
                        });
                        opCount++;

                        // Commit and start new batch if approaching limit
                        if (opCount >= 490) {
                            await batch.commit();
                            opCount = 0;
                        }
                    }
                }
            }

            if (opCount > 0) {
                await batch.commit();
            }
        } catch (error) {
            ErrorLogger.error(error, 'RelationshipService.cleanupBeforeDelete');
            throw error;
        }
    }

    /**
     * Get the field name for back-reference based on collections
     */
    private static getBackReferenceField(sourceCollection: string, targetCollection: string): string | null {
        const fieldMap: Record<string, Record<string, string>> = {
            'risks': {
                'controls': 'relatedRiskIds',
                'assets': 'relatedRiskIds',
                'suppliers': 'relatedRiskIds',
                'projects': 'relatedRiskIds',
                'audits': 'relatedRiskIds'
            },
            'controls': {
                'risks': 'mitigationControlIds',
                'assets': 'relatedControlIds',
                'suppliers': 'relatedControlIds',
                'audits': 'relatedControlIds'
            },
            'audits': {
                'risks': 'relatedAuditIds',
                'controls': 'relatedAuditIds',
                'projects': 'relatedAuditIds',
                'documents': 'relatedAuditIds'
            },
            'assets': {
                'risks': 'assetId',
                'controls': 'relatedAssetIds',
                'incidents': 'affectedAssetIds'
            },
            'suppliers': {
                'risks': 'relatedSupplierIds',
                'controls': 'relatedSupplierIds'
            },
            'projects': {
                'risks': 'relatedProjectIds',
                'audits': 'relatedProjectIds'
            },
            'documents': {
                'audits': 'relatedDocumentIds'
            },
            'incidents': {
                'risks': 'relatedRiskIds',
                'assets': 'affectedAssetIds'
            }
        };

        return fieldMap[sourceCollection]?.[targetCollection] ?? null;
    }
}
