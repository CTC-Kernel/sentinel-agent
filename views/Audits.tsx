import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Controller } from 'react-hook-form';
import { FloatingLabelTextarea } from '../components/ui/FloatingLabelTextarea';
import { FloatingLabelSelect } from '../components/ui/FloatingLabelSelect';
import { SeveritySelector } from '../components/audits/SeveritySelector';
import { FileUploader } from '../components/ui/FileUploader';
import { AIAssistButton } from '../components/ai/AIAssistButton';
import { collection, addDoc, getDocs, query, doc, deleteDoc, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Audit, Finding, Control, UserProfile, AuditChecklist, AuditQuestion, Document, Asset, Risk } from '../types';
import { canEditResource } from '../utils/permissions';
import { Plus, Activity, Search, Trash2, FileSpreadsheet, CalendarDays, User, AlertOctagon, X, Download, ShieldAlert, ClipboardCheck, Link, Server, Flame, FolderKanban, CheckCheck, CheckSquare, Target } from '../components/ui/Icons';
import { AuditFormModal } from '../components/audits/AuditFormModal';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { sendEmail } from '../services/emailService';
import { getAuditReminderTemplate } from '../services/emailTemplates';
import { generateICS, downloadICS } from '../utils/calendar';
import JSZip from 'jszip';
import { ErrorLogger } from '../services/errorLogger';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuditFormData, findingSchema, FindingFormData } from '../schemas/auditSchema';

