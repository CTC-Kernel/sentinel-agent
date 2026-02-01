import { db } from '../firebase';
import { FunctionsService } from './FunctionsService';
import { SupplierDoraSyncService } from './SupplierDoraSyncService';
import { AuditLogService } from './auditLogService';
import { Supplier, SupplierQuestionnaireResponse, QuestionnaireTemplate, Criticality } from '../types';
import { doc, updateDoc, addDoc, collection, query, where, getDocs, deleteDoc, writeBatch, serverTimestamp, getDoc, limit } from 'firebase/firestore';
import { sanitizeData } from '../utils/dataSanitizer';
import { ErrorLogger } from './errorLogger';

export class SupplierService {

    /**
     * Calculates the score of a questionnaire response based on the template weights.
     */
    static calculateScore(response: SupplierQuestionnaireResponse, template: QuestionnaireTemplate): { overallScore: number, sectionScores: Record<string, number> } {
        let totalWeightedScore = 0;
        let totalWeight = 0;
        const sectionScores: Record<string, number> = {};

        template.sections.forEach(section => {
            let sectionScore = 0;
            let sectionMaxScore = 0;

            section.questions.forEach(q => {
                const answer = response.answers[q.id];
                if (!answer) return;

                const weight = q.weight || 1;
                sectionMaxScore += (100 * weight); // Normalize max score per question to 100 * weight

                // Scoring Logic based on type
                let questionScore = 0;
                if (q.type === 'yes_no') {
                    if (answer.value === true || answer.value === 'true' || answer.value === 'yes') {
                        questionScore = 100;
                    }
                } else if (q.type === 'rating') {
                    // Assuming rating is 1-5 or 1-10, normalize to 100
                    const val = Number(answer.value);
                    if (!isNaN(val)) {
                        questionScore = (val / 5) * 100; // Default to 5 star scale
                    }
                } else if (q.type === 'multiple_choice') {
                    // For multiple choice, we check if a valid selection was made.
                    // Future enhancement: Add 'correctOptions' or 'scorePerOption' in QuestionnaireTemplate for granular scoring.
                    // Currently, any non-empty selection is considered a 'completed' answer (100%).
                    const val = answer.value;
                    if (Array.isArray(val)) {
                        if (val.length > 0) questionScore = 100;
                    } else if (val && String(val).trim() !== '') {
                        questionScore = 100;
                    }
                }

                sectionScore += (questionScore * weight);
            });

            // Section Result (0-100)
            const normalizedSectionScore = sectionMaxScore > 0 ? (sectionScore / sectionMaxScore) * 100 : 0;
            sectionScores[section.id] = Math.round(normalizedSectionScore);

            totalWeightedScore += (normalizedSectionScore * (section.weight || 1));
            totalWeight += (section.weight || 1);
        });

        const overallScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
        return { overallScore, sectionScores };
    }

    /**
     * Get a single supplier by ID with organization validation
     * @param supplierId - The supplier ID
     * @param organizationId - The organization ID (required for security)
     * @returns The supplier if found and belongs to the organization, null otherwise
     */
    static async getById(supplierId: string, organizationId: string): Promise<Supplier | null> {
        if (!organizationId) {
            ErrorLogger.error(new Error('organizationId is required for security'), 'SupplierService.getById');
            throw new Error('organizationId is required');
        }
        try {
            const supplierDoc = await getDoc(doc(db, 'suppliers', supplierId));
            if (supplierDoc.exists()) {
                const supplier = supplierDoc.data() as Supplier;
                // Security: Verify supplier belongs to the requesting organization
                if (supplier.organizationId !== organizationId) {
                    ErrorLogger.warn(`Access denied: Supplier ${supplierId} does not belong to organization ${organizationId}`, 'SupplierService.getById');
                    return null;
                }
                return { id: supplierDoc.id, ...supplierDoc.data() } as Supplier;
            }
            return null;
        } catch (error) {
            ErrorLogger.error(error, 'SupplierService.getById');
            throw error;
        }
    }

    /**
     * Get all suppliers for an organization
     */
    static async getAll(organizationId: string): Promise<Supplier[]> {
        try {
            const q = query(
                collection(db, 'suppliers'),
                where('organizationId', '==', organizationId),
                limit(1000)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.data() as Supplier);
        } catch (error) {
            ErrorLogger.error(error, 'SupplierService.getAll');
            throw error;
        }
    }

