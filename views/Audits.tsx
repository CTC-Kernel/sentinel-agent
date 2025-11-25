
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, getDocs, query, doc, deleteDoc, where, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Audit, Finding, Control, UserProfile, AuditChecklist, AuditQuestion, Document, Asset, Risk } from '../types';
import { canEditResource } from '../utils/permissions';
import { Plus, Activity, Search, Trash2, FileSpreadsheet, CalendarDays, User, AlertOctagon, X, Download, ShieldAlert, ClipboardCheck, Link, Server, Flame, FolderKanban, CheckCheck } from '../components/ui/Icons';
import { FloatingLabelTextarea } from '../components/ui/FloatingLabelTextarea';
import { FloatingLabelSelect } from '../components/ui/FloatingLabelSelect';
import { SeveritySelector } from '../components/audits/SeveritySelector';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { sendEmail } from '../services/emailService';
import { getAuditReminderTemplate } from '../services/emailTemplates';
import { generateICS, downloadICS } from '../utils/calendar';
import { FileUploader } from '../components/ui/FileUploader';
import JSZip from 'jszip';

export const Audits: React.FC = () => {
    const [audits, setAudits] = useState<Audit[]>([]);
    const [controls, setControls] = useState<Control[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filter, setFilter] = useState('');
    const { user, addToast } = useStore();

    const canEdit = canEditResource(user, 'Audit');

    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
    const [findings, setFindings] = useState<Finding[]>([]);
    const [showFindingsDrawer, setShowFindingsDrawer] = useState(false);
    const [newFinding, setNewFinding] = useState<Partial<Finding>>({ description: '', type: 'Mineure', status: 'Ouvert', relatedControlId: '', evidenceIds: [] });
    const [checklist, setChecklist] = useState<AuditChecklist | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [inspectorTab, setInspectorTab] = useState<'findings' | 'checklist' | 'scope'>('findings');

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const [newAudit, setNewAudit] = useState<Partial<Audit>>({
        name: '',
        type: 'Interne',
        auditor: user?.displayName || '',
        dateScheduled: new Date().toISOString().split('T')[0],
        status: 'Planifié',
        findingsCount: 0,
        relatedAssetIds: [],
        relatedRiskIds: []
    });

    const handleEvidenceUpload = async (url: string, fileName: string) => {
        if (!user?.organizationId || !selectedAudit) return;
        try {
            // Auto-create Document
            const docRef = await addDoc(collection(db, 'documents'), {
                title: `Preuve - ${fileName}`,
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
            setNewFinding(prev => ({
                ...prev,
                evidenceIds: [...(prev.evidenceIds || []), docRef.id]
            }));
            addToast("Preuve téléversée et liée", "success");
        } catch (e) {
            console.error(e);
            addToast("Erreur création document preuve", "error");
        }
    };

    const fetchAudits = async () => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            // Robust fetch
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'audits'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'controls'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'documents'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId)))
            ]);

            const getDocsData = <T,>(result: PromiseSettledResult<any>): T[] => {
                if (result.status === 'fulfilled') {
                    return result.value.docs.map((d: any) => ({ id: d.id, ...d.data() })) as T[];
                }
                return [];
            };

            const auditData = getDocsData<Audit>(results[0]);
            // Client side sort
            auditData.sort((a, b) => new Date(b.dateScheduled).getTime() - new Date(a.dateScheduled).getTime());
            setAudits(auditData);

            const ctrlData = getDocsData<Control>(results[1]);
            ctrlData.sort((a, b) => a.code.localeCompare(b.code));
            setControls(ctrlData);

            const userData = getDocsData<UserProfile>(results[2]);
            setUsersList(userData);

            const docData = getDocsData<Document>(results[3]);
            setDocuments(docData);

            const assetData = getDocsData<Asset>(results[4]);
            assetData.sort((a, b) => a.name.localeCompare(b.name));
            setAssets(assetData);

            const riskData = getDocsData<Risk>(results[5]);
            riskData.sort((a, b) => b.score - a.score);
            setRisks(riskData);

        } catch (_err) {
            addToast("Erreur chargement données", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAudits(); }, [user?.organizationId]);

    const handleOpenAudit = async (audit: Audit) => {
        setSelectedAudit(audit);
        setShowFindingsDrawer(true);
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

    const handleCreateAudit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'audits'), { ...newAudit, organizationId: user.organizationId, findingsCount: 0 });
            await logAction(user, 'CREATE', 'Audit', `Nouvel audit: ${newAudit.name}`);

            // Send notification
            if (newAudit.auditor) {
                const auditorUser = usersList.find(u => u.displayName === newAudit.auditor);
                if (auditorUser) {
                    const emailContent = getAuditReminderTemplate(
                        newAudit.name || 'Audit',
                        auditorUser.displayName || 'Auditeur',
                        newAudit.dateScheduled || '',
                        'https://sentinel-grc.web.app/audits'
                    );
                    await sendEmail(user, {
                        to: auditorUser.email,
                        subject: `[Sentinel] Nouvel audit assigné : ${newAudit.name}`,
                        html: emailContent,
                        type: 'AUDIT_REMINDER'
                    });
                }
            }

            addToast("Audit planifié et notifié", "success");
            setShowModal(false);
            fetchAudits();
        } catch (_e) { addToast("Erreur création audit", "error"); }
    };

    const handleAddFinding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit || !selectedAudit || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'findings'), {
                ...newFinding,
                organizationId: user.organizationId,
                auditId: selectedAudit.id,
                createdAt: new Date().toISOString()
            });

            const newCount = findings.length + 1;
            await updateDoc(doc(db, 'audits', selectedAudit.id), { findingsCount: newCount });

            setAudits(prev => prev.map(a => a.id === selectedAudit.id ? { ...a, findingsCount: newCount } : a));

            const q = query(collection(db, 'findings'), where('organizationId', '==', user.organizationId), where('auditId', '==', selectedAudit.id));
            const snap = await getDocs(q);
            setFindings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Finding)));

            setNewFinding({ description: '', type: 'Mineure', status: 'Ouvert', relatedControlId: '', evidenceIds: [] });
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
            setAudits(prev => prev.map(a => a.id === selectedAudit.id ? { ...a, findingsCount: newCount } : a));
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
            setAudits(prev => prev.filter(a => a.id !== id));
            if (selectedAudit?.id === id) {
                setSelectedAudit(null);
                setShowFindingsDrawer(false);
            }
            await logAction(user, 'DELETE', 'Audit', `Suppression audit: ${name}`);
            addToast("Audit et constats supprimés", "info");
        } catch (_e) { addToast("Erreur suppression", "error"); }
    };

    const generateChecklist = async () => {
        if (!selectedAudit || !user?.organizationId) return;
        try {
            const questions: AuditQuestion[] = controls.map(c => ({
                id: Math.random().toString(36).substr(2, 9),
                controlCode: c.code,
                question: `Le contrôle ${c.code} (${c.name}) est-il implémenté et efficace ?`,
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
        } catch (e) { console.error("Error saving checklist", e); }
    };

    const markAllConform = async () => {
        if (!checklist) return;
        const updatedQuestions = checklist.questions.map(q => ({ ...q, response: 'Conforme' as const }));
        setChecklist({ ...checklist, questions: updatedQuestions });
        try {
            await updateDoc(doc(db, 'audit_checklists', checklist.id), { questions: updatedQuestions });
            addToast("Tout marqué comme conforme", "success");
        } catch (e) { console.error(e); }
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
            title: `Audit: ${audit.name}`,
            description: `Type: ${audit.type} | Auditeur: ${audit.auditor} | Statut: ${audit.status}`,
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
        doc.text(`Audit: ${selectedAudit.name} | Date: ${new Date().toLocaleDateString()}`, 14, 33);

        const data = checklist.questions.map(q => [q.controlCode, q.response, q.comment || '']);
        (doc as any).autoTable({
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

        (doc as any).autoTable({
            startY: 85,
            head: [['Type', 'Description', 'Contrôle Lié', 'Statut']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] }, // Indigo
            columnStyles: { 1: { cellWidth: 80 } },
            styles: { fontSize: 9 }
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
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
            (doc as any).autoTable({ startY: 50, head: [['Type', 'Description', 'Contrôle', 'Statut']], body: rows, theme: 'striped', headStyles: { fillColor: [79, 70, 229] } });

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
                        console.error(`Failed to fetch evidence ${d.title}`, e);
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
            console.error(e);
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

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Audits & Contrôles</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Planification et suivi des audits de sécurité (ISO 27001 A.9.2).</p>
                </div>
                {canEdit && (
                    <button onClick={() => setShowModal(true)} className="flex items-center px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-none">
                        <Plus className="h-4 w-4 mr-2" /> Nouvel Audit
                    </button>
                )}
            </div>

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
                                        <div className="flex bg-slate-100 dark:bg-white/10 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-none">
                                            <button onClick={() => setInspectorTab('findings')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${inspectorTab === 'findings' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Constats</button>
                                            <button onClick={() => setInspectorTab('checklist')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${inspectorTab === 'checklist' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Checklist</button>
                                            <button onClick={() => setInspectorTab('scope')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${inspectorTab === 'scope' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Périmètre</button>
                                        </div>
                                        <button onClick={handleExportPack} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Exporter Pack (Zip)"><FolderKanban className="h-5 w-5" /></button>
                                        <button onClick={generateAuditReport} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Rapport PDF"><Download className="h-5 w-5" /></button>
                                        <button onClick={() => setShowFindingsDrawer(false)} className="p-2.5 text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar space-y-8">
                                    {inspectorTab === 'findings' ? (
                                        <>
                                            {canEdit && (
                                                <form onSubmit={handleAddFinding} className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm mb-8">
                                                    <h3 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-widest flex items-center"><Plus className="h-3.5 w-3.5 mr-2" /> Ajouter un constat</h3>
                                                    <div className="space-y-6">
                                                        <FloatingLabelTextarea
                                                            label="Description de l'écart"
                                                            value={newFinding.description}
                                                            onChange={e => setNewFinding({ ...newFinding, description: e.target.value })}
                                                            required
                                                            rows={2}
                                                        />

                                                        <SeveritySelector
                                                            value={newFinding.type || 'Mineure'}
                                                            onChange={val => setNewFinding({ ...newFinding, type: val as any })}
                                                        />

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <FloatingLabelSelect
                                                                label="Contrôle Lié (Optionnel)"
                                                                value={newFinding.relatedControlId || ''}
                                                                onChange={e => setNewFinding({ ...newFinding, relatedControlId: e.target.value })}
                                                                options={controls.map(c => ({ value: c.id, label: `${c.code} ${c.name.substring(0, 30)}...` }))}
                                                            />
                                                            <FloatingLabelSelect
                                                                label="Lier une preuve existante"
                                                                value={newFinding.evidenceIds?.[0] || ''}
                                                                onChange={e => setNewFinding({ ...newFinding, evidenceIds: e.target.value ? [e.target.value] : [] })}
                                                                options={documents.map(d => ({ value: d.id, label: `${d.title} (v${d.version})` }))}
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
                                                                    onChange={(e) => handleChecklistAnswer(q.id, e.target.value as any)}
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
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-indigo-50/30 dark:bg-indigo-900/10">
                            <h2 className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 tracking-tight">Planifier un Audit</h2>
                        </div>
                        <form onSubmit={handleCreateAudit} className="p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom de l'audit</label>
                                <input required className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                    value={newAudit.name} onChange={e => setNewAudit({ ...newAudit, name: e.target.value })} placeholder="Ex: Audit Interne ISO 27001 - Q1" />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Type</label>
                                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium appearance-none"
                                        value={newAudit.type} onChange={e => setNewAudit({ ...newAudit, type: e.target.value as any })}>
                                        {['Interne', 'Externe', 'Certification'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Date Prévue</label>
                                    <input type="date" required className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                        value={newAudit.dateScheduled} onChange={e => setNewAudit({ ...newAudit, dateScheduled: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Actifs (Périmètre)</label>
                                    <div className="h-32 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-white/10 rounded-2xl p-3 bg-gray-50/50 dark:bg-black/20">
                                        {assets.map(a => (
                                            <label key={a.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                                <input type="checkbox" checked={newAudit.relatedAssetIds?.includes(a.id)} onChange={() => {
                                                    const current = newAudit.relatedAssetIds || [];
                                                    const updated = current.includes(a.id) ? current.filter(id => id !== a.id) : [...current, a.id];
                                                    setNewAudit({ ...newAudit, relatedAssetIds: updated });
                                                }} className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{a.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Risques (Périmètre)</label>
                                    <div className="h-32 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-white/10 rounded-2xl p-3 bg-gray-50/50 dark:bg-black/20">
                                        {risks.map(r => (
                                            <label key={r.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                                <input type="checkbox" checked={newAudit.relatedRiskIds?.includes(r.id)} onChange={() => {
                                                    const current = newAudit.relatedRiskIds || [];
                                                    const updated = current.includes(r.id) ? current.filter(id => id !== r.id) : [...current, r.id];
                                                    setNewAudit({ ...newAudit, relatedRiskIds: updated });
                                                }} className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{r.threat}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Auditeur</label>
                                <select
                                    className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium appearance-none"
                                    value={newAudit.auditor}
                                    onChange={e => setNewAudit({ ...newAudit, auditor: e.target.value })}
                                >
                                    <option value="">Sélectionner...</option>
                                    {usersList.map(u => (
                                        <option key={u.uid} value={u.displayName}>{u.displayName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                                <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:scale-105 transition-all font-bold text-sm shadow-lg shadow-indigo-500/30">Créer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
