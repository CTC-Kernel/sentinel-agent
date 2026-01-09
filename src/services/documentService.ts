import { collection, doc, writeBatch, getDocs, query, where, arrayRemove, limit, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FunctionsService } from './FunctionsService';
import { Control } from '../types';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';

export interface DocumentDependencies {
    hasDependencies: boolean;
    linkedControls: Control[];
    suppliersCount: number;
    bcpCount: number;
    findingsCount: number;
    message: string;
}

export interface DeleteDocumentOptions {
    documentId: string;
    documentTitle: string;
    organizationId: string;
    userId: string;
    userEmail: string;
}

type DocumentCsvRow = Record<string, string>;

export class DocumentService {
    /**
     * Check all dependencies for a document across multiple collections
     */
    static async checkDependencies(
        documentId: string,
        organizationId: string
    ): Promise<DocumentDependencies> {
        try {
            // Check dependencies in parallel across all collections
            const [linkedControlsSnap, suppliersSnap, bcpSnap, findingsSnap] = await Promise.all([
                getDocs(
                    query(
                        collection(db, 'controls'),
                        where('organizationId', '==', organizationId),
                        where('evidenceIds', 'array-contains', documentId)
                    )
                ),
                getDocs(
                    query(
                        collection(db, 'suppliers'),
                        where('organizationId', '==', organizationId),
                        where('contractDocumentId', '==', documentId),
                        limit(50)
                    )
                ),
                getDocs(
                    query(
                        collection(db, 'business_processes'),
                        where('organizationId', '==', organizationId),
                        where('drpDocumentId', '==', documentId),
                        limit(50)
                    )
                ),
                getDocs(
                    query(
                        collection(db, 'findings'),
                        where('organizationId', '==', organizationId),
                        where('evidenceIds', 'array-contains', documentId),
                        limit(50)
                    )
                )
            ]);

            const linkedControls = linkedControlsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Control));

            const hasDependencies =
                !linkedControlsSnap.empty ||
                !suppliersSnap.empty ||
                !bcpSnap.empty ||
                !findingsSnap.empty;

            let message = "Cette action est définitive.";

            if (hasDependencies) {
                const deps = [
                    !linkedControlsSnap.empty ? `${linkedControlsSnap.size} contrôle(s)` : '',
                    !suppliersSnap.empty ? `${suppliersSnap.size} fournisseur(s)` : '',
                    !bcpSnap.empty ? `${bcpSnap.size} processus` : '',
                    !findingsSnap.empty ? `${findingsSnap.size} constat(s)` : ''
                ].filter(Boolean).join(', ');

                message = `Document utilisé dans : ${deps}. La suppression le retirera de ces éléments.`;
            }

