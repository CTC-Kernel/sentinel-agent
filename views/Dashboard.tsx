import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, setDoc, limit, getCountFromServer, getDoc, orderBy } from 'firebase/firestore';
import { Risk, Control, Audit, Project, DailyStat, Document, Asset, SystemLog, Supplier, Incident } from '../types';
import { PdfService } from '../services/PdfService';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ErrorLogger } from '../services/errorLogger';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { CyberNewsWidget } from '../components/dashboard/CyberNewsWidget';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { GettingStartedWidget } from '../components/dashboard/widgets/GettingStartedWidget';

// Widgets
import { DashboardHeader } from '../components/dashboard/widgets/DashboardHeader';
import { QuickActions } from '../components/dashboard/widgets/QuickActions';
import { StatsOverview } from '../components/dashboard/widgets/StatsOverview';
import { MyWorkspaceWidget } from '../components/dashboard/widgets/MyWorkspaceWidget';
import { ComplianceEvolutionWidget } from '../components/dashboard/widgets/ComplianceEvolutionWidget';
import { HealthCheckWidget } from '../components/dashboard/widgets/HealthCheckWidget';
import { PriorityRisksWidget } from '../components/dashboard/widgets/PriorityRisksWidget';
import { RecentActivityWidget } from '../components/dashboard/widgets/RecentActivityWidget';

interface HealthIssue { id: string; type: 'warning' | 'danger'; message: string; count: number; link: string; }
interface ActionItem { id: string; type: 'audit' | 'document' | 'project' | 'policy' | 'incident' | 'risk'; title: string; date: string; status: string; link: string; }

