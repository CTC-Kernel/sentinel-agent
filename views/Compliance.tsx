import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, writeBatch, arrayUnion, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Control, Document, Risk, Finding, UserProfile, SystemLog } from '../types';
import { FileText, AlertTriangle, Download, Paperclip, Link, ExternalLink, ShieldAlert, AlertOctagon, Search, X, Save, File, ShieldCheck, Plus, ChevronRight, Filter, ChevronDown, User } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ComplianceDashboard } from '../components/compliance/ComplianceDashboard';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorLogger } from '../services/errorLogger';
import { Drawer } from '../components/ui/Drawer';
import { Comments } from '../components/ui/Comments';
import { CustomSelect } from '../components/ui/CustomSelect';
import { NotificationService } from '../services/notificationService';
import { useFirestoreCollection } from '../hooks/useFirestore';

import { ISO_DOMAINS, ISO_SEED_CONTROLS, NIS2_DOMAINS, NIS2_SEED_CONTROLS } from '../data/complianceData';
import { aiService } from '../services/aiService';
import { Sparkles, Bot, Lightbulb, FileText as FileTextIcon, Loader2 as Loader } from '../components/ui/Icons';

export const Compliance: React.FC = () => {
    const { user, addToast } = useStore();

    const canEdit = user?.role === 'admin' || user?.role === 'auditor';

    // UI State
    const [selectedControl, setSelectedControl] = useState<Control | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [inspectorTab, setInspectorTab] = useState<'details' | 'evidence' | 'comments' | 'history'>('details');
    const [controlHistory, setControlHistory] = useState<SystemLog[]>([]);

    const [editJustification, setEditJustification] = useState('');
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showMissingEvidence, setShowMissingEvidence] = useState(false);
    const [currentFramework, setCurrentFramework] = useState<'ISO27001' | 'NIS2'>('ISO27001');
    const [expandedDomains, setExpandedDomains] = useState<string[]>([]); // Default empty, open first on load

    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    // Data Fetching with Hooks
    const { data: rawControls, loading: controlsLoading, refresh: refreshControls } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: documents, loading: docsLoading } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: risks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: findings, loading: findingsLoading } = useFirestoreCollection<Finding>(
        'findings',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const loading = controlsLoading || docsLoading || risksLoading || findingsLoading || usersLoading;

    // Derived State and Seeding Logic
    const [controls, setControls] = useState<Control[]>([]);

    useEffect(() => {
        if (controlsLoading || !user?.organizationId) return;

        const seedData = async () => {
            const currentControls = rawControls.filter(c =>
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
                            organizationId: user.organizationId,
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
                    refreshControls();
                    return; // Will re-run effect after refresh
                }
            }

            setControls(sortControls(currentControls));
        };

        seedData();
    }, [rawControls, currentFramework, user?.organizationId, controlsLoading]);

    // Open first domain by default
    useEffect(() => {
        const domains = currentFramework === 'ISO27001' ? ISO_DOMAINS : NIS2_DOMAINS;
        if (domains.length > 0 && expandedDomains.length === 0) {
            setExpandedDomains([domains[0].id]);
        }
    }, [currentFramework]);

    const sortControls = (data: Control[]) => {
        return [...data].sort((a, b) => {
            const partsA = a.code.split('.').map(Number);
            const partsB = b.code.split('.').map(Number);
            if (partsA[1] !== partsB[1]) return (partsA[1] || 0) - (partsB[1] || 0);
            return (partsA[2] || 0) - (partsB[2] || 0);
        });
    }

    const toggleDomain = (domainId: string) => {
        setExpandedDomains(prev => prev.includes(domainId) ? prev.filter(d => d !== domainId) : [...prev, domainId]);
    };

    const openInspector = async (control: Control) => {
        setSelectedControl(control);
        setEditJustification(control.justification || '');
        setIsDrawerOpen(true);
        setInspectorTab('details');

        // Fetch history
        try {
            const q = query(
                collection(db, 'system_logs'),
                where('organizationId', '==', user?.organizationId),
                where('resource', '==', 'Control'),
                limit(50)
            );
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => d.data() as SystemLog);
            // Filter client-side for specific control code/name matches since we don't store controlId in logs yet
            const relevantLogs = logs.filter(l => l.details?.includes(control.code));
            relevantLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setControlHistory(relevantLogs);
        } catch (error) {
            console.error("Error fetching history", error);
        }
    };

    const handleAssign = async (assigneeId: string) => {
        if (!selectedControl || !user?.organizationId) return;
        try {
            await updateDoc(doc(db, 'controls', selectedControl.id), { assigneeId });

            // Notify assignee
            if (assigneeId) {
                await NotificationService.notifyControlAssigned(selectedControl, assigneeId);
            }

            // Log action
            const assignee = usersList.find(u => u.uid === assigneeId);
            await logAction(user, 'UPDATE', 'Control', `Contrôle ${selectedControl.code} assigné à ${assignee?.displayName || assignee?.email}`);

            // Update local state
            const updatedControl = { ...selectedControl, assigneeId };
            setSelectedControl(updatedControl);
            refreshControls();

            addToast("Assignation mise à jour", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleAssign', 'UPDATE_FAILED');
        }
    };

    const handleStatusChange = async (control: Control, newStatus: Control['status']) => {
        if (!user?.organizationId) return;
        try {
            await updateDoc(doc(db, 'controls', control.id), {
                status: newStatus,
                lastUpdated: new Date().toISOString()
            });
            await logAction(user, 'UPDATE', 'Control', `Statut ${control.code} changé à ${newStatus}`);

            const updatedControl = { ...control, status: newStatus, lastUpdated: new Date().toISOString() };
            if (selectedControl?.id === control.id) setSelectedControl(updatedControl);
            refreshControls();

            addToast("Statut mis à jour", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleStatusChange', 'UPDATE_FAILED');
        }
    };

    const handleJustificationSave = async () => {
        if (!selectedControl || !user?.organizationId) return;
        try {
            await updateDoc(doc(db, 'controls', selectedControl.id), {
                justification: editJustification,
                lastUpdated: new Date().toISOString()
            });
            await logAction(user, 'UPDATE', 'Control', `Justification mise à jour pour ${selectedControl.code}`);

            const updatedControl = { ...selectedControl, justification: editJustification, lastUpdated: new Date().toISOString() };
            setSelectedControl(updatedControl);
            refreshControls();

            addToast("Justification enregistrée", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Compliance.handleJustificationSave', 'UPDATE_FAILED');
        }
    };

    const linkDocument = async (docId: string) => {
        if (!selectedControl) return;
        try {
            if (selectedControl.evidenceIds?.includes(docId)) return;
            await updateDoc(doc(db, 'controls', selectedControl.id), { evidenceIds: arrayUnion(docId) });
            const newEvidence = [...(selectedControl.evidenceIds || []), docId];
            refreshControls();
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
            refreshControls();
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

        (doc as jsPDF & { autoTable: any }).autoTable({
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
        const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
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

            <PageHeader
                title={currentFramework === 'ISO27001' ? "Déclaration d'Applicabilité" : "Conformité NIS2"}
                subtitle={currentFramework === 'ISO27001' ? "Pilotage de la conformité ISO 27001:2022." : "Suivi de la directive NIS2."}
                breadcrumbs={[
                    { label: 'Conformité' }
                ]}
                icon={<ShieldCheck className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={
                    <div className="flex gap-3 items-center">
                        {/* Framework Switcher - Clean Style */}
                        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-white/10">
                            <button
                                onClick={() => setCurrentFramework('ISO27001')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${currentFramework === 'ISO27001' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                ISO 27001
                            </button>
                            <button
                                onClick={() => setCurrentFramework('NIS2')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${currentFramework === 'NIS2' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                NIS 2 <span className="ml-1.5 px-1.5 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 text-[10px] rounded uppercase tracking-wider">New</span>
                            </button>
                        </div>

                        <button onClick={generateSoAReport} className="flex items-center px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm">
                            <Download className="h-4 w-4 mr-2" /> Rapport
                        </button>
                    </div>
                }
            />

            {/* Dashboard Integration */}
            <ComplianceDashboard controls={controls} onFilterChange={setStatusFilter} />

            {/* Filter Bar - Clean Style */}
            <div className="flex flex-col sm:flex-row gap-4 p-1">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Rechercher un contrôle (ex: A.5.1, Accès)..."
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm font-medium transition-all shadow-sm placeholder:text-slate-400"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>

                <div className="flex gap-3">
                    {/* Status Filter Badge */}
                    {statusFilter && (
                        <button onClick={() => setStatusFilter(null)} className="flex items-center px-4 py-2 rounded-xl text-sm font-bold bg-brand-50 text-brand-700 border border-brand-200 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-800 animate-fade-in hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors">
                            <span className="mr-2 opacity-70">Filtre:</span> {statusFilter} <X className="h-4 w-4 ml-2" />
                        </button>
                    )}

                    <button
                        onClick={() => setShowMissingEvidence(!showMissingEvidence)}
                        className={`flex items-center px-5 py-3 rounded-xl text-sm font-bold border transition-all shadow-sm ${showMissingEvidence ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                        <Filter className={`h-4 w-4 mr-2 ${showMissingEvidence ? 'fill-current' : ''}`} />
                        Preuves manquantes
                    </button>
                </div>
            </div>

            {/* Accordion List - Clean Card Style */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 flex items-center gap-4">
                            <Skeleton className="w-12 h-12 rounded-xl" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-4 w-full max-w-md" />
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
                <div className="space-y-4">
                    {(currentFramework === 'ISO27001' ? ISO_DOMAINS : NIS2_DOMAINS).map(domain => {
                        const domainControls = filteredControls.filter(c => c.code.startsWith(domain.id));
                        if (domainControls.length === 0) return null;
                        const stats = getDomainStats(domain.id);
                        const isExpanded = expandedDomains.includes(domain.id) || filter.length > 0;

                        return (
                            <div key={domain.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                                <div
                                    onClick={() => toggleDomain(domain.id)}
                                    className={`p-6 flex items-center justify-between cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50/80 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-lg border border-slate-200 dark:border-white/10">
                                            {domain.id.split('.')[1]}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{domain.title}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">{domain.description} • <span className="text-slate-700 dark:text-slate-300">{stats.total} contrôles</span></p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="hidden md:block w-40">
                                            <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                                                <span>Progression</span>
                                                <span className="text-slate-900 dark:text-white">{stats.progress}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-500 ${stats.progress === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${stats.progress}%` }}></div>
                                            </div>
                                        </div>
                                        <div className={`p-2 rounded-full transition-all duration-300 ${isExpanded ? 'bg-white dark:bg-white/10 shadow-sm rotate-180 text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                                            <ChevronDown className="h-5 w-5" />
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
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

            {/* Drawer Inspector */}
            <Drawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title={selectedControl ? `${selectedControl.code} - ${selectedControl.name}` : ''}
                subtitle={selectedControl?.framework || currentFramework}
                width="max-w-4xl"
            >
                {selectedControl && (
                    <div className="h-full flex flex-col">
                        {/* Tabs */}
                        <div className="flex border-b border-gray-100 dark:border-white/5 px-6 bg-white/50 dark:bg-white/5 backdrop-blur-sm sticky top-0 z-10">
                            <button onClick={() => setInspectorTab('details')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${inspectorTab === 'details' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Détails</button>
                            <button onClick={() => setInspectorTab('evidence')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${inspectorTab === 'evidence' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Preuves ({selectedControl.evidenceIds?.length || 0})</button>
                            <button onClick={() => setInspectorTab('comments')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${inspectorTab === 'comments' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Discussion</button>
                            <button onClick={() => setInspectorTab('history')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${inspectorTab === 'history' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>Historique</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {inspectorTab === 'details' && (
                                <div className="space-y-8 max-w-3xl mx-auto">
                                    {/* AI Assistant */}
                                    <ComplianceAIAssistant control={selectedControl} onApplyPolicy={(policy) => setEditJustification(prev => prev ? prev + '\n\n' + policy : policy)} />

                                    {/* Status & Assignment */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-widest">Statut d'implémentation</h3>
                                            {canEdit ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {(['Non commencé', 'Partiel', 'Implémenté', 'En revue', 'Non applicable', 'Exclu'] as Control['status'][]).map((s) => (
                                                        <button
                                                            key={s}
                                                            onClick={() => handleStatusChange(selectedControl, s)}
                                                            className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all duration-200 flex items-center justify-center ${selectedControl.status === s
                                                                ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                                                                : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
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

                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-widest">Responsable</h3>
                                            {canEdit ? (
                                                <CustomSelect
                                                    label="Assigné à"
                                                    value={selectedControl.assigneeId || ''}
                                                    onChange={(val) => handleAssign(val)}
                                                    options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                                                    placeholder="Sélectionner un responsable..."
                                                />
                                            ) : (
                                                <div className="flex items-center p-3 bg-slate-50 dark:bg-black/20 rounded-xl">
                                                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 mr-3">
                                                        <User className="h-4 w-4" />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                        {usersList.find(u => u.uid === selectedControl.assigneeId)?.displayName || 'Non assigné'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Justification */}
                                    <div>
                                        <div className="flex justify-between items-end mb-3 px-2">
                                            <h3 className="text-xs font-bold uppercase text-slate-400 flex items-center tracking-widest"><FileText className="h-3.5 w-3.5 mr-2" /> Justification SoA</h3>
                                            {selectedControl.status === 'Exclu' && <span className="text-[10px] text-red-500 font-bold uppercase bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">Obligatoire</span>}
                                        </div>
                                        {canEdit ? (
                                            <div className="relative group">
                                                <textarea
                                                    className="w-full p-5 text-sm bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-white/10 rounded-3xl text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-brand-500 outline-none shadow-sm font-medium leading-relaxed"
                                                    rows={6}
                                                    placeholder="Décrivez comment ce contrôle est implémenté, ou justifiez son exclusion..."
                                                    value={editJustification}
                                                    onChange={e => setEditJustification(e.target.value)}
                                                />
                                                <button
                                                    onClick={handleJustificationSave}
                                                    className="absolute bottom-4 right-4 p-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                                                    title="Sauvegarder"
                                                >
                                                    <Save className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="p-5 bg-white dark:bg-slate-800/80 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm">
                                                <p className="text-sm text-slate-600 dark:text-slate-300 italic font-medium leading-relaxed">{selectedControl.justification || "Aucune justification saisie."}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {inspectorTab === 'evidence' && (
                                <div className="space-y-6 max-w-3xl mx-auto">
                                    <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 flex items-center tracking-widest"><Link className="h-3.5 w-3.5 mr-2" /> Preuves Documentaires</h3>
                                        <div className="space-y-2 mb-4">
                                            {selectedControl.evidenceIds && selectedControl.evidenceIds.length > 0 ? selectedControl.evidenceIds.map(docId => {
                                                const docObj = documents.find(d => d.id === docId);
                                                return docObj ? (
                                                    <div key={docId} className="flex items-center justify-between p-3 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm group transition-all hover:bg-white dark:hover:bg-white/5">
                                                        <div className="flex items-center overflow-hidden">
                                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg mr-3 text-blue-500"><File className="h-4 w-4" /></div>
                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{docObj.title}</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {docObj.url && <a href={docObj.url} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-brand-600 bg-white dark:bg-slate-800 rounded-lg transition-colors shadow-sm"><ExternalLink className="h-3.5 w-3.5" /></a>}
                                                            {canEdit && <button onClick={() => initiateUnlinkDocument(docId)} className="p-2 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded-lg transition-colors shadow-sm"><X className="h-3.5 w-3.5" /></button>}
                                                        </div>
                                                    </div>
                                                ) : null;
                                            }) : <p className="text-xs text-gray-400 italic text-center py-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">Aucune preuve liée.</p>}
                                        </div>
                                        {canEdit && (
                                            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5">
                                                <label className="text-[10px] font-bold text-slate-400 mb-3 block uppercase tracking-wide">Ajouter une preuve existante</label>
                                                <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 bg-gray-50/50 dark:bg-black/20 p-2 rounded-2xl border border-gray-100 dark:border-white/5">
                                                    {documents.filter(d => !selectedControl.evidenceIds?.includes(d.id)).map(d => (
                                                        <button key={d.id} onClick={() => linkDocument(d.id)} className="w-full text-left text-xs p-2.5 hover:bg-white dark:hover:bg-white/10 rounded-xl flex items-center text-slate-600 dark:text-slate-300 transition-all font-medium">
                                                            <Plus className="h-3 w-3 mr-2 text-brand-500" /> {d.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {inspectorTab === 'comments' && (
                                <div className="h-full flex flex-col max-w-3xl mx-auto">
                                    <Comments collectionName="controls" documentId={selectedControl.id} />
                                </div>
                            )}

                            {inspectorTab === 'history' && (
                                <div className="space-y-8 max-w-3xl mx-auto">
                                    <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Journal d'Activité</h4>
                                        {controlHistory.length === 0 ? <p className="text-sm text-gray-400 italic">Aucune activité enregistrée.</p> : controlHistory.map((log, i) => (
                                            <div key={i} className="relative">
                                                <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-brand-900">
                                                    <div className="h-2 w-2 rounded-full bg-brand-500"></div>
                                                </span>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.details}</p>
                                                    <div className="mt-2 inline-flex items-center px-2 py-1 rounded-lg bg-gray-50 dark:bg-white/5 text-[10px] font-medium text-gray-500">{log.userEmail}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Drawer>
        </div>
    );
};

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