            return {
                hasDependencies,
                linkedControls,
                suppliersCount: suppliersSnap.size,
                bcpCount: bcpSnap.size,
                findingsCount: findingsSnap.size,
                message
            };
        } catch (error) {
            ErrorLogger.error(error, 'DocumentService.checkDependencies');
            throw error;
        }
    }

    /**
     * Delete document with cascade cleanup of all dependencies
     * This ensures referential integrity across the system
     */
    static async deleteDocumentWithCascade(options: DeleteDocumentOptions): Promise<void> {
        const { documentId, organizationId } = options;

        try {
            // Re-query dependencies to ensure consistency during atomic delete phase
            const [controlsSnap, suppliersSnap, bcpSnap, findingsSnap] = await Promise.all([
                getDocs(
                    query(
                        collection(db, 'controls'),
                        where('organizationId', '==', organizationId),
                        where('evidenceIds', 'array-contains', documentId),
                        limit(50)
                    )
                ),
                getDocs(
                    query(
                        collection(db, 'suppliers'),
                        where('organizationId', '==', organizationId),
                        where('contractDocumentId', '==', documentId),
                        limit(50)
                    )
                ),
                getDocs(
                    query(
                        collection(db, 'business_processes'),
                        where('organizationId', '==', organizationId),
                        where('drpDocumentId', '==', documentId),
                        limit(50)
                    )
                ),
                getDocs(
                    query(
                        collection(db, 'findings'),
                        where('organizationId', '==', organizationId),
                        where('evidenceIds', 'array-contains', documentId),
                        limit(50)
                    )
                )
            ]);

            const cleanupPromises: Promise<void>[] = [];

            // Remove from Controls (remove from evidenceIds array)
            controlsSnap.docs.forEach(docSnap => {
                cleanupPromises.push(
                    updateDoc(doc(db, 'controls', docSnap.id), {
                        evidenceIds: arrayRemove(documentId)
                    }).catch((err: unknown) => {
                        ErrorLogger.warn(`Failed to remove document from control ${docSnap.id}: ${String(err)}`, 'DocumentService.deleteDocumentWithCascade');
                    })
                );
            });

            // Remove from Suppliers (set contractDocumentId to null)
            suppliersSnap.docs.forEach(docSnap => {
                cleanupPromises.push(
                    updateDoc(doc(db, 'suppliers', docSnap.id), {
                        contractDocumentId: null
                    }).catch((err: unknown) => {
                        ErrorLogger.warn(`Failed to remove document from supplier ${docSnap.id}: ${String(err)}`, 'DocumentService.deleteDocumentWithCascade');
                    })
                );
            });

            // Remove from BCP (set drpDocumentId to null)
            bcpSnap.docs.forEach(docSnap => {
                cleanupPromises.push(
                    updateDoc(doc(db, 'business_processes', docSnap.id), {
                        drpDocumentId: null
                    }).catch((err: unknown) => {
                        ErrorLogger.warn(`Failed to remove document from BCP ${docSnap.id}: ${String(err)}`, 'DocumentService.deleteDocumentWithCascade');
                    })
                );
            });

            // Remove from Findings (remove from evidenceIds array)
            findingsSnap.docs.forEach(docSnap => {
                cleanupPromises.push(
                    updateDoc(doc(db, 'findings', docSnap.id), {
                        evidenceIds: arrayRemove(documentId)
                    }).catch((err: unknown) => {
                        ErrorLogger.warn(`Failed to remove document from finding ${docSnap.id}: ${String(err)}`, 'DocumentService.deleteDocumentWithCascade');
                    })
                );
            });

            // Execute all cleanup operations in parallel
            await Promise.all(cleanupPromises);

            // Finally, delete the document itself (Server-side permission check)
            try {
                await FunctionsService.deleteResource('documents', documentId);
            } catch (err) {
                ErrorLogger.error(err, 'DocumentService.deleteDocumentWithCascade.finalDelete');
                throw err;
            }

        } catch (error) {
            ErrorLogger.error(error, 'DocumentService.deleteDocumentWithCascade');
            throw error;
        }
    }
    /**
     * Import documents from CSV data
     */
    static async importDocumentsFromCSV(
        data: DocumentCsvRow[],
        organizationId: string,
        userId: string,
        userDisplayName: string
    ): Promise<number> {
        try {
            const batch = writeBatch(db);
            let count = 0;

            for (const row of data) {
                if (!row.Titre) continue;

                const newRef = doc(collection(db, 'documents'));
                const docData = {
                    organizationId,
                    title: row.Titre,
                    type: row.Type || 'Autre',
                    version: row.Version || '1.0',
                    status: row.Statut || 'Brouillon',
                    owner: row.Proprietaire || userDisplayName,
                    ownerId: userId, // Default to importer if not specified or mapped
                    nextReviewDate: row.Prochaine_Revue ? new Date(row.Prochaine_Revue).toISOString() : null,
                    description: row.Description || '',
                    url: row.URL || '',
                    isSecure: false,
                    watermarkEnabled: false,
                    reviewers: [],
                    approvers: [],
                    readBy: [],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                const sanitized = sanitizeData(docData);
                batch.set(newRef, sanitized);
                count++;
            }

            if (count > 0) {
                await batch.commit();
            }

            return count;
        } catch (error) {
            ErrorLogger.error(error, 'DocumentService.importDocumentsFromCSV');
            throw error;
        }
    }
}
