import React, { useEffect, useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer, Tooltip, AreaChart, Area, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ShieldAlert, CheckCircle2, AlertTriangle, Download, Siren, TrendingUp, Stethoscope, History, Server, Flame, CalendarDays, User, Zap, ArrowRight, Euro, Settings as Settings3D, Sparkles, FileText, ClipboardCheck } from '../components/ui/Icons';
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
import { PageHeader } from '../components/ui/PageHeader';
import { LayoutDashboard } from '../components/ui/Icons';

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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState({ risks: 0, assets: 0, compliance: 0, highRisks: 0, auditsOpen: 0, activeIncidents: 0, assetValue: 0, financialRisk: 0 });
    const [recentActivity, setRecentActivity] = useState<SystemLog[]>([]);
    const [historyData, setHistoryData] = useState<DailyStat[]>([]);
    const [healthIssues, setHealthIssues] = useState<HealthIssue[]>([]);
    const [topRisks, setTopRisks] = useState<Risk[]>([]);
    const [radarData, setRadarData] = useState<{ subject: string; A: number; fullMark: number }[]>([]);
    const [latestIncidents, setLatestIncidents] = useState<Incident[]>([]);
    const [myActionItems, setMyActionItems] = useState<ActionItem[]>([]);
    const [insight, setInsight] = useState<{ text: string, type: 'success' | 'warning' | 'danger', details?: string, action?: string, link?: string }>({ text: "Analyse en cours...", type: 'success' });
    const [scoreGrade, setScoreGrade] = useState('?');
    const [organizationName, setOrganizationName] = useState<string>('');
    const [isEmpty, setIsEmpty] = useState(false);

    const { user, theme, addToast } = useStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const orgId = user.organizationId!;

                // Récupérer le nom de l'organisation depuis la collection organizations
                try {
                    const orgDocRef = doc(db, 'organizations', orgId);
                    const orgSnap = await getDoc(orgDocRef);
                    if (orgSnap.exists()) {
                        const orgData = orgSnap.data();
                        setOrganizationName(orgData.name || '');
                    }
                } catch (orgError) {
                    console.error('Erreur lors de la récupération du nom de l\'organisation:', orgError);
                    // Fallback sur user.organizationName si disponible
                    if (user.organizationName) {
                        setOrganizationName(user.organizationName);
                    }
                }

                const fetches = [
                    getDocs(query(collection(db, 'controls'), where('organizationId', '==', orgId))),
                    getDocs(query(collection(db, 'system_logs'), where('organizationId', '==', orgId), orderBy('timestamp', 'desc'), limit(10))),
                    getDocs(query(collection(db, 'stats_history'), where('organizationId', '==', orgId), limit(60))),
                    getDocs(query(collection(db, 'risks'), where('organizationId', '==', orgId))),
                    getDocs(query(collection(db, 'assets'), where('organizationId', '==', orgId))),
                    getDocs(query(collection(db, 'suppliers'), where('organizationId', '==', orgId))),
                    getCountFromServer(query(collection(db, 'users'), where('organizationId', '==', orgId))),
                    // Optimized Incidents
                    getDocs(query(collection(db, 'incidents'), where('organizationId', '==', orgId), orderBy('dateReported', 'desc'), limit(5))),
                    getCountFromServer(query(collection(db, 'incidents'), where('organizationId', '==', orgId), where('status', '!=', 'Fermé'))),
                    // Optimized Audits
                    getDocs(query(collection(db, 'audits'), where('organizationId', '==', orgId), where('auditor', '==', user.displayName), where('status', 'in', ['Planifié', 'En cours']))),
                    getCountFromServer(query(collection(db, 'audits'), where('organizationId', '==', orgId), where('status', 'in', ['Planifié', 'En cours']))),
                    // Optimized Projects
                    getDocs(query(collection(db, 'projects'), where('organizationId', '==', orgId), where('manager', '==', user.displayName), where('status', '==', 'En cours'))),
                    // Optimized Documents
                    getDocs(query(collection(db, 'documents'), where('organizationId', '==', orgId), where('owner', '==', user.email))),
                    getDocs(query(collection(db, 'documents'), where('organizationId', '==', orgId), where('status', '==', 'Publié'))) // For "To Read"
                ];

                const results = await Promise.allSettled(fetches);

                const rejected = results.find(r => r.status === 'rejected');
                if (rejected && (rejected as PromiseRejectedResult).reason?.code === 'permission-denied') {
                    setError('permission-denied');
                    setLoading(false);
                    return;
                }

                const getRawData = <T,>(result: PromiseSettledResult<any>): T[] => {
                    if (result.status === 'fulfilled' && result.value.docs) {
                        return result.value.docs.map((d: any) => ({ id: d.id, ...d.data() })) as T[];
                    }
                    return [];
                }

                const getCount = (result: PromiseSettledResult<any>): number => {
                    if (result.status === 'fulfilled') return result.value.data().count;
                    return 0;
                }

                const controls = getRawData<Control>(results[0]);
                const allLogs = getRawData<SystemLog>(results[1]);
                const historyStats = getRawData<DailyStat>(results[2]);
                const allRisks = getRawData<Risk>(results[3]);
                const allAssets = getRawData<Asset>(results[4]);
                const allSuppliers = getRawData<Supplier>(results[5]);
                const userCount = getCount(results[6]);

                const latestIncidents = getRawData<Incident>(results[7]);
                const activeIncidentsCount = getCount(results[8]);

                const myAudits = getRawData<Audit>(results[9]);
                const openAuditsCount = getCount(results[10]);

                const myProjects = getRawData<Project>(results[11]);
                const myDocs = getRawData<Document>(results[12]);
                const publishedDocs = getRawData<Document>(results[13]);

                setLatestIncidents(latestIncidents);
                setRecentActivity(allLogs);

                allRisks.sort((a, b) => b.score - a.score);
                setTopRisks(allRisks.slice(0, 5));

                const implemented = controls.filter(c => c.status === 'Implémenté').length;
                const actionable = controls.filter(c => c.status !== 'Exclu' && c.status !== 'Non applicable').length;
                const complianceScore = actionable > 0 ? Math.round((implemented / actionable) * 100) : 0;

                const domains = { 'Org.': { total: 0, implemented: 0, prefix: 'A.5' }, 'Humain': { total: 0, implemented: 0, prefix: 'A.6' }, 'Physique': { total: 0, implemented: 0, prefix: 'A.7' }, 'Techno': { total: 0, implemented: 0, prefix: 'A.8' } };
                controls.forEach(c => {
                    if (c.status === 'Exclu' || c.status === 'Non applicable') return;
                    const key = Object.keys(domains).find(k => c.code.startsWith(domains[k as keyof typeof domains].prefix));
                    if (key) { domains[key as keyof typeof domains].total++; if (c.status === 'Implémenté') domains[key as keyof typeof domains].implemented++; }
                });
                setRadarData(Object.entries(domains).map(([subject, data]) => ({ subject, A: data.total > 0 ? Math.round((data.implemented / data.total) * 100) : 0, fullMark: 100 })));

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

                setStats({
                    risks: allRisks.length,
                    assets: allAssets.length,
                    compliance: complianceScore,
                    highRisks: allRisks.filter(r => r.score >= 15).length,
                    auditsOpen: openAuditsCount,
                    activeIncidents: activeIncidentsCount,
                    assetValue: totalAssetValue,
                    financialRisk: financialExposure
                });

                // Détecter si le système est vide (aucune donnée significative)
                const hasData = allRisks.length > 0 || allAssets.length > 0 || myProjects.length > 0;
                setIsEmpty(!hasData);

                let grade = 'A';
                if (activeIncidentsCount > 0) grade = 'D';
                else if (complianceScore < 50 || allRisks.filter(r => r.score >= 20).length > 0) grade = 'C';
                else if (complianceScore < 80 || allRisks.filter(r => r.score >= 15).length > 0) grade = 'B';
                setScoreGrade(grade);

                let newInsight = { text: "Système stable. Continuez les revues régulières.", type: 'success' as any, details: "", action: "", link: "" };

                const expiredDocs = myDocs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < new Date()).length; // Approximation using myDocs
                const overdueAudits = myAudits.filter(a => new Date(a.dateScheduled) < new Date() && a.status !== 'Terminé' && a.status !== 'Validé').length; // Approximation using myAudits
                const criticalSuppliersNoScore = allSuppliers.filter(s => (s.criticality === 'Critique' || s.criticality === 'Élevée') && (!s.securityScore || s.securityScore < 50)).length;
                const expiredContracts = allSuppliers.filter(s => s.contractEnd && new Date(s.contractEnd) < new Date()).length;

                if (activeIncidentsCount > 0) {
                    newInsight = { text: `${activeIncidentsCount} incident(s) de sécurité actif(s).`, type: 'danger', details: "La réponse aux incidents est la priorité absolue.", action: "Gérer", link: "/incidents" };
                } else if (financialExposure > 100000) {
                    newInsight = { text: "Exposition financière critique détectée.", type: 'danger', details: `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(financialExposure)} d'actifs menacés par des risques élevés.`, action: "Voir Risques", link: "/risks" };
                } else if (userCount === 1) {
                    newInsight = { text: "Vous êtes seul dans l'organisation.", type: 'warning', details: "Invitez votre équipe pour collaborer sur la conformité.", action: "Inviter", link: "/team" };
                } else if (allRisks.filter(r => r.score >= 15).length > 0) {
                    newInsight = { text: "Des risques critiques persistent.", type: 'warning', details: "Vérifiez les plans de traitement pour les risques > 15.", action: "Voir Risques", link: "/risks" };
                } else if (complianceScore < 50 && actionable > 0) {
                    newInsight = { text: "La conformité ISO 27001 est faible.", type: 'warning', details: "Accélérez l'implémentation des contrôles.", action: "Planifier", link: "/compliance" };
                } else if (expiredDocs > 0) {
                    newInsight = { text: `${expiredDocs} document(s) à réviser.`, type: 'warning', details: "Des politiques sont obsolètes.", action: "Réviser", link: "/documents" };
                } else if (expiredContracts > 0) {
                    newInsight = { text: `${expiredContracts} contrat(s) fournisseur expiré(s).`, type: 'warning', details: "Renouvelez ou archivez les contrats.", action: "Fournisseurs", link: "/suppliers" };
                } else if (criticalSuppliersNoScore > 0) {
                    newInsight = { text: `${criticalSuppliersNoScore} fournisseurs critiques à évaluer.`, type: 'warning', details: "Score de sécurité faible ou manquant.", action: "Évaluer", link: "/suppliers" };
                } else if (overdueAudits > 0) {
                    newInsight = { text: `${overdueAudits} audit(s) en retard.`, type: 'warning', details: "Le planning n'est pas respecté.", action: "Audits", link: "/audits" };
                }
                setInsight(newInsight);

                const todayStr = new Date().toISOString().split('T')[0];
                if (!historyStats.some(d => d.date === todayStr) && !loading) {
                    try {
                        const statId = `${todayStr}_${orgId}`;
                        await setDoc(doc(db, 'stats_history', statId), {
                            organizationId: orgId, date: todayStr, risks: allRisks.length,
                            compliance: complianceScore, incidents: activeIncidentsCount, timestamp: new Date().toISOString()
                        });
                    } catch (_e) { /* Silent fail */ }
                }
                setHistoryData(historyStats.sort((a, b) => a.date.localeCompare(b.date)));

                // allLogs already sorted and limited by query
                // setRecentActivity(allLogs); // Already set above

                const issues: HealthIssue[] = [];
                const unmitigatedRisks = allRisks.filter(r => r.score >= 15 && !r.mitigationControlIds?.length).length;
                if (unmitigatedRisks > 0) issues.push({ id: '1', type: 'danger', message: 'Risques critiques sans contrôle', count: unmitigatedRisks, link: '/risks' });
                const unprovenControls = controls.filter(c => c.status === 'Implémenté' && (!c.evidenceIds || c.evidenceIds.length === 0)).length;
                if (unprovenControls > 0) issues.push({ id: '2', type: 'warning', message: 'Contrôles sans preuve', count: unprovenControls, link: '/compliance' });

                const twoDaysAgo = new Date(); twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
                // Note: Stale incidents check removed for performance or needs specific query. 
                // Using latestIncidents as proxy or skipping.
                // const staleIncidents = allIncidents.filter(i => (i.severity === 'Critique' || i.severity === 'Élevée') && i.status !== 'Fermé' && new Date(i.dateReported) < twoDaysAgo).length;
                // if (staleIncidents > 0) issues.push({ id: '5', type: 'danger', message: 'SLA Incident dépassé (>48h)', count: staleIncidents, link: '/incidents' });

                if (overdueAudits > 0) issues.push({ id: '6', type: 'warning', message: 'Audits en retard', count: overdueAudits, link: '/audits' });

                setHealthIssues(issues);

                if (user) {
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
                    setMyActionItems(myItems);
                }
                setError(null);
            } catch (error: any) {
                console.error(error);
                setError("Erreur chargement données.");
            } finally { setLoading(false); }
        };
        fetchData();
    }, [user?.organizationId]);

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
        } catch (_e) { addToast("Erreur export calendrier", "error"); }
    };

    const generateExecutiveReport = () => {
        const doc = new jsPDF(); const date = new Date().toLocaleDateString();
        doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F'); doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.text("Rapport Exécutif de Sécurité", 14, 20); doc.setFontSize(12); doc.setTextColor(148, 163, 184); doc.text(`Généré le ${date} | Sentinel GRC by Cyber Threat Consulting`, 14, 30);
        let y = 55; doc.setFontSize(16); doc.setTextColor(15, 23, 42); doc.text("Synthèse & Indicateurs Clés", 14, y); y += 10;
        const kpiData = [['Note Globale', scoreGrade], ['Niveau de Conformité ISO 27001', `${stats.compliance}%`], ['Risques Critiques Identifiés', stats.highRisks.toString()], ['Incidents de Sécurité Actifs', stats.activeIncidents.toString()], ['Audits en cours', stats.auditsOpen.toString()], ['Actifs Recensés', stats.assets.toString()], ['Valorisation du Parc', `${stats.assetValue} €`]];
        (doc as any).autoTable({ startY: y, head: [['Indicateur', 'Valeur']], body: kpiData, theme: 'striped', headStyles: { fillColor: [59, 130, 246] }, styles: { fontSize: 11, cellPadding: 4 }, columnStyles: { 0: { fontStyle: 'bold' } } }); y = (doc as any).lastAutoTable.finalY + 20;
        doc.setFontSize(16); doc.text("Top 5 Risques Critiques", 14, y); y += 10;
        const riskRows = topRisks.map(r => [r.threat, r.score.toString(), r.strategy, r.status]);
        (doc as any).autoTable({ startY: y, head: [['Menace', 'Score', 'Stratégie', 'Statut']], body: riskRows, theme: 'striped', headStyles: { fillColor: [239, 68, 68] }, styles: { fontSize: 10 }, }); y = (doc as any).lastAutoTable.finalY + 20;
        if (latestIncidents.length > 0) { doc.setFontSize(16); doc.text("Derniers Incidents de Sécurité", 14, y); y += 10; const incRows = latestIncidents.map(i => [new Date(i.dateReported).toLocaleDateString(), i.title, i.severity, i.status]); (doc as any).autoTable({ startY: y, head: [['Date', 'Titre', 'Sévérité', 'Statut']], body: incRows, theme: 'striped', headStyles: { fillColor: [249, 115, 22] }, styles: { fontSize: 10 }, }); }

        const pageCount = (doc as any).internal.getNumberOfPages();
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
            <PageHeader
                title="Tableau de bord"
                subtitle="Vue d'ensemble de la posture de sécurité."
                breadcrumbs={[
                    { label: 'Dashboard' }
                ]}
                icon={<LayoutDashboard className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={
                    <div className="flex gap-3">
                        <button
                            onClick={generateICal}
                            className="group flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-white text-sm font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            <CalendarDays className="h-4 w-4 mr-2" /> Export iCal
                        </button>
                        <button
                            onClick={generateExecutiveReport}
                            className="group flex items-center px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-none"
                        >
                            <Download className="h-4 w-4 mr-2" /> Rapport Exécutif
                        </button>
                    </div>
                }
            />

            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 shadow-2xl ring-1 ring-slate-200/50 dark:ring-white/5 transition-all hover:shadow-3xl duration-500 group">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay"></div>
                <div className="relative z-10 p-10 md:p-12">
                    {isEmpty && !loading ? (
                        /* État vide élégant */
                        <div className="flex flex-col items-center justify-center text-center py-12">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-3xl shadow-2xl">
                                    <Sparkles className="h-12 w-12 text-white" strokeWidth={2} />
                                </div>
                            </div>

                            <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-widest mb-4 backdrop-blur-md shadow-sm">
                                <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full mr-2 animate-pulse"></span>
                                {organizationName || user?.organizationName || 'Système Opérationnel'}
                            </div>

                            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tighter font-display mb-4">
                                Bienvenue sur Sentinel GRC
                            </h2>
                            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mb-8 leading-relaxed">
                                Commencez votre parcours vers la conformité ISO 27001 en créant vos premiers éléments.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full mt-4">
                                <button
                                    onClick={() => navigate('/assets')}
                                    className="group p-6 bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-white/80 dark:hover:bg-white/10 transition-all hover:scale-105 hover:shadow-xl"
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-3 bg-blue-500/10 rounded-xl">
                                            <Server className="h-6 w-6 text-blue-500" />
                                        </div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">Créer un actif</h3>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">Recensez vos ressources critiques</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => navigate('/compliance')}
                                    className="group p-6 bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-white/80 dark:hover:bg-white/10 transition-all hover:scale-105 hover:shadow-xl"
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-3 bg-emerald-500/10 rounded-xl">
                                            <ClipboardCheck className="h-6 w-6 text-emerald-500" />
                                        </div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">Configurer les contrôles</h3>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">Définissez votre périmètre ISO</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => navigate('/documents')}
                                    className="group p-6 bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-2xl hover:bg-white/80 dark:hover:bg-white/10 transition-all hover:scale-105 hover:shadow-xl"
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-3 bg-purple-500/10 rounded-xl">
                                            <FileText className="h-6 w-6 text-purple-500" />
                                        </div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">Ajouter des documents</h3>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">Centralisez vos politiques</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* État normal avec données */
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                            <div>
                                <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/10 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-widest mb-6 backdrop-blur-md shadow-sm">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full mr-2 animate-pulse"></span>
                                    {organizationName || user?.organizationName || 'Système Opérationnel'}
                                </div>
                                <div className="flex items-center gap-5 mb-4">
                                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tighter font-display">Sentinel GRC</h1>
                                    <div className={`flex items-center justify-center w-14 h-14 rounded-2xl text-3xl font-black shadow-2xl border-4 ${scoreGrade === 'A' ? 'bg-emerald-500 border-emerald-400/50 text-white' : scoreGrade === 'B' ? 'bg-blue-500 border-blue-400/50 text-white' : scoreGrade === 'C' ? 'bg-orange-500 border-orange-400/50 text-white' : 'bg-red-500 border-red-400/50 text-white'}`}>
                                        {scoreGrade}
                                    </div>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-lg font-medium max-w-lg leading-relaxed">Votre score de sécurité reflète la maturité actuelle : <strong className="text-slate-900 dark:text-white font-bold">{loading ? '...' : stats.compliance}%</strong> de conformité.</p>

                                <div className={`mt-8 p-4 rounded-2xl backdrop-blur-md border flex items-start gap-4 transition-all duration-300 hover:scale-[1.02] cursor-default shadow-lg ${insight.type === 'danger' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-200' : insight.type === 'warning' ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-500/20 text-orange-800 dark:text-orange-200' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-200'}`}>
                                    <div className={`p-2 rounded-xl shrink-0 ${insight.type === 'danger' ? 'bg-red-100 dark:bg-red-500/20' : insight.type === 'warning' ? 'bg-orange-100 dark:bg-orange-500/20' : 'bg-emerald-100 dark:bg-emerald-500/20'}`}>
                                        <Zap className="h-5 w-5" fill="currentColor" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm">{insight.text}</p>
                                        {insight.details && <p className="text-xs opacity-80 mt-1 font-medium leading-snug">{insight.details}</p>}
                                    </div>
                                    {insight.link && (
                                        <button onClick={() => navigate(insight.link!)} className="px-3 py-1.5 bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 rounded-lg text-xs font-bold transition-colors flex items-center border border-slate-200 dark:border-white/10">
                                            {insight.action} <ArrowRight className="h-3 w-3 ml-1" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="hidden lg:block w-64 h-64 cursor-pointer hover:scale-105 transition-transform duration-500 relative" onClick={() => navigate('/compliance')} title="Voir le détail par domaine">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                        <defs>
                                            <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={theme === 'dark' ? '#3b82f6' : '#0f172a'} stopOpacity={0.5} />
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
                                                fontFamily: 'SF Pro Display, sans-serif'
                                            }}
                                        />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <RechartsRadar
                                            name="Maturité"
                                            dataKey="A"
                                            stroke={theme === 'dark' ? '#60a5fa' : '#0f172a'}
                                            strokeWidth={2.5}
                                            fill="url(#radarFill)"
                                            fillOpacity={1}
                                        />
                                        <Tooltip
                                            content={<ChartTooltip />}
                                            cursor={{ stroke: theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)', strokeWidth: 1 }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <button onClick={() => navigate('/voxel')} className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 border border-purple-100 dark:border-purple-900/30 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform group shadow-sm">
                    <Settings3D className="h-5 w-5 text-purple-500 group-hover:animate-pulse" /> <span className="text-sm font-bold text-purple-700 dark:text-purple-400">Voxel 3D</span>
                </button>
                <button onClick={() => navigate('/incidents')} className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform group shadow-sm">
                    <Siren className="h-5 w-5 text-red-500 group-hover:animate-pulse" /> <span className="text-sm font-bold text-red-700 dark:text-red-400">Incident</span>
                </button>
                <button onClick={() => navigate('/risks')} className="p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform group shadow-sm">
                    <ShieldAlert className="h-5 w-5 text-orange-500" /> <span className="text-sm font-bold text-orange-700 dark:text-orange-400">Risque</span>
                </button>
                <button onClick={() => navigate('/assets')} className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform group shadow-sm">
                    <Server className="h-5 w-5 text-blue-500" /> <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Actif</span>
                </button>
                <button onClick={() => navigate('/team')} className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform group shadow-sm">
                    <User className="h-5 w-5 text-purple-500" /> <span className="text-sm font-bold text-purple-700 dark:text-purple-400">Utilisateur</span>
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
                <div className="glass-panel p-0 rounded-[2.5rem] overflow-hidden border border-white/60 dark:border-white/5 shadow-sm flex flex-col h-[400px]">
                    <div className="px-8 pt-8 pb-4 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                        <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Mon Espace</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">À faire cette semaine</p></div><User className="w-6 h-6 text-brand-500" />
                    </div>
                    <div className="flex-1 p-0 overflow-y-auto custom-scrollbar">
                        {loading ? <Skeleton className="h-full w-full m-4" /> : myActionItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center"><CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3 opacity-30" /><p className="text-sm font-bold text-slate-500">Rien à signaler.</p></div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {myActionItems.map(item => (
                                    <div key={item.id} onClick={() => navigate(item.link)} className="p-5 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer group card-hover rounded-xl">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${item.type === 'audit' ? 'bg-blue-50 text-blue-600' : item.type === 'policy' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                                                {item.type === 'audit' ? 'Audit' : item.type === 'policy' ? 'À Signer' : item.type === 'document' ? 'Revue' : 'Projet'}
                                            </span>
                                            <span className="text-xs text-slate-400 font-medium">{new Date(item.date).toLocaleDateString()}</span>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-brand-600 transition-colors truncate">{item.title}</h4>
                                        <p className="text-xs text-slate-500 mt-1">{item.status}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-panel p-0 rounded-[2.5rem] lg:col-span-2 flex flex-col overflow-hidden border border-white/60 dark:border-white/5 shadow-sm h-[400px]">
                    <div className="flex items-center justify-between px-8 pt-8 pb-4 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                        <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Évolution Conformité</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">30 derniers jours</p></div>
                        <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20"><TrendingUp className="w-5 h-5 text-emerald-500" /></div>
                    </div>
                    <div className="flex-1 w-full p-4 bg-white/40 dark:bg-transparent">
                        {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={historyData}>
                                    <defs>
                                        <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
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
                <div className="glass-panel p-0 rounded-[2.5rem] overflow-hidden border border-white/60 dark:border-white/5 shadow-sm flex flex-col">
                    <div className="px-8 pt-8 pb-4 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                        <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Diagnostic Santé</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">Alertes Système</p></div>
                        <CustomTooltip content={healthIssues.length > 0 ? "Des actions sont requises" : "Système sain"} position="left">
                            <Stethoscope className={`w-6 h-6 ${healthIssues.length > 0 ? 'text-orange-500' : 'text-emerald-500'}`} />
                        </CustomTooltip>
                    </div>
                    <div className="p-6 flex-1 space-y-4 bg-white/40 dark:bg-transparent">
                        {loading ? <Skeleton className="h-full w-full" /> : healthIssues.length === 0 ? (<div className="flex items-center p-4 bg-emerald-50/80 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30"><CheckCircle2 className="h-5 w-5 text-emerald-500 mr-3 flex-shrink-0" /><span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Aucune anomalie détectée.</span></div>) : (healthIssues.map(issue => (
                            <CustomTooltip key={issue.id} content="Cliquez pour résoudre" position="top" className="w-full">
                                <div onClick={() => navigate(issue.link)} className={`flex items-start p-4 rounded-2xl border cursor-pointer card-hover w-full ${issue.type === 'danger' ? 'bg-red-50/80 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 'bg-orange-50/80 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30'}`}><AlertTriangle className={`h-5 w-5 mr-3 mt-0.5 flex-shrink-0 ${issue.type === 'danger' ? 'text-red-500' : 'text-orange-500'}`} /><div><p className={`text-sm font-bold leading-tight ${issue.type === 'danger' ? 'text-red-800 dark:text-red-200' : 'text-orange-800 dark:text-orange-200'}`}>{issue.message}</p><span className={`text-xs font-medium mt-1 block ${issue.type === 'danger' ? 'text-red-600/70 dark:text-red-400' : 'text-orange-600/70 dark:text-orange-400'}`}>{issue.count} éléments concernés</span></div></div>
                            </CustomTooltip>
                        )))}
                    </div>
                </div>

                <div className="glass-panel p-0 rounded-[2.5rem] lg:col-span-2 overflow-hidden border border-white/60 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between px-8 pt-8 pb-4 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Risques Prioritaires</h3><Flame className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="p-8 space-y-3">
                        {loading ? [1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />) : topRisks.slice(0, 3).map(risk => (<div key={risk.id} onClick={() => navigate('/risks')} className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-all group flex items-center justify-between shadow-sm card-hover cursor-pointer"><div className="flex items-center"><div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mr-4 text-red-600 font-black text-lg shadow-inner">{risk.score}</div><div><h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{risk.threat}</h4><p className="text-xs text-slate-500 font-medium mt-0.5">{risk.vulnerability}</p></div></div><span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-slate-600 dark:text-slate-300">{risk.strategy}</span></div>))}
                        {topRisks.length === 0 && !loading && <p className="text-sm text-slate-400 italic text-center">Aucun risque majeur identifié.</p>}
                    </div>
                </div>
            </div>

            <div className="glass-panel p-0 rounded-[2.5rem] overflow-hidden border border-white/60 dark:border-white/5 shadow-sm">
                <div className="flex items-center justify-between px-8 pt-8 pb-4 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Flux d'activité récent</h3><History className="w-5 h-5 text-slate-400" />
                </div>
                <div className="relative border-l border-slate-200 dark:border-slate-800 ml-8 space-y-8 py-8 pr-8 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {loading ? <Skeleton className="h-20 w-full" /> : recentActivity.map((log, i) => (<div key={i} className="ml-6 relative group"><span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:scale-110 transition-transform z-10">{getActivityIcon(log.resource)}</span><div className="flex justify-between items-center"><div><p className="text-xs font-bold text-slate-800 dark:text-slate-200">{log.action}</p><p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[400px] font-medium">{log.details}</p></div><span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span></div></div>))}
                </div>
            </div>
        </div>
    );
};
