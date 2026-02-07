import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { where, orderBy, limit } from 'firebase/firestore';
import { Risk, Control, Audit, Project, StatsHistoryEntry, Document as AppDocument, Asset, SystemLog, Supplier, Incident } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { DashboardService } from '../../services/dashboardService';

export interface DashboardData {
 controls: Control[];
 recentActivity: SystemLog[];
 historyStats: StatsHistoryEntry[];
 allRisks: Risk[];
 myRisks: Risk[];
 allAssets: Asset[];
 allSuppliers: Supplier[];
 myProjects: Project[];
 myAudits: Audit[];
 myDocs: AppDocument[];
 publishedDocs: AppDocument[];
 pendingReviews: AppDocument[];
 myIncidents: Incident[];
 activeIncidents: Incident[];
 activeIncidentsCount: number;
 openAuditsCount: number;
 organizationName: string;
 organizationLogo?: string;
 loading: boolean;
 error: string | null;
 refreshCounts: () => Promise<void>;
 aggregatedStats?: {
 totalRisks: number;
 criticalRisks: number;
 highRisks: number;
 totalAssets: number;
 } | null;
 // Agent data for dashboard integration
 agentStats?: {
 totalAgents: number;
 activeAgents: number;
 offlineAgents: number;
 averageComplianceScore: number | null;
 } | null;
}

// Cache for counts with organization-specific keys to prevent race conditions
const countsCache = new Map<string, {
 timestamp: number;
 value: { activeIncidentsCount: number; openAuditsCount: number };
}>();
const CACHE_TTL = 30000; // 30 seconds cache TTL

const getCachedCounts = (orgId: string): { activeIncidentsCount: number; openAuditsCount: number } | null => {
 const cached = countsCache.get(orgId);
 if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
 return cached.value;
 }
 return null;
};

const setCachedCounts = (orgId: string, value: { activeIncidentsCount: number; openAuditsCount: number }) => {
 countsCache.set(orgId, { timestamp: Date.now(), value });
 // Clean up old entries to prevent memory leaks
 if (countsCache.size > 100) {
 const now = Date.now();
 for (const [key, entry] of countsCache.entries()) {
 if (now - entry.timestamp > CACHE_TTL) {
 countsCache.delete(key);
 }
 }
 }
};

