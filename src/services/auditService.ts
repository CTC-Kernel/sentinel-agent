import { collection, query, where, getDocs, deleteDoc, doc, writeBatch, arrayRemove, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Finding, AuditChecklist, Audit, UserProfile } from '../types';
import { ErrorLogger } from './errorLogger';

export interface AuditDetails {
    findings: Finding[];
    checklist: AuditChecklist | null;
}

export interface AuditDependency {
    id: string;
    name: string;
    type: string;
}

export interface AuditDependencies {
    hasDependencies: boolean;
    dependencies: AuditDependency[];
}

export interface DeleteAuditOptions {
    auditId: string;
    auditName: string;
    organizationId: string;
    userId: string;
    userEmail: string;
}

export class AuditService {
    /**
     * Fetch findings and checklist for a specific audit
     */
    static async getAuditDetails(
        auditId: string,
        organizationId: string
    ): Promise<AuditDetails> {
        try {
            const [findingsSnap, checklistSnap] = await Promise.all([
                getDocs(
                    query(
                        collection(db, 'findings'),
                        where('organizationId', '==', organizationId),
                        where('auditId', '==', auditId)
                    )
                ),
                getDocs(
                    query(
                        collection(db, 'audit_checklists'),
                        where('organizationId', '==', organizationId),
                        where('auditId', '==', auditId)
                    )
                )
            ]);

            const findings = findingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Finding));
            const checklist = checklistSnap.empty
                ? null
                : { id: checklistSnap.docs[0].id, ...checklistSnap.docs[0].data() } as AuditChecklist;

            return { findings, checklist };
        } catch (error) {
            ErrorLogger.error(error, 'AuditService.getAuditDetails');
            throw error;
        }
    }

    /**
     * Check for dependencies (projects linking to this audit)
     */
    static async checkDependencies(
        auditId: string,
        organizationId: string
    ): Promise<AuditDependencies> {
        try {
            // Projects have relatedAuditIds
            const projectsSnap = await getDocs(
                query(
                    collection(db, 'projects'),
                    where('organizationId', '==', organizationId),
                    where('relatedAuditIds', 'array-contains', auditId)
                )
            );

            const dependencies: AuditDependency[] = projectsSnap.docs.map(d => ({
                id: d.id,
                name: d.data().name || 'Projet',
                type: 'Projet'
            }));

            return {
                hasDependencies: dependencies.length > 0,
                dependencies
            };
        } catch (error) {
            ErrorLogger.error(error, 'AuditService.checkDependencies');
            throw error;
        }
    }

    /**
     * Delete audit with cascade deletion of findings and dependency cleanup
     * Uses atomic batch operations for consistency
     */
    static async deleteAuditWithCascade(options: DeleteAuditOptions): Promise<void> {
        const { auditId, organizationId } = options;

        try {
            // 1. Check dependencies
            const { hasDependencies, dependencies } = await this.checkDependencies(auditId, organizationId);

            // 2. Cleanup project dependencies
            if (hasDependencies && dependencies.length > 0) {
                const projectDeps = dependencies.filter(d => d.type === 'Projet');
                const cleanupPromises = projectDeps.map(dep =>
                    updateDoc(doc(db, 'projects', dep.id), {
                        relatedAuditIds: arrayRemove(auditId)
                    })
                );
                await Promise.all(cleanupPromises);
            }

            // 3. Cascade delete findings
            const findingsQ = query(
                collection(db, 'findings'),
                where('organizationId', '==', organizationId),
                where('auditId', '==', auditId)
            );
            const findingsSnap = await getDocs(findingsQ);
            const findingsDeletions = findingsSnap.docs.map(d =>
                deleteDoc(doc(db, 'findings', d.id))
            );
            await Promise.all(findingsDeletions);

            // 4. Delete the audit itself
            await deleteDoc(doc(db, 'audits', auditId));

        } catch (error) {
            ErrorLogger.error(error, 'AuditService.deleteAuditWithCascade');
            throw error;
        }
    }

    /**
     * Batch create audits (used for AI-generated audit plans)
     */
    static async batchCreateAudits(
        audits: Partial<Audit>[],
        organizationId: string,
        defaultAuditor: string
    ): Promise<void> {
        try {
            const batch = writeBatch(db);
            const now = new Date().toISOString();

            audits.forEach(auditData => {
                const newAuditRef = doc(collection(db, 'audits'));
                batch.set(newAuditRef, {
                    ...auditData,
                    organizationId,
                    status: 'Planifié',
                    findingsCount: 0,
                    createdAt: now,
                    updatedAt: now,
                    auditor: auditData.auditor || defaultAuditor,
                    relatedProjectIds: auditData.relatedProjectIds || [],
                    relatedControlIds: auditData.relatedControlIds || []
                });
            });

            await batch.commit();
        } catch (error) {
            ErrorLogger.error(error, 'AuditService.batchCreateAudits');
            throw error;
        }
    }
}
