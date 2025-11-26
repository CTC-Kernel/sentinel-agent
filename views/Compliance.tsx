import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs, doc, updateDoc, writeBatch, arrayUnion, query, where, QuerySnapshot, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Control, Document, Risk, Finding } from '../types';
import { FileText, AlertTriangle, Download, Paperclip, Link, ExternalLink, ShieldAlert, AlertOctagon, Search, X, Save, File, ShieldCheck, Plus, ChevronRight, Filter, ChevronDown, ArrowRight } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ComplianceDashboard } from '../components/compliance/ComplianceDashboard';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';

import { ISO_DOMAINS, ISO_SEED_CONTROLS, NIS2_DOMAINS, NIS2_SEED_CONTROLS } from '../data/complianceData';

export const Compliance: React.FC = () => {
    const [controls, setControls] = useState<Control[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [findings, setFindings] = useState<Finding[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, addToast } = useStore();

    const canEdit = user?.role === 'admin' || user?.role === 'auditor';

    // UI State
    const [selectedControl, setSelectedControl] = useState<Control | null>(null);
    const [editJustification, setEditJustification] = useState('');
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showMissingEvidence, setShowMissingEvidence] = useState(false);
    const [currentFramework, setCurrentFramework] = useState<'ISO27001' | 'NIS2'>('ISO27001');
    const [expandedDomains, setExpandedDomains] = useState<string[]>([]); // Default empty, open first on load

    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const fetchData = async () => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const orgId = user.organizationId;

        try {
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'controls'), where('organizationId', '==', orgId))),
                getDocs(query(collection(db, 'documents'), where('organizationId', '==', orgId))),
                getDocs(query(collection(db, 'risks'), where('organizationId', '==', orgId))),
                getDocs(query(collection(db, 'findings'), where('organizationId', '==', orgId)))
            ]);

            const getData = <T extends { id: string }>(result: PromiseSettledResult<QuerySnapshot<DocumentData>>): T[] => {
                if (result.status === 'fulfilled') {
                    return result.value.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() })) as unknown as T[];
                }
                return [];
            };

            const ctrlData = getData<Control>(results[0]);
            const docData = getData<Document>(results[1]);
            const riskData = getData<Risk>(results[2]);
            const findingData = getData<Finding>(results[3]);

            setDocuments(docData);
            setRisks(riskData);
            setFindings(findingData);

            // Filter controls by current framework
            // Legacy handling: if framework is undefined, assume ISO27001
            const currentControls = ctrlData.filter(c =>
                (c.framework === currentFramework) ||
                (!c.framework && currentFramework === 'ISO27001')
            );

            const seedControls = currentFramework === 'ISO27001' ? ISO_SEED_CONTROLS : NIS2_SEED_CONTROLS;

            if (currentControls.length < seedControls.length) {
                const existingCodes = currentControls.map(d => d.code);
                const batch = writeBatch(db);
                let addedCount = 0;

                seedControls.forEach(c => {
                    if (!existingCodes.includes(c.code)) {
                        const docRef = doc(collection(db, 'controls'));
                        batch.set(docRef, {
                            organizationId: orgId,
                            code: c.code,
                            name: c.name,
                            framework: currentFramework,
                            status: 'Non commencé',
                            lastUpdated: new Date().toISOString(),
                            evidenceIds: []
                        });
                        addedCount++;
                    }
                });

                if (addedCount > 0) {
                    await batch.commit();
                    // Refetch to get new IDs
                    const newSnap = await getDocs(query(collection(db, 'controls'), where('organizationId', '==', orgId)));
                    const allControls = newSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Control));
                    const filtered = allControls.filter(c =>
                        (c.framework === currentFramework) ||
                        (!c.framework && currentFramework === 'ISO27001')
                    );
                    setControls(sortControls(filtered));
                } else {
                    setControls(sortControls(currentControls));
                }
            } else {
                setControls(sortControls(currentControls));
            }

            // Open first domain by default
            const domains = currentFramework === 'ISO27001' ? ISO_DOMAINS : NIS2_DOMAINS;
            if (domains.length > 0) {
                setExpandedDomains([domains[0].id]);
            }

        } catch (_err) {
            addToast("Erreur chargement données conformité", "error");
        } finally {
            setLoading(false);
        }
    };

    const sortControls = (data: Control[]) => {
        return data.sort((a, b) => {
            const partsA = a.code.split('.').map(Number);
            const partsB = b.code.split('.').map(Number);
            if (partsA[1] !== partsB[1]) return (partsA[1] || 0) - (partsB[1] || 0);
            return (partsA[2] || 0) - (partsB[2] || 0);
        });
    }

    useEffect(() => { fetchData(); }, [user?.organizationId, currentFramework]);

    const toggleDomain = (domainId: string) => {
        setExpandedDomains(prev => prev.includes(domainId) ? prev.filter(d => d !== domainId) : [...prev, domainId]);
    };

    const openInspector = (control: Control) => {
        setSelectedControl(control);
        setEditJustification(control.justification || '');
    };

    const saveJustification = async () => {
        if (!selectedControl) return;
        try {
            await updateDoc(doc(db, 'controls', selectedControl.id), { justification: editJustification, lastUpdated: new Date().toISOString() });
            setControls(prev => prev.map(c => c.id === selectedControl.id ? { ...c, justification: editJustification } : c));
            setSelectedControl({ ...selectedControl, justification: editJustification });
            addToast("Justification enregistrée", "success");
        } catch (_e) { addToast("Erreur enregistrement", "error"); }
    };

    const toggleStatus = async (control: Control, newStatus: Control['status']) => {
        try {
            await updateDoc(doc(db, 'controls', control.id), { status: newStatus, lastUpdated: new Date().toISOString() });
            setControls(prev => prev.map(c => c.id === control.id ? { ...c, status: newStatus } : c));
            if (selectedControl?.id === control.id) setSelectedControl({ ...selectedControl, status: newStatus });
            addToast(`Statut changé : ${newStatus}`, "success");
        } catch (_e) { addToast("Erreur MAJ statut", "error"); }
    };

    const linkDocument = async (docId: string) => {
        if (!selectedControl) return;
        try {
            if (selectedControl.evidenceIds?.includes(docId)) return;
            await updateDoc(doc(db, 'controls', selectedControl.id), { evidenceIds: arrayUnion(docId) });
            const newEvidence = [...(selectedControl.evidenceIds || []), docId];
            setControls(prev => prev.map(c => c.id === selectedControl.id ? { ...c, evidenceIds: newEvidence } : c));
            setSelectedControl({ ...selectedControl, evidenceIds: newEvidence });
            await logAction(user, 'LINK', 'Compliance', `Preuve liée au contrôle ${selectedControl.code}`);
            addToast("Preuve ajoutée", "success");
        } catch (_e) { addToast("Erreur lors de la liaison", "error"); }
    };

    const initiateUnlinkDocument = (docId: string) => {
        if (!selectedControl) return;
        setConfirmData({
            isOpen: true,
            title: "Retirer la preuve ?",
            message: "Ce document ne sera plus lié à ce contrôle.",
            onConfirm: () => unlinkDocument(docId)
        });
    };

    const unlinkDocument = async (docId: string) => {
        if (!selectedControl) return;
        try {
            const newEvidence = (selectedControl.evidenceIds || []).filter(id => id !== docId);
            await updateDoc(doc(db, 'controls', selectedControl.id), { evidenceIds: newEvidence });
            setControls(prev => prev.map(c => c.id === selectedControl.id ? { ...c, evidenceIds: newEvidence } : c));
            setSelectedControl({ ...selectedControl, evidenceIds: newEvidence });
            addToast("Preuve retirée", "info");
        } catch (_e) { addToast("Erreur suppression lien", "error"); }
    };

    const getDomainStats = (prefix: string) => {
        const domainControls = controls.filter(c => c.code.startsWith(prefix));
        const total = domainControls.length;
        const implemented = domainControls.filter(c => c.status === 'Implémenté').length;
        const partial = domainControls.filter(c => c.status === 'Partiel').length;
        return { total, implemented, partial, progress: total > 0 ? Math.round(((implemented + (partial * 0.5)) / total) * 100) : 0 };
    };

    const generateSoAReport = () => {
        const doc = new jsPDF();
        const date = new Date().toLocaleDateString();

        // Header
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setFontSize(20);
        doc.setTextColor(255, 255, 255);
        doc.text("Statement of Applicability (SoA)", 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text(`ISO/IEC 27001:2022 | Généré le ${date} | ${user?.organizationName || 'Organisation'}`, 14, 30);
        if (currentFramework === 'NIS2') {
            doc.text(`NIS2 Compliance Report`, 14, 35);
        }

        // Summary
        const implemented = controls.filter(c => c.status === 'Implémenté').length;
        const excluded = controls.filter(c => c.status === 'Exclu').length;
        const total = controls.length;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text(`Synthèse : ${implemented} Implémentés, ${excluded} Exclus sur ${total} contrôles.`, 14, 50);

        // Table
        const rows = controls.map(c => [
            c.code,
            c.name,
            c.status,
            c.justification || (c.status === 'Exclu' ? 'Non justifié' : '-')
        ]);

        (doc as any).autoTable({
            startY: 60,
            head: [['Code', 'Contrôle', 'Statut', 'Justification / Commentaire']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 20 },
                1: { cellWidth: 60 },
                2: { cellWidth: 30 },
                3: { cellWidth: 'auto' }
            },
            styles: { fontSize: 8, cellPadding: 3 }
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('Sentinel GRC by Cyber Threat Consulting - Document Confidentiel', 14, 285);
            doc.text(`Page ${i} / ${pageCount}`, 200, 285, { align: 'right' });
        }

        doc.save(`SoA_ISO27001_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const filteredControls = controls.filter(c => {
        const matchesSearch = c.code.toLowerCase().includes(filter.toLowerCase()) || c.name.toLowerCase().includes(filter.toLowerCase());
        const matchesMissing = showMissingEvidence ? (c.status === 'Implémenté' && (!c.evidenceIds || c.evidenceIds.length === 0)) : true;
        const matchesStatus = statusFilter ? c.status === statusFilter : true;
        return matchesSearch && matchesMissing && matchesStatus;
    });

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative">
            <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 font-display tracking-tight">
                        {currentFramework === 'ISO27001' ? "Déclaration d'Applicabilité" : "Conformité NIS2"}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        {currentFramework === 'ISO27001' ? "Pilotage de la conformité ISO 27001:2022." : "Suivi de la directive NIS2."}
                    </p>
                </div>
                <div className="flex gap-3 items-center">
                    {/* Framework Switcher */}
                    {/* Framework Switcher - Premium Segmented Control */}
                    <div className="bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm p-1.5 rounded-2xl flex items-center border border-white/20 shadow-inner">
                        <button
                            onClick={() => setCurrentFramework('ISO27001')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${currentFramework === 'ISO27001' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-lg shadow-slate-200/50 dark:shadow-none ring-1 ring-black/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'}`}
                        >
                            ISO 27001
                        </button>
                        <button
                            onClick={() => setCurrentFramework('NIS2')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${currentFramework === 'NIS2' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-lg shadow-slate-200/50 dark:shadow-none ring-1 ring-black/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5'}`}
                        >
                            NIS 2 <span className="ml-2 px-1.5 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 text-[10px] rounded-md uppercase tracking-wider">New</span>
                        </button>
                    </div>

                    <button onClick={generateSoAReport} className="flex items-center px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-none">
                        <Download className="h-4 w-4 mr-2" /> Rapport (PDF)
                    </button>
                </div>
            </div>

            {/* Dashboard Integration */}
            <ComplianceDashboard controls={controls} onFilterChange={setStatusFilter} />

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all flex-1"><Search className="h-5 w-5 text-gray-400" /><input type="text" placeholder="Rechercher (ex: A.5.1, Accès)..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-slate-200 py-2.5 font-medium placeholder-gray-400" value={filter} onChange={e => setFilter(e.target.value)} /></div>

                {/* Status Filter Badge */}
                {statusFilter && (
                    <button onClick={() => setStatusFilter(null)} className="flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-brand-50 text-brand-600 border border-brand-200 dark:bg-brand-900/20 dark:text-brand-400 animate-fade-in">
                        Filtre: {statusFilter} <X className="h-4 w-4 ml-2" />
                    </button>
                )}

                <button onClick={() => setShowMissingEvidence(!showMissingEvidence)} className={`flex items-center px-4 py-2 rounded-xl text-sm font-bold border transition-all ${showMissingEvidence ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-gray-200'}`}><Filter className="h-4 w-4 mr-2" />Preuves manquantes</button>
            </div>

            {/* Accordion List */}
            {loading ? (
                <div className="space-y-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="glass-panel rounded-[2.5rem] p-6 border border-white/50 dark:border-white/5 shadow-sm flex items-center gap-4">
                            <Skeleton className="w-10 h-10 rounded-xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-64" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredControls.length === 0 ? (
                <EmptyState
                    icon={ShieldCheck}
                    title="Aucun contrôle trouvé"
                    description={filter ? "Aucun contrôle ne correspond à votre recherche." : "Les contrôles n'ont pas été chargés."}
                />
            ) : (
                <div className="space-y-6">
                    {(currentFramework === 'ISO27001' ? ISO_DOMAINS : NIS2_DOMAINS).map(domain => {
                        const domainControls = filteredControls.filter(c => c.code.startsWith(domain.id));
                        if (domainControls.length === 0) return null;
                        const stats = getDomainStats(domain.id);
                        const isExpanded = expandedDomains.includes(domain.id) || filter.length > 0;

                        return (
                            <div key={domain.id} className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm card-hover transition-all duration-300">
                                <div
                                    onClick={() => toggleDomain(domain.id)}
                                    className="p-6 flex items-center justify-between cursor-pointer bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold shadow-lg shadow-brand-500/20">
                                            {domain.id.split('.')[1]}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{domain.title}</h3>
                                            <p className="text-xs text-slate-500 font-medium">{domain.description} • {stats.total} contrôles</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="hidden md:block w-32">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                                <span>Progression</span>
                                                <span>{stats.progress}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
                                                <div className="bg-brand-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${stats.progress}%` }}></div>
                                            </div>
                                        </div>
                                        <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-200 dark:border-white/5">
                                        {domainControls.map(control => {
                                            const riskCount = risks.filter(r => r.mitigationControlIds?.includes(control.id)).length;
                                            const findingsCount = findings.filter(f => f.relatedControlId === control.id && f.status === 'Ouvert').length;
                                            return (
                                                <CustomTooltip key={control.id} content={`Cliquez pour voir les détails de ${control.code}`} position="top" className="w-full">
                                                    <div onClick={() => openInspector(control)} className="p-5 hover:bg-gray-50/80 dark:hover:bg-white/5 transition-all cursor-pointer group flex items-center justify-between pl-8 active:scale-[0.99] duration-200">
                                                        <div className="flex items-center space-x-5 flex-1 min-w-0">
                                                            <div className="min-w-[50px]"><span className="text-xs font-black text-slate-400 group-hover:text-brand-600 transition-colors">{control.code}</span></div>
                                                            <div className="flex-1 min-w-0"><h4 className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 truncate pr-4">{control.name}</h4>
                                                                <div className="flex items-center mt-1 gap-3 text-xs">
                                                                    {control.evidenceIds && control.evidenceIds.length > 0 ? (<span className="flex items-center text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded"><Paperclip className="h-3 w-3 mr-1" /> {control.evidenceIds.length} preuve(s)</span>) : (control.status === 'Implémenté') ? (<span className="flex items-center text-orange-500 font-medium"><AlertTriangle className="h-3 w-3 mr-1" /> Preuve manquante</span>) : null}
                                                                    {riskCount > 0 && (<span className="flex items-center text-blue-500 font-medium bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded"><ShieldAlert className="h-3 w-3 mr-1" /> {riskCount} risques</span>)}
                                                                    {findingsCount > 0 && (<span className="flex items-center text-red-500 font-medium bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded"><AlertOctagon className="h-3 w-3 mr-1" /> {findingsCount} écarts</span>)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${control.status === 'Implémenté' ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20' : control.status === 'Partiel' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-500 bg-slate-100 border-slate-200'}`}>{control.status}</span>
                                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                                        </div>
                                                    </div>
                                                </CustomTooltip>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Inspector (Keep existing implementation but styled) */}
            {selectedControl && createPortal(
                <div className="fixed inset-0 z-[9999] overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setSelectedControl(null)} />
                    <div className="absolute inset-y-0 right-0 sm:pl-10 max-w-full flex pointer-events-none">
                        <div className="w-screen max-w-xl pointer-events-auto">
                            <div className="h-full flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-slide-up">
                                <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-start justify-between bg-white/50 dark:bg-white/5">
                                    <div><div className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-500 dark:text-slate-400 mb-2">{selectedControl.code}</div><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{selectedControl.name}</h2></div>
                                    <button onClick={() => setSelectedControl(null)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors bg-gray-50 dark:bg-white/5 rounded-full"><X className="h-5 w-5" /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-slate-50/30 dark:bg-transparent">

                                    {/* AI Assistant Section */}
                                    <ComplianceAIAssistant control={selectedControl} onApplyPolicy={(policy) => setEditJustification(prev => prev ? prev + '\n\n' + policy : policy)} />

                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-widest">Statut d'implémentation</h3>
                                        {canEdit ? (
                                            <div className="grid grid-cols-3 gap-3">
                                                {['Non commencé', 'Partiel', 'Implémenté', 'En revue', 'Non applicable', 'Exclu'].map((s: any) => (
                                                    <button
                                                        key={s}
                                                        onClick={() => toggleStatus(selectedControl, s)}
                                                        className={`px-3 py-3 rounded-xl text-xs font-bold border transition-all duration-200 flex items-center justify-center ${selectedControl.status === s
                                                            ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-500/30 scale-[1.02]'
                                                            : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:border-gray-200 dark:hover:border-white/10 hover:shadow-sm hover:text-slate-700 dark:hover:text-slate-200'
                                                            }`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className={`px-4 py-2 rounded-xl text-sm font-bold border uppercase tracking-wide inline-block`}>{selectedControl.status}</span>
                                        )}
                                    </div>

                                    {/* Related Actions (Workflows) */}
                                    {(selectedControl.code.startsWith('NIS2.4') || selectedControl.code.startsWith('NIS2.2') || selectedControl.code.startsWith('NIS2.3')) && (
                                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm relative overflow-hidden group/card">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/card:opacity-10 transition-opacity">
                                                <Link className="w-24 h-24 text-blue-600" />
                                            </div>
                                            <h3 className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400 mb-4 tracking-widest flex items-center relative z-10">
                                                <Link className="h-3.5 w-3.5 mr-2" /> Actions Liées (Workflows)
                                            </h3>
                                            <div className="space-y-3 relative z-10">
                                                {selectedControl.code.startsWith('NIS2.4') && (
                                                    <a href="#/incidents" className="flex items-center justify-between p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-blue-100 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:-translate-y-0.5 transition-all group duration-300">
                                                        <div className="flex items-center">
                                                            <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-xl mr-4 group-hover:scale-110 transition-transform"><ShieldAlert className="h-5 w-5" /></div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 dark:text-white text-sm">Gestion des Incidents</div>
                                                                <div className="text-xs text-slate-500 mt-0.5">Déclarer ou suivre un incident de sécurité</div>
                                                            </div>
                                                        </div>
                                                        <div className="h-8 w-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
                                                        </div>
                                                    </a>
                                                )}
                                                {selectedControl.code.startsWith('NIS2.2') && (
                                                    <a href="#/suppliers" className="flex items-center justify-between p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-blue-100 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:-translate-y-0.5 transition-all group duration-300">
                                                        <div className="flex items-center">
                                                            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 text-purple-600 rounded-xl mr-4 group-hover:scale-110 transition-transform"><FileText className="h-5 w-5" /></div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 dark:text-white text-sm">Gestion des Fournisseurs</div>
                                                                <div className="text-xs text-slate-500 mt-0.5">Évaluer la sécurité de la chaîne d'approvisionnement</div>
                                                            </div>
                                                        </div>
                                                        <div className="h-8 w-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
                                                        </div>
                                                    </a>
                                                )}
                                                {selectedControl.code.startsWith('NIS2.3') && (
                                                    <a href="#/assets" className="flex items-center justify-between p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-blue-100 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md hover:-translate-y-0.5 transition-all group duration-300">
                                                        <div className="flex items-center">
                                                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 rounded-xl mr-4 group-hover:scale-110 transition-transform"><ShieldCheck className="h-5 w-5" /></div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 dark:text-white text-sm">Inventaire des Actifs</div>
                                                                <div className="text-xs text-slate-500 mt-0.5">Gérer les systèmes et réseaux</div>
                                                            </div>
                                                        </div>
                                                        <div className="h-8 w-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
                                                        </div>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex justify-between items-end mb-3 px-2"><h3 className="text-xs font-bold uppercase text-slate-400 flex items-center tracking-widest"><FileText className="h-3.5 w-3.5 mr-2" /> Justification SoA</h3>{selectedControl.status === 'Exclu' && <span className="text-[10px] text-red-500 font-bold uppercase bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">Obligatoire</span>}</div>
                                        {canEdit ? (<div className="relative group"><textarea className="w-full p-5 text-sm bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-white/10 rounded-3xl text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-brand-500 outline-none shadow-sm font-medium leading-relaxed" rows={6} placeholder="Décrivez comment ce contrôle est implémenté, ou justifiez son exclusion..." value={editJustification} onChange={e => setEditJustification(e.target.value)} /><button onClick={saveJustification} className="absolute bottom-4 right-4 p-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110" title="Sauvegarder"><Save className="h-4 w-4" /></button></div>) : (<div className="p-5 bg-white dark:bg-slate-800/80 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm"><p className="text-sm text-slate-600 dark:text-slate-300 italic font-medium leading-relaxed">{selectedControl.justification || "Aucune justification saisie."}</p></div>)}
                                    </div>
                                    <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 flex items-center tracking-widest"><Link className="h-3.5 w-3.5 mr-2" /> Preuves Documentaires</h3>
                                        <div className="space-y-2 mb-4">
                                            {selectedControl.evidenceIds && selectedControl.evidenceIds.length > 0 ? selectedControl.evidenceIds.map(docId => { const docObj = documents.find(d => d.id === docId); return docObj ? (<div key={docId} className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm group transition-all hover:bg-white dark:hover:bg-white/5"><div className="flex items-center overflow-hidden"><div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg mr-3 text-blue-500"><File className="h-4 w-4" /></div><span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{docObj.title}</span></div><div className="flex gap-2">{docObj.url && <a href={docObj.url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-brand-600 bg-white dark:bg-slate-800 rounded-lg transition-colors shadow-sm"><ExternalLink className="h-3.5 w-3.5" /></a>}{canEdit && <button onClick={() => initiateUnlinkDocument(docId)} className="p-2 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-lg transition-colors shadow-sm"><X className="h-3.5 w-3.5" /></button>}</div></div>) : null; }) : <p className="text-xs text-gray-400 italic text-center py-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">Aucune preuve liée.</p>}
                                        </div>
                                        {canEdit && (<div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5"><label className="text-[10px] font-bold text-slate-400 mb-3 block uppercase tracking-wide">Ajouter une preuve existante</label><div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 bg-gray-50/50 dark:bg-black/20 p-2 rounded-2xl border border-gray-100 dark:border-white/5">{documents.filter(d => !selectedControl.evidenceIds?.includes(d.id)).map(d => (<button key={d.id} onClick={() => linkDocument(d.id)} className="w-full text-left text-xs p-2.5 hover:bg-white dark:hover:bg-white/10 rounded-xl flex items-center text-slate-600 dark:text-slate-300 transition-all font-medium"><Plus className="h-3 w-3 mr-2 text-brand-500" /> {d.title}</button>))}</div></div>)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// --- AI Assistant Component ---
import { Sparkles, Bot, Lightbulb, FileText as FileTextIcon, Loader2 as Loader } from '../components/ui/Icons';
import { aiService } from '../services/aiService';

const ComplianceAIAssistant: React.FC<{ control: Control, onApplyPolicy: (text: string) => void }> = ({ control, onApplyPolicy }) => {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string | null>(null);
    const [mode, setMode] = useState<'explain' | 'evidence' | 'policy' | null>(null);

    const handleAction = async (action: 'explain' | 'evidence' | 'policy') => {
        setLoading(true);
        setMode(action);
        setResponse(null);
        try {
            let prompt = '';
            if (action === 'explain') {
                prompt = `Explique le contrôle ISO 27001 "${control.code} - ${control.name}" de manière simple et concrète pour une PME. Donne des exemples d'application.`;
            } else if (action === 'evidence') {
                prompt = `Quelles sont les preuves (documents, logs, captures) typiquement attendues par un auditeur pour le contrôle "${control.code} - ${control.name}" ? Liste-les sous forme de bullet points.`;
            } else if (action === 'policy') {
                prompt = `Rédige un paragraphe de politique de sécurité concis pour répondre au contrôle "${control.code} - ${control.name}". Le ton doit être formel.`;
            }

            const res = await aiService.chatWithAI(prompt);
            setResponse(res);
        } catch (error) {
            setResponse("Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-3xl p-6 border border-indigo-100 dark:border-white/5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Sparkles className="w-24 h-24 text-indigo-600" />
            </div>

            <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm text-indigo-600 dark:text-indigo-400">
                    <Bot className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Assistant Conformité IA</h3>
                <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wider">Gemini 3</span>
            </div>

            {!response && !loading && (
                <div className="grid grid-cols-1 gap-2 relative z-10">
                    <button onClick={() => handleAction('explain')} className="flex items-center p-3 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 transition-all text-left border border-transparent hover:border-indigo-100 dark:hover:border-white/10">
                        <Lightbulb className="w-4 h-4 mr-3 text-amber-500" />
                        Comprendre ce contrôle
                    </button>
                    <button onClick={() => handleAction('evidence')} className="flex items-center p-3 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 transition-all text-left border border-transparent hover:border-indigo-100 dark:hover:border-white/10">
                        <FileTextIcon className="w-4 h-4 mr-3 text-blue-500" />
                        Suggérer des preuves
                    </button>
                    <button onClick={() => handleAction('policy')} className="flex items-center p-3 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 transition-all text-left border border-transparent hover:border-indigo-100 dark:hover:border-white/10">
                        <Sparkles className="w-4 h-4 mr-3 text-purple-500" />
                        Générer une politique
                    </button>
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500 dark:text-slate-400">
                    <Loader className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                    <p className="text-xs font-medium animate-pulse">L'IA réfléchit...</p>
                </div>
            )}

            {response && (
                <div className="animate-fade-in relative z-10">
                    <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed shadow-sm border border-white/50 dark:border-white/5 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                        <div className="prose dark:prose-invert max-w-none text-sm">
                            {response.split('\n').map((line, i) => <p key={i} className="mb-2 last:mb-0">{line}</p>)}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setResponse(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                            Retour
                        </button>
                        {mode === 'policy' && (
                            <button onClick={() => onApplyPolicy(response)} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">
                                Insérer dans la justification
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
