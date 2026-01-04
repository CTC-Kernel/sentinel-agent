import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { where, orderBy, limit } from 'firebase/firestore';
import { Risk, Control, Audit, Project, StatsHistoryEntry, Document, Asset, SystemLog, Supplier, Incident } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { DashboardService } from '../../services/dashboardService';

export interface DashboardData {
    controls: Control[];
    recentActivity: SystemLog[];
    historyStats: StatsHistoryEntry[];
    allRisks: Risk[];
    allAssets: Asset[];
    allSuppliers: Supplier[];
    myProjects: Project[];
    myAudits: Audit[];
    myDocs: Document[];
    publishedDocs: Document[];
    pendingReviews: Document[];
    myIncidents: Incident[];
    activeIncidentsCount: number;
    openAuditsCount: number;
    organizationName: string;
    organizationLogo?: string;
    loading: boolean;
    error: string | null;
    refreshCounts: () => Promise<void>;
}

let lastCountsFetchAt = 0;
let lastCountsOrgId: string | null = null;
let lastCountsValue: { activeIncidentsCount: number; openAuditsCount: number } | null = null;

export const useDashboardData = (): DashboardData => {
    const { user, demoMode } = useStore();
    const [manualLoading, setManualLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [organizationName, setOrganizationName] = useState<string>('');
    const [organizationLogo, setOrganizationLogo] = useState<string | undefined>(undefined);
    const [activeIncidentsCount, setActiveIncidentsCount] = useState(0);
    const [openAuditsCount, setOpenAuditsCount] = useState(0);

    // Mock Data State
    const [mockData, setMockData] = useState<{
        controls: Control[];
        loading: boolean;
        risks: Risk[];
        assets: Asset[];
        suppliers: Supplier[];
        projects: Project[];
        audits: Audit[];
        documents: Document[];
        incidents: Incident[];
        logs: SystemLog[];
    }>({
        controls: [],
        loading: true,
        risks: [],
        assets: [],
        suppliers: [],
        projects: [],
        audits: [],
        documents: [],
        incidents: [],
        logs: []
    });

    useEffect(() => {
        let isMounted = true;
        if (demoMode) {
            import('../../services/mockDataService').then(({ MockDataService }) => {
                if (!isMounted) return;
                setMockData({
                    controls: MockDataService.getCollection('controls') as Control[],
                    loading: false,
                    risks: MockDataService.getCollection('risks') as Risk[],
                    assets: MockDataService.getCollection('assets') as Asset[],
                    suppliers: MockDataService.getCollection('suppliers') as Supplier[],
                    projects: MockDataService.getCollection('projects') as unknown as Project[],
                    audits: MockDataService.getCollection('audits') as Audit[],
                    documents: MockDataService.getCollection('documents') as Document[],
                    incidents: MockDataService.getCollection('incidents') as Incident[],
                    logs: MockDataService.getCollection('system_logs') as SystemLog[]
                });
                setOrganizationName('Sentinel Demo Corp');
                setActiveIncidentsCount(5);
                setOpenAuditsCount(2);
                setManualLoading(false);
                setManualLoading(false);
            }).catch(_err => {
                if (!isMounted) return;
                setManualLoading(false);
            });
        }
        return () => { isMounted = false; };
    }, [demoMode]);

    // Role Definitions
    const role = user?.role || 'user';
    const isAdmin = ['admin', 'rssi'].includes(role);
    const isDirection = role === 'direction';
    const isAuditor = role === 'auditor';
    const isPM = role === 'project_manager';

    const needsGlobalStats = isAdmin || isDirection;
    const needsLogs = isAdmin || isAuditor;
    const needsAssets = isAdmin || isDirection;
    const needsSuppliers = isAdmin || isDirection;

    // Hooks - Conditional Fetching (Only if NOT demoMode)
    const { data: controlsData, loading: controlsLoading } = useFirestoreCollection<Control>('controls', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: false, enabled: !demoMode && needsGlobalStats });
    const { data: recentActivityData, loading: logsLoading } = useFirestoreCollection<SystemLog>('system_logs', [where('organizationId', '==', user?.organizationId || 'ignore'), orderBy('timestamp', 'desc'), limit(10)], { logError: true, realtime: true, enabled: !demoMode && needsLogs });
    const { data: historyStatsData, loading: historyLoading } = useFirestoreCollection<StatsHistoryEntry>('stats_history', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: false, enabled: !demoMode && (needsGlobalStats || isAuditor) });
    const { data: allRisksData, loading: risksLoading } = useFirestoreCollection<Risk>('risks', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: false, enabled: !demoMode });
    const { data: allAssetsData, loading: assetsLoading } = useFirestoreCollection<Asset>('assets', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: false, enabled: !demoMode && needsAssets });
    const { data: allSuppliersData, loading: suppliersLoading } = useFirestoreCollection<Supplier>('suppliers', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: false, enabled: !demoMode && needsSuppliers });

    // Personal/Role specific data
    const { data: allProjectsData, loading: projectsLoading } = useFirestoreCollection<Project>('projects', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: !demoMode && (isPM || isAdmin) });
    const { data: allAuditsData, loading: auditsLoading } = useFirestoreCollection<Audit>('audits', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: !demoMode && (isAuditor || isAdmin) });
    const { data: allDocumentsData, loading: myDocsLoading } = useFirestoreCollection<Document>('documents', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: !demoMode });
    const { data: allIncidentsData, loading: myIncidentsLoading } = useFirestoreCollection<Incident>('incidents', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: !demoMode });

    // Unified Data Sources
    const controls = demoMode ? mockData.controls : controlsData;
    const recentActivity = demoMode ? mockData.logs : recentActivityData;
    // Mocking history stats is cleaner if we just let it be empty or mock it specifically, but for now empty is fine or we can seed it.
    // Dashboard metrics hook handles empty history gracefully usually.
    const historyStats = demoMode ? [] : historyStatsData;
    const allRisks = demoMode ? mockData.risks : allRisksData;
    const allAssets = demoMode ? mockData.assets : allAssetsData;
    const allSuppliers = demoMode ? mockData.suppliers : allSuppliersData;
    const allProjects = demoMode ? mockData.projects : allProjectsData;
    const allAudits = demoMode ? mockData.audits : allAuditsData;
    const allDocuments = demoMode ? mockData.documents : allDocumentsData;
    const allIncidents = demoMode ? mockData.incidents : allIncidentsData;

    // Filter in memory to avoid complex chained where() clauses
    const myProjects = useMemo(() =>
        allProjects.filter(p => (p.manager === user?.displayName || demoMode) && p.status === 'En cours'),
        [allProjects, user?.displayName, demoMode]
    );

    const myAudits = useMemo(() =>
        allAudits.filter(a => (a.auditor === user?.displayName || demoMode) && ['Planifié', 'En cours'].includes(a.status)),
        [allAudits, user?.displayName, demoMode]
    );

    const myDocs = useMemo(() =>
        allDocuments.filter(d => (d.owner === user?.email || demoMode)),
        [allDocuments, user?.email, demoMode]
    );

    const publishedDocs = useMemo(() =>
        allDocuments.filter(d => d.status === 'Publié'),
        [allDocuments]
    );

    const myIncidents = useMemo(() =>
        allIncidents.filter(i => (i.reporter === user?.displayName || demoMode) && i.status !== 'Fermé'),
        [allIncidents, user?.displayName, demoMode]
    );

    const pendingReviews = useMemo(() =>
        allDocuments.filter(d => d.status === 'En revue' && (d.reviewers?.includes(user?.uid || '') || demoMode)),
        [allDocuments, user?.uid, demoMode]
    );

    const loading = demoMode ? mockData.loading : (manualLoading || (needsGlobalStats && controlsLoading) || (needsLogs && logsLoading) || ((needsGlobalStats || isAuditor) && historyLoading) || risksLoading || (needsAssets && assetsLoading) || (needsSuppliers && suppliersLoading) || ((isPM || isAdmin) && projectsLoading) || ((isAuditor || isAdmin) && auditsLoading) || myDocsLoading || myIncidentsLoading);

    const fetchCounts = useCallback(async () => {
        if (demoMode) return; // Skip in demo mode
        if (!user?.organizationId) {
            setManualLoading(false);
            return;
        }

        setManualLoading(true);
        try {
            const orgId = user.organizationId;

            // Check cache
            const now = Date.now();
            const cacheTtlMs = 60 * 1000;
            if (lastCountsValue && lastCountsOrgId === orgId && now - lastCountsFetchAt < cacheTtlMs) {
                setActiveIncidentsCount(lastCountsValue.activeIncidentsCount);
                setOpenAuditsCount(lastCountsValue.openAuditsCount);
                setError(null);
                setManualLoading(false);

                // Fetch org details if needed
                if (!organizationName) {
                    try {
                        const orgDetails = await DashboardService.getOrganizationDetails(orgId);
                        if (orgDetails) {
                            setOrganizationName(orgDetails.name);
                            setOrganizationLogo(orgDetails.logoUrl);
                        } else if (user.organizationName) {
                            setOrganizationName(user.organizationName);
                        }
                    } catch {
                        if (user.organizationName) setOrganizationName(user.organizationName);
                    }
                }

                return;
            }

            // Use DashboardService to fetch organization details and counts
            try {
                const orgDetails = await DashboardService.getOrganizationDetails(orgId);
                if (orgDetails) {
                    setOrganizationName(orgDetails.name);
                    setOrganizationLogo(orgDetails.logoUrl);
                } else if (user.organizationName) {
                    setOrganizationName(user.organizationName);
                }
            } catch {
                if (user.organizationName) setOrganizationName(user.organizationName);
            }

            // Fetch counts using DashboardService
            const counts = await DashboardService.getDashboardCounts(orgId);

            lastCountsValue = counts;
            lastCountsOrgId = orgId;
            lastCountsFetchAt = now;

            setActiveIncidentsCount(counts.activeIncidentsCount);
            setOpenAuditsCount(counts.openAuditsCount);
            setError(null);
        } catch (err) {
            const code = (err as { code?: string })?.code;
            if (code === 'permission-denied') {
                setError('permission-denied');
            } else {
                ErrorLogger.handleErrorWithToast(err, 'useDashboardData.fetchCounts', 'FETCH_FAILED');
            }
        } finally {
            setManualLoading(false);
        }
    }, [user?.organizationId, user?.organizationName, organizationName, demoMode]);

    useEffect(() => {
        fetchCounts();
    }, [fetchCounts]);

    return {
        controls,
        recentActivity,
        historyStats,
        allRisks,
        allAssets,
        allSuppliers,
        myProjects,
        myAudits,
        myDocs,
        publishedDocs,
        pendingReviews,
        myIncidents,
        activeIncidentsCount,
        openAuditsCount,
        organizationName,
        organizationLogo,
        loading,
        error,
        refreshCounts: fetchCounts
    };
};
