import { doc, updateDoc, collection, query, where, getCountFromServer, addDoc, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, functions, auth } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { ErrorLogger } from './errorLogger';
import { PlanType, PlanLimits } from '../types';
import { useStore } from '../store';

export interface AuditLog {
    id: string;
    timestamp: string;
    actorId: string;
    actorEmail?: string;
    action: string;
    targetId: string;
    organizationId: string;
    metadata?: Record<string, unknown>;
}

function requireSuperAdmin(): { uid: string; email: string | null; organizationId: string } {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');
    const storeUser = useStore.getState().user;
    if (!storeUser?.organizationId) throw new Error('No organization context');
    if (storeUser.role !== 'super_admin' && storeUser.role !== 'admin') {
        throw new Error('Insufficient permissions: admin or super_admin required');
    }
    return { uid: currentUser.uid, email: currentUser.email, organizationId: storeUser.organizationId };
}

function requireStrictSuperAdmin(): { uid: string; email: string | null; organizationId: string } {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');
    const storeUser = useStore.getState().user;
    if (!storeUser?.organizationId) throw new Error('No organization context');
    if (storeUser.role !== 'super_admin') {
        throw new Error('Insufficient permissions: super_admin required');
    }
    return { uid: currentUser.uid, email: currentUser.email, organizationId: storeUser.organizationId };
}

export const AdminService = {

    /**
     * Log an administrative action for security and compliance
     */
    logAction: async (action: string, targetId: string, metadata: Record<string, unknown> = {}) => {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                ErrorLogger.warn('Attempted to log admin action without authenticated user', 'AdminService.logAction');
                return;
            }
            const storeUser = useStore.getState().user;

            await addDoc(collection(db, 'audit_logs'), {
                timestamp: new Date().toISOString(),
                actorId: currentUser.uid,
                actorEmail: currentUser.email,
                organizationId: storeUser?.organizationId || '',
                action,
                targetId,
                metadata
            });
        } catch (error) {
            ErrorLogger.error(error as Error, 'AdminService.logAction');
        }
    },

    /**
     * Get recent audit logs (filtered by organization)
     */
    getAuditLogs: async (organizationId: string, limitCount: number = 100): Promise<AuditLog[]> => {
        try {
            if (!organizationId) return [];
            const q = query(
                collection(db, 'audit_logs'),
                where('organizationId', '==', organizationId),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
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
        const caller = requireSuperAdmin();
        try {
            const orgRef = doc(db, 'organizations', orgId);
            await updateDoc(orgRef, {
                isActive: isActive,
                updatedAt: new Date().toISOString()
            });

            await AdminService.logAction(
                isActive ? 'TENANT_ACTIVATE' : 'TENANT_SUSPEND',
                orgId,
                { newState: isActive, callerOrg: caller.organizationId }
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
        requireSuperAdmin();
        try {
            const usersCount = await getCountFromServer(query(collection(db, 'users'), where('organizationId', '==', orgId)));
            const projectsCount = await getCountFromServer(query(collection(db, 'projects'), where('organizationId', '==', orgId)));

            return {
                userCount: usersCount.data().count,
                projectCount: projectsCount.data().count,
                storageUsedBytes: null,
                lastActive: null
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
        const caller = requireStrictSuperAdmin();
        try {
            const impersonateFn = httpsCallable<{ targetUid: string }, { token: string }>(functions, 'impersonateUser');
            const result = await impersonateFn({ targetUid });

            await AdminService.logAction('USER_IMPERSONATE', targetUid, { method: 'cloud_function', callerOrg: caller.organizationId });

            return result.data;
        } catch (error) {
            ErrorLogger.error(error as Error, 'AdminService.impersonateUser');
            throw error;
        }
    },

    /**
     * Update tenant subscription details
     */
    updateTenantSubscription: async (orgId: string, plan: PlanType, limits: Partial<PlanLimits>): Promise<void> => {
        requireSuperAdmin();
        try {
            const orgRef = doc(db, 'organizations', orgId);

            const updateData: Record<string, unknown> = {
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
