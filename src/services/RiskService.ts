
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Risk, UserProfile } from '../types';
import { RiskCalculator } from '../utils/RiskCalculator';
import { riskSchema } from '../schemas/riskSchema';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { canEditResource, canDeleteResource } from '../utils/permissions';
import { DependencyService } from './dependencyService';
import { FunctionsService } from './FunctionsService';
import { AuditLogService } from './auditLogService';
import { NotificationService } from './notificationService';
import { isValidRiskTransition, RiskStatus } from '../types/risks';

export class RiskService {

    /**
     * Centralized Security Check: IDOR Protection
     * Verifies that the resource belongs to the user's organization.
     */
    private static verifyOwnership(user: UserProfile, resourceOrganizationId?: string): boolean {
        if (!user.organizationId) return false;
        if (!resourceOrganizationId) return true; // New resource or implicit
        return user.organizationId === resourceOrganizationId;
    }

    /**
     * Validates business logic (e.g. Residual Score <= Inherent Score)
     */
    static validateLogic(data: Partial<Risk>): { valid: boolean; error?: string } {
        if (
            data.probability && data.impact &&
            data.residualProbability && data.residualImpact
        ) {
            const inherentScore = RiskCalculator.calculateScore(undefined, data.probability, data.impact);
            const residualScore = RiskCalculator.calculateResidualScore(data.residualProbability, data.residualImpact);

            if (residualScore > inherentScore) {
                return {
                    valid: false,
                    error: "Le risque résiduel ne peut pas être supérieur au risque inhérent sans justification."
                };
            }
        }
        return { valid: true };
    }

    /**
     * Create a new Risk
     */
    static async createRisk(user: UserProfile, data: Partial<Risk>): Promise<{ success: boolean; id?: string; error?: string }> {
        if (!user.organizationId || !canEditResource(user, 'Risk')) {
            return { success: false, error: "Permission denied" };
        }

        // Logic check
        const logic = this.validateLogic(data);
        if (!logic.valid) return { success: false, error: logic.error };

        // Schema check
        const validation = riskSchema.safeParse(data);
        if (!validation.success) {
            return { success: false, error: validation.error.issues[0]?.message };
        }

        try {
            const calculated = RiskCalculator.parseRiskValues(data);
            const riskData = sanitizeData({
                ...data,
                ...calculated,
                organizationId: user.organizationId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: data.status || 'Ouvert',
                owner: user.uid,
                history: [{
                    date: new Date().toISOString(),
                    user: user.displayName || user.email,
                    action: 'Création du risque',
                    changes: 'Initialisation',
                    previousScore: 0,
                    newScore: 0,
                    changedBy: user.uid
                }]
            });

            const docRef = await addDoc(collection(db, 'risks'), riskData);

            // Async Log & Notify
            if (user.organizationId) {
                await AuditLogService.logCreate(
                    user.organizationId,
                    { id: user.uid, name: user.displayName || user.email, email: user.email },
                    'risk',
                    docRef.id,
                    riskData,
                    'Nouveau risque'
                );
            }

            if (riskData.owner && riskData.owner !== user.uid) {
                NotificationService.notifyRiskAssigned(riskData as unknown as Risk, riskData.owner, user.displayName || user.email || 'Admin');
            }

            return { success: true, id: docRef.id };
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RiskService.createRisk', 'CREATE_FAILED');
            return { success: false, error: "Error creating risk" };
        }
    }

    /**
     * Update an existing Risk
     */
    static async updateRisk(user: UserProfile, id: string, data: Partial<Risk>, currentRisk?: Risk): Promise<{ success: boolean; error?: string }> {
        if (!canEditResource(user, 'Risk')) return { success: false, error: "Permission denied" };

        // IDOR Check
        if (currentRisk && !this.verifyOwnership(user, currentRisk.organizationId)) {
            ErrorLogger.handleErrorWithToast(new Error('IDOR Attempt'), 'RiskService.updateRisk', 'PERMISSION_DENIED');
            return { success: false, error: "Accès non autorisé à cette ressource" };
        }

        const logic = this.validateLogic({ ...currentRisk, ...data });
        if (!logic.valid) return { success: false, error: logic.error };

        // Validate risk status transition if status is changing
        if (data.status && currentRisk?.status && data.status !== currentRisk.status) {
            if (!isValidRiskTransition(currentRisk.status as RiskStatus, data.status as RiskStatus)) {
                return { success: false, error: 'Invalid risk status transition' };
            }
        }

        try {
            const calculated = RiskCalculator.parseRiskValues({ ...currentRisk, ...data });
            const updatePayload = sanitizeData({
                ...data,
                ...calculated,
                updatedAt: serverTimestamp()
            });

            await updateDoc(doc(db, 'risks', id), updatePayload);

            // Log changes
            if (currentRisk && user.organizationId) {
                await AuditLogService.logUpdate(
                    user.organizationId,
                    { id: user.uid, name: user.displayName || user.email, email: user.email },
                    'risk',
                    id,
                    currentRisk as unknown as Record<string, unknown>,
                    data as unknown as Record<string, unknown>,
                    currentRisk.threat || 'Risque'
                );
            }

            return { success: true };
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RiskService.updateRisk', 'UPDATE_FAILED');
            return { success: false, error: "Error updating risk" };
        }
    }

    /**
     * Delete a Risk
     */
    static async deleteRisk(user: UserProfile, id: string, currentRisk?: Risk): Promise<{ success: boolean; error?: string }> {
        if (!canDeleteResource(user, 'Risk')) return { success: false, error: "Permission denied" };

        if (currentRisk && !this.verifyOwnership(user, currentRisk.organizationId)) {
            return { success: false, error: "Accès non autorisé" };
        }

        try {
            await FunctionsService.deleteResource('risks', id);

            if (user.organizationId) {
                await AuditLogService.logDelete(
                    user.organizationId,
                    { id: user.uid, name: user.displayName || user.email, email: user.email },
                    'risk',
                    id,
                    currentRisk ? (currentRisk as unknown as Record<string, unknown>) : { id },
                    currentRisk?.threat || 'Risque'
                );
            }
            return { success: true };
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RiskService.deleteRisk', 'DELETE_FAILED');
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Check Dependencies
     */
    static async checkDependencies(user: UserProfile, riskId: string) {
        if (!user.organizationId) return { hasDependencies: false, dependencies: [] };
        return await DependencyService.checkRiskDependencies(riskId, user.organizationId);
    }
}
