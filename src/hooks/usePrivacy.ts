import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where, addDoc, limit, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ProcessingActivity, UserProfile, Asset, Risk, SystemLog } from '../types';
import { useStore } from '../store';
import { DPIA_TEMPLATE } from '../data/dpiatemplate';
import { SupplierService } from '../services/SupplierService';
import { ErrorLogger } from '../services/errorLogger';
import { logAction } from '../services/logger';
import { sanitizeData } from '../utils/dataSanitizer';

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
    const fetchData = useCallback(async () => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'processing_activities'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId)))
            ]);



            // Manual unpacking because Promise.allSettled typing is tricky with Firestore

            const activitiesSnapshot = results[0].status === 'fulfilled' ? results[0].value : { docs: [] };

            const usersSnapshot = results[1].status === 'fulfilled' ? results[1].value : { docs: [] };

            const assetsSnapshot = results[2].status === 'fulfilled' ? results[2].value : { docs: [] };

            const risksSnapshot = results[3].status === 'fulfilled' ? results[3].value : { docs: [] };


            const loadedActivities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcessingActivity));

            const loadedUsers = usersSnapshot.docs.map(doc => doc.data() as UserProfile);

            const loadedAssets = assetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));

            const loadedRisks = risksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Risk));

            // Resolve managerId
            const resolvedData = loadedActivities.map(a => {
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
            const total = loadedActivities.length;
            const sensitive = loadedActivities.filter(a => a.dataCategories.some(c => ['Santé (Sensible)', 'Biométrique', 'Judiciaire'].includes(c))).length;
            const dpiaMissing = loadedActivities.filter(a => a.dataCategories.some(c => ['Santé (Sensible)', 'Biométrique', 'Judiciaire'].includes(c)) && !a.hasDPIA).length;
            const review = loadedActivities.filter(a => a.status !== 'Actif').length;

            setStats({ total, sensitive, dpiaMissing, review });

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'usePrivacy.fetchData');
        } finally {
            setLoading(false);
        }
    }, [user?.organizationId]);

    const fetchHistory = useCallback(async (activityId: string) => {
        if (!user?.organizationId) return;
        try {
            const logsRef = collection(db, 'system_logs');
            const q = query(
                logsRef,
                where('organizationId', '==', user.organizationId),
                limit(50)
            );
            // Client side filtering for entityId as compound queries can be tricky without index
            const snapshot = await getDocs(q);
            const logs = snapshot.docs.map(doc => doc.data() as SystemLog);
            const filteredLogs = logs.filter(l => (l.resource === 'Privacy' && l.resourceId === activityId) || (l.details?.includes(selectedActivity?.name || '')));

            setActivityHistory(filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        } catch (error) {
            ErrorLogger.error(error, 'usePrivacy.fetchHistory');
        }
    }, [user?.organizationId, selectedActivity]);

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
        try {
            const newActivity: Omit<ProcessingActivity, 'id'> = {
                // Default values & Partial overrides
                name: data.name || 'Nouveau Traitement',
                purpose: data.purpose || 'Objectif non défini',
                manager: data.manager || 'Non assigné',
                status: data.status || 'Actif',
                legalBasis: data.legalBasis || 'Intérêt Légitime',
                hasDPIA: data.hasDPIA || false,
                dataCategories: data.dataCategories || [],
                dataSubjects: data.dataSubjects || [],
                retentionPeriod: data.retentionPeriod || '5 ans',
                // Spread remaining data (if any other fields exist in Partial)
                ...data,
                // Critical system overrides (must come last to prevent overwrite)
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: user.uid,
            };

            const docRef = await addDoc(collection(db, 'processing_activities'), sanitizeData(newActivity));

            await logAction(
                user,
                'CREATE',
                'Privacy',
                `Création du traitement: ${data.name}`,
                undefined,
                docRef.id
            );

            addToast("Traitement ajouté avec succès", "success");
            setShowCreateModal(false);
            fetchData();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Privacy.handleCreate');
        }
    };

    const handleUpdate = async (data: Partial<ProcessingActivity>) => {
        if (!selectedActivity || !user?.organizationId) return;
        try {
            const updatedDoc = {
                ...selectedActivity,
                ...data,
                updatedAt: new Date().toISOString()
            };
            await updateDoc(doc(db, 'processing_activities', selectedActivity.id), sanitizeData(updatedDoc));

            await logAction(
                user,
                'UPDATE',
                'Privacy',
                `Mise à jour du traitement: ${selectedActivity.name}`,
                undefined,
                selectedActivity.id
            );

            setActivities(prev => prev.map(a => a.id === selectedActivity.id ? updatedDoc : a));
            setSelectedActivity(updatedDoc);
            setIsEditing(false);
            addToast("Traitement mis à jour", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Privacy.handleUpdate');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!user?.organizationId) return;
        try {
            await deleteDoc(doc(db, 'processing_activities', id));

            await logAction(
                user,
                'DELETE',
                'Privacy',
                `Suppression du traitement: ${name}`,
                undefined,
                id
            );

            setActivities(prev => prev.filter(a => a.id !== id));
            if (selectedActivity?.id === id) {
                setSelectedActivity(null);
            }
            addToast("Traitement supprimé", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Privacy.handleDelete');
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
            // Skip header
            const dataLines = lines.slice(1);

            const batch = writeBatch(db);
            let operationCount = 0;

            for (const line of dataLines) {
                // Simple CSV parser - upgrade if needed
                const cols = line.split(',');
                if (cols.length >= 1) {
                    const name = cols[0]?.replace(/"/g, '').trim();
                    const purpose = cols[1]?.replace(/"/g, '').trim();

                    if (name) {
                        const newRef = doc(collection(db, 'processing_activities'));
                        batch.set(newRef, {
                            organizationId: user.organizationId,
                            name,
                            purpose: purpose || '',
                            manager: user.displayName || '',
                            managerId: user.uid,
                            status: 'Actif',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            createdBy: user.uid,
                            dataCategories: [],
                            dataSubjects: [],
                            legalBasis: 'Intérêt Légitime',
                            retentionPeriod: '5 ans',
                            hasDPIA: false
                        });
                        operationCount++;
                    }
                }
            }

            if (operationCount > 0) {
                try {
                    await batch.commit();
                    await logAction(
                        user,
                        'IMPORT',
                        'Privacy',
                        `Import CSV de ${operationCount} traitements`
                    );
                    addToast(`${operationCount} traitements importés`, "success");
                    fetchData();
                } catch (error) {
                    addToast("Erreur import CSV", "error");
                    ErrorLogger.handleErrorWithToast(error, 'Privacy.handleImport');
                }
            }
        };
        reader.readAsText(file);
    };

    // DPIA Handlers
    const handleStartDPIA = async (activity: ProcessingActivity) => {
        if (!user?.organizationId) return;

        try {
            // 1. Ensure DPIA Template exists
            const templateRef = doc(db, 'questionnaire_templates', DPIA_TEMPLATE.id);
            await setDoc(templateRef, { ...DPIA_TEMPLATE, organizationId: 'system' }, { merge: true });

            // 2. Create Assessment
            const responseId = await SupplierService.createAssessment(
                user.organizationId,
                activity.id,
                activity.name,
                DPIA_TEMPLATE
            );

            // 3. Update Activity
            await updateDoc(doc(db, 'processing_activities', activity.id), {
                hasDPIA: true,
                updatedAt: new Date().toISOString()
            });

            addToast("Dossier DPIA créé", "success");

            // 4. Open View
            setViewingAssessmentId(responseId);
            fetchData();

            // Update selected activity if open
            if (selectedActivity?.id === activity.id) {
                setSelectedActivity(prev => prev ? { ...prev, hasDPIA: true } : null);
            }

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Privacy.handleStartDPIA');
        }
    };

    const handleViewDPIA = async (activity: ProcessingActivity) => {
        if (!user?.organizationId) return;
        try {
            const q = query(
                collection(db, 'questionnaire_responses'),
                where('supplierId', '==', activity.id),
                where('templateId', '==', DPIA_TEMPLATE.id)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
                // Sort by sentDate
                docs.sort((a: { sentDate: string }, b: { sentDate: string }) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime());
                setViewingAssessmentId(docs[0].id);
            } else {
                handleStartDPIA(activity);
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Privacy.handleViewDPIA');
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
