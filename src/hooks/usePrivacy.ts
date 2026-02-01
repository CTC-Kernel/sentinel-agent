import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ProcessingActivity, UserProfile, Asset, Risk, SystemLog } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { PrivacyService } from '../services/PrivacyService';
import { hasPermission } from '../utils/permissions';

export function usePrivacy() {
    const { user, addToast, t, demoMode } = useStore();

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
    const pendingSelectId = useRef<string | null>(null);

    const organizationId = user?.organizationId;

    // Realtime Data Subscription
    useEffect(() => {
        if (!organizationId && !demoMode) {
            setLoading(false);
            return;
        }

        const isDemo = demoMode;
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
    }, [organizationId, demoMode]);

    // Auto-open inspector for newly created activity
    useEffect(() => {
        if (!pendingSelectId.current || loading) return;
        const created = activities.find(a => a.id === pendingSelectId.current);
        if (created) {
            pendingSelectId.current = null;
            setSelectedActivity(created);
        }
    }, [activities, loading]);

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
        if (!hasPermission(user, 'ProcessingActivity', 'create')) {
            addToast(t('common.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
            return;
        }
        try {
            const newActivity: Omit<ProcessingActivity, 'id'> = {
                name: data.name || t('privacy.defaultName', { defaultValue: 'New Processing Activity' }),
                purpose: data.purpose || t('privacy.defaultPurpose', { defaultValue: 'Purpose not defined' }),
                manager: data.manager || t('privacy.defaultManager', { defaultValue: 'Not assigned' }),
                status: data.status || 'Actif',
                legalBasis: data.legalBasis || 'Intérêt Légitime',
                hasDPIA: data.hasDPIA || false,
                dataCategories: data.dataCategories || [],
                dataSubjects: data.dataSubjects || [],
                retentionPeriod: data.retentionPeriod || '5 years',
                ...data,
                organizationId: user.organizationId,
                createdBy: user.uid,
                createdAt: '',
                updatedAt: ''
            };
            const newId = await PrivacyService.createActivity(newActivity, user);
            if (newId) {
                pendingSelectId.current = newId;
            }
            addToast(t('privacy.activityCreated', { defaultValue: 'Processing activity created. Complete the data mapping.' }), "success");
            setShowCreateModal(false);
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Privacy.create');
        }
    };

    const handleUpdate = async (data: Partial<ProcessingActivity>) => {
        if (!selectedActivity || !user) return;
        if (!hasPermission(user, 'ProcessingActivity', 'update')) {
            addToast(t('common.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
            return;
        }
        try {
            await PrivacyService.updateActivity(selectedActivity.id, data, user);
            setIsEditing(false);
            addToast(t('privacy.toast.activityUpdated', { defaultValue: 'Processing activity updated' }), "success");
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Privacy.update');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!user) return;
        if (!hasPermission(user, 'ProcessingActivity', 'delete')) {
            addToast(t('common.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
            return;
        }
        try {
            await PrivacyService.deleteActivity(id, name, user);
            if (selectedActivity?.id === id) {
                // Auto-select the next available activity, or null if none remain
                const remaining = activities.filter(a => a.id !== id);
                setSelectedActivity(remaining.length > 0 ? remaining[0] : null);
            }
            addToast(t('privacy.toast.activityDeleted', { defaultValue: 'Processing activity deleted' }), "success");
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Privacy.delete');
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!user?.organizationId) return;
        if (!hasPermission(user, 'ProcessingActivity', 'update')) {
            addToast(t('common.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
            return;
        }
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
                    addToast(t('privacy.toast.activitiesImported', { defaultValue: `${toImport.length} processing activities imported`, count: toImport.length }), "success");
                } catch {
                    addToast(t('privacy.toast.importError', { defaultValue: 'CSV import error' }), "error");
                }
            }
        };
        reader.readAsText(file);
    };

    const handleStartDPIA = async (activity: ProcessingActivity) => {
        if (!user) return;
        if (!hasPermission(user, 'ProcessingActivity', 'update')) {
            addToast(t('common.permissionDenied', { defaultValue: 'Permission denied' }), 'error');
            return;
        }
        try {
            const responseId = await PrivacyService.startDPIA(activity, user);
            addToast(t('privacy.toast.dpiaCreated', { defaultValue: 'DPIA record created' }), "success");
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
