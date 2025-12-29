import { collection, query, where, getDocs, doc, writeBatch, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { } from '../types';
import { ErrorLogger } from './errorLogger';

export interface ProjectDependency {
    id: string;
    name: string;
    type: string;
}

export interface ProjectDependencies {
    hasDependencies: boolean;
    dependencies: ProjectDependency[];
}

export interface SyncProjectLinksOptions {
    projectId: string;
    relatedRiskIds?: string[];
    relatedControlIds?: string[];
    relatedAssetIds?: string[];
    relatedAuditIds?: string[];
    oldRiskIds?: string[];
    oldControlIds?: string[];
    oldAssetIds?: string[];
    oldAuditIds?: string[];
}

export class ProjectService {
    /**
     * Check dependencies for a project across risks, controls, assets, and audits
     */
    static async checkDependencies(
        projectId: string,
        organizationId: string
    ): Promise<ProjectDependencies> {
        try {
            const [rSnap, cSnap, aSnap, auSnap] = await Promise.all([
                getDocs(
                    query(
                        collection(db, 'risks'),
                        where('organizationId', '==', organizationId),
                        where('relatedProjectIds', 'array-contains', projectId),
                        limit(20)
                    )
                ),
                getDocs(
                    query(
                        collection(db, 'controls'),
                        where('organizationId', '==', organizationId),
                        where('relatedProjectIds', 'array-contains', projectId),
                        limit(20)
                    )
                ),
                getDocs(
                    query(
                        collection(db, 'assets'),
                        where('organizationId', '==', organizationId),
                        where('relatedProjectIds', 'array-contains', projectId),
                        limit(20)
                    )
                ),
                getDocs(
                    query(
                        collection(db, 'audits'),
                        where('organizationId', '==', organizationId),
                        where('relatedProjectIds', 'array-contains', projectId),
                        limit(20)
                    )
                )
            ]);

            const dependencies: ProjectDependency[] = [
                ...rSnap.docs.map(d => ({
                    id: d.id,
                    name: d.data().threat || 'Risque',
                    type: 'Risque'
                })),
                ...cSnap.docs.map(d => ({
                    id: d.id,
                    name: d.data().code || d.data().name || 'Contrôle',
                    type: 'Contrôle'
                })),
                ...aSnap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || 'Actif',
                    type: 'Actif'
                })),
                ...auSnap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || 'Audit',
                    type: 'Audit'
                }))
            ];

            return {
                hasDependencies: dependencies.length > 0,
                dependencies
            };
        } catch (error) {
            ErrorLogger.error(error, 'ProjectService.checkDependencies');
            throw error;
        }
    }

    /**
     * Delete project with cascade cleanup of relationships
     * Implements chunking to respect Firestore's 500 operations per batch limit
     */
    static async deleteProjectWithCascade(
        projectId: string,
        organizationId: string
    ): Promise<void> {
        try {
            const { hasDependencies, dependencies } = await this.checkDependencies(
                projectId,
                organizationId
            );

            const BATCH_SIZE = 499; // Reserve 1 slot for the delete operation

            if (hasDependencies && dependencies.length > 0) {
                // Collect all update operations
                const allUpdates: Array<{ collection: string; id: string }> = [];

                const riskDeps = dependencies.filter(d => d.type === 'Risque');
                allUpdates.push(...riskDeps.map(d => ({ collection: 'risks', id: d.id })));

                const controlDeps = dependencies.filter(d => d.type === 'Contrôle');
                allUpdates.push(...controlDeps.map(d => ({ collection: 'controls', id: d.id })));

                const assetDeps = dependencies.filter(d => d.type === 'Actif');
                allUpdates.push(...assetDeps.map(d => ({ collection: 'assets', id: d.id })));

                const auditDeps = dependencies.filter(d => d.type === 'Audit');
                allUpdates.push(...auditDeps.map(d => ({ collection: 'audits', id: d.id })));

                // Process in chunks of 499 (leaving room for final delete)
                for (let i = 0; i < allUpdates.length; i += BATCH_SIZE) {
                    const chunk = allUpdates.slice(i, i + BATCH_SIZE);
                    const batch = writeBatch(db);

                    chunk.forEach(({ collection, id }) => {
                        batch.update(doc(db, collection, id), {
                            relatedProjectIds: arrayRemove(projectId)
                        });
                    });

                    // Add delete operation only in the last batch
                    if (i + BATCH_SIZE >= allUpdates.length) {
                        batch.delete(doc(db, 'projects', projectId));
                    }

                    await batch.commit();
                }
            } else {
                // No dependencies, just delete the project
                const batch = writeBatch(db);
                batch.delete(doc(db, 'projects', projectId));
                await batch.commit();
            }
        } catch (error) {
            ErrorLogger.error(error, 'ProjectService.deleteProjectWithCascade');
            throw error;
        }
    }

    /**
     * Sync project links across related collections
     * Used during create/update to maintain bidirectional relationships
     */
    static syncProjectLinks(
        batch: ReturnType<typeof writeBatch>,
        options: SyncProjectLinksOptions
    ): void {
        const {
            projectId,
            relatedRiskIds = [],
            relatedControlIds = [],
            relatedAssetIds = [],
            relatedAuditIds = [],
            oldRiskIds = [],
            oldControlIds = [],
            oldAssetIds = [],
            oldAuditIds = []
        } = options;

        // Helper to sync a collection's links
        const syncLinks = (
            collectionName: string,
            newIds: string[],
            oldIds: string[]
        ) => {
            const added = newIds.filter(id => !oldIds.includes(id));
            const removed = oldIds.filter(id => !newIds.includes(id));

            added.forEach(id => {
                batch.update(doc(db, collectionName, id), {
                    relatedProjectIds: arrayUnion(projectId)
                });
            });

            removed.forEach(id => {
                batch.update(doc(db, collectionName, id), {
                    relatedProjectIds: arrayRemove(projectId)
                });
            });
        };

        syncLinks('risks', relatedRiskIds, oldRiskIds);
        syncLinks('controls', relatedControlIds, oldControlIds);
        syncLinks('assets', relatedAssetIds, oldAssetIds);
        syncLinks('audits', relatedAuditIds, oldAuditIds);
    }

    /**
     * Sync project links for new project creation
     */
    static syncNewProjectLinks(
        batch: ReturnType<typeof writeBatch>,
        projectId: string,
        relatedRiskIds?: string[],
        relatedControlIds?: string[],
        relatedAssetIds?: string[],
        relatedAuditIds?: string[]
    ): void {
        const syncNew = (collectionName: string, ids: string[]) => {
            ids.forEach(id => {
                batch.update(doc(db, collectionName, id), {
                    relatedProjectIds: arrayUnion(projectId)
                });
            });
        };

        if (relatedRiskIds) syncNew('risks', relatedRiskIds);
        if (relatedControlIds) syncNew('controls', relatedControlIds);
        if (relatedAssetIds) syncNew('assets', relatedAssetIds);
        if (relatedAuditIds) syncNew('audits', relatedAuditIds);
    }
}
