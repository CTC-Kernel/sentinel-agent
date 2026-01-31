import { toast } from '@/lib/toast';
import { useState, useCallback, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, limit, serverTimestamp, getCountFromServer, onSnapshot, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { UserProfile, Invitation, JoinRequest, CustomRole } from '../types';
import { UserFormData } from '../schemas/userSchema';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { sendEmail } from '../services/emailService';
import { getInvitationTemplate } from '../services/emailTemplates';
import { logAction } from '../services/logger';
import { SubscriptionService } from '../services/subscriptionService';
import { ImportService } from '../services/ImportService';
import { useTranslation } from 'react-i18next';
import { hasPermission } from '../utils/permissions';
import { useAuth } from './useAuth';

export const useTeamManagement = (enabled = true) => {
    const { t } = useTranslation();
    const { user, claimsSynced } = useAuth();
    const { addToast, demoMode } = useStore();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

    useEffect(() => {
        if (!user?.organizationId || !claimsSynced || !enabled) {
            setLoading(false);
            return;
        }

        if (demoMode) {
            import('../services/mockDataService').then(({ MockDataService }) => {
                setUsers([...MockDataService.getCollection('users'), ...MockDataService.getCollection('invitations')] as unknown as UserProfile[]);
                setJoinRequests(MockDataService.getCollection('join_requests') as unknown as JoinRequest[]);
                setCustomRoles(MockDataService.getCollection('custom_roles') as unknown as CustomRole[]);
                setLoading(false);
            });
            return;
        }

        setLoading(true);
        const orgId = user.organizationId;

        // Subscriptions
        const unsubUsers = onSnapshot(query(collection(db, 'users'), where('organizationId', '==', orgId), limit(100)), (snap) => {
            const active = snap.docs.map(d => ({ ...d.data(), uid: d.id, isPending: false } as UserProfile));
            setUsers(prev => {
                const pending = prev.filter(u => u.isPending);
                return [...active, ...pending];
            });
            setLoading(false);
        });

        const unsubInvites = onSnapshot(query(collection(db, 'invitations'), where('organizationId', '==', orgId), limit(50)), (snap) => {
            const pending = snap.docs.map(d => {
                const inv = d.data() as Invitation;
                return {
                    uid: d.id,
                    email: inv.email,
                    displayName: 'Invité (En attente)',
                    role: inv.role,
                    department: inv.department,
                    organizationId: inv.organizationId,
                    isPending: true,
                    onboardingCompleted: false
                } as UserProfile;
            });
            setUsers(prev => {
                const active = prev.filter(u => !u.isPending);
                return [...active, ...pending];
            });
        });

        const unsubRequests = onSnapshot(query(collection(db, 'join_requests'), where('organizationId', '==', orgId), where('status', '==', 'pending'), limit(50)), (snap) => {
            setJoinRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest)));
        });

        const unsubRoles = onSnapshot(query(collection(db, 'custom_roles'), where('organizationId', '==', orgId)), (snap) => {
            setCustomRoles(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomRole)));
        });

        return () => {
            unsubUsers();
            unsubInvites();
            unsubRequests();
            unsubRoles();
        };
    // claimsSynced transitions from false->true once on mount; kept in deps to delay subscription until claims are ready
    }, [user?.organizationId, claimsSynced, enabled, demoMode]);

    const inviteUser = useCallback(async (data: UserFormData, silent = false) => {
        if (!user?.organizationId) return false;

        // SECURITY: Check permissions
        if (!hasPermission(user, 'User', 'create')) {
            if (!silent) toast.error(t('common.accessDenied'));
            ErrorLogger.warn('Unauthorized user invite attempt', 'useTeamManagement.inviteUser', {
                metadata: { attemptedBy: user.uid, role: user.role }
            });
            return false;
        }

        if (demoMode) {
            if (!silent) addToast(t("team.invite.success"), "success");
            return true;
        }

        try {
            const [usersCount, invitesCount] = await Promise.all([
                getCountFromServer(query(collection(db, 'users'), where('organizationId', '==', user.organizationId))),
                getCountFromServer(query(collection(db, 'invitations'), where('organizationId', '==', user.organizationId)))
            ]);

            const total = usersCount.data().count + invitesCount.data().count;
            if (!(await SubscriptionService.checkLimit(user.organizationId, 'users', total))) return 'LIMIT_REACHED';

            await addDoc(collection(db, 'invitations'), sanitizeData({
                ...data,
                organizationId: user.organizationId,
                organizationName: user.organizationName,
                invitedBy: user.uid,
                createdAt: serverTimestamp()
            }));

            await sendEmail(user, {
                to: data.email,
                subject: `Invitation à rejoindre ${user.organizationName || 'Sentinel GRC'}`,
                type: 'INVITATION',
                html: getInvitationTemplate(user.displayName || 'Admin', data.role, `${window.location.origin}/#/login`)
            });

            await logAction(user, 'INVITE', 'User', `Invitation: ${data.email}`);
            if (!silent) addToast(t('team.toast.invitationSent', { defaultValue: "Invitation envoyée" }), "success");
            return true;
        } catch (error) {
            if (!silent) ErrorLogger.handleErrorWithToast(error as Error, 'team.invite');
            return false;
        }
    }, [user, demoMode, addToast, t]);

    const updateUser = async (uid: string, data: Partial<UserFormData>, isPending: boolean) => {
        if (isPending || !user || !hasPermission(user, 'User', 'update')) return false;
        try {
            await updateDoc(doc(db, 'users', uid), sanitizeData({ ...data, updatedAt: serverTimestamp() }));
            await logAction(user, 'UPDATE', 'User', `Modif utilisateur: ${uid}`);
            addToast(t('team.toast.updated', { defaultValue: "Mis à jour" }), "success");
            return true;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error as Error, 'team.update');
            return false;
        }
    };

    const deleteUser = async (u: UserProfile) => {
        if (!user || !hasPermission(user, 'User', 'delete') || u.uid === user.uid) return false;
        try {
            if (u.isPending) await deleteDoc(doc(db, 'invitations', u.uid));
            else await deleteDoc(doc(db, 'users', u.uid));
            await logAction(user, 'DELETE', 'User', `Suppression: ${u.email}`);
            addToast(t('team.toast.deleted', { defaultValue: "Supprimé" }), "success");
            return true;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error as Error, 'team.delete');
            return false;
        }
    };

    const approveRequest = async (req: JoinRequest) => {
        if (!user?.organizationId) return false;

        // SECURITY: Check permissions
        if (!hasPermission(user, 'User', 'manage')) {
            toast.error(t('common.accessDenied'));
            return false;
        }

        try {
            const approveFn = httpsCallable(functions, 'approveJoinRequest');
            await approveFn({ requestId: req.id });

            // Audit Log handled by backend usually, but client trace is good
            await logAction(user, 'APPROVE_REQUEST', 'User', `Approbation demande: ${req.displayName}`);

            addToast(t('team.toast.approved', { defaultValue: "Approuvé: {{name}}", name: req.displayName }), "success");
            return true;
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e as Error, 'team.approve');
            return false;
        }
    };

    const rejectRequest = async (req: JoinRequest) => {
        if (!user) return false;

        // SECURITY: Check permissions
        if (!hasPermission(user, 'User', 'manage')) {
            toast.error(t('common.accessDenied'));
            return false;
        }

        try {
            const rejectFn = httpsCallable(functions, 'rejectJoinRequest');
            await rejectFn({ requestId: req.id });

            await logAction(user, 'REJECT_REQUEST', 'User', `Refus demande: ${req.displayName}`);

            addToast(t('team.toast.rejected', { defaultValue: "Refusé" }), "info");
            return true;
        } catch (e) {
            ErrorLogger.error(e as Error, 'team.reject');
            return false;
        }
    };

    const importUsers = useCallback(async (csvData: string) => {
        if (!user) return;
        setLoading(true);
        try {
            const rows = ImportService.parseCSV(csvData);
            if (rows.length === 0) return addToast(t('common.toast.emptyFile', { defaultValue: "Fichier vide" }), "error");

            let done = 0;
            for (const row of rows) {
                const email = row.Email || row.email;
                if (!email) continue;
                const result = await inviteUser({
                    email,
                    displayName: row.Nom || row.name || '',
                    role: (row.Role || 'user').toLowerCase() as 'user' | 'rssi' | 'auditor' | 'project_manager' | 'direction' | 'admin' | 'super_admin',
                    department: row.Departement || ''
                }, true);
                if (result === 'LIMIT_REACHED') break;
                if (result) done++;
            }
            addToast(t('team.toast.usersImported', { defaultValue: "{{count}} utilisateurs importés", count: done }), "success");
        } finally {
            setLoading(false);
        }
    }, [user, addToast, inviteUser, t]);

    /**
     * Check if user has dependencies (assigned assets, risks, documents, etc.)
     * Returns array of dependency descriptions for UI
     */
    const checkDependencies = useCallback(async (userId: string): Promise<string[]> => {
        if (!user?.organizationId || demoMode) return [];
        const deps: string[] = [];
        try {
            const [assetsSnap, risksSnap, docsSnap] = await Promise.all([
                getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId), where('ownerId', '==', userId), limit(5))),
                getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId), where('ownerId', '==', userId), limit(5))),
                getDocs(query(collection(db, 'documents'), where('organizationId', '==', user.organizationId), where('ownerId', '==', userId), limit(5)))
            ]);
            if (!assetsSnap.empty) deps.push(t('team.dependencies.assets', { count: assetsSnap.size }));
            if (!risksSnap.empty) deps.push(t('team.dependencies.risks', { count: risksSnap.size }));
            if (!docsSnap.empty) deps.push(t('team.dependencies.documents', { count: docsSnap.size }));
        } catch (err) {
            ErrorLogger.error(err, 'useTeamManagement.checkDependencies');
        }
        return deps;
    }, [user?.organizationId, demoMode, t]);

    /**
     * Force refresh custom roles - mainly for compatibility
     * With onSnapshot, roles are already updated in realtime
     */
    const fetchRoles = useCallback(() => {
        // With onSnapshot subscription, roles are already updated in realtime
        // This function exists for API compatibility
    }, []);

    return { users, joinRequests, loading, customRoles, inviteUser, importUsers, updateUser, deleteUser, approveRequest, rejectRequest, checkDependencies, fetchRoles };
};
