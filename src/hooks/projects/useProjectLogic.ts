
import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { where, doc, updateDoc, addDoc, collection, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase';
import { Project, ProjectTask, Risk, Control, Asset, Audit, UserProfile } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { logAction } from '../../services/logger';
import { projectSchema } from '../../schemas/projectSchema';
import { sanitizeData } from '../../utils/dataSanitizer';
import { z } from 'zod';
import { SubscriptionService } from '../../services/subscriptionService';
import { canEditResource, canDeleteResource } from '../../utils/permissions';
import { usePlanLimits } from '../usePlanLimits';

export const useProjectLogic = () => {
    const { user, addToast, organization } = useStore();
    const role = user?.role || 'user';
    const canEdit = canEditResource(user, 'Project');
    const { limits } = usePlanLimits();

    // Data Fetching
    const { data: rawProjects, loading: loadingProjects } = useFirestoreCollection<Project>('projects', [where('organizationId', '==', user?.organizationId)], { logError: true, realtime: true });
    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>('risks', [where('organizationId', '==', user?.organizationId)], { logError: true, realtime: true });
    const { data: rawAudits, loading: loadingAudits } = useFirestoreCollection<Audit>('audits', [where('organizationId', '==', user?.organizationId)], { logError: true, realtime: true });
    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>('controls', [where('organizationId', '==', user?.organizationId)], { logError: true, realtime: true });
    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>('assets', [where('organizationId', '==', user?.organizationId)], { logError: true, realtime: true });
    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>('users', [where('organizationId', '==', user?.organizationId)], { logError: true, realtime: true });

    // Derived State
    const projects = useMemo(() => [...rawProjects].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), [rawProjects]);
    const risks = useMemo(() => [...rawRisks].sort((a, b) => b.score - a.score), [rawRisks]);
    const audits = useMemo(() => [...rawAudits].sort((a, b) => new Date(b.dateScheduled).getTime() - new Date(a.dateScheduled).getTime()), [rawAudits]);
    const controls = useMemo(() => [...rawControls].sort((a, b) => a.code.localeCompare(b.code)), [rawControls]);
    const assets = useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);

    const loading = loadingProjects || loadingRisks || loadingControls || loadingAssets || loadingUsers || loadingAudits;

    // Actions
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleProjectFormSubmit = async (
        projectData: Omit<Project, 'id' | 'organizationId' | 'tasks' | 'progress' | 'createdAt'>,
        editingProject: Project | null,
        preSelectedContext?: { type: 'risk' | 'control' | 'asset' | 'audit', id: string } | null
    ) => {
        if (!canEdit || !user?.organizationId) return;
        setIsSubmitting(true);
        try {
            const validatedData = projectSchema.parse(projectData);
            const cleanData = sanitizeData(validatedData);

            if (editingProject) {
                // Update
                await updateDoc(doc(db, 'projects', editingProject.id), { ...cleanData });
                await logAction(user, 'UPDATE', 'Project', `Mise à jour projet: ${validatedData.name}`);

                // Bidirectional Sync Logic (Risks, Controls, Assets)
                // Helper for sync
                const syncLinks = async (collectionName: string, fieldName: string, newIds: string[] = [], oldIds: string[] = []) => {
                    const added = newIds.filter(id => !oldIds.includes(id));
                    const removed = oldIds.filter(id => !newIds.includes(id));
                    for (const id of added) await updateDoc(doc(db, collectionName, id), { [fieldName]: arrayUnion(editingProject.id) });
                    for (const id of removed) await updateDoc(doc(db, collectionName, id), { [fieldName]: arrayRemove(editingProject.id) });
                };

                await syncLinks('risks', 'relatedProjectIds', validatedData.relatedRiskIds, editingProject.relatedRiskIds);
                await syncLinks('controls', 'relatedProjectIds', validatedData.relatedControlIds, editingProject.relatedControlIds);
                await syncLinks('assets', 'relatedProjectIds', validatedData.relatedAssetIds, editingProject.relatedAssetIds);
                // Note: Audits sync was missing in original update code for editing? Adding for consistency if needed, but original code didn't have it explicitly for Update, only Create. Keeping as is or adding? Original code didn't show Audit sync in Update block.

                // Check Completion
                if (validatedData.status === 'Terminé' && editingProject.status !== 'Terminé' && validatedData.relatedControlIds?.length) {
                    // Logic for completion confirmation handled in component usually, or return a flag?
                    // For refactor simplicity, we might keep the ConfirmModal logic in the View, or returning a promise/result here.
                }

            } else {
                // Create
                const canAddProject = await SubscriptionService.checkLimit(user.organizationId, 'projects', projects.length);
                if (!canAddProject) {
                    addToast(`Nombre maximum de projets atteint pour votre plan (${projects.length}/${limits?.maxProjects ?? '…'}).`, "error");
                    setIsSubmitting(false);
                    return;
                }
                const finalData = { ...cleanData };
                if (preSelectedContext) {
                    if (preSelectedContext.type === 'risk') finalData.relatedRiskIds = [...(finalData.relatedRiskIds || []), preSelectedContext.id];
                    if (preSelectedContext.type === 'control') finalData.relatedControlIds = [...(finalData.relatedControlIds || []), preSelectedContext.id];
                    if (preSelectedContext.type === 'asset') finalData.relatedAssetIds = [...(finalData.relatedAssetIds || []), preSelectedContext.id];
                    if (preSelectedContext.type === 'audit') finalData.relatedAuditIds = [...(finalData.relatedAuditIds || []), preSelectedContext.id];
                }

                const ref = await addDoc(collection(db, 'projects'), {
                    ...finalData,
                    organizationId: user.organizationId,
                    progress: 0,
                    tasks: [],
                    createdAt: new Date().toISOString()
                });

                // Sync for Create
                const pId = ref.id;
                const syncNew = async (coll: string, ids: string[]) => {
                    for (const id of ids) await updateDoc(doc(db, coll, id), { relatedProjectIds: arrayUnion(pId) });
                }
                if (finalData.relatedRiskIds) await syncNew('risks', finalData.relatedRiskIds);
                if (finalData.relatedControlIds) await syncNew('controls', finalData.relatedControlIds);
                if (finalData.relatedAssetIds) await syncNew('assets', finalData.relatedAssetIds);
                if (finalData.relatedAuditIds) await syncNew('audits', finalData.relatedAuditIds);

                await logAction(user, 'CREATE', 'Project', `Nouveau projet: ${validatedData.name}`);
                addToast("Projet créé avec succès", "success");
            }
        } catch (e) {
            if (e instanceof z.ZodError) {
                addToast((e as z.ZodError).issues[0].message, "error");
            } else {
                ErrorLogger.handleErrorWithToast(e, 'useProjectLogic.submit', 'UPDATE_FAILED');
            }
            throw e; // Re-throw to let component know
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDuplicate = async (project: Project) => {
        if (!canEdit || !user?.organizationId) return;
        const canAdd = await SubscriptionService.checkLimit(user.organizationId, 'projects', projects.length);
        if (!canAdd) return 'LIMIT_REACHED';

        setIsSubmitting(true);
        try {
            const newProjData = {
                ...project,
                name: `${project.name} (Copie)`,
                createdAt: new Date().toISOString(),
                organizationId: user.organizationId,
                progress: 0,
                tasks: project.tasks.map(t => ({ ...t, status: 'A faire', id: Date.now() + Math.random().toString() }))
            };
            // @ts-expect-error - Timestamp type mismatch with external library
            delete newProjData.id;

            await addDoc(collection(db, 'projects'), sanitizeData(newProjData));
            await logAction(user, 'CREATE', 'Project', `Duplication Projet: ${newProjData.name}`);
            addToast("Projet dupliqué", "success");
            return 'SUCCESS';
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Projects.handleDuplicate', 'CREATE_FAILED');
            return 'ERROR';
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteProject = async (id: string) => {
        if (!canDeleteResource(user, 'Project')) return;
        try {
            await deleteDoc(doc(db, 'projects', id));
            addToast("Projet supprimé", "info");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Projects.deleteProject', 'DELETE_FAILED');
        }
    };

    const updateProjectTasks = async (project: Project, tasks: ProjectTask[]) => {
        if (!canEdit) return;
        const completed = tasks.filter(t => t.status === 'Terminé').length;
        const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

        try {
            await updateDoc(doc(db, 'projects', project.id), { tasks, progress });
            return { tasks, progress };
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Projects.updateTasks', 'UPDATE_FAILED');
            throw e;
        }
    };

    return {
        projects, risks, audits, controls, assets, usersList, loading,
        handleProjectFormSubmit, handleDuplicate, deleteProject, updateProjectTasks,
        isSubmitting, role, canEdit, user, organization
    };
};
