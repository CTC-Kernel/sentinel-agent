import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { collection, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Audit, Finding, AuditChecklist, AuditQuestion, Control, Document, Risk } from '../../types';
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
    const { user, addToast, organization, t } = useStore();
    const [findings, setFindings] = useState<Finding[]>([]);
    const [checklist, setChecklist] = useState<AuditChecklist | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const isSubmittingRef = useRef(false);

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

    const handleAddFinding = async (data: Partial<Finding>) => {
        if (!selectedAudit || !user?.organizationId) return;
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        try {
            const cleanData = sanitizeData(data);
            await addDoc(collection(db, 'findings'), {
                ...cleanData,
                organizationId: user.organizationId,
                auditId: selectedAudit.id,
                createdAt: serverTimestamp()
            });

            const newCount = findings.length + 1;
            await updateDoc(doc(db, 'audits', selectedAudit.id), { findingsCount: newCount });
            refreshAudits();
            fetchDetails(); // Reload findings
            addToast(t('audits.toast.findingAdded', { defaultValue: "Constat ajouté" }), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAuditDetails.handleAddFinding', 'CREATE_FAILED');
        } finally {
            isSubmittingRef.current = false;
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
            addToast(t('audits.toast.findingDeleted', { defaultValue: "Constat supprimé" }), "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAuditDetails.handleDeleteFinding', 'DELETE_FAILED');
        }
    };

    // --- Checklist ---

    const generateChecklist = async () => {
        if (!selectedAudit || !user?.organizationId) return;
        addToast(t('audits.toast.generatingChecklist', { defaultValue: "Génération de la checklist IA en cours..." }), "info");
        try {
            const scopeControlIds = selectedAudit.relatedControlIds || [];
            const controlsToAudit = scopeControlIds.length > 0 ? controls.filter(c => scopeControlIds.includes(c.id)) : controls;
            if (controlsToAudit.length === 0) { addToast(t('audits.toast.noControlsInScope', { defaultValue: "Aucun contrôle dans le périmètre." }), "info"); return; }

            const aiResponse = await aiService.generateAuditChecklist(
                `Audit: ${selectedAudit.name} (${selectedAudit.type})`,
                controlsToAudit.map(c => ({ code: c.code, description: c.description || '' }))
            );

            const questions: AuditQuestion[] = [];
            controlsToAudit.forEach(c => {
                const aiData = aiResponse.find(r => r.controlCode === c.code);
                if (aiData && aiData.questions.length > 0) {
                    aiData.questions.forEach(qText => {
                        questions.push({ id: uuidv4(), controlCode: c.code, question: qText, response: 'Non-applicable' });
                    });
                } else {
                    questions.push({ id: uuidv4(), controlCode: c.code, question: `Le contrôle ${c.code} est-il efficace ?`, response: 'Non-applicable' });
                }
            });

            const newChecklistData = sanitizeData({
                auditId: selectedAudit.id,
                organizationId: user.organizationId,
                questions,
                completedBy: user.email,
                completedAt: serverTimestamp()
            });

            if (checklist) {
                await updateDoc(doc(db, 'audit_checklists', checklist.id), { questions: newChecklistData.questions });
                setChecklist({ ...checklist, questions });
            } else {
                const ref = await addDoc(collection(db, 'audit_checklists'), newChecklistData);
                setChecklist({ ...newChecklistData, id: ref.id, completedAt: new Date().toISOString() } as AuditChecklist);
            }
            addToast(t('audits.toast.checklistGenerated', { defaultValue: "Checklist générée" }), "success");
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
            addToast(t('audits.toast.allMarkedConform', { defaultValue: "Tout marqué comme conforme" }), "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'useAuditDetails.markAllConform', 'UPDATE_FAILED'); }
    };

    // --- Evidence ---

    const handleEvidenceUploadForFinding = async (findingId: string, url: string, fileName: string) => {
        if (!user?.organizationId || !selectedAudit) return null;

        try {
            // 1. Create Document
            const docRef = await addDoc(collection(db, 'documents'), sanitizeData({
                title: `Preuve - ${fileName}`,
                type: 'Preuve',
                version: '1.0',
                status: 'Publié',
                url, // In a real app, this would be the Storage URL
                organizationId: user.organizationId,
                owner: user.displayName || user.email,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                relatedAuditIds: [selectedAudit.id]
            }));

            // 2. Link to Finding
            const findingRef = doc(db, 'findings', findingId);
            const finding = findings.find(f => f.id === findingId);
            if (finding) {
                const currentEvidenceIds = finding.evidenceIds || [];
                const updatedEvidenceIds = [...currentEvidenceIds, docRef.id];

                await updateDoc(findingRef, { evidenceIds: updatedEvidenceIds });

                // Update local state
                setFindings(prev => prev.map(f => f.id === findingId ? { ...f, evidenceIds: updatedEvidenceIds } : f));
                addToast(t('audits.toast.evidenceAdded', { defaultValue: "Preuve ajoutée au constat" }), "success");
            }

            return docRef.id;
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAuditDetails.uploadEvidence', 'CREATE_FAILED');
            return null;
        }
    };

    // --- Reports ---

    const generateAuditReport = async (relatedRisks: Risk[]) => {
        if (!selectedAudit) return;
        setIsGeneratingReport(true);
        addToast(t('audits.toast.generatingReport', { defaultValue: "Génération du rapport..." }), "info");
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
            addToast(t('audits.toast.reportGenerated', { defaultValue: "Rapport généré" }), "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'useAuditDetails.report', 'REPORT_GENERATION_FAILED'); }
        finally { setIsGeneratingReport(false); }
    };

    const handleExportPack = async () => {
        if (!selectedAudit) return;
        addToast(t('audits.toast.generatingPack', { defaultValue: "Génération du pack..." }), "info");
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
                    } catch (e) {
                        ErrorLogger.warn('Failed to fetch evidence URL', 'useAuditDetails.handleExportPack', { metadata: { error: e } });
                    }
                }));
            }

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `Audit_Pack.zip`;
            link.click();
            addToast(t('audits.toast.packDownloaded', { defaultValue: "Pack téléchargé" }), "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'useAuditDetails.pack', 'UNKNOWN_ERROR'); }
    };

    const changeAuditStatus = async (newStatus: string) => {
        if (!selectedAudit || !user?.organizationId) return;
        setIsValidating(true);
        try {
            await updateDoc(doc(db, 'audits', selectedAudit.id), { status: newStatus, updatedAt: serverTimestamp(), updatedBy: user.uid });
            await logAction(user, 'UPDATE', 'Audit', `Statut audit modifié: ${selectedAudit.name} → ${newStatus}`);
            // Contextual guidance toast based on target status
            if (newStatus === 'En cours') {
                addToast(t('audits.statusGuidance.inProgress', { defaultValue: 'Audit démarré. Ajoutez des constats au fur et à mesure.' }), 'success');
            } else if (newStatus === 'Terminé') {
                addToast(t('audits.statusGuidance.completed', { defaultValue: 'Audit terminé. Vous pouvez maintenant le valider.' }), 'success');
            } else {
                addToast(t('audits.toast.statusUpdated', { defaultValue: "Statut mis à jour: {{status}}", status: newStatus }), "success");
            }
            refreshAudits();
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'useAuditDetails.changeStatus', 'UPDATE_FAILED'); }
        finally { setIsValidating(false); }
    };

    const validateAudit = async () => {
        if (!selectedAudit || !user?.organizationId) return;
        if (selectedAudit.createdBy === user?.uid) {
            addToast(t('audits.toast.segregationOfDuties', { defaultValue: "Ségrégation des tâches : Vous ne pouvez pas valider un audit que vous avez créé." }), "error");
            return;
        }
        setIsValidating(true);
        try {
            await updateDoc(doc(db, 'audits', selectedAudit.id), { status: 'Validé' });
            await logAction(user, 'VALIDATE', 'Audit', `Audit validé: ${selectedAudit.name}`);
            addToast(t('audits.statusGuidance.validated', { defaultValue: 'Audit validé. Il est maintenant archivé.' }), 'success');
            refreshAudits();
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'useAuditDetails.validate', 'UPDATE_FAILED'); }
        finally { setIsValidating(false); }
    };

    const updateAuditDetails = async (data: Partial<Audit>) => {
        if (!selectedAudit || !user?.organizationId) return;
        try {
            const cleanData = sanitizeData(data);
            // Prevent status update from here, use validateAudit for that
            delete cleanData.status;

            await updateDoc(doc(db, 'audits', selectedAudit.id), {
                ...cleanData,
                updatedAt: serverTimestamp(),
                updatedBy: user.uid
            });
            await logAction(user, 'UPDATE', 'Audit', `Audit mis à jour: ${cleanData.name || selectedAudit.name}`);
            addToast(t('audits.toast.updated', { defaultValue: "Audit mis à jour" }), "success");
            refreshAudits();
            return true;
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'useAuditDetails.update', 'UPDATE_FAILED');
            return false;
        }
    };

    return {
        findings, checklist, fetchDetails,
        handleAddFinding, handleDeleteFinding,
        generateChecklist, handleChecklistAnswer, markAllConform,
        handleEvidenceUploadForFinding,
        generateAuditReport, handleExportPack, validateAudit, changeAuditStatus, updateAuditDetails,
        isGeneratingReport, isValidating
    };
};
