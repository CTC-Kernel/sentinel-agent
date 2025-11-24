import React, { useEffect, useState, useRef } from 'react';
import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, where, limit, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Risk, Control, Asset, SystemLog, UserProfile, RiskHistory, Project } from '../types';
import { canEditResource } from '../utils/permissions';
import { Plus, Trash2, Edit, Search, CheckCircle2, ShieldAlert, Filter, Server, ArrowRight, History, X, LayoutDashboard, FileSpreadsheet, Upload, MessageSquare, Flame, Clock, TrendingUp, TrendingDown, Copy, RefreshCw, Download, CalendarDays, FolderKanban, Network } from '../components/ui/Icons';
import { RelationshipGraph } from '../components/RelationshipGraph';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { Comments } from '../components/ui/Comments';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { RiskDashboard } from '../components/risks/RiskDashboard';
import { RiskTemplateModal } from '../components/risks/RiskTemplateModal';
import { RiskTemplate, createRisksFromTemplate } from '../utils/riskTemplates';

const STANDARD_THREATS = ["Panne matérielle serveur", "Incendie", "Inondation", "Vol d'équipement", "Attaque par Ransomware", "Phishing / Ingénierie Sociale", "Erreur humaine / Configuration", "Divulgation non autorisée", "Interruption de service FAI", "Sabotage interne", "Obsolescence technologique", "Perte de personnel clé"];

