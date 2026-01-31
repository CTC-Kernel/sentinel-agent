
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useFirestoreCollection } from '../useFirestore';
import { where, collection, addDoc, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Audit, Control, Asset, Risk, UserProfile, Document, Project, Finding, AuditChecklist } from '../../types';
import { canEditResource, canDeleteResource } from '../../utils/permissions';
import { logAction } from '../../services/logger';
import { ErrorLogger } from '../../services/errorLogger';
import { AuditPlannerService } from '../../services/AuditPlannerService';
import { AuditService } from '../../services/auditService';
import { sanitizeData } from '../../utils/dataSanitizer';
import { buildAppUrl } from '../../config/appConfig';
import { analyticsService } from '../../services/analyticsService';
import { generateICS, downloadICS } from '../../utils/calendarUtils';
import { NotificationService } from '../../services/notificationService';
import { CsvParser } from '../../utils/csvUtils';

export interface UseAuditsOptions {
    fetchControls?: boolean;
    fetchAssets?: boolean;
    fetchRisks?: boolean;
    fetchUsers?: boolean;
    fetchDocuments?: boolean;
    fetchProjects?: boolean;
    fetchFindings?: boolean;
}

export const useAudits = (options: UseAuditsOptions = {}) => {
    const { user, addToast, demoMode } = useStore();
    const canEdit = canEditResource(user, 'Audit');
    const canDelete = canDeleteResource(user, 'Audit');

    const {
        fetchControls = false,
        fetchAssets = false,
        fetchRisks = false,
        fetchUsers = false,
        fetchDocuments = false,
        fetchProjects = false,
        fetchFindings = false
    } = options;

    // --- Data Fetching ---

    // Harden demoMode detection
    const isDemo = demoMode || (typeof window !== 'undefined' &&
        (() => { try { return localStorage.getItem('demoMode') === 'true' } catch { return false } })()
    );

    // Firestore Data (Disabled in Demo Mode)
    // Core collection 'audits' is always fetched (unless strict optimization needed later)
    const { data: firestoreAudits, loading: firestoreAuditsLoading, refresh: refreshFirestoreAudits } = useFirestoreCollection<Audit>(
        'audits', [where('organizationId', '==', user?.organizationId)], { logError: true, realtime: true, enabled: !isDemo && !!user?.organizationId }
    );
    const { data: firestoreControls, loading: firestoreControlsLoading } = useFirestoreCollection<Control>(
        'controls',
        fetchControls ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: !isDemo && !!user?.organizationId && fetchControls }
    );
    const { data: firestoreAssets, loading: firestoreAssetsLoading } = useFirestoreCollection<Asset>(
        'assets',
        fetchAssets ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: !isDemo && !!user?.organizationId && fetchAssets }
    );
    const { data: firestoreRisks, loading: firestoreRisksLoading } = useFirestoreCollection<Risk>(
        'risks',
        fetchRisks ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: !isDemo && !!user?.organizationId && fetchRisks }
    );
    const { data: firestoreUsers, loading: firestoreUsersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        fetchUsers ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: !isDemo && !!user?.organizationId && fetchUsers }
    );
    const { data: firestoreDocs, loading: firestoreDocsLoading } = useFirestoreCollection<Document>(
        'documents',
        fetchDocuments ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: !isDemo && !!user?.organizationId && fetchDocuments }
    );
    const { data: firestoreProjects, loading: firestoreProjectsLoading } = useFirestoreCollection<Project>(
        'projects',
        fetchProjects ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: !isDemo && !!user?.organizationId && fetchProjects }
    );
    const { data: firestoreFindings, loading: firestoreFindingsLoading } = useFirestoreCollection<Finding>(
        'findings',
        fetchFindings ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: !isDemo && !!user?.organizationId && fetchFindings }
    );

    // Mock Data State
    const [mockAudits, setMockAudits] = useState<Audit[]>([]);
    const [mockControls, setMockControls] = useState<Control[]>([]);
    const [mockAssets, setMockAssets] = useState<Asset[]>([]);
    const [mockRisks, setMockRisks] = useState<Risk[]>([]);
    const [mockUsers, setMockUsers] = useState<UserProfile[]>([]);
    const [mockDocs, setMockDocs] = useState<Document[]>([]);
    const [mockProjects, setMockProjects] = useState<Project[]>([]);
    const [mockFindings, setMockFindings] = useState<Finding[]>([]);
    const [mockLoading, setMockLoading] = useState(true);

    // Load Mock Data if Demo Mode
    useEffect(() => {
        if (isDemo) {
            setMockLoading(true);
            Promise.all([
                import('../../services/mockDataService').then(module => module.MockDataService.getCollection('audits') as unknown as Audit[]),
                import('../../services/mockDataService').then(module => module.MockDataService.getCollection('controls') as unknown as Control[]),
                import('../../services/mockDataService').then(module => module.MockDataService.getCollection('assets') as unknown as Asset[]),
                import('../../services/mockDataService').then(module => module.MockDataService.getCollection('risks') as unknown as Risk[]),
                import('../../services/mockDataService').then(module => module.MockDataService.getCollection('users') as unknown as UserProfile[]),
                import('../../services/mockDataService').then(module => module.MockDataService.getCollection('documents') as unknown as Document[]),
                import('../../services/mockDataService').then(module => module.MockDataService.getCollection('projects') as unknown as Project[]),
                import('../../services/mockDataService').then(module => module.MockDataService.getCollection('findings') as unknown as Finding[]),
            ]).then(([audits, controls, assets, risks, users, docs, projects, findings]) => {
                setMockAudits(audits);
                setMockControls(controls);
                setMockAssets(assets);
                setMockRisks(risks);
                setMockUsers(users);
                setMockDocs(docs);
                setMockProjects(projects);
                setMockFindings(findings);
                setMockLoading(false);
            }).catch(err => {
                ErrorLogger.error(err, 'useAudits.loadMockData');
                setMockLoading(false);
            });
        }
    }, [isDemo]);

    const rawAudits = isDemo ? mockAudits : firestoreAudits;
    const rawControls = isDemo ? mockControls : firestoreControls;
    const rawAssets = isDemo ? mockAssets : firestoreAssets;
    const rawRisks = isDemo ? mockRisks : firestoreRisks;
    const usersList = isDemo ? mockUsers : firestoreUsers;
    const documents = isDemo ? mockDocs : firestoreDocs;
    const rawProjects = isDemo ? mockProjects : firestoreProjects;
    const allFindings = isDemo ? mockFindings : firestoreFindings;

    // FIX: Ensure usersList is never empty if we are logged in (fallback to self)
    const effectiveUsers = useMemo(() => {
        if (usersList && usersList.length > 0) return usersList;
        if (user && user.uid) return [user];
        return [];
    }, [usersList, user]);

    const loading = isDemo ? mockLoading : (firestoreAuditsLoading || firestoreControlsLoading || firestoreAssetsLoading || firestoreRisksLoading || firestoreUsersLoading || firestoreDocsLoading || firestoreProjectsLoading || firestoreFindingsLoading);

    const refreshAudits = useCallback(() => {
        if (!isDemo) {
            refreshFirestoreAudits();
        }
    }, [isDemo, refreshFirestoreAudits]);

    // --- Derived State ---
    const audits = useMemo(() => {
        const toTime = (value?: string) => value ? new Date(value).getTime() : 0;
        return [...rawAudits].sort((a, b) => toTime(b.dateScheduled) - toTime(a.dateScheduled));
    }, [rawAudits]);

    const controls = useMemo(() => [...rawControls].sort((a, b) => a.code.localeCompare(b.code)), [rawControls]);
    const assets = useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);
    const risks = useMemo(() => [...rawRisks].sort((a, b) => b.score - a.score), [rawRisks]);

    // --- Local State ---
    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
    const [auditFindings, setAuditFindings] = useState<Finding[]>([]);
    const [auditChecklist, setAuditChecklist] = useState<AuditChecklist | null>(null);
    const [isExportingCSV, setIsExportingCSV] = useState(false);

    // --- Actions ---

    const fetchAuditDetails = useCallback(async (audit: Audit) => {
        if (!user?.organizationId) return;
        try {
            // Use AuditService to fetch findings and checklist
            const details = await AuditService.getAuditDetails(audit.id, user.organizationId);
            setAuditFindings(details.findings);
            setAuditChecklist(details.checklist);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAudits.fetchAuditDetails', 'FETCH_FAILED');
        }
    }, [user?.organizationId]);

    const handleCreateAudit = async (data: Partial<Audit>, preSelectedProjectId?: string | null) => {
        if (!canEdit || !user?.organizationId) return;
        try {
            const cleanData = sanitizeData(data);
            const newDocData = {
                ...cleanData,
                organizationId: user.organizationId,
                findingsCount: 0,
                createdBy: user.uid,
                relatedProjectIds: preSelectedProjectId ? [preSelectedProjectId] : (cleanData.relatedProjectIds || [])
            };

            const docRef = await addDoc(collection(db, 'audits'), newDocData);

            if (preSelectedProjectId) {
                await updateDoc(doc(db, 'projects', preSelectedProjectId), { relatedAuditIds: arrayUnion(docRef.id) });
            }

            await logAction(user, 'CREATE', 'Audit', `Nouvel audit: ${data.name} `);
            analyticsService.logEvent('create_audit', { audit_type: data.type, auditor: data.auditor });

            if (data.auditor) {
                const auditorUser = usersList.find(u => u.displayName === data.auditor);
                if (auditorUser) {
                    await NotificationService.notifyAuditAssigned(newDocData, auditorUser.uid, user.displayName || 'Admin');
                }
            }
            refreshAudits();
            addToast("Audit planifié et notifié", "success");
            return docRef.id;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAudits.handleCreateAudit', 'CREATE_FAILED');
            throw error;
        }
    };

    const handleUpdateAudit = async (id: string, data: Partial<Audit>, auditOrganizationId?: string) => {
        if (!canEdit) return;
        if (!user?.organizationId) return;

        // SECURITY: IDOR protection - verify audit belongs to user's organization
        if (auditOrganizationId && auditOrganizationId !== user.organizationId) {
            ErrorLogger.warn('IDOR attempt: audit update across organizations', 'useAudits.handleUpdateAudit', {
                metadata: { attemptedBy: user?.uid, targetId: id, targetOrg: auditOrganizationId, callerOrg: user.organizationId }
            });
            addToast('Audit non trouvé', 'error');
            return;
        }

        try {
            await updateDoc(doc(db, 'audits', id), sanitizeData(data));
            await logAction(user, 'UPDATE', 'Audit', `Mise à jour audit: ${data.name} `);
            refreshAudits();
            addToast("Audit mis à jour", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAudits.handleUpdateAudit', 'UPDATE_FAILED');
            throw error;
        }
    };

    const checkDependencies = async (auditId: string) => {
        if (!user?.organizationId) return { hasDependencies: false, dependencies: [] };
        // Use AuditService to check dependencies
        return await AuditService.checkDependencies(auditId, user.organizationId);
    };

    const handleDeleteAudit = async (id: string, name: string) => {
        if (!canDelete || !user?.organizationId || !user?.uid) return;
        try {
            // Use AuditService for atomic cascade deletion
            await AuditService.deleteAuditWithCascade({
                auditId: id,
                auditName: name,
                organizationId: user.organizationId,
                userId: user.uid,
                userEmail: user.email || 'unknown'
            });

            await logAction(user, 'DELETE', 'Audit', `Suppression audit: ${name} `);

            if (selectedAudit?.id === id) setSelectedAudit(null);
            refreshAudits();
            addToast("Audit et constats supprimés", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAudits.handleDeleteAudit', 'DELETE_FAILED');
        }
    };

    const bulkDeleteAudits = async (ids: string[]) => {
        if (!canDelete || !user?.organizationId) return;
        try {
            await Promise.all(ids.map(id => {
                // We need the name for logging, but we can skip it or fetch it.
                // For bulk, let's keep log simple or ideally fetch local name if needed.
                // Here we just reuse logic or reimplement for batching?
                // Reuse is safer for cascade logic.
                const audit = audits.find(a => a.id === id);
                return handleDeleteAudit(id, audit?.name || 'Inconnu');
            }));
            // Toasts are handled per delete, might be spammy?
            // Ideally we mute individual toasts and show one summary, but handleDeleteAudit already toasts.
            // Refactoring handleDeleteAudit to accept a 'silent' flag would be better, but for now strict audit compliance > UI spam.
            // Actually, let's just accept the multiple toasts or refine later.
            // Better: update handleDeleteAudit to take options.
            // But let's simple iterate for now to minimize risk.
        } catch {
            // handled inside
        }
    };

    const handleGeneratePlan = async () => {
        if (!user?.organizationId) return;

        // Logic for AI Plan Generation
        const suggestions = AuditPlannerService.generateAuditSuggestions(risks, assets, audits);
        if (suggestions.length === 0) {
            addToast("Aucune suggestion d'audit pertinente trouvée.", "info");
            return;
        }

        // Use AuditService for batch creation
        const auditsToCreate = suggestions.slice(0, 5);
        await AuditService.batchCreateAudits(
            auditsToCreate,
            user.organizationId,
            user.displayName || 'À définir'
        );

        refreshAudits();
        addToast(`${auditsToCreate.length} audits planifiés avec succès.`, "success");
    };

    const handleExportCSV = async () => {
        if (isExportingCSV) return;
        setIsExportingCSV(true);
        try {
            const headers = ["Audit", "Type", "Auditeur", "Date", "Statut", "Écarts"];
            const rows = audits.map(a => [
                a.name,
                a.type,
                a.auditor,
                a.dateScheduled ? new Date(a.dateScheduled).toLocaleDateString() : 'TBD',
                a.status,
                String(a.findingsCount || 0)
            ]);
            const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
            link.download = `audits_export_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        } finally {
            setTimeout(() => setIsExportingCSV(false), 0);
        }
    };

    const importAudits = useCallback(async (csvContent: string) => {
        if (!user?.organizationId || !user?.uid) return;
        try {
            const lines = CsvParser.parseCSV(csvContent);
            if (lines.length === 0) {
                addToast("Fichier vide ou invalide", "error");
                return;
            }

            // Use AuditService for batch import
            const count = await AuditService.importAuditsFromCSV(
                lines,
                user.organizationId,
                user.uid
            );

            await logAction(user, 'IMPORT', 'Audit', `Import CSV de ${count} audits`);
            refreshAudits();
            addToast(`Import de ${count} audits réussi`, "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAudits.importAudits');
            throw error;
        }
    }, [user, addToast, refreshAudits]);

    const handleExportCalendar = () => {
        const scheduledAudits = audits.filter(a => a.status === 'Planifié' && a.dateScheduled);
        if (scheduledAudits.length === 0) {
            addToast("Aucun audit planifié à exporter.", "info");
            return;
        }

        const events = scheduledAudits.map(audit => ({
            title: `Audit: ${audit.name}`,
            description: `Audit de type ${audit.type} assigné à ${audit.auditor || 'Non assigné'}.`,
            startTime: new Date(audit.dateScheduled!),
            endTime: new Date(new Date(audit.dateScheduled!).getTime() + 3600000), // Default 1 hour
            location: 'Sentinel GRC',
            url: buildAppUrl(`/audits/${audit.id}`)
        }));

        const icsContent = generateICS(events);
        downloadICS('audit_calendar.ics', icsContent);

        addToast(`${scheduledAudits.length} audits exportés vers le calendrier.`, "success");
    };

    return {
        // Data
        audits, controls, assets, risks, usersList: effectiveUsers, documents, allFindings, loading, projects: rawProjects,
        selectedAudit, setSelectedAudit, auditFindings, setAuditFindings, auditChecklist, setAuditChecklist,

        // Actions
        fetchAuditDetails,
        handleCreateAudit,
        handleUpdateAudit,
        handleDeleteAudit,
        bulkDeleteAudits,
        checkDependencies,
        handleGeneratePlan,
        refreshAudits,
        handleExportCSV,
        handleExportCalendar,
        importAudits,

        // Permissions
        canEdit, canDelete
    };
};