    /**
     * Updates the supplier's risk level based on the assessment score.
     */
    static async updateSupplierRiskFromAssessment(
        supplierId: string,
        assessmentScore: number,
        user: { uid: string; email: string; organizationId?: string; displayName?: string }
    ): Promise<void> {
        try {
            const supplierRef = doc(db, 'suppliers', supplierId);
            const supplierDoc = await getDoc(supplierRef);

            // IDOR protection: verify supplier belongs to user's organization
            if (!supplierDoc.exists() || supplierDoc.data()?.organizationId !== user.organizationId) {
                throw new Error('Access denied: supplier does not belong to your organization');
            }

            const oldRiskLevel = supplierDoc.data()?.riskLevel || 'Unknown';

            let riskLevel: Supplier['riskLevel'] = 'Low';
            if (assessmentScore < 50) riskLevel = 'Critical';
            else if (assessmentScore < 70) riskLevel = 'High';
            else if (assessmentScore < 85) riskLevel = 'Medium';

            await updateDoc(supplierRef, sanitizeData({
                securityScore: assessmentScore,
                riskLevel: riskLevel,
                updatedAt: serverTimestamp()
            }));

            // Audit Log
            if (user?.organizationId) {
                await AuditLogService.logStatusChange(
                    user.organizationId,
                    { id: user.uid, name: user.displayName || user.email, email: user.email },
                    'supplier',
                    supplierId,
                    supplierDoc.exists() ? (supplierDoc.data()?.name || 'Supplier') : 'Supplier',
                    oldRiskLevel,
                    riskLevel
                );
            }
        } catch (error) {
            ErrorLogger.error(error, 'SupplierService.updateSupplierRiskFromAssessment');
            throw error;
        }
    }

    /**
     * Creates a new empty assessment response for a supplier.
     */
    static async createAssessment(
        organizationId: string,
        supplierId: string,
        supplierName: string,
        template: QuestionnaireTemplate,
        user: { uid: string; email: string; displayName?: string }
    ): Promise<string> {
        try {
            const newResponse = {
                organizationId,
                supplierId,
                supplierName,
                templateId: template.id,
                status: 'Draft' as const,
                answers: {},
                overallScore: 0,
                sentDate: serverTimestamp()
            };

            const res = await addDoc(collection(db, 'questionnaire_responses'), sanitizeData(newResponse));

            // Audit Log
            await AuditLogService.logCreate(
                organizationId,
                { id: user.uid, name: user.displayName || user.email, email: user.email },
                'audit', // Using 'audit' as entity type (mapped to existing types) or 'document'
                res.id,
                { ...newResponse, id: res.id },
                `Assessment for ${supplierName}`
            );

            return res.id;
        } catch (error) {
            ErrorLogger.error(error, 'SupplierService.createAssessment');
            throw error;
        }
    }

    /**
     * Check dependencies for a supplier across controls and risks
     */
    static async checkDependencies(
        supplierId: string,
        organizationId: string
    ): Promise<{ controls: number; risks: number; details: string }> {
        try {
            const controlQuery = query(
                collection(db, 'controls'),
                where('organizationId', '==', organizationId),
                where('relatedSupplierIds', 'array-contains', supplierId)
            );
            const riskQuery = query(
                collection(db, 'risks'),
                where('organizationId', '==', organizationId),
                where('relatedSupplierIds', 'array-contains', supplierId)
            );

            const [controlsSnap, risksSnap] = await Promise.all([
                getDocs(controlQuery),
                getDocs(riskQuery)
            ]);

            const controlNames = controlsSnap.docs.slice(0, 3).map(d => d.data().code).join(', ');
            const riskNames = risksSnap.docs.slice(0, 3).map(d => d.data().threat || 'Risque').join(', ');

            let details = "";
            if (!controlsSnap.empty) details += `\n- ${controlsSnap.size} contrôle(s) (${controlNames}...)`;
            if (!risksSnap.empty) details += `\n- ${risksSnap.size} risque(s) (${riskNames}...)`;

            return {
                controls: controlsSnap.size,
                risks: risksSnap.size,
                details
            };
        } catch (error) {
            ErrorLogger.error(error, 'SupplierService.checkDependencies');
            throw error;
        }
    }

    static async deleteSupplierWithCascade(
        supplierId: string,
        user: { uid: string; email: string; organizationId?: string; displayName?: string }
    ): Promise<void> {
        if (!user.organizationId) throw new Error("Organization ID required");

        try {
            // Fetch name for log
            const supplierDoc = await getDoc(doc(db, 'suppliers', supplierId));
            const supplierName = supplierDoc.exists() ? supplierDoc.data()?.name : supplierId;

            // 1. Attempt Secure Deletion (Blocks if dependencies exist in Risks/Controls/Projects)
            // This replaces the old behavior of automatically unlinking (arrayRemove), which is unsafe for Audit.
            await FunctionsService.deleteResource('suppliers', supplierId);

            // 2. If successful, clean up "owned" child resources (Assessments, Incidents)
            // These are not "dependencies" but sub-resources, so we delete them to avoid orphans.
            const assessmentsQuery = query(
                collection(db, 'supplierAssessments'),
                where('organizationId', '==', user.organizationId),
                where('supplierId', '==', supplierId)
            );
            const assessmentsSnap = await getDocs(assessmentsQuery);
            const deleteAssessments = assessmentsSnap.docs.map(d =>
                deleteDoc(d.ref).catch(err => {
                    ErrorLogger.warn(`Failed to delete assessment ${d.id}: ${err}`, 'SupplierService.deleteSupplierWithCascade');
                })
            );

            const incidentsQuery = query(
                collection(db, 'supplierIncidents'),
                where('organizationId', '==', user.organizationId),
                where('supplierId', '==', supplierId)
            );
            const incidentsSnap = await getDocs(incidentsQuery);
            const deleteIncidents = incidentsSnap.docs.map(d =>
                deleteDoc(d.ref).catch(err => {
                    ErrorLogger.warn(`Failed to delete incident ${d.id}: ${err}`, 'SupplierService.deleteSupplierWithCascade');
                })
            );

            await Promise.all([...deleteAssessments, ...deleteIncidents]);

            // Audit Log
            await AuditLogService.logDelete(
                user.organizationId,
                { id: user.uid, name: user.displayName || user.email, email: user.email },
                'supplier',
                supplierId,
                { name: supplierName, deletedAt: new Date() },
                supplierName || 'Unknown Supplier'
            );

        } catch (error) {
            ErrorLogger.error(error, 'SupplierService.deleteSupplierWithCascade');
            throw error;
        }
    }

