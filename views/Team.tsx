
import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Invitation, JoinRequest } from '../types';
import { Users, Mail, Plus, Building, User, Trash2, Edit, Clock, Timer, FileSpreadsheet, Check, XCircle, UserPlus } from '../components/ui/Icons';
import { useStore } from '../store';
import { sendEmail } from '../services/emailService';
import { getInvitationTemplate } from '../services/emailTemplates';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { logAction } from '../services/logger';
import { SubscriptionService } from '../services/subscriptionService';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorLogger } from '../services/errorLogger';
import { Drawer } from '../components/ui/Drawer';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { CustomSelect } from '../components/ui/CustomSelect';
import { zodResolver } from '@hookform/resolvers/zod';
import { userSchema, UserFormData } from '../schemas/userSchema';

import { hasPermission } from '../utils/permissions';

export const Team: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const { user, addToast } = useStore();

    // State for creating user
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

    const inviteForm = useForm<UserFormData>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            displayName: '',
            email: '',
            role: 'user',
            department: ''
        }
    });

    const editForm = useForm<UserFormData>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            displayName: '',
            email: '',
            role: 'user',
            department: ''
        }
    });

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const canAdmin = hasPermission(user, 'User', 'manage');

    const fetchUsers = async () => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'invitations'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'join_requests'), where('organizationId', '==', user.organizationId), where('status', '==', 'pending')))
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
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Team.fetchUsers', 'FETCH_FAILED');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, [user?.organizationId]);

    const handleOpenInviteModal = async () => {
        if (!user?.organizationId) return;

        // Check plan limits
        const canAddUser = await SubscriptionService.checkLimit(user.organizationId, 'users', users.length);

        if (!canAddUser) {
            if (confirm("Vous avez atteint la limite d'utilisateurs de votre plan actuel. Voulez-vous passer au plan supérieur ?")) {
                navigate('/pricing');
            }
            return;
        }

        setShowInviteModal(true);
    };

    const handleAddUser: SubmitHandler<UserFormData> = async (data) => {
        if (!user?.organizationId) return;

        try {
            // Create an invitation in 'invitations' collection
            await addDoc(collection(db, 'invitations'), {
                ...data,
                organizationId: user.organizationId,
                organizationName: user.organizationName,
                invitedBy: user.uid,
                createdAt: new Date().toISOString()
            });

            const inviteLink = `${window.location.origin}/#/login`;
            const htmlContent = getInvitationTemplate(user?.displayName || 'Un administrateur', data.role, inviteLink);

            await sendEmail(user, {
                to: data.email,
                subject: `Invitation à rejoindre ${user.organizationName || 'Sentinel GRC'}`,
                type: 'INVITATION',
                html: htmlContent
            });

            setShowInviteModal(false);
            inviteForm.reset();
            addToast("Invitation envoyée par email", "success");
            fetchUsers();
        } catch (error) {
            console.error(error);
            addToast("Erreur lors de l'invitation", "error");
        }
    };

    const openEditModal = (u: UserProfile) => {
        setSelectedUser(u);
        editForm.reset({
            displayName: u.displayName || '',
            email: u.email,
            role: u.role,
            department: u.department || ''
        });
        setShowEditModal(true);
    };

    const handleUpdateUser: SubmitHandler<UserFormData> = async (data) => {
        if (!selectedUser) return;
        if (selectedUser.isPending) return; // Cannot edit invites this way yet

        try {
            await updateDoc(doc(db, 'users', selectedUser.uid), {
                role: data.role,
                department: data.department,
                displayName: data.displayName
            });
            await logAction(user, 'UPDATE', 'User', `Modification utilisateur: ${selectedUser.email}`);
            setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, ...data } : u));
            setShowEditModal(false);
            addToast("Utilisateur mis à jour", "success");
        } catch (error) {
            console.error(error);
            addToast("Erreur mise à jour", "error");
        }
    };

    const handleApproveRequest = async (req: JoinRequest) => {
        if (!user?.organizationId) return;

        // Check plan limits
        const canAddUser = await SubscriptionService.checkLimit(user.organizationId, 'users', users.length);
        if (!canAddUser) {
            if (confirm("Limite d'utilisateurs atteinte. Passer au plan supérieur ?")) {
                navigate('/pricing');
            }
            return;
        }

        try {
            // 1. Update User Profile
            await updateDoc(doc(db, 'users', req.userId), {
                organizationId: user.organizationId,
                organizationName: user.organizationName,
                role: 'user', // Default role
                onboardingCompleted: true
            });

            // 2. Update Request Status
            await updateDoc(doc(db, 'join_requests', req.id), {
                status: 'approved',
                approvedBy: user.uid,
                approvedAt: new Date().toISOString()
            });

            // 3. Notify (Optional - could be email)
            // For now just toast
            addToast(`Accès approuvé pour ${req.displayName}`, "success");

            // Refresh
            fetchUsers();
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Team.handleApproveRequest');
            addToast("Erreur lors de l'approbation", "error");
        }
    };

    const handleRejectRequest = async (req: JoinRequest) => {
        if (!user) return;
        if (!confirm(`Refuser la demande de ${req.displayName} ?`)) return;
        try {
            await updateDoc(doc(db, 'join_requests', req.id), {
                status: 'rejected',
                rejectedBy: user.uid,
                rejectedAt: new Date().toISOString()
            });
            addToast("Demande refusée", "info");
            fetchUsers();
        } catch (e) {
            addToast("Erreur lors du refus", "error");
        }
    };

    const checkDependencies = async (uid: string): Promise<string[]> => {
        const dependencies: string[] = [];

        const assetsSnap = await getDocs(query(collection(db, 'assets'), where('ownerId', '==', uid)));
        if (!assetsSnap.empty) dependencies.push(`${assetsSnap.size} actif(s)`);

        const risksSnap = await getDocs(query(collection(db, 'risks'), where('ownerId', '==', uid)));
        if (!risksSnap.empty) dependencies.push(`${risksSnap.size} risque(s)`);

        const docsSnap = await getDocs(query(collection(db, 'documents'), where('ownerId', '==', uid)));
        if (!docsSnap.empty) dependencies.push(`${docsSnap.size} document(s)`);

        return dependencies;
    };

    const initiateDelete = async (u: UserProfile) => {
        if (!canAdmin) return;
        if (u.uid === user?.uid) {
            addToast("Vous ne pouvez pas vous supprimer vous-même.", "error");
            return;
        }

        let message = u.isPending
            ? `Voulez-vous révoquer l'invitation pour ${u.email} ?`
            : `L'utilisateur ${u.email} perdra définitivement l'accès à l'organisation.`;

        if (!u.isPending) {
            // Check for dependencies
            const deps = await checkDependencies(u.uid);
            // Also check by email for Risks since they might use email string
            const risksSnap = await getDocs(query(collection(db, 'risks'), where('owner', '==', u.displayName)));
            if (!risksSnap.empty) deps.push(`${risksSnap.size} risque(s)`);

            if (deps.length > 0) {
                message += `\n\nATTENTION: Cet utilisateur est propriétaire de : ${deps.join(', ')}. Ces éléments resteront orphelins.`;
            }
        }

        setConfirmData({
            isOpen: true,
            title: u.isPending ? "Annuler l'invitation ?" : "Supprimer l'utilisateur ?",
            message,
            onConfirm: () => handleDeleteUser(u)
        });
    };

    const handleDeleteUser = async (u: UserProfile) => {
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
        } catch (error) {
            console.error(error);
            addToast("Erreur suppression", "error");
        }
    };

    const handleExportCSV = () => {
        const headers = ["Nom", "Email", "Rôle", "Département", "Statut", "Dernière Connexion"];
        const rows = users.map(u => [
            u.displayName || '',
            u.email,
            u.role,
            u.department || '',
            u.isPending ? 'Invité' : 'Actif',
            u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : ''
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `team_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin': return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800">Admin</span>;
            case 'rssi': return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">RSSI</span>;
            case 'auditor': return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">Auditeur</span>;
            case 'project_manager': return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Chef Projet</span>;
            case 'direction': return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">Direction</span>;
            default: return <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400 border border-gray-200 dark:border-slate-700">Utilisateur</span>;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative">
            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <PageHeader
                title="Équipe"
                subtitle={`Gestion des membres de ${user?.organizationName || 'l\'organisation'}.`}
                breadcrumbs={[
                    { label: 'Équipe' }
                ]}
                icon={<Users className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={canAdmin && (
                    <>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm text-slate-700 dark:text-white"
                        >
                            <FileSpreadsheet className="h-4 w-4 mr-2" /> Export CSV
                        </button>
                        <button
                            onClick={handleOpenInviteModal}
                            className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Inviter un membre
                        </button>
                    </>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Pending Join Requests Section */}
                {joinRequests.length > 0 && (
                    <div className="col-span-full mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                            <UserPlus className="h-5 w-5 mr-2 text-blue-500" />
                            Demandes d'accès ({joinRequests.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {joinRequests.map(req => (
                                <div key={req.id} className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/30 p-5 rounded-2xl shadow-sm flex flex-col">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                                            {req.displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">{req.displayName}</p>
                                            <p className="text-xs text-slate-500">{req.userEmail}</p>
                                        </div>
                                    </div>
                                    <div className="mt-auto flex gap-2 pt-3">
                                        <button
                                            onClick={() => handleRejectRequest(req)}
                                            className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold hover:bg-red-100 hover:text-red-600 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <XCircle className="h-3.5 w-3.5" /> Refuser
                                        </button>
                                        <button
                                            onClick={() => handleApproveRequest(req)}
                                            className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Check className="h-3.5 w-3.5" /> Approuver
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="h-px bg-slate-200 dark:bg-white/10 my-6" />
                    </div>
                )}

                {loading ? (
                    <div className="col-span-full"><CardSkeleton count={3} /></div>
                ) : users.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            icon={Users}
                            title="Aucun membre"
                            description="Invitez des collaborateurs pour travailler ensemble."
                            actionLabel={canAdmin ? "Inviter un membre" : undefined}
                            onAction={canAdmin ? handleOpenInviteModal : undefined}
                        />
                    </div>
                ) : (
                    users.map((u, i) => (
                        <div key={i} className={`glass-panel rounded-[2.5rem] p-6 flex flex-col items-center text-center card-hover group relative border border-white/50 dark:border-white/5 ${u.isPending ? 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/20' : ''}`}>
                            {canAdmin && (
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!u.isPending && (
                                        <button onClick={() => openEditModal(u)} className="p-2 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm hover:scale-105 transition-all">
                                            <Edit className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button onClick={() => initiateDelete(u)} className="p-2 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-red-500 shadow-sm hover:scale-105 transition-all">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            )}

                            <div className="relative mb-4 mt-2">
                                {u.photoURL ? (
                                    <img src={u.photoURL} alt={u.displayName} className={`w-24 h-24 rounded-full object-cover shadow-xl ring-4 ring-white dark:ring-slate-800 ${u.isPending ? 'opacity-50 grayscale' : ''}`} />
                                ) : (
                                    <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-3xl font-bold text-slate-500 dark:text-slate-300 shadow-xl ring-4 ring-white dark:ring-slate-800 ${u.isPending ? 'opacity-50' : ''}`}>
                                        {u.displayName ? u.displayName.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                )}
                                <div className="absolute bottom-0 right-0 transform translate-x-2 translate-y-1">
                                    {getRoleBadge(u.role)}
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{u.displayName}</h3>
                            <div className="flex items-center text-xs font-medium text-slate-500 dark:text-slate-400 mb-4 bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-full">
                                <Mail className="h-3 w-3 mr-1.5 opacity-70" /> {u.email}
                            </div>

                            {u.isPending ? (
                                <div className="w-full pt-4 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-center items-center text-xs mt-auto">
                                    <div className="flex items-center text-amber-500 font-bold bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg">
                                        <Timer className="h-3.5 w-3.5 mr-1.5" />
                                        Invitation en attente
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full pt-4 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-between items-center text-xs mt-auto">
                                    <div className="flex items-center text-slate-600 dark:text-slate-300 font-medium">
                                        <Building className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                                        {u.department || 'Général'}
                                    </div>
                                    {u.lastLogin && (
                                        <div className="flex items-center text-slate-400 font-medium" title="Dernière connexion">
                                            <Clock className="h-3.5 w-3.5 mr-1.5" />
                                            {new Date(u.lastLogin).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            {/* INVITE DRAWER */}
            <Drawer
                isOpen={showInviteModal}
                onClose={() => setShowInviteModal(false)}
                title="Inviter un collaborateur"
                subtitle={`Ils rejoindront ${user?.organizationName}.`}
                width="max-w-4xl"
            >
                <form onSubmit={inviteForm.handleSubmit(handleAddUser)} className="p-8 space-y-6">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-900 dark:text-white shadow-inner">
                            <User className="h-10 w-10" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom complet (Optionnel)</label>
                        <input type="text" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                            {...inviteForm.register('displayName')} placeholder="Jean Dupont" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email professionnel</label>
                        <input type="email" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                            {...inviteForm.register('email')} placeholder="jean@entreprise.com" />
                        {inviteForm.formState.errors.email && <p className="text-red-500 text-xs mt-1">{inviteForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Rôle</label>
                            <Controller
                                control={inviteForm.control}
                                name="role"
                                render={({ field }) => (
                                    <CustomSelect
                                        label=""
                                        value={field.value}
                                        onChange={field.onChange}
                                        options={[
                                            { value: 'user', label: 'Utilisateur' },
                                            { value: 'rssi', label: 'RSSI' },
                                            { value: 'auditor', label: 'Auditeur' },
                                            { value: 'project_manager', label: 'Chef de Projet' },
                                            { value: 'direction', label: 'Direction' },
                                            { value: 'admin', label: 'Admin' }
                                        ]}
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Département</label>
                            <input type="text" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                {...inviteForm.register('department')} placeholder="IT" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button type="button" onClick={() => setShowInviteModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-transform">Envoyer</button>
                    </div>
                </form>
            </Drawer>

            {/* EDIT DRAWER */}
            <Drawer
                isOpen={showEditModal && !!selectedUser && !selectedUser.isPending}
                onClose={() => setShowEditModal(false)}
                title="Modifier Utilisateur"
                subtitle="Mettez à jour les informations du collaborateur."
                width="max-w-4xl"
            >
                {selectedUser && (
                    <form onSubmit={editForm.handleSubmit(handleUpdateUser)} className="p-8 space-y-6">
                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl mb-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Compte</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedUser.email}</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom d'affichage</label>
                            <input type="text" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                {...editForm.register('displayName')} />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Rôle</label>
                                <Controller
                                    control={editForm.control}
                                    name="role"
                                    render={({ field }) => (
                                        <CustomSelect
                                            label=""
                                            value={field.value}
                                            onChange={field.onChange}
                                            options={[
                                                { value: 'user', label: 'Utilisateur' },
                                                { value: 'rssi', label: 'RSSI' },
                                                { value: 'auditor', label: 'Auditeur' },
                                                { value: 'project_manager', label: 'Chef de Projet' },
                                                { value: 'direction', label: 'Direction' },
                                                { value: 'admin', label: 'Admin' }
                                            ]}
                                        />
                                    )}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Département</label>
                                <input type="text" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                    {...editForm.register('department')} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                            <button type="button" onClick={() => setShowEditModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                            <button type="submit" className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-transform">Enregistrer</button>
                        </div>
                    </form>
                )}
            </Drawer>
        </div>
    );
};
