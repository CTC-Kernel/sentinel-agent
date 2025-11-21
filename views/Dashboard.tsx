
import React, { useEffect, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { ShieldAlert, CheckCircle2, Server, Activity, AlertTriangle, Download, ChevronRight, CalendarDays, FolderKanban, Siren } from '../components/ui/Icons';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, where, getCountFromServer } from 'firebase/firestore';
import { Risk, Control, Audit, Project, Incident } from '../types';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const StatCard: React.FC<{ title: string; value: string | number; icon: any; trend?: string; color: string; delay?: string }> = ({ title, value, icon: Icon, trend, color, delay }) => (
  <div className={`relative group bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl p-6 rounded-[2rem] border border-white/40 dark:border-white/5 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)] dark:shadow-none hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-1 overflow-hidden ${delay}`}>
    <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-700 blur-2xl ${color.replace('text-', 'bg-')}`}></div>
    <div className="flex flex-col h-full justify-between relative z-10">
      <div className="flex justify-between items-start mb-4">
         <div className={`p-3.5 rounded-[1.2rem] ${color} bg-opacity-10 ring-1 ring-inset ring-black/5 dark:ring-white/10`}>
            <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} strokeWidth={2} />
         </div>
         {trend && <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-400/20">
            {trend}
         </span>}
      </div>
      <div>
        <h3 className="text-3xl font-bold tracking-tighter text-slate-900 dark:text-white font-display">{value}</h3>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{title}</p>
      </div>
    </div>
  </div>
);

interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    type: 'Audit' | 'Project';
    status: string;
}

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ risks: 0, assets: 0, compliance: 0, highRisks: 0, auditsOpen: 0, activeIncidents: 0 });
  const [radarData, setRadarData] = useState<any[]>([]);
  const [riskDistData, setRiskDistData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [topRisks, setTopRisks] = useState<Risk[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // OPTIMIZATION: Use getCountFromServer for simple totals to avoid downloading full collections
        const riskColl = collection(db, 'risks');
        const assetColl = collection(db, 'assets');
        const incidentColl = collection(db, 'incidents');
        const auditColl = collection(db, 'audits');

        // 1. Aggregated Counts (Server-side)
        const [
            risksCountSnap,
            assetsCountSnap,
            highRisksCountSnap,
            activeIncidentsCountSnap,
            openAuditsCountSnap
        ] = await Promise.all([
            getCountFromServer(riskColl),
            getCountFromServer(assetColl),
            getCountFromServer(query(riskColl, where('score', '>=', 15))),
            getCountFromServer(query(incidentColl, where('status', '!=', 'Fermé'))),
            getCountFromServer(query(auditColl, where('status', 'in', ['Planifié', 'En cours'])))
        ]);

        // 2. Limited fetches for Charts & Tables (Payload optimization)
        const [
            // Top 5 Risks
            topRisksSnap,
            // Upcoming Audits (Limited)
            auditsSnap,
            // Upcoming Projects (Limited)
            projectsSnap,
            // All controls needed for Compliance calc (Lightweight docs)
            controlsSnap,
            // Recent Logs
            logsSnap
        ] = await Promise.all([
            getDocs(query(riskColl, orderBy('score', 'desc'), limit(5))),
            getDocs(query(auditColl, where('status', '!=', 'Terminé'), limit(5))),
            getDocs(query(collection(db, 'projects'), where('status', '!=', 'Terminé'), orderBy('dueDate', 'asc'), limit(5))),
            getDocs(collection(db, 'controls')),
            getDocs(query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(5)))
        ]);

        // 3. Data Processing
        const topRisksData = topRisksSnap.docs.map(d => ({id: d.id, ...d.data()} as Risk));
        setTopRisks(topRisksData);

        // Calculate Risk Distribution locally from Top Risks (Approximation for speed) 
        // OR fetch specific distributions if precision critical. 
        // For Dashboard speed, we can approximate or fetch just scores.
        // Better: Fetch only scores for distribution chart.
        // Optimization: We will use a separate light query just for scores to build the BarChart perfectly
        const allRiskScoresSnap = await getDocs(query(riskColl)); // Still heavy? If > 1000 docs, consider aggregation.
        // For now, assuming < 1000 risks, we fetch all to build the chart accurate.
        // If really huge, we should use a cloud function to aggregate stats.
        
        const allRisks = allRiskScoresSnap.docs.map(d => d.data() as Risk);
        
        const dist = {
            'Faible': allRisks.filter(r => r.score < 5).length,
            'Moyen': allRisks.filter(r => r.score >= 5 && r.score < 10).length,
            'Élevé': allRisks.filter(r => r.score >= 10 && r.score < 15).length,
            'Critique': allRisks.filter(r => r.score >= 15).length,
        };
        
        const barData = [
            { name: 'Faible', count: dist.Faible, color: '#34d399' },
            { name: 'Moyen', count: dist.Moyen, color: '#fbbf24' },
            { name: 'Élevé', count: dist.Élevé, color: '#fb923c' },
            { name: 'Critique', count: dist.Critique, color: '#f87171' },
        ];

        const audits = auditsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Audit));
        const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Project));

        // Calendar Events Merging
        const events: CalendarEvent[] = [];
        audits.forEach(a => {
            if(a.dateScheduled) events.push({ id: a.id, title: a.name, date: a.dateScheduled, type: 'Audit', status: a.status });
        });
        projects.forEach(p => {
            if(p.dueDate) events.push({ id: p.id, title: p.name, date: p.dueDate, type: 'Project', status: p.status });
        });
        events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setCalendarEvents(events.slice(0, 5));

        // Compliance Logic
        const controls = controlsSnap.docs.map(d => d.data() as Control);
        const implemented = controls.filter(c => c.status === 'Implémenté').length;
        const actionableControls = controls.filter(c => c.status !== 'Exclu' && c.status !== 'Non applicable');
        const complianceScore = actionableControls.length > 0 ? Math.round((implemented / actionableControls.length) * 100) : 0;

        // Radar Data
        const domainScores: Record<string, { name: string; total: number; implemented: number }> = {
            'A.5': { name: 'Politiques', total: 0, implemented: 0 },
            'A.6': { name: 'Organisation', total: 0, implemented: 0 },
            'A.7': { name: 'RH', total: 0, implemented: 0 },
            'A.8': { name: 'Actifs', total: 0, implemented: 0 },
            'A.9': { name: 'Accès', total: 0, implemented: 0 },
            'A.10': { name: 'Crypto', total: 0, implemented: 0 },
        };
        controls.forEach(c => {
            const key = Object.keys(domainScores).find(k => c.code.startsWith(k)) || 'A.5';
            if (domainScores[key]) {
                domainScores[key].total++;
                if (c.status === 'Implémenté') domainScores[key].implemented++;
            }
        });
        const dynamicChartData = Object.values(domainScores).map(d => ({
            subject: d.name,
            A: d.total > 0 ? Math.round((d.implemented / d.total) * 100) : 0,
            fullMark: 100
        }));

        // Update State
        setStats({
          risks: risksCountSnap.data().count,
          assets: assetsCountSnap.data().count,
          compliance: complianceScore,
          highRisks: highRisksCountSnap.data().count,
          auditsOpen: openAuditsCountSnap.data().count,
          activeIncidents: activeIncidentsCountSnap.data().count
        });

        setRadarData(dynamicChartData);
        setRiskDistData(barData);
        setRecentActivity(logsSnap.docs.map(d => d.data()));
        setError(null);

      } catch (error: any) {
        console.error("Error fetching dashboard data", error);
        setError("Impossible de charger les données (Erreur Réseau ou Permissions).");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Generate iCal (.ics) file
  const exportToICS = () => {
    if (calendarEvents.length === 0) return;
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Sentinel//GRC//FR\n";
    calendarEvents.forEach(evt => {
        const startDate = new Date(evt.date);
        const startStr = startDate.toISOString().replace(/-|:|\.\d+/g, "").slice(0, 8);
        icsContent += "BEGIN:VEVENT\n";
        icsContent += `SUMMARY:Sentinel GRC - ${evt.type}: ${evt.title}\n`;
        icsContent += `DTSTART;VALUE=DATE:${startStr}\n`;
        icsContent += `DESCRIPTION:Statut: ${evt.status}\n`;
        icsContent += "END:VEVENT\n";
    });
    icsContent += "END:VCALENDAR";
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'sentinel_planning.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDFReport = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('fr-FR');
    
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Sentinel GRC - Rapport Exécutif", 14, 25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`Généré le ${today}`, 170, 25);

    let yPos = 55;

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("1. Indicateurs de Performance (KPIs)", 14, yPos);
    yPos += 10;

    const kpiData = [
        ['Score Conformité', 'Risques Totaux', 'Risques Critiques', 'Audits Ouverts', 'Actifs'],
        [`${stats.compliance}%`, stats.risks, stats.highRisks, stats.auditsOpen, stats.assets]
    ];

    (doc as any).autoTable({
        startY: yPos,
        head: [kpiData[0]],
        body: [kpiData[1]],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, halign: 'center' },
        bodyStyles: { halign: 'center', fontSize: 12, fontStyle: 'bold' },
        styles: { cellPadding: 5 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 20;

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("2. Top 5 Risques Prioritaires", 14, yPos);
    yPos += 10;

    const riskRows = topRisks.map(r => [r.threat, r.vulnerability, r.score, r.strategy]);
    (doc as any).autoTable({
        startY: yPos,
        head: [['Menace', 'Vulnérabilité', 'Score', 'Stratégie']],
        body: riskRows,
        theme: 'striped',
        headStyles: { fillColor: [244, 63, 94] },
        alternateRowStyles: { fillColor: [255, 241, 242] }
    });

    yPos = (doc as any).lastAutoTable.finalY + 20;

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("3. Maturité par Domaine ISO 27001", 14, yPos);
    yPos += 10;

    const complianceRows = radarData.map((d: any) => [d.subject, `${d.A}%`]);
    (doc as any).autoTable({
        startY: yPos,
        head: [['Domaine', 'Taux de mise en œuvre']],
        body: complianceRows,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`Sentinel_Rapport_Executif_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin"></div>
        <span className="text-slate-400 text-sm font-medium animate-pulse">Analyse des données en cours...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Vector Header Banner */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 dark:bg-black shadow-2xl ring-1 ring-white/10">
         <div className="absolute inset-0">
             <svg className="h-full w-full opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none">
                 <path d="M0 100 C 30 20 70 20 100 100 Z" fill="url(#gradHeader)" />
                 <path d="M0 100 C 30 50 70 50 100 100 Z" fill="url(#gradHeader2)" opacity="0.5" />
                 <defs>
                     <linearGradient id="gradHeader" x1="0%" y1="0%" x2="100%" y2="0%">
                         <stop offset="0%" stopColor="#3b82f6" />
                         <stop offset="100%" stopColor="#8b5cf6" />
                     </linearGradient>
                     <linearGradient id="gradHeader2" x1="0%" y1="0%" x2="100%" y2="0%">
                         <stop offset="0%" stopColor="#06b6d4" />
                         <stop offset="100%" stopColor="#3b82f6" />
                     </linearGradient>
                 </defs>
             </svg>
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
             <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[200%] bg-brand-500/20 blur-[120px] rounded-full mix-blend-screen"></div>
         </div>
         
         <div className="relative z-10 p-10 md:p-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
             <div className="max-w-2xl">
                 <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-xs font-medium mb-4 shadow-sm">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></span>
                    Système Sécurisé
                 </div>
                 <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight font-display">Vue d'ensemble</h1>
                 <p className="text-blue-100/80 text-lg leading-relaxed font-light">
                     Votre posture de sécurité est solide. Le score de conformité ISO 27001 atteint <span className="font-bold text-white">{stats.compliance}%</span>.
                 </p>
             </div>
             <button 
                onClick={generatePDFReport}
                className="group relative flex items-center px-6 py-3.5 bg-white text-slate-900 rounded-2xl font-semibold transition-all duration-300 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95"
            >
              <span className="relative z-10 flex items-center">
                <Download className="h-5 w-5 mr-2" />
                Exporter le rapport
              </span>
            </button>
         </div>
      </div>

      {error && (
        <div className="bg-red-50/50 dark:bg-red-900/10 backdrop-blur-md border border-red-200/50 dark:border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-center text-sm">
          <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Incidents Actifs" value={stats.activeIncidents} icon={Siren} color={stats.activeIncidents > 0 ? "bg-red-600 text-red-600" : "bg-slate-400 text-slate-400"} delay="animate-[fadeIn_0.4s_ease-out_0ms]" trend={stats.activeIncidents > 0 ? "Attention" : "Calme"} />
        <StatCard title="Risques Critiques" value={stats.highRisks} icon={ShieldAlert} color="bg-rose-500 text-rose-500" delay="animate-[fadeIn_0.4s_ease-out_100ms]" />
        <StatCard title="Conformité ISO" value={`${stats.compliance}%`} icon={CheckCircle2} color="bg-emerald-500 text-emerald-500" delay="animate-[fadeIn_0.4s_ease-out_200ms]" />
        <StatCard title="Audits en cours" value={stats.auditsOpen} icon={Activity} color="bg-amber-500 text-amber-500" delay="animate-[fadeIn_0.4s_ease-out_300ms]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CALENDAR WIDGET */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2.5rem] border border-white/40 dark:border-white/5 p-8 shadow-sm flex flex-col relative overflow-hidden lg:col-span-1 lg:row-span-2">
           <div className="flex items-center justify-between mb-6 relative z-10">
              <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Calendrier</h3>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Prochaines échéances</p>
              </div>
              <div className="flex gap-2">
                  <button onClick={exportToICS} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm text-slate-600 dark:text-slate-300 hover:text-brand-600 transition-colors" title="Exporter iCal (Outlook/Calendrier)">
                      <Download className="w-4 h-4" />
                  </button>
                  <div className="p-2 bg-indigo-50 dark:bg-slate-700/50 rounded-full">
                      <CalendarDays className="w-4 h-4 text-indigo-500" />
                  </div>
              </div>
           </div>
           
           <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
               {calendarEvents.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-xs">
                       <CalendarDays className="h-8 w-8 mb-2 opacity-30"/>
                       Rien de prévu prochainement
                   </div>
               ) : (
                   calendarEvents.map(event => (
                       <div key={event.id} className="flex items-center p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/50 dark:border-gray-700 shadow-sm hover:scale-[1.02] transition-transform">
                           <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs font-bold border ${event.type === 'Audit' ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                               <span className="text-[10px] uppercase">{new Date(event.date).toLocaleDateString(undefined, {month:'short'})}</span>
                               <span className="text-lg leading-none">{new Date(event.date).getDate()}</span>
                           </div>
                           <div className="ml-3 overflow-hidden">
                               <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{event.title}</p>
                               <div className="flex items-center mt-1">
                                   {event.type === 'Audit' ? <Activity className="h-3 w-3 mr-1 text-amber-500"/> : <FolderKanban className="h-3 w-3 mr-1 text-blue-500"/>}
                                   <span className="text-xs text-slate-500 dark:text-slate-400">{event.type} • {event.status}</span>
                               </div>
                           </div>
                       </div>
                   ))
               )}
           </div>
        </div>

        {/* Radar Chart */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2.5rem] border border-white/40 dark:border-white/5 p-8 shadow-sm flex flex-col relative overflow-hidden group lg:col-span-1">
           <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
           <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Maturité ISO</h3>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Par Domaine</p>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-slate-700/50 rounded-full">
                  <Activity className="w-4 h-4 text-blue-500" />
              </div>
           </div>
           <div className="flex-1 min-h-[250px] relative z-10">
             {radarData.length > 0 && radarData[0].subject !== 'Init' ? (
             <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#94a3b8" strokeOpacity={0.15} />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Score"
                  dataKey="A"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#radarGradient)"
                  fillOpacity={0.4}
                />
                <defs>
                    <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 500 }}
                    cursor={false}
                />
              </RadarChart>
            </ResponsiveContainer>
             ) : (
                 <div className="flex h-full items-center justify-center flex-col text-slate-300">
                    <span className="text-sm font-medium">En attente de données...</span>
                 </div>
             )}
          </div>
        </div>

        {/* Risk Distribution Bar Chart */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2.5rem] border border-white/40 dark:border-white/5 p-8 shadow-sm flex flex-col relative overflow-hidden group lg:col-span-1">
           <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
           <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Distribution</h3>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Risques par niveau</p>
              </div>
              <div className="p-2 bg-orange-50 dark:bg-slate-700/50 rounded-full">
                  <ShieldAlert className="w-4 h-4 text-orange-500" />
              </div>
           </div>
           <div className="flex-1 min-h-[250px] relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskDistData} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.08} stroke="#64748b" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip 
                        cursor={{fill: 'rgba(0,0,0,0.02)'}} 
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }} 
                        itemStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 6, 6]}>
                        {riskDistData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white/60 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2.5rem] border border-white/40 dark:border-white/5 p-8 shadow-sm relative overflow-hidden flex flex-col lg:col-span-2">
          <div className="flex justify-between items-center mb-8">
             <h3 className="text-lg font-bold text-slate-900 dark:text-white">Activités</h3>
             <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700/50 hover:bg-brand-50 dark:hover:bg-brand-900/30 text-slate-400 hover:text-brand-600 transition-colors">
                <ChevronRight className="w-4 h-4" />
             </button>
          </div>
          
          <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            {recentActivity.length > 0 ? recentActivity.map((log, i) => (
              <div key={i} className="flex items-start space-x-4 relative group">
                {i !== recentActivity.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-[-24px] w-[2px] bg-slate-100 dark:bg-slate-700/50"></div>
                )}
                <div className="relative z-10 w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <div className="w-2 h-2 rounded-full bg-brand-500"></div>
                </div>
                <div className="pb-1 pt-0.5">
                  <p className="text-sm text-slate-800 dark:text-slate-200 font-semibold tracking-tight">{log.action}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{log.details}</p>
                  <p className="text-[10px] text-slate-400 mt-1.5 font-mono opacity-70">
                    {new Date(log.timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric'})} • {new Date(log.timestamp).toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
            )) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-300">
                    <Activity className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs">Aucune activité</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
