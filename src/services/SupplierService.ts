import { db } from '../firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { SupplierQuestionnaireResponse, QuestionnaireTemplate, Supplier } from '../types/business';

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
        const supplierRef = doc(db, 'suppliers', supplierId);

        let riskLevel: Supplier['riskLevel'] = 'Low';
        if (assessmentScore < 50) riskLevel = 'Critical';
        else if (assessmentScore < 70) riskLevel = 'High';
        else if (assessmentScore < 85) riskLevel = 'Medium';

        // Also map to criticalities for the main status



        await updateDoc(supplierRef, {
            securityScore: assessmentScore,
            riskLevel: riskLevel,
            // We might not want to overwrite criticality automatically if manually set, 
            // but for dynamic VRM it makes sense to suggest it.
            // keeping criticality sync optional or secondary.
            updatedAt: new Date().toISOString()
        });
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
        const newResponse: Partial<SupplierQuestionnaireResponse> = {
            organizationId,
            supplierId,
            supplierName,
            templateId: template.id,
            status: 'Draft',
            answers: {},
            overallScore: 0,
            sentDate: new Date().toISOString()
        };

        const res = await addDoc(collection(db, 'questionnaire_responses'), newResponse);
        return res.id;
    }
}
