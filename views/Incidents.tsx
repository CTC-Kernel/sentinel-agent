
import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Incident, Asset, Criticality, Risk, UserProfile } from '../types';
import { Plus, Search, Siren, Trash2, Edit, AlertTriangle, Server, FileSpreadsheet, X, MessageSquare, ShieldAlert, BookOpen, FileText, Download, ListTodo, Clock, Activity, CheckCircle2, Euro } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { Comments } from '../components/ui/Comments';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { sendEmail } from '../services/emailService';
import { getIncidentAlertTemplate } from '../services/emailTemplates';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

const PLAYBOOKS: Record<string, string[]> = {
    'Ransomware': ['Déconnecter la machine', 'Ne PAS éteindre', 'Photo de la rançon', 'Vérifier backups', 'Identifier malware', 'Isoler partages', 'Déclarer CNIL', 'Restaurer'],
    'Phishing': ['Changer mot de passe', 'Activer MFA', 'Scanner règles email', 'Purger email', 'Vérifier logs', 'Rappel utilisateurs'],
    'Vol Matériel': ['Effacement à distance', 'Révoquer certificats', 'Changer MDP locaux', 'Plainte police', 'Assurance'],
    'Indisponibilité': ['Vérifier élec/ondulateur', 'Ping/Traceroute', 'Basculer lien secours', 'Contacter FAI', 'Activer PCA > 4h'],
    'Fuite de Données': ['Identifier source', 'Colmater brèche', 'Lister données', 'Qualifier sensibilité', 'Notifier personnes', 'Notifier CNIL'],
    'Autre': ['Documenter faits', 'Qualifier impact', 'Prévenir RSSI', 'Sauvegarder logs', 'Sécuriser preuves']
};