export const useDashboardData = (): DashboardData => {
 const { user, demoMode } = useStore();
 const { claimsSynced } = useAuth();
 const [manualLoading, setManualLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [organizationName, setOrganizationName] = useState<string>('');
 const [organizationLogo, setOrganizationLogo] = useState<string | undefined>(undefined);
 const [activeIncidentsCount, setActiveIncidentsCount] = useState(0);
 const [openAuditsCount, setOpenAuditsCount] = useState(0);
 const lastFetchRef = useRef<string | null>(null);

 // Mock Data State
 const [mockData, setMockData] = useState<{
 controls: Control[];
 loading: boolean;
 risks: Risk[];
 myRisks: Risk[];
 assets: Asset[];
 suppliers: Supplier[];
 projects: Project[];
 audits: Audit[];
 documents: AppDocument[];
 incidents: Incident[];
 logs: SystemLog[];
 }>({
 controls: [],
 loading: true,
 risks: [],
 myRisks: [],
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
  myRisks: (MockDataService.getCollection('risks') as Risk[]).slice(0, 5),
  assets: MockDataService.getCollection('assets') as Asset[],
  suppliers: MockDataService.getCollection('suppliers') as Supplier[],
  projects: MockDataService.getCollection('projects') as unknown as Project[],
  audits: MockDataService.getCollection('audits') as Audit[],
  documents: MockDataService.getCollection('documents') as AppDocument[],
  incidents: MockDataService.getCollection('incidents') as Incident[],
  logs: MockDataService.getCollection('system_logs') as SystemLog[]
 });
 setOrganizationName('Sentinel Demo Corp');
 // Count active incidents from mock data (status !== 'Résolu' && status !== 'Fermé')
 const mockIncidents = MockDataService.getCollection('incidents');
 const activeCount = mockIncidents.filter(i => i.status !== 'Résolu' && i.status !== 'Fermé').length;
 setActiveIncidentsCount(activeCount);
 // Count open audits from mock data (status === 'Planifié' || status === 'En cours')
 const mockAudits = MockDataService.getCollection('audits');
 const openCount = mockAudits.filter(a => a.status === 'Planifié' || a.status === 'En cours').length;
 setOpenAuditsCount(openCount);
 setManualLoading(false);
 }).catch((_err) => {
 ErrorLogger.handleErrorWithToast(_err, 'useDashboardData');
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

 // Hooks - Conditional Fetching (Only if NOT demoMode AND claimsSynced)
 const canFetch = !demoMode && !!user?.organizationId && claimsSynced;

 const { data: controlsData, loading: controlsLoading } = useFirestoreCollection<Control>('controls', [where('organizationId', '==', user?.organizationId || '')], { logError: true, realtime: false, enabled: canFetch && needsGlobalStats });
 const { data: recentActivityData, loading: logsLoading } = useFirestoreCollection<SystemLog>('system_logs', [where('organizationId', '==', user?.organizationId || ''), orderBy('timestamp', 'desc'), limit(10)], { logError: true, realtime: true, enabled: canFetch && needsLogs });
 const { data: historyStatsData, loading: historyLoading } = useFirestoreCollection<StatsHistoryEntry>('stats_history', [where('organizationId', '==', user?.organizationId || '')], { logError: true, realtime: false, enabled: canFetch && (needsGlobalStats || isAuditor) });

 // Optimizations: Fetch only user's risks or limit to top/recent if needed.
 // For global lists (allRisks), we now rely on aggregated stats for numbers, and only fetch a small subset for "Top Risks" display if really needed.
 // However, Dashboard often lists "Top Risks". Let's fetch top 10 high risks instead of ALL risks.
 const { data: topRisksData, loading: risksLoading } = useFirestoreCollection<Risk>('risks', [
 where('organizationId', '==', user?.organizationId || ''),
 where('score', '>=', 8), // Optimization: Only fetch significant risks
 orderBy('score', 'desc'),
 limit(20)
 ], { logError: true, realtime: false, enabled: canFetch });

 // Specific query for "My Risks" to ensure user sees their own critical risks even if not in global top 20
 const { data: myRisksData, loading: myRisksLoading } = useFirestoreCollection<Risk>('risks', [
 where('organizationId', '==', user?.organizationId || ''),
 where('ownerId', '==', user?.uid || ''),
 orderBy('score', 'desc'),
 limit(5)
 ], { logError: true, realtime: true, enabled: canFetch && !!user?.uid });

 // For Assets, we typically don't show a list of 1000 assets on dashboard, just the count and maybe top value. 
 // We'll limit this too.
 const { data: topAssetsData, loading: assetsLoading } = useFirestoreCollection<Asset>('assets', [
 where('organizationId', '==', user?.organizationId || ''),
 limit(20) // Only fetch a few for display if needed
 ], { logError: true, realtime: false, enabled: canFetch && needsAssets });

 // Suppliers - limit
 const { data: allSuppliersData, loading: suppliersLoading } = useFirestoreCollection<Supplier>('suppliers', [where('organizationId', '==', user?.organizationId || ''), limit(20)], { logError: true, realtime: false, enabled: canFetch && needsSuppliers });

 // Personal/Role specific data
 const { data: allProjectsData, loading: projectsLoading } = useFirestoreCollection<Project>('projects', [where('organizationId', '==', user?.organizationId || '')], { logError: true, realtime: true, enabled: canFetch && (isPM || isAdmin) });
 const { data: allAuditsData, loading: auditsLoading } = useFirestoreCollection<Audit>('audits', [where('organizationId', '==', user?.organizationId || '')], { logError: true, realtime: true, enabled: canFetch && (isAuditor || isAdmin) });
 const { data: allDocumentsData, loading: myDocsLoading } = useFirestoreCollection<AppDocument>('documents', [where('organizationId', '==', user?.organizationId || ''), limit(50)], { logError: true, realtime: true, enabled: canFetch });
 const { data: allIncidentsData, loading: myIncidentsLoading } = useFirestoreCollection<Incident>('incidents', [where('organizationId', '==', user?.organizationId || ''), where('status', '!=', 'Fermé'), limit(20)], { logError: true, realtime: true, enabled: canFetch });

 // Unified Data Sources
 const controls = demoMode ? mockData.controls : controlsData;
 const recentActivity = demoMode ? mockData.logs : recentActivityData;
 const historyStats = demoMode ? [] : historyStatsData;
 // Map optimized data to "allRisks" etc. Note: "allRisks" is now partial, but sufficient for Top Risks list.
 // We need to inject the TRUE counts from AggregatedService separately for the Stats Cards.
 const allRisks = demoMode ? mockData.risks : topRisksData;
 const myRisks = demoMode ? mockData.myRisks : myRisksData;
 const allAssets = demoMode ? mockData.assets : topAssetsData;
 const allSuppliers = demoMode ? mockData.suppliers : allSuppliersData;
 const allProjects = demoMode ? mockData.projects : allProjectsData;
 const allAudits = demoMode ? mockData.audits : allAuditsData;
 const allDocuments = demoMode ? mockData.documents : allDocumentsData;
 const allIncidents = demoMode ? mockData.incidents : allIncidentsData;

 // Optimized filtering with useMemo and early returns
 const myProjects = useMemo(() => {
 if (!allProjects.length) return [];
 return allProjects.filter(p => {
 const managerName = user?.displayName || (demoMode ? 'Demo User' : '');
 return p.manager === managerName && p.status === 'En cours';
 });
 }, [allProjects, user?.displayName, demoMode]);

 const myAudits = useMemo(() => {
 if (!allAudits.length) return [];
 return allAudits.filter(a => {
 const auditorName = user?.displayName || (demoMode ? 'Demo User' : '');
 return a.auditor === auditorName && ['Planifié', 'En cours'].includes(a.status);
 });
 }, [allAudits, user?.displayName, demoMode]);

 const myDocs = useMemo(() => {
 if (!allDocuments.length) return [];
 return allDocuments.filter(d => d.owner === (user?.email || (demoMode ? 'demo@sentinel-grc.com' : '')));
 }, [allDocuments, user?.email, demoMode]);

 const publishedDocs = useMemo(() => {
 if (!allDocuments.length) return [];
 return allDocuments.filter(d => d.status === 'Publié');
 }, [allDocuments]);

 const myIncidents = useMemo(() => {
 if (!allIncidents.length) return [];
 return allIncidents.filter(i => {
 const reporterName = user?.displayName || (demoMode ? 'Demo User' : '');
 return i.reporter === reporterName && i.status !== 'Fermé';
 });
 }, [allIncidents, user?.displayName, demoMode]);

 const pendingReviews = useMemo(() => {
 if (!allDocuments.length) return [];
 return allDocuments.filter(d => {
 const isReviewer = d.reviewers?.includes(user?.uid || '') || demoMode;
 return d.status === 'En revue' && isReviewer;
 });
 }, [allDocuments, user?.uid, demoMode]);

 const activeIncidents = useMemo(() => {
 if (!allIncidents.length) return [];
 return allIncidents.filter(i => i.status !== 'Fermé');
 }, [allIncidents]);

 const loading = demoMode ? mockData.loading : (!claimsSynced || manualLoading || (needsGlobalStats && controlsLoading) || (needsLogs && logsLoading) || ((needsGlobalStats || isAuditor) && historyLoading) || risksLoading || (needsAssets && assetsLoading) || (needsSuppliers && suppliersLoading) || ((isPM || isAdmin) && projectsLoading) || ((isAuditor || isAdmin) && auditsLoading) || myDocsLoading || myIncidentsLoading || myRisksLoading);

 // New State for Aggregated Stats
 const [aggregatedStats, setAggregatedStats] = useState<{
 totalRisks: number;
 criticalRisks: number;
 highRisks: number;
 totalAssets: number;
 } | null>(null);

 const fetchCounts = useCallback(async () => {
 if (demoMode) return; // Skip in demo mode
 if (!user?.organizationId || !claimsSynced) {
 // Keep loading true while waiting for claims
 // But only if we are still waiting for sync
 if (!claimsSynced && user?.organizationId) setManualLoading(true);
 else setManualLoading(false);
 return;
 }

 // Guard: prevent re-fetching when data is already loaded for the same org/claims state
 const cacheKey = `${user.organizationId}-${claimsSynced}`;
 if (lastFetchRef.current === cacheKey) return;
 lastFetchRef.current = cacheKey;

 setManualLoading(true);
 try {
 const orgId = user.organizationId;

 // Check cache using organization-specific cache
 const cachedCounts = getCachedCounts(orgId);
 if (cachedCounts) {
 setActiveIncidentsCount(cachedCounts.activeIncidentsCount);
 setOpenAuditsCount(cachedCounts.openAuditsCount);
 }

 // Fetch organization details if needed
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

 // Parallel fetch: Counts + Aggregated Stats
 const [counts, stats] = await Promise.all([
 DashboardService.getDashboardCounts(orgId),
 DashboardService.getAggregatedStats(orgId)
 ]);

 setCachedCounts(orgId, counts);
 setActiveIncidentsCount(counts.activeIncidentsCount);
 setOpenAuditsCount(counts.openAuditsCount);
 setAggregatedStats({
 totalRisks: stats.totalRisks,
 criticalRisks: stats.criticalRisks,
 highRisks: stats.highRisks,
 totalAssets: stats.totalAssets
 });
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
 }, [user?.organizationId, user?.organizationName, organizationName, demoMode, claimsSynced]);

 useEffect(() => {
 fetchCounts();
 }, [fetchCounts]);

 return {
 controls,
 recentActivity,
 historyStats,
 allRisks,
 myRisks,
 allAssets,
 allSuppliers,
 myProjects,
 myAudits,
 myDocs,
 publishedDocs,
 pendingReviews,
 myIncidents,
 activeIncidents,
 activeIncidentsCount,
 openAuditsCount,
 organizationName,
 organizationLogo,
 loading,
 error,
 refreshCounts: fetchCounts,
 aggregatedStats
 };
};
