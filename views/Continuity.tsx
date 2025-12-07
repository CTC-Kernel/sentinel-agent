import React, { useState } from 'react';
import { useForm, SubmitHandler, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BusinessProcessFormData, bcpDrillSchema, BcpDrillFormData } from '../schemas/continuitySchema';
import { canEditResource } from '../utils/permissions';

import { Drawer } from '../components/ui/Drawer';
import { collection, addDoc, deleteDoc, doc, updateDoc, where, limit, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { BusinessProcess, Asset, BcpDrill, SystemLog, UserProfile, Risk, Supplier } from '../types';
import { Plus, HeartPulse, Trash2, Edit, Zap, ClipboardCheck, Server, CalendarDays, AlertTriangle, History, MessageSquare, LayoutDashboard, FileSpreadsheet, ShieldAlert, Truck, Download } from '../components/ui/Icons';
import { PdfService } from '../services/PdfService';
import { aiService } from '../services/aiService';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Comments } from '../components/ui/Comments';
import { ErrorLogger } from '../services/errorLogger';
import { AddToCalendar } from '../components/ui/AddToCalendar';
import { ProcessFormModal } from '../components/continuity/ProcessFormModal';


export const Continuity: React.FC = () => {
    const { user, addToast } = useStore();
    const canEdit = canEditResource(user, 'BusinessProcess');

    const { data: processes, loading: procLoading } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true, enabled: !!user?.organizationId }
    );

    const { data: drills, loading: drillsLoading } = useFirestoreCollection<BcpDrill>(
        'bcp_drills',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true, enabled: !!user?.organizationId }
    );

    const { data: assets, loading: assetsLoading } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true, enabled: !!user?.organizationId }
    );

    const { data: risks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true, enabled: !!user?.organizationId }
    );

    const { data: suppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true, enabled: !!user?.organizationId }
    );

    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true, enabled: !!user?.organizationId }
    );

    const loading = procLoading || drillsLoading || assetsLoading || risksLoading || suppliersLoading || usersLoading;
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDrillModal, setShowDrillModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'bia' | 'drills'>('bia');

    // Inspector State
    const [selectedProcess, setSelectedProcess] = useState<BusinessProcess | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'details' | 'recovery' | 'scenarios' | 'drills' | 'history' | 'comments'>('details');
    const [processHistory, setProcessHistory] = useState<SystemLog[]>([]);
    const [showEditModal, setShowEditModal] = useState(false);



    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });



    const drillForm = useForm<BcpDrillFormData>({
        resolver: zodResolver(bcpDrillSchema),
        defaultValues: {
            processId: '', date: new Date().toISOString().split('T')[0], type: 'Tabletop', result: 'Succès', notes: ''
        }
    });

    const watchedDrillDate = useWatch({ control: drillForm.control, name: 'date' });
    const watchedDrillType = useWatch({ control: drillForm.control, name: 'type' });
    const watchedDrillProcessId = useWatch({ control: drillForm.control, name: 'processId' });

    // Metrics for Summary Card
    const totalProcesses = processes.length;
    const criticalProcesses = processes.filter(p => p.priority === 'Critique').length;
    const testedProcesses = processes.filter(p => {
        if (!p.lastTestDate) return false;
        const lastTest = new Date(p.lastTestDate);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return lastTest > oneYearAgo;
    }).length;
    const coverageRate = totalProcesses > 0 ? (testedProcesses / totalProcesses) * 100 : 0;
    const overdueTests = totalProcesses - testedProcesses;
    const failedDrills = drills.filter(d => d.result === 'Échec').length;

    const generateReport = async () => {
        addToast("Génération du rapport de continuité avec l'IA...", "info");
        try {
            const criticalProcessesCount = processes.filter(p => p.priority === 'Critique').length;
            const totalRTO = processes.reduce((acc, p) => acc + parseInt(p.rto || '0'), 0);
            const avgRTO = processes.length > 0 ? Math.round(totalRTO / processes.length) : 0;

            const context = {
                totalProcesses: processes.length,
                criticalProcesses: criticalProcessesCount,
                avgRTO,
                drillsCount: drills.length,
                lastDrillDate: drills.length > 0 ? drills[0].date : 'Aucun',
                organizationName: user?.organizationName || 'Organisation'
            };

            const summary = await aiService.generateContinuityReportSummary(context);

            PdfService.generateExecutiveReport(
                {
                    title: "Rapport de Continuité d'Activité",
                    subtitle: `Généré le ${new Date().toLocaleDateString()}`,
                    filename: `Plan_Continute_${context.organizationName}_${new Date().toISOString().split('T')[0]}.pdf`,
                    organizationName: context.organizationName,
                    summary,
                    author: user?.displayName || 'Sentinel GRC',
                    orientation: 'portrait'
                },
                (doc, startY) => {
                    let y = startY;

                    // Metrics
                    doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
                    doc.text("Indicateurs Clés", 14, y);
                    y += 10;

                    const statsData = [
                        { label: "Processus Totaux", value: processes.length.toString() },
                        { label: "Processus Critiques", value: criticalProcessesCount.toString() },
                        { label: "RTO Moyen", value: `${avgRTO}h` },
                        { label: "Exercices Réalisés", value: drills.length.toString() }
                    ];

                    let x = 14;
                    statsData.forEach(stat => {
                        doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
                        doc.roundedRect(x, y, 40, 25, 2, 2, 'FD');
                        doc.setFontSize(14); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
                        doc.text(stat.value, x + 20, y + 12, { align: 'center' });
                        doc.setFontSize(8); doc.setTextColor(100); doc.setFont('helvetica', 'normal');
                        doc.text(stat.label, x + 20, y + 20, { align: 'center' });
                        x += 45;
                    });

                    y += 40;

                    // Critical Processes Table
                    doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
                    doc.text("Processus Critiques", 14, y);
                    y += 5;

                    const processData = processes
                        .filter(p => p.priority === 'Critique')
                        .map(p => [p.name, p.rto, p.rpo, p.owner]);

                    doc.autoTable({
                        startY: y,
                        head: [['Processus', 'RTO', 'RPO', 'Responsable']],
                        body: processData,
                        theme: 'grid',
                        headStyles: { fillColor: [79, 70, 229] },
                        styles: { fontSize: 8, cellPadding: 2 },
                        margin: { left: 14, right: 14 }
                    });

                    y = (doc as any).lastAutoTable.finalY + 15;

                    // Recent Drills
                    if (drills.length > 0) {
                        doc.setFontSize(12); doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold');
                        doc.text("Derniers Exercices", 14, y);
                        y += 5;

                        const drillData = drills.slice(0, 5).map(d => {
                            const processName = processes.find(p => p.id === d.processId)?.name || 'Inconnu';
                            return [processName, d.type, new Date(d.date).toLocaleDateString(), d.result];
                        });

                        doc.autoTable({
                            startY: y,
                            head: [['Exercice', 'Type', 'Date', 'Statut']],
                            body: drillData,
                            theme: 'grid',
                            headStyles: { fillColor: [79, 70, 229] },
                            styles: { fontSize: 8, cellPadding: 2 },
                            margin: { left: 14, right: 14 }
                        });
                    }
                }
            );
            addToast("Rapport généré avec succès", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Continuity.generateReport', 'REPORT_GENERATION_FAILED');
            addToast("Erreur lors de la génération du rapport", "error");
        }
    };


    // ... rest of the component code (openInspector, CRUD, etc.) ...
    // Including the rest of the file content to ensure integrity

    const openInspector = async (proc: BusinessProcess) => {
        setSelectedProcess(proc);
        setInspectorTab('details');


        try {
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user?.organizationId), limit(50));
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => d.data() as SystemLog);

            const relevantLogs = logs.filter(l => l.resource === 'BCP' && l.details?.includes(proc.name));
            relevantLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setProcessHistory(relevantLogs);
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Continuity.openInspector', 'FETCH_FAILED'); }
    };

    const handleCreateProcess = async (data: BusinessProcessFormData) => {
        if (!canEdit || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'business_processes'), { ...data, organizationId: user.organizationId });
            await logAction(user, 'CREATE', 'BCP', `Nouveau Processus: ${data.name} `);
            addToast("Processus créé", "success");
            setShowCreateModal(false);
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Continuity.handleCreateProcess', 'CREATE_FAILED'); }
    };

    const handleUpdateProcess = async (data: BusinessProcessFormData) => {
        if (!canEdit || !selectedProcess) return;
        try {
            await updateDoc(doc(db, 'business_processes', selectedProcess.id), data);
            await logAction(user, 'UPDATE', 'BCP', `MAJ Processus: ${data.name} `);

            setSelectedProcess({ ...selectedProcess, ...data });
            addToast("Processus mis à jour", "success");
            // Close create modal if it was open (reusing same modal state logic if we had one for edit)
            // But we will use showCreateModal for create and a new state for edit?
            // Logic below will clarify.
            setShowCreateModal(false);
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Continuity.handleUpdateProcess', 'UPDATE_FAILED'); }
    };

    const initiateDelete = (id: string, name: string) => {
        if (!canEdit) return;
        setConfirmData({
            isOpen: true,
            title: "Supprimer le processus ?",
            message: "Le processus et son historique seront supprimés.",
            onConfirm: () => handleDeleteProcess(id, name)
        });
    };

    const handleDeleteProcess = async (id: string, name: string) => {
        if (!canEdit) return;
        try {
            await deleteDoc(doc(db, 'business_processes', id));

            setSelectedProcess(null);
            await logAction(user, 'DELETE', 'BCP', `Suppression: ${name} `);
            addToast("Processus supprimé", "info");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Continuity.handleDeleteProcess', 'DELETE_FAILED'); }
    };

    const openDrillModal = () => {
        drillForm.reset({
            processId: selectedProcess?.id || processes[0]?.id || '',
            date: new Date().toISOString().split('T')[0],
            type: 'Tabletop',
            result: 'Succès',
            notes: ''
        });
        setShowDrillModal(true);
    };

    const handleSubmitDrill: SubmitHandler<BcpDrillFormData> = async (data) => {
        if (!canEdit || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'bcp_drills'), { ...data, organizationId: user.organizationId, createdAt: new Date().toISOString() });
            if (data.processId) {
                await updateDoc(doc(db, 'business_processes', data.processId), { lastTestDate: data.date });
            }
            await logAction(user, 'CREATE', 'BCP', 'Nouvel exercice de crise');
            addToast("Exercice enregistré", "success");
            setShowDrillModal(false);
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Continuity.handleSubmitDrill', 'CREATE_FAILED'); }
    };

    const handleExportCSV = () => {
        const headers = ["Processus", "Priorité", "RTO", "RPO", "Responsable", "Dernier Test"];
        const rows = processes.map(p => [
            p.name,
            p.priority,
            p.rto,
            p.rpo,
            p.owner,
            p.lastTestDate ? new Date(p.lastTestDate).toLocaleDateString('fr-FR') : 'Jamais'
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `bia_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };



    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'Critique': return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30';
            case 'Elevée': return 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/30';
            case 'Moyenne': return 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/30';
            default: return 'bg-blue-50 dark:bg-slate-900 text-blue-700 border-blue-100 dark:bg-slate-900/20 dark:text-blue-400 dark:border-blue-900/30';
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative">
            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <PageHeader
                title="Continuité d'Activité"
                subtitle="Business Impact Analysis (BIA) et Exercices de crise (ISO 27001 A.5.29)."
                breadcrumbs={[
                    { label: 'Continuité' }
                ]}
                icon={<HeartPulse className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={
                    <div className="flex gap-3">
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 font-medium"
                        >
                            <FileSpreadsheet size={18} />
                            Export BIA
                        </button>
                        <button
                            onClick={generateReport}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 font-medium"
                        >
                            <Download size={18} />
                            Exporter Rapport
                        </button>
                        {canEdit && (
                            <>
                                <button
                                    onClick={() => setShowDrillModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors font-medium border border-indigo-100"
                                >
                                    <Zap size={18} />
                                    Nouvel Exercice
                                </button>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-medium shadow-lg shadow-rose-500/20"
                                >
                                    <Plus size={18} />
                                    Nouveau Processus
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {/* Summary Card */}
            <div className="glass-panel p-6 md:p-7 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group mb-8">
                <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
                </div>

                {/* Global Score */}
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90" style={{ overflow: 'visible' }}>
                            <circle
                                className="text-slate-100 dark:text-slate-800"
                                strokeWidth="8"
                                stroke="currentColor"
                                fill="transparent"
                                r="44"
                                cx="48"
                                cy="48"
                            />
                            <circle
                                className={`${coverageRate >= 80 ? 'text-emerald-500' : coverageRate >= 50 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                                strokeWidth="8"
                                strokeDasharray={276}
                                strokeDashoffset={276 - (276 * coverageRate) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="44"
                                cx="48"
                                cy="48"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-xl font-black text-slate-900 dark:text-white">{Math.round(coverageRate)}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Couverture des Tests</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px]">
                            Pourcentage de processus testés au cours des 12 derniers mois.
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-slate-200 dark:border-white/10 px-6 mx-2">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <HeartPulse className="h-4 w-4 text-slate-400" />
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{totalProcesses}</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <ShieldAlert className="h-4 w-4 text-slate-400" />
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critiques</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{criticalProcesses}</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Zap className="h-4 w-4 text-slate-400" />
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Exercices</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{drills.length}</div>
                    </div>
                </div>

                {/* Alerts/Status */}
                <div className="flex flex-col gap-3 min-w-[180px]">
                    <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Tests Expirés</span>
                        </div>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-400">{overdueTests}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                            <span className="text-xs font-bold text-red-700 dark:text-red-300">Échecs</span>
                        </div>
                        <span className="text-sm font-black text-red-700 dark:text-red-400">{failedDrills}</span>
                    </div>
                </div>
            </div>

            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit border border-slate-200 dark:border-white/5">
                <button onClick={() => setActiveTab('bia')} className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'bia' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    Analyse d'Impact (BIA)
                </button>
                <button onClick={() => setActiveTab('drills')} className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'drills' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    Exercices & Tests
                </button>
            </div>

            {activeTab === 'bia' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {loading ? (
                        <CardSkeleton count={6} />
                    ) : processes.length === 0 ? (
                        <div className="col-span-full">
                            <EmptyState
                                icon={HeartPulse}
                                title="Aucun processus défini"
                                description="Commencez par définir vos processus critiques pour l'analyse d'impact (BIA)."
                                actionLabel="Nouveau Processus"
                                onAction={() => {
                                    setShowCreateModal(true);
                                }}
                            />
                        </div>
                    ) : (
                        processes.map(proc => {
                            const lastTest = proc.lastTestDate ? new Date(proc.lastTestDate) : null;
                            const isOverdue = lastTest ? (new Date().getTime() - lastTest.getTime() > 31536000000) : true; // 1 year

                            return (
                                <div key={proc.id} onClick={() => openInspector(proc)} className="glass-panel rounded-[2.5rem] p-7 shadow-sm hover:shadow-apple transition-all duration-300 hover:-translate-y-1 relative group flex flex-col cursor-pointer border border-white/50 dark:border-white/5">
                                    <div className="flex justify-between items-start mb-5">
                                        <div className="p-3 bg-rose-50 dark:bg-slate-800 rounded-2xl text-rose-600 shadow-inner">
                                            <HeartPulse className="h-6 w-6" />
                                        </div>
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getPriorityColor(proc.priority)}`}>
                                            {proc.priority}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">{proc.name}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 flex-1 leading-relaxed">{proc.description}</p>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-gray-100 dark:border-white/5 text-center">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">RTO (Temps)</span>
                                            <span className="text-3xl font-black text-slate-800 dark:text-white">{proc.rto}</span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-gray-100 dark:border-white/5 text-center">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">RPO (Données)</span>
                                            <span className="text-3xl font-black text-slate-800 dark:text-white">{proc.rpo}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-4 border-t border-dashed border-gray-200 dark:border-white/10">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center font-bold text-slate-400 uppercase tracking-wide"><LayoutDashboard className="h-3 w-3 mr-1.5" /> Responsable</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{proc.owner}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center font-bold text-slate-400 uppercase tracking-wide"><Server className="h-3 w-3 mr-1.5" /> Dépendances</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{proc.supportingAssetIds?.length || 0} actifs</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center font-bold text-slate-400 uppercase tracking-wide"><ClipboardCheck className="h-3 w-3 mr-1.5" /> Dernier Test</span>
                                            <span className={`font-bold px-2 py-0.5 rounded ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                {proc.lastTestDate ? new Date(proc.lastTestDate).toLocaleDateString() : 'Jamais'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}

            {activeTab === 'drills' && (
                loading ? (
                    <TableSkeleton rows={5} columns={5} />
                ) : drills.length === 0 ? (
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden shadow-sm border border-white/50 dark:border-white/5">
                        <EmptyState
                            icon={Zap}
                            title="Aucun exercice enregistré"
                            description="Enregistrez vos exercices de crise (Tabletop, Simulation...) pour valider votre PCA."
                            actionLabel="Nouvel Exercice"
                            onAction={() => openDrillModal()}
                        />
                    </div>
                ) : (
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden shadow-sm border border-white/50 dark:border-white/5">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-gray-100 dark:border-white/5 text-slate-400 font-bold uppercase text-[10px] tracking-widest backdrop-blur-sm">
                                    <tr>
                                        <th className="px-8 py-5">Date</th>
                                        <th className="px-6 py-5">Processus testé</th>
                                        <th className="px-6 py-5">Type d'exercice</th>
                                        <th className="px-6 py-5">Résultat</th>
                                        <th className="px-6 py-5">Notes / Preuves</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {drills.map(drill => {
                                        const proc = processes.find(p => p.id === drill.processId);
                                        return (
                                            <tr key={drill.id} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors group">
                                                <td className="px-8 py-5 text-slate-900 dark:text-white font-bold flex items-center">
                                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-xl mr-3 shadow-sm border border-gray-100 dark:border-white/5 group-hover:scale-110 transition-transform">
                                                        <CalendarDays className="h-4 w-4 text-slate-500" />
                                                    </div>
                                                    {new Date(drill.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-5 font-medium text-slate-600 dark:text-slate-300">
                                                    {proc ? proc.name : 'Inconnu'}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold border border-gray-200 dark:border-white/5 shadow-sm">
                                                        {drill.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`flex items-center w-fit px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${drill.result === 'Succès' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' : drill.result === 'Échec' ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30' : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30'}`}>
                                                        {drill.result === 'Succès' ? <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />}
                                                        {drill.result}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-slate-500 dark:text-slate-400 truncate max-w-xs font-medium">{drill.notes}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {/* Inspector Drawer */}
            {/* Inspector Drawer */}
            <Drawer
                isOpen={!!selectedProcess}
                onClose={() => setSelectedProcess(null)}
                title={selectedProcess?.name || ''}
                subtitle={selectedProcess?.priority}
                actions={
                    <div className="flex gap-2">
                        {canEdit && (
                            <button onClick={() => setShowEditModal(true)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"><Edit className="h-4 w-4" /></button>
                        )}
                        {canEdit && (
                            <button onClick={() => selectedProcess && initiateDelete(selectedProcess.id, selectedProcess.name)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                        )}
                    </div>
                }
                width="max-w-6xl"
            >
                {selectedProcess && (
                    <div className="flex flex-col h-full">

                        <div className="px-8 border-b border-gray-100 dark:border-white/5 flex gap-8 bg-white/30 dark:bg-white/5">
                            {[
                                { id: 'details', label: 'Détails', icon: LayoutDashboard },
                                { id: 'recovery', label: 'Plan de Reprise', icon: ClipboardCheck },
                                { id: 'scenarios', label: 'Scénarios (Risques)', icon: ShieldAlert },
                                { id: 'drills', label: 'Exercices', icon: Zap },
                                { id: 'history', label: 'Historique', icon: History },
                                { id: 'comments', label: 'Discussion', icon: MessageSquare },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setInspectorTab(tab.id as typeof inspectorTab)}
                                    className={`py-4 text-sm font-semibold flex items-center border-b-2 transition-all ${inspectorTab === tab.id ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    <tab.icon className={`h-4 w-4 mr-2.5 ${inspectorTab === tab.id ? 'text-brand-500' : 'opacity-70'}`} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
                            {inspectorTab === 'details' && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm text-center">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">RTO (Objectif Temps)</span>
                                            <span className="text-3xl font-black text-slate-800 dark:text-white">{selectedProcess.rto}</span>
                                        </div>
                                        <div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm text-center">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">RPO (Objectif Données)</span>
                                            <span className="text-3xl font-black text-slate-800 dark:text-white">{selectedProcess.rpo}</span>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Description</h4>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedProcess.description}</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Dépendances Techniques</h4>
                                            {selectedProcess.supportingAssetIds && selectedProcess.supportingAssetIds.length > 0 ? (
                                                <div className="space-y-2">
                                                    {selectedProcess.supportingAssetIds.map(assetId => {
                                                        const a = assets.find(as => as.id === assetId);
                                                        return a ? (
                                                            <div key={assetId} className="flex items-center p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                                <Server className="h-4 w-4 mr-3 text-slate-400" />
                                                                <span className="text-sm font-medium text-slate-700 dark:text-white">{a.name}</span>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>
                                            ) : <p className="text-sm text-slate-400 italic">Aucune dépendance déclarée.</p>}
                                        </div>
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Fournisseurs Critiques</h4>
                                            {selectedProcess.supplierIds && selectedProcess.supplierIds.length > 0 ? (
                                                <div className="space-y-2">
                                                    {selectedProcess.supplierIds.map(sid => {
                                                        const s = suppliers.find(sup => sup.id === sid);
                                                        return s ? (
                                                            <div key={sid} className="flex items-center p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                                <Truck className="h-4 w-4 mr-3 text-slate-400" />
                                                                <span className="text-sm font-medium text-slate-700 dark:text-white">{s.name}</span>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>
                                            ) : <p className="text-sm text-slate-400 italic">Aucun fournisseur lié.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {inspectorTab === 'recovery' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Plan de Reprise (DRP)</h3>
                                    </div>

                                    <div className="space-y-4">
                                        {selectedProcess.recoveryTasks && selectedProcess.recoveryTasks.length > 0 ? (
                                            selectedProcess.recoveryTasks.sort((a, b) => a.order - b.order).map((task, index) => (
                                                <div key={task.id} className="flex items-start gap-4 p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 flex items-center justify-center font-bold text-sm">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{task.title}</h4>
                                                        <div className="flex gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                            <span className="flex items-center"><Server className="h-3 w-3 mr-1" /> {task.owner}</span>
                                                            <span className="flex items-center"><History className="h-3 w-3 mr-1" /> {task.duration}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <EmptyState
                                                icon={ClipboardCheck}
                                                title="Aucun plan de reprise"
                                                description="Définissez les étapes de reprise pour ce processus."
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            {inspectorTab === 'scenarios' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Scénarios de Risque</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {selectedProcess.relatedRiskIds && selectedProcess.relatedRiskIds.length > 0 ? (
                                            selectedProcess.relatedRiskIds.map(rid => {
                                                const risk = risks.find(r => r.id === rid);
                                                return risk ? (
                                                    <div key={rid} className="p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex justify-between items-center">
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{risk.threat}</h4>
                                                            <p className="text-xs text-slate-500">{risk.vulnerability}</p>
                                                        </div>
                                                        <div className={`px-3 py-1 rounded-lg text-xs font-bold ${risk.score >= 15 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                                            Score: {risk.score}
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })
                                        ) : (
                                            <EmptyState
                                                icon={ShieldAlert}
                                                title="Aucun scénario lié"
                                                description="Liez des risques existants à ce processus pour analyser les impacts."
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            {inspectorTab === 'drills' && (
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Historique des exercices</h3>
                                    {drills.filter(d => d.processId === selectedProcess.id).length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 bg-white dark:bg-slate-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-white/10 italic">Aucun test effectué pour ce processus.</div>
                                    ) : (
                                        drills.filter(d => d.processId === selectedProcess.id).map(drill => (
                                            <div key={drill.id} className="bg-white dark:bg-slate-800/50 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center"><CalendarDays className="h-3.5 w-3.5 mr-2 text-slate-400" /> {new Date(drill.date).toLocaleDateString()}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${drill.result === 'Succès' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{drill.result}</span>
                                                </div>
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{drill.type}</p>
                                                <p className="text-sm text-slate-600 dark:text-slate-300">{drill.notes}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {inspectorTab === 'history' && (
                                <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                    {processHistory.map((log, i) => (
                                        <div key={i} className="relative">
                                            <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-brand-900">
                                                <div className="h-2 w-2 rounded-full bg-brand-600"></div>
                                            </span>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.details}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">Par: {log.userEmail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {inspectorTab === 'comments' && (
                                <div className="h-full flex flex-col">
                                    <Comments collectionName="business_processes" documentId={selectedProcess.id} />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Drawer>


            {/* Create Process Modal */}


            {/* Drill Modal */}
            {/* Drill Drawer */}
            <Drawer
                isOpen={showDrillModal}
                onClose={() => setShowDrillModal(false)}
                title="Enregistrer un exercice"
                subtitle="Documentez vos tests de continuité."
                width="max-w-4xl"
            >
                <form onSubmit={drillForm.handleSubmit(handleSubmitDrill)} className="p-8 space-y-5">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Processus Testé</label>
                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                            {...drillForm.register('processId')}>
                            {processes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Date</label>
                                {watchedDrillDate && (
                                    <AddToCalendar
                                        event={{
                                            title: `Exercice BCP : ${watchedDrillType || 'Non défini'}`,
                                            description: `Exercice de continuité pour le processus : ${processes.find(p => p.id === watchedDrillProcessId)?.name || 'Inconnu'}`,
                                            start: new Date(watchedDrillDate),
                                            end: new Date(watchedDrillDate),
                                            location: 'Sentinel GRC'
                                        }}
                                        className="scale-75 origin-right"
                                    />
                                )}
                            </div>
                            <input type="date" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                {...drillForm.register('date')} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Type</label>
                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                                {...drillForm.register('type')}>
                                {['Tabletop', 'Simulation', 'Bascule réelle'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Résultat</label>
                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                            {...drillForm.register('result')}>
                            {['Succès', 'Succès partiel', 'Échec'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Notes / Observations</label>
                        <textarea rows={3} className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium resize-none"
                            {...drillForm.register('notes')} placeholder="Le RTO a-t-il été respecté ?" />
                    </div>
                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button type="button" onClick={() => setShowDrillModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform font-bold text-sm shadow-lg">Enregistrer</button>
                    </div>
                </form>
            </Drawer>
            {/* Create Process Modal */}
            <ProcessFormModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateProcess}
                assets={assets}
                suppliers={suppliers}
                risks={risks}
                users={usersList}
                isEditing={false}
                title="Nouveau Processus"
            />

            {/* Edit Process Modal */}
            <ProcessFormModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                onSubmit={handleUpdateProcess}
                assets={assets}
                suppliers={suppliers}
                risks={risks}
                users={usersList}
                initialData={selectedProcess || undefined}
                isEditing={true}
                title="Modifier le Processus"
            />
        </div >
    );
};