export const Incidents: React.FC = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filter, setFilter] = useState('');
    const { user, addToast } = useStore();
    const canEdit = user?.role === 'admin' || user?.role === 'auditor';
    const [isEditing, setIsEditing] = useState(false);
    const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null);
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
    const [stats, setStats] = useState({ open: 0, critical: 0, recent: 0 });
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [newIncident, setNewIncident] = useState<Partial<Incident>>({ title: '', description: '', severity: Criticality.MEDIUM, status: 'Nouveau', category: 'Autre', playbookStepsCompleted: [], affectedAssetId: '', relatedRiskId: '', reporter: '', financialImpact: 0 });

    const fetchData = async () => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'incidents'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId)))
            ]);

            const getDocsData = <T,>(result: PromiseSettledResult<any>): T[] => {
                if (result.status === 'fulfilled') {
                    return result.value.docs.map((d: any) => ({ id: d.id, ...d.data() })) as T[];
                }
                return [];
            };

            const data = getDocsData<Incident>(results[0]);
            data.sort((a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime());
            setIncidents(data);

            const assetData = getDocsData<Asset>(results[1]);
            assetData.sort((a, b) => a.name.localeCompare(b.name));
            setAssets(assetData);

            const riskData = getDocsData<Risk>(results[2]);
            riskData.sort((a, b) => a.threat.localeCompare(b.threat));
            setRisks(riskData);

            const userData = getDocsData<UserProfile>(results[3]);
            setUsersList(userData);

            const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
            setStats({
                open: data.filter(i => i.status !== 'Fermé' && i.status !== 'Résolu').length,
                critical: data.filter(i => i.severity === Criticality.CRITICAL).length,
                recent: data.filter(i => new Date(i.dateReported) > lastMonth).length
            });
        } catch (err) {
            addToast("Erreur chargement données", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [user?.organizationId]);

    const openModal = (incident?: Incident) => {
        if (incident) { setNewIncident(incident); setCurrentIncidentId(incident.id); setIsEditing(true); }
        else { setNewIncident({ title: '', description: '', severity: Criticality.MEDIUM, status: 'Nouveau', category: 'Autre', playbookStepsCompleted: [], affectedAssetId: '', relatedRiskId: '', reporter: user?.displayName || user?.email || '', financialImpact: 0 }); setCurrentIncidentId(null); setIsEditing(false); }
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.organizationId) return;
        try {
            const incidentData = { ...newIncident };
            if (incidentData.status === 'Résolu' || incidentData.status === 'Fermé') { if (!incidentData.dateResolved) incidentData.dateResolved = new Date().toISOString(); }

            if (isEditing && currentIncidentId) {
                await updateDoc(doc(db, 'incidents', currentIncidentId), incidentData as any);
                await logAction(user, 'UPDATE', 'Incident', `MAJ Incident: ${newIncident.title}`);
                addToast("Incident mis à jour", "success");
                if (selectedIncident?.id === currentIncidentId) setSelectedIncident({ ...selectedIncident, ...incidentData } as Incident);
            } else {
                await addDoc(collection(db, 'incidents'), { ...incidentData, organizationId: user.organizationId, dateReported: new Date().toISOString() });
                await logAction(user, 'CREATE', 'Incident', `Nouvel Incident: ${newIncident.title}`);

                const incidentLink = `${window.location.origin}/#/incidents`;
                const htmlContent = getIncidentAlertTemplate(newIncident.title || 'Incident', newIncident.severity || 'Moyenne', user?.displayName || 'Utilisateur', incidentLink);
                await sendEmail(user, { to: 'rssi@sentinel.local', subject: `[ALERTE SÉCURITÉ] ${newIncident.severity?.toUpperCase()} - ${newIncident.title}`, type: 'INCIDENT_ALERT', html: htmlContent });
                addToast("Incident déclaré (Alerte envoyée)", "success");
            }
            setShowModal(false);
            fetchData();
        } catch (e) { addToast("Erreur enregistrement", "error"); }
    };

    const initiateDelete = (id: string) => { setConfirmData({ isOpen: true, title: "Supprimer l'incident ?", message: "Cette action est définitive.", onConfirm: () => handleDelete(id) }); };
    const handleDelete = async (id: string) => { try { await deleteDoc(doc(db, 'incidents', id)); setIncidents(prev => prev.filter(i => i.id !== id)); if (selectedIncident?.id === id) setSelectedIncident(null); addToast("Incident supprimé", "info"); fetchData(); } catch (e) { addToast("Erreur suppression", "error"); } };
    const togglePlaybookStep = async (step: string) => { if (!selectedIncident) return; const isCompleted = selectedIncident.playbookStepsCompleted?.includes(step); try { await updateDoc(doc(db, 'incidents', selectedIncident.id), { playbookStepsCompleted: isCompleted ? arrayRemove(step) : arrayUnion(step) }); const updatedList = isCompleted ? (selectedIncident.playbookStepsCompleted || []).filter(s => s !== step) : [...(selectedIncident.playbookStepsCompleted || []), step]; setSelectedIncident({ ...selectedIncident, playbookStepsCompleted: updatedList }); } catch (e) { console.error(e); } };

    const generateReport = () => { if (!selectedIncident) return; const doc = new jsPDF(); const assetName = assets.find(a => a.id === selectedIncident.affectedAssetId)?.name || 'Non spécifié'; const riskName = risks.find(r => r.id === selectedIncident.relatedRiskId)?.threat || 'Non spécifié'; doc.setFillColor(220, 38, 38); doc.rect(0, 0, 210, 30, 'F'); doc.setFontSize(18); doc.setTextColor(255, 255, 255); doc.text("RAPPORT D'INCIDENT DE SÉCURITÉ", 14, 20); doc.setFontSize(10); doc.text(`Réf: ${selectedIncident.id}`, 150, 20); let y = 45; doc.setTextColor(0, 0, 0); doc.setFontSize(14); doc.text(selectedIncident.title, 14, y); y += 10; doc.setFontSize(10); doc.setTextColor(100); doc.text(`Déclaré le: ${new Date(selectedIncident.dateReported).toLocaleString()}`, 14, y); doc.text(`Par: ${selectedIncident.reporter}`, 14, y + 5); y += 15; const headers = [['Champ', 'Valeur']]; const data = [['Sévérité', selectedIncident.severity], ['Catégorie', selectedIncident.category || 'Autre'], ['Statut Actuel', selectedIncident.status], ['Actif Impacté', assetName], ['Risque Associé', riskName], ['Impact Financier', selectedIncident.financialImpact ? `${selectedIncident.financialImpact} €` : 'N/A']]; (doc as any).autoTable({ startY: y, head: headers, body: data, theme: 'grid', headStyles: { fillColor: [100, 116, 139] } }); y = (doc as any).lastAutoTable.finalY + 15; doc.setFontSize(12); doc.setTextColor(0); doc.text("Description Détaillée", 14, y); y += 5; doc.setFontSize(10); doc.setTextColor(50); doc.text(doc.splitTextToSize(selectedIncident.description, 180), 14, y); if (selectedIncident.lessonsLearned) { y += 40; doc.setFontSize(12); doc.setTextColor(0); doc.text("Retour d'Expérience", 14, y); y += 5; doc.setFontSize(10); doc.setTextColor(50); doc.text(doc.splitTextToSize(selectedIncident.lessonsLearned, 180), 14, y); } doc.save(`Rapport_Incident.pdf`); };
    const handleExportCSV = () => { const headers = ["Titre", "Sévérité", "Catégorie", "Statut", "Actif", "Risque Lié", "Déclaré par", "Date", "Coût"]; const rows = filteredIncidents.map(i => [i.title, i.severity, i.category, i.status, assets.find(a => a.id === i.affectedAssetId)?.name || '-', risks.find(r => r.id === i.relatedRiskId)?.threat || '-', i.reporter, new Date(i.dateReported).toLocaleDateString(), i.financialImpact || '0']); const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })); link.download = `incidents.csv`; link.click(); };
    const getSeverityColor = (s: Criticality) => { switch (s) { case Criticality.CRITICAL: return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50 shadow-red-500/10'; case Criticality.HIGH: return 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 shadow-orange-500/10'; case Criticality.MEDIUM: return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 shadow-amber-500/10'; default: return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 shadow-blue-500/10'; } };
    const getStatusColor = (s: string) => { switch (s) { case 'Nouveau': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20'; case 'Analyse': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'; case 'Contenu': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'; case 'Résolu': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'; case 'Fermé': return 'text-slate-500 bg-slate-100 dark:bg-slate-800 line-through decoration-slate-400'; default: return 'text-gray-600 bg-gray-50'; } };
    const filteredIncidents = incidents.filter(i => i.title.toLowerCase().includes(filter.toLowerCase()));

    const getPlaybookProgress = () => {
        if (!selectedIncident || !selectedIncident.category || !PLAYBOOKS[selectedIncident.category]) return 0;
        const total = PLAYBOOKS[selectedIncident.category].length;
        const completed = selectedIncident.playbookStepsCompleted?.length || 0;
        return Math.round((completed / total) * 100);
    }

    const getTimeToResolve = (incident: Incident) => {
        if (!incident.dateResolved) return null;
        const start = new Date(incident.dateReported);
        const end = new Date(incident.dateResolved);
        const diffMs = end.getTime() - start.getTime();
        const diffHrs = Math.round(diffMs / (1000 * 60 * 60));
        if (diffHrs < 24) return `${diffHrs} heures`;
        return `${Math.round(diffHrs / 24)} jours`;
    }

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative">
            <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><div><h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Incidents de Sécurité</h1><p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Gestion de crise et réponse aux incidents (ISO A.16).</p></div><button onClick={() => openModal()} className="group flex items-center px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-red-500/30 ring-4 ring-red-500/20"><Siren className="h-4 w-4 mr-2 animate-pulse" /> Déclarer un Incident</button></div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Incidents Ouverts</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.open}</p></div><div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600"><Activity className="h-6 w-6" /></div></div><div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">Incidents Critiques</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.critical}</p></div><div className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600"><AlertTriangle className="h-6 w-6" /></div></div><div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">30 derniers jours</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.recent}</p></div><div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"><Clock className="h-6 w-6" /></div></div></div>

            <div className="glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all border border-slate-200 dark:border-white/5"><Search className="h-5 w-5 text-gray-400" /><input type="text" placeholder="Rechercher un incident..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400" value={filter} onChange={e => setFilter(e.target.value)} /><button onClick={handleExportCSV} className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors" title="Exporter CSV"><FileSpreadsheet className="h-4 w-4" /></button></div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {loading ? (
                    <div className="col-span-full"><CardSkeleton count={4} /></div>
                ) : filteredIncidents.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            icon={Siren}
                            title="Aucun incident signalé"
                            description={filter ? "Aucun incident ne correspond à votre recherche." : "Tout est calme. Aucun incident de sécurité n'a été rapporté pour le moment."}
                            actionLabel={filter ? undefined : "Déclarer un incident"}
                            onAction={filter ? undefined : () => openModal()}
                        />
                    </div>
                ) : filteredIncidents.map(incident => (<div key={incident.id} onClick={() => setSelectedIncident(incident)} className="glass-panel rounded-[2.5rem] p-7 shadow-sm hover:shadow-apple transition-all duration-300 hover:-translate-y-1 flex flex-col relative overflow-hidden cursor-pointer group border border-white/50 dark:border-white/5">{incident.severity === Criticality.CRITICAL && (<div className="absolute top-6 right-6"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span></div>)}<div className="flex justify-between items-start mb-4"><div className="flex gap-2"><span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getSeverityColor(incident.severity)}`}>{incident.severity}</span><span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getStatusColor(incident.status)}`}>{incident.status}</span></div></div><h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-600 transition-colors leading-tight">{incident.title}</h3><p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 leading-relaxed">{incident.description}</p><div className="flex gap-3 flex-wrap mb-6"><div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg"><ListTodo className="h-3.5 w-3.5 mr-2 text-slate-400" />{incident.category || 'Autre'}</div>{incident.affectedAssetId && (<div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg"><Server className="h-3.5 w-3.5 mr-2 text-slate-400" />{assets.find(a => a.id === incident.affectedAssetId)?.name || 'Inconnu'}</div>)}</div><div className="flex items-center justify-between pt-5 border-t border-dashed border-gray-200 dark:border-white/10 mt-auto"><div className="text-xs font-medium text-slate-400">{new Date(incident.dateReported).toLocaleDateString()} • {incident.reporter}</div><div className="text-xs text-brand-600 font-bold flex items-center group-hover:translate-x-1 transition-transform">Ouvrir le dossier <Siren className="ml-1.5 h-3.5 w-3.5" /></div></div></div>))}
            </div>

            {/* Incident Inspector */}
            {selectedIncident && (<div className="fixed inset-0 z-[100] overflow-hidden"><div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setSelectedIncident(null)} /><div className="absolute inset-y-0 right-0 sm:pl-10 max-w-full flex pointer-events-none"><div className="w-screen max-w-xl pointer-events-auto"><div className="h-full flex flex-col bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-slide-up"><div className="px-8 py-6 border-b border-red-50 dark:border-red-900/20 flex items-start justify-between bg-red-50/30 dark:bg-red-900/10"><div><div className="flex items-center gap-3 mb-2"><span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityColor(selectedIncident.severity)}`}>{selectedIncident.severity}</span><span className="text-xs text-red-600 dark:text-red-400 font-bold">{new Date(selectedIncident.dateReported).toLocaleString()}</span></div><h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{selectedIncident.title}</h2></div><div className="flex gap-2"><button onClick={() => generateReport()} className="p-2.5 text-slate-500 hover:bg-white/50 rounded-xl transition-colors shadow-sm"><Download className="h-5 w-5" /></button>{canEdit && (<><button onClick={() => openModal(selectedIncident)} className="p-2.5 text-slate-500 hover:bg-white/50 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button><button onClick={() => initiateDelete(selectedIncident.id)} className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50/50 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button></>)}<button onClick={() => setSelectedIncident(null)} className="p-2.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-white/50 transition-colors"><X className="h-5 w-5" /></button></div></div>

                <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 custom-scrollbar">

                    {/* Visual Timeline */}
                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Chronologie</h3>
                        <div className="relative flex items-center justify-between px-2">
                            {/* Line */}
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 dark:bg-white/10 -z-10"></div>

                            {/* Steps */}
                            <div className="flex flex-col items-center relative">
                                <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30 mb-2 z-10"><AlertTriangle className="w-4 h-4" /></div>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Déclaré</span>
                                <span className="text-[9px] text-slate-400 mt-0.5">{new Date(selectedIncident.dateReported).toLocaleDateString()}</span>
                            </div>

                            <div className="flex flex-col items-center relative">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10 ${['Analyse', 'Contenu', 'Résolu', 'Fermé'].includes(selectedIncident.status) ? 'bg-blue-500 text-white shadow-blue-500/30' : 'bg-gray-200 dark:bg-slate-700 text-gray-400'}`}><Search className="w-4 h-4" /></div>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Analyse</span>
                            </div>

                            <div className="flex flex-col items-center relative">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10 ${['Contenu', 'Résolu', 'Fermé'].includes(selectedIncident.status) ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-gray-200 dark:bg-slate-700 text-gray-400'}`}><ShieldAlert className="w-4 h-4" /></div>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Contenu</span>
                            </div>

                            <div className="flex flex-col items-center relative">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-10 ${['Résolu', 'Fermé'].includes(selectedIncident.status) ? 'bg-green-500 text-white shadow-green-500/30' : 'bg-gray-200 dark:bg-slate-700 text-gray-400'}`}><CheckCircle2 className="w-4 h-4" /></div>
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Résolu</span>
                                {selectedIncident.dateResolved && <span className="text-[9px] text-slate-400 mt-0.5">{new Date(selectedIncident.dateResolved).toLocaleDateString()}</span>}
                            </div>
                        </div>

                        {selectedIncident.dateResolved && (
                            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 text-center">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Temps de résolution : <strong className="text-slate-900 dark:text-white">{getTimeToResolve(selectedIncident)}</strong></span>
                            </div>
                        )}
                    </div>

                    {/* Timeline & Progress */}
                    {selectedIncident.category && PLAYBOOKS[selectedIncident.category] && (
                        <div className="bg-white dark:bg-slate-800/80 rounded-3xl border border-brand-200 dark:border-brand-900/50 shadow-sm p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-500"></div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center"><ListTodo className="h-4 w-4 mr-2 text-brand-600" /> Playbook : {selectedIncident.category}</h3>
                                <span className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded-lg">{getPlaybookProgress()}% Complété</span>
                            </div>

                            <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 mb-6">
                                <div className="bg-brand-500 h-2 rounded-full transition-all duration-500 shadow-sm shadow-brand-500/30" style={{ width: `${getPlaybookProgress()}%` }}></div>
                            </div>

                            <div className="space-y-2.5">
                                {PLAYBOOKS[selectedIncident.category].map((step, idx) => {
                                    const isDone = selectedIncident.playbookStepsCompleted?.includes(step);
                                    return (
                                        <label key={idx} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${isDone ? 'bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent'}`}>
                                            <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isDone ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                                                {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={isDone} onChange={() => togglePlaybookStep(step)} disabled={!canEdit} />
                                            <span className={`text-sm font-medium ${isDone ? 'text-green-800 dark:text-green-300 line-through decoration-green-500/30' : 'text-slate-700 dark:text-slate-200'}`}>{step}</span>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {selectedIncident.financialImpact && selectedIncident.financialImpact > 0 && (
                        <div className="bg-emerald-50/80 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl text-emerald-600">
                                <Euro className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-600/80 mb-1">Impact Financier Estimé</h4>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(selectedIncident.financialImpact)}</p>
                            </div>
                        </div>
                    )}

                    <div><h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Description</h3><div className="p-6 bg-slate-50/80 dark:bg-slate-800/50 rounded-3xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap border border-gray-100 dark:border-white/5 shadow-sm">{selectedIncident.description}</div></div>

                    <div className="flex-1 flex flex-col border-t border-gray-100 dark:border-white/5 pt-6 min-h-[350px]">
                        <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 flex items-center tracking-widest"><MessageSquare className="h-3.5 w-3.5 mr-2" /> Main Courante & Discussion</h3>
                        <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl border border-gray-100 dark:border-white/5 p-4">
                            <Comments collectionName="incidents" documentId={selectedIncident.id} />
                        </div>
                    </div>
                </div></div></div></div></div>)}

            {/* Create/Edit Modal */}
            {showModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"><div className="bg-white dark:bg-slate-850 rounded-[2.5rem] shadow-2xl w-full max-w-3xl border border-white/20 overflow-hidden"><div className="p-8 border-b border-gray-100 dark:border-white/5 bg-red-50/30 dark:bg-red-900/10"><h2 className="text-2xl font-bold text-red-700 dark:text-red-400 flex items-center tracking-tight"><AlertTriangle className="h-6 w-6 mr-3" />{isEditing ? "Modifier l'incident" : "Déclarer un incident"}</h2><p className="text-sm text-red-600/70 dark:text-red-400/70 mt-1 ml-9">Le temps de réaction est critique. Soyez précis.</p></div><form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar"><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Titre de l'incident</label><input required type="text" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium" value={newIncident.title} onChange={e => setNewIncident({ ...newIncident, title: e.target.value })} placeholder="Ex: Attaque Ransomware sur Serveur RH" /></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Description détaillée</label><textarea required rows={4} className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium resize-none" value={newIncident.description} onChange={e => setNewIncident({ ...newIncident, description: e.target.value })} placeholder="Décrivez les faits, l'heure de découverte, les symptômes..." /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Catégorie (Playbook)</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.category} onChange={e => setNewIncident({ ...newIncident, category: e.target.value as any })}>{Object.keys(PLAYBOOKS).map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Sévérité</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.severity} onChange={e => setNewIncident({ ...newIncident, severity: e.target.value as any })}>{Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}</select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.status} onChange={e => setNewIncident({ ...newIncident, status: e.target.value as any })}>{['Nouveau', 'Analyse', 'Contenu', 'Résolu', 'Fermé'].map(s => <option key={s} value={s}>{s}</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Actif Impacté</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.affectedAssetId} onChange={e => setNewIncident({ ...newIncident, affectedAssetId: e.target.value })}><option value="">Aucun / Inconnu</option>{assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Lier à un Risque Identifié</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.relatedRiskId} onChange={e => setNewIncident({ ...newIncident, relatedRiskId: e.target.value })}><option value="">Non lié</option>{risks.map(r => <option key={r.id} value={r.id}>{r.threat} (Score: {r.score})</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Déclaré par</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.reporter} onChange={e => setNewIncident({ ...newIncident, reporter: e.target.value })}><option value="">Sélectionner...</option>{usersList.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Coût estimé (€)</label><input type="number" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium" value={newIncident.financialImpact || ''} onChange={e => setNewIncident({ ...newIncident, financialImpact: parseFloat(e.target.value) })} placeholder="0.00" /></div></div><div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5"><button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button><button type="submit" className="px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm shadow-lg shadow-red-500/20 hover:scale-105 transition-all">Enregistrer</button></div></form></div></div>)}
        </div>
    );
};
