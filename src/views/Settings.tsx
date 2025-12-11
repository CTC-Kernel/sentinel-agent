import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import QRCode from 'qrcode';
import { Moon, Sun, ShieldAlert, Database, History, Download, Users, Camera, LogOut, Server, FileText, Trash2, Activity, CheckCircle2, AlertTriangle, Key, Building, ArrowRight, FileSpreadsheet, BrainCircuit, Loader2 } from '../components/ui/Icons';
import { collection, getDocs, query, orderBy, limit, where, updateDoc, doc, startAfter, getCountFromServer, writeBatch, deleteDoc, getDoc, QueryDocumentSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, storage, auth } from '../firebase';
import { signOut, updatePassword } from 'firebase/auth';
import { SystemLog, UserProfile } from '../types';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { logAction } from '../services/logger';
import { hasPermission } from '../utils/permissions';
import { SubscriptionService } from '../services/subscriptionService';
import { AccountService } from '../services/accountService';
import { hybridService } from '../services/hybridService';
import { Organization } from '../types';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { DemoDataService } from '../services/demoDataService';
import { LegalModal } from '../components/ui/LegalModal';
import { Scale, Crown, ArrowRightLeft } from 'lucide-react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Button } from '../components/ui/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, ProfileFormData, passwordSchema, PasswordFormData, organizationSchema, OrganizationFormData } from '../schemas/settingsSchema';
import { formatFileSize } from '../services/fileUploadService';
import { useGoogleLogin } from '@react-oauth/google';
import { Calendar } from 'lucide-react';
import { generateICS, downloadICS, mapAuditsToEvents, mapTasksToEvents } from '../utils/calendarUtils';
import { Project, Audit } from '../types';


