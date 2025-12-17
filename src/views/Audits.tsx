import React, { useDeferredValue, useEffect, useState } from 'react';
import { SEO } from '../components/SEO';
import { useLocation } from 'react-router-dom';
import { Controller } from 'react-hook-form';
import { FloatingLabelTextarea } from '../components/ui/FloatingLabelTextarea';
import { FloatingLabelSelect } from '../components/ui/FloatingLabelSelect';
import { SeveritySelector } from '../components/audits/SeveritySelector';
import { FileUploader } from '../components/ui/FileUploader';
import { AIAssistButton } from '../components/ai/AIAssistButton';
import { collection, addDoc, getDocs, query, doc, deleteDoc, where, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { Menu, Transition } from '@headlessui/react';
import { db } from '../firebase';
import { Audit, Finding, Control, UserProfile, AuditChecklist, AuditQuestion, Document, Asset, Risk, Project } from '../types';
import { canEditResource, canDeleteResource, hasPermission } from '../utils/permissions';
import { EvidenceRequestList } from '../components/audits/EvidenceRequestList';
import { QuestionnaireList } from '../components/audits/QuestionnaireList';
import { AuditTeam } from '../components/audits/AuditTeam';
import { Comments } from '../components/ui/Comments';
import { Plus, AlertTriangle, Calendar, FileText, ClipboardCheck, CalendarDays, AlertOctagon, Edit, Trash2, User, MoreVertical, Loader2, FolderKanban, FileSpreadsheet, BrainCircuit, Activity, ArrowRight, CheckCheck, Download, MessageSquare, Users, Target, ShieldAlert, Link, Server, Flame } from '../components/ui/Icons';
// ...
import { AuditPlannerService } from '../services/AuditPlannerService';

import { Drawer } from '../components/ui/Drawer';
import { AuditForm } from '../components/audits/AuditForm';
import { AuditDashboard } from '../components/audits/AuditDashboard';
import { AuditAIAssistant } from '../components/audits/AuditAIAssistant';
import { useStore } from '../store';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { logAction } from '../services/logger';

import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton } from '../components/ui/Skeleton';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { ColumnDef } from '@tanstack/react-table';
import { EmptyState } from '../components/ui/EmptyState';
import { PageControls } from '../components/ui/PageControls';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { sendEmail } from '../services/emailService';
import { getAuditReminderTemplate } from '../services/emailTemplates';
import { PdfService } from '../services/PdfService';
import { ErrorLogger } from '../services/errorLogger';
import { SafeHTML } from '../components/ui/SafeHTML';
import { getPlanLimits } from '../config/plans';
import { buildAppUrl } from '../config/appConfig';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuditFormData, findingSchema, FindingFormData, auditSchema } from '../schemas/auditSchema';
import { sanitizeData } from '../utils/dataSanitizer';
import { z } from 'zod';
import { aiService } from '../services/aiService';
import { analyticsService } from '../services/analyticsService';
import { usePersistedState } from '../hooks/usePersistedState';
import type { jsPDF } from 'jspdf';

