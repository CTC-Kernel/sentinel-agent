import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, arrayRemove, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Control } from '../types';
import { ErrorLogger } from './errorLogger';

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

export class DocumentService {
    /**
     * Check all dependencies for a document across multiple collections
     */
    static async checkDependencies(
        documentId: string,
        organizationId: string,
        controls: Control[] = []
    ): Promise<DocumentDependencies> {
        try {
            // Find controls that use this document as evidence
            const linkedControls = controls.filter(c => c.evidenceIds?.includes(documentId));

            // Check dependencies in parallel across all collections
            const [suppliersSnap, bcpSnap, findingsSnap] = await Promise.all([
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

            const hasDependencies =
                linkedControls.length > 0 ||
                !suppliersSnap.empty ||
                !bcpSnap.empty ||
                !findingsSnap.empty;

            let message = "Cette action est définitive.";

            if (hasDependencies) {
                const deps = [
                    linkedControls.length > 0 ? `${linkedControls.length} contrôle(s)` : '',
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
                    }).catch(err => {
                        ErrorLogger.warn(`Failed to remove document from control ${docSnap.id}: ${err}`, 'DocumentService.deleteDocumentWithCascade');
                    })
                );
            });

            // Remove from Suppliers (set contractDocumentId to null)
            suppliersSnap.docs.forEach(docSnap => {
                cleanupPromises.push(
                    updateDoc(doc(db, 'suppliers', docSnap.id), {
                        contractDocumentId: null
                    }).catch(err => {
                        ErrorLogger.warn(`Failed to remove document from supplier ${docSnap.id}: ${err}`, 'DocumentService.deleteDocumentWithCascade');
                    })
                );
            });

            // Remove from BCP (set drpDocumentId to null)
            bcpSnap.docs.forEach(docSnap => {
                cleanupPromises.push(
                    updateDoc(doc(db, 'business_processes', docSnap.id), {
                        drpDocumentId: null
                    }).catch(err => {
                        ErrorLogger.warn(`Failed to remove document from BCP ${docSnap.id}: ${err}`, 'DocumentService.deleteDocumentWithCascade');
                    })
                );
            });

            // Remove from Findings (remove from evidenceIds array)
            findingsSnap.docs.forEach(docSnap => {
                cleanupPromises.push(
                    updateDoc(doc(db, 'findings', docSnap.id), {
                        evidenceIds: arrayRemove(documentId)
                    }).catch(err => {
                        ErrorLogger.warn(`Failed to remove document from finding ${docSnap.id}: ${err}`, 'DocumentService.deleteDocumentWithCascade');
                    })
                );
            });

            // Execute all cleanup operations in parallel
            await Promise.all(cleanupPromises);

            // Finally, delete the document itself
            try {
                await deleteDoc(doc(db, 'documents', documentId));
            } catch (err) {
                ErrorLogger.error(err, 'DocumentService.deleteDocumentWithCascade.finalDelete');
                throw err;
            }

        } catch (error) {
            ErrorLogger.error(error, 'DocumentService.deleteDocumentWithCascade');
            throw error;
        }
    }
}