export const Settings: React.FC = () => {
    const { theme, toggleTheme, user, setUser, addToast, language, setLanguage, t, demoMode, toggleDemoMode } = useStore();
    const { enrollMFA, verifyMFA, unenrollMFA } = useAuth();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [hasMoreLogs, setHasMoreLogs] = useState(true);
    const [logsExpanded, setLogsExpanded] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportingLogs, setExportingLogs] = useState(false);
    const [exportingCalendar, setExportingCalendar] = useState(false);

    // System Stats
    const [sysStats, setSysStats] = useState({ assets: 0, docs: 0, risks: 0, logs: 0 });
    const [networkLatency, setNetworkLatency] = useState<string>('...');

    // Profile state
    const [savingProfile, setSavingProfile] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Org State
    const [savingOrg, setSavingOrg] = useState(false);

    // Password State
    const [changingPassword, setChangingPassword] = useState(false);

    // Breach Check State
    const [breachCheckLoading, setBreachCheckLoading] = useState(false);

    const handleCheckBreach = async () => {
        if (!user?.email) return;
        if (!user.hasHibpKey) {
            addToast(t('settings.hibpKeyRequired'), "info");
            return;
        }

        setBreachCheckLoading(true);
        try {
            const functions = getFunctions();
            const checkBreachWithHIBP = httpsCallable(functions, 'checkBreachWithHIBP');
            const { data } = await checkBreachWithHIBP({ email: user.email });
            const breaches = (data as { breaches?: unknown[] } | undefined)?.breaches || [];
            if (breaches.length === 0) {
                addToast(t('settings.noBreachesFound'), "success");
            } else {
                addToast(t('settings.breachesFound').replace('{count}', breaches.length.toString()), "error");
            }
        } catch (err) {
            addToast(t('settings.hibpError'), "error");
            ErrorLogger.handleErrorWithToast(err, 'Settings.handleCheckBreach', 'HIBP_FAILED');
        } finally {
            setBreachCheckLoading(false);
        }
    };

    const profileForm = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        defaultValues: { displayName: '', department: '', role: 'user', geminiApiKey: '', shodanApiKey: '', hibpApiKey: '', safeBrowsingApiKey: '' }
    });

    const passwordForm = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { newPassword: '', confirmPassword: '' }
    });

    const orgForm = useForm<OrganizationFormData>({
        resolver: zodResolver(organizationSchema),
        defaultValues: { orgName: '', address: '', vatNumber: '', contactEmail: '' }
    });

    // Maintenance State
    const [maintenanceLoading, setMaintenanceLoading] = useState(false);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; loading?: boolean; closeOnConfirm?: boolean }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const [updatingUserIds, setUpdatingUserIds] = useState<Set<string>>(new Set());

    // Subscription State
    const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
    const [subLoading, setSubLoading] = useState(false);

    // Legal Modal State
    const [showLegalModal, setShowLegalModal] = useState(false);
    const [legalTab, setLegalTab] = useState<'mentions' | 'privacy' | 'terms'>('mentions');

    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferTargetId, setTransferTargetId] = useState<string>('');
    const [isTransferring, setIsTransferring] = useState(false);

    const loginToGoogle = useGoogleLogin({
        onSuccess: tokenResponse => {
            localStorage.setItem('google_access_token', tokenResponse.access_token);
            addToast(t('settings.googleCalendarConnected'), "success");
            // Force re-render to update UI
            setSavingProfile(prev => !prev);
        },
        scope: 'https://www.googleapis.com/auth/calendar'
    });

    const handleTransferOwnership = async () => {
        if (!transferTargetId) {
            addToast(t('settings.selectMember'), 'error');
            return;
        }

        if (!currentOrg || !user || currentOrg.ownerId !== user.uid) return;

        setIsTransferring(true);
        try {
            const functions = getFunctions();
            const transferOwnership = httpsCallable(functions, 'transferOwnership');

            await transferOwnership({
                organizationId: currentOrg.id,
                newOwnerId: transferTargetId
            });

            addToast(t('settings.transferSuccess'), 'success');
            setShowTransferModal(false);

            // Force reload to reflect changes (permissions, etc.)
            window.location.reload();
        } catch (error: unknown) {
            ErrorLogger.error(error, 'Settings.handleTransferOwnership');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addToast(t('settings.transferError') + errorMessage, 'error');
        } finally {
            setIsTransferring(false);
        }
    };

    const fetchOrgDetails = useCallback(async () => {
        if (!user?.organizationId) return;
        try {
            const orgRef = doc(db, 'organizations', user.organizationId);
            const orgSnap = await getDoc(orgRef);
            if (orgSnap.exists()) {
                setCurrentOrg({ id: orgSnap.id, ...orgSnap.data() } as Organization);
            }
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Settings.fetchOrgDetails', 'FETCH_FAILED'); }
    }, [user?.organizationId]);

    const fetchUsers = useCallback(async () => {
        if (!user?.organizationId) return;
        try {
            const q = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
            const snap = await getDocs(q);
            const users = snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
            setUsersList(users);
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Settings.fetchUsers', 'FETCH_FAILED'); }
    }, [user?.organizationId]);

    const handleUpdateUserRole = async (targetUserId: string, newRole: UserProfile['role']) => {
        if (!hasPermission(user, 'User', 'manage')) {
            addToast("Vous n'avez pas la permission de gérer les utilisateurs.", "error");
            return;
        }
        setUpdatingUserIds(prev => new Set(prev).add(targetUserId));
        try {
            await updateDoc(doc(db, 'users', targetUserId), { role: newRole });
            setUsersList(prev => prev.map(u => u.uid === targetUserId ? { ...u, role: newRole } : u));
            addToast(t('settings.roleUpdated'), "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Settings.handleUpdateUserRole', 'UPDATE_FAILED');
        } finally {
            setUpdatingUserIds(prev => {
                const next = new Set(prev);
                next.delete(targetUserId);
                return next;
            });
        }
    };

    const initiateRemoveUser = (targetUserId: string) => {
        setConfirmData({
            isOpen: true,
            title: t('settings.confirmRemoveUser'),
            message: t('settings.removeUserMessage') || "Cet utilisateur n'aura plus accès à votre organisation.",
            onConfirm: () => handleRemoveUser(targetUserId),
            closeOnConfirm: false
        });
    };

    const handleRemoveUser = async (targetUserId: string) => {
        if (!hasPermission(user, 'User', 'manage')) {
            addToast("Vous n'avez pas la permission de supprimer des utilisateurs.", "error");
            return;
        }
        if (targetUserId === user!.uid) {
            addToast(t('settings.cannotDeleteSelf'), "error");
            return;
        }

        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            await updateDoc(doc(db, 'users', targetUserId), { organizationId: '', organizationName: '', role: '' });
            setUsersList(prev => prev.filter(u => u.uid !== targetUserId));
            addToast(t('settings.userRemoved'), "success");
            setConfirmData(prev => ({ ...prev, isOpen: false }));
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Settings.handleRemoveUser', 'DELETE_FAILED');
        } finally {
            setConfirmData(prev => ({ ...prev, loading: false }));
        }
    };



    const checkLatency = useCallback(async () => {
        const start = Date.now();
        try {
            await getDocs(query(collection(db, 'users'), where('uid', '==', user?.uid)));
            const end = Date.now();
            setNetworkLatency(`${end - start} ms`);
        } catch {
            setNetworkLatency('Erreur');
        }
    }, [user?.uid]);

    const fetchSystemStats = useCallback(async () => {
        if (!user?.organizationId) return;
        try {
            const countCol = async (col: string) => {
                try {
                    const snap = await getCountFromServer(query(collection(db, col), where('organizationId', '==', user.organizationId)));
                    return snap.data().count;
                } catch { return 0; }
            };

            const [assets, docs, risks, logs] = await Promise.all([
                countCol('assets'),
                countCol('documents'),
                countCol('risks'),
                countCol('system_logs')
            ]);

            setSysStats({ assets, docs, risks, logs });
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Settings.fetchSystemStats', 'FETCH_FAILED'); }
    }, [user?.organizationId]);

    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);

    const fetchLogs = useCallback(async (reset = false) => {
        if (loadingLogs || (!hasMoreLogs && !reset) || !user?.organizationId) return;
        setLoadingLogs(true);
        try {
            let q;
            if (reset || !lastVisible) {
                q = query(
                    collection(db, 'system_logs'),
                    where('organizationId', '==', user.organizationId),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                );
            } else {
                q = query(
                    collection(db, 'system_logs'),
                    where('organizationId', '==', user.organizationId),
                    orderBy('timestamp', 'desc'),
                    startAfter(lastVisible),
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

                setLastVisible(snap.docs[snap.docs.length - 1]);

                if (reset) {
                    setLogs(newLogs);
                } else {
                    // Filter out duplicates just in case
                    setLogs(prev => {
                        const existingIds = new Set(prev.map(l => l.id));
                        const uniqueNewLogs = newLogs.filter(l => !existingIds.has(l.id));
                        return [...prev, ...uniqueNewLogs];
                    });
                }
                setHasMoreLogs(snap.docs.length === 50);
            } else {
                setHasMoreLogs(false);
            }
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Settings.fetchLogs', 'FETCH_FAILED'); } finally { setLoadingLogs(false); }
    }, [loadingLogs, hasMoreLogs, user?.organizationId, lastVisible]);

    useEffect(() => {
        if (user) {
            profileForm.reset({
                displayName: user.displayName || '',
                department: user.department || '',
                role: (user.role as UserProfile['role']) || 'user',
                geminiApiKey: '',
                shodanApiKey: '',
                hibpApiKey: '',
                safeBrowsingApiKey: ''
            });
            fetchOrgDetails();
        }
        if (hasPermission(user, 'Settings', 'manage') && user?.organizationId) {
            fetchLogs(true);
            fetchSystemStats();
            fetchUsers();
            checkLatency();
        }
    }, [user, fetchOrgDetails, fetchLogs, fetchSystemStats, fetchUsers, checkLatency, profileForm]);

    useEffect(() => {
        if (currentOrg) {
            orgForm.reset({
                orgName: currentOrg.name || '',
                address: currentOrg.address || '',
                vatNumber: currentOrg.vatNumber || '',
                contactEmail: currentOrg.contactEmail || ''
            });
        }
    }, [currentOrg, orgForm]);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!user || !e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploadingPhoto(true);

        try {
            const storageRef = ref(storage, `avatars/${user.uid}/${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docId = querySnapshot.docs[0].id;
                await updateDoc(doc(db, 'users', docId), { photoURL: downloadURL });
                setUser({ ...user, photoURL: downloadURL });
                addToast(t('settings.photoUpdated'), "success");
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Settings.handlePhotoUpload', 'FILE_UPLOAD_FAILED');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleUpdateProfile: SubmitHandler<ProfileFormData> = async (data) => {
        if (!user) return;
        setSavingProfile(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const querySnapshot = await getDocs(q);

            const updatedRole = hasPermission(user, 'User', 'manage') ? data.role : user.role;

            if (!querySnapshot.empty) {
                const docId = querySnapshot.docs[0].id;
                await updateDoc(doc(db, 'users', docId), sanitizeData({
                    displayName: data.displayName,
                    department: data.department || '',
                    role: updatedRole
                }));
            }

            const functions = getFunctions();
            const saveUserApiKeys = httpsCallable(functions, 'saveUserApiKeys');
            const payload: Record<string, string> = {};
            if (data.geminiApiKey !== undefined) payload.geminiApiKey = data.geminiApiKey || '';
            if (data.shodanApiKey !== undefined) payload.shodanApiKey = data.shodanApiKey || '';
            if (data.hibpApiKey !== undefined) payload.hibpApiKey = data.hibpApiKey || '';
            if (data.safeBrowsingApiKey !== undefined) payload.safeBrowsingApiKey = data.safeBrowsingApiKey || '';

            await saveUserApiKeys(payload);

            const userData: UserProfile = {
                ...user,
                displayName: data.displayName,
                department: data.department || '',
                role: updatedRole,
                hasGeminiKey: data.geminiApiKey ? true : user.hasGeminiKey,
                hasShodanKey: data.shodanApiKey ? true : user.hasShodanKey,
                hasHibpKey: data.hibpApiKey ? true : user.hasHibpKey,
                hasSafeBrowsingKey: data.safeBrowsingApiKey ? true : user.hasSafeBrowsingKey
            };

            setUser(userData);
            addToast(t('settings.profileUpdated'), "success");
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Settings.handleUpdateProfile', 'UPDATE_FAILED');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleUpdateOrg: SubmitHandler<OrganizationFormData> = async (data) => {
        if (!hasPermission(user, 'Settings', 'manage') || !user?.organizationId) return;
        setSavingOrg(true);
        try {
            // Update organization document
            const orgRef = doc(db, 'organizations', user.organizationId);
            await updateDoc(orgRef, sanitizeData({
                name: data.orgName,
                address: data.address,
                vatNumber: data.vatNumber,
                contactEmail: data.contactEmail
            }));

            // Update all users in organization with new name if it changed
            if (currentOrg?.name !== data.orgName) {
                const q = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
                const snap = await getDocs(q);

                const batch = writeBatch(db);
                snap.docs.forEach(d => {
                    batch.update(d.ref, { organizationName: data.orgName });
                });
                await batch.commit();
                setUser({ ...user, organizationName: data.orgName });
            }

            setCurrentOrg(prev => prev ? { ...prev, name: data.orgName, address: data.address, vatNumber: data.vatNumber, contactEmail: data.contactEmail } : null);
            addToast(t('settings.orgUpdated'), "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Settings.handleUpdateOrg', 'UPDATE_FAILED');
        } finally {
            setSavingOrg(false);
        }
    };

    const handleChangePassword: SubmitHandler<PasswordFormData> = async (data) => {
        setChangingPassword(true);
        const currentUser = auth.currentUser;
        if (currentUser) {
            try {
                await updatePassword(currentUser, data.newPassword);
                addToast(t('settings.passwordChanged'), "success");
                passwordForm.reset();
            } catch (error) {
                if ((error as { code?: string }).code === 'auth/requires-recent-login') {
                    addToast(t('settings.reloginRequired'), "error");
                } else {
                    ErrorLogger.handleErrorWithToast(error, 'Settings.handleChangePassword', 'UPDATE_FAILED');
                }
            }
        }
        setChangingPassword(false);
    };

    // MFA State
    const [isEnrollingMFA, setIsEnrollingMFA] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [mfaCode, setMfaCode] = useState('');
    const [verifyingMFA, setVerifyingMFA] = useState(false);

    const handleEnrollMFA = async () => {
        try {
            setIsEnrollingMFA(true);
            const uri = await enrollMFA();
            const dataUrl = await QRCode.toDataURL(uri);
            setQrCodeUrl(dataUrl);
        } catch (error) {
            setIsEnrollingMFA(false);
            ErrorLogger.error(error as Error, "Settings.handleEnrollMFA.enrollmentErrors");

            const firebaseError = error as { code?: string; message?: string };

            if (firebaseError.code === 'auth/requires-recent-login') {
                addToast(t('settings.reloginRequired'), "error");
            } else if (firebaseError.code === 'auth/operation-not-allowed' || firebaseError.message?.includes('400')) {
                addToast("La configuration MFA semble incomplète. Vérifiez que TOTP est activé dans la console Firebase.", "error");
                ErrorLogger.warn("Possible MFA Configuration Issue (TOTP disabled?)", 'Settings.handleEnrollMFA', { metadata: { error } });
            } else {
                ErrorLogger.handleErrorWithToast(error, 'Settings.handleEnrollMFA', 'UNKNOWN_ERROR');
            }
        }
    };

    const handleVerifyMFA = async () => {
        setVerifyingMFA(true);
        try {
            await verifyMFA('Sentinel Authenticator', mfaCode);
            addToast("MFA activé avec succès", "success");
            setIsEnrollingMFA(false);
            setQrCodeUrl(null);
            setMfaCode('');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Settings.handleVerifyMFA', 'UNKNOWN_ERROR');
        } finally {
            setVerifyingMFA(false);
        }
    };

    const handleDisableMFA = async () => {
        if (!confirm("Êtes-vous sûr de vouloir désactiver l'authentification à deux facteurs ?")) return;
        try {
            await unenrollMFA();
            addToast("MFA désactivé", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Settings.handleDisableMFA', 'UNKNOWN_ERROR');
        }
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
        if (!user?.organizationId || !hasPermission(user, 'Settings', 'manage')) return;
        setExporting(true);
        try {
            const collectionsToExport = ['assets', 'risks', 'controls', 'audits', 'users', 'documents', 'projects', 'incidents', 'suppliers', 'processing_activities', 'business_processes', 'bcp_drills'];
            const exportData: Record<string, unknown> = {};

            await Promise.all(collectionsToExport.map(async (colName) => {
                const q = query(collection(db, colName), where('organizationId', '==', user.organizationId));
                const snap = await getDocs(q);
                exportData[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            }));

            // Fetch secure data from hybrid backend (GDPR Data Portability)
            try {
                const response = await hybridService.exportOrganizationSecureData();
                if (response.success && response.data) {
                    const secureData = (response.data as { secure_data?: unknown[] }).secure_data || [];
                    exportData['secure_risk_data'] = secureData;
                }
            } catch (e) {
                ErrorLogger.warn('Failed to fetch secure data for export', 'Settings.handleExport', { metadata: { error: e } });
                exportData['secure_risk_data_error'] = 'Failed to retrieve secure data';
            }

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
            addToast(t('settings.backupDownloaded'), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Settings.handleExport', 'FETCH_FAILED');
        } finally {
            setExporting(false);
        }
    };

    const handleExportCalendar = async () => {
        if (!user?.organizationId) return;
        setExportingCalendar(true);
        try {
            // Fetch Projects
            const projectsRef = collection(db, 'projects');
            const qProj = query(projectsRef, where('organizationId', '==', user.organizationId));
            const projSnap = await getDocs(qProj);
            const projects = projSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Project[];

            // Extract tasks assigned to user
            const myTasks = projects.flatMap(p => p.tasks || []).filter(t => t.assigneeId === user.uid);

            // Fetch Audits
            const auditsRef = collection(db, 'audits');
            const qAudit = query(auditsRef, where('organizationId', '==', user.organizationId));
            const auditSnap = await getDocs(qAudit);
            const audits = auditSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Audit[];

            // Filter audits
            const myAudits = audits.filter(a => a.auditor === user.displayName || a.auditor === user.email);

            const auditEvents = mapAuditsToEvents(myAudits);
            const taskEvents = mapTasksToEvents(myTasks);

            const ics = generateICS([...auditEvents, ...taskEvents]);
            downloadICS(`sentinel_calendar_${new Date().toISOString().split('T')[0]}.ics`, ics);
            addToast("Calendrier exporté avec succès", "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Settings.handleExportCalendar', 'FETCH_FAILED');
        } finally {
            setExportingCalendar(false);
        }
    };

    const handleExportLogsCSV = async () => {
        if (!user?.organizationId || !hasPermission(user, 'Settings', 'manage')) return;
        setExportingLogs(true);
        try {
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user.organizationId), limit(1000));
            const snap = await getDocs(q);
            const logData = snap.docs.map(d => d.data() as SystemLog);
            logData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const headers = [t('common.date'), t('common.user'), t('common.email'), t('common.action'), t('common.resource'), t('common.details')];
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
            addToast(t('settings.logsExported'), "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Settings.handleExportLogsCSV', 'FETCH_FAILED');
        } finally {
            setExportingLogs(false);
        }
    };

    const initiatePurgeLogs = () => {
        setConfirmData({
            isOpen: true,
            title: t('settings.purgeLogsTitle'),
            message: t('settings.purgeLogsMessage'),
            onConfirm: handlePurgeLogs,
            closeOnConfirm: false
        });
    };

    const handlePurgeLogs = async () => {
        if (!user?.organizationId || !hasPermission(user, 'Settings', 'manage')) return;
        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user.organizationId), limit(500));
            const snap = await getDocs(q);
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const toDelete = snap.docs.filter(d => new Date(d.data().timestamp) < ninetyDaysAgo);

            if (toDelete.length === 0) {
                addToast(t('settings.noLogsToPurgeInfo'), "info");
                setConfirmData(prev => ({ ...prev, isOpen: false }));
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

                addToast(t('settings.logsPurged').replace('{count}', toDelete.length.toString()), "success");
                fetchLogs(true);
                fetchSystemStats();
                setConfirmData(prev => ({ ...prev, isOpen: false }));
            }
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Settings.handlePurgeLogs', 'DELETE_FAILED');
        } finally {
            setConfirmData(prev => ({ ...prev, loading: false }));
        }
    };




    const initiateLeaveOrg = () => {
        setConfirmData({
            isOpen: true,
            title: t('settings.leaveOrgTitle'),
            message: t('settings.leaveOrgMessage'),
            onConfirm: handleLeaveOrg,
            closeOnConfirm: false
        });
    };

    const handleLeaveOrg = async () => {
        if (!user) return;
        setConfirmData(prev => ({ ...prev, loading: true }));
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
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Settings.handleLeaveOrg', 'UPDATE_FAILED');
            setConfirmData(prev => ({ ...prev, loading: false })); // Only stop loading on error, otherwise we reload
        }
    };

    const handleLogout = async () => {
        try { await signOut(auth); } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Settings.handleLogout', 'AUTH_FAILED'); }
    };

    const handleManageSubscription = async () => {
        if (!user?.organizationId || !hasPermission(user, 'Settings', 'manage')) {
            addToast(t('settings.noPermission'), "error");
            return;
        }
        setSubLoading(true);
        try {
            if (currentOrg?.subscription?.planId === 'discovery') {
                window.location.href = '#/pricing';
            } else {
                await SubscriptionService.manageSubscription(user.organizationId);
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Settings.handleManageSubscription', 'UNKNOWN_ERROR');
        } finally {
            setSubLoading(false);
        }
    };

    const handleDeleteAccount = () => {
        setConfirmData({
            isOpen: true,
            title: t('settings.deleteAccountTitle'),
            message: t('settings.deleteAccountMessage'),
            onConfirm: async () => {
                if (!user || !auth.currentUser) return;
                setConfirmData(prev => ({ ...prev, loading: true }));
                try {
                    await AccountService.deleteAccount(user, auth.currentUser);
                    addToast(t('settings.accountDeleted'), "success");
                    // Redirect handled by auth state change in App.tsx
                } catch (e) {
                    ErrorLogger.handleErrorWithToast(e, 'Settings.handleDeleteAccount', 'DELETE_FAILED');
                    if ((e as { code?: string }).code === 'auth/requires-recent-login') {
                        addToast(t('settings.reloginRequired'), "error");
                    } else {
                        ErrorLogger.handleErrorWithToast(e, 'Settings.handleDeleteAccount', 'DELETE_FAILED');
                    }
                    setConfirmData(prev => ({ ...prev, loading: false }));
                }
            },
            closeOnConfirm: false
        });
    };

    const handleDeleteOrganization = () => {
        const confirmationWord = "SUPPRIMER";
        const input = prompt(t('settings.deleteOrgPrompt').replace('{word}', confirmationWord));

        if (input === confirmationWord && user?.organizationId && currentOrg?.ownerId === user?.uid) {
            setMaintenanceLoading(true);
            AccountService.deleteOrganization(user.organizationId)
                .then(async () => {
                    addToast(t('settings.orgDeleted'), "success");
                    // Force logout and reload
                    await signOut(auth);
                    window.location.reload();
                })

                .catch((e) => {
                    ErrorLogger.handleErrorWithToast(e, 'Settings.handleDeleteOrganization', 'DELETE_FAILED');
                })
                .finally(() => setMaintenanceLoading(false));
        } else if (input !== null) {
            addToast(t('settings.incorrectConfirmation'), "error");
        }
    };

    const initiateDemoMode = () => {
        setConfirmData({
            isOpen: true,
            title: "Activer le Mode Démonstration",
            message: "Ceci va générer des données fictives complètes (Actifs, Risques, Projets, Audits, Incidents, etc.) pour vous permettre de tester toutes les fonctionnalités. Cela n'effacera pas vos données existantes mais ajoutera de nouvelles entrées.",
            onConfirm: handleActivateDemoMode,
            closeOnConfirm: false
        });
    };

    const handleActivateDemoMode = async () => {
        if (!user || !user.organizationId) return;
        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            await DemoDataService.generateDemoData(user.organizationId, user);
            addToast("Données de démonstration générées avec succès !", "success");
            // Reload to refresh all views
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Settings.handleActivateDemoMode', 'UNKNOWN_ERROR');
            setConfirmData(prev => ({ ...prev, loading: false }));
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
                loading={confirmData.loading}
                closeOnConfirm={confirmData.closeOnConfirm}
            />

            <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">{t('settings.title')}</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2 font-medium">{t('settings.subtitle')}</p>
                {user?.organizationId && (
                    <div className="mt-4 inline-flex items-center px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-full text-[10px] font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                        ID: {user.organizationId}
                    </div>
                )}
            </div>

            {/* Subscription Status - Visible to all org members */}
            {user?.organizationId && (
                <div className="mb-8 glass-panel rounded-[2rem] p-6 bg-indigo-50/30 dark:bg-slate-900/10 shadow-sm flex items-center justify-between animate-fade-in-up">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <FileSpreadsheet className="h-6 w-6" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.subscription')} {currentOrg?.subscription?.planId === 'professional' ? 'Professional' : currentOrg?.subscription?.planId === 'enterprise' ? 'Enterprise' : 'Discovery'}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${currentOrg?.subscription?.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                    {currentOrg?.subscription?.status === 'active' ? t('settings.active') : t('settings.free')}
                                </span>
                                {currentOrg?.subscription?.currentPeriodEnd && (
                                    <span className="text-xs text-slate-600">{t('settings.renewalDate').replace('{date}', new Date((currentOrg.subscription.currentPeriodEnd as unknown as { seconds: number }).seconds ? (currentOrg.subscription.currentPeriodEnd as unknown as { seconds: number }).seconds * 1000 : (currentOrg.subscription.currentPeriodEnd as string | number)).toLocaleDateString())}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button
                        onClick={handleManageSubscription}
                        isLoading={subLoading}
                        variant="outline"
                        className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                        {currentOrg?.subscription?.planId === 'discovery' ? t('settings.upgradeSub') : t('settings.manage')}
                    </Button>
                </div>
            )}



            <div className="space-y-8">
                {/* Profile */}
                <div className="glass-panel rounded-[2.5rem] p-8 relative overflow-hidden shadow-sm">
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center transition-transform group-hover:scale-105">
                                {uploadingPhoto ? (
                                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : user?.photoURL ? (
                                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-4xl font-bold text-slate-600 dark:text-slate-300">{user?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
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
                        <div className="flex items-center gap-2 mt-2">
                            <p className="text-sm text-slate-600 dark:text-slate-400">{user?.email}</p>
                            <button
                                onClick={handleCheckBreach}
                                disabled={breachCheckLoading}
                                className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                title="Vérifier si cet email a été compromis (Have I Been Pwned)"
                            >
                                {breachCheckLoading ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <ShieldAlert className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>

                    <form onSubmit={profileForm.handleSubmit(handleUpdateProfile)} className="space-y-5 max-w-sm mx-auto">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('settings.displayName')}</label>
                            <input type="text" className="w-full px-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium"
                                {...profileForm.register('displayName')} />
                            {profileForm.formState.errors.displayName && <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.displayName.message}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('settings.department')}</label>
                            <input type="text" className="w-full px-4 py-3.5 bg-slate-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none font-medium"
                                {...profileForm.register('department')} />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('settings.role')}</label>
                            <div className="relative">
                                <Controller
                                    control={profileForm.control}
                                    name="role"
                                    render={({ field }) => (
                                        <CustomSelect
                                            label=""
                                            value={field.value}
                                            onChange={field.onChange}
                                            options={[
                                                { value: 'admin', label: 'Administrateur' },
                                                { value: 'rssi', label: 'RSSI / CISO' },
                                                { value: 'direction', label: 'Direction / DPO' },
                                                { value: 'project_manager', label: 'Chef de Projet' },
                                                { value: 'auditor', label: 'Auditeur' },
                                                { value: 'user', label: 'Utilisateur' }
                                            ]}
                                            className={!(user?.role === 'admin' || currentOrg?.ownerId === user?.uid) ? 'opacity-50 pointer-events-none' : ''}
                                        />
                                    )}
                                />
                            </div>
                            {!(user?.role === 'admin' || currentOrg?.ownerId === user?.uid) && (
                                <p className="text-[10px] text-slate-500 mt-1.5 ml-1">{t('settings.contactAdmin')}</p>
                            )}
                        </div>

                        <Button type="submit" isLoading={savingProfile} className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand-500/20 mt-4">
                            {t('settings.saveProfile')}
                        </Button>
                    </form>
                </div>

                {/* Security & Preferences */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-full">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center"><Key className="h-5 w-5 mr-3 text-indigo-500" />{t('settings.security')}</h3>
                        </div>
                        <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                            <div className="space-y-4">
                                <div>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm dark:text-white"
                                        placeholder={t('settings.newPassword')}
                                        {...passwordForm.register('newPassword')}
                                    />
                                    {passwordForm.formState.errors.newPassword && (
                                        <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.newPassword.message}</p>
                                    )}
                                </div>
                                <div>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm dark:text-white"
                                        placeholder={t('settings.confirmPassword')}
                                        {...passwordForm.register('confirmPassword')}
                                    />
                                    {passwordForm.formState.errors.confirmPassword && (
                                        <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>
                                    )}
                                </div>
                            </div>
                            <Button
                                type="submit"
                                isLoading={changingPassword}
                                className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-900/10 dark:shadow-white/10 mt-4"
                            >
                                {t('settings.changePassword')}
                            </Button>
                        </form>
                    </div>

                    {/* MFA Settings */}
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-full">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center"><ShieldAlert className="h-5 w-5 mr-3 text-emerald-500" />Authentification à deux facteurs (MFA)</h3>
                        </div>
                        <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Sécurisez votre compte en ajoutant une seconde étape de validation.
                            </p>

                            {!isEnrollingMFA && !qrCodeUrl ? (
                                <button
                                    onClick={handleEnrollMFA}
                                    className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-900/10 dark:shadow-white/10 flex items-center justify-center"
                                >
                                    Activer MFA
                                </button>
                            ) : (
                                <div className="space-y-4 animate-fade-in">
                                    {qrCodeUrl && (
                                        <div className="flex flex-col items-center p-4 bg-white rounded-xl border border-slate-200">
                                            {/* We use a secure way to render QR later, for now using a placeholder or external if safe. 
                                                Actually, sending secret to external API is bad. 
                                                I will use a text display of the secret if I can't render QR, or just the otpauth URL.
                                                But wait, I can use a simple canvas or existing lib.
                                                Let's assume I'll add 'qrcode' package if missing.
                                                For now, I'll put a placeholder text.
                                            */}
                                            <p className="text-xs text-slate-600 mb-2 text-center">Scannez ce code avec votre application d'authentification (Google Authenticator, Authy...)</p>
                                            <div className="bg-slate-100 p-2 rounded">
                                                <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32" />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">Code de vérification</label>
                                        <input
                                            type="text"
                                            value={mfaCode}
                                            onChange={(e) => setMfaCode(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-center tracking-widest text-lg dark:text-white"
                                            placeholder="000 000"
                                            maxLength={6}
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setIsEnrollingMFA(false); setQrCodeUrl(null); }}
                                            className="flex-1 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            onClick={handleVerifyMFA}
                                            disabled={verifyingMFA || mfaCode.length < 6}
                                            className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                        >
                                            {verifyingMFA ? '...' : 'Vérifier'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleDisableMFA}
                                className="text-xs text-red-500 hover:text-red-600 font-bold mt-2"
                            >
                                Désactiver MFA
                            </button>
                        </div>
                    </div>

                    {/* AI Settings */}
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-full">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center"><BrainCircuit className="h-5 w-5 mr-3 text-purple-500" />{t('settings.aiSettings')}</h3>
                        </div>
                        <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    {t('settings.aiDescription')}
                                </p>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('settings.geminiApiKey')}</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-sm dark:text-white pr-10"
                                            placeholder="AIzaSy..."
                                            {...profileForm.register('geminiApiKey')}
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                            <Key className="h-4 w-4 text-slate-500" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1.5 ml-1">
                                        {t('settings.geminiPlaceholder')}
                                    </p>
                                </div>


                            </div>
                            <button
                                type="button"
                                onClick={profileForm.handleSubmit(handleUpdateProfile)}
                                disabled={savingProfile}
                                className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-900/10 dark:shadow-white/10 flex items-center justify-center mt-4"
                            >
                                {savingProfile ? '...' : t('settings.saveProfile')}
                            </button>
                        </div>
                    </div>

                    {/* Data Sovereignty & Storage */}
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-full">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                                <Database className="h-5 w-5 mr-3 text-emerald-500" />
                                {t('settings.storageSovereignty')}
                            </h3>
                        </div>
                        <div className="p-6 flex-1 flex flex-col space-y-6">
                            {/* Storage Usage */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('settings.storageUsage')}</span>
                                    <span className="text-xs font-medium text-slate-600">
                                        {formatFileSize(currentOrg?.storageUsed || 0)} / {formatFileSize(1024 * 1024 * 1024)}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${(currentOrg?.storageUsed || 0) / (1024 * 1024 * 1024) > 0.9 ? 'bg-red-500' :
                                            (currentOrg?.storageUsed || 0) / (1024 * 1024 * 1024) > 0.7 ? 'bg-orange-500' : 'bg-blue-500'
                                            }`}
                                        style={{ width: `${Math.min(100, ((currentOrg?.storageUsed || 0) / (1024 * 1024 * 1024)) * 100)}%` }}
                                    ></div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                    {t('settings.quotaInfo')}
                                </p>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    {t('settings.secNumCloudInfo')}
                                </p>
                                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <Database className="h-5 w-5 text-slate-500" />
                                        <div>
                                            <span className="block text-sm font-bold text-slate-900 dark:text-white">{t('settings.secNumCloudStorage')}</span>
                                            <span className="text-xs text-slate-600">{t('settings.ovhHosting')}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!user?.organizationId || !hasPermission(user, 'Settings', 'manage')) return;
                                            if (currentOrg?.subscription?.planId === 'discovery') {
                                                addToast(t('settings.proFeature'), "info");
                                                return;
                                            }
                                            try {
                                                const newValue = !currentOrg?.settings?.enableSecNumCloudStorage;
                                                const orgRef = doc(db, 'organizations', user.organizationId);
                                                await updateDoc(orgRef, {
                                                    'settings.enableSecNumCloudStorage': newValue
                                                });
                                                setCurrentOrg(prev => prev ? {
                                                    ...prev,
                                                    settings: { ...prev.settings, enableSecNumCloudStorage: newValue }
                                                } : null);
                                                addToast(newValue ? t('settings.secNumCloudActivated') : t('settings.secNumCloudDeactivated'), "success");
                                            } catch (e) {
                                                ErrorLogger.handleErrorWithToast(e, 'Settings.toggleSecNumCloud', 'UPDATE_FAILED');
                                            }
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${currentOrg?.settings?.enableSecNumCloudStorage ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'} ${currentOrg?.subscription?.planId === 'discovery' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${currentOrg?.settings?.enableSecNumCloudStorage ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                            {currentOrg?.subscription?.planId === 'discovery' && (
                                <div className="text-center">
                                    <p className="text-xs text-slate-500 mb-2">{t('settings.proFeature')}</p>
                                    <button onClick={() => window.location.href = '#/pricing'} className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                                        {t('settings.upgradeSub')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div >

                    <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-full">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                                {theme === 'dark' ? <Moon className="h-5 w-5 mr-3 text-indigo-500" /> : <Sun className="h-5 w-5 mr-3 text-amber-500" />}
                                {t('settings.appearance')}
                            </h3>
                        </div>
                        <div className="p-6 flex-1 flex flex-col justify-center space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('settings.themeDark')}</span>
                                    {theme === 'dark' && <Moon className="h-4 w-4 text-indigo-400" />}
                                </div>
                                <button onClick={handleThemeToggle} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}>
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/10">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">English</span>
                                    <span className="text-xs text-slate-500">EN</span>
                                </div>
                                <button onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${language === 'en' ? 'bg-brand-600' : 'bg-gray-200'}`}>
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${language === 'en' ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <Button onClick={handleExport} isLoading={exporting} className="w-full flex items-center justify-center px-4 py-3 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition-colors">
                                {!exporting && <Download className="h-4 w-4 mr-2" />}
                                {t('settings.exportJson')}
                            </Button>


                            <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('settings.demoMode')}</span>
                                    <Activity className="h-4 w-4 text-slate-500" />
                                </div>
                                <button
                                    onClick={toggleDemoMode}
                                    className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${demoMode ? 'bg-indigo-100 dark:bg-slate-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                >
                                    {demoMode ? (
                                        <>
                                            <CheckCircle2 className="h-3 w-3" /> {t('settings.demoModeActive')}
                                        </>
                                    ) : (
                                        <>
                                            <Activity className="h-3 w-3" /> {t('settings.demoModeActivate')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Google Calendar */}
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-full">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                                <Calendar className="h-5 w-5 mr-3 text-blue-500" />
                                {t('settings.googleCalendar')}
                            </h3>
                        </div>
                        <div className="p-6 flex-1 flex flex-col justify-center space-y-6">
                            <div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    {t('settings.googleCalendarDescription')}
                                </p>

                                {localStorage.getItem('google_access_token') ? (
                                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20">
                                        <span className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center">
                                            <CheckCircle2 className="h-5 w-5 mr-2" />
                                            {t('settings.accountConnected')}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                localStorage.removeItem('google_access_token');
                                                addToast(t('settings.disconnectGoogle'), "info");
                                                setSavingProfile(prev => !prev);
                                            }}
                                            className="text-xs bg-white dark:bg-white/10 px-3 py-1.5 rounded-lg text-red-500 hover:text-red-600 font-bold shadow-sm"
                                        >
                                            {t('settings.disconnectGoogle')}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => loginToGoogle()}
                                        className="w-full py-3.5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-700 dark:text-white hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center shadow-sm group"
                                    >
                                        <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                                        {t('settings.connectGoogle')}
                                    </button>
                                )}
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Export iCal / Outlook</h4>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                                    Téléchargez vos tâches et audits pour Outlook, Apple Calendar, etc.
                                </p>
                                <Button
                                    onClick={handleExportCalendar}
                                    isLoading={exportingCalendar}
                                    variant="outline"
                                    className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all shadow-sm flex items-center justify-center"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Télécharger .ics
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Admin / Organization */}
                {
                    hasPermission(user, 'Settings', 'manage') && (
                        <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm">
                            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center gap-4 bg-slate-50/50 dark:bg-white/5">
                                <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg">
                                    <Server className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.admin')}</h3>
                                    <p className="text-xs text-slate-600 font-medium">{t('settings.orgAdmin')} {orgForm.watch('orgName')}</p>
                                </div>
                            </div>

                            <div className="p-8 border-b border-gray-100 dark:border-white/5">
                                <form onSubmit={orgForm.handleSubmit(handleUpdateOrg)} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('settings.orgName')}</label>
                                            <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium dark:text-white"
                                                {...orgForm.register('orgName')} />
                                            {orgForm.formState.errors.orgName && <p className="text-red-500 text-xs mt-1">{orgForm.formState.errors.orgName.message}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('settings.contactEmail')}</label>
                                            <input type="email" className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium dark:text-white"
                                                {...orgForm.register('contactEmail')} />
                                            {orgForm.formState.errors.contactEmail && <p className="text-red-500 text-xs mt-1">{orgForm.formState.errors.contactEmail.message}</p>}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('common.address')}</label>
                                            <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium dark:text-white"
                                                {...orgForm.register('address')} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('settings.vatNumber')}</label>
                                            <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-500 outline-none font-medium dark:text-white"
                                                {...orgForm.register('vatNumber')} />
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button type="submit" isLoading={savingOrg} className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg">
                                            {t('settings.saveChanges')}
                                        </Button>
                                    </div>
                                </form>
                            </div>

                            <div className="p-6 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group card-hover" onClick={initiatePurgeLogs}>
                                <div className="flex items-center justify-between mb-3">
                                    <Trash2 className="h-6 w-6 text-orange-500 group-hover:scale-110 transition-transform" />
                                    {maintenanceLoading && <div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>}
                                </div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.purgeLogs')}</h4>
                                <p className="text-xs text-slate-600 mt-1">{t('settings.purgeLogsDesc')}</p>
                            </div>

                            <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-slate-50/30 dark:bg-black/20">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('settings.systemStatus')}</h4>
                                    <div className="flex items-center gap-2">
                                        <Database className="h-4 w-4 text-green-500" />
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-5 gap-4 text-center">
                                    <div className="p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5"><span className="block text-lg font-black text-slate-900 dark:text-white">{sysStats.assets}</span><span className="text-[9px] font-bold text-slate-500 uppercase flex justify-center items-center"><FileText className="h-2.5 w-2.5 mr-1" />Docs</span></div>
                                    <div className="p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5"><span className="block text-lg font-black text-slate-900 dark:text-white">{sysStats.docs}</span><span className="text-[9px] font-bold text-slate-500 uppercase flex justify-center items-center"><FileText className="h-2.5 w-2.5 mr-1" />Docs</span></div>
                                    <div className="p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5"><span className="block text-lg font-black text-slate-900 dark:text-white">{sysStats.risks}</span><span className="text-[9px] font-bold text-slate-500 uppercase flex justify-center items-center"><ShieldAlert className="h-2.5 w-2.5 mr-1" />Risques</span></div>
                                    <div className="p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5"><span className="block text-lg font-black text-slate-900 dark:text-white">{sysStats.logs}</span><span className="text-[9px] font-bold text-slate-500 uppercase">Logs</span></div>
                                    <div className="p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/10" onClick={checkLatency}><span className={`block text-lg font-black ${networkLatency !== 'Erreur' && parseInt(networkLatency) < 200 ? 'text-emerald-500' : 'text-orange-500'}`}>{networkLatency}</span><span className="text-[9px] font-bold text-slate-500 uppercase flex justify-center items-center"><Activity className="h-2.5 w-2.5 mr-1" /> Ping</span></div>
                                </div>
                                <div className="mt-4 flex items-center justify-between p-3 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4 text-blue-500" />
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('common.administration')}</span>
                                    </div>
                                    <span className="text-xs font-mono text-slate-900 dark:text-white">{orgForm.watch('orgName')}</span>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* User Management (Admin) */}
                {
                    user && hasPermission(user, 'User', 'manage') && (
                        <div className="glass-panel rounded-[2.5rem] p-8 border border-white/50 dark:border-white/5 shadow-sm">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
                                    <Users className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.users')}</h3>
                                    <p className="text-xs text-slate-600 font-medium">{t('settings.accessManagement')} ({usersList.length} membres)</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {usersList.map(u => (
                                    <div key={u.uid} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 card-hover transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 font-bold">
                                                {u.photoURL ? <img src={u.photoURL} className="w-full h-full rounded-full object-cover" /> : u.displayName?.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        {u.displayName}
                                                    </p>
                                                    {currentOrg?.ownerId === u.uid && (
                                                        <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex items-center gap-1">
                                                            <Crown size={10} />
                                                            {t('settings.owner')}
                                                        </span>
                                                    )}
                                                    {u.uid === user?.uid && (
                                                        <span className="text-xs text-slate-600 dark:text-slate-400">{t('settings.you')}</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-600">{u.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <select
                                                value={u.role}
                                                onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as UserProfile['role'])}
                                                disabled={u.uid === user.uid || currentOrg?.ownerId === u.uid || updatingUserIds.has(u.uid)}
                                                className={`text-xs font-bold bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 ${updatingUserIds.has(u.uid) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <option value="admin">Admin</option>
                                                <option value="rssi">RSSI</option>
                                                <option value="auditor">Auditeur</option>
                                                <option value="project_manager">Chef de Projet</option>
                                                <option value="direction">Direction</option>
                                                <option value="user">Utilisateur</option>
                                            </select>
                                            <div className="flex items-center gap-2">
                                                {/* Transfer Ownership Button (Only for Owner) */}
                                                {currentOrg?.ownerId === user?.uid && u.uid !== user?.uid && (
                                                    <button
                                                        onClick={() => {
                                                            setTransferTargetId(u.uid);
                                                            setShowTransferModal(true);
                                                        }}
                                                        className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                        title={t('settings.transferOwnership')}
                                                    >
                                                        <ArrowRightLeft size={18} />
                                                    </button>
                                                )}

                                                {/* Remove Member Button */}
                                                {(user?.role === 'admin' || currentOrg?.ownerId === user?.uid) && u.uid !== user?.uid && currentOrg?.ownerId !== u.uid && (
                                                    <button
                                                        onClick={() => initiateRemoveUser(u.uid)}
                                                        disabled={updatingUserIds.has(u.uid)}
                                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                                                        title={t('settings.removeMember')}
                                                    >
                                                        {updatingUserIds.has(u.uid) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={18} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                }

                {/* Audit Logs (Admin) */}
                {
                    hasPermission(user, 'SystemLog', 'read') && (
                        <div className="glass-panel rounded-[2.5rem] p-8 border border-white/50 dark:border-white/5 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mr-4">
                                        <History className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.auditLog')}</h3>
                                        <p className="text-xs text-slate-600 font-medium">{t('settings.traceability')} ({logs.length} entrées)</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasMoreLogs && (
                                        <button onClick={() => fetchLogs(false)} disabled={loadingLogs} className="flex items-center px-3 py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                                            {loadingLogs ? '...' : <><ArrowRight className="h-3.5 w-3.5 mr-1" /> {t('common.view')} +</>}
                                        </button>
                                    )}
                                    <button onClick={() => setLogsExpanded(prev => !prev)} className="px-3 py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                                        {logsExpanded ? t('settings.collapse') : t('settings.expand')}
                                    </button>
                                    <button onClick={handleExportLogsCSV} disabled={exportingLogs} className="flex items-center px-3 py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> {exportingLogs ? 'Export...' : 'CSV'}
                                    </button>
                                </div>
                            </div>
                            <div className={`relative border-l border-slate-200 dark:border-white/10 ml-4 space-y-8 pl-8 ${logsExpanded ? 'max-h-[640px]' : 'max-h-[320px]'} overflow-y-auto custom-scrollbar`}>
                                {logs.map(log => (
                                    <div key={log.id} className="relative group">
                                        <span className="absolute -left-[37px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-black group-hover:bg-brand-500 group-hover:scale-110 transition-all"></span>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </span>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white">
                                                    {log.action} <span className="text-slate-500 font-normal">• {log.resource}</span>
                                                </p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">{log.details}</p>
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
                                    <p className="text-sm text-slate-500 italic">{t('settings.noLogsToPurge')}</p>
                                )}
                            </div>
                            {hasMoreLogs && (
                                <button onClick={() => fetchLogs(false)} disabled={loadingLogs} className="w-full mt-8 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors border border-dashed border-slate-200 dark:border-white/10">
                                    {loadingLogs ? t('common.loading') : t('settings.loadMore')}
                                </button>
                            )}
                        </div>
                    )
                }

                {/* Legal Information */}
                <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm">
                    <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                            <Scale className="h-5 w-5 mr-3 text-slate-600" />
                            {t('settings.legalInfo')}
                        </h3>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => { setLegalTab('mentions'); setShowLegalModal(true); }}
                            className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-left border border-slate-100 dark:border-white/5"
                        >
                            <span className="block text-sm font-bold text-slate-900 dark:text-white mb-1">{t('settings.mentionsLegales')}</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400">{t('settings.editorHosting')}</span>
                        </button>
                        <button
                            onClick={() => { setLegalTab('privacy'); setShowLegalModal(true); }}
                            className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-left border border-slate-100 dark:border-white/5"
                        >
                            <span className="block text-sm font-bold text-slate-900 dark:text-white mb-1">{t('settings.privacyData')}</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400">{t('settings.dataProtection')}</span>
                        </button>
                        <button
                            onClick={() => { setLegalTab('terms'); setShowLegalModal(true); }}
                            className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-left border border-slate-100 dark:border-white/5"
                        >
                            <span className="block text-sm font-bold text-slate-900 dark:text-white mb-1">{t('settings.cgu')}</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400">{t('settings.termsOfUse')}</span>
                        </button>
                    </div>
                </div>

                {/* Demo Mode - Only for admins or owners */}
                {(user?.role === 'admin' || currentOrg?.ownerId === user?.uid) && (
                    <div className="glass-panel rounded-[2.5rem] p-6 border border-indigo-100 dark:border-indigo-900/30 shadow-sm mb-6">
                        <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-4 flex items-center">
                            <Database className="h-5 w-5 mr-2" /> Mode Démonstration
                        </h3>
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20">
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Peupler avec des données de démo</h4>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Génère un environnement complet (Actifs, Risques, Projets...)</p>
                            </div>
                            <Button
                                onClick={initiateDemoMode}
                                isLoading={maintenanceLoading}
                                variant="outline"
                                className="px-4 py-2 bg-white dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-100 dark:border-indigo-900/30 shadow-sm"
                            >
                                {t('common.activate') || 'Activer'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Danger Zone - For everyone */}
                <div className="glass-panel rounded-[2.5rem] p-6 border border-red-100 dark:border-red-900/30 shadow-sm">
                    <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4 flex items-center"><AlertTriangle className="h-5 w-5 mr-2" /> {t('settings.dangerZone')}</h3>
                    <div className="space-y-4">
                        {!hasPermission(user, 'Settings', 'manage') && (
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.leaveOrg')}</h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t('settings.leaveOrgDesc')}</p>
                                </div>
                                <Button onClick={initiateLeaveOrg} variant="outline" className="px-4 py-2 bg-white dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors border border-red-100 dark:border-red-900/30 shadow-sm">
                                    {t('common.leave')}
                                </Button>
                            </div>
                        )}

                        <div className="flex items-center justify-between p-4 rounded-2xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                            <div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.deleteAccount')}</h4>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t('settings.deleteAccountDesc')}</p>
                            </div>
                            <Button onClick={handleDeleteAccount} variant="destructive" className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20">
                                {t('common.delete')}
                            </Button>
                        </div>

                        {hasPermission(user, 'Settings', 'manage') && (
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t('settings.deleteOrg')}</h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t('settings.deleteOrgDesc')}</p>
                                </div>
                                <Button onClick={handleDeleteOrganization} variant="destructive" className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20">
                                    {t('settings.destroy')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div >

            <ConfirmModal
                isOpen={showTransferModal}
                onClose={() => setShowTransferModal(false)}
                onConfirm={handleTransferOwnership}
                title={t('settings.transferOwnership')}
                message={t('settings.transferOwnershipDesc')}
                confirmText={t('settings.transfer')}
                cancelText={t('common.cancel')}
                type="danger"
                loading={isTransferring}
            />

            <LegalModal
                isOpen={showLegalModal}
                onClose={() => setShowLegalModal(false)}
                initialTab={legalTab}
            />
            <div className="flex justify-center pb-6 flex-col items-center gap-4">
                <button onClick={handleLogout} className="flex items-center text-red-500 hover:text-red-600 text-sm font-bold px-6 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                    <LogOut className="h-4 w-4 mr-2" /> {t('common.logout')}
                </button>
                <div className="text-center">
                    <p className="text-[10px] text-slate-500 font-mono opacity-60">
                        Sentinel GRC v2.0.0 • Build {__BUILD_DATE__}
                    </p>
                </div>
            </div>
        </div >
    );
};
