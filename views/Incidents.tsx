
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Incident, Asset, Criticality, Risk, UserProfile } from '../types';
import { IncidentDashboard } from '../components/incidents/IncidentDashboard';
import { IncidentTimeline } from '../components/incidents/IncidentTimeline';
import { IncidentPlaybookModal } from '../components/incidents/IncidentPlaybookModal';
import { Search, Siren, Trash2, Edit, AlertTriangle, Server, FileSpreadsheet, X, MessageSquare, Download, ListTodo, Clock, Activity, CheckCircle2, Euro } from '../components/ui/Icons';
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
import { OnboardingService } from '../services/onboardingService';
import { HelpCircle } from '../components/ui/Icons';

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
        } catch (_err) {
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
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

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
        } catch (error) { addToast("Erreur enregistrement", "error"); }
    };

    const initiateDelete = (id: string) => { setConfirmData({ isOpen: true, title: "Supprimer l'incident ?", message: "Cette action est définitive.", onConfirm: () => handleDelete(id) }); };
    const handleDelete = async (id: string) => { try { await deleteDoc(doc(db, 'incidents', id)); setIncidents(prev => prev.filter(i => i.id !== id)); if (selectedIncident?.id === id) setSelectedIncident(null); addToast("Incident supprimé", "info"); fetchData(); } catch (error) { addToast("Erreur suppression", "error"); } };
    const togglePlaybookStep = async (step: string) => { if (!selectedIncident) return; const isCompleted = selectedIncident.playbookStepsCompleted?.includes(step); try { await updateDoc(doc(db, 'incidents', selectedIncident.id), { playbookStepsCompleted: isCompleted ? arrayRemove(step) : arrayUnion(step) }); const updatedList = isCompleted ? (selectedIncident.playbookStepsCompleted || []).filter(s => s !== step) : [...(selectedIncident.playbookStepsCompleted || []), step]; setSelectedIncident({ ...selectedIncident, playbookStepsCompleted: updatedList }); } catch (error) { console.error(error); addToast("Erreur mise à jour playbook", "error"); } };

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
            <IncidentDashboard
                incidents={incidents}
                onCreate={() => openModal()}
                onSelect={(inc: Incident) => setSelectedIncident(inc)}
            />

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
                ) : filteredIncidents.map(incident => (<div key={incident.id} onClick={() => setSelectedIncident(incident)} className="glass-panel rounded-[2.5rem] p-7 shadow-sm card-hover flex flex-col relative overflow-hidden cursor-pointer group border border-white/50 dark:border-white/5">{incident.severity === Criticality.CRITICAL && (<div className="absolute top-6 right-6"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span></div>)}<div className="flex justify-between items-start mb-4"><div className="flex gap-2"><span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getSeverityColor(incident.severity)}`}>{incident.severity}</span><span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getStatusColor(incident.status)}`}>{incident.status}</span></div></div><h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-600 transition-colors leading-tight">{incident.title}</h3><p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 leading-relaxed">{incident.description}</p><div className="flex gap-3 flex-wrap mb-6"><div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg"><ListTodo className="h-3.5 w-3.5 mr-2 text-slate-400" />{incident.category || 'Autre'}</div>{incident.affectedAssetId && (<div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg"><Server className="h-3.5 w-3.5 mr-2 text-slate-400" />{assets.find(a => a.id === incident.affectedAssetId)?.name || 'Inconnu'}</div>)}</div><div className="flex items-center justify-between pt-5 border-t border-dashed border-gray-200 dark:border-white/10 mt-auto"><div className="text-xs font-medium text-slate-400">{new Date(incident.dateReported).toLocaleDateString()} • {incident.reporter}</div><div className="text-xs text-brand-600 font-bold flex items-center group-hover:translate-x-1 transition-transform">Ouvrir le dossier <Siren className="ml-1.5 h-3.5 w-3.5" /></div></div></div>))}
            </div>

            import {createPortal} from 'react-dom';

            // ... (imports remain the same, just adding createPortal to the top or ensuring it's available)
            // Actually, I'll just add the import in a separate block or use multi_replace if I can't do it in one go.
            // replace_file_content is for a SINGLE contiguous block.
            // Adding an import and wrapping code at the bottom are two separate edits.
            // So I should use multi_replace_file_content.


            {/* Create/Edit Modal */}
            <IncidentPlaybookModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={isEditing ? "Modifier l'incident" : "Déclarer un incident"}
            >
                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar">
                    {/* Form fields remain unchanged */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Titre de l'incident</label>
                        <input required type="text" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium" value={newIncident.title} onChange={e => setNewIncident({ ...newIncident, title: e.target.value })} placeholder="Ex: Attaque Ransomware sur Serveur RH" />
                    </div>
                    {/* (All other form sections from the original modal are copied here unchanged) */}
                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Description détaillée</label><textarea required rows={4} className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium resize-none" value={newIncident.description} onChange={e => setNewIncident({ ...newIncident, description: e.target.value })} placeholder="Décrivez les faits, l'heure de découverte, les symptômes..." /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Catégorie (Playbook)</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.category} onChange={e => setNewIncident({ ...newIncident, category: e.target.value as any })}>{Object.keys(PLAYBOOKS).map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Sévérité</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.severity} onChange={e => setNewIncident({ ...newIncident, severity: e.target.value as any })}>{Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}</select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.status} onChange={e => setNewIncident({ ...newIncident, status: e.target.value as any })}>{['Nouveau', 'Analyse', 'Contenu', 'Résolu', 'Fermé'].map(s => <option key={s} value={s}>{s}</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Actif Impacté</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.affectedAssetId} onChange={e => setNewIncident({ ...newIncident, affectedAssetId: e.target.value })}><option value="">Aucun / Inconnu</option>{assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Lier à un Risque Identifié</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.relatedRiskId} onChange={e => setNewIncident({ ...newIncident, relatedRiskId: e.target.value })}><option value="">Non lié</option>{risks.map(r => <option key={r.id} value={r.id}>{r.threat} (Score: {r.score})</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Déclaré par</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none" value={newIncident.reporter} onChange={e => setNewIncident({ ...newIncident, reporter: e.target.value })}><option value="">Sélectionner...</option>{usersList.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}</select></div><div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Coût estimé (€)</label><input type="number" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium" value={newIncident.financialImpact || ''} onChange={e => setNewIncident({ ...newIncident, financialImpact: parseFloat(e.target.value) })} placeholder="0.00" /></div></div><div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm shadow-lg shadow-red-500/20 hover:scale-105 transition-all">Enregistrer</button>
                    </div>
                </form>
            </IncidentPlaybookModal>
        </div>
    );
};