export const Audits: React.FC = () => {
    const { user, addToast, organization } = useStore();
    const canEdit = canEditResource(user, 'Audit');
    const [viewMode, setViewMode] = usePersistedState<'grid' | 'list' | 'matrix'>('audits_view_mode', 'grid');

    const role = user?.role || 'user';
    const [isValidating, setIsValidating] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    let auditsTitle = "Programme d'Audit";
    let auditsSubtitle = "Planification, exécution et suivi des audits internes et externes.";

    if (role === 'admin' || role === 'rssi') {
        auditsTitle = "Programme d'Audit & Conformité";
        auditsSubtitle = "Orchestrez les audits ISO 27001, le suivi des écarts et les plans d'actions associés.";
    } else if (role === 'direction') {
        auditsTitle = 'Vue Exécutive des Audits';
        auditsSubtitle = "Suivez l'état des audits, les non-conformités et les risques associés pour la direction.";
    } else if (role === 'auditor') {
        auditsTitle = 'Mes Audits & Constats';
        auditsSubtitle = "Préparez, exécutez et documentez vos missions d'audit et leurs constats.";
    } else if (role === 'project_manager') {
        auditsTitle = 'Audits liés aux Projets';
        auditsSubtitle = "Identifiez les audits impactant vos projets et les actions à coordonner.";
    } else {
        auditsTitle = 'Audits & Conformité';
        auditsSubtitle = "Consultez les audits planifiés et les écarts qui concernent votre périmètre.";
    }

    // Data Fetching with Hooks
    const { data: rawAudits, loading: auditsLoading, refresh: refreshAudits } = useFirestoreCollection<Audit>(
        'audits',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, realtime: true }
    );

    const { data: rawControls, loading: controlsLoading } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, realtime: true }
    );

    const { data: rawAssets, loading: assetsLoading } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, realtime: true }
    );

    const { data: rawRisks, loading: risksLoading } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, realtime: true }
    );

    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, realtime: true }
    );

    const { data: documents, loading: docsLoading } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, realtime: true }
    );

    const { data: rawProjects, loading: projectsLoading } = useFirestoreCollection<Project>(
        'projects',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, realtime: true }
    );

    const { data: allFindings, loading: findingsLoading } = useFirestoreCollection<Finding>(
        'findings',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true, realtime: true }
    );

    // Derived State
    const audits = React.useMemo(() => {
        const toTime = (value?: string) => {
            if (!value) return 0;
            const t = new Date(value).getTime();
            return Number.isFinite(t) ? t : 0;
        };
        return [...rawAudits].sort((a, b) => toTime(b.dateScheduled) - toTime(a.dateScheduled));
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

    const loading = auditsLoading || controlsLoading || assetsLoading || risksLoading || usersLoading || docsLoading || projectsLoading || findingsLoading;



    const [creationMode, setCreationMode] = useState(false);

    const [preSelectedProjectId, setPreSelectedProjectId] = useState<string | null>(null);
    const [editingAudit, setEditingAudit] = useState<Audit | null>(null);
    const [filter, setFilter] = useState('');

    const deferredFilter = useDeferredValue(filter);

    const [isExportingCSV, setIsExportingCSV] = useState(false);

    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
    const [findings, setFindings] = useState<Finding[]>([]);
    const [showFindingsDrawer, setShowFindingsDrawer] = useState(false);
    const [checklist, setChecklist] = useState<AuditChecklist | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'findings' | 'checklist' | 'scope' | 'collaboration' | 'evidence' | 'team' | 'intelligence' | 'questionnaires'>('findings');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openEvidenceQuestionId, setOpenEvidenceQuestionId] = useState<string | null>(null);

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });



    const findingForm = useForm<FindingFormData>({
        resolver: zodResolver(findingSchema),
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
            const relatedControlId = findingForm.getValues('relatedControlId');

            // Auto-create Document
            const docRef = await addDoc(collection(db, 'documents'), sanitizeData({
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
                relatedAuditIds: [selectedAudit.id],
                relatedControlIds: relatedControlId ? [relatedControlId] : []
            }));

            // Link to new finding
            const currentIds = findingForm.getValues('evidenceIds') || [];
            findingForm.setValue('evidenceIds', [...currentIds, docRef.id]);

            // Link to Control (if applicable)
            if (relatedControlId) {
                await updateDoc(doc(db, 'controls', relatedControlId), {
                    evidenceIds: arrayUnion(docRef.id)
                });
            }

            addToast("Preuve téléversée et liée", "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Audits.handleEvidenceUpload', 'FILE_UPLOAD_FAILED');
        }
    };



    const handleOpenAudit = React.useCallback(async (audit: Audit) => {
        if (!user?.organizationId) {
            addToast("Organisation non définie", "error");
            return;
        }
        setSelectedAudit(audit);
        setShowFindingsDrawer(true);
        findingForm.reset({ description: '', type: 'Mineure', status: 'Ouvert', relatedControlId: '', evidenceIds: [] });
        try {
            const q = query(
                collection(db, 'findings'),
                where('organizationId', '==', user.organizationId),
                where('auditId', '==', audit.id)
            );
            const snap = await getDocs(q);
            setFindings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Finding)));

            const cq = query(
                collection(db, 'audit_checklists'),
                where('organizationId', '==', user.organizationId),
                where('auditId', '==', audit.id)
            );
            const cSnap = await getDocs(cq);
            if (!cSnap.empty) setChecklist({ id: cSnap.docs[0].id, ...cSnap.docs[0].data() } as AuditChecklist);
            else setChecklist(null);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Audits.handleOpenAudit', 'FETCH_FAILED');
            setFindings([]);
            setChecklist(null);
        }
    }, [user?.organizationId, findingForm, addToast]);

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string; createForProject?: string; projectName?: string };

        if (state.createForProject) {
            setCreationMode(true);
            setPreSelectedProjectId(state.createForProject);
            // Optionally set default name like "Audit - [ProjectName]" if we could pass initialData to AuditForm
        }

        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || audits.length === 0) return;
        const audit = audits.find(a => a.id === state.voxelSelectedId);
        if (audit) {
            handleOpenAudit(audit);
        }
    }, [location.state, loading, audits, handleOpenAudit]);

    const openCreationDrawer = () => {
        setCreationMode(true);
        setEditingAudit(null);
    };

    const openEditDrawer = React.useCallback((audit: Audit) => {
        setEditingAudit(audit);
        setCreationMode(false);
    }, []);

    const handleAuditFormSubmit: SubmitHandler<AuditFormData> = async (data) => {
        if (!canEdit || !user?.organizationId) return;
        setIsSubmitting(true);

        if (editingAudit) {
            // Update existing audit
            try {
                const validatedData = auditSchema.parse(data);
                const cleanData = sanitizeData(validatedData);
                await updateDoc(doc(db, 'audits', editingAudit.id), { ...cleanData });
                await logAction(user, 'UPDATE', 'Audit', `Mise à jour audit: ${validatedData.name}`);
                addToast("Audit mis à jour", "success");
                setEditingAudit(null);
                refreshAudits();
            } catch (e) {
                if (e instanceof z.ZodError) {
                    addToast((e as unknown as { errors: { message: string }[] }).errors[0].message, "error");
                } else {
                    ErrorLogger.handleErrorWithToast(e, 'Audits.handleAuditFormSubmit.update', 'UPDATE_FAILED');
                }
            } finally {
                setIsSubmitting(false);
            }
        } else {
            // Create new audit
            try {
                const validatedData = auditSchema.parse(data);
                const cleanData = sanitizeData(validatedData);
                const newDocData = {
                    ...cleanData,
                    organizationId: user.organizationId,
                    findingsCount: 0,
                    createdBy: user.uid,
                    relatedProjectIds: preSelectedProjectId ? [preSelectedProjectId] : (cleanData.relatedProjectIds || [])
                };

                const docRef = await addDoc(collection(db, 'audits'), newDocData);

                // Bi-directional linking for Project
                if (preSelectedProjectId) {
                    const projectRef = doc(db, 'projects', preSelectedProjectId);
                    // Check if 'relatedAuditIds' field exists in Project type, assume yes or adding it dynamically
                    await updateDoc(projectRef, {
                        relatedAuditIds: arrayUnion(docRef.id)
                    });
                    setPreSelectedProjectId(null);
                }

                await logAction(user, 'CREATE', 'Audit', `Nouvel audit: ${validatedData.name}`);
                analyticsService.logEvent('create_audit', {
                    audit_type: validatedData.type,
                    auditor: validatedData.auditor
                });

                // Send notification
                if (validatedData.auditor) {
                    const auditorUser = usersList.find(u => u.displayName === validatedData.auditor);
                    if (auditorUser) {
                        const emailContent = getAuditReminderTemplate(
                            validatedData.name || 'Audit',
                            auditorUser.displayName || 'Auditeur',
                            validatedData.dateScheduled || '',
                            buildAppUrl('/audits')
                        );
                        await sendEmail(user, {
                            to: auditorUser.email,
                            subject: `[Sentinel] Nouvel audit assigné: ${validatedData.name}`,
                            html: emailContent,
                            type: 'AUDIT_REMINDER'
                        });
                    }
                }

                addToast("Audit planifié et notifié", "success");
                setCreationMode(false);
                refreshAudits();
            } catch (error) {
                if (error instanceof z.ZodError) {
                    addToast((error as unknown as { errors: { message: string }[] }).errors[0].message, "error");
                } else {
                    ErrorLogger.handleErrorWithToast(error, 'Audits.handleAuditFormSubmit', 'CREATE_FAILED');
                }
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleAddFinding: SubmitHandler<FindingFormData> = async (data) => {
        if (!canEdit || !selectedAudit || !user?.organizationId) return;
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

            const q = query(collection(db, 'findings'), where('organizationId', '==', user.organizationId), where('auditId', '==', selectedAudit.id));
            const snap = await getDocs(q);
            setFindings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Finding)));

            findingForm.reset({ description: '', type: 'Mineure', status: 'Ouvert', relatedControlId: '', evidenceIds: [] });
            addToast("Constat ajouté", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Audits.handleAddFinding', 'CREATE_FAILED');
        }
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
        if (!selectedAudit || !canEdit) return;
        try {
            await deleteDoc(doc(db, 'findings', findingId));
            const newCount = Math.max(0, findings.length - 1);
            await updateDoc(doc(db, 'audits', selectedAudit.id), { findingsCount: newCount });
            refreshAudits();
            setFindings(prev => prev.filter(f => f.id !== findingId));
            addToast("Constat supprimé", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Audits.handleDeleteFinding', 'DELETE_FAILED');
        }
    };

    const performDelete = React.useCallback(async (id: string, organizationId: string) => {
        // Delete findings first (Cascade)
        const findingsQ = query(
            collection(db, 'findings'),
            where('organizationId', '==', organizationId),
            where('auditId', '==', id)
        );
        const findingsSnap = await getDocs(findingsQ);
        const deletePromises = findingsSnap.docs.map(d => deleteDoc(doc(db, 'findings', d.id)));
        await Promise.all(deletePromises);

        await deleteDoc(doc(db, 'audits', id));
    }, []);

    const handleDeleteAudit = React.useCallback(async (id: string, name: string) => {
        if (!canDeleteResource(user, 'Audit')) return;
        if (!user?.organizationId) {
            addToast("Organisation non définie", "error");
            return;
        }
        try {
            await performDelete(id, user.organizationId);
            refreshAudits();
            if (selectedAudit?.id === id) {
                setSelectedAudit(null);
                setShowFindingsDrawer(false);
            }
            await logAction(user, 'DELETE', 'Audit', `Suppression audit: ${name} `);
            addToast("Audit et constats supprimés", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Audits.handleDeleteAudit', 'DELETE_FAILED');
        }
    }, [user, performDelete, refreshAudits, selectedAudit, addToast]);

    const initiateDeleteAudit = React.useCallback((id: string, name: string) => {
        if (!canDeleteResource(user, 'Audit')) return;
        setConfirmData({
            isOpen: true,
            title: "Supprimer l'audit ?",
            message: "L'audit et tous ses constats seront supprimés.",
            onConfirm: () => handleDeleteAudit(id, name)
        });
    }, [user, handleDeleteAudit]);

    const handleBulkDelete = async (ids: string[]) => {
        if (!canDeleteResource(user, 'Audit')) return;
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ces ${ids.length} audits ?`)) return;
        if (!user?.organizationId) {
            addToast("Organisation non définie", "error");
            return;
        }

        const organizationId = user.organizationId;

        try {
            await Promise.all(ids.map((id) => performDelete(id, organizationId)));
            if (selectedAudit?.id && ids.includes(selectedAudit.id)) {
                setSelectedAudit(null);
                setShowFindingsDrawer(false);
            }
            refreshAudits();
            addToast(`${ids.length} audits supprimés`, "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Audits.handleBulkDelete', 'DELETE_FAILED');
        }
    };

    const generateChecklist = async () => {
        if (!selectedAudit || !user?.organizationId || !canEdit) return;

        // Check if checklist already exists
        if (checklist) {
            if (!window.confirm("Une checklist existe déjà. Voulez-vous la régénérer ? Cela effacera les réponses actuelles.")) return;
        }

        addToast("Génération de la checklist IA en cours...", "info");

        try {
            const scopeControlIds = selectedAudit.relatedControlIds || [];
            const controlsToAudit = scopeControlIds.length > 0
                ? controls.filter(c => scopeControlIds.includes(c.id))
                : controls;

            if (controlsToAudit.length === 0) {
                addToast("Aucun contrôle dans le périmètre de l'audit.", "info");
                return;
            }

            // Use AI to generate specific questions
            const aiResponse = await import('../services/aiService').then(m => m.aiService.generateAuditChecklist(
                `Audit: ${selectedAudit.name} (${selectedAudit.type})`,
                controlsToAudit.map(c => ({ code: c.code, description: c.description || '' }))
            ));

            const questions: AuditQuestion[] = [];

            controlsToAudit.forEach(c => {
                const aiData = aiResponse.find(r => r.controlCode === c.code);
                if (aiData && aiData.questions.length > 0) {
                    aiData.questions.forEach(qText => {
                        questions.push({
                            id: Math.random().toString(36).substr(2, 9),
                            controlCode: c.code,
                            question: qText,
                            response: 'Non-applicable'
                        });
                    });
                } else {
                    // Fallback
                    questions.push({
                        id: Math.random().toString(36).substr(2, 9),
                        controlCode: c.code,
                        question: `Le contrôle ${c.code} (${c.name}) est-il implémenté et efficace ?`,
                        response: 'Non-applicable'
                    });
                }
            });

            const newChecklist = sanitizeData({
                auditId: selectedAudit.id,
                organizationId: user.organizationId,
                questions,
                completedBy: user.email,
                completedAt: new Date().toISOString()
            });

            // If updating existing, delete old one first or update doc
            // For simplicity, we'll treat it as a new/update
            if (checklist) {
                await updateDoc(doc(db, 'audit_checklists', checklist.id), { questions: sanitizeData(questions) });
                setChecklist({ ...checklist, questions });
            } else {
                const ref = await addDoc(collection(db, 'audit_checklists'), newChecklist);
                setChecklist({ ...newChecklist, id: ref.id });
            }

            addToast("Checklist intelligente générée", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Audits.generateChecklist', 'AI_ERROR');
        }
    };

    const handleChecklistEvidenceUpload = async (questionId: string, url: string, fileName: string) => {
        if (!user?.organizationId || !selectedAudit || !checklist) return;
        try {
            const question = checklist.questions.find(q => q.id === questionId);
            const questionControlCode = question?.controlCode;
            const relatedControl = controls.find(c => c.code === questionControlCode);

            const docRef = await addDoc(collection(db, 'documents'), sanitizeData({
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
                relatedAuditIds: [selectedAudit.id],
                relatedControlIds: relatedControl ? [relatedControl.id] : []
            }));

            const updatedQuestions = checklist.questions.map(q => {
                if (q.id === questionId) {
                    return { ...q, evidenceIds: [...(q.evidenceIds || []), docRef.id] };
                }
                return q;
            });

            setChecklist({ ...checklist, questions: updatedQuestions });
            await updateDoc(doc(db, 'audit_checklists', checklist.id), { questions: sanitizeData(updatedQuestions) });

            if (relatedControl) {
                await updateDoc(doc(db, 'controls', relatedControl.id), {
                    evidenceIds: arrayUnion(docRef.id)
                });
            }

            addToast("Preuve ajoutée à la checklist", "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Audits.handleChecklistEvidenceUpload', 'FILE_UPLOAD_FAILED');
        }
    };

    const handleChecklistAnswer = async (questionId: string, response: AuditQuestion['response'], comment?: string) => {
        if (!checklist || !canEdit) return;
        const updatedQuestions = checklist.questions.map(q => q.id === questionId ? { ...q, response, comment: comment !== undefined ? comment : q.comment } : q);
        setChecklist({ ...checklist, questions: updatedQuestions });
        // Debounced save could be better, but direct update for now
        try {
            await updateDoc(doc(db, 'audit_checklists', checklist.id), { questions: sanitizeData(updatedQuestions) });
        } catch (e) { ErrorLogger.error(e, 'Audits.handleChecklistAnswer'); }
    };

    const markAllConform = async () => {
        if (!checklist || !canEdit) return;
        const updatedQuestions = checklist.questions.map(q => ({ ...q, response: 'Conforme' as const }));
        setChecklist({ ...checklist, questions: updatedQuestions });
        try {
            await updateDoc(doc(db, 'audit_checklists', checklist.id), { questions: sanitizeData(updatedQuestions) });
            addToast("Tout marqué comme conforme", "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Audits.markAllConform', 'UPDATE_FAILED'); }
    };

    const handleExportCSV = async () => {
        if (isExportingCSV) return;
        setIsExportingCSV(true);
        try {
            const headers = ["Audit", "Type", "Auditeur", "Date", "Statut", "Écarts"];
            const rows = filteredAudits.map(a => [
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

    const generateSoA = () => {
        if (!selectedAudit || !checklist) return;

        void (async () => {
            const { PdfService } = await import('../services/PdfService');

            const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
            const canWhiteLabel = limits.features.whiteLabelReports;

            const data = checklist.questions.map(q => {
                const evidenceNames = q.evidenceIds?.map(eid => documents.find(d => d.id === eid)?.title).join(', ') || '';
                return [q.controlCode, q.response, q.comment || '', evidenceNames];
            });

            PdfService.generateTableReport(
                {
                    title: "Statement of Applicability (SoA)",
                    subtitle: `Audit: ${selectedAudit.name} | Date: ${new Date().toLocaleDateString()}`,
                    filename: 'SoA.pdf',
                    footerText: 'Sentinel GRC - Document Confidentiel',
                    organizationName: canWhiteLabel ? organization?.name : undefined,
                    organizationLogo: canWhiteLabel ? organization?.logoUrl : undefined,
                    coverImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop', // Analytics/Matrix
                    includeCover: true,
                    author: user?.displayName || 'Auditeur'
                },
                ['Contrôle', 'Statut', 'Justification', 'Preuves'],
                data,
                { 0: { fontStyle: 'bold', cellWidth: 30 } }
            );
        })().catch((error) => {
            ErrorLogger.error(error, 'Audits.generateSoA');
        });
    };



    const handleGeneratePlan = async () => {
        if (!user?.organizationId) return;

        // Pass existing audits to prevent duplicates
        const suggestions = AuditPlannerService.generateAuditSuggestions(risks, assets, audits);
        if (suggestions.length === 0) {
            addToast("Aucune suggestion d'audit pertinente trouvée.", "info");
            return;
        }

        if (window.confirm(`L'assistant a identifié ${suggestions.length} priorités d'audit basées sur les risques et actifs critiques. Voulez-vous les générer ?`)) {
            try {
                const batch = writeBatch(db);
                let count = 0;
                suggestions.forEach(s => {
                    if (count >= 5) return; // Limit to 5 max effectively
                    const newAuditRef = doc(collection(db, 'audits'));
                    // Cast 's' or spread safely. AuditSuggestion has extra 'reason' and 'priority' which are fine to store or omit.
                    // Storing them is better for context.
                    batch.set(newAuditRef, {
                        name: s.name,
                        type: s.type,
                        dateScheduled: s.dateScheduled,
                        relatedAssetIds: s.relatedAssetIds,
                        relatedRiskIds: s.relatedRiskIds,
                        // Custom fields for context
                        planningReason: s.reason,
                        priority: s.priority,

                        organizationId: user.organizationId,
                        status: 'Planifié',
                        findingsCount: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        auditor: user.displayName || 'À définir',
                        relatedProjectIds: [],
                        relatedControlIds: []
                    });
                    count++;
                });

                await batch.commit();
                refreshAudits();
                addToast(`${count} audits planifiés avec succès.`, "success");
            } catch (e) {
                ErrorLogger.handleErrorWithToast(e, 'Audits.handleGeneratePlan', 'CREATE_FAILED');
            }
        }
    };

    const handleExportExecutiveReport = async () => {
        if (!selectedAudit) return;
        setIsGeneratingReport(true);
        addToast("Génération du rapport exécutif d'audit...", "info");

        try {
            const { PdfService } = await import('../services/PdfService');
            const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
            const canWhiteLabel = limits.features.whiteLabelReports;

            PdfService.generateAuditExecutiveReport(
                selectedAudit,
                findings,
                {
                    title: "RAPPORT D'AUDIT",
                    orientation: 'portrait',
                    organizationName: canWhiteLabel ? (organization?.name || user?.email?.split('@')[1] || 'Sentinel GRC') : 'Sentinel GRC',
                    organizationLogo: canWhiteLabel ? organization?.logoUrl : undefined,
                    author: user?.displayName || 'Auditeur',
                    coverImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop'
                }
            );

            addToast("Rapport téléchargé avec succès", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Audits.handleExportExecutiveReport', 'REPORT_GENERATION_FAILED');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const generateAuditReport = async () => {
        if (!selectedAudit) return;
        setIsGeneratingReport(true);
        addToast("Génération du rapport d'audit avec l'IA...", "info");

        try {
            const findingsForReport = findings;

            // Get related risks for context
            const relatedRisks = rawRisks.filter(r => selectedAudit.relatedRiskIds?.includes(r.id));

            // Generate AI Summary
            const summary = await aiService.generateAuditExecutiveSummary(
                selectedAudit.name,
                findingsForReport.map(f => ({ type: f.type, description: f.description, status: f.status })),
                relatedRisks.map(r => ({ threat: r.threat, score: r.score }))
            );

            // Calculate Metrics
            const openFindings = findingsForReport.filter(f => f.status === 'Ouvert').length;
            const majorFindings = findingsForReport.filter(f => f.type === 'Majeure').length;

            const metrics = [
                { label: 'Total Constats', value: findingsForReport.length.toString() },
                { label: 'Constats Ouverts', value: openFindings.toString(), subtext: 'Action Requise' },
                { label: 'Majeurs', value: majorFindings.toString(), subtext: 'Priorité Haute' },
                { label: 'Risques Liés', value: relatedRisks.length.toString() }
            ];

            // Calculate Stats (Findings by Type)
            const typeCounts = { 'Majeure': 0, 'Mineure': 0, 'Opportunité': 0 };
            findingsForReport.forEach(f => { if (typeCounts[f.type as keyof typeof typeCounts] !== undefined) typeCounts[f.type as keyof typeof typeCounts]++; });

            const stats = [
                { label: 'Majeure', value: typeCounts['Majeure'], color: '#EF4444' }, // Red
                { label: 'Mineure', value: typeCounts['Mineure'], color: '#F59E0B' }, // Amber
                { label: 'Opportunité', value: typeCounts['Opportunité'], color: '#10B981' } // Emerald
            ].filter(s => s.value > 0);

            const { PdfService } = await import('../services/PdfService');

            PdfService.generateExecutiveReport(
                {
                    title: 'Rapport d\'Audit',
                    subtitle: selectedAudit.name,
                    filename: `Rapport_Audit_${selectedAudit.name.replace(/\s+/g, '_')}.pdf`,
                    organizationName: organization?.name || user?.email?.split('@')[1] || 'Sentinel GRC',
                    organizationLogo: organization?.logoUrl,
                    author: selectedAudit.auditor,
                    summary: summary,
                    metrics,
                    stats,
                    coverImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop' // Audit/Business meeting image
                },
                (doc, startY) => {
                    let y = startY;

                    // Audit Details Section
                    doc.setFontSize(14); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
                    doc.text("1. Détails de l'Audit", 14, y);
                    y += 10;

                    // Details Content
                    doc.setFontSize(10);
                    doc.setTextColor(50);
                    doc.setFont('helvetica', 'normal');

                    const details = [
                        { label: "Date de planification", value: selectedAudit.dateScheduled ? new Date(selectedAudit.dateScheduled).toLocaleDateString() : "Non planifié" },
                        { label: "Type d'Audit", value: selectedAudit.type },
                        { label: "Auditeur", value: selectedAudit.auditor || "Non assigné" },
                        { label: "Périmètre", value: selectedAudit.scope || "Non défini" },
                        { label: "Référentiel", value: selectedAudit.framework || "Non défini" }
                    ];

                    let detailY = y;
                    details.forEach(detail => {
                        doc.setFont('helvetica', 'bold');
                        doc.text(`${detail.label}:`, 14, detailY);
                        doc.setFont('helvetica', 'normal');
                        doc.text(detail.value, 60, detailY);
                        detailY += 6;
                    });

                    // Add Status Donut Chart (Right side)
                    if (findingsForReport.length > 0) {
                        const closedFindings = findingsForReport.length - openFindings;
                        const statusData = [
                            { label: 'Ouvert', value: openFindings, color: '#EF4444' }, // Red
                            { label: 'Fermé/Traité', value: closedFindings, color: '#10B981' } // Green
                        ];

                        // Draw chart at x=130, y=startY
                        PdfService.drawDonutChart(
                            doc,
                            130,
                            startY + 5,
                            20,
                            statusData,
                            `${Math.round((closedFindings / findingsForReport.length) * 100)}%`
                        );

                        // Add title for chart
                        doc.setFontSize(10); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
                        doc.text("État des Constats", 140, startY, { align: 'center' });
                    }

                    y = Math.max(detailY + 10, startY + 60); // Ensure stats don't overlap with next section if details are short

                    doc.setFontSize(14); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
                    doc.text("2. Constats d'Audit", 14, y);
                    y += 10;

                    if (findings.length > 0) {
                        const findingsData = findings.map(f => [
                            f.type,
                            f.description,
                            f.relatedControlId ? controls.find(c => c.id === f.relatedControlId)?.code || '-' : '-',
                            f.status
                        ]);

                        doc.autoTable({
                            startY: y,
                            head: [['Type', 'Description', 'Contrôle', 'Statut']],
                            body: findingsData,
                            theme: 'striped',
                            headStyles: { fillColor: [79, 70, 229] },
                            styles: { fontSize: 9 },
                            margin: { left: 14, right: 14 }
                        });
                        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
                    } else {
                        doc.setFontSize(10); doc.setTextColor(100); doc.setFont('helvetica', 'italic');
                        doc.text("Aucun constat enregistré.", 14, y);
                        y += 15;
                    }

                    // Related Risks Section (if any)
                    if (relatedRisks.length > 0) {
                        doc.setFontSize(14); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
                        doc.text("3. Risques Associés", 14, y);
                        y += 8;

                        const risksData = relatedRisks.map(r => [
                            r.threat,
                            r.score.toString(),
                            r.status
                        ]);

                        doc.autoTable({
                            startY: y,
                            head: [['Menace', 'Score', 'Statut']],
                            body: risksData,
                            theme: 'grid',
                            headStyles: { fillColor: [220, 38, 38] }, // Red for risks
                            styles: { fontSize: 9 }
                        });
                    }
                }
            );
            addToast("Rapport généré avec succès", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Audits.generateAuditReport', 'REPORT_GENERATION_FAILED');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const generateAuditPlan = () => {
        if (!selectedAudit) return;

        void (async () => {
            const { PdfService } = await import('../services/PdfService');

            PdfService.generateExecutiveReport(
                {
                    title: 'Plan d\'Audit',
                    subtitle: selectedAudit.name,
                    filename: `Plan_Audit_${selectedAudit.name.replace(/\s+/g, '_')}.pdf`,
                    organizationName: organization?.name || user?.email?.split('@')[1] || 'Sentinel GRC',
                    organizationLogo: organization?.logoUrl,
                    author: selectedAudit.auditor,
                    coverImage: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2070&auto=format&fit=crop' // Collaborative working image
                },
                (doc, startY) => {
                    let y = startY;

                    // 1. Objectifs & Périmètre
                    doc.setFontSize(14); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
                    doc.text("1. Objectifs et Périmètre", 14, y);
                    y += 8;

                    doc.setFontSize(10); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
                    doc.text(`Objectif Principal: Vérifier la conformité et l'efficacité des contrôles.`, 14, y);
                    y += 6;

                    if (selectedAudit.scope) {
                        doc.setFont('helvetica', 'bold');
                        doc.text("Périmètre:", 14, y);
                        y += 5;
                        doc.setFont('helvetica', 'normal');
                        const splitScope = doc.splitTextToSize(selectedAudit.scope, 180);
                        doc.text(splitScope, 14, y);
                        y += (splitScope.length * 5) + 5;
                    } else {
                        y += 5;
                    }

                    // 2. Référentiel (Contrôles)
                    if (selectedAudit.relatedControlIds && selectedAudit.relatedControlIds.length > 0) {
                        doc.setFontSize(14); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
                        doc.text("2. Référentiel et Critères d'Audit", 14, y);
                        y += 8;

                        const relatedControls = controls.filter(c => selectedAudit.relatedControlIds?.includes(c.id));
                        const controlsData = relatedControls.map(c => [c.code, c.name]);

                        doc.autoTable({
                            startY: y,
                            head: [['Code', 'Contrôle']],
                            body: controlsData,
                            theme: 'grid',
                            headStyles: { fillColor: [79, 70, 229] },
                            styles: { fontSize: 9 },
                            columnStyles: { 0: { cellWidth: 30, fontStyle: 'bold' } }
                        });

                        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
                    }

                    // 3. Logistique
                    doc.setFontSize(14); doc.setTextColor(79, 70, 229); doc.setFont('helvetica', 'bold');
                    doc.text("3. Logistique", 14, y);
                    y += 8;

                    const logistics = [
                        ['Date', selectedAudit.dateScheduled ? new Date(selectedAudit.dateScheduled).toLocaleDateString() : 'TBD'],
                        ['Auditeur Principal', selectedAudit.auditor],
                        ['Type d\'Audit', selectedAudit.type]
                    ];

                    doc.autoTable({
                        startY: y,
                        body: logistics,
                        theme: 'plain',
                        styles: { fontSize: 10, cellPadding: 2 },
                        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
                    });
                }
            );
        })().catch((error) => {
            ErrorLogger.error(error, 'Audits.generateAuditPlan');
        });
    };

    const generateNonConformityReport = () => {
        if (!selectedAudit || !findings) return;
        const nc = findings.filter(f => f.type === 'Majeure' || f.type === 'Mineure');
        if (nc.length === 0) { addToast("Aucune non-conformité à exporter", "info"); return; }

        PdfService.generateExecutiveReport(
            {
                title: 'Rapport de Non-Conformité',
                subtitle: selectedAudit.name,
                filename: `Non_Conformites_${selectedAudit.name.replace(/\s+/g, '_')}.pdf`,
                organizationName: user?.email?.split('@')[1] || 'Sentinel GRC',
                author: selectedAudit.auditor,
                coverImage: 'https://images.unsplash.com/photo-1590856029826-c7a73142bbf1?q=80&w=2073&auto=format&fit=crop', // Shield/Alert
                summary: `Ce rapport liste les ${nc.length} non-conformités identifiées lors de l'audit "${selectedAudit.name}". Une attention immédiate est requise pour les non-conformités majeures.`
            },
            (doc: jsPDF, startY: number) => {
                let y = startY;

                doc.setFontSize(14); doc.setTextColor(220, 38, 38); doc.setFont('helvetica', 'bold');
                doc.text("Liste des Non-Conformités", 14, y);
                y += 8;

                const rows = nc.map(f => [
                    f.type,
                    f.description,
                    f.relatedControlId ? controls.find(c => c.id === f.relatedControlId)?.code || '-' : '-',
                    f.status
                ]);

                doc.autoTable({
                    startY: y,
                    head: [['Type', 'Description', 'Contrôle', 'Statut']],
                    body: rows,
                    theme: 'striped',
                    headStyles: { fillColor: [220, 38, 38] }, // Red for alerts
                    styles: { fontSize: 9 }
                });
            }
        );
    };

    const handleExportPack = async () => {
        if (!selectedAudit) return;
        addToast("Génération du pack en cours...", "info");
        try {
            const { default: JSZip } = await import('jszip');
            const zip = new JSZip();
            const folder = zip.folder(`Audit_Pack_${selectedAudit.name.replace(/\s+/g, '_')}`);
            if (!folder) return;

            // 1. Generate Report PDF
            const findingsData = findings.map(f => [f.type, f.description, f.relatedControlId ? controls.find(c => c.id === f.relatedControlId)?.code || '-' : '-', f.status]);

            const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
            const canWhiteLabel = limits.features.whiteLabelReports;

            const doc = PdfService.generateTableReport(
                {
                    title: `Rapport d'Audit: ${selectedAudit.name}`,
                    subtitle: `Auditeur: ${selectedAudit.auditor} | Date: ${new Date(selectedAudit.dateScheduled).toLocaleDateString()}`,
                    filename: 'Rapport_Audit.pdf',
                    save: false,
                    organizationName: canWhiteLabel ? organization?.name : undefined,
                    organizationLogo: canWhiteLabel ? organization?.logoUrl : undefined,
                    coverImage: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop', // Business
                    includeCover: true,
                    author: selectedAudit.auditor
                },
                ['Type', 'Description', 'Contrôle', 'Statut'],
                findingsData
            );

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
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Planifié': return 'bg-blue-50 dark:bg-slate-900 text-blue-700 border-blue-100 dark:bg-slate-900/20 dark:text-blue-400 dark:border-blue-900/30';
            case 'En cours': return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30';
            case 'Terminé': return 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30';
            case 'Validé': return 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/30';
            default: return 'bg-gray-50 text-slate-700 border-gray-100 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const filteredAudits = React.useMemo(() => {
        const needle = (deferredFilter || '').toLowerCase().trim();
        if (!needle) return audits;
        return audits.filter(a => (a.name || '').toLowerCase().includes(needle));
    }, [audits, deferredFilter]);

    const getBreadcrumbs = () => {
        const crumbs: { label: string; onClick?: () => void }[] = [{ label: 'Audits', onClick: () => { setSelectedAudit(null); setCreationMode(false); setShowFindingsDrawer(false); setEditingAudit(null); } }];

        if (creationMode) {
            crumbs.push({ label: 'Nouvel Audit' });
            return crumbs;
        }

        if (editingAudit) {
            crumbs.push({ label: editingAudit.name });
            crumbs.push({ label: 'Modification' });
            return crumbs;
        }

        if (selectedAudit) {
            crumbs.push({ label: selectedAudit.name });
        }

        return crumbs;
    };

    const columns = React.useMemo<ColumnDef<Audit>[]>(() => [
        {
            accessorKey: 'name',
            header: 'Audit',
            cell: ({ row }) => (
                <div>
                    <div className="font-bold text-slate-900 dark:text-white text-[15px]">{row.original.name}</div>
                    <div className="text-xs text-slate-600 font-medium">{row.original.type}</div>
                </div>
            )
        },
        {
            accessorKey: 'auditor',
            header: 'Auditeur',
            cell: ({ row }) => (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
                    <User className="h-4 w-4" />
                    {row.original.auditor || 'Non assigné'}
                </div>
            )
        },
        {
            accessorKey: 'status',
            header: 'Statut',
            cell: ({ row }) => {
                const colors = {
                    'Planifié': 'bg-blue-100 text-blue-800 border-blue-200',
                    'En cours': 'bg-indigo-100 text-indigo-800 border-indigo-200',
                    'Validé': 'bg-green-100 text-green-800 border-green-200',
                    'Retard': 'bg-red-100 text-red-800 border-red-200',
                    'Annulé': 'bg-gray-100 text-gray-800 border-gray-200'
                };
                return (
                    <span className={`px-2 py-1 rounded-md text-xs font-bold border ${colors[row.original.status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
                        {row.original.status}
                    </span>
                );
            }
        },
        {
            accessorKey: 'findingsCount',
            header: 'Écarts',
            cell: ({ row }) => (
                <div className="flex items-center text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg w-fit">
                    <AlertOctagon className="h-3.5 w-3.5 mr-1.5" /> {row.original.findingsCount || 0}
                </div>
            )
        },
        {
            accessorKey: 'dateScheduled',
            header: 'Date',
            cell: ({ row }) => (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
                    <CalendarDays className="h-4 w-4" />
                    {row.original.dateScheduled ? new Date(row.original.dateScheduled).toLocaleDateString() : 'TBD'}
                </div>
            )
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="text-right flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()}>
                    {canEdit && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); openEditDrawer(row.original); }} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100" title="Modifier">
                                <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); initiateDeleteAudit(row.original.id, row.original.name); }} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100" title="Supprimer">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>
            )
        }
    ], [canEdit, openEditDrawer, initiateDeleteAudit]);

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="p-6 md:p-8 max-w-[1920px] mx-auto space-y-8 pb-20 relative min-h-screen animate-fade-in"
        >
            <MasterpieceBackground />

            <SEO
                title="Gestion des Audits"
                description="Planifiez et réalisez vos audits internes et externes ISO 27001."
            />
            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title={auditsTitle}
                    subtitle={auditsSubtitle}
                    breadcrumbs={[
                        { label: 'Audits' }
                    ]}
                    icon={<ClipboardCheck className="h-6 w-6 text-white" strokeWidth={2.5} />}
                    actions={canEdit && (
                        hasPermission(user, 'Audit', 'create') && (
                            <>
                                <Menu as="div" className="relative inline-block text-left">
                                    <Menu.Button className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                                        <MoreVertical className="h-5 w-5" />
                                    </Menu.Button>
                                    <Transition
                                        as={React.Fragment}
                                        enter="transition ease-out duration-100"
                                        enterFrom="transform opacity-0 scale-95"
                                        enterTo="transform opacity-100 scale-100"
                                        leave="transition ease-in duration-75"
                                        leaveFrom="transform opacity-100 scale-100"
                                        leaveTo="transform opacity-0 scale-95"
                                    >
                                        <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                            <div className="p-1">
                                                <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                    Rapports & Exports
                                                </div>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={handleExportExecutiveReport}
                                                            disabled={isGeneratingReport}
                                                            className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                                } group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50`}
                                                        >
                                                            {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-indigo-500'}`} />}
                                                            Rapport Exécutif
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={handleExportPack}
                                                            className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                                } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                        >
                                                            <FolderKanban className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-emerald-600'}`} />
                                                            Pack Audit (ZIP)
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={handleExportCalendar}
                                                            className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                                } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                        >
                                                            <Calendar className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-blue-500'}`} />
                                                            Export Calendrier
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={handleExportCSV}
                                                            disabled={isExportingCSV}
                                                            className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                                } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                        >
                                                            {isExportingCSV ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />}
                                                            Export CSV
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            </div>
                                        </Menu.Items>
                                    </Transition>
                                </Menu>

                                <CustomTooltip content="Obtenir des suggestions d'audit par IA">
                                    <button
                                        onClick={handleGeneratePlan}
                                        className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-bold shadow-lg hover:shadow-pink-500/25 transition-all hover:scale-105 text-sm"
                                    >
                                        <BrainCircuit className="w-4 h-4" />
                                        <span className="hidden lg:inline">Suggestions IA</span>
                                    </button>
                                </CustomTooltip>

                                <CustomTooltip content="Planifier un nouvel audit">
                                    <button onClick={() => openCreationDrawer()} className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20">
                                        <Plus className="h-4 w-4" />
                                        <span className="hidden sm:inline">Nouvel Audit</span>
                                    </button>
                                </CustomTooltip>
                            </>
                        )
                    )}
                />
            </motion.div>

            {/* Dashboard */}
            {!selectedAudit && (
                <motion.div variants={slideUpVariants}>
                    <AuditDashboard
                        audits={filteredAudits}
                        findings={allFindings}
                        onFilterChange={(filter) => {
                            if (filter) {
                                // Implement filter logic if needed
                            }
                        }}
                    />
                </motion.div>
            )}

            <motion.div variants={slideUpVariants}>
                <PageControls
                    searchQuery={filter}
                    onSearchChange={setFilter}
                    searchPlaceholder="Rechercher un audit..."
                    totalItems={filteredAudits.length}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    secondaryActions={null}
                />
            </motion.div>

            {viewMode === 'list' ? (
                <motion.div variants={slideUpVariants} className="glass-panel w-full max-w-full rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200 dark:border-white/5 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-10">
                        <DataTable
                            columns={columns}
                            data={filteredAudits}
                            selectable={true}
                            onBulkDelete={handleBulkDelete}
                            onRowClick={handleOpenAudit}
                            searchable={false}
                            loading={loading}
                        />
                    </div>
                </motion.div>
            ) : (
                <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full"><CardSkeleton count={3} /></div>
                    ) : filteredAudits.length === 0 ? (
                        <div className="col-span-full">
                            <EmptyState
                                icon={Activity}
                                title="Aucun audit planifié"
                                description={filter ? "Aucun audit ne correspond à votre recherche." : "Planifiez des audits réguliers pour assurer la conformité continue."}
                                actionLabel={filter || !hasPermission(user, 'Audit', 'create') ? undefined : "Planifier un audit"}
                                onAction={filter || !hasPermission(user, 'Audit', 'create') ? undefined : () => openCreationDrawer()}
                            />
                        </div>
                    ) : (
                        filteredAudits.map(audit => (
                            <div key={audit.id} onClick={() => handleOpenAudit(audit)} className="glass-panel rounded-[2.5rem] p-7 shadow-sm card-hover cursor-pointer group border border-white/50 dark:border-white/5 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-5">
                                        <div className="p-3 bg-indigo-50 dark:bg-slate-900 dark:bg-slate-800 rounded-2xl text-indigo-600 shadow-inner">
                                            <Activity className="h-6 w-6" />
                                        </div>
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(audit.status)}`}>
                                            {audit.status}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">{audit.name}</h3>
                                    <div className="flex items-center text-sm text-slate-600 dark:text-slate-400 mb-4">
                                        <User className="h-3.5 w-3.5 mr-2" /> {audit.auditor}
                                    </div>

                                    <div className="flex justify-between items-center pt-4 border-t border-dashed border-gray-200 dark:border-white/10 mt-auto">
                                        <div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-400">
                                            <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> {audit.dateScheduled ? new Date(audit.dateScheduled).toLocaleDateString() : 'Non planifié'}
                                        </div>
                                        <div className="flex items-center text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">
                                            <AlertOctagon className="h-3.5 w-3.5 mr-1.5" /> {audit.findingsCount || 0} écarts
                                        </div>
                                    </div>

                                    {canEdit && (
                                        <div className="absolute top-6 right-6 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); openEditDrawer(audit); }} className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl text-slate-500 hover:text-indigo-500 shadow-sm backdrop-blur-sm transition-colors">
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); initiateDeleteAudit(audit.id, audit.name) }} className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl text-slate-500 hover:text-red-500 shadow-sm backdrop-blur-sm transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </motion.div>
            )}

            {/* Findings Drawer */}
            {/* Findings Drawer */}
            <Drawer
                isOpen={showFindingsDrawer && !!selectedAudit}
                onClose={() => setShowFindingsDrawer(false)}
                title={selectedAudit?.name || 'Détails de l\'audit'}
                subtitle={`${selectedAudit?.type || ''}${selectedAudit?.dateScheduled ? ` • ${new Date(selectedAudit.dateScheduled).toLocaleDateString()}` : ''}`}
                width="max-w-6xl"
                breadcrumbs={getBreadcrumbs()}
                actions={
                    selectedAudit && (
                        <>
                            {canDeleteResource(user, 'Audit') && (
                                <CustomTooltip content="Supprimer l'audit">
                                    <button onClick={() => selectedAudit && initiateDeleteAudit(selectedAudit.id, selectedAudit.name)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-red-500">
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </CustomTooltip>
                            )}
                            <CustomTooltip content="Fermer">
                                <button onClick={() => { setShowFindingsDrawer(false); setSelectedAudit(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500">
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                            </CustomTooltip>
                            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-2"></div>

                            {selectedAudit.status !== 'Validé' && canEdit && (
                                <button
                                    onClick={async () => {
                                        if (selectedAudit.createdBy === user?.uid) {
                                            addToast("Ségrégation des tâches : Vous ne pouvez pas valider un audit que vous avez créé.", "error");
                                            return;
                                        }
                                        setIsValidating(true);
                                        try {
                                            await updateDoc(doc(db, 'audits', selectedAudit.id), { status: 'Validé' });
                                            await logAction(user, 'VALIDATE', 'Audit', `Audit validé: ${selectedAudit.name}`);
                                            addToast("Audit validé avec succès", "success");
                                            refreshAudits();
                                            setSelectedAudit({ ...selectedAudit, status: 'Validé' });
                                        } catch (e) {
                                            ErrorLogger.handleErrorWithToast(e, 'Audits.validate', 'UPDATE_FAILED');
                                        } finally {
                                            setIsValidating(false);
                                        }
                                    }}
                                    disabled={isValidating}
                                    className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2 ${isValidating ? 'opacity-75 cursor-wait' : ''}`}
                                    title={selectedAudit.createdBy === user?.uid ? "Vous ne pouvez pas valider votre propre audit" : "Valider l'audit"}
                                >
                                    {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                                    <span className="hidden sm:inline">{isValidating ? 'Validation...' : 'Valider'}</span>
                                </button>
                            )}

                            <button
                                onClick={generateAuditReport}
                                disabled={isGeneratingReport}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 font-medium disabled:opacity-50"
                            >
                                {isGeneratingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText size={18} />}
                                Rapport Exécutif
                            </button>
                            <button onClick={generateAuditPlan} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-purple-500" title="Plan d'Audit">
                                <Calendar className="h-5 w-5" />
                            </button>
                            <button onClick={generateNonConformityReport} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-orange-500" title="Rapport Non-Conformités">
                                <AlertTriangle className="h-5 w-5" />
                            </button>
                            <button onClick={handleExportPack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-emerald-500" title="Pack Complet (ZIP)">
                                <Download className="h-5 w-5" />
                            </button>
                        </>
                    )
                }
            >
                {selectedAudit && (
                    <div className="flex flex-col h-full">
                        {/* Tabs */}
                        <div className="px-8 border-b border-gray-100 dark:border-white/5 bg-white/30 dark:bg-white/5">
                            <ScrollableTabs
                                tabs={[
                                    { id: 'findings', label: 'Constats', icon: AlertOctagon },
                                    { id: 'checklist', label: 'Checklist', icon: ClipboardCheck },
                                    { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
                                    { id: 'evidence', label: 'Preuves', icon: FileText },
                                    { id: 'questionnaires', label: 'Questionnaires', icon: MessageSquare },
                                    { id: 'collaboration', label: 'Collaboration', icon: MessageSquare },
                                    { id: 'team', label: 'Équipe', icon: Users },
                                    { id: 'scope', label: 'Périmètre', icon: Target }
                                ]}
                                activeTab={inspectorTab}
                                onTabChange={(id) => setInspectorTab(id as typeof inspectorTab)}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar space-y-8">
                            {inspectorTab === 'findings' && (
                                <>
                                    {canEdit && (
                                        <form onSubmit={findingForm.handleSubmit(handleAddFinding)} className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm mb-8">
                                            <h3 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-widest flex items-center"><Plus className="h-3.5 w-3.5 mr-2" /> Ajouter un constat</h3>
                                            <div className="space-y-6">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex justify-end">
                                                        {(() => {
                                                            const findingType = findingForm.watch('type');
                                                            const relatedControlId = findingForm.watch('relatedControlId');
                                                            const controlCode = relatedControlId ? controls.find(c => c.id === relatedControlId)?.code : 'Non spécifié';

                                                            return (
                                                                <AIAssistButton
                                                                    context={{
                                                                        auditName: selectedAudit.name,
                                                                        auditType: selectedAudit.type,
                                                                        findingType: findingType,
                                                                        control: controlCode
                                                                    }}
                                                                    fieldName="description"
                                                                    onSuggest={(val: string) => findingForm.setValue('description', val)}
                                                                    prompt="Rédige un constat d'audit (écart) clair, factuel et professionnel. Précise le problème observé et l'impact potentiel."
                                                                />
                                                            );
                                                        })()}
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
                                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Ou téléverser une nouvelle preuve</label>
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
                                        <h3 className="text-xs font-bold uppercase text-slate-500 mb-2 tracking-widest px-2">Constats ({findings.length})</h3>
                                        {findings.length === 0 ? (
                                            <div className="text-center py-8 text-slate-500 bg-white dark:bg-slate-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-white/10 italic text-sm">Aucun écart relevé pour le moment.</div>
                                        ) : (
                                            findings.map(finding => (
                                                <div key={finding.id} className="p-5 bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm card-hover group relative">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${finding.type === 'Majeure' ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400' : finding.type === 'Mineure' ? 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400' : 'bg-blue-50 dark:bg-slate-900 text-blue-700 border-blue-100 dark:bg-slate-900/20 dark:text-blue-400'}`}>
                                                            {finding.type}
                                                        </span>
                                                        {canEdit && (
                                                            <button onClick={() => initiateDeleteFinding(finding.id)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3 leading-relaxed">{finding.description}</p>
                                                    {finding.relatedControlId && (
                                                        <div className="flex items-center text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-black/20 px-3 py-1.5 rounded-lg w-fit">
                                                            <ShieldAlert className="h-3 w-3 mr-1.5" />
                                                            {controls.find(c => c.id === finding.relatedControlId)?.code || 'Contrôle Inconnu'}
                                                        </div>
                                                    )}
                                                    {finding.evidenceIds && finding.evidenceIds.length > 0 && (
                                                        <div className="mt-2 flex items-center text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-slate-900 dark:bg-slate-900/20 px-3 py-1.5 rounded-lg w-fit">
                                                            <Link className="h-3 w-3 mr-1.5" />
                                                            {documents.find(d => d.id === finding.evidenceIds![0])?.title || 'Preuve liée'}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}

                            {inspectorTab === 'intelligence' && (
                                <div className="h-full overflow-y-auto p-6">
                                    <AuditAIAssistant
                                        audit={selectedAudit}
                                        findings={findings}
                                        onUpdate={(updates) => handleAuditFormSubmit({ ...selectedAudit, ...updates })}
                                    />
                                </div>
                            )}

                            {inspectorTab === 'checklist' && (
                                <div className="space-y-6">
                                    {!checklist ? (
                                        <div className="text-center py-12">
                                            <ClipboardCheck className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Aucune checklist générée</h3>
                                            <p className="text-slate-600 mb-6 max-w-xs mx-auto">Générez une checklist basée sur les contrôles ISO 27001 pour guider votre audit.</p>
                                            {canEdit && (
                                                <button onClick={generateChecklist} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition-transform">Générer la Checklist ISO 27001</button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-bold text-slate-900 dark:text-white">Checklist de conformité</h3>
                                                <div className="flex gap-2">
                                                    {canEdit && (
                                                        <button onClick={markAllConform} className="text-xs font-bold bg-green-50 dark:bg-green-900/20 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors flex items-center"><CheckCheck className="h-3.5 w-3.5 mr-1" /> Tout Conforme</button>
                                                    )}
                                                    <button onClick={generateSoA} className="text-xs font-bold bg-indigo-50 dark:bg-slate-900 dark:bg-slate-900/20 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">Générer SoA</button>
                                                    <span className="text-xs font-medium bg-slate-100 dark:bg-white/10 px-2 py-1.5 rounded-lg flex items-center">{checklist.questions.filter(q => q.response === 'Conforme').length} / {checklist.questions.length} Conformes</span>
                                                </div>
                                            </div>
                                            {checklist.questions.map(q => (
                                                <div key={q.id} className="p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className="text-xs font-bold bg-slate-100 dark:bg-white/10 px-2 py-1 rounded text-slate-600 dark:text-slate-300">{q.controlCode}</span>
                                                        <select
                                                            className={`text-xs font-bold px-2 py-1 rounded border-none outline-none cursor-pointer ${q.response === 'Conforme' ? 'text-green-600 bg-green-50' : q.response === 'Non-conforme' ? 'text-red-600 bg-red-50' : 'text-slate-600 bg-slate-100'}`}
                                                            value={q.response}
                                                            onChange={(e) => handleChecklistAnswer(q.id, e.target.value as AuditQuestion['response'])}
                                                            disabled={!canEdit}
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
                                                        className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-black/20 rounded-xl border-none focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                                                        value={q.comment || ''}
                                                        onChange={(e) => handleChecklistAnswer(q.id, q.response, e.target.value)}
                                                        disabled={!canEdit}
                                                    />

                                                    {/* Evidence Section */}
                                                    <div className="mt-2">
                                                        <button
                                                            onClick={() => setOpenEvidenceQuestionId(openEvidenceQuestionId === q.id ? null : q.id)}
                                                            className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
                                                        >
                                                            <Link className="h-3 w-3 mr-1" />
                                                            {openEvidenceQuestionId === q.id ? 'Masquer les preuves' : `Gérer les preuves (${q.evidenceIds?.length || 0})`}
                                                        </button>

                                                        {openEvidenceQuestionId === q.id && (
                                                            <div className="mt-3 p-3 bg-slate-50 dark:bg-black/20 rounded-xl animate-fade-in">
                                                                <div className="flex flex-wrap gap-2 mb-3">
                                                                    {q.evidenceIds?.map(eid => {
                                                                        const doc = documents.find(d => d.id === eid);
                                                                        return doc ? (
                                                                            <a key={eid} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                                                                <FileText className="h-3 w-3" /> {doc.title}
                                                                            </a>
                                                                        ) : null;
                                                                    })}
                                                                    {(!q.evidenceIds || q.evidenceIds.length === 0) && <span className="text-[10px] text-slate-400 italic">Aucune preuve liée.</span>}
                                                                </div>
                                                                {canEdit && (
                                                                    <FileUploader
                                                                        onUploadComplete={(url, name) => handleChecklistEvidenceUpload(q.id, url, name)}
                                                                        category="evidence"
                                                                        maxSizeMB={5}
                                                                        allowedTypes={['application/pdf', 'image/*']}
                                                                    />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {inspectorTab === 'evidence' && (
                                <EvidenceRequestList
                                    auditId={selectedAudit.id}
                                    organizationId={selectedAudit.organizationId}
                                    users={usersList}
                                    controls={controls}
                                    canEdit={canEdit}
                                />
                            )}

                            {inspectorTab === 'questionnaires' && (
                                <QuestionnaireList
                                    auditId={selectedAudit.id}
                                    organizationId={selectedAudit.organizationId}
                                    users={usersList}
                                    canEdit={canEdit}
                                />
                            )}

                            {inspectorTab === 'collaboration' && (
                                <div className="max-w-3xl mx-auto">
                                    <Comments
                                        collectionName="audits"
                                        documentId={selectedAudit.id}
                                    />
                                </div>
                            )}

                            {inspectorTab === 'team' && (
                                <AuditTeam
                                    audit={selectedAudit}
                                    users={usersList}
                                    canEdit={canEdit}
                                />
                            )}

                            {inspectorTab === 'scope' && (
                                <div className="space-y-8">
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><Target className="h-4 w-4 mr-2" /> Description du Périmètre</h4>
                                        <SafeHTML content={selectedAudit.scope || ''} />
                                    </div>
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><Server className="h-4 w-4 mr-2" /> Actifs Audités ({selectedAudit.relatedAssetIds?.length || 0})</h4>
                                        <div className="space-y-2">
                                            {selectedAudit.relatedAssetIds?.map(aid => {
                                                const asset = assets.find(a => a.id === aid);
                                                return asset ? (
                                                    <div key={aid} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-black/20 rounded-xl">
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{asset.name}</span>
                                                        <span className="text-xs text-slate-600">{asset.type}</span>
                                                    </div>
                                                ) : null;
                                            })}
                                            {(!selectedAudit.relatedAssetIds || selectedAudit.relatedAssetIds.length === 0) && <p className="text-sm text-slate-500 italic">Aucun actif lié.</p>}
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><Flame className="h-4 w-4 mr-2" /> Risques Audités ({selectedAudit.relatedRiskIds?.length || 0})</h4>
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
                                            {(!selectedAudit.relatedRiskIds || selectedAudit.relatedRiskIds.length === 0) && <p className="text-sm text-slate-500 italic">Aucun risque lié.</p>}
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><ShieldAlert className="h-4 w-4 mr-2" /> Contrôles Audités ({selectedAudit.relatedControlIds?.length || 0})</h4>
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
                                            {(!selectedAudit.relatedControlIds || selectedAudit.relatedControlIds.length === 0) && <p className="text-sm text-slate-500 italic">Aucun contrôle lié.</p>}
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><FolderKanban className="h-4 w-4 mr-2" /> Projets Audités ({selectedAudit.relatedProjectIds?.length || 0})</h4>
                                        <div className="space-y-2">
                                            {selectedAudit.relatedProjectIds?.map(pid => {
                                                const project = rawProjects.find(p => p.id === pid);
                                                return project ? (
                                                    <div key={pid} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-black/20 rounded-xl">
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{project.name}</span>
                                                        <span className={`text-xs px-2 py-1 rounded-lg font-bold uppercase ${project.status === 'Terminé' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{project.status}</span>
                                                    </div>
                                                ) : null;
                                            })}
                                            {(!selectedAudit.relatedProjectIds || selectedAudit.relatedProjectIds.length === 0) && <p className="text-sm text-slate-500 italic">Aucun projet lié.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Drawer>

            {/* Create/Edit Modal */}
            {/* Create/Edit Drawer */}
            <Drawer
                isOpen={creationMode || !!editingAudit}
                onClose={() => { setCreationMode(false); setEditingAudit(null); }}
                title={editingAudit ? "Modifier l'Audit" : "Nouvel Audit"}
                subtitle={editingAudit ? editingAudit.name : "Planification"}
                width="max-w-6xl"
                breadcrumbs={getBreadcrumbs()}
            >
                <AuditForm
                    onCancel={() => { setCreationMode(false); setEditingAudit(null); }}
                    onSubmit={handleAuditFormSubmit}
                    existingAudit={editingAudit}
                    assets={assets}
                    risks={rawRisks}
                    controls={controls}
                    projects={rawProjects}
                    usersList={usersList}
                    isLoading={isSubmitting}
                />
            </Drawer>
        </motion.div>
    );
};
