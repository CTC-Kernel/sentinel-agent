import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { db } from '../../firebase';
import { collection, query, where, getCountFromServer, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { Risk, Control, Audit, Project, StatsHistoryEntry, Document, Asset, SystemLog, Supplier, Incident } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';

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
    const { user } = useStore();
    const [manualLoading, setManualLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [organizationName, setOrganizationName] = useState<string>('');
    const [organizationLogo, setOrganizationLogo] = useState<string | undefined>(undefined);
    const [activeIncidentsCount, setActiveIncidentsCount] = useState(0);
    const [openAuditsCount, setOpenAuditsCount] = useState(0);

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

    // Hooks - Conditional Fetching
    const { data: controls, loading: controlsLoading } = useFirestoreCollection<Control>('controls', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: needsGlobalStats });
    const { data: recentActivity, loading: logsLoading } = useFirestoreCollection<SystemLog>('system_logs', [where('organizationId', '==', user?.organizationId || 'ignore'), orderBy('timestamp', 'desc'), limit(10)], { logError: true, realtime: true, enabled: needsLogs });
    const { data: historyStats, loading: historyLoading } = useFirestoreCollection<StatsHistoryEntry>('stats_history', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: needsGlobalStats || isAuditor });
    const { data: allRisks, loading: risksLoading } = useFirestoreCollection<Risk>('risks', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true });
    const { data: allAssets, loading: assetsLoading } = useFirestoreCollection<Asset>('assets', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: needsAssets });
    const { data: allSuppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>('suppliers', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: needsSuppliers });

    // Personal/Role specific data
    const { data: myProjects, loading: projectsLoading } = useFirestoreCollection<Project>('projects', [where('organizationId', '==', user?.organizationId || 'ignore'), where('manager', '==', user?.displayName || 'ignore'), where('status', '==', 'En cours')], { logError: true, realtime: true, enabled: isPM || isAdmin });
    const { data: myAudits, loading: auditsLoading } = useFirestoreCollection<Audit>('audits', [where('organizationId', '==', user?.organizationId || 'ignore'), where('auditor', '==', user?.displayName || 'ignore'), where('status', 'in', ['Planifié', 'En cours'])], { logError: true, realtime: true, enabled: isAuditor || isAdmin });
    const { data: myDocs, loading: myDocsLoading } = useFirestoreCollection<Document>('documents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('owner', '==', user?.email || 'ignore')], { logError: true, realtime: true });
    const { data: publishedDocs, loading: publishedDocsLoading } = useFirestoreCollection<Document>('documents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('status', '==', 'Publié')], { logError: true, realtime: true });
    const { data: myIncidents, loading: myIncidentsLoading } = useFirestoreCollection<Incident>('incidents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('reporter', '==', user?.displayName || 'ignore'), where('status', '!=', 'Fermé')], { logError: true, realtime: true });

    const loading = manualLoading || (needsGlobalStats && controlsLoading) || (needsLogs && logsLoading) || ((needsGlobalStats || isAuditor) && historyLoading) || risksLoading || (needsAssets && assetsLoading) || (needsSuppliers && suppliersLoading) || ((isPM || isAdmin) && projectsLoading) || ((isAuditor || isAdmin) && auditsLoading) || myDocsLoading || publishedDocsLoading || myIncidentsLoading;

    const fetchCounts = async () => {
        if (!user?.organizationId) {
            setManualLoading(false);
            return;
        }

        setManualLoading(true);
        try {
            const orgId = user.organizationId!;

            // Check cache
            const now = Date.now();
            const cacheTtlMs = 60 * 1000;
            if (lastCountsValue && lastCountsOrgId === orgId && now - lastCountsFetchAt < cacheTtlMs) {
                setActiveIncidentsCount(lastCountsValue.activeIncidentsCount);
                setOpenAuditsCount(lastCountsValue.openAuditsCount);
                setError(null);
                setManualLoading(false);

                // Fetch org details if needed (and not cached effectively here, but kept simple)
                if (!organizationName) {
                    try {
                        const orgSnap = await getDoc(doc(db, 'organizations', orgId));
                        if (orgSnap.exists()) {
                            const data = orgSnap.data();
                            setOrganizationName(data.name || '');
                            setOrganizationLogo(data.logoUrl);
                        } else if (user.organizationName) setOrganizationName(user.organizationName);
                    } catch { if (user.organizationName) setOrganizationName(user.organizationName); }
                }

                return;
            }

            // Organization Name
            try {
                const orgSnap = await getDoc(doc(db, 'organizations', orgId));
                if (orgSnap.exists()) {
                    const data = orgSnap.data();
                    setOrganizationName(data.name || '');
                    setOrganizationLogo(data.logoUrl);
                }
                else if (user.organizationName) setOrganizationName(user.organizationName);
            } catch { if (user.organizationName) setOrganizationName(user.organizationName); }

            // Counts
            const [incCount, auditCount] = await Promise.all([
                getCountFromServer(query(collection(db, 'incidents'), where('organizationId', '==', orgId), where('status', '!=', 'Fermé'))),
                getCountFromServer(query(collection(db, 'audits'), where('organizationId', '==', orgId), where('status', 'in', ['Planifié', 'En cours'])))
            ]);

            const next = {
                activeIncidentsCount: incCount.data().count,
                openAuditsCount: auditCount.data().count
            };
            lastCountsValue = next;
            lastCountsOrgId = orgId;
            lastCountsFetchAt = now;

            setActiveIncidentsCount(next.activeIncidentsCount);
            setOpenAuditsCount(next.openAuditsCount);
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
    };

    useEffect(() => {
        fetchCounts();
    }, [user?.organizationId]);

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
