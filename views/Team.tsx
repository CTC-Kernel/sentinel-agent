
import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Invitation } from '../types';
import { Users, Mail, Plus, Building, User, Trash2, Edit, X, Clock, Timer, FileSpreadsheet } from '../components/ui/Icons';
import { useStore } from '../store';
import { sendEmail } from '../services/emailService';
import { getInvitationTemplate } from '../services/emailTemplates';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { logAction } from '../services/logger';
import { SubscriptionService } from '../services/subscriptionService';
import { useNavigate } from 'react-router-dom';

export const Team: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const { user, addToast } = useStore();

    // State for creating user
    const [newUser, setNewUser] = useState({ displayName: '', email: '', role: 'user', department: '' });

    // State for editing user
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const canAdmin = user?.role === 'admin';

    const fetchUsers = async () => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'invitations'), where('organizationId', '==', user.organizationId)))
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

            setUsers([...activeUsers, ...pendingInvites]);
        } catch (e) {
            console.warn("Erreur fetch users", e);
            addToast("Impossible de charger la liste des utilisateurs", "error");
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

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.organizationId) return;

        try {
            // Create an invitation in 'invitations' collection
            await addDoc(collection(db, 'invitations'), {
                ...newUser,
                organizationId: user.organizationId,
                organizationName: user.organizationName,
                invitedBy: user.uid,
                createdAt: new Date().toISOString()
            });

            const inviteLink = `${window.location.origin}/#/login`;
            const htmlContent = getInvitationTemplate(user?.displayName || 'Un administrateur', newUser.role, inviteLink);

            await sendEmail(user, {
                to: newUser.email,
                subject: `Invitation à rejoindre ${user.organizationName || 'Sentinel GRC'}`,
                type: 'INVITATION',
                html: htmlContent
            });

            setShowInviteModal(false);
            setNewUser({ displayName: '', email: '', role: 'user', department: '' });
            addToast("Invitation envoyée par email", "success");
            fetchUsers();
        } catch (e) {
            addToast("Erreur lors de l'invitation", "error");
        }
    };

    const openEditModal = (u: UserProfile) => {
        setSelectedUser(u);
        setShowEditModal(true);
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        if (selectedUser.isPending) return; // Cannot edit invites this way yet

        try {
            await updateDoc(doc(db, 'users', selectedUser.uid), {
                role: selectedUser.role,
                department: selectedUser.department,
                displayName: selectedUser.displayName
            });
            await logAction(user, 'UPDATE', 'User', `Modification utilisateur: ${selectedUser.email}`);
            setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? selectedUser : u));
            setShowEditModal(false);
            addToast("Utilisateur mis à jour", "success");
        } catch (e) {
            addToast("Erreur mise à jour", "error");
        }
    };

    const checkDependencies = async (uid: string): Promise<string[]> => {
        const dependencies: string[] = [];

        const assetsSnap = await getDocs(query(collection(db, 'assets'), where('ownerId', '==', uid)));
        if (!assetsSnap.empty) dependencies.push(`${assetsSnap.size} actif(s)`);

        const risksSnap = await getDocs(query(collection(db, 'risks'), where('owner', '==', uid)));
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
        } catch (e) {
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

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Équipe</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Gestion des membres de {user?.organizationName || 'l\'organisation'}.</p>
                </div>
                {canAdmin && (
                    <div className="flex gap-3">
                        <button onClick={handleExportCSV} className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm text-slate-700 dark:text-white">
                            <FileSpreadsheet className="h-4 w-4 mr-2" /> Export CSV
                        </button>
                        <button onClick={handleOpenInviteModal} className="flex items-center px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-none">
                            <Plus className="h-4 w-4 mr-2" />
                            Inviter un membre
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
            {/* INVITE MODAL */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] p-8 w-full max-w-md border border-white/20 shadow-2xl">
                        <div className="text-center mb-8 relative">
                            <button onClick={() => setShowInviteModal(false)} className="absolute right-0 top-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                            <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-900 dark:text-white shadow-inner">
                                <User className="h-7 w-7" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Inviter un collaborateur</h3>
                            <p className="text-sm text-slate-500 mt-1">Ils rejoindront {user?.organizationName}.</p>
                        </div>

                        <form onSubmit={handleAddUser} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom complet (Optionnel)</label>
                                <input type="text" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                    value={newUser.displayName} onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} placeholder="Jean Dupont" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email professionnel</label>
                                <input type="email" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium" required
                                    value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="jean@entreprise.com" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Rôle</label>
                                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                                        value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                        <option value="user">Utilisateur</option>
                                        <option value="rssi">RSSI</option>
                                        <option value="auditor">Auditeur</option>
                                        <option value="project_manager">Chef de Projet</option>
                                        <option value="direction">Direction</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Département</label>
                                    <input type="text" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                        value={newUser.department} onChange={e => setNewUser({ ...newUser, department: e.target.value })} placeholder="IT" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-8 pt-4">
                                <button type="button" onClick={() => setShowInviteModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                                <button type="submit" className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-transform">Envoyer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {showEditModal && selectedUser && !selectedUser.isPending && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] p-8 w-full max-w-md border border-white/20 shadow-2xl">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-white/5 pb-4">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Modifier Utilisateur</h3>
                            <button onClick={() => setShowEditModal(false)} className="p-2 text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"><X className="h-5 w-5" /></button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="space-y-5">
                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl mb-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Compte</p>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedUser.email}</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom d'affichage</label>
                                <input type="text" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                    value={selectedUser.displayName} onChange={e => setSelectedUser({ ...selectedUser, displayName: e.target.value })} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Rôle</label>
                                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                                        value={selectedUser.role} onChange={e => setSelectedUser({ ...selectedUser, role: e.target.value as any })}>
                                        <option value="user">Utilisateur</option>
                                        <option value="rssi">RSSI</option>
                                        <option value="auditor">Auditeur</option>
                                        <option value="project_manager">Chef de Projet</option>
                                        <option value="direction">Direction</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Département</label>
                                    <input type="text" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                        value={selectedUser.department} onChange={e => setSelectedUser({ ...selectedUser, department: e.target.value })} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100 dark:border-white/5">
                                <button type="button" onClick={() => setShowEditModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                                <button type="submit" className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold text-sm shadow-lg hover:scale-105 transition-transform">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
