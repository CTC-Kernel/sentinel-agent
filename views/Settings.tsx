
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Moon, Sun, ShieldAlert, Database, History, Download, Users, Camera, LogOut, Server, FileText, Trash2, Activity, CheckCircle2, AlertTriangle, Key, Building, WifiOff, ArrowRight, FileSpreadsheet } from '../components/ui/Icons';
import { collection, getDocs, query, orderBy, limit, where, addDoc, updateDoc, doc, startAfter, getCountFromServer, writeBatch, deleteDoc, Timestamp, enableNetwork, disableNetwork, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { signOut, updatePassword } from 'firebase/auth';
import { SystemLog, UserProfile } from '../types';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { logAction } from '../services/logger';
import { hasPermission } from '../utils/permissions';
import { SubscriptionService } from '../services/subscriptionService';
import { AccountService } from '../services/accountService';
import { Organization } from '../types';

export const Settings: React.FC = () => {
    const { theme, toggleTheme, user, setUser, addToast } = useStore();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [hasMoreLogs, setHasMoreLogs] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [exportingLogs, setExportingLogs] = useState(false);

    // System Stats
    const [sysStats, setSysStats] = useState({ assets: 0, docs: 0, risks: 0, logs: 0 });
    const [networkLatency, setNetworkLatency] = useState<string>('...');

    // Profile state
    const [profile, setProfile] = useState({ displayName: '', department: '', role: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Org State
    const [orgName, setOrgName] = useState('');
    const [savingOrg, setSavingOrg] = useState(false);

    // Password State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // Maintenance State
    const [maintenanceLoading, setMaintenanceLoading] = useState(false);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    // Subscription State
    const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
    const [subLoading, setSubLoading] = useState(false);

    const fetchOrgDetails = async () => {
        if (!user?.organizationId) return;
        try {
            const orgRef = doc(db, 'organizations', user.organizationId);
            const orgSnap = await getDoc(orgRef);
            if (orgSnap.exists()) {
                setCurrentOrg({ id: orgSnap.id, ...orgSnap.data() } as Organization);
            }
        } catch (e) { console.error("Error fetching org", e); }
    };

    const fetchUsers = async () => {
        if (!user?.organizationId) return;
        try {
            const q = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
            const snap = await getDocs(q);
            const users = snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
            setUsersList(users);
        } catch (e) { console.error("Error fetching users", e); }
    };

    const handleUpdateUserRole = async (targetUserId: string, newRole: UserProfile['role']) => {
        if (!hasPermission(user, 'User', 'manage')) return;
        try {
            await updateDoc(doc(db, 'users', targetUserId), { role: newRole });
            setUsersList(prev => prev.map(u => u.uid === targetUserId ? { ...u, role: newRole } : u));
            addToast("Rôle mis à jour", "success");
        } catch (_e) { addToast("Erreur mise à jour rôle", "error"); }
    };

    const handleRemoveUser = async (targetUserId: string) => {
        if (!hasPermission(user, 'User', 'manage')) return;
        if (targetUserId === user!.uid) {
            addToast("Vous ne pouvez pas vous supprimer vous-même", "error");
            return;
        }
        if (!confirm("Êtes-vous sûr de vouloir retirer cet utilisateur de l'organisation ?")) return;

        try {
            await updateDoc(doc(db, 'users', targetUserId), { organizationId: '', organizationName: '', role: '' });
            setUsersList(prev => prev.filter(u => u.uid !== targetUserId));
            addToast("Utilisateur retiré", "success");
        } catch (_e) { addToast("Erreur suppression utilisateur", "error"); }
    };

    useEffect(() => {
        if (user) {
            setProfile({ 
                displayName: user.displayName || '', 
                department: user.department || '',
                role: user.role || 'user'
            });
            setOrgName(user.organizationName || '');
            fetchOrgDetails();
        }
        if (hasPermission(user, 'Settings', 'manage') && user?.organizationId) {
            fetchLogs(true);
            fetchSystemStats();
            fetchUsers();
            checkLatency();
        }
    }, [user?.organizationId]);

    const checkLatency = async () => {
        const start = Date.now();
        try {
            await getDocs(query(collection(db, 'users'), where('uid', '==', user?.uid)));
            const end = Date.now();
            setNetworkLatency(`${end - start}ms`);
        } catch {
            setNetworkLatency('Erreur');
        }
    };

    const fetchSystemStats = async () => {
        if (!user?.organizationId) return;
        try {
            const countCol = async (col: string) => {
                try {
                    const snap = await getCountFromServer(query(collection(db, col), where('organizationId', '==', user.organizationId)));
                    return snap.data().count;
                } catch (_e) { return 0; }
            };

            const [assets, docs, risks, logs] = await Promise.all([
                countCol('assets'),
                countCol('documents'),
                countCol('risks'),
                countCol('system_logs')
            ]);

            setSysStats({ assets, docs, risks, logs });
        } catch (e) { console.error("Stats error", e); }
    };

    const fetchLogs = async (reset = false) => {
        if (loadingLogs || (!hasMoreLogs && !reset) || !user?.organizationId) return;
        setLoadingLogs(true);
        try {
            let q;
            if (reset || logs.length === 0) {
                q = query(
                    collection(db, 'system_logs'),
                    where('organizationId', '==', user.organizationId),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                );
            } else {
                const lastLog = logs[logs.length - 1];
                const lastTimestamp = Timestamp.fromDate(new Date(lastLog.timestamp));
                q = query(
                    collection(db, 'system_logs'),
                    where('organizationId', '==', user.organizationId),
                    orderBy('timestamp', 'desc'),
                    startAfter(lastTimestamp),
                    limit(50)
                );
            }

            const snap = await getDocs(q);

            if (!snap.empty) {
                const newLogs = snap.docs.map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        ...data,
                        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp
                    } as SystemLog;
                });

                if (reset) {
                    setLogs(newLogs);
                } else {
                    setLogs(prev => [...prev, ...newLogs]);
                }
                setHasMoreLogs(snap.docs.length === 50);
            } else {
                setHasMoreLogs(false);
            }
        } catch (e) { console.error(e); } finally { setLoadingLogs(false); }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!user || !e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploadingPhoto(true);

        try {
            const storageRef = ref(storage, `avatars/${user.uid}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docId = querySnapshot.docs[0].id;
                await updateDoc(doc(db, 'users', docId), { photoURL: downloadURL });
                setUser({ ...user, photoURL: downloadURL });
                addToast("Photo de profil mise à jour", "success");
            }
        } catch (error) {
            console.error("Upload failed", error);
            addToast("Erreur lors de l'upload de l'image", "error");
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSavingProfile(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const querySnapshot = await getDocs(q);

            const userData: UserProfile = { 
                ...user, 
                displayName: profile.displayName, 
                department: profile.department,
                role: profile.role as UserProfile['role']
            };

            if (!querySnapshot.empty) {
                const docId = querySnapshot.docs[0].id;
                await updateDoc(doc(db, 'users', docId), {
                    displayName: profile.displayName,
                    department: profile.department,
                    role: profile.role
                });
            }

            setUser(userData);
            addToast("Profil mis à jour avec succès.", "success");
        } catch (_err) {
            addToast("Erreur lors de la mise à jour du profil.", "error");
        } finally {
            setSavingProfile(false);
        }
    };

    const handleUpdateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasPermission(user, 'Settings', 'manage') || !user?.organizationId) return;
        setSavingOrg(true);
        try {
            // Update all users in organization with new name
            const q = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
            const snap = await getDocs(q);

            const batch = writeBatch(db);
            snap.docs.forEach(d => {
                batch.update(d.ref, { organizationName: orgName });
            });
            await batch.commit();

            setUser({ ...user, organizationName: orgName });
            addToast("Nom de l'organisation mis à jour pour tous les membres", "success");
        } catch (_e) {
            addToast("Erreur mise à jour organisation", "error");
        } finally {
            setSavingOrg(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            addToast("Les mots de passe ne correspondent pas", "error");
            return;
        }
        if (newPassword.length < 6) {
            addToast("Le mot de passe doit faire au moins 6 caractères", "error");
            return;
        }
        setChangingPassword(true);
        const currentUser = auth.currentUser;
        if (currentUser) {
            try {
                await updatePassword(currentUser, newPassword);
                addToast("Mot de passe modifié avec succès", "success");
                setNewPassword('');
                setConfirmPassword('');
            } catch (error: any) {
                if (error.code === 'auth/requires-recent-login') {
                    addToast("Veuillez vous reconnecter pour changer le mot de passe", "error");
                } else {
                    addToast("Erreur lors du changement de mot de passe", "error");
                }
            }
        }
        setChangingPassword(false);
    };

    const handleThemeToggle = () => {
        toggleTheme();
        if (user) {
            try {
                const usersRef = collection(db, 'users');
                getDocs(query(usersRef, where('email', '==', user.email))).then(snap => {
                    if (!snap.empty) updateDoc(doc(db, 'users', snap.docs[0].id), { theme: theme === 'light' ? 'dark' : 'light' });
                });
            } catch {
                // Ignore error
            }
        }
    }

    const handleExport = async () => {
        if (!user?.organizationId) return;
        setExporting(true);
        try {
            const collectionsToExport = ['assets', 'risks', 'controls', 'audits', 'users', 'documents', 'projects', 'incidents', 'suppliers', 'processing_activities', 'business_processes', 'bcp_drills'];
            const exportData: Record<string, any> = {};

            await Promise.all(collectionsToExport.map(async (colName) => {
                const q = query(collection(db, colName), where('organizationId', '==', user.organizationId));
                const snap = await getDocs(q);
                exportData[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }));

            exportData['exportedAt'] = new Date().toISOString();
            exportData['organizationId'] = user.organizationId;
            exportData['version'] = '1.0';

            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sentinel_full_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addToast("Sauvegarde complète téléchargée", "success");
        } catch (_error) {
            addToast("L'export a échoué.", "error");
        } finally {
            setExporting(false);
        }
    };

    const handleExportLogsCSV = async () => {
        if (!user?.organizationId) return;
        setExportingLogs(true);
        try {
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user.organizationId), limit(1000));
            const snap = await getDocs(q);
            const logData = snap.docs.map(d => d.data() as SystemLog);
            logData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const headers = ["Date", "Utilisateur", "Email", "Action", "Ressource", "Détails"];
            const rows = logData.map(l => [
                new Date(l.timestamp).toLocaleString(),
                l.userId,
                l.userEmail,
                l.action,
                l.resource,
                `"${l.details?.replace(/"/g, '""')}"`
            ]);

            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            addToast("Logs d'audit exportés (CSV)", "success");
        } catch (_e) {
            addToast("Erreur lors de l'export des logs", "error");
        } finally {
            setExportingLogs(false);
        }
    };

    const initiatePurgeLogs = () => {
        setConfirmData({
            isOpen: true,
            title: "Purger les journaux ?",
            message: "Tous les logs datant de plus de 90 jours seront supprimés. Irréversible.",
            onConfirm: handlePurgeLogs
        });
    };

    const handlePurgeLogs = async () => {
        if (!user?.organizationId) return;
        setMaintenanceLoading(true);
        try {
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user.organizationId), limit(500));
            const snap = await getDocs(q);
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const toDelete = snap.docs.filter(d => new Date(d.data().timestamp) < ninetyDaysAgo);

            if (toDelete.length === 0) {
                addToast("Aucun log ancien à purger.", "info");
            } else {
                // Use deleteDoc for individual deletions or batch for multiple
                if (toDelete.length < 10) {
                    await Promise.all(toDelete.map(d => deleteDoc(d.ref)));
                } else {
                    const batch = writeBatch(db);
                    toDelete.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }

                // Log the purge action
                await logAction(user, 'Purge Logs', 'SystemLogs', `${toDelete.length} logs supprimés (>90 jours)`);

                addToast(`${toDelete.length} logs anciens supprimés.`, "success");
                fetchLogs(true);
                fetchSystemStats();
            }
        } catch (_e) { addToast("Erreur lors de la purge.", "error"); } finally { setMaintenanceLoading(false); }
    };

    const handleTestLog = async () => {
        if (!user) return;
        try {
            await addDoc(collection(db, 'system_logs'), {
                organizationId: user.organizationId,
                userId: user.uid,
                userEmail: user.email,
                action: 'Test Log',
                resource: 'Settings',
                details: 'Log de test créé manuellement',
                timestamp: Timestamp.now()
            });
            addToast("Log de test créé", "success");
            fetchLogs(true);
        } catch (e) {
            console.error(e);
            addToast("Erreur création log", "error");
        }
    };


    const initiateLeaveOrg = () => {
        setConfirmData({
            isOpen: true,
            title: "Quitter l'organisation ?",
            message: "Vous perdrez accès à toutes les données de cette organisation. Cette action est irréversible.",
            onConfirm: handleLeaveOrg
        });
    };

    const handleLeaveOrg = async () => {
        if (!user) return;
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                organizationId: '',
                organizationName: '',
                role: '',
                department: '',
                onboardingCompleted: false
            });
            // Local state update handled by onSnapshot in App.tsx, forcing redirect to Onboarding
            window.location.reload();
        } catch (_e) {
            addToast("Erreur lors de la sortie de l'organisation", "error");
        }
    };

    const handleLogout = async () => {
        try { await signOut(auth); } catch (e) { console.error("Logout failed", e); }
    };

    const handleManageSubscription = async () => {
        if (!user?.organizationId) {
            addToast("Aucune organisation associée à votre compte", "error");
            return;
        }
        setSubLoading(true);
        try {
            if (currentOrg?.subscription?.planId === 'discovery') {
                window.location.href = '#/pricing';
            } else {
                await SubscriptionService.manageSubscription(user.organizationId);
            }
        } catch (error: any) {
            console.error("Error managing subscription:", error);
            const errorMessage = error?.message || "Impossible d'accéder à la gestion de l'abonnement";
            addToast(errorMessage, "error");
        } finally {
            setSubLoading(false);
        }
    };

    const handleDeleteAccount = () => {
        setConfirmData({
            isOpen: true,
            title: "Supprimer mon compte ?",
            message: "Cette action est irréversible. Toutes vos données personnelles seront supprimées.",
            onConfirm: async () => {
                if (!user || !auth.currentUser) return;
                try {
                    await AccountService.deleteAccount(user, auth.currentUser);
                    addToast("Compte supprimé avec succès", "success");
                    // Redirect handled by auth state change in App.tsx
                } catch (e: any) {
                    console.error(e);
                    if (e.code === 'auth/requires-recent-login') {
                        addToast("Veuillez vous reconnecter pour supprimer votre compte", "error");
                    } else {
                        addToast("Erreur lors de la suppression du compte", "error");
                    }
                }
            }
        });
    };

    const handleDeleteOrganization = () => {
        const confirmationWord = "SUPPRIMER";
        const input = prompt(`Pour confirmer la suppression DÉFINITIVE de l'organisation et de TOUTES ses données, tapez "${confirmationWord}" :`);

        if (input === confirmationWord && user?.organizationId) {
            setMaintenanceLoading(true);
            AccountService.deleteOrganization(user.organizationId)
                .then(async () => {
                    addToast("Organisation supprimée avec succès", "success");
                    // Force logout and reload
                    await signOut(auth);
                    window.location.reload();
                })
                .catch((e) => {
                    console.error(e);
                    addToast("Erreur lors de la suppression de l'organisation", "error");
                })
                .finally(() => setMaintenanceLoading(false));
        } else if (input !== null) {
            addToast("Code de confirmation incorrect", "error");
        }
    };

    return (
        <div className="max-w-3xl mx-auto pb-12 animate-fade-in pt-6 relative">
            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Paramètres</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Compte, préférences et administration.</p>
                {user?.organizationId && (
                    <div className="mt-4 inline-flex items-center px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-full text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                        ID: {user.organizationId}
                    </div>
                )}
            </div>

            {/* Subscription Status - Visible to all org members */}
            {user?.organizationId && (
                <div className="mb-8 glass-panel rounded-[2rem] p-6 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10 shadow-sm flex items-center justify-between animate-fade-in-up">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <FileSpreadsheet className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Abonnement {currentOrg?.subscription?.planId === 'professional' ? 'Professional' : currentOrg?.subscription?.planId === 'enterprise' ? 'Enterprise' : 'Discovery'}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${currentOrg?.subscription?.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                    {currentOrg?.subscription?.status === 'active' ? 'Actif' : 'Gratuit'}
                                </span>
                                {currentOrg?.subscription?.currentPeriodEnd && (
                                    <span className="text-xs text-slate-500">Renouvellement le {new Date((currentOrg.subscription.currentPeriodEnd as any).seconds ? (currentOrg.subscription.currentPeriodEnd as any).seconds * 1000 : currentOrg.subscription.currentPeriodEnd).toLocaleDateString()}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleManageSubscription}
                        disabled={subLoading}
                        className="px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold rounded-xl hover:shadow-md transition-all border border-slate-200 dark:border-white/10 flex items-center"
                    >
                        {subLoading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div> : null}
                        {currentOrg?.subscription?.planId === 'discovery' ? 'Mettre à niveau' : 'Gérer'}
                    </button>
                </div>
            )}

            <div className="space-y-8">
                {/* Profile */}
                <div className="glass-panel rounded-[2.5rem] p-8 relative overflow-hidden border border-white/50 dark:border-white/5 shadow-sm">
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center transition-transform group-hover:scale-105">
                                {uploadingPhoto ? (
                                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : user?.photoURL ? (
                                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-4xl font-bold text-slate-500 dark:text-slate-300">{user?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                                )}
                            </div>
                            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="text-white h-8 w-8" />
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-4">{user?.displayName}</h2>
                        <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-wide mt-2 border border-slate-200 dark:border-slate-700">
                            {user?.role}
                        </span>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-5 max-w-sm mx-auto">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Nom d'affichage</label>
                            <input type="text" required className="w-full px-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium"
                                value={profile.displayName} onChange={e => setProfile({ ...profile, displayName: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Département</label>
                            <input type="text" className="w-full px-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium"
                                value={profile.department} onChange={e => setProfile({ ...profile, department: e.target.value })} />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Rôle</label>
                            <div className="relative">
                                <select 
                                    className={`w-full px-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium appearance-none ${!(user?.role === 'admin' || currentOrg?.ownerId === user?.uid) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    value={profile.role} 
                                    onChange={e => setProfile({ ...profile, role: e.target.value })}
                                    disabled={!(user?.role === 'admin' || currentOrg?.ownerId === user?.uid)}
                                >
                                    <option value="admin">Administrateur</option>
                                    <option value="rssi">RSSI / CISO</option>
                                    <option value="direction">Direction / DPO</option>
                                    <option value="project_manager">Chef de Projet</option>
                                    <option value="auditor">Auditeur</option>
                                    <option value="user">Utilisateur</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                            {!(user?.role === 'admin' || currentOrg?.ownerId === user?.uid) && (
                                <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Contactez un administrateur pour changer de rôle.</p>
                            )}
                        </div>

                        <button type="submit" disabled={savingProfile} className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-900/20 dark:shadow-none disabled:opacity-70 flex justify-center items-center mt-4">
                            {savingProfile ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : 'Enregistrer'}
                        </button>
                    </form>
                </div>

                {/* Security & Preferences */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-full">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center"><Key className="h-5 w-5 mr-3 text-indigo-500" />Sécurité</h3>
                        </div>
                        <form onSubmit={handleChangePassword} className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                            <div className="space-y-4">
                                <input type="password" required className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm dark:text-white" placeholder="Nouveau mot de passe" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} />
                                <input type="password" required className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm dark:text-white" placeholder="Confirmer" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={6} />
                            </div>
                            <button type="submit" disabled={changingPassword || !newPassword} className="w-full px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50 text-sm mt-4">
                                {changingPassword ? '...' : 'Changer mot de passe'}
                            </button>
                        </form>
                    </div>

                    <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-full">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                                {theme === 'dark' ? <Moon className="h-5 w-5 mr-3 text-indigo-500" /> : <Sun className="h-5 w-5 mr-3 text-amber-500" />}
                                Apparence
                            </h3>
                        </div>
                        <div className="p-6 flex-1 flex flex-col justify-center space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Thème Sombre</span>
                                    {theme === 'dark' && <Moon className="h-4 w-4 text-indigo-400" />}
                                </div>
                                <button onClick={handleThemeToggle} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}>
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            <button onClick={handleExport} disabled={exporting} className="w-full flex items-center justify-center px-4 py-3 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition-colors">
                                {exporting ? 'Export en cours...' : <><Download className="h-4 w-4 mr-2" /> Sauvegarde JSON</>}
                            </button>
                            <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Mode Hors Ligne</span>
                                    <WifiOff className="h-4 w-4 text-slate-400" />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={async () => { try { await enableNetwork(db); addToast("Mode en ligne activé", "success"); } catch (e) { console.error(e); } }} className="flex-1 px-3 py-2 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-xs font-bold hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors flex items-center justify-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> En ligne
                                    </button>
                                    <button onClick={async () => { try { await disableNetwork(db); addToast("Mode hors ligne activé", "info"); } catch (e) { console.error(e); } }} className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1">
                                        <WifiOff className="h-3 w-3" /> Hors ligne
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Admin / Organization */}
                {hasPermission(user, 'Settings', 'manage') && (
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center gap-4 bg-slate-50/50 dark:bg-white/5">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg">
                                <Server className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Administration</h3>
                                <p className="text-xs text-slate-500 font-medium">Gestion de l'organisation {orgName}</p>
                            </div>
                        </div>

                        <div className="p-8 border-b border-gray-100 dark:border-white/5">
                            <form onSubmit={handleUpdateOrg} className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 ml-1">Nom de l'organisation</label>
                                    <input type="text" required className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium dark:text-white"
                                        value={orgName} onChange={e => setOrgName(e.target.value)} />
                                </div>
                                <button type="submit" disabled={savingOrg || !orgName} className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50 mb-[1px]">
                                    {savingOrg ? '...' : 'Renommer'}
                                </button>
                            </form>
                        </div>

                        <div className="p-6 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group card-hover" onClick={initiatePurgeLogs}>
                            <div className="flex items-center justify-between mb-3">
                                <Trash2 className="h-6 w-6 text-orange-500 group-hover:scale-110 transition-transform" />
                                {maintenanceLoading && <div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>}
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Purger les Logs</h4>
                            <p className="text-xs text-slate-500 mt-1">Nettoyer l&apos;historique &gt; 90 jours.</p>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-slate-50/30 dark:bg-black/20">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">État du Système</h4>
                                <div className="flex items-center gap-2">
                                    <Database className="h-4 w-4 text-green-500" />
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-5 gap-4 text-center">
                                <div className="p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5"><span className="block text-lg font-black text-slate-900 dark:text-white">{sysStats.assets}</span><span className="text-[9px] font-bold text-slate-400 uppercase">Actifs</span></div>
                                <div className="p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5"><span className="block text-lg font-black text-slate-900 dark:text-white">{sysStats.docs}</span><span className="text-[9px] font-bold text-slate-400 uppercase flex justify-center items-center"><FileText className="h-2.5 w-2.5 mr-1" />Docs</span></div>
                                <div className="p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5"><span className="block text-lg font-black text-slate-900 dark:text-white">{sysStats.risks}</span><span className="text-[9px] font-bold text-slate-400 uppercase flex justify-center items-center"><ShieldAlert className="h-2.5 w-2.5 mr-1" />Risques</span></div>
                                <div className="p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5"><span className="block text-lg font-black text-slate-900 dark:text-white">{sysStats.logs}</span><span className="text-[9px] font-bold text-slate-400 uppercase">Logs</span></div>
                                <div className="p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/10" onClick={checkLatency}><span className={`block text-lg font-black ${networkLatency !== 'Erreur' && parseInt(networkLatency) < 200 ? 'text-emerald-500' : 'text-orange-500'}`}>{networkLatency}</span><span className="text-[9px] font-bold text-slate-400 uppercase flex justify-center items-center"><Activity className="h-2.5 w-2.5 mr-1" /> Ping</span></div>
                            </div>
                            <div className="mt-4 flex items-center justify-between p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                                <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4 text-blue-500" />
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Organisation</span>
                                </div>
                                <span className="text-xs font-mono text-slate-900 dark:text-white">{orgName}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Danger Zone - For everyone */}
                <div className="glass-panel rounded-[2.5rem] p-6 border border-red-100 dark:border-red-900/30 shadow-sm">
                    <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4 flex items-center"><AlertTriangle className="h-5 w-5 mr-2" /> Zone de Danger</h3>
                    <div className="space-y-4">
                        {!hasPermission(user, 'Settings', 'manage') && (
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Quitter l'organisation</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Vous perdrez l'accès à toutes les données partagées.</p>
                                </div>
                                <button onClick={initiateLeaveOrg} className="px-4 py-2 bg-white dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors border border-red-100 dark:border-red-900/30 shadow-sm">
                                    Quitter
                                </button>
                            </div>
                        )}

                        <div className="flex items-center justify-between p-4 rounded-2xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Supprimer mon compte</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cette action est irréversible et supprimera vos données personnelles.</p>
                            </div>
                            <button onClick={handleDeleteAccount} className="px-4 py-2 bg-white dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors border border-red-100 dark:border-red-900/30 shadow-sm">
                                Supprimer mon compte
                            </button>
                        </div>

                        {hasPermission(user, 'Settings', 'manage') && (
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40">
                                <div>
                                    <h4 className="text-sm font-bold text-red-700 dark:text-red-300">Supprimer l'organisation</h4>
                                    <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">ATTENTION : Supprime définitivement l'organisation et TOUTES ses données.</p>
                                </div>
                                <button onClick={handleDeleteOrganization} className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">
                                    {maintenanceLoading ? '...' : 'Supprimer tout'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* User Management (Admin) */}
                {user && hasPermission(user, 'User', 'manage') && (
                    <div className="glass-panel rounded-[2.5rem] p-8 border border-white/50 dark:border-white/5 shadow-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Utilisateurs</h3>
                                <p className="text-xs text-slate-500 font-medium">Gestion des accès ({usersList.length} membres)</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {usersList.map(u => (
                                <div key={u.uid} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 card-hover transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold">
                                            {u.photoURL ? <img src={u.photoURL} className="w-full h-full rounded-full object-cover" /> : u.displayName?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{u.displayName} {u.uid === user.uid && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded ml-1">Vous</span>}</p>
                                            <p className="text-xs text-slate-500">{u.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as any)}
                                            disabled={u.uid === user.uid}
                                            className="text-xs font-bold bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="rssi">RSSI</option>
                                            <option value="auditor">Auditeur</option>
                                            <option value="project_manager">Chef de Projet</option>
                                            <option value="direction">Direction</option>
                                            <option value="user">Utilisateur</option>
                                        </select>
                                        {u.uid !== user.uid && (
                                            <button onClick={() => handleRemoveUser(u.uid)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Audit Logs (Admin) */}
                {hasPermission(user, 'SystemLog', 'read') && (
                    <div className="glass-panel rounded-[2.5rem] p-8 border border-white/50 dark:border-white/5 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 flex items-center justify-center mr-4">
                                    <History className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Journal d'audit</h3>
                                    <p className="text-xs text-slate-500 font-medium">Traçabilité des actions ({logs.length} entrées)</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {hasPermission(user, 'Settings', 'manage') && (
                                    <button onClick={handleTestLog} className="flex items-center px-3 py-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors">
                                        + Test
                                    </button>
                                )}
                                {hasMoreLogs && (
                                    <button onClick={() => fetchLogs(false)} disabled={loadingLogs} className="flex items-center px-3 py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                                        {loadingLogs ? '...' : <><ArrowRight className="h-3.5 w-3.5 mr-1" /> Plus</>}
                                    </button>
                                )}
                                <button onClick={handleExportLogsCSV} disabled={exportingLogs} className="flex items-center px-3 py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> {exportingLogs ? 'Export...' : 'CSV'}
                                </button>
                            </div>
                        </div>
                        <div className="relative border-l border-slate-200 dark:border-white/10 ml-4 space-y-8 pl-8">
                            {logs.map(log => (
                                <div key={log.id} className="relative group">
                                    <span className="absolute -left-[37px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-black group-hover:bg-brand-500 group-hover:scale-110 transition-all"></span>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </span>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white">
                                                {log.action} <span className="text-slate-400 font-normal">• {log.resource}</span>
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{log.details}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-md font-bold text-slate-600 dark:text-slate-300">
                                                {log.userEmail.split('@')[0]}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {logs.length === 0 && !loadingLogs && (
                                <p className="text-sm text-slate-400 italic">Aucun log disponible.</p>
                            )}
                        </div>
                        <button onClick={() => fetchLogs(false)} disabled={loadingLogs} className="w-full mt-8 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors border border-dashed border-slate-200 dark:border-white/10">
                            {loadingLogs ? 'Chargement...' : 'Charger plus'}
                        </button>
                    </div>
                )}

                <div className="flex justify-center pb-6">
                    <button onClick={handleLogout} className="flex items-center text-red-500 hover:text-red-600 text-sm font-bold px-6 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                        <LogOut className="h-4 w-4 mr-2" /> Déconnexion
                    </button>
                </div>
            </div>
        </div>
    );
};
