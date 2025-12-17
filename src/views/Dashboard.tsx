import React, { useEffect, useState } from 'react';
import { SEO } from '../components/SEO';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, setDoc, limit, getCountFromServer, getDoc, orderBy } from 'firebase/firestore';
import { Risk, Control, Audit, Project, StatsHistoryEntry, Document, Asset, SystemLog, Supplier, Incident } from '../types';
import { PdfService } from '../services/PdfService';
import { aiService } from '../services/aiService';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ErrorLogger } from '../services/errorLogger';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { motion } from 'framer-motion';
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton';
import { GettingStartedWidget } from '../components/dashboard/widgets/GettingStartedWidget';

import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';

// Widgets
import { DashboardHeader } from '../components/dashboard/widgets/DashboardHeader';
import { QuickActions } from '../components/dashboard/widgets/QuickActions';

// Role-based Views
import { AdminDashboardView } from '../components/dashboard/views/AdminDashboardView';
import { DirectionDashboardView } from '../components/dashboard/views/DirectionDashboardView';
import { AuditorDashboardView } from '../components/dashboard/views/AuditorDashboardView';
import { ProjectManagerDashboardView } from '../components/dashboard/views/ProjectManagerDashboardView';
import { OperationalDashboardView } from '../components/dashboard/views/OperationalDashboardView';

interface HealthIssue { id: string; type: 'warning' | 'danger'; message: string; count: number; link: string; }
interface ActionItem { id: string; type: 'audit' | 'document' | 'project' | 'policy' | 'incident' | 'risk'; title: string; date: string; status: string; link: string; }

let lastCountsFetchAt = 0;
let lastCountsOrgId: string | null = null;
let lastCountsValue: { activeIncidentsCount: number; openAuditsCount: number } | null = null;

