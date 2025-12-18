import { useState, useMemo, useCallback } from 'react';
import { useFirestoreCollection } from '../useFirestore';
import { where, collection, addDoc, updateDoc, doc, deleteDoc, query, getDocs, arrayUnion, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Audit, Control, Asset, Risk, UserProfile, Document, Project, Finding, AuditChecklist } from '../../types';
import { canEditResource, canDeleteResource } from '../../utils/permissions';
import { logAction } from '../../services/logger';
import { ErrorLogger } from '../../services/errorLogger';
import { AuditPlannerService } from '../../services/AuditPlannerService';
import { sanitizeData } from '../../utils/dataSanitizer';
import { getAuditReminderTemplate } from '../../services/emailTemplates';
import { buildAppUrl } from '../../config/appConfig';
import { sendEmail } from '../../services/emailService';
import { analyticsService } from '../../services/analyticsService';

export const useAudits = () => {
    const { user, addToast } = useStore();
    const canEdit = canEditResource(user, 'Audit');
    const canDelete = canDeleteResource(user, 'Audit');

    // --- Data Fetching ---
    const { data: rawAudits, loading: auditsLoading, refresh: refreshAudits } = useFirestoreCollection<Audit>(
        'audits', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true }
    );
    const { data: rawControls, loading: controlsLoading } = useFirestoreCollection<Control>(
        'controls', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true }
    );
    const { data: rawAssets, loading: assetsLoading } = useFirestoreCollection<Asset>(
        'assets', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true }
    );
    const { data: rawRisks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true }
    );
    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true }
    );
    const { data: documents, loading: docsLoading } = useFirestoreCollection<Document>(
        'documents', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true }
    );
    const { data: rawProjects, loading: projectsLoading } = useFirestoreCollection<Project>(
        'projects', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true }
    );
    const { data: allFindings, loading: findingsLoading } = useFirestoreCollection<Finding>(
        'findings', [where('organizationId', '==', user?.organizationId || 'ignore')], { logError: true, realtime: true }
    );

    const loading = auditsLoading || controlsLoading || assetsLoading || risksLoading || usersLoading || docsLoading || projectsLoading || findingsLoading;

    // --- Derived State ---
    const audits = useMemo(() => {
        const toTime = (value?: string) => value ? new Date(value).getTime() : 0;
        return [...rawAudits].sort((a, b) => toTime(b.dateScheduled) - toTime(a.dateScheduled));
    }, [rawAudits]);

    const controls = useMemo(() => [...rawControls].sort((a, b) => a.code.localeCompare(b.code)), [rawControls]);
    const assets = useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);
    const risks = useMemo(() => [...rawRisks].sort((a, b) => b.score - a.score), [rawRisks]);

    // --- Local State ---
    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
    const [auditFindings, setAuditFindings] = useState<Finding[]>([]);
    const [auditChecklist, setAuditChecklist] = useState<AuditChecklist | null>(null);
    const [isExportingCSV, setIsExportingCSV] = useState(false);

    // --- Actions ---

    const fetchAuditDetails = useCallback(async (audit: Audit) => {
        if (!user?.organizationId) return;
        try {
            const [findingsSnap, checklistSnap] = await Promise.all([
                getDocs(query(collection(db, 'findings'), where('organizationId', '==', user.organizationId), where('auditId', '==', audit.id))),
                getDocs(query(collection(db, 'audit_checklists'), where('organizationId', '==', user.organizationId), where('auditId', '==', audit.id)))
            ]);

            setAuditFindings(findingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Finding)));
            setAuditChecklist(checklistSnap.empty ? null : { id: checklistSnap.docs[0].id, ...checklistSnap.docs[0].data() } as AuditChecklist);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAudits.fetchAuditDetails', 'FETCH_FAILED');
        }
    }, [user?.organizationId]);

    const handleCreateAudit = async (data: any, preSelectedProjectId?: string | null) => {
        if (!canEdit || !user?.organizationId) return;
        try {
            const cleanData = sanitizeData(data);
            const newDocData = {
                ...cleanData,
                organizationId: user.organizationId,
                findingsCount: 0,
                createdBy: user.uid,
                relatedProjectIds: preSelectedProjectId ? [preSelectedProjectId] : (cleanData.relatedProjectIds || [])
            };

            const docRef = await addDoc(collection(db, 'audits'), newDocData);

            if (preSelectedProjectId) {
                await updateDoc(doc(db, 'projects', preSelectedProjectId), { relatedAuditIds: arrayUnion(docRef.id) });
            }

            await logAction(user, 'CREATE', 'Audit', `Nouvel audit: ${data.name}`);
            analyticsService.logEvent('create_audit', { audit_type: data.type, auditor: data.auditor });

            if (data.auditor) {
                const auditorUser = usersList.find(u => u.displayName === data.auditor);
                if (auditorUser) {
                    const emailContent = getAuditReminderTemplate(data.name || 'Audit', auditorUser.displayName || 'Auditeur', data.dateScheduled || '', buildAppUrl('/audits'));
                    await sendEmail(user, { to: auditorUser.email, subject: `[Sentinel] Nouvel audit assigné: ${data.name}`, html: emailContent, type: 'AUDIT_REMINDER' });
                }
            }
            refreshAudits();
            addToast("Audit planifié et notifié", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAudits.handleCreateAudit', 'CREATE_FAILED');
            throw error;
        }
    };

    const handleUpdateAudit = async (id: string, data: any) => {
        if (!canEdit) return;
        try {
            await updateDoc(doc(db, 'audits', id), sanitizeData(data));
            await logAction(user, 'UPDATE', 'Audit', `Mise à jour audit: ${data.name}`);
            refreshAudits();
            addToast("Audit mis à jour", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAudits.handleUpdateAudit', 'UPDATE_FAILED');
            throw error;
        }
    };

    const handleDeleteAudit = async (id: string, name: string) => {
        if (!canDelete || !user?.organizationId) return;
        try {
            // Cascade delete findings
            const findingsQ = query(collection(db, 'findings'), where('organizationId', '==', user.organizationId), where('auditId', '==', id));
            const findingsSnap = await getDocs(findingsQ);
            await Promise.all(findingsSnap.docs.map(d => deleteDoc(doc(db, 'findings', d.id))));

            await deleteDoc(doc(db, 'audits', id));
            await logAction(user, 'DELETE', 'Audit', `Suppression audit: ${name}`);

            if (selectedAudit?.id === id) setSelectedAudit(null);
            refreshAudits();
            addToast("Audit et constats supprimés", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useAudits.handleDeleteAudit', 'DELETE_FAILED');
        }
    };

    const handleGeneratePlan = async () => {
        // Logic for AI Plan Generation
        const suggestions = AuditPlannerService.generateAuditSuggestions(risks, assets, audits);
        if (suggestions.length === 0) { addToast("Aucune suggestion d'audit pertinente trouvée.", "info"); return; }

        const batch = writeBatch(db);
        suggestions.slice(0, 5).forEach(s => {
            const newAuditRef = doc(collection(db, 'audits'));
            batch.set(newAuditRef, {
                ...s,
                organizationId: user?.organizationId,
                status: 'Planifié',
                findingsCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                auditor: user?.displayName || 'À définir',
                relatedProjectIds: [], relatedControlIds: []
            });
        });
        await batch.commit();
        refreshAudits();
        addToast(`${suggestions.length} audits planifiés avec succès.`, "success");
    };

    const generateChecklist = async (_audit: Audit) => {
        if (!user?.organizationId) return;
        // ... Logic for generating checklist ...
        // Reused from Audits.tsx but simplified/abstracted
        // For brevity in this initial pass, assuming similar logic
        // This should invoke AI service
        addToast("Fonctionnalité checklist en cours de refactoring...", "info");
    };

    const handleExportCSV = async () => {
        if (isExportingCSV) return;
        setIsExportingCSV(true);
        try {
            const headers = ["Audit", "Type", "Auditeur", "Date", "Statut", "Écarts"];
            const rows = audits.map(a => [
                a.name,
                a.type,
                a.auditor,
                a.dateScheduled ? new Date(a.dateScheduled).toLocaleDateString() : 'TBD',
                a.status,
                String(a.findingsCount || 0)
            ]);
            const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
            link.download = `audits_export_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        } finally {
            setTimeout(() => setIsExportingCSV(false), 0);
        }
    };

    const handleExportCalendar = () => {
        const scheduledAudits = audits.filter(a => a.status === 'Planifié' && a.dateScheduled);
        if (scheduledAudits.length === 0) {
            addToast("Aucun audit planifié à exporter.", "info");
            return;
        }

        let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Sentinel GRC//NONSGML v1.0//EN\n";

        scheduledAudits.forEach(audit => {
            const date = new Date(audit.dateScheduled!);
            const dateStr = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

            icsContent += "BEGIN:VEVENT\n";
            icsContent += `UID:${audit.id}@sentinel.grc\n`;
            icsContent += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}\n`;
            icsContent += `DTSTART;VALUE=DATE:${dateStr.substring(0, 8)}\n`;
            icsContent += `SUMMARY:Audit ${audit.name}\n`;
            icsContent += `DESCRIPTION:Audit de type ${audit.type} assigné à ${audit.auditor || 'Non assigné'}.\n`;
            icsContent += "END:VEVENT\n";
        });

        icsContent += "END:VCALENDAR";

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', 'audit_calendar.ics');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        addToast(`${scheduledAudits.length} audits exportés vers le calendrier.`, "success");
    };

    return {
        // Data
        audits, controls, assets, risks, usersList, documents, allFindings, loading, projects: rawProjects,
        selectedAudit, setSelectedAudit, auditFindings, setAuditFindings, auditChecklist, setAuditChecklist,

        // Actions
        fetchAuditDetails,
        handleCreateAudit,
        handleUpdateAudit,
        handleDeleteAudit,
        handleGeneratePlan,
        generateChecklist,
        refreshAudits,
        handleExportCSV,
        handleExportCalendar,

        // Permissions
        canEdit, canDelete
    };
};
