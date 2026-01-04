import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { ProcessingActivity, UserProfile, Asset, Risk, SystemLog } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { PrivacyService } from '../services/PrivacyService';

export function usePrivacy() {
    const { user, addToast } = useStore();

    // Data State
    const [activities, setActivities] = useState<ProcessingActivity[]>([]);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [assetsList, setAssetsList] = useState<Asset[]>([]);
    const [risksList, setRisksList] = useState<Risk[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [selectedActivity, setSelectedActivity] = useState<ProcessingActivity | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [viewingAssessmentId, setViewingAssessmentId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [activityHistory, setActivityHistory] = useState<SystemLog[]>([]);
    const [stats, setStats] = useState({ total: 0, sensitive: 0, dpiaMissing: 0, review: 0 });

    // Initial Fetch
    const organizationId = user?.organizationId;

    const fetchData = useCallback(async () => {
        // Allow fetch in demo mode even if no org ID (or use mock org)
        if (!organizationId && !useStore.getState().demoMode) return;

        setLoading(true);
        try {
            const isDemo = useStore.getState().demoMode;
            let fetchedActivities: ProcessingActivity[] = [];
            let loadedUsers: UserProfile[] = [];
            let loadedAssets: Asset[] = [];
            let loadedRisks: Risk[] = [];

            if (isDemo) {
                // Load from MockDataService
                import('../services/mockDataService').then(({ MockDataService }) => {
                    const fetchedActivities = MockDataService.getCollection('activities') as ProcessingActivity[];
                    const loadedUsers = MockDataService.getCollection('users') as unknown as UserProfile[];
                    const loadedAssets = MockDataService.getCollection('assets') as Asset[];
                    const loadedRisks = MockDataService.getCollection('risks') as Risk[];

                    // Resolve managerId
                    const resolvedData = fetchedActivities.map(a => {
                        if (!a.managerId && a.manager) {
                            const managerUser = loadedUsers.find(u => u.displayName === a.manager);
                            if (managerUser) return { ...a, managerId: managerUser.uid };
                        }
                        return a;
                    });
                    resolvedData.sort((a, b) => a.name.localeCompare(b.name));

                    setActivities(resolvedData);
                    setUsersList(loadedUsers);
                    setAssetsList(loadedAssets);
                    setRisksList(loadedRisks);

                    // Calculate Stats
                    const total = resolvedData.length;
                    const sensitive = resolvedData.filter(a => a.dataCategories.some(c => ['Santé (Sensible)', 'Biométrique', 'Judiciaire'].includes(c))).length;
                    const dpiaMissing = resolvedData.filter(a => a.dataCategories.some(c => ['Santé (Sensible)', 'Biométrique', 'Judiciaire'].includes(c)) && !a.hasDPIA).length;
                    const review = resolvedData.filter(a => a.status !== 'Actif').length;

                    setStats({ total, sensitive, dpiaMissing, review });
                    setStats({ total, sensitive, dpiaMissing, review });
                    setLoading(false);
                }).catch(_err => {
                    setLoading(false);
                });
                return;
            } else {
                if (!organizationId) return;
                // Use PrivacyService for activities
                fetchedActivities = await PrivacyService.fetchActivities(organizationId);

                // Fetch other dependencies directly for now
                const results = await Promise.allSettled([
                    getDocs(query(collection(db, 'users'), where('organizationId', '==', organizationId), limit(100))),
                    getDocs(query(collection(db, 'assets'), where('organizationId', '==', organizationId), limit(500))),
                    getDocs(query(collection(db, 'risks'), where('organizationId', '==', organizationId), limit(500)))
                ]);

                const usersSnapshot = results[0].status === 'fulfilled' ? results[0].value : { docs: [] };
                const assetsSnapshot = results[1].status === 'fulfilled' ? results[1].value : { docs: [] };
                const risksSnapshot = results[2].status === 'fulfilled' ? results[2].value : { docs: [] };

                loadedUsers = usersSnapshot.docs.map(doc => doc.data() as UserProfile);
                loadedAssets = assetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
                loadedRisks = risksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Risk));
            }

            // Resolve managerId
            const resolvedData = fetchedActivities.map(a => {
                if (!a.managerId && a.manager) {
                    const managerUser = loadedUsers.find(u => u.displayName === a.manager);
                    if (managerUser) return { ...a, managerId: managerUser.uid };
                }
                return a;
            });
            resolvedData.sort((a, b) => a.name.localeCompare(b.name));

            setActivities(resolvedData);
            setUsersList(loadedUsers);
            setAssetsList(loadedAssets);
            setRisksList(loadedRisks);

            // Calculate Stats
            const total = resolvedData.length;
            const sensitive = resolvedData.filter(a => a.dataCategories.some(c => ['Santé (Sensible)', 'Biométrique', 'Judiciaire'].includes(c))).length;
            const dpiaMissing = resolvedData.filter(a => a.dataCategories.some(c => ['Santé (Sensible)', 'Biométrique', 'Judiciaire'].includes(c)) && !a.hasDPIA).length;
            const review = resolvedData.filter(a => a.status !== 'Actif').length;

            setStats({ total, sensitive, dpiaMissing, review });

        } catch (_error) {
            ErrorLogger.handleErrorWithToast(_error, 'usePrivacy.fetchData');
        } finally {
            setLoading(false);
        }
    }, [organizationId]);

    const fetchHistory = useCallback(async (activityId: string) => {
        if (!user?.organizationId) return;
        try {
            const logs = await PrivacyService.fetchActivityHistory(user.organizationId, activityId, selectedActivity?.name);
            setActivityHistory(logs);
        } catch (_error) {
            ErrorLogger.error(_error, 'usePrivacy.fetchHistory');
        }
    }, [user?.organizationId, selectedActivity?.name]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (selectedActivity) {
            fetchHistory(selectedActivity.id);
        }
    }, [selectedActivity, fetchHistory]);

    // Handlers
    const handleCreate = async (data: Partial<ProcessingActivity>) => {
        if (!user?.organizationId) return;
        if (user.role !== 'rssi' && user.role !== 'direction' && user.role !== 'project_manager') {
            addToast("Permission refusée", "error");
            return;
        }
        try {
            const newActivity: Omit<ProcessingActivity, 'id'> = {
                name: data.name || 'Nouveau Traitement',
                purpose: data.purpose || 'Objectif non défini',
                manager: data.manager || 'Non assigné',
                status: data.status || 'Actif',
                legalBasis: data.legalBasis || 'Intérêt Légitime',
                hasDPIA: data.hasDPIA || false,
                dataCategories: data.dataCategories || [],
                dataSubjects: data.dataSubjects || [],
                retentionPeriod: data.retentionPeriod || '5 ans',
                ...data,
                organizationId: user.organizationId,
                createdBy: user.uid,
                // Services handle createdAt/updatedAt
                createdAt: '', // Placeholder, ignored by service
                updatedAt: ''
            };

            await PrivacyService.createActivity(newActivity, user);

            addToast("Traitement ajouté avec succès", "success");
            setShowCreateModal(false);
            fetchData();
        } catch {
            // Already handled by service typically, but double check
        }
    };

    const handleUpdate = async (data: Partial<ProcessingActivity>) => {
        if (!selectedActivity || !user || !user.organizationId) return;
        // RBAC Check
        if (user.role !== 'rssi' && user.role !== 'direction' && user.role !== 'project_manager') {
            addToast("Permission refusée", "error");
            return;
        }
        try {
            await PrivacyService.updateActivity(selectedActivity.id, data, user);

            // Optimistic update
            const updatedDoc = { ...selectedActivity, ...data };
            setActivities(prev => prev.map(a => a.id === selectedActivity.id ? updatedDoc : a));
            setSelectedActivity(updatedDoc);
            setIsEditing(false);
            addToast("Traitement mis à jour", "success");
        } catch {
            // Handled by service
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!user || !user.organizationId) return;
        if (user.role !== 'rssi' && user.role !== 'direction') {
            addToast("Permission refusée : Seuls les RSSI/Direction peuvent supprimer.", "error");
            return;
        }
        try {
            await PrivacyService.deleteActivity(id, name, user);

            setActivities(prev => prev.filter(a => a.id !== id));
            if (selectedActivity?.id === id) {
                setSelectedActivity(null);
            }
            addToast("Traitement supprimé", "success");
        } catch {
            // Handled by service
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!user || !user.organizationId) return;
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) return;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const dataLines = lines.slice(1);
            const activitiesToImport: Omit<ProcessingActivity, 'id'>[] = [];

            for (const line of dataLines) {
                const cols = line.split(',');
                if (cols.length >= 1) {
                    const name = cols[0]?.replace(/"/g, '').trim();
                    const purpose = cols[1]?.replace(/"/g, '').trim();

                    if (name) {
                        activitiesToImport.push({
                            organizationId: user.organizationId!,
                            name,
                            purpose: purpose || '',
                            manager: user.displayName || '',
                            managerId: user.uid,
                            status: 'Actif',
                            createdAt: '',
                            updatedAt: '',
                            createdBy: user.uid,
                            dataCategories: [],
                            dataSubjects: [],
                            legalBasis: 'Intérêt Légitime',
                            retentionPeriod: '5 ans',
                            hasDPIA: false
                        });
                    }
                }
            }

            if (activitiesToImport.length > 0) {
                try {
                    const count = await PrivacyService.importActivities(activitiesToImport, user);
                    addToast(`${count} traitements importés`, "success");
                    fetchData();
                } catch {
                    addToast("Erreur import CSV", "error");
                }
            }
        };
        reader.readAsText(file);
    };

    const handleStartDPIA = async (activity: ProcessingActivity) => {
        if (!user || !user.organizationId) return;
        try {
            const responseId = await PrivacyService.startDPIA(activity, user);
            addToast("Dossier DPIA créé", "success");
            setViewingAssessmentId(responseId);
            fetchData();
            if (selectedActivity?.id === activity.id) {
                setSelectedActivity(prev => prev ? { ...prev, hasDPIA: true } : null);
            }
        } catch {
            // Handled
        }
    };

    const handleViewDPIA = async (activity: ProcessingActivity) => {
        try {
            const responseId = await PrivacyService.findDPIAResponseId(activity.id);
            if (responseId) {
                setViewingAssessmentId(responseId);
            } else {
                handleStartDPIA(activity);
            }
        } catch (_error) {
            ErrorLogger.handleErrorWithToast(_error, 'Privacy.handleViewDPIA');
        }
    };

    return {
        activities,
        usersList,
        assetsList,
        risksList,
        loading,
        selectedActivity,
        setSelectedActivity,
        isEditing,
        setIsEditing,
        viewingAssessmentId,
        setViewingAssessmentId,
        showCreateModal,
        setShowCreateModal,
        fetchData,
        handleCreate,
        handleUpdate,
        handleDelete,
        handleStartDPIA,
        handleViewDPIA,
        activityHistory,
        stats,
        handleFileUpload
    };
}