export const Dashboard: React.FC = () => {
    const [manualLoading, setManualLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [organizationName, setOrganizationName] = useState<string>('');
    const [teamSize, setTeamSize] = useState<number | null>(null);
    const [activeIncidentsCount, setActiveIncidentsCount] = useState(0);
    const [openAuditsCount, setOpenAuditsCount] = useState(0);
    const [showGettingStarted, setShowGettingStarted] = useState(true);

    const { user, theme, addToast, t } = useStore();
    const navigate = useNavigate();

    // Hooks
    const { data: controls, loading: controlsLoading } = useFirestoreCollection<Control>('controls', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true });
    const { data: recentActivity, loading: logsLoading } = useFirestoreCollection<SystemLog>('system_logs', [where('organizationId', '==', user?.organizationId || 'ignore'), orderBy('timestamp', 'desc'), limit(10)], { logError: true, realtime: true });
    const { data: historyStats, loading: historyLoading } = useFirestoreCollection<DailyStat>('stats_history', [where('organizationId', '==', user?.organizationId || 'ignore'), limit(60)], { logError: true, realtime: true });
    const { data: allRisks, loading: risksLoading } = useFirestoreCollection<Risk>('risks', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true });
    const { data: allAssets, loading: assetsLoading } = useFirestoreCollection<Asset>('assets', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true });
    const { data: allSuppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>('suppliers', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true });

    const { data: myProjects, loading: projectsLoading } = useFirestoreCollection<Project>('projects', [where('organizationId', '==', user?.organizationId || 'ignore'), where('manager', '==', user?.displayName || 'ignore'), where('status', '==', 'En cours')], { logError: true, realtime: true });
    const { data: myAudits, loading: auditsLoading } = useFirestoreCollection<Audit>('audits', [where('organizationId', '==', user?.organizationId || 'ignore'), where('auditor', '==', user?.displayName || 'ignore'), where('status', 'in', ['Planifié', 'En cours'])], { logError: true, realtime: true });
    const { data: myDocs, loading: myDocsLoading } = useFirestoreCollection<Document>('documents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('owner', '==', user?.email || 'ignore')], { logError: true, realtime: true });
    const { data: publishedDocs, loading: publishedDocsLoading } = useFirestoreCollection<Document>('documents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('status', '==', 'Publié')], { logError: true, realtime: true });
    const { data: myIncidents, loading: myIncidentsLoading } = useFirestoreCollection<Incident>('incidents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('reporter', '==', user?.displayName || 'ignore'), where('status', '!=', 'Fermé')], { logError: true, realtime: true });

    const loading = manualLoading || controlsLoading || logsLoading || historyLoading || risksLoading || assetsLoading || suppliersLoading || projectsLoading || auditsLoading || myDocsLoading || publishedDocsLoading || myIncidentsLoading;

    // Fetch Counts & Org Name
    useEffect(() => {
        if (!user?.organizationId) {
            setManualLoading(false);
            return;
        }

        const fetchCounts = async () => {
            setManualLoading(true);
            try {
                const orgId = user.organizationId!;
                // Organization Name
                try {
                    const orgSnap = await getDoc(doc(db, 'organizations', orgId));
                    if (orgSnap.exists()) setOrganizationName(orgSnap.data().name || '');
                    else if (user.organizationName) setOrganizationName(user.organizationName);
                } catch { if (user.organizationName) setOrganizationName(user.organizationName); }

                // Counts
                const [userCount, incCount, auditCount] = await Promise.all([
                    getCountFromServer(query(collection(db, 'users'), where('organizationId', '==', orgId))),
                    getCountFromServer(query(collection(db, 'incidents'), where('organizationId', '==', orgId), where('status', '!=', 'Fermé'))),
                    getCountFromServer(query(collection(db, 'audits'), where('organizationId', '==', orgId), where('status', 'in', ['Planifié', 'En cours'])))
                ]);

                setTeamSize(userCount.data().count);
                setActiveIncidentsCount(incCount.data().count);
                setOpenAuditsCount(auditCount.data().count);
                setError(null);
            } catch (err) {
                ErrorLogger.handleErrorWithToast(err, 'Dashboard.fetchCounts', 'FETCH_FAILED');
                if ((err as { code?: string })?.code === 'permission-denied') setError('permission-denied');
            } finally {
                setManualLoading(false);
            }
        };
        fetchCounts();
    }, [user?.organizationId, user?.organizationName, t]);

    // Derived Data
    const topRisks = React.useMemo(() => [...allRisks].sort((a, b) => b.score - a.score).slice(0, 5), [allRisks]);

    const historyData = React.useMemo(() => {
        return historyStats
            .filter(d => typeof d.compliance === 'number' && Number.isFinite(d.compliance))
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
                        compliance: complianceScore, incidents: activeIncidentsCount, timestamp: new Date().toISOString()
                    });
                } catch { /* Silent fail */ }
            };
            saveStats();
        }
    }, [loading, historyStats, user?.organizationId, allRisks.length, complianceScore, activeIncidentsCount]);

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

    const generateExecutiveReport = () => {
        PdfService.generateCustomReport(
            {
                title: t('dashboard.reportTitle'),
                subtitle: t('dashboard.generatedOn').replace('{date}', new Date().toLocaleDateString()),
                filename: t('dashboard.reportFilename')
            },
            (doc, startY) => {
                let y = startY;

                // Stats Grid
                doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
                doc.text(t('dashboard.keyIndicators'), 14, y);
                y += 10;

                const statsData = [
                    { label: t('dashboard.complianceScore'), value: `${complianceScore}%` },
                    { label: t('dashboard.criticalRisks'), value: topRisks.filter(r => r.score >= 15).length.toString() },
                    { label: t('dashboard.activeIncidents'), value: activeIncidentsCount.toString() },
                    { label: t('dashboard.openAudits'), value: openAuditsCount.toString() }
                ];

                let x = 14;
                statsData.forEach(stat => {
                    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
                    doc.rect(x, y, 40, 25, 'FD');
                    doc.setFontSize(16); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
                    doc.text(stat.value, x + 20, y + 12, { align: 'center' });
                    doc.setFontSize(8); doc.setTextColor(100); doc.setFont('helvetica', 'normal');
                    doc.text(stat.label, x + 20, y + 20, { align: 'center' });
                    x += 45;
                });

                y += 35;

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
                    margin: { left: 14, right: 14 }
                });

                y = doc.lastAutoTable.finalY + 15;

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
                    margin: { left: 14, right: 14 }
                });
            }
        );
    };

    if (error === 'permission-denied') { return (<div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in p-6"> <div className="glass-panel rounded-[2rem] p-8 max-w-2xl w-full relative overflow-hidden border-l-4 border-l-red-500 shadow-xl"> <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.accessDenied')}</h2> <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">{t('dashboard.dbLocked')}</p> <button onClick={copyRules} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm">{t('dashboard.copyRules')}</button> </div> </div>); }

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <Helmet>
                <title>Dashboard | Sentinel GRC</title>
            </Helmet>

            <DashboardHeader
                user={user}
                organizationName={organizationName}
                scoreGrade={scoreGrade}
                radarData={radarData}
                teamSize={teamSize}
                activeIncidentsCount={activeIncidentsCount}
                openAuditsCount={openAuditsCount}
                loading={loading}
                isEmpty={isEmpty}
                navigate={navigate}
                t={t}
                theme={theme}
                insight={insight}
                generateICal={generateICal}
                generateExecutiveReport={generateExecutiveReport}
            />

            {showGettingStarted && <GettingStartedWidget onClose={() => setShowGettingStarted(false)} />}

            <QuickActions navigate={navigate} t={t} stats={stats} />

            {/* Role-based Widget Visibility */}
            {(() => {
                const role = user?.role || 'user';

                // 1. Admin / RSSI (Full View)
                if (['admin', 'rssi'].includes(role)) {
                    return (
                        <>
                            <StatsOverview stats={stats} loading={loading} navigate={navigate} t={t} />
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <MyWorkspaceWidget myActionItems={myActionItems} loading={loading} navigate={navigate} t={t} />
                                <ComplianceEvolutionWidget historyData={historyData} loading={loading} t={t} theme={theme} />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <HealthCheckWidget healthIssues={healthIssues} loading={loading} navigate={navigate} t={t} />
                                <PriorityRisksWidget topRisks={topRisks} loading={loading} navigate={navigate} t={t} />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2">
                                    <RecentActivityWidget recentActivity={recentActivity} loading={loading} t={t} />
                                </div>
                                <div className="lg:col-span-1">
                                    <CyberNewsWidget />
                                </div>
                            </div>
                        </>
                    );
                }

                // 2. Direction (Strategic View - No granular activity/tasks)
                if (role === 'direction') {
                    return (
                        <>
                            <StatsOverview stats={stats} loading={loading} navigate={navigate} t={t} />
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <ComplianceEvolutionWidget historyData={historyData} loading={loading} t={t} theme={theme} />
                                <PriorityRisksWidget topRisks={topRisks} loading={loading} navigate={navigate} t={t} />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2">
                                    <HealthCheckWidget healthIssues={healthIssues} loading={loading} navigate={navigate} t={t} />
                                </div>
                                <div className="lg:col-span-1">
                                    <CyberNewsWidget />
                                </div>
                            </div>
                        </>
                    );
                }

                // 3. Auditor (Audit & Compliance Focus)
                if (role === 'auditor') {
                    return (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2">
                                    <MyWorkspaceWidget myActionItems={myActionItems} loading={loading} navigate={navigate} t={t} />
                                </div>
                                <div className="lg:col-span-1">
                                    <ComplianceEvolutionWidget historyData={historyData} loading={loading} t={t} theme={theme} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <RecentActivityWidget recentActivity={recentActivity} loading={loading} t={t} />
                                <HealthCheckWidget healthIssues={healthIssues} loading={loading} navigate={navigate} t={t} />
                            </div>
                        </>
                    );
                }

                // 4. Project Manager (Projects & Risks)
                if (role === 'project_manager') {
                    return (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2">
                                    <MyWorkspaceWidget myActionItems={myActionItems} loading={loading} navigate={navigate} t={t} />
                                </div>
                                <div className="lg:col-span-1">
                                    <PriorityRisksWidget topRisks={projectRisks} loading={loading} navigate={navigate} t={t} title="Risques Projets" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2">
                                    <CyberNewsWidget />
                                </div>
                            </div>
                        </>
                    );
                }

                // 5. User (Operational)
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <MyWorkspaceWidget myActionItems={myActionItems} loading={loading} navigate={navigate} t={t} />
                        </div>
                        <div className="lg:col-span-1 space-y-6">
                            <PriorityRisksWidget topRisks={myRisksList} loading={loading} navigate={navigate} t={t} title="Mes Risques" />
                            <CyberNewsWidget />
                        </div>
                    </div>
                );
            })()}
        </div >
    );
};
