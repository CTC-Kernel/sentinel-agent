import { doc, updateDoc, collection, query, where, getCountFromServer, addDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, functions, auth } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { ErrorLogger } from './errorLogger';
import { PlanType, PlanLimits } from '../types';

export interface AuditLog {
    id: string;
    timestamp: string;
    actorId: string;
    actorEmail?: string;
    action: string;
    targetId: string;
    metadata?: any;
}

export const AdminService = {

    /**
     * Log an administrative action for security and compliance
     */
    logAction: async (action: string, targetId: string, metadata: any = {}) => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                console.warn('Attempted to log admin action without authenticated user');
                return;
            }

            await addDoc(collection(db, 'audit_logs'), {
                timestamp: new Date().toISOString(),
                actorId: currentUser.uid,
                actorEmail: currentUser.email,
                action,
                targetId,
                metadata
            });
        } catch (error) {
            // We log the error but don't throw to avoid blocking the main action
            console.error('Failed to write audit log', error);
            ErrorLogger.error(error as Error, 'AdminService.logAction');
        }
    },

    /**
     * Get recent audit logs
     */
    getAuditLogs: async (limitCount: number = 100): Promise<AuditLog[]> => {
        try {
            const q = query(
                collection(db, 'audit_logs'),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AuditLog));
        } catch (error) {
            ErrorLogger.error(error as Error, 'AdminService.getAuditLogs');
            return [];
        }
    },

    /**
     * Suspend or Activate a tenant organization
     */
    toggleTenantStatus: async (orgId: string, isActive: boolean): Promise<void> => {
        try {
            const orgRef = doc(db, 'organizations', orgId);
            await updateDoc(orgRef, {
                isActive: isActive,
                updatedAt: new Date().toISOString()
            });

            await AdminService.logAction(
                isActive ? 'TENANT_ACTIVATE' : 'TENANT_SUSPEND',
                orgId,
                { newState: isActive }
            );
        } catch (error) {
            ErrorLogger.error(error as Error, 'AdminService.toggleTenantStatus');
            throw error;
        }
    },

    /**
     * Get detailed stats for an organization
     */
    getTenantStats: async (orgId: string) => {
        try {
            // Count users
            const usersCount = await getCountFromServer(query(collection(db, 'users'), where('organizationId', '==', orgId)));

            // Count projects (mock heuristic for usage)
            const projectsCount = await getCountFromServer(query(collection(db, 'projects'), where('organizationId', '==', orgId)));

            // Get storage usage (Simulated or fetched from a dedicated stats document if available)
            const storageUsedBytes = 0; // Placeholder

            return {
                userCount: usersCount.data().count,
                projectCount: projectsCount.data().count,
                storageUsedBytes,
                lastActive: new Date().toISOString() // Placeholder
            };
        } catch (error) {
            ErrorLogger.error(error as Error, 'AdminService.getTenantStats');
            throw error;
        }
    },

    /**
     * Impersonate a user (Requires Cloud Function 'impersonateUser')
     */
    impersonateUser: async (targetUid: string): Promise<{ token: string }> => {
        try {
            const impersonateFn = httpsCallable<{ targetUid: string }, { token: string }>(functions, 'impersonateUser');
            const result = await impersonateFn({ targetUid });

            await AdminService.logAction('USER_IMPERSONATE', targetUid, { method: 'cloud_function' });

            return result.data;
        } catch (error) {
            ErrorLogger.error(error as Error, 'AdminService.impersonateUser');
            throw new Error("Impossible d'impréciser l'utilisateur. Vérifiez vos permissions ou si la fonction cloud est déployée.");
        }
    },

    /**
     * Update tenant subscription details
     */
    updateTenantSubscription: async (orgId: string, plan: PlanType, limits: Partial<PlanLimits>): Promise<void> => {
        try {
            const orgRef = doc(db, 'organizations', orgId);

            const updateData: any = {
                'subscription.planId': plan,
                'updatedAt': new Date().toISOString()
            };

            if (limits.maxUsers !== undefined) updateData['subscription.customLimits.maxUsers'] = limits.maxUsers;
            if (limits.maxProjects !== undefined) updateData['subscription.customLimits.maxProjects'] = limits.maxProjects;
            if (limits.maxStorageGB !== undefined) updateData['subscription.customLimits.maxStorageGB'] = limits.maxStorageGB;

            await updateDoc(orgRef, updateData);

            await AdminService.logAction('SUBSCRIPTION_UPDATE', orgId, { plan, limits });
        } catch (error) {
            ErrorLogger.error(error as Error, 'AdminService.updateTenantSubscription');
            throw error;
        }
    }
};
