import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
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

    const organizationId = user?.organizationId;

    // Realtime Data Subscription
    useEffect(() => {
        if (!organizationId && !useStore.getState().demoMode) {
            setLoading(false);
            return;
        }

        const isDemo = useStore.getState().demoMode;
        if (isDemo) {
            const loadDemo = async () => {
                setLoading(true);
                try {
                    const { MockDataService } = await import('../services/mockDataService');
                    setActivities(MockDataService.getCollection('activities') as ProcessingActivity[]);
                    setUsersList(MockDataService.getCollection('users') as unknown as UserProfile[]);
                    setAssetsList(MockDataService.getCollection('assets') as Asset[]);
                    setRisksList(MockDataService.getCollection('risks') as Risk[]);
                } catch (err) {
                    ErrorLogger.error(err, 'usePrivacy.demo');
                } finally {
                    setLoading(false);
                }
            };
            loadDemo();
            return;
        }

        setLoading(true);
        const unsubActivities = onSnapshot(
            query(collection(db, 'processing_activities'), where('organizationId', '==', organizationId)),
            (snap) => {
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProcessingActivity));
                setActivities(data.sort((a, b) => a.name.localeCompare(b.name)));
                setLoading(false);
            },
            (err) => ErrorLogger.error(err, 'usePrivacy.activities')
        );

        const unsubUsers = onSnapshot(
            query(collection(db, 'users'), where('organizationId', '==', organizationId), limit(100)),
            (snap) => setUsersList(snap.docs.map(d => d.data() as UserProfile))
        );

        const unsubAssets = onSnapshot(
            query(collection(db, 'assets'), where('organizationId', '==', organizationId), limit(500)),
            (snap) => setAssetsList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Asset)))
        );

        const unsubRisks = onSnapshot(
            query(collection(db, 'risks'), where('organizationId', '==', organizationId), limit(500)),
            (snap) => setRisksList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Risk)))
        );

        return () => {
            unsubActivities();
            unsubUsers();
            unsubAssets();
            unsubRisks();
        };
    }, [organizationId]);

    // Resolved Activities with Manager IDs
    const resolvedActivities = useMemo(() => {
        return activities.map(a => {
            if (!a.managerId && a.manager) {
                const managerUser = usersList.find(u => u.displayName === a.manager);
                if (managerUser) return { ...a, managerId: managerUser.uid };
            }
            return a;
        });
    }, [activities, usersList]);

    // Stats calculation
    const stats = useMemo(() => ({
        total: resolvedActivities.length,
        sensitive: resolvedActivities.filter(a => a.dataCategories?.some(c => ['Santé (Sensible)', 'Biométrique', 'Judiciaire'].includes(c))).length,
        dpiaMissing: resolvedActivities.filter(a => a.dataCategories?.some(c => ['Santé (Sensible)', 'Biométrique', 'Judiciaire'].includes(c)) && !a.hasDPIA).length,
        review: resolvedActivities.filter(a => a.status !== 'Actif').length
    }), [resolvedActivities]);

    // History fetching (Manual for now as it's targeted)
    const fetchHistory = useCallback(async (activityId: string) => {
        if (!organizationId) return;
        try {
            const logs = await PrivacyService.fetchActivityHistory(organizationId, activityId, selectedActivity?.name);
            setActivityHistory(logs);
        } catch (err) {
            ErrorLogger.error(err, 'usePrivacy.history');
        }
    }, [organizationId, selectedActivity?.name]);

    useEffect(() => {
        if (selectedActivity) fetchHistory(selectedActivity.id);
    }, [selectedActivity, fetchHistory]);

    // Action Handlers
    const handleCreate = async (data: Partial<ProcessingActivity>) => {
        if (!user?.organizationId) return;
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
                createdAt: '',
                updatedAt: ''
            };
            await PrivacyService.createActivity(newActivity, user);
            addToast("Traitement ajouté", "success");
            setShowCreateModal(false);
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Privacy.create');
        }
    };

    const handleUpdate = async (data: Partial<ProcessingActivity>) => {
        if (!selectedActivity || !user) return;
        try {
            await PrivacyService.updateActivity(selectedActivity.id, data, user);
            setIsEditing(false);
            addToast("Traitement mis à jour", "success");
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Privacy.update');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!user) return;
        try {
            await PrivacyService.deleteActivity(id, name, user);
            if (selectedActivity?.id === id) setSelectedActivity(null);
            addToast("Traitement supprimé", "success");
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Privacy.delete');
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!user?.organizationId) return;
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) return;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const dataLines = lines.slice(1);
            const toImport: Omit<ProcessingActivity, 'id'>[] = [];

            for (const line of dataLines) {
                const cols = line.split(',');
                const name = cols[0]?.replace(/"/g, '').trim();
                const purpose = cols[1]?.replace(/"/g, '').trim();

                if (name) {
                    toImport.push({
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

            if (toImport.length > 0) {
                try {
                    await PrivacyService.importActivities(toImport, user);
                    addToast(`${toImport.length} traitements importés`, "success");
                } catch (_err) {
                    addToast("Erreur import CSV", "error");
                }
            }
        };
        reader.readAsText(file);
    };

    const handleStartDPIA = async (activity: ProcessingActivity) => {
        if (!user) return;
        try {
            const responseId = await PrivacyService.startDPIA(activity, user);
            addToast("Dossier DPIA créé", "success");
            setViewingAssessmentId(responseId);
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Privacy.startDPIA');
        }
    };

    const handleViewDPIA = async (activity: ProcessingActivity) => {
        try {
            const responseId = await PrivacyService.findDPIAResponseId(activity.id);
            if (responseId) setViewingAssessmentId(responseId);
            else handleStartDPIA(activity);
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Privacy.viewDPIA');
        }
    };

    return {
        activities: resolvedActivities,
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
        fetchData: () => { }, // No-op for compatibility
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
