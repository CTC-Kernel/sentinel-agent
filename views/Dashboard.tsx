import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer, Tooltip, AreaChart, Area, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ShieldAlert, CheckCircle2, AlertTriangle, Download, Siren, TrendingUp, Stethoscope, History, Server, Flame, CalendarDays, User, Zap, ArrowRight, Euro, Settings as Settings3D, FileText, ClipboardCheck } from '../components/ui/Icons';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { ChartTooltip } from '../components/ui/ChartTooltip';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, setDoc, limit, getCountFromServer, getDoc, orderBy } from 'firebase/firestore';
import { Risk, Control, Audit, Project, DailyStat, Document, Asset, SystemLog, Supplier } from '../types';
import { Skeleton } from '../components/ui/Skeleton';
import { PdfService } from '../services/PdfService';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ErrorLogger } from '../services/errorLogger';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { CyberNewsWidget } from '../components/dashboard/CyberNewsWidget';

const StatCard: React.FC<{ title: string; value: string | number | null; icon: React.ElementType; trend?: string; colorClass: string; delay?: string; onClick?: () => void }> = ({ title, value, icon: Icon, trend, colorClass, delay, onClick }) => (
    <div
        onClick={onClick}
        className={`relative group glass-panel p-6 rounded-[2rem] hover:shadow-apple transition-all duration-500 hover:-translate-y-1 overflow-hidden cursor-pointer ${delay || ''}`}
    >
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none"></div>
        <div className="flex flex-col h-full justify-between relative z-10">
            <div className="flex justify-between items-start mb-6">
                <div
                    className={`p-3.5 rounded-[1.2rem] ${colorClass} bg-opacity-10 ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm group-hover:scale-110 transition-transform duration-500`}
                >
                    <Icon className={`h-6 w-6 ${colorClass.replace('bg-', 'text-')}`} strokeWidth={2} />
                </div>
                {trend && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20 shadow-sm">
                    {trend}
                </span>}
            </div>
            <div>
                {value === null ? <Skeleton className="h-10 w-16 mb-1 rounded-xl" /> : <h3 className="text-4xl font-bold tracking-tighter text-slate-900 dark:text-white font-display">{value}</h3>}
                <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400 mt-1 tracking-wide">{title}</p>
            </div>
        </div>
    </div>
);

interface HealthIssue { id: string; type: 'warning' | 'danger'; message: string; count: number; link: string; }
interface ActionItem { id: string; type: 'audit' | 'document' | 'project' | 'policy'; title: string; date: string; status: string; link: string; }