    /**
     * Batch import suppliers from CSV data
     */
    static async importSuppliersFromCSV(
        lines: Record<string, string>[],
        organizationId: string,
        userId: string,
        userDisplayName?: string
    ): Promise<number> {
        try {
            const BATCH_SIZE = 450;
            let batch = writeBatch(db);
            let count = 0;
            let batchCount = 0;

            for (const row of lines) {
                const values = Object.values(row) as string[];
                const name = row['Nom'] || row['Name'] || values[0] || 'Inconnu';
                const category = row['Catégorie'] || row['Category'] || values[1] || 'Autre';
                const criticality = row['Criticité'] || row['Criticality'] || values[2] || 'Moyenne';
                const contactName = row['Contact'] || row['ContactName'] || values[3] || '';
                const contactEmail = row['Email'] || row['ContactEmail'] || values[4] || '';

                if (name) {
                    const newRef = doc(collection(db, 'suppliers'));
                    const newSupplierData = {
                        organizationId,
                        name: name.trim(),
                        category: (category.trim() || 'Autre') as Supplier['category'],
                        criticality: (criticality.trim() || 'Moyenne') as Criticality,
                        contactName: contactName.trim(),
                        contactEmail: contactEmail.trim(),
                        status: 'Actif' as const,
                        securityScore: 0,
                        assessment: {
                            hasIso27001: false,
                            hasGdprPolicy: false,
                            hasEncryption: false,
                            hasBcp: false,
                            hasIncidentProcess: false,
                            lastAssessmentDate: serverTimestamp()
                        },
                        isICTProvider: false,
                        supportsCriticalFunction: false,
                        doraCriticality: 'Aucun' as const,
                        owner: userDisplayName || 'Importé',
                        ownerId: userId,
                        createdAt: serverTimestamp()
                    };
                    batch.set(newRef, sanitizeData(newSupplierData));
                    count++;
                    batchCount++;

                    if (batchCount >= BATCH_SIZE) {
                        await batch.commit();
                        batch = writeBatch(db);
                        batchCount = 0;
                    }
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }

            // Audit Log
            await AuditLogService.logImport(
                organizationId,
                { id: userId, name: userDisplayName || 'Unknown', email: 'batch-import' }, // approximate user info if not full profile
                'supplier',
                count,
                'CSV'
            );

            return count;
        } catch (error) {
            ErrorLogger.error(error, 'SupplierService.importSuppliersFromCSV');
            throw error;
        }
    }

    /**
     * Sync supplier to ICT Provider if marked as ICT Provider
     * @param supplierId - The supplier ID to sync
     * @param organizationId - The organization ID (required for security)
     * @returns Promise<boolean> - True if sync was performed
     */
    static async syncToICTProvider(supplierId: string, organizationId: string): Promise<boolean> {
        try {
            return await SupplierDoraSyncService.syncSupplierToICTProvider(supplierId, organizationId);
        } catch (error) {
            ErrorLogger.error(error, 'SupplierService.syncToICTProvider');
            throw error;
        }
    }

    /**
     * Remove ICT Provider status from supplier
     * @param supplierId - The supplier ID
     * @param organizationId - The organization ID (required for security)
     */
    static async removeICTProviderStatus(supplierId: string, organizationId: string): Promise<void> {
        try {
            await SupplierDoraSyncService.removeICTProviderStatus(supplierId, organizationId);
        } catch (error) {
            ErrorLogger.error(error, 'SupplierService.removeICTProviderStatus');
            throw error;
        }
    }

    /**
     * Sync all ICT suppliers for an organization
     * @param organizationId - The organization ID
     * @returns Promise<number> - Number of suppliers synced
     */
    static async syncAllICTSuppliers(organizationId: string): Promise<number> {
        try {
            return await SupplierDoraSyncService.syncAllICTSuppliers(organizationId);
        } catch (error) {
            ErrorLogger.error(error, 'SupplierService.syncAllICTSuppliers');
            throw error;
        }
    }
}
