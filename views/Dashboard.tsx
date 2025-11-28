import React, { useEffect, useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer, Tooltip, AreaChart, Area, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ShieldAlert, CheckCircle2, AlertTriangle, Download, Siren, TrendingUp, Stethoscope, History, Server, Flame, CalendarDays, User, Zap, ArrowRight, Euro, Settings as Settings3D, FileText, ClipboardCheck } from '../components/ui/Icons';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { ChartTooltip } from '../components/ui/ChartTooltip';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, setDoc, limit, getCountFromServer, getDoc, orderBy } from 'firebase/firestore';
import { Risk, Control, Audit, Project, DailyStat, Document, Asset, SystemLog, Supplier, Incident } from '../types';
import { Skeleton } from '../components/ui/Skeleton';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ErrorLogger } from '../services/errorLogger';
import { useFirestoreCollection } from '../hooks/useFirestore';

const StatCard: React.FC<{ title: string; value: string | number | null; icon: any; trend?: string; colorClass: string; delay?: string; onClick?: () => void }> = ({ title, value, icon: Icon, trend, colorClass, delay, onClick }) => (
    <div onClick={onClick} className={`relative group glass - panel p - 6 rounded - [2rem] hover: shadow - apple transition - all duration - 500 hover: -translate - y - 1 overflow - hidden ${delay} border border - white / 60 dark: border - white / 5 cursor - pointer`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none"></div>
        <div className="flex flex-col h-full justify-between relative z-10">
            <div className="flex justify-between items-start mb-6">
                <div className={`p - 3.5 rounded - [1.2rem] ${colorClass} bg - opacity - 10 ring - 1 ring - inset ring - black / 5 dark: ring - white / 10 shadow - sm group - hover: scale - 110 transition - transform duration - 500`}>
                    <Icon className={`h - 6 w - 6 ${colorClass.replace('bg-', 'text-')} `} strokeWidth={2} />
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

    const { user, theme, addToast, demoMode } = useStore();
    const navigate = useNavigate();

    // Hooks
    const { data: controls, loading: controlsLoading } = useFirestoreCollection<Control>('controls', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true });
    const { data: recentActivity, loading: logsLoading } = useFirestoreCollection<SystemLog>('system_logs', [where('organizationId', '==', user?.organizationId || 'ignore'), orderBy('timestamp', 'desc'), limit(10)], { logError: true });
    const { data: historyStats, loading: historyLoading } = useFirestoreCollection<DailyStat>('stats_history', [where('organizationId', '==', user?.organizationId || 'ignore'), limit(60)], { logError: true });
    const { data: allRisks, loading: risksLoading } = useFirestoreCollection<Risk>('risks', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true });
    const { data: allAssets, loading: assetsLoading } = useFirestoreCollection<Asset>('assets', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true });
    const { data: allSuppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>('suppliers', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true });
    const { data: latestIncidents, loading: incidentsLoading } = useFirestoreCollection<Incident>('incidents', [where('organizationId', '==', user?.organizationId || 'ignore'), orderBy('dateReported', 'desc'), limit(5)], { logError: true });
    const { data: myProjects, loading: projectsLoading } = useFirestoreCollection<Project>('projects', [where('organizationId', '==', user?.organizationId || 'ignore'), where('manager', '==', user?.displayName || 'ignore'), where('status', '==', 'En cours')], { logError: true });
    const { data: myAudits, loading: auditsLoading } = useFirestoreCollection<Audit>('audits', [where('organizationId', '==', user?.organizationId || 'ignore'), where('auditor', '==', user?.displayName || 'ignore'), where('status', 'in', ['Planifié', 'En cours'])], { logError: true });
    const { data: myDocs, loading: myDocsLoading } = useFirestoreCollection<Document>('documents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('owner', '==', user?.email || 'ignore')], { logError: true });
    const { data: publishedDocs, loading: publishedDocsLoading } = useFirestoreCollection<Document>('documents', [where('organizationId', '==', user?.organizationId || 'ignore'), where('status', '==', 'Publié')], { logError: true });

    const loading = manualLoading || controlsLoading || logsLoading || historyLoading || risksLoading || assetsLoading || suppliersLoading || incidentsLoading || projectsLoading || auditsLoading || myDocsLoading || publishedDocsLoading;

    // Fetch Counts & Org Name
    useEffect(() => {
        if (demoMode) {
            setOrganizationName('Cyber Threat Consulting (Demo)');
            setTeamSize(12);
            setActiveIncidentsCount(3);
            setOpenAuditsCount(2);
            setManualLoading(false);
            return;
        }

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
                } catch (e) { if (user.organizationName) setOrganizationName(user.organizationName); }

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
            } catch (error: any) {
                ErrorLogger.handleErrorWithToast(error, 'Dashboard.fetchCounts', 'FETCH_FAILED');
                if (error?.code === 'permission-denied') setError('permission-denied');
            } finally {
                setManualLoading(false);
            }
        };
        fetchCounts();
    }, [user?.organizationId, user?.organizationName, demoMode]);

    // Derived Data
    const topRisks = React.useMemo(() => [...allRisks].sort((a, b) => b.score - a.score).slice(0, 5), [allRisks]);

    const historyData = React.useMemo(() => {
        return historyStats
            .filter(d => typeof (d as any).compliance === 'number' && Number.isFinite((d as any).compliance))
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
            return { text: `${activeIncidentsCount} incident(s) de sécurité actif(s).`, type: 'danger' as const, details: "La réponse aux incidents est la priorité absolue.", action: "Gérer", link: "/incidents" };
        } else if (stats.financialRisk > 100000) {
            return { text: "Exposition financière critique détectée.", type: 'danger' as const, details: `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(stats.financialRisk)} d'actifs menacés par des risques élevés.`, action: "Voir Risques", link: "/risks" };
        } else if (allRisks.filter(r => r.score >= 15).length > 0) {
            return { text: "Des risques critiques persistent.", type: 'warning' as const, details: "Vérifiez les plans de traitement pour les risques > 15.", action: "Voir Risques", link: "/risks" };
        } else if (complianceScore < 50 && actionable > 0) {
            return { text: "La conformité ISO 27001 est faible.", type: 'warning' as const, details: "Accélérez l'implémentation des contrôles.", action: "Planifier", link: "/compliance" };
        } else if (expiredDocs > 0) {
            return { text: `${expiredDocs} document(s) à réviser.`, type: 'warning' as const, details: "Des politiques sont obsolètes.", action: "Réviser", link: "/documents" };
        } else if (expiredContracts > 0) {
            return { text: `${expiredContracts} contrat(s) fournisseur expiré(s).`, type: 'warning' as const, details: "Renouvelez ou archivez les contrats.", action: "Fournisseurs", link: "/suppliers" };
        } else if (criticalSuppliersNoScore > 0) {
            return { text: `${criticalSuppliersNoScore} fournisseurs critiques à évaluer.`, type: 'warning' as const, details: "Score de sécurité faible ou manquant.", action: "Évaluer", link: "/suppliers" };
        } else if (overdueAudits > 0) {
            return { text: `${overdueAudits} audit(s) en retard.`, type: 'warning' as const, details: "Le planning n'est pas respecté.", action: "Audits", link: "/audits" };
        }
        return { text: "Système stable. Continuez les revues régulières.", type: 'success' as const, details: "", action: "", link: "" };
    }, [activeIncidentsCount, stats.financialRisk, allRisks, complianceScore, controls, myDocs, myAudits, allSuppliers]);

    const healthIssues = React.useMemo(() => {
        const issues: HealthIssue[] = [];
        const unmitigatedRisks = allRisks.filter(r => r.score >= 15 && !r.mitigationControlIds?.length).length;
        if (unmitigatedRisks > 0) issues.push({ id: '1', type: 'danger', message: 'Risques critiques sans contrôle', count: unmitigatedRisks, link: '/risks' });
        const unprovenControls = controls.filter(c => c.status === 'Implémenté' && (!c.evidenceIds || c.evidenceIds.length === 0)).length;
        if (unprovenControls > 0) issues.push({ id: '2', type: 'warning', message: 'Contrôles sans preuve', count: unprovenControls, link: '/compliance' });

        const overdueAudits = myAudits.filter(a => new Date(a.dateScheduled) < new Date() && a.status !== 'Terminé' && a.status !== 'Validé').length;
        if (overdueAudits > 0) issues.push({ id: '6', type: 'warning', message: 'Audits en retard', count: overdueAudits, link: '/audits' });
        return issues;
    }, [allRisks, controls, myAudits]);

    const myActionItems = React.useMemo(() => {
        if (!user) return [];
        const myItems: ActionItem[] = [];
        myAudits.forEach(a => {
            myItems.push({ id: a.id, type: 'audit', title: a.name, date: a.dateScheduled, status: a.status, link: '/audits' });
        });
        const next30Days = new Date(); next30Days.setDate(next30Days.getDate() + 30);
        myDocs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < next30Days).forEach(d => {
            myItems.push({ id: d.id, type: 'document', title: d.title, date: d.nextReviewDate!, status: 'Révision', link: '/documents' });
        });
        publishedDocs.filter(d => !d.readBy?.includes(user.uid)).forEach(d => {
            myItems.push({ id: d.id, type: 'policy', title: d.title, date: new Date().toISOString(), status: 'À lire', link: '/documents' });
        });
        myProjects.forEach(p => {
            myItems.push({ id: p.id, type: 'project', title: p.name, date: p.dueDate, status: `${p.progress}%`, link: '/projects' });
        });
        myItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return myItems;
    }, [user, myAudits, myDocs, publishedDocs, myProjects]);

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
                } catch (_e) { /* Silent fail */ }
            };
            saveStats();
        }
    }, [loading, historyStats, user?.organizationId, allRisks.length, complianceScore, activeIncidentsCount]);

    const copyRules = () => { navigator.clipboard.writeText(`rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}`); addToast("Règles copiées !", "success"); };
    const getActivityIcon = (resource: string) => { switch (resource) { case 'Risk': return <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />; case 'Incident': return <Siren className="h-3.5 w-3.5 text-red-500" />; case 'Asset': return <Server className="h-3.5 w-3.5 text-blue-500" />; default: return <CheckCircle2 className="h-3.5 w-3.5 text-gray-500" />; } };

    const generateICal = async () => {
        if (!user?.organizationId) return;
        try {
            const [auditsSnap, projectsSnap] = await Promise.all([
                getDocs(query(collection(db, 'audits'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'projects'), where('organizationId', '==', user.organizationId)))
            ]);
            let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Sentinel GRC//FR\n";
            auditsSnap.forEach(doc => { const d = doc.data(); const date = d.dateScheduled ? d.dateScheduled.replace(/-/g, '') : ''; if (date) icsContent += `BEGIN:VEVENT\nSUMMARY:Audit: ${d.name}\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nDESCRIPTION:Auditeur: ${d.auditor}\nEND:VEVENT\n`; });
            projectsSnap.forEach(doc => { const d = doc.data(); const date = d.dueDate ? d.dueDate.replace(/-/g, '') : ''; if (date) icsContent += `BEGIN:VEVENT\nSUMMARY:Projet: ${d.name}\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nDESCRIPTION:Manager: ${d.manager}\nEND:VEVENT\n`; });
            icsContent += "END:VCALENDAR";
            const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })); link.download = 'sentinel_calendar.ics'; link.click(); addToast("Calendrier exporté (.ics)", "success");
        } catch (error) { ErrorLogger.handleErrorWithToast(error, 'Dashboard.generateICal', 'UNKNOWN_ERROR'); }
    };

    const generateExecutiveReport = () => {
        const doc = new jsPDF(); const date = new Date().toLocaleDateString();
        doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F'); doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.text("Rapport Exécutif de Sécurité", 14, 20); doc.setFontSize(12); doc.setTextColor(148, 163, 184); doc.text(`Généré le ${date} | Sentinel GRC by Cyber Threat Consulting`, 14, 30);
        let y = 55; doc.setFontSize(16); doc.setTextColor(15, 23, 42); doc.text("Synthèse & Indicateurs Clés", 14, y); y += 10;
        const kpiData = [['Note Globale', scoreGrade], ['Niveau de Conformité ISO 27001', `${stats.compliance}%`], ['Risques Critiques Identifiés', stats.highRisks.toString()], ['Incidents de Sécurité Actifs', stats.activeIncidents.toString()], ['Audits en cours', stats.auditsOpen.toString()], ['Actifs Recensés', stats.assets.toString()], ['Valorisation du Parc', `${stats.assetValue} €`]];
        doc.autoTable({ startY: y, head: [['Indicateur', 'Valeur']], body: kpiData, theme: 'striped', headStyles: { fillColor: [59, 130, 246] }, styles: { fontSize: 11, cellPadding: 4 }, columnStyles: { 0: { fontStyle: 'bold' } } }); y = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(16); doc.text("Top 5 Risques Critiques", 14, y); y += 10;
        const riskRows = topRisks.map(r => [r.threat, r.score.toString(), r.strategy, r.status]);
        doc.autoTable({ startY: y, head: [['Menace', 'Score', 'Stratégie', 'Statut']], body: riskRows, theme: 'striped', headStyles: { fillColor: [239, 68, 68] }, styles: { fontSize: 10 }, }); y = doc.lastAutoTable.finalY + 20;
        if (latestIncidents.length > 0) { doc.setFontSize(16); doc.text("Derniers Incidents de Sécurité", 14, y); y += 10; const incRows = latestIncidents.map(i => [new Date(i.dateReported).toLocaleDateString(), i.title, i.severity, i.status]); doc.autoTable({ startY: y, head: [['Date', 'Titre', 'Sévérité', 'Statut']], body: incRows, theme: 'striped', headStyles: { fillColor: [249, 115, 22] }, styles: { fontSize: 10 }, }); }

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text('Rapport généré par Sentinel GRC (Cyber Threat Consulting)', 14, 285);
            doc.text(`Page ${i} / ${pageCount}`, 190, 285, { align: 'right' });
        }

        doc.save(`Executive_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    if (error === 'permission-denied') { return (<div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in p-6"> <div className="glass-panel rounded-[2rem] p-8 max-w-2xl w-full relative overflow-hidden border-l-4 border-l-red-500 shadow-xl"> <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Accès Refusé</h2> <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">La base de données est verrouillée. Veuillez configurer les règles de sécurité.</p> <button onClick={copyRules} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm">Copier les Règles</button> </div> </div>); }

    return (
        <div className="space-y-8 animate-fade-in pb-10">

            <div className="relative overflow-hidden rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-200/60 dark:ring-white/5 transition-all duration-500 group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5 dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-purple-500/10 opacity-100"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>

                <div className="relative z-10 p-6 md:p-8">
                    {isEmpty && !loading ? (
                        /* État vide élégant */
                        <div className="flex flex-col items-center justify-center text-center py-8">
                            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md shadow-sm">
                                <span className="w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full mr-2.5 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                                {organizationName || user?.organizationName || 'Système Opérationnel'}
                            </div>

                            <h2 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight font-display mb-6">
                                Bienvenue sur Sentinel GRC
                            </h2>
                            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mb-10 leading-relaxed font-medium">
                                La plateforme tout-en-un pour piloter votre conformité ISO 27001.<br />
                                Commencez par initialiser votre référentiel de sécurité.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full mx-auto">
                                <button
                                    onClick={() => navigate('/assets')}
                                    className="group relative p-8 bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 rounded-3xl hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl"></div>
                                    <div className="flex flex-col items-center gap-4 relative z-10">
                                        <div className="p-4 bg-blue-50 dark:bg-blue-500/20 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                                            <Server className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Créer un actif</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Recensez vos ressources critiques</p>
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
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Configurer les contrôles</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Définissez votre périmètre ISO</p>
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
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Ajouter des documents</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Centralisez vos politiques</p>
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
                                    <div className={`flex items-center justify-center w-16 h-16 shrink-0 rounded-2xl text-4xl font-black shadow-xl border-4 ${scoreGrade === 'A' ? 'bg-emerald-500 border-emerald-400/50 text-white shadow-emerald-500/20' : scoreGrade === 'B' ? 'bg-blue-500 border-blue-400/50 text-white shadow-blue-500/20' : scoreGrade === 'C' ? 'bg-orange-500 border-orange-400/50 text-white shadow-orange-500/20' : 'bg-red-500 border-red-400/50 text-white shadow-red-500/20'}`}>
                                        {scoreGrade}
                                    </div>
                                    <div>
                                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-display">Sentinel GRC</h1>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-widest">
                                                {organizationName || user?.organizationName || 'Système Opérationnel'}
                                            </span>
                                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                                                <strong className="text-slate-900 dark:text-white">{loading ? '...' : stats.compliance}%</strong> Conformité
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
                                            Équipe : {teamSize <= 1 ? "vous êtes seul pour le moment" : `${teamSize} membres`}
                                        </span>
                                        {teamSize <= 1 && (
                                            <button
                                                onClick={() => navigate('/team')}
                                                className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold shadow-sm hover:scale-105 transition-all"
                                            >
                                                Inviter mon équipe
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
                                        <CalendarDays className="h-3.5 w-3.5 mr-2" /> Export iCal
                                    </button>
                                    <button
                                        onClick={generateExecutiveReport}
                                        className="group flex items-center px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-none"
                                    >
                                        <Download className="h-3.5 w-3.5 mr-2" /> Rapport Exécutif
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
                                            name="Maturité"
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
                                <div className="absolute bottom-0 w-full text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">Maturité ISO 27001</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
                <button onClick={() => navigate('/voxel')} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.02] hover:shadow-lg transition-all group shadow-sm hover:border-purple-300 dark:hover:border-purple-500/50">
                    <div className="p-3 bg-purple-50 dark:bg-purple-500/20 rounded-xl group-hover:scale-110 transition-transform">
                        <Settings3D className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Voxel 3D</span>
                </button>
                <button onClick={() => navigate('/incidents')} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.02] hover:shadow-lg transition-all group shadow-sm hover:border-red-300 dark:hover:border-red-500/50">
                    <div className="p-3 bg-red-50 dark:bg-red-500/20 rounded-xl group-hover:scale-110 transition-transform">
                        <Siren className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Incidents</span>
                </button>
                <button onClick={() => navigate('/risks')} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.02] hover:shadow-lg transition-all group shadow-sm hover:border-orange-300 dark:hover:border-orange-500/50">
                    <div className="p-3 bg-orange-50 dark:bg-orange-500/20 rounded-xl group-hover:scale-110 transition-transform">
                        <ShieldAlert className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Risques</span>
                </button>
                <button onClick={() => navigate('/assets')} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.02] hover:shadow-lg transition-all group shadow-sm hover:border-blue-300 dark:hover:border-blue-500/50">
                    <div className="p-3 bg-blue-50 dark:bg-blue-500/20 rounded-xl group-hover:scale-110 transition-transform">
                        <Server className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Actifs</span>
                </button>
                <button onClick={() => navigate('/team')} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:scale-[1.02] hover:shadow-lg transition-all group shadow-sm hover:border-emerald-300 dark:hover:border-emerald-500/50">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/20 rounded-xl group-hover:scale-110 transition-transform">
                        <User className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Équipe</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Incidents Actifs" value={loading ? null : stats.activeIncidents} icon={Siren} colorClass="bg-red-500 text-red-500" trend={stats.activeIncidents > 0 ? "Urgent" : undefined} delay="delay-0" onClick={() => navigate('/incidents')} />
                <StatCard title="Risques Critiques" value={loading ? null : stats.highRisks} icon={ShieldAlert} colorClass="bg-orange-500 text-orange-500" delay="delay-75" onClick={() => navigate('/risks')} />
                <StatCard title="Exposition Financière" value={loading ? null : `${new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(stats.financialRisk)}`} icon={TrendingUp} colorClass="bg-red-600 text-red-600" trend={stats.financialRisk > 100000 ? "Critique" : undefined} delay="delay-100" onClick={() => navigate('/risks')} />
                <StatCard title="Valeur du Parc" value={loading ? null : `${new Intl.NumberFormat('fr-FR', { notation: "compact", compactDisplay: "short", style: 'currency', currency: 'EUR' }).format(stats.assetValue)}`} icon={Euro} colorClass="bg-blue-500 text-blue-500" delay="delay-150" onClick={() => navigate('/assets')} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* My Workspace */}
                <div className="glass-panel p-0 rounded-[2rem] overflow-hidden border border-white/60 dark:border-white/5 shadow-sm flex flex-col h-[450px] group hover:shadow-md transition-shadow">
                    <div className="px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-center backdrop-blur-sm">
                        <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Mon Espace</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">À faire cette semaine</p></div>
                        <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm"><User className="w-5 h-5 text-slate-600 dark:text-slate-300" /></div>
                    </div>
                    <div className="flex-1 p-0 overflow-y-auto custom-scrollbar bg-white/40 dark:bg-slate-900/20">
                        {loading ? <Skeleton className="h-full w-full m-4" /> : myActionItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center"><CheckCircle2 className="h-12 w-12 text-emerald-500/30 mb-4" /><p className="text-sm font-bold text-slate-500">Rien à signaler pour le moment.</p></div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {myActionItems.map(item => (
                                    <div key={item.id} onClick={() => navigate(item.link)} className="p-5 hover:bg-white dark:hover:bg-white/5 cursor-pointer group/item transition-all flex items-center gap-4">
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.type === 'audit' ? 'bg-blue-500' : item.type === 'policy' ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${item.type === 'audit' ? 'bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-900/20 dark:border-blue-900/30 dark:text-blue-400' : item.type === 'policy' ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400' : 'bg-orange-50 border-orange-100 text-orange-600 dark:bg-orange-900/20 dark:border-orange-900/30 dark:text-orange-400'}`}>
                                                    {item.type === 'audit' ? 'Audit' : item.type === 'policy' ? 'Signature' : item.type === 'document' ? 'Revue' : 'Projet'}
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

                <div className="glass-panel p-0 rounded-[2rem] lg:col-span-2 flex flex-col overflow-hidden border border-white/60 dark:border-white/5 shadow-sm h-[450px] group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 backdrop-blur-sm">
                        <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Évolution Conformité</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">30 derniers jours</p></div>
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
                                        name="Conformité"
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
                <div className="glass-panel p-0 rounded-[2rem] overflow-hidden border border-white/60 dark:border-white/5 shadow-sm flex flex-col group hover:shadow-md transition-shadow">
                    <div className="px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-center backdrop-blur-sm">
                        <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Diagnostic Santé</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">Alertes Système</p></div>
                        <CustomTooltip content={healthIssues.length > 0 ? "Des actions sont requises" : "Système sain"} position="left">
                            <div className={`p-2 rounded-xl ${healthIssues.length > 0 ? 'bg-orange-500/10' : 'bg-emerald-500/10'}`}>
                                <Stethoscope className={`w-5 h-5 ${healthIssues.length > 0 ? 'text-orange-500' : 'text-emerald-500'}`} />
                            </div>
                        </CustomTooltip>
                    </div>
                    <div className="p-6 flex-1 space-y-3 bg-white/40 dark:bg-transparent">
                        {loading ? <Skeleton className="h-full w-full" /> : healthIssues.length === 0 ? (<div className="flex items-center p-5 bg-emerald-50/80 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30"><CheckCircle2 className="h-6 w-6 text-emerald-500 mr-4 flex-shrink-0" /><div><span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 block">Aucune anomalie</span><span className="text-xs text-emerald-600/80 dark:text-emerald-400">Tous les systèmes sont nominaux</span></div></div>) : (healthIssues.map(issue => (
                            <CustomTooltip key={issue.id} content="Cliquez pour résoudre" position="top" className="w-full">
                                <div onClick={() => navigate(issue.link)} className={`flex items-start p-4 rounded-2xl border cursor-pointer hover:scale-[1.02] transition-all w-full ${issue.type === 'danger' ? 'bg-red-50/80 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:shadow-md hover:shadow-red-500/5' : 'bg-orange-50/80 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30 hover:shadow-md hover:shadow-orange-500/5'}`}><AlertTriangle className={`h-5 w-5 mr-3 mt-0.5 flex-shrink-0 ${issue.type === 'danger' ? 'text-red-500' : 'text-orange-500'}`} /><div><p className={`text-sm font-bold leading-tight ${issue.type === 'danger' ? 'text-red-800 dark:text-red-200' : 'text-orange-800 dark:text-orange-200'}`}>{issue.message}</p><span className={`text-xs font-bold mt-1 block ${issue.type === 'danger' ? 'text-red-600/70 dark:text-red-400' : 'text-orange-600/70 dark:text-orange-400'}`}>{issue.count} éléments concernés</span></div></div>
                            </CustomTooltip>
                        )))}
                    </div>
                </div>

                <div className="glass-panel p-0 rounded-[2rem] lg:col-span-2 overflow-hidden border border-white/60 dark:border-white/5 shadow-sm group hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 backdrop-blur-sm">
                        <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Risques Prioritaires</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">Top Criticité</p></div>
                        <div className="p-2 bg-red-500/10 rounded-xl"><Flame className="w-5 h-5 text-red-500" /></div>
                    </div>
                    <div className="p-8 space-y-3 bg-white/40 dark:bg-transparent">
                        {loading ? [1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />) : topRisks.slice(0, 3).map(risk => (<div key={risk.id} onClick={() => navigate('/risks')} className="p-4 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 transition-all group flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer"><div className="flex items-center"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-100 dark:border-red-500/20 flex items-center justify-center mr-4 text-red-600 dark:text-red-400 font-black text-lg shadow-inner">{risk.score}</div><div><h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{risk.threat}</h4><p className="text-xs text-slate-500 font-medium mt-1">{risk.vulnerability}</p></div></div><span className="text-[10px] font-bold bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">{risk.strategy}</span></div>))}
                        {topRisks.length === 0 && !loading && <div className="flex flex-col items-center justify-center py-8 text-center"><ShieldAlert className="h-10 w-10 text-slate-300 mb-2" /><p className="text-sm text-slate-500 font-medium">Aucun risque critique identifié.</p></div>}
                    </div>
                </div>
            </div>

            <div className="glass-panel p-0 rounded-[2rem] overflow-hidden border border-white/60 dark:border-white/5 shadow-sm group hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 backdrop-blur-sm">
                    <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Flux d'activité récent</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">Temps Réel</p></div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-100 dark:bg-white/10 rounded-xl"><History className="w-5 h-5 text-slate-500 dark:text-slate-300" /></div>
                        <button onClick={() => setActivityExpanded(prev => !prev)} className="px-3 py-1.5 bg-white/80 dark:bg-white/10 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-white/20 transition-colors">
                            {activityExpanded ? 'Réduire' : 'Agrandir'}
                        </button>
                    </div>
                </div>
                <div className={`relative ml-4 pr-8 pl-6 ${activityExpanded ? 'max-h-[520px]' : 'max-h-[300px]'} overflow-y-auto custom-scrollbar bg-white/40 dark:bg-transparent`}>
                    <div className="border-l border-slate-200 dark:border-slate-700/50 space-y-8 py-8">
                        {loading ? <Skeleton className="h-20 w-full" /> : recentActivity.map((log, i) => (<div key={i} className="ml-8 relative group"><span className="absolute -left-[41px] flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm group-hover:scale-110 group-hover:border-blue-400 transition-all z-10">{getActivityIcon(log.resource)}</span><div className="flex justify-between items-start bg-white/50 dark:bg-white/5 p-3 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-colors"><div><p className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.action}</p><p className="text-xs text-slate-500 mt-0.5 truncate max-w-[500px] font-medium leading-relaxed">{log.details}</p></div><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide bg-slate-100 dark:bg-black/20 px-2 py-1 rounded-md ml-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div>))}
                    </div>
                </div>
            </div>
        </div>
    );
};