export const Audits: React.FC = () => {
    const { user, addToast } = useStore();
    const canEdit = canEditResource(user, 'Audit');

    // Data Fetching with Hooks
    const { data: rawAudits, loading: auditsLoading, refresh: refreshAudits } = useFirestoreCollection<Audit>(
        'audits',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: rawControls, loading: controlsLoading } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: rawAssets, loading: assetsLoading } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: rawRisks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: documents, loading: docsLoading } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    // Derived State
    const audits = React.useMemo(() => {
        return [...rawAudits].sort((a, b) => new Date(b.dateScheduled).getTime() - new Date(a.dateScheduled).getTime());
    }, [rawAudits]);

    const controls = React.useMemo(() => {
        return [...rawControls].sort((a, b) => a.code.localeCompare(b.code));
    }, [rawControls]);

    const assets = React.useMemo(() => {
        return [...rawAssets].sort((a, b) => a.name.localeCompare(b.name));
    }, [rawAssets]);

    const risks = React.useMemo(() => {
        return [...rawRisks].sort((a, b) => b.score - a.score);
    }, [rawRisks]);

    const loading = auditsLoading || controlsLoading || assetsLoading || risksLoading || usersLoading || docsLoading;

    const [showModal, setShowModal] = useState(false);
    const [filter, setFilter] = useState('');

    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
    const [findings, setFindings] = useState<Finding[]>([]);
    const [showFindingsDrawer, setShowFindingsDrawer] = useState(false);
    const [checklist, setChecklist] = useState<AuditChecklist | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'findings' | 'checklist' | 'scope'>('findings');

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });



    const findingForm = useForm<FindingFormData>({
        resolver: zodResolver(findingSchema) as any,
        defaultValues: {
            description: '',
            type: 'Mineure',
            status: 'Ouvert',
            relatedControlId: '',
            evidenceIds: []
        }
    });
    const location = useLocation();

    const handleEvidenceUpload = async (url: string, fileName: string) => {
        if (!user?.organizationId || !selectedAudit) return;
        try {
            // Auto-create Document
            const docRef = await addDoc(collection(db, 'documents'), {
                title: `Preuve - ${fileName} `,
                type: 'Preuve',
                version: '1.0',
                status: 'Publié',
                url: url,
                organizationId: user.organizationId,
                owner: user.displayName || user.email,
                ownerId: user.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                relatedAuditIds: [selectedAudit.id]
            });

            // Link to new finding
            const currentIds = findingForm.getValues('evidenceIds') || [];
            findingForm.setValue('evidenceIds', [...currentIds, docRef.id]);
            addToast("Preuve téléversée et liée", "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Audits.handleEvidenceUpload', 'FILE_UPLOAD_FAILED');
            addToast("Erreur création document preuve", "error");
        }
    };

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || audits.length === 0) return;
        const audit = audits.find(a => a.id === state.voxelSelectedId);
        if (audit) {
            handleOpenAudit(audit);
        }
    }, [location.state, loading, audits]);

    const handleOpenAudit = async (audit: Audit) => {
        setSelectedAudit(audit);
        setShowFindingsDrawer(true);
        findingForm.reset({ description: '', type: 'Mineure', status: 'Ouvert', relatedControlId: '', evidenceIds: [] });
        try {
            const q = query(collection(db, 'findings'), where('organizationId', '==', user?.organizationId), where('auditId', '==', audit.id));
            const snap = await getDocs(q);
            setFindings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Finding)));

            const cq = query(collection(db, 'audit_checklists'), where('auditId', '==', audit.id));
            const cSnap = await getDocs(cq);
            if (!cSnap.empty) setChecklist({ id: cSnap.docs[0].id, ...cSnap.docs[0].data() } as AuditChecklist);
            else setChecklist(null);
        } catch (_error) {
            setFindings([]);
            setChecklist(null);
        }
    };

    const handleCreateAudit: SubmitHandler<AuditFormData> = async (data) => {
        if (!canEdit || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'audits'), { ...data, organizationId: user.organizationId, findingsCount: 0 });
            await logAction(user, 'CREATE', 'Audit', `Nouvel audit: ${data.name} `);

            // Send notification
            if (data.auditor) {
                const auditorUser = usersList.find(u => u.displayName === data.auditor);
                if (auditorUser) {
                    const emailContent = getAuditReminderTemplate(
                        data.name || 'Audit',
                        auditorUser.displayName || 'Auditeur',
                        data.dateScheduled || '',
                        'https://sentinel-grc.web.app/audits'
                    );
                    await sendEmail(user, {
                        to: auditorUser.email,
                        subject: `[Sentinel] Nouvel audit assigné: ${data.name} `,
                        html: emailContent,
                        type: 'AUDIT_REMINDER'
                    });
                }
            }

            addToast("Audit planifié et notifié", "success");
            setShowModal(false);
            refreshAudits();
        } catch (_e) { addToast("Erreur création audit", "error"); }
    };

    const handleAddFinding: SubmitHandler<FindingFormData> = async (data) => {
        if (!canEdit || !selectedAudit || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'findings'), {
                ...data,
                organizationId: user.organizationId,
                auditId: selectedAudit.id,
                createdAt: new Date().toISOString()
            });

            const newCount = findings.length + 1;
            await updateDoc(doc(db, 'audits', selectedAudit.id), { findingsCount: newCount });
            refreshAudits();

            const q = query(collection(db, 'findings'), where('organizationId', '==', user.organizationId), where('auditId', '==', selectedAudit.id));
            const snap = await getDocs(q);
            setFindings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Finding)));

            findingForm.reset({ description: '', type: 'Mineure', status: 'Ouvert', relatedControlId: '', evidenceIds: [] });
            addToast("Constat ajouté", "success");
        } catch (_e) { addToast("Erreur ajout constat", "error"); }
    };

    const initiateDeleteFinding = (findingId: string) => {
        if (!canEdit || !selectedAudit) return;
        setConfirmData({
            isOpen: true,
            title: "Supprimer le constat ?",
            message: "Cette action est définitive.",
            onConfirm: () => handleDeleteFinding(findingId)
        });
    };

    const handleDeleteFinding = async (findingId: string) => {
        if (!selectedAudit) return;
        try {
            await deleteDoc(doc(db, 'findings', findingId));
            const newCount = Math.max(0, findings.length - 1);
            await updateDoc(doc(db, 'audits', selectedAudit.id), { findingsCount: newCount });
            refreshAudits();
            setFindings(prev => prev.filter(f => f.id !== findingId));
            addToast("Constat supprimé", "info");
        } catch (_e) { addToast("Erreur suppression", "error"); }
    };

    const initiateDeleteAudit = (id: string, name: string) => {
        if (!canEdit) return;
        setConfirmData({
            isOpen: true,
            title: "Supprimer l'audit ?",
            message: "L'audit et tous ses constats seront supprimés.",
            onConfirm: () => handleDeleteAudit(id, name)
        });
    };

    const handleDeleteAudit = async (id: string, name: string) => {
        try {
            // Delete findings first (Cascade)
            const findingsQ = query(collection(db, 'findings'), where('auditId', '==', id));
            const findingsSnap = await getDocs(findingsQ);

            // Actually, let's use Promise.all for simplicity or import writeBatch
            const deletePromises = findingsSnap.docs.map(d => deleteDoc(doc(db, 'findings', d.id)));
            await Promise.all(deletePromises);

            await deleteDoc(doc(db, 'audits', id));
            refreshAudits();
            if (selectedAudit?.id === id) {
                setSelectedAudit(null);
                setShowFindingsDrawer(false);
            }
            await logAction(user, 'DELETE', 'Audit', `Suppression audit: ${name} `);
            addToast("Audit et constats supprimés", "info");
        } catch (_e) { addToast("Erreur suppression", "error"); }
    };

    const generateChecklist = async () => {
        if (!selectedAudit || !user?.organizationId) return;
        try {
            const scopeControlIds = selectedAudit.relatedControlIds || [];
            const controlsToAudit = scopeControlIds.length > 0
                ? controls.filter(c => scopeControlIds.includes(c.id))
                : controls;

            const questions: AuditQuestion[] = controlsToAudit.map(c => ({
                id: Math.random().toString(36).substr(2, 9),
                controlCode: c.code,
                question: `Le contrôle ${c.code} (${c.name}) est - il implémenté et efficace ? `,
                response: 'Non-applicable'
            }));

            const newChecklist = {
                auditId: selectedAudit.id,
                organizationId: user.organizationId,
                questions,
                completedBy: user.email,
                completedAt: new Date().toISOString()
            };

            const ref = await addDoc(collection(db, 'audit_checklists'), newChecklist);
            setChecklist({ ...newChecklist, id: ref.id });
            addToast("Checklist générée", "success");
        } catch (_e) { addToast("Erreur génération checklist", "error"); }
    };

    const handleChecklistAnswer = async (questionId: string, response: AuditQuestion['response'], comment?: string) => {
        if (!checklist) return;
        const updatedQuestions = checklist.questions.map(q => q.id === questionId ? { ...q, response, comment: comment !== undefined ? comment : q.comment } : q);
        setChecklist({ ...checklist, questions: updatedQuestions });
        // Debounced save could be better, but direct update for now
        try {
            await updateDoc(doc(db, 'audit_checklists', checklist.id), { questions: updatedQuestions });
        } catch (e) { ErrorLogger.error(e, 'Audits.handleChecklistAnswer'); }
    };

    const markAllConform = async () => {
        if (!checklist) return;
        const updatedQuestions = checklist.questions.map(q => ({ ...q, response: 'Conforme' as const }));
        setChecklist({ ...checklist, questions: updatedQuestions });
        try {
            await updateDoc(doc(db, 'audit_checklists', checklist.id), { questions: updatedQuestions });
            addToast("Tout marqué comme conforme", "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Audits.markAllConform', 'UPDATE_FAILED'); }
    };

    const handleExportCSV = () => {
        const headers = ["Audit", "Type", "Auditeur", "Date", "Statut", "Écarts"];
        const rows = filteredAudits.map(a => [
            a.name,
            a.type,
            a.auditor,
            new Date(a.dateScheduled).toLocaleDateString(),
            a.status,
            a.findingsCount.toString()
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `audits_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleExportCalendar = () => {
        const events = filteredAudits.map(audit => ({
            title: `Audit: ${audit.name} `,
            description: `Type: ${audit.type} | Auditeur: ${audit.auditor} | Statut: ${audit.status} `,
            startDate: new Date(audit.dateScheduled),
            location: 'Sentinel GRC'
        }));
        const icsContent = generateICS(events);
        downloadICS(`audits_calendar_${new Date().toISOString().split('T')[0]}.ics`, icsContent);
        addToast("Calendrier exporté", "success");
    };

    const generateSoA = () => {
        if (!selectedAudit || !checklist) return;
        const doc = new jsPDF();
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text("Statement of Applicability (SoA)", 14, 25);
        doc.setFontSize(10);
        doc.text(`Audit: ${selectedAudit.name} | Date: ${new Date().toLocaleDateString()} `, 14, 33);

        const data = checklist.questions.map(q => [q.controlCode, q.response, q.comment || '']);
        (doc as jsPDF & { autoTable: any }).autoTable({
            startY: 50,
            head: [['Contrôle', 'Statut', 'Justification']],
            body: data,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] }
        });
        doc.save('SoA.pdf');
    };

    const generateAuditReport = () => {
        if (!selectedAudit) return;
        const doc = new jsPDF();

        // Title Header
        doc.setFillColor(79, 70, 229); // Indigo
        doc.rect(0, 0, 210, 40, 'F');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text(`Rapport d'Audit: ${selectedAudit.name}`, 14, 25);

        doc.setFontSize(10);
        doc.setTextColor(220);
        doc.text(`Auditeur: ${selectedAudit.auditor} | Date: ${new Date(selectedAudit.dateScheduled).toLocaleDateString()}`, 14, 33);

        // Stats Summary
        const major = findings.filter(f => f.type === 'Majeure').length;
        const minor = findings.filter(f => f.type === 'Mineure').length;
        const open = findings.filter(f => f.status === 'Ouvert').length;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text("Synthèse des résultats", 14, 55);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Total Constats: ${findings.length}`, 14, 62);
        doc.text(`Écarts Majeurs: ${major}`, 14, 67);
        doc.text(`Écarts Mineurs: ${minor}`, 14, 72);
        doc.text(`Non résolus (Ouverts): ${open}`, 14, 77);

        // Table
        const rows = findings.map(f => [
            f.type,
            f.description,
            f.relatedControlId ? controls.find(c => c.id === f.relatedControlId)?.code || '-' : '-',
            f.status
        ]);

        (doc as jsPDF & { autoTable: any }).autoTable({
            startY: 85,
            head: [['Type', 'Description', 'Contrôle Lié', 'Statut']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] }, // Indigo
            columnStyles: { 1: { cellWidth: 80 } },
            styles: { fontSize: 9 }
        });

        const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text('Rapport généré par Sentinel GRC (Cyber Threat Consulting)', 14, 285);
            doc.text(`Page ${i} / ${pageCount}`, 190, 285, { align: 'right' });
        }

        doc.save(`Audit_Report_${selectedAudit.name.replace(/\s+/g, '_')}.pdf`);
    };

    const handleExportPack = async () => {
        if (!selectedAudit) return;
        addToast("Génération du pack en cours...", "info");
        try {
            const zip = new JSZip();
            const folder = zip.folder(`Audit_Pack_${selectedAudit.name.replace(/\s+/g, '_')}`);
            if (!folder) return;

            // 1. Generate Report PDF
            const doc = new jsPDF();
            doc.setFillColor(79, 70, 229); doc.rect(0, 0, 210, 40, 'F');
            doc.setFontSize(18); doc.setTextColor(255, 255, 255); doc.text(`Rapport d'Audit: ${selectedAudit.name}`, 14, 25);
            doc.setFontSize(10); doc.setTextColor(220); doc.text(`Auditeur: ${selectedAudit.auditor} | Date: ${new Date(selectedAudit.dateScheduled).toLocaleDateString()}`, 14, 33);

            const rows = findings.map(f => [f.type, f.description, f.relatedControlId ? controls.find(c => c.id === f.relatedControlId)?.code || '-' : '-', f.status]);
            (doc as jsPDF & { autoTable: any }).autoTable({ startY: 50, head: [['Type', 'Description', 'Contrôle', 'Statut']], body: rows, theme: 'striped', headStyles: { fillColor: [79, 70, 229] } });

            const pdfBlob = doc.output('blob');
            folder.file(`Rapport_Audit.pdf`, pdfBlob);

            // 2. Fetch Evidence Files
            const evidenceIds = new Set<string>();
            findings.forEach(f => f.evidenceIds?.forEach(id => evidenceIds.add(id)));

            if (evidenceIds.size > 0) {
                const evidenceFolder = folder.folder("Preuves");
                const evidenceDocs = documents.filter(d => evidenceIds.has(d.id));

                await Promise.all(evidenceDocs.map(async (d) => {
                    if (!d.url) return;
                    try {
                        const response = await fetch(d.url);
                        const blob = await response.blob();
                        evidenceFolder?.file(`${d.title.replace(/[^a-z0-9]/gi, '_')}.pdf`, blob); // Assuming PDF or appending extension based on type if possible
                    } catch (e) {
                        ErrorLogger.error(e, 'Audits.handleExportPack.fetchEvidence', { metadata: { title: d.title } });
                    }
                }));
            }

            // 3. Generate Zip
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `Audit_Pack_${selectedAudit.name}.zip`;
            link.click();
            addToast("Pack d'audit téléchargé", "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Audits.handleExportPack', 'FETCH_FAILED');
            addToast("Erreur lors de l'export du pack", "error");
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Planifié': return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30';
            case 'En cours': return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30';
            case 'Terminé': return 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30';
            case 'Validé': return 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/30';
            default: return 'bg-gray-50 text-gray-700 border-gray-100 dark:bg-gray-800 dark:text-gray-400';
        }
    };

    const filteredAudits = audits.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()));

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
                title="Audits & Contrôles"
                subtitle="Planification et suivi des audits de sécurité (ISO 27001 A.9.2)."
                breadcrumbs={[
                    { label: 'Audits' }
                ]}
                icon={<ClipboardCheck className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={canEdit && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                    >
                        <Plus className="h-4 w-4 mr-2" /> Nouvel Audit
                    </button>
                )}
            />

            <div className="glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
                <Search className="h-5 w-5 text-gray-400" />
                <input type="text" placeholder="Rechercher un audit..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400"
                    value={filter} onChange={e => setFilter(e.target.value)} />
                <button onClick={handleExportCSV} className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors" title="Exporter CSV">
                    <FileSpreadsheet className="h-4 w-4" />
                </button>
                <button onClick={handleExportCalendar} className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors" title="Exporter Calendrier">
                    <CalendarDays className="h-4 w-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full"><CardSkeleton count={3} /></div>
                ) : filteredAudits.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            icon={Activity}
                            title="Aucun audit planifié"
                            description={filter ? "Aucun audit ne correspond à votre recherche." : "Planifiez des audits réguliers pour assurer la conformité continue."}
                            actionLabel={filter ? undefined : "Planifier un audit"}
                            onAction={filter ? undefined : () => setShowModal(true)}
                        />
                    </div>
                ) : (
                    filteredAudits.map(audit => (
                        <div key={audit.id} onClick={() => handleOpenAudit(audit)} className="glass-panel rounded-[2.5rem] p-7 shadow-sm card-hover cursor-pointer group border border-white/50 dark:border-white/5">
                            <div className="flex justify-between items-start mb-5">
                                <div className="p-3 bg-indigo-50 dark:bg-slate-800 rounded-2xl text-indigo-600 shadow-inner">
                                    <Activity className="h-6 w-6" />
                                </div>
                                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(audit.status)}`}>
                                    {audit.status}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">{audit.name}</h3>
                            <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 mb-4">
                                <User className="h-3.5 w-3.5 mr-2" /> {audit.auditor}
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t border-dashed border-gray-200 dark:border-white/10 mt-auto">
                                <div className="flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
                                    <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> {new Date(audit.dateScheduled).toLocaleDateString() || 'Non planifié'}
                                </div>
                                <div className="flex items-center text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">
                                    <AlertOctagon className="h-3.5 w-3.5 mr-1.5" /> {audit.findingsCount} écarts
                                </div>
                            </div>

                            {canEdit && (
                                <button onClick={(e) => { e.stopPropagation(); initiateDeleteAudit(audit.id, audit.name) }} className="absolute top-6 right-6 p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl text-slate-400 hover:text-red-50 shadow-sm backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Findings Drawer */}
            {showFindingsDrawer && selectedAudit && createPortal(
                <div className="fixed inset-0 z-[9999] overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setShowFindingsDrawer(false)} />
                    <div className="absolute inset-y-0 right-0 sm:pl-10 max-w-full flex pointer-events-none">
                        <div className="w-screen max-w-2xl pointer-events-auto">
                            <div className="h-full flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-slide-up">
                                <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-start justify-between bg-white/50 dark:bg-white/5">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">{selectedAudit.name}</h2>
                                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                                            {selectedAudit.type} • {new Date(selectedAudit.dateScheduled).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <button onClick={handleExportPack} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Exporter Pack (Zip)"><FolderKanban className="h-5 w-5" /></button>
                                        <button onClick={generateAuditReport} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Rapport PDF"><Download className="h-5 w-5" /></button>
                                        <button onClick={() => setShowFindingsDrawer(false)} className="p-2.5 text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="px-8 border-b border-gray-100 dark:border-white/5 bg-white/30 dark:bg-white/5">
                                    <ScrollableTabs
                                        tabs={[
                                            { id: 'findings', label: 'Constats', icon: AlertOctagon },
                                            { id: 'checklist', label: 'Checklist', icon: CheckSquare },
                                            { id: 'scope', label: 'Périmètre', icon: Target }
                                        ]}
                                        activeTab={inspectorTab}
                                        onTabChange={(id) => setInspectorTab(id as any)}
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar space-y-8">
                                    {inspectorTab === 'findings' ? (
                                        <>
                                            {canEdit && (
                                                <form onSubmit={findingForm.handleSubmit(handleAddFinding)} className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm mb-8">
                                                    <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-widest flex items-center"><Plus className="h-3.5 w-3.5 mr-2" /> Ajouter un constat</h3>
                                                    <div className="space-y-6">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex justify-end">
                                                                <AIAssistButton
                                                                    context={{
                                                                        auditName: selectedAudit.name,
                                                                        auditType: selectedAudit.type,
                                                                        findingType: findingForm.watch('type'),
                                                                        control: findingForm.watch('relatedControlId') ? controls.find(c => c.id === findingForm.watch('relatedControlId'))?.code : 'Non spécifié'
                                                                    }}
                                                                    fieldName="description"
                                                                    onSuggest={(val: string) => findingForm.setValue('description', val)}
                                                                    prompt="Rédige un constat d'audit (écart) clair, factuel et professionnel. Précise le problème observé et l'impact potentiel."
                                                                />
                                                            </div>
                                                            <FloatingLabelTextarea
                                                                label="Description de l'écart"
                                                                {...findingForm.register('description')}
                                                                required
                                                                rows={2}
                                                            />
                                                        </div>

                                                        <Controller
                                                            control={findingForm.control}
                                                            name="type"
                                                            render={({ field }) => (
                                                                <SeveritySelector
                                                                    value={field.value}
                                                                    onChange={field.onChange}
                                                                />
                                                            )}
                                                        />

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <Controller
                                                                control={findingForm.control}
                                                                name="relatedControlId"
                                                                render={({ field }) => (
                                                                    <FloatingLabelSelect
                                                                        label="Contrôle Lié (Optionnel)"
                                                                        value={field.value || ''}
                                                                        onChange={field.onChange}
                                                                        options={controls.map(c => ({ value: c.id, label: `${c.code} ${c.name.substring(0, 30)}...` }))}
                                                                    />
                                                                )}
                                                            />
                                                            <Controller
                                                                control={findingForm.control}
                                                                name="evidenceIds"
                                                                render={({ field }) => (
                                                                    <FloatingLabelSelect
                                                                        label="Lier une preuve existante"
                                                                        value={field.value?.[0] || ''}
                                                                        onChange={e => field.onChange(e.target.value ? [e.target.value] : [])}
                                                                        options={documents.map(d => ({ value: d.id, label: `${d.title} (v${d.version})` }))}
                                                                    />
                                                                )}
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Ou téléverser une nouvelle preuve</label>
                                                            <FileUploader
                                                                onUploadComplete={handleEvidenceUpload}
                                                                category="evidence"
                                                                maxSizeMB={10}
                                                                allowedTypes={['application/pdf', 'image/*']}
                                                            />
                                                        </div>
                                                        <div className="flex justify-end">
                                                            <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">Ajouter</button>
                                                        </div>
                                                    </div>
                                                </form>
                                            )}

                                            <div className="space-y-4">
                                                <h3 className="text-xs font-bold uppercase text-slate-400 mb-2 tracking-widest px-2">Constats ({findings.length})</h3>
                                                {findings.length === 0 ? (
                                                    <div className="text-center py-8 text-gray-400 bg-white dark:bg-slate-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-white/10 italic text-sm">Aucun écart relevé pour le moment.</div>
                                                ) : (
                                                    findings.map(finding => (
                                                        <div key={finding.id} className="p-5 bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm card-hover group relative">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${finding.type === 'Majeure' ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400' : finding.type === 'Mineure' ? 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400' : 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                                                                    {finding.type}
                                                                </span>
                                                                {canEdit && (
                                                                    <button onClick={() => initiateDeleteFinding(finding.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3 leading-relaxed">{finding.description}</p>
                                                            {finding.relatedControlId && (
                                                                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-black/20 px-3 py-1.5 rounded-lg w-fit">
                                                                    <ShieldAlert className="h-3 w-3 mr-1.5" />
                                                                    {controls.find(c => c.id === finding.relatedControlId)?.code || 'Contrôle Inconnu'}
                                                                </div>
                                                            )}
                                                            {finding.evidenceIds && finding.evidenceIds.length > 0 && (
                                                                <div className="mt-2 flex items-center text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg w-fit">
                                                                    <Link className="h-3 w-3 mr-1.5" />
                                                                    {documents.find(d => d.id === finding.evidenceIds![0])?.title || 'Preuve liée'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="space-y-6">
                                            {!checklist ? (
                                                <div className="text-center py-12">
                                                    <ClipboardCheck className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Aucune checklist générée</h3>
                                                    <p className="text-slate-500 mb-6 max-w-xs mx-auto">Générez une checklist basée sur les contrôles ISO 27001 pour guider votre audit.</p>
                                                    <button onClick={generateChecklist} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-transform">Générer la Checklist ISO 27001</button>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h3 className="font-bold text-slate-900 dark:text-white">Checklist de conformité</h3>
                                                        <div className="flex gap-2">
                                                            <button onClick={markAllConform} className="text-xs font-bold bg-green-50 dark:bg-green-900/20 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors flex items-center"><CheckCheck className="h-3.5 w-3.5 mr-1" /> Tout Conforme</button>
                                                            <button onClick={generateSoA} className="text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">Générer SoA</button>
                                                            <span className="text-xs font-medium bg-slate-100 dark:bg-white/10 px-2 py-1.5 rounded-lg flex items-center">{checklist.questions.filter(q => q.response === 'Conforme').length} / {checklist.questions.length} Conformes</span>
                                                        </div>
                                                    </div>
                                                    {checklist.questions.map(q => (
                                                        <div key={q.id} className="p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <span className="text-xs font-bold bg-slate-100 dark:bg-white/10 px-2 py-1 rounded text-slate-600 dark:text-slate-300">{q.controlCode}</span>
                                                                <select
                                                                    className={`text-xs font-bold px-2 py-1 rounded border-none outline-none cursor-pointer ${q.response === 'Conforme' ? 'text-green-600 bg-green-50' : q.response === 'Non-conforme' ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-100'}`}
                                                                    value={q.response}
                                                                    onChange={(e) => handleChecklistAnswer(q.id, e.target.value as AuditQuestion['response'])}
                                                                >
                                                                    <option value="Non-applicable">N/A</option>
                                                                    <option value="Conforme">Conforme</option>
                                                                    <option value="Non-conforme">Non-conforme</option>
                                                                    <option value="Observation">Observation</option>
                                                                </select>
                                                            </div>
                                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-3">{q.question}</p>
                                                            <input
                                                                type="text"
                                                                placeholder="Commentaire ou observation..."
                                                                className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-black/20 rounded-xl border-none focus:ring-1 focus:ring-indigo-500 outline-none"
                                                                value={q.comment || ''}
                                                                onChange={(e) => handleChecklistAnswer(q.id, q.response, e.target.value)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {inspectorTab === 'scope' && (
                                        <div className="space-y-8">
                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center"><Server className="h-4 w-4 mr-2" /> Actifs Audités ({selectedAudit.relatedAssetIds?.length || 0})</h4>
                                                <div className="space-y-2">
                                                    {selectedAudit.relatedAssetIds?.map(aid => {
                                                        const asset = assets.find(a => a.id === aid);
                                                        return asset ? (
                                                            <div key={aid} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-black/20 rounded-xl">
                                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{asset.name}</span>
                                                                <span className="text-xs text-slate-500">{asset.type}</span>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                    {(!selectedAudit.relatedAssetIds || selectedAudit.relatedAssetIds.length === 0) && <p className="text-sm text-gray-400 italic">Aucun actif lié.</p>}
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center"><Flame className="h-4 w-4 mr-2" /> Risques Audités ({selectedAudit.relatedRiskIds?.length || 0})</h4>
                                                <div className="space-y-2">
                                                    {selectedAudit.relatedRiskIds?.map(rid => {
                                                        const risk = risks.find(r => r.id === rid);
                                                        return risk ? (
                                                            <div key={rid} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-black/20 rounded-xl">
                                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{risk.threat}</span>
                                                                <span className="text-xs font-bold text-red-500">Score: {risk.score}</span>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                    {(!selectedAudit.relatedRiskIds || selectedAudit.relatedRiskIds.length === 0) && <p className="text-sm text-gray-400 italic">Aucun risque lié.</p>}
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center"><ShieldAlert className="h-4 w-4 mr-2" /> Contrôles Audités ({selectedAudit.relatedControlIds?.length || 0})</h4>
                                                <div className="space-y-2">
                                                    {selectedAudit.relatedControlIds?.map(cid => {
                                                        const control = controls.find(c => c.id === cid);
                                                        return control ? (
                                                            <div key={cid} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-black/20 rounded-xl">
                                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{control.code} - {control.name}</span>
                                                                <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">{control.status}</span>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                    {(!selectedAudit.relatedControlIds || selectedAudit.relatedControlIds.length === 0) && <p className="text-sm text-gray-400 italic">Aucun contrôle lié.</p>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Create Audit Modal */}
            <AuditFormModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSubmit={handleCreateAudit}
                assets={assets}
                risks={risks}
                controls={controls}
                usersList={usersList}
            />
        </div>
    );
};
