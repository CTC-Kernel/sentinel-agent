import { db } from '../firebase';
import { FunctionsService } from './FunctionsService';
import { Supplier, SupplierQuestionnaireResponse, QuestionnaireTemplate, Criticality } from '../types';
import { doc, updateDoc, addDoc, collection, query, where, getDocs, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
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
     * Updates the supplier's risk level based on the assessment score.
     */
    static async updateSupplierRiskFromAssessment(supplierId: string, assessmentScore: number): Promise<void> {
        try {
            const supplierRef = doc(db, 'suppliers', supplierId);

            let riskLevel: Supplier['riskLevel'] = 'Low';
            if (assessmentScore < 50) riskLevel = 'Critical';
            else if (assessmentScore < 70) riskLevel = 'High';
            else if (assessmentScore < 85) riskLevel = 'Medium';

            // Also map to criticalities for the main status

            await updateDoc(supplierRef, sanitizeData({
                securityScore: assessmentScore,
                riskLevel: riskLevel,
                // We might not want to overwrite criticality automatically if manually set, 
                // but for dynamic VRM it makes sense to suggest it.
                // keeping criticality sync optional or secondary.
                updatedAt: serverTimestamp()
            }));
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
        template: QuestionnaireTemplate
    ): Promise<string> {
        try {
            const newResponse: Partial<SupplierQuestionnaireResponse> = {
                organizationId,
                supplierId,
                supplierName,
                templateId: template.id,
                status: 'Draft',
                answers: {},
                overallScore: 0,
                sentDate: serverTimestamp() as unknown as string
            };

            const res = await addDoc(collection(db, 'questionnaire_responses'), sanitizeData(newResponse));
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
        supplierId: string
    ): Promise<void> {
        try {
            // 1. Attempt Secure Deletion (Blocks if dependencies exist in Risks/Controls/Projects)
            // This replaces the old behavior of automatically unlinking (arrayRemove), which is unsafe for Audit.
            await FunctionsService.deleteResource('suppliers', supplierId);

            // 2. If successful, clean up "owned" child resources (Assessments, Incidents)
            // These are not "dependencies" but sub-resources, so we delete them to avoid orphans.
            const assessmentsQuery = query(
                collection(db, 'supplierAssessments'),
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
                where('supplierId', '==', supplierId)
            );
            const incidentsSnap = await getDocs(incidentsQuery);
            const deleteIncidents = incidentsSnap.docs.map(d =>
                deleteDoc(d.ref).catch(err => {
                    ErrorLogger.warn(`Failed to delete incident ${d.id}: ${err}`, 'SupplierService.deleteSupplierWithCascade');
                })
            );

            await Promise.all([...deleteAssessments, ...deleteIncidents]);

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
            const batch = writeBatch(db);
            let count = 0;

            lines.forEach((row: Record<string, string>) => {
                const values = Object.values(row) as string[];
                const name = row['Nom'] || row['Name'] || values[0] || 'Inconnu';
                const category = row['Catégorie'] || row['Category'] || values[1] || 'Autre';
                const criticality = row['Criticité'] || row['Criticality'] || values[2] || 'Moyenne';
                const contactName = row['Contact'] || row['ContactName'] || values[3] || '';
                const contactEmail = row['Email'] || row['ContactEmail'] || values[4] || '';

                if (name) {
                    const newRef = doc(collection(db, 'suppliers'));
                    const newSupplierData: Partial<Supplier> = {
                        organizationId,
                        name: name.trim(),
                        category: (category.trim() || 'Autre') as Supplier['category'],
                        criticality: (criticality.trim() || 'Moyenne') as Criticality,
                        contactName: contactName.trim(),
                        contactEmail: contactEmail.trim(),
                        status: 'Actif',
                        securityScore: 0,
                        assessment: {
                            hasIso27001: false,
                            hasGdprPolicy: false,
                            hasEncryption: false,
                            hasBcp: false,
                            hasIncidentProcess: false,
                            lastAssessmentDate: serverTimestamp() as unknown as string
                        },
                        isICTProvider: false,
                        supportsCriticalFunction: false,
                        doraCriticality: 'Aucun',
                        owner: userDisplayName || 'Importé',
                        ownerId: userId,
                        createdAt: serverTimestamp() as unknown as string
                    };
                    batch.set(newRef, sanitizeData(newSupplierData));
                    count++;
                }
            });

            await batch.commit();
            return count;
        } catch (error) {
            ErrorLogger.error(error, 'SupplierService.importSuppliersFromCSV');
            throw error;
        }
    }
}
