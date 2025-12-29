import { useState, useCallback, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, limit, serverTimestamp } from 'firebase/firestore';
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

export const useTeamManagement = () => {
    const { user, addToast } = useStore();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

    const fetchUsers = useCallback(async () => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId), limit(100))),
                getDocs(query(collection(db, 'invitations'), where('organizationId', '==', user.organizationId), limit(50))),
                getDocs(query(collection(db, 'join_requests'), where('organizationId', '==', user.organizationId), where('status', '==', 'pending'), limit(50)))
            ]);

            const activeUsers = results[0].status === 'fulfilled'
                ? results[0].value.docs.map(d => ({ ...d.data(), uid: d.id, isPending: false } as UserProfile))
                : [];

            const pendingInvites = results[1].status === 'fulfilled'
                ? results[1].value.docs.map(d => {
                    const inv = d.data() as Invitation;
                    return {
                        uid: d.id, // Use invitation ID as temp UID
                        email: inv.email,
                        displayName: 'Invité (En attente)',
                        role: inv.role,
                        department: inv.department,
                        organizationId: inv.organizationId,
                        isPending: true,
                        onboardingCompleted: false
                    } as UserProfile;
                })
                : [];

            const requests = results[2].status === 'fulfilled'
                ? results[2].value.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest))
                : [];

            setUsers([...activeUsers, ...pendingInvites]);
            setJoinRequests(requests);
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err as Error, 'useTeamManagement.fetchUsers', 'FETCH_FAILED');
        } finally {
            setLoading(false);
        }
    }, [user?.organizationId]);

    const fetchRoles = useCallback(async () => {
        if (!user?.organizationId) return;
        try {
            const q = query(collection(db, 'custom_roles'), where('organizationId', '==', user.organizationId));
            const snapshot = await getDocs(q);
            setCustomRoles(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomRole)));
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error as Error, 'useTeamManagement.fetchRoles');
        }
    }, [user?.organizationId]);

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, [fetchUsers, fetchRoles]);

    const inviteUser = async (data: UserFormData) => {
        if (!user?.organizationId) return false;
        try {
            // Check plan limits
            const canAddUser = await SubscriptionService.checkLimit(user.organizationId, 'users', users.length);
            if (!canAddUser) return 'LIMIT_REACHED';

            await addDoc(collection(db, 'invitations'), sanitizeData({
                ...data,
                organizationId: user.organizationId,
                organizationName: user.organizationName,
                invitedBy: user.uid,
                createdAt: serverTimestamp()
            }));

            const inviteLink = `${window.location.origin}/#/login`;
            const htmlContent = getInvitationTemplate(user?.displayName || 'Un administrateur', data.role, inviteLink);

            await sendEmail(user, {
                to: data.email,
                subject: `Invitation à rejoindre ${user.organizationName || 'Sentinel GRC'}`,
                type: 'INVITATION',
                html: htmlContent
            });

            addToast("Invitation envoyée par email", "success");
            fetchUsers();
            return true;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error as Error, 'useTeamManagement.inviteUser', 'INVITE_FAILED');
            addToast("Erreur invitation", "error");
            return false;
        }
    };

    const updateUser = async (uid: string, data: Partial<UserFormData>, isPending: boolean) => {
        if (isPending) return;
        try {
            await updateDoc(doc(db, 'users', uid), sanitizeData({
                role: data.role,
                department: data.department,
                displayName: data.displayName
            }));
            await logAction(user, 'UPDATE', 'User', `Modification utilisateur: ${uid}`);
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...data } as UserProfile : u));
            addToast("Utilisateur mis à jour", "success");
            return true;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error as Error, 'useTeamManagement.updateUser', 'UPDATE_FAILED');
            addToast("Erreur mise à jour", "error");
            return false;
        }
    };

    const checkDependencies = async (uid: string): Promise<string[]> => {
        const dependencies: string[] = [];
        const assetsSnap = await getDocs(query(collection(db, 'assets'), where('ownerId', '==', uid), limit(20)));
        if (!assetsSnap.empty) dependencies.push(`${assetsSnap.size} actif(s)`);

        const risksSnap = await getDocs(query(collection(db, 'risks'), where('ownerId', '==', uid), limit(20)));
        if (!risksSnap.empty) dependencies.push(`${risksSnap.size} risque(s)`);

        const docsSnap = await getDocs(query(collection(db, 'documents'), where('ownerId', '==', uid), limit(20)));
        if (!docsSnap.empty) dependencies.push(`${docsSnap.size} document(s)`);

        return dependencies;
    };

    const deleteUser = async (u: UserProfile) => {
        try {
            if (u.isPending) {
                await deleteDoc(doc(db, 'invitations', u.uid));
                addToast("Invitation annulée", "info");
            } else {
                await deleteDoc(doc(db, 'users', u.uid));
                await logAction(user, 'DELETE', 'User', `Suppression utilisateur: ${u.email}`);
                addToast("Utilisateur supprimé", "info");
            }
            setUsers(prev => prev.filter(user => user.uid !== u.uid));
            return true;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error as Error, 'useTeamManagement.deleteUser', 'DELETE_FAILED');
            addToast("Erreur suppression", "error");
            return false;
        }
    };

    const approveRequest = async (req: JoinRequest) => {
        if (!user?.organizationId) return false;
        // Check limits
        const canAddUser = await SubscriptionService.checkLimit(user.organizationId, 'users', users.length);
        if (!canAddUser) return 'LIMIT_REACHED';

        try {
            const approveFn = httpsCallable(functions, 'approveJoinRequest');
            await approveFn({ requestId: req.id });
            addToast(`Accès approuvé pour ${req.displayName}`, "success");
            fetchUsers();
            return true;
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e as Error, 'useTeamManagement.approveRequest');
            addToast("Erreur lors de l'approbation", "error");
            return false;
        }
    };

    const rejectRequest = async (req: JoinRequest) => {
        try {
            const rejectFn = httpsCallable(functions, 'rejectJoinRequest');
            await rejectFn({ requestId: req.id });
            addToast("Demande refusée", "info");
            fetchUsers();
            return true;
        } catch (e) {
            ErrorLogger.error(e as Error, 'useTeamManagement.rejectRequest');
            addToast("Erreur lors du refus", "error");
            return false;
        }
    };

    return {
        users,
        joinRequests,
        loading,
        customRoles,
        fetchUsers,
        fetchRoles,
        inviteUser,
        updateUser,
        deleteUser,
        checkDependencies,
        approveRequest,
        rejectRequest
    };
};