export const Dashboard: React.FC = () => {
    const [manualLoading, setManualLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [organizationName, setOrganizationName] = useState<string>('');
    const [organizationLogo, setOrganizationLogo] = useState<string | undefined>(undefined);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);


    const [activeIncidentsCount, setActiveIncidentsCount] = useState(0);
    const [openAuditsCount, setOpenAuditsCount] = useState(0);

    const [showGettingStarted, setShowGettingStarted] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const { user, theme, addToast, t } = useStore();
    const navigate = useNavigate();

    // Hooks
    // Role Definitions
    const role = user?.role || 'user';
    const isAdmin = ['admin', 'rssi'].includes(role);
    const isDirection = role === 'direction';
    const isAuditor = role === 'auditor';
    const isPM = role === 'project_manager';


    const needsGlobalStats = isAdmin || isDirection;
    const needsLogs = isAdmin || isAuditor;
    const needsAssets = isAdmin || isDirection; // Only for financial calculation
    const needsSuppliers = isAdmin || isDirection; // Only for insights

    // Hooks - Conditional Fetching
    const { data: controls, loading: controlsLoading } = useFirestoreCollection<Control>('controls', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: needsGlobalStats });
    const { data: recentActivity, loading: logsLoading } = useFirestoreCollection<SystemLog>('system_logs', [where('organizationId', '==', user?.organizationId || 'ignore'), orderBy('timestamp', 'desc'), limit(10)], { logError: true, realtime: true, enabled: needsLogs });
    const { data: historyStats, loading: historyLoading } = useFirestoreCollection<StatsHistoryEntry>('stats_history', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: needsGlobalStats || isAuditor });
    const { data: allRisks, loading: risksLoading } = useFirestoreCollection<Risk>('risks', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true }); // Risks usually needed for context or relation in most views
    const { data: allAssets, loading: assetsLoading } = useFirestoreCollection<Asset>('assets', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: needsAssets });
    const { data: allSuppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>('suppliers', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true, enabled: needsSuppliers });

    // Personal/Role specific data
    const { data: myProjects, loading: projectsLoading } = useFirestoreCollection<Project>('projects', [where('organizationId', '==', user?.organizationId || 'ignore'), where('manager', '==', user?.displayName || 'ignore'), where('status', '==', 'En cours')], { logError: true, realtime: true, enabled: isPM || isAdmin });
    const { data: myAudits, loading: auditsLoading } = useFirestoreCollection<Audit>('audits', [where('organizationId', '==', user?.organizationId || 'ignore'), where('auditor', '==', user?.displayName || 'ignore'), where('status', 'in', ['Planifié', 'En cours'])], { logError: true, realtime: true, enabled: isAuditor || isAdmin });
    const { data: myDocs, loading: myDocsLoading } = useFirestoreCollection<Document>('documents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('owner', '==', user?.email || 'ignore')], { logError: true, realtime: true });
    const { data: publishedDocs, loading: publishedDocsLoading } = useFirestoreCollection<Document>('documents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('status', '==', 'Publié')], { logError: true, realtime: true });
    const { data: myIncidents, loading: myIncidentsLoading } = useFirestoreCollection<Incident>('incidents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('reporter', '==', user?.displayName || 'ignore'), where('status', '!=', 'Fermé')], { logError: true, realtime: true });

    const loading = manualLoading || (needsGlobalStats && controlsLoading) || (needsLogs && logsLoading) || ((needsGlobalStats || isAuditor) && historyLoading) || risksLoading || (needsAssets && assetsLoading) || (needsSuppliers && suppliersLoading) || ((isPM || isAdmin) && projectsLoading) || ((isAuditor || isAdmin) && auditsLoading) || myDocsLoading || publishedDocsLoading || myIncidentsLoading;

    // Fetch Counts & Org Name
    useEffect(() => {
        if (!user?.organizationId) {
            setManualLoading(false);
            return;
        }

        let didCancel = false;
        const inFlightRef = { current: false };

        const fetchCounts = async () => {
            setManualLoading(true);
            try {
                const orgId = user.organizationId!;

                const blockedKey = `agg_blocked_${orgId}`;
                if (sessionStorage.getItem(blockedKey)) {
                    setError('permission-denied');
                    return;
                }

                const now = Date.now();
                const cacheTtlMs = 60 * 1000;
                if (lastCountsValue && lastCountsOrgId === orgId && now - lastCountsFetchAt < cacheTtlMs) {
                    if (!didCancel) {

                        setActiveIncidentsCount(lastCountsValue.activeIncidentsCount);
                        setOpenAuditsCount(lastCountsValue.openAuditsCount);
                        setError(null);
                    }
                    return;
                }

                if (inFlightRef.current) return;
                inFlightRef.current = true;

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

                if (!didCancel) {

                    setActiveIncidentsCount(next.activeIncidentsCount);
                    setOpenAuditsCount(next.openAuditsCount);
                    setError(null);
                }
            } catch (err) {
                const code = (err as { code?: string })?.code;
                if (code === 'permission-denied' && user?.organizationId) {
                    sessionStorage.setItem(`agg_blocked_${user.organizationId}`, '1');
                    setError('permission-denied');
                    return;
                }

                ErrorLogger.handleErrorWithToast(err, 'Dashboard.fetchCounts', 'FETCH_FAILED');
            } finally {
                inFlightRef.current = false;
                setManualLoading(false);
            }
        };
        fetchCounts();

        return () => {
            didCancel = true;
        };
    }, [user?.organizationId, user?.organizationName, t]);

    // Derived Data
    const topRisks = React.useMemo(() => [...allRisks].sort((a, b) => b.score - a.score).slice(0, 5), [allRisks]);

    const historyData = React.useMemo(() => {
        return historyStats
            .map((d) => {
                const anyD = d as unknown as { date?: unknown; compliance?: unknown; metrics?: { complianceRate?: unknown } };

                let complianceVal: number | undefined = undefined;

                if (anyD.metrics && typeof anyD.metrics.complianceRate !== 'undefined') {
                    const val = anyD.metrics.complianceRate;
                    complianceVal = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : undefined;
                } else if (typeof anyD.compliance !== 'undefined') {
                    const val = anyD.compliance;
                    complianceVal = typeof val === 'string' ? parseFloat(val) : typeof val === 'number' ? val : undefined;
                }

                return {
                    date: typeof anyD.date === 'string' ? anyD.date : '',
                    compliance: typeof complianceVal === 'number' && Number.isFinite(complianceVal) ? complianceVal : 0
                };
            })
            // Filter out entries with invalid dates or where compliance couldn't be resolved
            .filter(d => d.date && d.date.length > 0)
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [historyStats]);

    const { stats, radarData, complianceScore } = React.useMemo(() => {
        const implemented = controls.filter(c => c.status === 'Implémenté').length;
        const actionable = controls.filter(c => c.status !== 'Exclu' && c.status !== 'Non applicable').length;
        const compScore = actionable > 0 ? Math.round((implemented / actionable) * 100) : 0;

        const domains = { 'Org.': { total: 0, implemented: 0, prefix: 'A.5' }, 'Humain': { total: 0, implemented: 0, prefix: 'A.6' }, 'Physique': { total: 0, implemented: 0, prefix: 'A.7' }, 'Techno': { total: 0, implemented: 0, prefix: 'A.8' } };
        controls.forEach(c => {
            if (c.status === 'Exclu' || c.status === 'Non applicable') return;
            const key = Object.keys(domains).find(k => c.code.startsWith(domains[k as keyof typeof domains].prefix));
            if (key) { domains[key as keyof typeof domains].total++; if (c.status === 'Implémenté') domains[key as keyof typeof domains].implemented++; }
        });
        const rData = Object.entries(domains).map(([subject, data]) => ({ subject, A: data.total > 0 ? Math.round((data.implemented / data.total) * 100) : 0, fullMark: 100 }));

        const calculateDepreciation = (price: number, purchaseDate: string) => {
            if (!price || !purchaseDate) return price;
            const start = new Date(purchaseDate);
            const now = new Date();
            const ageInYears = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            const value = price * (1 - (ageInYears / 5));
            return Math.max(0, Math.round(value));
        };

        const totalAssetValue = allAssets.reduce((acc, a) => acc + calculateDepreciation(a.purchasePrice || 0, a.purchaseDate || ''), 0);

        let financialExposure = 0;
        allRisks.forEach(risk => {
            if (risk.score >= 12 && risk.assetId) {
                const asset = allAssets.find(a => a.id === risk.assetId);
                if (asset) {
                    financialExposure += calculateDepreciation(asset.purchasePrice || 0, asset.purchaseDate || '');
                }
            }
        });

        return {
            stats: {
                risks: allRisks.length,
                assets: allAssets.length,
                compliance: compScore,
                highRisks: allRisks.filter(r => r.score >= 15).length,
                auditsOpen: openAuditsCount,
                activeIncidents: activeIncidentsCount,
                assetValue: totalAssetValue,
                financialRisk: financialExposure
            },
            radarData: rData,
            complianceScore: compScore
        };
    }, [controls, allAssets, allRisks, openAuditsCount, activeIncidentsCount]);

    const scoreGrade = React.useMemo(() => {
        if (!Number.isFinite(complianceScore) || complianceScore < 0) return undefined;
        if (complianceScore >= 85) return 'A';
        if (complianceScore >= 70) return 'B';
        if (complianceScore >= 50) return 'C';
        return 'D';
    }, [complianceScore]);

    // Personalized Risks
    const myRisksList = React.useMemo(() => {
        if (!user) return [];
        return allRisks.filter(r => r.ownerId === user.uid).sort((a, b) => b.score - a.score).slice(0, 5);
    }, [allRisks, user]);

    const projectRisks = React.useMemo(() => {
        if (!user || user.role !== 'project_manager') return [];
        const projectIds = myProjects.map(p => p.id);
        return allRisks.filter(r =>
            (r.ownerId === user.uid) ||
            (r.relatedProjectIds?.some((pid: string) => projectIds.includes(pid)))
        ).sort((a, b) => b.score - a.score).slice(0, 5);
    }, [allRisks, user, myProjects]);

    const isEmpty = React.useMemo(() => !loading && allRisks.length === 0 && allAssets.length === 0 && myProjects.length === 0, [loading, allRisks, allAssets, myProjects]);



    const insight = React.useMemo(() => {
        const expiredDocs = myDocs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < new Date()).length;
        const overdueAudits = myAudits.filter(a => new Date(a.dateScheduled) < new Date() && a.status !== 'Terminé' && a.status !== 'Validé').length;
        const criticalSuppliersNoScore = allSuppliers.filter(s => (s.criticality === 'Critique' || s.criticality === 'Élevée') && (!s.securityScore || s.securityScore < 50)).length;
        const expiredContracts = allSuppliers.filter(s => s.contractEnd && new Date(s.contractEnd) < new Date()).length;
        const actionable = controls.filter(c => c.status !== 'Exclu' && c.status !== 'Non applicable').length;

        if (activeIncidentsCount > 0) {
            return { text: t('dashboard.insightIncidents').replace('{count}', activeIncidentsCount.toString()), type: 'danger' as const, details: t('dashboard.insightIncidentsDesc'), action: t('common.manage'), link: "/incidents" };
        } else if (stats.financialRisk > 100000) {
            return { text: t('dashboard.insightFinancial'), type: 'danger' as const, details: t('dashboard.insightFinancialDesc').replace('{amount}', new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(stats.financialRisk)), action: t('common.view') + ' ' + t('dashboard.risks'), link: "/risks" };
        } else if (allRisks.filter(r => r.score >= 15).length > 0) {
            return { text: t('dashboard.insightRisks'), type: 'warning' as const, details: t('dashboard.insightRisksDesc'), action: t('common.view') + ' ' + t('dashboard.risks'), link: "/risks" };
        } else if (complianceScore < 50 && actionable > 0) {
            return { text: t('dashboard.insightCompliance'), type: 'warning' as const, details: t('dashboard.insightComplianceDesc'), action: t('dashboard.plan'), link: "/compliance" };
        } else if (expiredDocs > 0) {
            return { text: t('dashboard.insightDocs').replace('{count}', expiredDocs.toString()), type: 'warning' as const, details: t('dashboard.insightDocsDesc'), action: t('dashboard.review'), link: "/documents" };
        } else if (expiredContracts > 0) {
            return { text: t('dashboard.insightContracts').replace('{count}', expiredContracts.toString()), type: 'warning' as const, details: t('dashboard.insightContractsDesc'), action: t('sidebar.suppliers'), link: "/suppliers" };
        } else if (criticalSuppliersNoScore > 0) {
            return { text: t('dashboard.insightSuppliers').replace('{count}', criticalSuppliersNoScore.toString()), type: 'warning' as const, details: t('dashboard.insightSuppliersDesc'), action: t('dashboard.assess'), link: "/suppliers" };
        } else if (overdueAudits > 0) {
            return { text: t('dashboard.insightAudits').replace('{count}', overdueAudits.toString()), type: 'warning' as const, details: t('dashboard.insightAuditsDesc'), action: t('sidebar.audits'), link: "/audits" };
        }
        return { text: t('dashboard.insightStable'), type: 'success' as const, details: "", action: "", link: "" };
    }, [activeIncidentsCount, stats.financialRisk, allRisks, complianceScore, controls, myDocs, myAudits, allSuppliers, t]);

    const healthIssues = React.useMemo(() => {
        const issues: HealthIssue[] = [];
        const unmitigatedRisks = allRisks.filter(r => r.score >= 15 && !r.mitigationControlIds?.length).length;
        if (unmitigatedRisks > 0) issues.push({ id: '1', type: 'danger', message: t('dashboard.issueRisks'), count: unmitigatedRisks, link: '/risks' });
        const unprovenControls = controls.filter(c => c.status === 'Implémenté' && (!c.evidenceIds || c.evidenceIds.length === 0)).length;
        if (unprovenControls > 0) issues.push({ id: '2', type: 'warning', message: t('dashboard.issueControls'), count: unprovenControls, link: '/compliance' });

        const overdueAudits = myAudits.filter(a => new Date(a.dateScheduled) < new Date() && a.status !== 'Terminé' && a.status !== 'Validé').length;
        if (overdueAudits > 0) issues.push({ id: '6', type: 'warning', message: t('dashboard.issueAudits'), count: overdueAudits, link: '/audits' });
        return issues;
    }, [allRisks, controls, myAudits, t]);

    const myActionItems = React.useMemo(() => {
        if (!user) return [];
        const myItems: ActionItem[] = [];

        // Audits
        myAudits.forEach(a => {
            myItems.push({ id: a.id, type: 'audit', title: a.name, date: a.dateScheduled, status: a.status, link: '/audits' });
        });

        // Incidents
        myIncidents.forEach(i => {
            myItems.push({ id: i.id, type: 'incident', title: i.title, date: i.dateReported, status: i.status, link: '/incidents' });
        });

        // Risks
        const myRisks = allRisks.filter(r => r.ownerId === user.uid && r.status !== 'Fermé');
        myRisks.forEach(r => {
            myItems.push({ id: r.id, type: 'risk', title: r.threat, date: r.updatedAt || new Date().toISOString(), status: r.status, link: '/risks' });
        });

        const next30Days = new Date(); next30Days.setDate(next30Days.getDate() + 30);
        myDocs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < next30Days).forEach(d => {
            myItems.push({ id: d.id, type: 'document', title: d.title, date: d.nextReviewDate!, status: t('dashboard.statusReview'), link: '/documents' });
        });
        publishedDocs.filter(d => !d.readBy?.includes(user.uid)).forEach(d => {
            myItems.push({ id: d.id, type: 'policy', title: d.title, date: new Date().toISOString(), status: t('dashboard.statusToRead'), link: '/documents' });
        });
        myProjects.forEach(p => {
            myItems.push({ id: p.id, type: 'project', title: p.name, date: p.dueDate, status: `${p.progress}%`, link: '/projects' });
        });
        myItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return myItems;
    }, [user, myAudits, myDocs, publishedDocs, myProjects, myIncidents, allRisks, t]);

    // Stats History Generation
    useEffect(() => {
        if (loading || !user?.organizationId) return;
        const todayStr = new Date().toISOString().split('T')[0];
        if (!historyStats.some(d => d.date === todayStr)) {
            const saveStats = async () => {
                try {
                    const statId = `${todayStr}_${user.organizationId}`;
                    await setDoc(doc(db, 'stats_history', statId), {
                        organizationId: user.organizationId, date: todayStr, risks: allRisks.length,
                        compliance: complianceScore, incidents: activeIncidentsCount, timestamp: new Date().toISOString(),
                        frameworks: Object.entries(radarData).reduce((acc, [subject, data]) => ({ ...acc, [subject]: data.A }), {})
                    });
                } catch { /* Silent fail */ }
            };
            saveStats();
        }
    }, [loading, historyStats, user?.organizationId, allRisks.length, complianceScore, activeIncidentsCount, radarData]);

    const copyRules = () => { navigator.clipboard.writeText(`rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}`); addToast(t('dashboard.rulesCopied'), "success"); };

    const generateICal = async () => {
        if (!user?.organizationId) return;
        try {
            const [auditsSnap, projectsSnap] = await Promise.all([
                getDocs(query(collection(db, 'audits'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'projects'), where('organizationId', '==', user.organizationId)))
            ]);
            let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Sentinel GRC//FR\n";
            auditsSnap.forEach(doc => { const d = doc.data(); const date = d.dateScheduled ? d.dateScheduled.replace(/-/g, '') : ''; if (date) icsContent += `BEGIN:VEVENT\nSUMMARY:${t('dashboard.icsAudit')}: ${d.name}\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nDESCRIPTION:${t('dashboard.icsAuditor')}: ${d.auditor}\nEND:VEVENT\n`; });
            projectsSnap.forEach(doc => { const d = doc.data(); const date = d.dueDate ? d.dueDate.replace(/-/g, '') : ''; if (date) icsContent += `BEGIN:VEVENT\nSUMMARY:${t('dashboard.icsProject')}: ${d.name}\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nDESCRIPTION:${t('dashboard.icsManager')}: ${d.manager}\nEND:VEVENT\n`; });
            icsContent += "END:VCALENDAR";
            const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })); link.download = 'sentinel_calendar.ics'; link.click(); addToast(t('dashboard.calendarExported'), "success");
        } catch (err) { ErrorLogger.handleErrorWithToast(err, 'Dashboard.generateICal', 'UNKNOWN_ERROR'); }
    };

    const generateExecutiveReport = async () => {
        setIsGeneratingReport(true);
        addToast(t('dashboard.generatingReport'), "info");
        try {
            const organizationName = user?.organizationName || 'Organisation';
            // Context for AI
            const context = {
                organizationName,
                complianceScore,
                activeIncidents: activeIncidentsCount,
                openAudits: openAuditsCount,
                riskCount: allRisks.length,
                highRisks: topRisks.filter(r => r.score >= 15).length,
                financialRisk: stats.financialRisk,
                criticalRisks: topRisks.slice(0, 3).map(r => ({ threat: r.threat, score: r.score }))
            };

            const summary = await aiService.generateExecutiveDashboardSummary(context);

            const metrics = [
                { label: t('dashboard.complianceScore'), value: `${complianceScore}%` },
                { label: t('dashboard.criticalRisks'), value: topRisks.filter(r => r.score >= 15).length.toString() },
                { label: t('dashboard.activeIncidents'), value: activeIncidentsCount.toString() },
                { label: t('dashboard.openAudits'), value: openAuditsCount.toString() }
            ];

            const chartStats = radarData.map((d, i) => ({
                label: d.subject,
                value: d.A,
                color: ['#0F172A', '#334155', '#475569', '#64748B'][i % 4]
            }));

            PdfService.generateExecutiveReport(
                {
                    title: t('dashboard.reportTitle'),
                    subtitle: t('dashboard.generatedOn').replace('{date}', new Date().toLocaleDateString()),
                    filename: `Rapport_Executif_${organizationName}_${new Date().toISOString().split('T')[0]}.pdf`,
                    organizationName,
                    organizationLogo,
                    summary,
                    metrics,
                    stats: chartStats,
                    author: user?.displayName || 'Sentinel GRC',
                    orientation: 'portrait'
                },
                (doc, startY) => {
                    let y = startY;

                    // Top Risks Table
                    doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
                    doc.text(t('dashboard.top5Risks'), 14, y);
                    y += 5;

                    const riskData = topRisks.map(r => [r.threat, r.score.toString(), r.strategy, r.status]);
                    doc.autoTable({
                        startY: y,
                        head: [[t('dashboard.threat'), t('dashboard.score'), t('dashboard.strategy'), t('dashboard.status')]],
                        body: riskData,
                        theme: 'grid',
                        headStyles: { fillColor: [79, 70, 229] },
                        styles: { fontSize: 8, cellPadding: 2 },
                        margin: { left: 14, right: 14 }
                    });

                    const lastAutoTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
                    y = (lastAutoTable?.finalY ?? y) + 15;

                    // Compliance Summary
                    doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
                    doc.text(t('dashboard.complianceByDomain'), 14, y);
                    y += 5;

                    const complianceData = radarData.map(d => [d.subject, `${d.A}%`]);
                    doc.autoTable({
                        startY: y,
                        head: [[t('dashboard.domain'), t('dashboard.score')]],
                        body: complianceData,
                        theme: 'grid',
                        headStyles: { fillColor: [79, 70, 229] },
                        styles: { fontSize: 8, cellPadding: 2 },
                        margin: { left: 14, right: 14 }
                    });
                }
            );
            addToast(t('dashboard.reportGenerated'), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Dashboard.generateExecutiveReport', 'REPORT_GENERATION_FAILED');
            addToast(t('dashboard.reportError'), "error");
        } finally {
            setIsGeneratingReport(false);
        }
    };



    if (error === 'permission-denied') { return (<div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in p-6"> <div className="glass-panel rounded-[2rem] p-8 max-w-2xl w-full relative overflow-hidden border-l-4 border-l-red-500 shadow-xl"> <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.accessDenied')}</h2> <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">{t('dashboard.dbLocked')}</p> <button onClick={copyRules} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm">{t('dashboard.copyRules')}</button> </div> </div>); }

    if (loading) {
        return <DashboardSkeleton />;
    }

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="p-6 md:p-8 max-w-[1920px] mx-auto space-y-8 pb-20 relative min-h-screen animate-fade-in"
        >
            <MasterpieceBackground />
            <SEO
                title="Tableau de bord de Gouvernance"
                description="Vue d'overview de votre posture de sécurité et conformité."
                keywords="Pilotage SSI, Tableau de bord CISO, KPI Cyber, Conformité, Risques, Gouvernance"
            />



            <DashboardHeader
                user={user}
                organizationName={organizationName}
                scoreGrade={scoreGrade}
                loading={loading}
                isEmpty={isEmpty}
                navigate={navigate}
                t={t}
                insight={insight}
                generateICal={generateICal}
                generateExecutiveReport={generateExecutiveReport}

                isGeneratingReport={isGeneratingReport}
                isEditing={isEditing}
                onToggleEdit={() => setIsEditing(!isEditing)}
            />

            {showGettingStarted && (
                <motion.div variants={slideUpVariants}>
                    <GettingStartedWidget onClose={() => setShowGettingStarted(false)} />
                </motion.div>
            )}

            <motion.div variants={slideUpVariants}>
                <QuickActions navigate={navigate} t={t} stats={stats} />
            </motion.div>

            {/* Role-based Widget Visibility */}
            <motion.div variants={slideUpVariants}>
                {(() => {
                    const role = user?.role || 'user';

                    if (['admin', 'rssi'].includes(role)) {
                        return (
                            <AdminDashboardView
                                stats={stats}
                                isEditing={isEditing}
                                loading={loading}
                                navigate={navigate}
                                t={t}
                                theme={theme}
                                myActionItems={myActionItems}
                                historyData={historyData}
                                healthIssues={healthIssues}
                                topRisks={topRisks}
                                recentActivity={recentActivity}
                                radarData={radarData}
                            />
                        );
                    }

                    if (role === 'direction') {
                        return (
                            <DirectionDashboardView
                                stats={stats}
                                loading={loading}
                                navigate={navigate}
                                t={t}
                                theme={theme}
                                historyData={historyData}
                                healthIssues={healthIssues}
                                topRisks={topRisks}
                            />
                        );
                    }

                    if (role === 'auditor') {
                        return (
                            <AuditorDashboardView
                                loading={loading}
                                navigate={navigate}
                                t={t}
                                theme={theme}
                                myActionItems={myActionItems}
                                historyData={historyData}
                                recentActivity={recentActivity}
                                healthIssues={healthIssues}
                            />
                        );
                    }

                    if (role === 'project_manager') {
                        return (
                            <ProjectManagerDashboardView
                                loading={loading}
                                navigate={navigate}
                                t={t}
                                myActionItems={myActionItems}
                                projectRisks={projectRisks}
                            />
                        );
                    }

                    return (
                        <OperationalDashboardView
                            loading={loading}
                            navigate={navigate}
                            t={t}
                            myActionItems={myActionItems}
                            myRisksList={myRisksList}
                        />
                    );
                })()}
            </motion.div>
        </motion.div>
    );
};