export const Risks: React.FC = () => {
    const [risks, setRisks] = useState<Risk[]>([]);
    const [controls, setControls] = useState<Control[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [filter, setFilter] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');

    // Matrix Filter State
    const [matrixFilter, setMatrixFilter] = useState<{ p: number, i: number } | null>(null);

    const { user, addToast } = useStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canEdit = canEditResource(user, 'Risk');
    const [isEditing, setIsEditing] = useState(false);
    const [currentRiskId, setCurrentRiskId] = useState<string | null>(null);
    const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'details' | 'treatment' | 'dashboard' | 'projects' | 'history' | 'comments' | 'graph'>('details');
    const [linkedProjects, setLinkedProjects] = useState<Project[]>([]);
    const [riskHistory, setRiskHistory] = useState<SystemLog[]>([]);
    const [riskScoreHistory, setRiskScoreHistory] = useState<RiskHistory[]>([]);
    const [stats, setStats] = useState({ total: 0, critical: 0, mitigated: 0, reviewDue: 0 });
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [newRisk, setNewRisk] = useState<Partial<Risk>>({ assetId: '', threat: '', vulnerability: '', probability: 3, impact: 3, residualProbability: 3, residualImpact: 3, strategy: 'Atténuer', status: 'Ouvert', owner: '', mitigationControlIds: [] });

    const fetchData = async () => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'controls'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId)))
            ]);

            const getDocsData = <T,>(result: PromiseSettledResult<any>): T[] => {
                if (result.status === 'fulfilled') {
                    return result.value.docs.map((d: any) => ({ id: d.id, ...d.data() })) as T[];
                }
                return [];
            };

            const riskData = getDocsData<Risk>(results[0]);
            riskData.sort((a, b) => b.score - a.score);
            setRisks(riskData);

            const controlData = getDocsData<Control>(results[1]);
            controlData.sort((a, b) => a.code.localeCompare(b.code));
            setControls(controlData);

            const assetData = getDocsData<Asset>(results[2]);
            assetData.sort((a, b) => a.name.localeCompare(b.name));
            setAssets(assetData);

            const usersData = getDocsData<UserProfile>(results[3]);
            setUsersList(usersData);

            const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            setStats({
                total: riskData.length,
                critical: riskData.filter(r => r.score >= 15).length,
                mitigated: riskData.filter(r => (r.residualScore || r.score) < r.score).length,
                reviewDue: riskData.filter(r => !r.lastReviewDate || new Date(r.lastReviewDate) < oneYearAgo).length
            });
        } catch (err) {
            console.error(err);
            addToast("Erreur chargement données", "error");
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [user?.organizationId]);

    const openInspector = async (risk: Risk) => {
        setSelectedRisk(risk);
        setInspectorTab('details');
        try {
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user?.organizationId), limit(50));
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => d.data() as SystemLog);
            const relevantLogs = logs.filter(l => l.resource === 'Risk' && l.details?.includes(risk.threat));
            relevantLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setRiskHistory(relevantLogs);

            const hq = query(collection(db, 'risk_history'), where('riskId', '==', risk.id));
            const hSnap = await getDocs(hq);
            const historyData = hSnap.docs.map(d => ({ id: d.id, ...d.data() } as RiskHistory));
            historyData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setRiskScoreHistory(historyData);

            const projQ = query(collection(db, 'projects'), where('organizationId', '==', user?.organizationId), where('relatedRiskIds', 'array-contains', risk.id));
            getDocs(projQ).then(snap => { setLinkedProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project))); });
        } catch (e) { console.error(e); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit || !user?.organizationId) return;
        const score = (newRisk.probability || 1) * (newRisk.impact || 1);
        const residualScore = (newRisk.residualProbability || newRisk.probability || 1) * (newRisk.residualImpact || newRisk.impact || 1);

        try {
            if (isEditing && currentRiskId) {
                const oldRisk = risks.find(r => r.id === currentRiskId);
                const previousScore = oldRisk ? oldRisk.score : undefined;
                const { id: _id, ...dataToUpdate } = newRisk;
                if (oldRisk && oldRisk.score !== score) {
                    await addDoc(collection(db, 'risk_history'), {
                        riskId: currentRiskId,
                        organizationId: user.organizationId,
                        date: new Date().toISOString(),
                        previousScore: oldRisk.score,
                        newScore: score,
                        previousProbability: oldRisk.probability,
                        newProbability: newRisk.probability || 1,
                        previousImpact: oldRisk.impact,
                        newImpact: newRisk.impact || 1,
                        changedBy: user.email,
                        reason: 'Mise à jour du score'
                    });
                }

                await updateDoc(doc(db, 'risks', currentRiskId), { ...dataToUpdate, score, residualScore, previousScore });
                await logAction(user, 'UPDATE', 'Risk', `Modification risque: ${newRisk.threat}`);
                addToast("Risque mis à jour", "success");
                if (selectedRisk?.id === currentRiskId) setSelectedRisk({ ...selectedRisk, ...dataToUpdate, score, residualScore });
            } else {
                await addDoc(collection(db, 'risks'), {
                    ...newRisk,
                    organizationId: user.organizationId,
                    score,
                    residualScore,
                    previousScore: score,
                    createdAt: new Date().toISOString()
                });
                await logAction(user, 'CREATE', 'Risk', `Ajout risque: ${newRisk.threat}`);
                addToast("Risque ajouté", "success");
            }
            setShowModal(false);
            fetchData();
        } catch (error) { addToast("Erreur lors de l'enregistrement", "error"); }
    };

    const openModal = (risk?: Risk) => {
        if (!canEdit && !risk) return;
        if (risk) { setIsEditing(true); setCurrentRiskId(risk.id); setNewRisk({ ...risk, mitigationControlIds: risk.mitigationControlIds || [], residualProbability: risk.residualProbability || risk.probability, residualImpact: risk.residualImpact || risk.impact }); }
        else { setIsEditing(false); setCurrentRiskId(null); setNewRisk({ assetId: '', threat: '', vulnerability: '', probability: 3, impact: 3, residualProbability: 3, residualImpact: 3, strategy: 'Atténuer', status: 'Ouvert', owner: '', mitigationControlIds: [] }); }
        setShowModal(true);
    };

    const handleDuplicate = async () => {
        if (!selectedRisk || !canEdit || !user?.organizationId) return;
        try {
            const newRiskData = { ...selectedRisk, threat: `${selectedRisk.threat} (Copie)`, createdAt: new Date().toISOString() };
            const { id: _id, ...dataToUpdate } = newRiskData;
            const docRef = await addDoc(collection(db, 'risks'), { ...newRiskData, organizationId: user.organizationId });
            await logAction(user, 'CREATE', 'Risk', `Duplication Risque: ${newRiskData.threat}`);
            addToast("Risque dupliqué", "success");
            fetchData();
        } catch (e) { addToast("Erreur duplication", "error"); }
    };

    const initiateDelete = async (id: string, threat: string) => {
        if (!canEdit) return;
        const incQ = query(collection(db, 'incidents'), where('organizationId', '==', user?.organizationId), where('relatedRiskId', '==', id));
        const projQ = query(collection(db, 'projects'), where('organizationId', '==', user?.organizationId));

        try {
            const [incSnap, projSnap] = await Promise.all([getDocs(incQ), getDocs(projQ)]);
            const linkedProjects = projSnap.docs.filter(d => d.data().relatedRiskIds?.includes(id));

            if (!incSnap.empty || linkedProjects.length > 0) {
                addToast(`Impossible de supprimer : Lié à ${incSnap.size} incidents et ${linkedProjects.length} projets.`, "error");
                return;
            }
            setConfirmData({ isOpen: true, title: "Supprimer le risque ?", message: `Cette action est irréversible.`, onConfirm: () => handleDeleteRisk(id, threat) });
        } catch (e) { addToast("Erreur vérification dépendances", "error"); }
    };

    const handleDeleteRisk = async (id: string, threat: string) => {
        try {
            await deleteDoc(doc(db, 'risks', id));
            await logAction(user, 'DELETE', 'Risk', `Suppression risque: ${threat}`);
            setRisks(prev => prev.filter(r => r.id !== id));
            if (selectedRisk?.id === id) setSelectedRisk(null);
            addToast("Risque supprimé", "info");
            fetchData();
        } catch (e) { addToast("Erreur suppression", "error"); }
    };

    const handleStatusChange = async (risk: Risk, newStatus: Risk['status']) => {
        if (!canEdit) return;
        try {
            await updateDoc(doc(db, 'risks', risk.id), { status: newStatus });
            await logAction(user, 'UPDATE', 'Risk', `Statut risque changé vers ${newStatus}`);
            setRisks(prev => prev.map(r => r.id === risk.id ? { ...r, status: newStatus } : r));
            if (selectedRisk?.id === risk.id) setSelectedRisk({ ...selectedRisk, status: newStatus });
            addToast(`Statut changé`, "success");
        } catch (e) { console.error(e); addToast("Erreur changement statut", "error"); }
    };

    const handleReview = async () => {
        if (!canEdit || !selectedRisk) return;
        const today = new Date().toISOString();
        try {
            await updateDoc(doc(db, 'risks', selectedRisk.id), { lastReviewDate: today });
            await logAction(user, 'REVIEW', 'Risk', `Revue validée: ${selectedRisk.threat}`);
            setRisks(prev => prev.map(r => r.id === selectedRisk.id ? { ...r, lastReviewDate: today } : r));
            setSelectedRisk({ ...selectedRisk, lastReviewDate: today });
            addToast("Revue du risque validée", "success");
            fetchData();
        } catch (e) { addToast("Erreur validation revue", "error"); }
    };

    const handleImportTemplate = async (template: RiskTemplate, owner: string) => {
        if (!canEdit || !user?.organizationId) return;
        try {
            const risksToImport = createRisksFromTemplate(template, user.organizationId, owner);

            const batch = writeBatch(db);
            risksToImport.forEach(risk => {
                const newRiskRef = doc(collection(db, 'risks'));
                batch.set(newRiskRef, risk);
            });

            await batch.commit();
            await logAction(user, 'CREATE', 'Risk', `Import de ${risksToImport.length} risques depuis template ${template.name}`);
            addToast(`${risksToImport.length} risques importés avec succès`, "success");
            setShowTemplateModal(false);
            fetchData();
        } catch (e) {
            console.error(e);
            addToast("Erreur lors de l'import des risques", "error");
        }
    };

    const toggleControlSelection = (controlId: string) => {
        const currentIds = newRisk.mitigationControlIds || [];
        if (currentIds.includes(controlId)) { setNewRisk({ ...newRisk, mitigationControlIds: currentIds.filter(id => id !== controlId) }); }
        else { setNewRisk({ ...newRisk, mitigationControlIds: [...currentIds, controlId] }); }
    };

    const handleExportCSV = () => {
        const headers = ["Menace", "Vulnérabilité", "Actif", "Score Brut", "Score Résiduel", "Stratégie", "Statut", "Propriétaire"];
        const rows = filteredRisks.map(r => [r.threat, r.vulnerability, getAssetName(r.assetId), r.score.toString(), (r.residualScore || r.score).toString(), r.strategy, r.status, r.owner || '']);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })); link.download = `risks.csv`; link.click();
    };

    const generateRTP = () => {
        const doc = new jsPDF();
        doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
        doc.setFontSize(18); doc.setTextColor(255, 255, 255); doc.text("Plan de Traitement des Risques (RTP)", 14, 25);
        doc.setFontSize(10); doc.text(`ISO 27001 | ${new Date().toLocaleDateString()} | Cyber Threat Consulting`, 14, 32);
        const data = filteredRisks.map(r => [r.threat, r.score.toString(), r.strategy, r.status, (r.residualScore || r.score).toString()]);
        (doc as any).autoTable({ startY: 50, head: [['Menace', 'Brut', 'Stratégie', 'Statut', 'Résiduel']], body: data, theme: 'striped', headStyles: { fillColor: [59, 130, 246] } });
        doc.save('RTP.pdf');
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!canEdit || !user?.organizationId) return;
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) return;
            const lines = text.split('\n').slice(1).filter(line => line.trim() !== '');
            if (lines.length === 0) { addToast("Fichier CSV vide", "error"); return; }
            setLoading(true);
            try {
                const batch = writeBatch(db);
                let count = 0;
                lines.forEach(line => {
                    const cols = line.split(',');
                    if (cols.length >= 3) {
                        const newRef = doc(collection(db, 'risks'));
                        const prob = parseInt(cols[3]?.trim()) || 3;
                        const imp = parseInt(cols[4]?.trim()) || 3;
                        batch.set(newRef, {
                            organizationId: user.organizationId,
                            threat: cols[0]?.trim() || 'Menace importée',
                            vulnerability: cols[1]?.trim() || '',
                            assetId: '',
                            probability: prob as any,
                            impact: imp as any,
                            score: prob * imp,
                            residualScore: prob * imp,
                            strategy: 'Atténuer',
                            status: 'Ouvert',
                            owner: '',
                            createdAt: new Date().toISOString()
                        });
                        count++;
                    }
                });
                await batch.commit();
                await logAction(user, 'IMPORT', 'Risk', `Import CSV de ${count} risques`);
                addToast(`${count} risques importés`, "success");
                fetchData();
            } catch (error) { addToast("Erreur import CSV", "error"); } finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
        };
        reader.readAsText(file);
    };

    const getAssetName = (id?: string) => assets.find(a => a.id === id)?.name || 'Actif inconnu';

    const filteredRisks = risks.filter(r => {
        const matchesSearch = r.threat.toLowerCase().includes(filter.toLowerCase()) || r.vulnerability.toLowerCase().includes(filter.toLowerCase());
        // Matrix filtering logic: Only show if no filter set OR if matches specific probability AND impact
        const matchesMatrix = matrixFilter ? (r.probability === matrixFilter.p && r.impact === matrixFilter.i) : true;
        return matchesSearch && matchesMatrix;
    });

    const getRisksForCell = (prob: number, impact: number) => risks.filter(r => r.probability === prob && r.impact === impact);

    const getCellColor = (prob: number, impact: number) => { const score = prob * impact; if (score >= 15) return 'bg-rose-500 shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]'; if (score >= 10) return 'bg-orange-500 shadow-[inset_0_0_10px_rgba(0,0,0,0.1)]'; if (score >= 5) return 'bg-amber-400'; return 'bg-emerald-500'; };

    const getRiskLevel = (score: number) => { if (score >= 15) return { label: 'Critique', color: 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 border-rose-400' }; if (score >= 10) return { label: 'Élevé', color: 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 border-orange-400' }; if (score >= 5) return { label: 'Moyen', color: 'bg-amber-400 text-white shadow-lg shadow-amber-400/30 border-amber-300' }; return { label: 'Faible', color: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border-emerald-400' }; };

    return (
        <div className="space-y-6 relative">
            <RiskTemplateModal
                isOpen={showTemplateModal}
                onClose={() => setShowTemplateModal(false)}
                onSelectTemplate={handleImportTemplate}
                owners={usersList.map(u => u.displayName || u.email)}
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestion des Risques</h1>
                    <p className="text-slate-500 dark:text-slate-400">Analyse et traitement des risques selon ISO 27005.</p>
                </div>
                {canEdit && (
                    <div className="flex gap-2">
                        <button onClick={() => setShowTemplateModal(true)} className="flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20">
                            <Download className="h-4 w-4 mr-2" />
                            Importer Template
                        </button>
                        <button onClick={() => openModal()} className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20">
                            <Plus className="h-4 w-4 mr-2" />
                            Nouveau Risque
                        </button>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Risques</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p></div><div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600"><ShieldAlert className="h-6 w-6" /></div></div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">Critiques / Élevés</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.critical}</p></div><div className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600"><Flame className="h-6 w-6" /></div></div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">Atténués</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.mitigated}</p></div><div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"><TrendingUp className="h-6 w-6" /></div></div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-1">Revues en retard</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.reviewDue}</p></div><div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600"><Clock className="h-6 w-6" /></div></div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex items-center space-x-4 glass-panel p-1.5 pl-4 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all flex-1 border border-slate-200 dark:border-white/5"><Search className="h-5 w-5 text-gray-400" /><input type="text" placeholder="Rechercher une menace ou une vulnérabilité..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400" value={filter} onChange={e => setFilter(e.target.value)} /></div>
                <div className="flex gap-2">
                    <button onClick={generateRTP} className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-sm text-slate-700 dark:text-white"><Download className="h-4 w-4 mr-2" /> RTP (PDF)</button>
                    <button onClick={handleExportCSV} className="p-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm"><FileSpreadsheet className="h-4 w-4" /></button>
                    <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ml-2"><button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Liste</button><button onClick={() => setViewMode('matrix')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${viewMode === 'matrix' ? 'bg-slate-900 text-white dark:bg-white dark:text-black shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}><LayoutDashboard className="h-4 w-4 mr-2" /> Matrice</button></div>
                </div>
            </div>

            {/* Filter Feedback */}
            {matrixFilter && (
                <div className="flex items-center justify-between bg-brand-50 dark:bg-brand-900/20 p-4 rounded-2xl border border-brand-100 dark:border-brand-900/30 animate-slide-up shadow-sm">
                    <div className="flex items-center gap-3">
                        <Filter className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                        <span className="text-sm font-bold text-brand-900 dark:text-brand-100">
                            Filtrage actif : <span className="bg-white dark:bg-black/20 px-2 py-0.5 rounded-lg shadow-sm">Probabilité {matrixFilter.p}</span> × <span className="bg-white dark:bg-black/20 px-2 py-0.5 rounded-lg shadow-sm">Impact {matrixFilter.i}</span>
                        </span>
                    </div>
                    <button onClick={() => setMatrixFilter(null)} className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center bg-white dark:bg-black/20 px-3 py-1.5 rounded-lg shadow-sm transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"><RefreshCw className="h-3 w-3 mr-1.5" /> Réinitialiser</button>
                </div>
            )}

            {viewMode === 'matrix' ? (
                <div className="glass-panel p-8 rounded-[2.5rem] shadow-xl overflow-x-auto animate-fade-in border border-white/50 dark:border-white/5">
                    <div className="min-w-[700px]">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Matrice de Criticité</h3>
                            <div className="flex gap-2 text-xs font-medium">
                                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-rose-500 mr-2"></span>Critique</span>
                                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-2"></span>Élevé</span>
                                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-amber-400 mr-2"></span>Moyen</span>
                                <span className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span>Faible</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-6">
                            <div className="flex items-center justify-center -rotate-90 font-bold text-xs text-slate-400 uppercase tracking-widest h-[500px] w-8">Probabilité</div>
                            <div className="grid grid-rows-5 grid-cols-5 gap-3 h-[500px]">
                                {[5, 4, 3, 2, 1].map(prob => (
                                    <React.Fragment key={prob}>
                                        {[1, 2, 3, 4, 5].map(impact => {
                                            const cellRisks = getRisksForCell(prob, impact);
                                            const hasRisks = cellRisks.length > 0;
                                            const isSelected = matrixFilter?.p === prob && matrixFilter?.i === impact;

                                            return (
                                                <div
                                                    key={`${prob}-${impact}`}
                                                    onClick={() => hasRisks && setMatrixFilter(isSelected ? null : { p: prob, i: impact })}
                                                    className={`
                                                  relative rounded-2xl flex items-center justify-center transition-all duration-300 border cursor-pointer border-white/20 dark:border-black/10 group
                                                  ${getCellColor(prob, impact)}
                                                  ${hasRisks ? 'hover:scale-[1.02] hover:z-10 hover:shadow-xl cursor-pointer' : 'opacity-40 scale-95 grayscale cursor-default'}
                                                  ${isSelected ? 'ring-4 ring-slate-900 dark:ring-white scale-[1.05] z-20 shadow-2xl opacity-100 animate-pulse' : matrixFilter && hasRisks ? 'opacity-40' : ''}
                                              `}
                                                    title={`Prob: ${prob}, Impact: ${impact}, Risques: ${cellRisks.length}`}
                                                >
                                                    {hasRisks && (
                                                        <>
                                                            <span className="text-3xl font-black text-white drop-shadow-md">{cellRisks.length}</span>
                                                            <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                        </>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-6 mt-4">
                            <div className="w-8"></div>
                            <div className="text-center font-bold text-xs text-slate-400 uppercase tracking-widest">Impact</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 animate-fade-in">
                    {loading ? (
                        <div className="col-span-full"><CardSkeleton count={3} /></div>
                    ) : filteredRisks.length === 0 ? (
                        <div className="col-span-full">
                            <EmptyState
                                icon={ShieldAlert}
                                title="Aucun risque identifié"
                                description={filter ? "Aucun risque ne correspond à votre recherche." : "Identifiez et évaluez les risques pour protéger votre organisation."}
                                actionLabel={filter ? undefined : "Nouveau Risque"}
                                onAction={filter ? undefined : () => openModal()}
                            />
                        </div>
                    ) : filteredRisks.map(risk => {
                        const level = getRiskLevel(risk.score);
                        const residualScore = risk.residualScore || risk.score;
                        const isMitigated = residualScore < risk.score;
                        const trend = risk.previousScore && risk.score > risk.previousScore ? 'up' : risk.previousScore && risk.score < risk.previousScore ? 'down' : 'stable';

                        return (
                            <div key={risk.id} onClick={() => openInspector(risk)} className="group glass-panel p-6 rounded-[2rem] hover:shadow-apple transition-all duration-300 hover:-translate-y-1 flex flex-col h-full relative cursor-pointer border border-white/50 dark:border-white/5">
                                <div className="flex justify-between items-start mb-5">
                                    <div className="flex items-center gap-2">
                                        <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm flex items-center border ${level.color}`}>{level.label} {risk.score}</div>
                                        {trend === 'up' && <span className="text-red-500" title="En hausse"><TrendingUp className="h-4 w-4" /></span>}
                                        {trend === 'down' && <span className="text-emerald-500" title="En baisse"><TrendingDown className="h-4 w-4" /></span>}
                                        {isMitigated && (<><ArrowRight className="w-3 h-3 text-gray-400" /><div className="px-2.5 py-1 text-[10px] font-bold rounded-full border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800">Résiduel: {residualScore}</div></>)}
                                    </div>
                                </div>
                                <div className="mb-4 flex-1">
                                    <div className="flex items-center mb-3">
                                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 mr-2.5"><Server className="w-3.5 h-3.5" /></div>
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{getAssetName(risk.assetId)}</span>
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-snug mb-2 line-clamp-2">{risk.threat}</h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-900/50 p-3 rounded-xl inline-block w-full border border-slate-100 dark:border-white/5">
                                        <span className="font-bold text-xs uppercase text-slate-400 block mb-1">Vulnérabilité</span>{risk.vulnerability}
                                    </p>
                                </div>
                                <div className="space-y-3 pt-4 border-t border-dashed border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">{risk.strategy}</span>
                                        <span className={`text-xs font-bold ${risk.status === 'Ouvert' ? 'text-rose-500' : risk.status === 'En cours' ? 'text-amber-500' : 'text-emerald-500'}`}>{risk.status}</span>
                                    </div>
                                </div>
                            </div>)
                    })}</div>
            )}

            {/* Inspector */}
            {selectedRisk && (
                <div className="fixed inset-0 z-[100] overflow-hidden"><div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setSelectedRisk(null)} /><div className="absolute inset-y-0 right-0 sm:pl-10 max-w-full flex pointer-events-none"><div className="w-screen max-w-2xl pointer-events-auto"><div className="h-full flex flex-col bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-slide-up"><div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-start justify-between bg-white/50 dark:bg-white/5"><div><h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">{selectedRisk.threat}</h2><p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2"><Server className="h-3.5 w-3.5" /> {getAssetName(selectedRisk.assetId)}</p></div><div className="flex gap-2">{canEdit && (<><button onClick={handleDuplicate} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Dupliquer"><Copy className="h-5 w-5" /></button><button onClick={() => openModal(selectedRisk)} className="p-2.5 text-gray-500 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button><button onClick={() => initiateDelete(selectedRisk.id, selectedRisk.threat)} className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button></>)}<button onClick={() => setSelectedRisk(null)} className="p-2.5 text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"><X className="h-5 w-5" /></button></div></div>
                    <div className="px-8 border-b border-slate-200 dark:border-white/5 flex gap-8 overflow-x-auto no-scrollbar bg-white dark:bg-transparent">
                        {[{ id: 'details', label: 'Détails', icon: ShieldAlert }, { id: 'treatment', label: 'Traitement', icon: CheckCircle2 }, { id: 'projects', label: 'Projets', icon: FolderKanban }, { id: 'history', label: 'Historique', icon: History }, { id: 'comments', label: 'Discussion', icon: MessageSquare }, { id: 'graph', label: 'Graphe', icon: Network }].map(tab => (
                            <button key={tab.id} onClick={() => setInspectorTab(tab.id as any)} className={`py-4 text-sm font-bold flex items-center border-b-2 transition-all ${inspectorTab === tab.id ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                <tab.icon className={`h-4 w-4 mr-2.5 ${inspectorTab === tab.id ? 'text-brand-500' : 'opacity-70'}`} />
                                {tab.label}
                            </button>
                        ))}
                    </div><div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">{inspectorTab === 'details' && (<div className="space-y-8"><div className="grid grid-cols-2 gap-6"><div className="p-6 bg-red-50/80 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30 shadow-sm"><h4 className="text-xs font-bold uppercase tracking-widest text-red-600/80 mb-4">Risque Brut</h4><div className="text-5xl font-black text-slate-900 dark:text-white mb-2">{selectedRisk.score}</div><div className="text-xs font-medium text-slate-500">Prob: {selectedRisk.probability} × Impact: {selectedRisk.impact}</div></div><div className="p-6 bg-emerald-50/80 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm"><h4 className="text-xs font-bold uppercase tracking-widest text-emerald-600/80 mb-4">Risque Résiduel</h4><div className="text-5xl font-black text-slate-900 dark:text-white mb-2">{selectedRisk.residualScore || selectedRisk.score}</div><div className="text-xs font-medium text-slate-500">Prob: {selectedRisk.residualProbability || selectedRisk.probability} × Impact: {selectedRisk.residualImpact || selectedRisk.impact}</div></div></div><div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm"><h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Stratégie de Traitement</h4><div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{selectedRisk.strategy}</div></div>
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Propriétaire</h4>
                            <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{selectedRisk.owner || 'Non assigné'}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm"><h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Statut Actuel</h4><div className="flex justify-between items-center">{canEdit ? (<div className="flex gap-3">{['Ouvert', 'En cours', 'Fermé'].map(s => (<button key={s} onClick={() => handleStatusChange(selectedRisk, s as any)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${selectedRisk.status === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-md' : 'bg-transparent border-gray-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-gray-50'}`}>{s}</button>))}</div>) : <span className="px-4 py-2 bg-gray-100 dark:bg-slate-700 rounded-xl text-sm font-bold">{selectedRisk.status}</span>}{canEdit && (<button onClick={handleReview} className="flex items-center px-4 py-2 text-xs font-bold bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors"><CalendarDays className="h-3.5 w-3.5 mr-2" /> Valider la revue</button>)}</div>{selectedRisk.lastReviewDate && (<p className="text-xs text-slate-400 mt-3 text-right">Dernière revue le : {new Date(selectedRisk.lastReviewDate).toLocaleDateString()}</p>)}</div></div>)}                        {inspectorTab === 'treatment' && (
                            <div className="space-y-6"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Mesures de sécurité (Contrôles ISO)</h3><span className="text-xs font-medium bg-brand-50 dark:bg-brand-900/20 text-brand-600 px-2.5 py-1 rounded-full">{selectedRisk.mitigationControlIds?.length || 0} mesures</span></div>{selectedRisk.mitigationControlIds && selectedRisk.mitigationControlIds.length > 0 ? (<div className="space-y-3">{selectedRisk.mitigationControlIds.map(cid => { const ctrl = controls.find(c => c.id === cid); return ctrl ? (<div key={cid} className="flex items-start p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all"><div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-xl mr-4 text-green-600"><CheckCircle2 className="h-5 w-5" /></div><div><div className="font-bold text-sm text-slate-900 dark:text-white mb-1">{ctrl.code}</div><div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{ctrl.name}</div></div></div>) : null; })}</div>) : (<div className="text-center py-12 text-gray-400 bg-white dark:bg-slate-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-white/10"><ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />Aucun contrôle d'atténuation lié.</div>)}</div>
                        )}

                        {inspectorTab === 'dashboard' && (
                            <div className="space-y-6">
                                <RiskDashboard risks={[selectedRisk]} />
                            </div>
                        )}

                        {inspectorTab === 'projects' && (
                            <div className="space-y-8">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center"><FolderKanban className="h-4 w-4 mr-2" /> Projets de Traitement ({linkedProjects.length})</h3>
                                {linkedProjects.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun projet associé à ce risque.</p>
                                ) : (
                                    <div className="grid gap-4">
                                        {linkedProjects.map(proj => (
                                            <div key={proj.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{proj.name}</span>
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${proj.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{proj.status}</span>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{proj.description}</p>
                                                <div className="flex items-center justify-between">
                                                    <div className="w-full bg-slate-200 rounded-full h-1.5 mr-4 max-w-[100px]">
                                                        <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${proj.progress}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{proj.progress}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {inspectorTab === 'graph' && (
                            <div className="h-[500px]">
                                <RelationshipGraph rootId={selectedRisk.id} rootType="Risk" />
                            </div>
                        )}

                        {inspectorTab === 'history' && (<div className="space-y-8"><div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2"><h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Évolution du Score</h4>{riskScoreHistory.length === 0 ? <p className="text-sm text-gray-400 italic">Aucun changement de score enregistré.</p> : riskScoreHistory.map((h, i) => (<div key={i} className="relative"><span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900"><div className="h-2 w-2 rounded-full bg-blue-500"></div></span><div><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{new Date(h.date).toLocaleString()}</span><div className="flex items-center gap-2 mt-1"><span className="text-sm font-bold text-slate-500">Score:</span><span className="text-sm font-bold text-slate-900 dark:text-white">{h.previousScore} ➔ {h.newScore}</span></div><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Par: {h.changedBy}</p></div></div>))}</div><div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2"><h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Journal d'Audit</h4>{riskHistory.map((log, i) => (<div key={i} className="relative"><span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-brand-900"><div className="h-2 w-2 rounded-full bg-brand-500"></div></span><div><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span><p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.details}</p><div className="mt-2 inline-flex items-center px-2 py-1 rounded-lg bg-gray-50 dark:bg-white/5 text-[10px] font-medium text-gray-500">{log.userEmail}</div></div></div>))}</div></div>)}{inspectorTab === 'comments' && (<div className="h-full flex flex-col"><Comments collectionName="risks" documentId={selectedRisk.id} /></div>)}</div></div></div></div></div>
            )}

            {/* Create/Edit Modal */}
            {showModal && canEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] shadow-2xl w-full max-w-3xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-slate-900/50">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{isEditing ? 'Modifier le risque' : 'Nouveau Risque'}</h2>
                            <p className="text-sm text-slate-500 mt-1">Définissez la menace, la vulnérabilité et les impacts.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar">
                            {/* Inputs */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Actif concerné</label><div className="relative"><select required className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-brand-500 dark:text-white transition-all outline-none appearance-none font-medium" value={newRisk.assetId} onChange={e => setNewRisk({ ...newRisk, assetId: e.target.value })}><option value="">Sélectionner un actif...</option>{assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select><div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400"><ArrowRight className="h-4 w-4 rotate-90" /></div></div></div>
                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Menace</label><div className="relative"><input list="threatsList" required className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-brand-500 dark:text-white font-medium outline-none" value={newRisk.threat} onChange={e => setNewRisk({ ...newRisk, threat: e.target.value })} placeholder="Ex: Incendie, Ransomware..." /><datalist id="threatsList">{STANDARD_THREATS.map(t => <option key={t} value={t} />)}</datalist></div></div>
                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Vulnérabilité</label><textarea required rows={3} className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-brand-500 dark:text-white font-medium outline-none resize-none" value={newRisk.vulnerability} onChange={e => setNewRisk({ ...newRisk, vulnerability: e.target.value })} placeholder="Ex: Absence de patch, Mots de passe faibles..." /></div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Propriétaire</label>
                                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-brand-500 dark:text-white outline-none appearance-none font-medium" value={newRisk.owner} onChange={e => setNewRisk({ ...newRisk, owner: e.target.value })}>
                                                <option value="">Non assigné</option>
                                                {usersList.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Stratégie</label>
                                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-brand-500 dark:text-white outline-none appearance-none font-medium" value={newRisk.strategy} onChange={e => setNewRisk({ ...newRisk, strategy: e.target.value as any })}>
                                                <option value="Atténuer">Atténuer</option>
                                                <option value="Accepter">Accepter</option>
                                                <option value="Transférer">Transférer</option>
                                                <option value="Éviter">Éviter</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-red-50/80 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30"><h4 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-4">Risque Brut</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Probabilité</label><input type="number" min="1" max="5" className="w-full px-3 py-2 rounded-xl border-transparent bg-white dark:bg-black/20 text-lg font-bold text-center shadow-sm" value={newRisk.probability} onChange={e => setNewRisk({ ...newRisk, probability: parseInt(e.target.value) as any })} /></div><div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Impact</label><input type="number" min="1" max="5" className="w-full px-3 py-2 rounded-xl border-transparent bg-white dark:bg-black/20 text-lg font-bold text-center shadow-sm" value={newRisk.impact} onChange={e => setNewRisk({ ...newRisk, impact: parseInt(e.target.value) as any })} /></div></div></div>
                                    <div className="p-6 bg-emerald-50/80 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/30"><h4 className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-4">Risque Résiduel</h4><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Probabilité</label><input type="number" min="1" max="5" className="w-full px-3 py-2 rounded-xl border-transparent bg-white dark:bg-black/20 text-lg font-bold text-center shadow-sm" value={newRisk.residualProbability || newRisk.probability} onChange={e => setNewRisk({ ...newRisk, residualProbability: parseInt(e.target.value) as any })} /></div><div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Impact</label><input type="number" min="1" max="5" className="w-full px-3 py-2 rounded-xl border-transparent bg-white dark:bg-black/20 text-lg font-bold text-center shadow-sm" value={newRisk.residualImpact || newRisk.impact} onChange={e => setNewRisk({ ...newRisk, residualImpact: parseInt(e.target.value) as any })} /></div></div></div>
                                </div>

                                <div className="bg-slate-50/80 dark:bg-slate-900/30 rounded-3xl p-6 border border-gray-100 dark:border-white/5 flex flex-col h-full"><label className="flex items-center text-xs font-bold uppercase tracking-widest text-brand-600 mb-4"><CheckCircle2 className="h-4 w-4 mr-2" /> Contrôles d'atténuation</label><div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar max-h-[400px]">{controls.map(ctrl => (<label key={ctrl.id} className={`flex items-start space-x-3 p-3.5 rounded-xl cursor-pointer transition-all border ${newRisk.mitigationControlIds?.includes(ctrl.id) ? 'bg-white dark:bg-slate-800 border-brand-200 dark:border-brand-800 shadow-md' : 'border-transparent hover:bg-white dark:hover:bg-slate-800'}`}><div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${newRisk.mitigationControlIds?.includes(ctrl.id) ? 'bg-brand-500 border-brand-500' : 'border-gray-300 bg-white dark:bg-black/20'}`}>{newRisk.mitigationControlIds?.includes(ctrl.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}</div><input type="checkbox" className="hidden" checked={newRisk.mitigationControlIds?.includes(ctrl.id)} onChange={() => toggleControlSelection(ctrl.id)} /><div><span className="text-xs font-bold text-slate-900 dark:text-white block mb-0.5">{ctrl.code}</span><span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug block">{ctrl.name}</span></div></label>))}</div></div>
                            </div>
                            <div className="flex justify-end space-x-4 pt-8 mt-4 border-t border-gray-100 dark:border-white/5"><button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button><button type="submit" className="px-8 py-3 text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform shadow-xl shadow-slate-900/20 dark:shadow-none">{isEditing ? 'Enregistrer les modifications' : 'Créer le Risque'}</button></div></form>
                    </div>
                </div>
            )}
        </div>
    );
};
