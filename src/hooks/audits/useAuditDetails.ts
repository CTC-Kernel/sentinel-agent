import { useState, useCallback } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Audit, Finding, AuditChecklist, AuditQuestion, Control, Document } from '../../types';
import { sanitizeData } from '../../utils/dataSanitizer';
import { ErrorLogger } from '../../services/errorLogger';
import { logAction } from '../../services/logger';
import { getPlanLimits } from '../../config/plans';
import { aiService } from '../../services/aiService';

export const useAuditDetails = (
    selectedAudit: Audit | null,
    controls: Control[],
    documents: Document[], // passed for evidence lookup
    refreshAudits: () => void
) => {
    const { user, addToast, organization } = useStore();
    const [findings, setFindings] = useState<Finding[]>([]);
    const [checklist, setChecklist] = useState<AuditChecklist | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    // Fetch details when an audit is selected
    const fetchDetails = useCallback(async () => {
        if (!user?.organizationId || !selectedAudit) return;
        try {
            const q = query(collection(db, 'findings'), where('organizationId', '==', user.organizationId), where('auditId', '==', selectedAudit.id));
            const snap = await getDocs(q);
            setFindings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Finding)));

            const cq = query(collection(db, 'audit_checklists'), where('organizationId', '==', user.organizationId), where('auditId', '==', selectedAudit.id));
            const cSnap = await getDocs(cq);
            if (!cSnap.empty) setChecklist({ id: cSnap.docs[0].id, ...cSnap.docs[0].data() } as AuditChecklist);
            else setChecklist(null);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAuditDetails.fetchDetails', 'FETCH_FAILED');
        }
    }, [user?.organizationId, selectedAudit]);

    // --- Findings ---

    const handleAddFinding = async (data: any) => {
        if (!selectedAudit || !user?.organizationId) return;
        try {
            const cleanData = sanitizeData(data);
            await addDoc(collection(db, 'findings'), {
                ...cleanData,
                organizationId: user.organizationId,
                auditId: selectedAudit.id,
                createdAt: new Date().toISOString()
            });

            const newCount = findings.length + 1;
            await updateDoc(doc(db, 'audits', selectedAudit.id), { findingsCount: newCount });
            refreshAudits();
            fetchDetails(); // Reload findings
            addToast("Constat ajouté", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAuditDetails.handleAddFinding', 'CREATE_FAILED');
        }
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
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAuditDetails.handleDeleteFinding', 'DELETE_FAILED');
        }
    };

    // --- Checklist ---

    const generateChecklist = async () => {
        if (!selectedAudit || !user?.organizationId) return;
        addToast("Génération de la checklist IA en cours...", "info");
        try {
            const scopeControlIds = selectedAudit.relatedControlIds || [];
            const controlsToAudit = scopeControlIds.length > 0 ? controls.filter(c => scopeControlIds.includes(c.id)) : controls;
            if (controlsToAudit.length === 0) { addToast("Aucun contrôle dans le périmètre.", "info"); return; }

            const aiResponse = await aiService.generateAuditChecklist(
                `Audit: ${selectedAudit.name} (${selectedAudit.type})`,
                controlsToAudit.map(c => ({ code: c.code, description: c.description || '' }))
            );

            const questions: AuditQuestion[] = [];
            controlsToAudit.forEach(c => {
                const aiData = aiResponse.find(r => r.controlCode === c.code);
                if (aiData && aiData.questions.length > 0) {
                    aiData.questions.forEach(qText => {
                        questions.push({ id: Math.random().toString(36).substr(2, 9), controlCode: c.code, question: qText, response: 'Non-applicable' });
                    });
                } else {
                    questions.push({ id: Math.random().toString(36).substr(2, 9), controlCode: c.code, question: `Le contrôle ${c.code} est-il efficace ?`, response: 'Non-applicable' });
                }
            });

            const newChecklistData = sanitizeData({
                auditId: selectedAudit.id,
                organizationId: user.organizationId,
                questions,
                completedBy: user.email,
                completedAt: new Date().toISOString()
            });

            if (checklist) {
                await updateDoc(doc(db, 'audit_checklists', checklist.id), { questions: newChecklistData.questions });
                setChecklist({ ...checklist, questions });
            } else {
                const ref = await addDoc(collection(db, 'audit_checklists'), newChecklistData);
                setChecklist({ ...newChecklistData, id: ref.id } as AuditChecklist);
            }
            addToast("Checklist générée", "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'useAuditDetails.generateChecklist', 'AI_ERROR'); }
    };

    const handleChecklistAnswer = async (questionId: string, response: AuditQuestion['response'], comment?: string) => {
        if (!checklist) return;
        const updatedQuestions = checklist.questions.map(q => q.id === questionId ? { ...q, response, comment: comment !== undefined ? comment : q.comment } : q);
        setChecklist({ ...checklist, questions: updatedQuestions });
        try { await updateDoc(doc(db, 'audit_checklists', checklist.id), { questions: sanitizeData(updatedQuestions) }); } catch (e) { ErrorLogger.error(e, 'useAuditDetails.handleChecklistAnswer'); }
    };

    const markAllConform = async () => {
        if (!checklist) return;
        const updatedQuestions = checklist.questions.map(q => ({ ...q, response: 'Conforme' as const }));
        setChecklist({ ...checklist, questions: updatedQuestions });
        try {
            await updateDoc(doc(db, 'audit_checklists', checklist.id), { questions: sanitizeData(updatedQuestions) });
            addToast("Tout marqué comme conforme", "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'useAuditDetails.markAllConform', 'UPDATE_FAILED'); }
    };

    // --- Evidence ---

    const handleEvidenceUploadForFinding = async (url: string, fileName: string) => {
        // Logic to create document and link to finding (passed via callback usually, or logic here)
        // ... (This logic will be simpler if handled in component or specialized hook, but included here for completeness if needed)
        // For now, let's assume the component handles the finding form state and calls a simple upload helper
        // or we just reuse the create logic.
        // Actually, evidence upload creates a Document.
        if (!user?.organizationId || !selectedAudit) return null;
        const docRef = await addDoc(collection(db, 'documents'), sanitizeData({
            title: `Preuve - ${fileName}`, type: 'Preuve', version: '1.0', status: 'Publié', url,
            organizationId: user.organizationId, owner: user.displayName || user.email, ownerId: user.uid,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            relatedAuditIds: [selectedAudit.id]
        }));
        return docRef.id;
    };

    // --- Reports ---

    const generateAuditReport = async (relatedRisks: any[]) => {
        if (!selectedAudit) return;
        setIsGeneratingReport(true);
        addToast("Génération du rapport...", "info");
        try {
            const { PdfService } = await import('../../services/PdfService');
            // ... Logic reused ...
            const summary = await aiService.generateAuditExecutiveSummary(
                selectedAudit.name,
                findings.map(f => ({ type: f.type, description: f.description, status: f.status })),
                relatedRisks.map(r => ({ threat: r.threat, score: r.score }))
            );

            // Mocking metrics/stats for brevity, real implementation would calculate them
            const openFindings = findings.filter(f => f.status === 'Ouvert').length;
            const majorFindings = findings.filter(f => f.type === 'Majeure').length;
            const metrics = [
                { label: 'Total Constats', value: findings.length.toString() },
                { label: 'Constats Ouverts', value: openFindings.toString(), subtext: 'Action Requise' },
                { label: 'Majeurs', value: majorFindings.toString(), subtext: 'Priorité Haute' },
                { label: 'Risques Liés', value: relatedRisks.length.toString() }
            ];
            const typeCounts = { 'Majeure': 0, 'Mineure': 0, 'Opportunité': 0 };
            findings.forEach(f => { if (typeCounts[f.type as keyof typeof typeCounts] !== undefined) typeCounts[f.type as keyof typeof typeCounts]++; });
            const stats = [
                { label: 'Majeure', value: typeCounts['Majeure'], color: '#EF4444' }, // Red
                { label: 'Mineure', value: typeCounts['Mineure'], color: '#F59E0B' }, // Amber
                { label: 'Opportunité', value: typeCounts['Opportunité'], color: '#10B981' } // Emerald
            ].filter(s => s.value > 0);

            PdfService.generateExecutiveReport({
                title: 'Rapport d\'Audit', subtitle: selectedAudit.name, filename: `Rapport_Audit.pdf`,
                organizationName: organization?.name || 'Sentinel GRC', organizationLogo: organization?.logoUrl,
                author: selectedAudit.auditor, summary, metrics, stats,
                coverImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop'
            }, (doc, startY) => {
                // ... custom content callback similar to Audits.tsx ...
                // Simplified for now, just autoTable findings
                if (findings.length > 0) {
                    doc.autoTable({
                        startY: startY + 20,
                        head: [['Type', 'Description', 'Statut']],
                        body: findings.map(f => [f.type, f.description, f.status]),
                    });
                }
            });
            addToast("Rapport généré", "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'useAuditDetails.report', 'REPORT_GENERATION_FAILED'); }
        finally { setIsGeneratingReport(false); }
    };

    const handleExportPack = async () => {
        if (!selectedAudit) return;
        addToast("Génération du pack...", "info");
        try {
            const { default: JSZip } = await import('jszip');
            const { PdfService } = await import('../../services/PdfService');
            const zip = new JSZip();
            const folder = zip.folder(`Audit_Pack_${selectedAudit.name}`);
            if (!folder) return;

            // Report
            const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
            const canWhiteLabel = limits.features.whiteLabelReports;
            const doc = PdfService.generateTableReport(
                { title: `Rapport d'Audit: ${selectedAudit.name}`, subtitle: `Auditeur: ${selectedAudit.auditor}`, filename: 'Rapport.pdf', save: false, organizationName: canWhiteLabel ? organization?.name : undefined, author: selectedAudit.auditor },
                ['Type', 'Description', 'Statut'],
                findings.map(f => [f.type, f.description, f.status])
            );
            folder.file('Rapport_Audit.pdf', doc.output('blob'));

            // Evidence
            const evidenceIds = new Set<string>();
            findings.forEach(f => f.evidenceIds?.forEach(id => evidenceIds.add(id)));
            if (evidenceIds.size > 0) {
                const evFolder = folder.folder("Preuves");
                const evDocs = documents.filter(d => evidenceIds.has(d.id));
                await Promise.all(evDocs.map(async d => {
                    if (!d.url) return;
                    try {
                        const r = await fetch(d.url);
                        const b = await r.blob();
                        evFolder?.file(`${d.title}.pdf`, b);
                    } catch { }
                }));
            }

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `Audit_Pack.zip`;
            link.click();
            addToast("Pack téléchargé", "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'useAuditDetails.pack', 'UNKNOWN_ERROR'); }
    };

    const validateAudit = async () => {
        if (!selectedAudit || !user?.organizationId) return;
        if (selectedAudit.createdBy === user?.uid) {
            addToast("Ségrégation des tâches : Vous ne pouvez pas valider un audit que vous avez créé.", "error");
            return;
        }
        setIsValidating(true);
        try {
            await updateDoc(doc(db, 'audits', selectedAudit.id), { status: 'Validé' });
            await logAction(user, 'VALIDATE', 'Audit', `Audit validé: ${selectedAudit.name}`);
            addToast("Audit validé", "success");
            refreshAudits();
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'useAuditDetails.validate', 'UPDATE_FAILED'); }
        finally { setIsValidating(false); }
    };

    return {
        findings, checklist, fetchDetails,
        handleAddFinding, handleDeleteFinding,
        generateChecklist, handleChecklistAnswer, markAllConform,
        handleEvidenceUploadForFinding,
        generateAuditReport, handleExportPack, validateAudit,
        isGeneratingReport, isValidating
    };
};
