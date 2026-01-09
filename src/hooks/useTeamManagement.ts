import { useState, useCallback, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where, limit, serverTimestamp, getCountFromServer } from 'firebase/firestore';
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

export const useTeamManagement = () => {
    const { t } = useTranslation(); // Added initialization
    const { user, addToast, demoMode } = useStore();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

    const fetchUsers = useCallback(async () => {
        if (!user?.organizationId) return;
        setLoading(true);

        if (demoMode) {
            import('../services/mockDataService').then(({ MockDataService }) => {
                const mockUsers = MockDataService.getCollection('users');
                const mockInvites = MockDataService.getCollection('invitations');
                const mockRequests = MockDataService.getCollection('join_requests');

                // Simulate structure matching Promise.allSettled logic roughly or just set state
                setUsers([...mockUsers, ...mockInvites] as unknown as UserProfile[]);
                setJoinRequests(mockRequests as JoinRequest[]);
                setLoading(false);
            }).catch(_err => {
                setLoading(false);
            });
            return;
        }

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
    }, [user?.organizationId, demoMode]);

    const fetchRoles = useCallback(async () => {
        if (!user?.organizationId) return;

        if (demoMode) {
            import('../services/mockDataService').then(({ MockDataService }) => {
                const mock = MockDataService.getCollection('custom_roles');
                setCustomRoles(mock as CustomRole[]);
            }).catch(_err => {
            });
            return;
        }

        try {
            const q = query(collection(db, 'custom_roles'), where('organizationId', '==', user.organizationId));
            const snapshot = await getDocs(q);
            setCustomRoles(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomRole)));
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error as Error, 'useTeamManagement.fetchRoles');
        }
    }, [user?.organizationId, demoMode]);

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, [fetchUsers, fetchRoles]);

    const inviteUser = useCallback(async (data: UserFormData, silent = false) => {
        if (!user?.organizationId) return false;

        if (demoMode) {
            addToast(t("team.invite.success"), "success");
            setUsers(prev => [...prev, {
                uid: `mock-invite-${Date.now()}`,
                email: data.email,
                role: data.role,
                displayName: data.displayName,
                department: data.department,
                organizationId: user.organizationId,
                isPending: true
            } as UserProfile]);
            return true;
        }

        try {
            // Check plan limits (Server-side)
            const [usersCount, invitesCount] = await Promise.all([
                getCountFromServer(query(collection(db, 'users'), where('organizationId', '==', user.organizationId))),
                getCountFromServer(query(collection(db, 'invitations'), where('organizationId', '==', user.organizationId)))
            ]);

            const totalUsers = usersCount.data().count + invitesCount.data().count;

            const canAddUser = await SubscriptionService.checkLimit(user.organizationId, 'users', totalUsers);
            if (!canAddUser) return 'LIMIT_REACHED';

            await addDoc(collection(db, 'invitations'), sanitizeData({
                ...data, // Invite logic...
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

            if (!silent) addToast("Invitation envoyée par email", "success");
            fetchUsers();
            return true;
        } catch (error) {
            if (!silent) {
                ErrorLogger.handleErrorWithToast(error as Error, 'useTeamManagement.inviteUser', 'INVITE_FAILED');
                addToast("Erreur invitation", "error");
            } else {
                ErrorLogger.error(error as Error, 'useTeamManagement.inviteUser (Silent)');
            }
            return false;
        }
        return false;
    }, [user, demoMode, addToast, t, fetchUsers]);

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
        // Check limits (Server-side)
        const [usersCount, invitesCount] = await Promise.all([
            getCountFromServer(query(collection(db, 'users'), where('organizationId', '==', user.organizationId))),
            getCountFromServer(query(collection(db, 'invitations'), where('organizationId', '==', user.organizationId)))
        ]);

        const totalUsers = usersCount.data().count + invitesCount.data().count;

        const canAddUser = await SubscriptionService.checkLimit(user.organizationId, 'users', totalUsers);
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

    const importUsers = useCallback(async (csvData: string) => {
        if (!user) return;
        setLoading(true);
        try {
            const usersToImport = ImportService.parseCSV(csvData);
            if (usersToImport.length === 0) {
                addToast("Fichier vide ou invalide", "error");
                setLoading(false);
                return;
            }

            let successCount = 0;
            let failureCount = 0;
            let limitReached = false;

            const normalizeRole = (value?: string): UserFormData['role'] => {
                const allowedRoles: UserFormData['role'][] = ['user', 'rssi', 'auditor', 'project_manager', 'direction', 'admin'];
                if (!value) return 'user';
                const lowerValue = value.trim().toLowerCase();
                return (allowedRoles.find(role => role === lowerValue) ?? 'user') as UserFormData['role'];
            };

            for (const row of usersToImport) {
                if (limitReached) break;
                const email = row.Email || row.email;
                if (!email) continue;

                // Map CSV fields to UserFormData
                const userData: UserFormData = {
                    email,
                    displayName: row.Nom || row.name || '',
                    role: normalizeRole(row.Role || row.role || row['Rôle'] || row['rôle']),
                    department: row.Departement || row.department || row['Département'] || row['département'] || ''
                };

                // Use inviteUser but suppress individual toasts (we need to refactor inviteUser or just accept toasts? Refactoring is better but complex. 
                // Alternatively, recreate logic here for batching without toasts).
                // Let's call inviteUser. It shows toasts. This might be spammy for large imports.
                // Better to refactor inviteUser to accept a 'silent' flag.

                // For now, I will duplicate logic slightly to avoid modifying inviteUser signature and breaking other calls, 
                // OR I will modify inviteUser signature.
                // Modifying inviteUser signature is cleaner. 
                const result = await inviteUser(userData, true); // Pass silent=true
                if (result === 'LIMIT_REACHED') {
                    limitReached = true;
                } else if (result) {
                    successCount++;
                } else {
                    failureCount++;
                }
            }

            if (limitReached) {
                addToast(`Limite du plan atteinte. ${successCount} utilisateurs importés.`, "info");
            } else {
                addToast(`Import terminé : ${successCount} succès, ${failureCount} échecs`, "success");
            }
            fetchUsers();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error as Error, 'useTeamManagement.importUsers');
        } finally {
            setLoading(false);
        }
    }, [user, addToast, fetchUsers, inviteUser]);

    return {
        users,
        joinRequests,
        loading,
        customRoles,
        fetchUsers,
        fetchRoles,
        inviteUser,
        importUsers,
        updateUser,
        deleteUser,
        checkDependencies,
        approveRequest,
        rejectRequest
    };
};