export const Dashboard: React.FC = () => {
    const [manualLoading, setManualLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [organizationName, setOrganizationName] = useState<string>('');
    const [teamSize, setTeamSize] = useState<number | null>(null);
    const [activeIncidentsCount, setActiveIncidentsCount] = useState(0);
    const [openAuditsCount, setOpenAuditsCount] = useState(0);
    const [activityExpanded, setActivityExpanded] = useState(false);

    const { user, theme, addToast, t } = useStore();
    const navigate = useNavigate();

    // Hooks
    const { data: controls, loading: controlsLoading } = useFirestoreCollection<Control>('controls', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true });
    const { data: recentActivity, loading: logsLoading } = useFirestoreCollection<SystemLog>('system_logs', [where('organizationId', '==', user?.organizationId || 'ignore'), orderBy('timestamp', 'desc'), limit(10)], { logError: true });
    const { data: historyStats, loading: historyLoading } = useFirestoreCollection<DailyStat>('stats_history', [where('organizationId', '==', user?.organizationId || 'ignore'), limit(60)], { logError: true });
    const { data: allRisks, loading: risksLoading } = useFirestoreCollection<Risk>('risks', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true });
    const { data: allAssets, loading: assetsLoading } = useFirestoreCollection<Asset>('assets', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true });
    const { data: allSuppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>('suppliers', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true });

    const { data: myProjects, loading: projectsLoading } = useFirestoreCollection<Project>('projects', [where('organizationId', '==', user?.organizationId || 'ignore'), where('manager', '==', user?.displayName || 'ignore'), where('status', '==', 'En cours')], { logError: true });
    const { data: myAudits, loading: auditsLoading } = useFirestoreCollection<Audit>('audits', [where('organizationId', '==', user?.organizationId || 'ignore'), where('auditor', '==', user?.displayName || 'ignore'), where('status', 'in', ['Planifié', 'En cours'])], { logError: true });
    const { data: myDocs, loading: myDocsLoading } = useFirestoreCollection<Document>('documents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('owner', '==', user?.email || 'ignore')], { logError: true });
    const { data: publishedDocs, loading: publishedDocsLoading } = useFirestoreCollection<Document>('documents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('status', '==', 'Publié')], { logError: true });

    const loading = manualLoading || controlsLoading || logsLoading || historyLoading || risksLoading || assetsLoading || suppliersLoading || projectsLoading || auditsLoading || myDocsLoading || publishedDocsLoading;

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

    const isEmpty = React.useMemo(() => !loading && allRisks.length === 0 && allAssets.length === 0 && myProjects.length === 0, [loading, allRisks, allAssets, myProjects]);

    const scoreGrade = React.useMemo(() => {
        if (activeIncidentsCount > 0) return 'D';
        if (complianceScore < 50 || allRisks.filter(r => r.score >= 20).length > 0) return 'C';
        if (complianceScore < 80 || allRisks.filter(r => r.score >= 15).length > 0) return 'B';
        return 'A';
    }, [activeIncidentsCount, complianceScore, allRisks]);

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
        myAudits.forEach(a => {
            myItems.push({ id: a.id, type: 'audit', title: a.name, date: a.dateScheduled, status: a.status, link: '/audits' });
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
    }, [user, myAudits, myDocs, publishedDocs, myProjects, t]);

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
    const getActivityIcon = (resource: string) => { switch (resource) { case 'Risk': return <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />; case 'Incident': return <Siren className="h-3.5 w-3.5 text-red-500" />; case 'Asset': return <Server className="h-3.5 w-3.5 text-blue-500" />; default: return <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />; } };

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

                const stats = [
                    { label: t('dashboard.complianceScore'), value: `${complianceScore}%` },
                    { label: t('dashboard.criticalRisks'), value: topRisks.filter(r => r.score >= 15).length.toString() },
                    { label: t('dashboard.activeIncidents'), value: activeIncidentsCount.toString() },
                    { label: t('dashboard.openAudits'), value: openAuditsCount.toString() }
                ];

                let x = 14;
                stats.forEach(stat => {
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

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            <Helmet>
                <title>{t('dashboard.metaTitle')}</title>
                <meta name="description" content={t('dashboard.metaDescription')} />
            </Helmet>

            <div className="relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-200/60 dark:ring-white/5 transition-all duration-500 group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5 dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-purple-500/10 opacity-100"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>

                <div className="relative z-10 p-6 md:p-8">
                    {isEmpty && !loading ? (
                        /* État vide élégant */
                        <div className="flex flex-col items-center justify-center text-center py-8">
                            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md shadow-sm">
                                <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full mr-2.5 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                                {organizationName || user?.organizationName || t('dashboard.operationalSystem')}
                            </div>

                            <h2 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight font-display mb-6">
                                {t('dashboard.welcomeTitle')}
                            </h2>
                            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mb-10 leading-relaxed font-medium">
                                {t('dashboard.welcomeSubtitle1')}<br />
                                {t('dashboard.welcomeSubtitle2')}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full mx-auto">
                                <button
                                    onClick={() => navigate('/assets')}
                                    className="group relative p-8 bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>
                                    <div className="flex flex-col items-center gap-4 relative z-10">
                                        <div className="p-4 bg-blue-50 dark:bg-slate-900 dark:bg-blue-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                                            <Server className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('dashboard.createAsset')}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.createAssetDesc')}</p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => navigate('/compliance')}
                                    className="group relative p-8 bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>
                                    <div className="flex flex-col items-center gap-4 relative z-10">
                                        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                                            <ClipboardCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('dashboard.configureControls')}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.configureControlsDesc')}</p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => navigate('/documents')}
                                    className="group relative p-8 bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl hover:border-purple-400 dark:hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>
                                    <div className="flex flex-col items-center gap-4 relative z-10">
                                        <div className="p-4 bg-purple-50 dark:bg-purple-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                                            <FileText className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('dashboard.addDocuments')}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{t('dashboard.addDocumentsDesc')}</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* État normal avec données */
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                            <div className="flex-1 min-w-0 space-y-6">
                                <div className="flex items-center gap-5">
                                    <div className={`flex items-center justify-center w-16 h-16 shrink-0 rounded-2xl text-4xl font-black shadow-xl border-4 ${scoreGrade === 'A' ? 'bg-emerald-500 border-emerald-400/50 text-white shadow-emerald-500/20' : scoreGrade === 'B' ? 'bg-indigo-500 border-indigo-400/50 text-white shadow-indigo-500/20' : scoreGrade === 'C' ? 'bg-orange-500 border-orange-400/50 text-white shadow-orange-500/20' : 'bg-red-500 border-red-400/50 text-white shadow-red-500/20'}`}>
                                        {scoreGrade}
                                    </div>
                                    <div>
                                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-display">Sentinel GRC</h1>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-widest">
                                                {organizationName || user?.organizationName || t('dashboard.operationalSystem')}
                                            </span>
                                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                                                <strong className="text-slate-900 dark:text-white">{loading ? '...' : stats.compliance}%</strong> {t('dashboard.compliance')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className={`flex items-center p-4 rounded-xl backdrop-blur-md border transition-all duration-300 hover:scale-[1.01] shadow-sm ${insight.type === 'danger' ? 'bg-red-50/60 dark:bg-red-900/10 border-red-200/60 dark:border-red-500/20' : insight.type === 'warning' ? 'bg-orange-50/60 dark:bg-orange-900/10 border-orange-200/60 dark:border-orange-500/20' : 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-500/20'}`}>
                                    <div className={`p-2 rounded-lg shrink-0 mr-4 ${insight.type === 'danger' ? 'bg-red-200/50 dark:bg-red-500/20 text-red-600 dark:text-red-400' : insight.type === 'warning' ? 'bg-orange-200/50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'bg-emerald-200/50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                                        <Zap className="h-5 w-5" fill="currentColor" strokeWidth={0} />
                                    </div>
                                    <div className="flex-1 min-w-0 mr-4">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{insight.text}</p>
                                        {insight.details && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{insight.details}</p>}
                                    </div>
                                    {insight.link && (
                                        <button onClick={() => navigate(insight.link!)} className="shrink-0 px-3 py-1.5 bg-white/60 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 rounded-lg text-xs font-bold transition-all flex items-center border border-black/5 dark:border-white/10 shadow-sm">
                                            <span className="hidden sm:inline mr-1">{insight.action}</span> <ArrowRight className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>

                                {teamSize !== null && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-900/3 dark:bg-white/5 border border-slate-900/5 dark:border-white/10">
                                            {t('dashboard.team')} : {teamSize <= 1 ? t('dashboard.teamAlone') : `${teamSize} ${t('dashboard.teamMembers')}`}
                                        </span>
                                        {teamSize <= 1 && (
                                            <button
                                                onClick={() => navigate('/team')}
                                                className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold shadow-sm hover:scale-105 transition-all"
                                            >
                                                {t('dashboard.inviteTeam')}
                                                <ArrowRight className="h-3 w-3 ml-1" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-3 mt-4">
                                    <button
                                        onClick={generateICal}
                                        className="group flex items-center px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm"
                                    >
                                        <CalendarDays className="h-3.5 w-3.5 mr-2" /> {t('dashboard.exportIcal')}
                                    </button>
                                    <button
                                        onClick={generateExecutiveReport}
                                        className="group flex items-center px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-none"
                                    >
                                        <Download className="h-3.5 w-3.5 mr-2" /> {t('dashboard.executiveReport')}
                                    </button>
                                </div>
                            </div>

                            <div className="w-full max-w-[280px] h-[280px] shrink-0 cursor-pointer hover:scale-105 transition-transform duration-500 relative" onClick={() => navigate('/compliance')}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                        <defs>
                                            <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={theme === 'dark' ? '#3b82f6' : '#0f172a'} stopOpacity={0.6} />
                                                <stop offset="95%" stopColor={theme === 'dark' ? '#3b82f6' : '#0f172a'} stopOpacity={0.1} />
                                            </linearGradient>
                                        </defs>
                                        <PolarGrid
                                            stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)'}
                                            strokeDasharray="4 4"
                                        />
                                        <PolarAngleAxis
                                            dataKey="subject"
                                            tick={{
                                                fill: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.7)',
                                                fontSize: 10,
                                                fontWeight: 700,
                                                fontFamily: 'var(--font-sans)'
                                            }}
                                        />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <RechartsRadar
                                            name={t('dashboard.maturity')}
                                            dataKey="A"
                                            stroke={theme === 'dark' ? '#60a5fa' : '#0f172a'}
                                            strokeWidth={3}
                                            fill="url(#radarFill)"
                                            fillOpacity={1}
                                        />
                                        <Tooltip
                                            content={<ChartTooltip />}
                                            cursor={{ stroke: theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)', strokeWidth: 1 }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                                <div className="absolute bottom-0 w-full text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">{t('dashboard.isoMaturity')}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
                <button onClick={() => navigate('/voxel')} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.05] hover:shadow-xl transition-all duration-300 group shadow-sm hover:border-purple-300 dark:hover:border-purple-500/50 active:scale-95">
                    <div className="p-3 bg-purple-50 dark:bg-purple-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-purple-100 dark:group-hover:bg-purple-500/30">
                        <Settings3D className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{t('dashboard.voxel3d')}</span>
                </button>
                <button onClick={() => navigate('/incidents')} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.05] hover:shadow-xl transition-all duration-300 group shadow-sm hover:border-red-300 dark:hover:border-red-500/50 active:scale-95">
                    <div className="p-3 bg-red-50 dark:bg-red-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-red-100 dark:group-hover:bg-red-500/30">
                        <Siren className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{t('dashboard.incidents')}</span>
                </button>
                <button onClick={() => navigate('/risks')} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.05] hover:shadow-xl transition-all duration-300 group shadow-sm hover:border-orange-300 dark:hover:border-orange-500/50 active:scale-95">
                    <div className="p-3 bg-orange-50 dark:bg-orange-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-orange-100 dark:group-hover:bg-orange-500/30">
                        <ShieldAlert className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{t('dashboard.risks')}</span>
                </button>
                <button onClick={() => navigate('/assets')} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.05] hover:shadow-xl transition-all duration-300 group shadow-sm hover:border-blue-300 dark:hover:border-blue-500/50 active:scale-95">
                    <div className="p-3 bg-blue-50 dark:bg-slate-900 dark:bg-blue-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/30">
                        <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{t('dashboard.assets')}</span>
                </button>
                <button onClick={() => navigate('/team')} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.05] hover:shadow-xl transition-all duration-300 group shadow-sm hover:border-emerald-300 dark:hover:border-emerald-500/50 active:scale-95">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/30">
                        <User className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{t('dashboard.team')}</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title={t('dashboard.activeIncidents')} value={loading ? null : stats.activeIncidents} icon={Siren} colorClass="bg-red-500 text-red-500" trend={stats.activeIncidents > 0 ? "Urgent" : undefined} delay="delay-0" onClick={() => navigate('/incidents')} />
                <StatCard title={t('dashboard.criticalRisks')} value={loading ? null : stats.highRisks} icon={ShieldAlert} colorClass="bg-orange-500 text-orange-500" delay="delay-75" onClick={() => navigate('/risks')} />
                <StatCard title={t('dashboard.financialExposure')} value={loading ? null : `${new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(stats.financialRisk)}`} icon={TrendingUp} colorClass="bg-red-600 text-red-600" trend={stats.financialRisk > 100000 ? "Critique" : undefined} delay="delay-100" onClick={() => navigate('/risks')} />
                <StatCard title={t('dashboard.assetValue')} value={loading ? null : `${new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(stats.assetValue)}`} icon={Euro} colorClass="bg-indigo-500 text-indigo-500" delay="delay-150" onClick={() => navigate('/assets')} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* My Workspace */}
                <div className="glass-panel p-0 rounded-[2rem] overflow-hidden shadow-sm flex flex-col h-[450px] group hover:shadow-md transition-shadow">
                    <div className="px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-center backdrop-blur-sm">
                        <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('dashboard.myWorkspace')}</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{t('dashboard.todoThisWeek')}</p></div>
                        <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm"><User className="w-5 h-5 text-slate-600 dark:text-slate-300" /></div>
                    </div>
                    <div className="flex-1 p-0 overflow-y-auto custom-scrollbar bg-white/40 dark:bg-slate-900/20">
                        {loading ? <Skeleton className="h-full w-full m-4" /> : myActionItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center"><CheckCircle2 className="h-12 w-12 text-emerald-500/30 mb-4" /><p className="text-sm font-bold text-slate-500">{t('dashboard.nothingToReport')}</p></div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {myActionItems.map(item => (
                                    <div key={item.id} onClick={() => navigate(item.link)} className="p-5 hover:bg-white dark:hover:bg-white/5 cursor-pointer group/item transition-all flex items-center gap-4">
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.type === 'audit' ? 'bg-blue-500' : item.type === 'policy' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${item.type === 'audit' ? 'bg-blue-50 dark:bg-slate-900 border-blue-100 text-blue-600 dark:bg-slate-900/20 dark:border-blue-900/30 dark:text-blue-400' : item.type === 'policy' ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400' : 'bg-orange-50 border-orange-100 text-orange-600 dark:bg-orange-900/20 dark:border-orange-900/30 dark:text-orange-400'}`}>
                                                    {item.type === 'audit' ? t('dashboard.typeAudit') : item.type === 'policy' ? t('dashboard.typeSignature') : item.type === 'document' ? t('dashboard.typeReview') : t('dashboard.typeProject')}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium tabular-nums">{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors truncate">{item.title}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5 truncate">{item.status}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover/item:text-slate-500 -translate-x-2 opacity-0 group-hover/item:translate-x-0 group-hover/item:opacity-100 transition-all" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-panel p-0 rounded-[2rem] lg:col-span-2 flex flex-col overflow-hidden shadow-sm h-[450px] group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 backdrop-blur-sm">
                        <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('dashboard.complianceEvolution')}</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{t('dashboard.last30Days')}</p></div>
                        <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20"><TrendingUp className="w-5 h-5 text-emerald-500" /></div>
                    </div>
                    <div className="flex-1 w-full p-6 bg-white/40 dark:bg-transparent">
                        {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={historyData}>
                                    <defs>
                                        <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'} opacity={0.5} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                        tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                    />
                                    <YAxis hide domain={[0, 100]} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Area
                                        type="monotone"
                                        dataKey="compliance"
                                        name={t('dashboard.compliance')}
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorCompliance)"
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-panel p-0 rounded-[2rem] overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-shadow">
                    <div className="px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-center backdrop-blur-sm">
                        <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('dashboard.healthCheck')}</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{t('dashboard.systemAlerts')}</p></div>
                        <CustomTooltip content={healthIssues.length > 0 ? t('dashboard.actionsRequired') : t('dashboard.systemHealthy')} position="left">
                            <div className={`p-2 rounded-xl ${healthIssues.length > 0 ? 'bg-orange-500/10' : 'bg-emerald-500/10'}`}>
                                <Stethoscope className={`w-5 h-5 ${healthIssues.length > 0 ? 'text-orange-500' : 'text-emerald-500'}`} />
                            </div>
                        </CustomTooltip>
                    </div>
                    <div className="p-6 flex-1 space-y-3 bg-white/40 dark:bg-transparent">
                        {loading ? <Skeleton className="h-full w-full" /> : healthIssues.length === 0 ? (<div className="flex items-center p-5 bg-emerald-50/80 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30"><CheckCircle2 className="h-6 w-6 text-emerald-500 mr-4 flex-shrink-0" /><div><span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 block">{t('dashboard.noAnomalies')}</span><span className="text-xs text-emerald-600/80 dark:text-emerald-400">{t('dashboard.systemsNominal')}</span></div></div>) : (healthIssues.map(issue => (
                            <CustomTooltip key={issue.id} content={t('dashboard.clickToResolve')} position="top" className="w-full">
                                <div onClick={() => navigate(issue.link)} className={`flex items-start p-4 rounded-2xl border cursor-pointer hover:scale-[1.02] transition-all w-full ${issue.type === 'danger' ? 'bg-red-50/80 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:shadow-md hover:shadow-red-500/5' : 'bg-orange-50/80 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30 hover:shadow-md hover:shadow-orange-500/5'}`}><AlertTriangle className={`h-5 w-5 mr-3 mt-0.5 flex-shrink-0 ${issue.type === 'danger' ? 'text-red-500' : 'text-orange-500'}`} /><div><p className={`text-sm font-bold leading-tight ${issue.type === 'danger' ? 'text-red-800 dark:text-red-200' : 'text-orange-800 dark:text-orange-200'}`}>{issue.message}</p><span className={`text-xs font-bold mt-1 block ${issue.type === 'danger' ? 'text-red-600/70 dark:text-red-400' : 'text-orange-600/70 dark:text-orange-400'}`}>{issue.count} {t('dashboard.itemsAffected')}</span></div></div>
                            </CustomTooltip>
                        )))}
                    </div>
                </div>

                <div className="glass-panel p-0 rounded-[2rem] lg:col-span-2 overflow-hidden shadow-sm group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 backdrop-blur-sm">
                        <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('dashboard.priorityRisks')}</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{t('dashboard.topCriticality')}</p></div>
                        <div className="p-2 bg-red-500/10 rounded-xl"><Flame className="w-5 h-5 text-red-500" /></div>
                    </div>
                    <div className="p-8 space-y-3 bg-white/40 dark:bg-transparent">
                        {loading ? [1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />) : topRisks.slice(0, 3).map(risk => (<div key={risk.id} onClick={() => navigate('/risks')} className="p-4 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 transition-all group flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer"><div className="flex items-center"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-100 dark:border-red-500/20 flex items-center justify-center mr-4 text-red-600 dark:text-red-400 font-black text-lg shadow-inner">{risk.score}</div><div><h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{risk.threat}</h4><p className="text-xs text-slate-500 font-medium mt-1">{risk.vulnerability}</p></div></div><span className="text-[10px] font-bold bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">{risk.strategy}</span></div>))}
                        {topRisks.length === 0 && !loading && <div className="flex flex-col items-center justify-center py-8 text-center"><ShieldAlert className="h-10 w-10 text-slate-300 mb-2" /><p className="text-sm text-slate-500 font-medium">{t('dashboard.noCriticalRisks')}</p></div>}
                    </div>
                </div>
            </div>



            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="glass-panel p-0 rounded-[2rem] overflow-hidden shadow-sm group hover:shadow-md transition-shadow h-full flex flex-col">
                        <div className="flex items-center justify-between px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 backdrop-blur-sm">
                            <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('dashboard.recentActivity')}</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{t('dashboard.realTime')}</p></div>
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-slate-100 dark:bg-white/10 rounded-xl"><History className="w-5 h-5 text-slate-500 dark:text-slate-300" /></div>
                                <button onClick={() => setActivityExpanded(prev => !prev)} className="px-3 py-1.5 bg-white/80 dark:bg-white/10 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-white/20 transition-colors">
                                    {activityExpanded ? t('common.collapse') : t('common.expand')}
                                </button>
                            </div>
                        </div>
                        <div className={`relative ml-4 pr-8 pl-6 ${activityExpanded ? 'max-h-[520px]' : 'max-h-[300px]'} overflow-y-auto custom-scrollbar bg-white/40 dark:bg-transparent flex-1`}>
                            <div className="border-l border-slate-200 dark:border-slate-700/50 space-y-8 py-8">
                                {loading ? <Skeleton className="h-20 w-full" /> : recentActivity.map((log, i) => (<div key={i} className="ml-8 relative group"><span className="absolute -left-[41px] flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm group-hover:scale-110 group-hover:border-blue-400 transition-all z-10">{getActivityIcon(log.resource)}</span><div className="flex justify-between items-start bg-white/50 dark:bg-white/5 p-3 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-colors"><div><p className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.action}</p><p className="text-xs text-slate-500 mt-0.5 truncate max-w-[500px] font-medium leading-relaxed">{log.details}</p></div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide bg-slate-100 dark:bg-black/20 px-2 py-1 rounded-md ml-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div>))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-1 h-full">
                    <CyberNewsWidget />
                </div>
            </div>
        </div >
    );
};
