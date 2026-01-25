
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { where, doc, updateDoc, addDoc, collection, writeBatch, limit, serverTimestamp, getCountFromServer, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { Project, ProjectTask, ProjectMilestone } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { ProjectService } from '../../services/projectService';
import { logAction } from '../../services/logger';
import { projectSchema } from '../../schemas/projectSchema';
import { sanitizeData } from '../../utils/dataSanitizer';
import { z } from 'zod';
import { SubscriptionService } from '../../services/subscriptionService';
import { canEditResource, canDeleteResource } from '../../utils/permissions';
import { usePlanLimits } from '../usePlanLimits';
import { ImportService } from '../../services/ImportService';
import { MockDataService } from '../../services/mockDataService';

export const useProjectLogic = () => {
    const { user, addToast, organization, demoMode } = useStore();
    const role = user?.role || 'user';
    const canEdit = canEditResource(user, 'Project');
    const { limits } = usePlanLimits();

    // Mock Data State
    const [mockData, setMockData] = useState<{
        projects: Project[];
    } | null>(null);

    // Data Fetching
    // Data Fetching
    // Data Fetching
    const organizationId = user?.organizationId;
    const constraints = useMemo(() => {
        return organizationId ? [where('organizationId', '==', organizationId), limit(500)] : undefined;
    }, [organizationId]);

    const { data: rawProjects, loading: loadingProjects } = useFirestoreCollection<Project>(
        'projects',
        constraints,
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    // Mock Data Effect
    useEffect(() => {
        if (demoMode && !mockData) {
            setMockData({
                projects: MockDataService.getCollection('projects') as Project[]
            });
        }
    }, [demoMode, mockData]);

    // Derived State
    const projects = useMemo(() => {
        const source = demoMode && mockData ? mockData.projects : rawProjects;
        return [...source].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [rawProjects, mockData, demoMode]);

    const loading = demoMode ? !mockData : loadingProjects;

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
            const batch = writeBatch(db); // Note: batch operations < 500 limit for typical project relationships

            if (editingProject) {
                // Update
                const projectRef = doc(db, 'projects', editingProject.id);
                batch.update(projectRef, { ...cleanData });

                // Use ProjectService to sync relationship links
                ProjectService.syncProjectLinks(batch, {
                    projectId: editingProject.id,
                    relatedRiskIds: validatedData.relatedRiskIds,
                    relatedControlIds: validatedData.relatedControlIds,
                    relatedAssetIds: validatedData.relatedAssetIds,
                    relatedAuditIds: validatedData.relatedAuditIds,
                    oldRiskIds: editingProject.relatedRiskIds,
                    oldControlIds: editingProject.relatedControlIds,
                    oldAssetIds: editingProject.relatedAssetIds,
                    oldAuditIds: editingProject.relatedAuditIds
                });

                await batch.commit();
                await logAction(user, 'UPDATE', 'Project', `Mise à jour projet: ${validatedData.name}`);

            } else {
                // Create
                const countSnap = await getCountFromServer(query(collection(db, 'projects'), where('organizationId', '==', user.organizationId)));
                const currentCount = countSnap.data().count;

                const canAddProject = await SubscriptionService.checkLimit(user.organizationId, 'projects', currentCount);
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

                const newProjectRef = doc(collection(db, 'projects'));
                batch.set(newProjectRef, {
                    ...finalData,
                    organizationId: user.organizationId,
                    progress: 0,
                    tasks: [],
                    createdAt: serverTimestamp()
                });

                // Use ProjectService to sync new project links
                ProjectService.syncNewProjectLinks(
                    batch,
                    newProjectRef.id,
                    finalData.relatedRiskIds,
                    finalData.relatedControlIds,
                    finalData.relatedAssetIds,
                    finalData.relatedAuditIds
                );

                await batch.commit();
                await logAction(user, 'CREATE', 'Project', `Nouveau projet: ${validatedData.name}`);
                addToast("Projet créé avec succès", "success");
            }
        } catch (e) {
            if (e instanceof z.ZodError) {
                addToast((e as z.ZodError).issues[0].message, "error");
            } else {
                ErrorLogger.handleErrorWithToast(e, 'useProjectLogic.submit', 'UPDATE_FAILED');
            }
            throw e;
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDuplicate = async (project: Project) => {
        if (!canEdit || !user?.organizationId) return;

        const countSnap = await getCountFromServer(query(collection(db, 'projects'), where('organizationId', '==', user.organizationId)));
        const canAdd = await SubscriptionService.checkLimit(user.organizationId, 'projects', countSnap.data().count);

        if (!canAdd) return 'LIMIT_REACHED';

        setIsSubmitting(true);
        try {
            const newProjData = {
                ...project,
                name: `${project.name} (Copie)`,
                createdAt: serverTimestamp(),
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

    const checkDependencies = async (projectId: string) => {
        if (!user?.organizationId) return { hasDependencies: false, dependencies: [] };
        // Use ProjectService to check dependencies
        return await ProjectService.checkDependencies(projectId, user.organizationId);
    };

    const deleteProject = async (id: string, name?: string) => {
        if (!canDeleteResource(user, 'Project') || !user?.organizationId) return;
        try {
            // Use ProjectService for cascade deletion with dependency cleanup
            await ProjectService.deleteProjectWithCascade(id, user.organizationId);

            await logAction(user, 'DELETE', 'Project', `Suppression projet: ${name || id}`);
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

    const importProjects = useCallback(async (csvContent: string) => {
        if (!user?.organizationId) return;

        try {
            const lines = ImportService.parseCSV(csvContent);
            if (lines.length === 0) {
                addToast("Fichier vide ou invalide", "error");
                return;
            }

            const count = await ProjectService.importProjectsFromCSV(
                lines,
                user.organizationId,
                user.uid,
                user.displayName || 'Utilisateur'
            );

            await logAction(user, 'IMPORT', 'Project', `Import CSV de ${count} projets`);
            addToast(`Import de ${count} projets réussi`, "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useProjectLogic.importProjects');
        } finally {
            setIsSubmitting(false);
        }
    }, [user, addToast]);

    const createProjectFromTemplateData = async (
        projectData: Omit<Project, 'id'>,
        milestones: Omit<ProjectMilestone, 'id'>[]
    ) => {
        if (!canEdit || !user?.organizationId) return;

        const canAddProject = await SubscriptionService.checkLimit(user.organizationId, 'projects', projects.length);
        if (!canAddProject) {
            addToast(`Nombre maximum de projets atteint pour votre plan (${projects.length}/${limits?.maxProjects ?? '…'}).`, "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);

            // 1. Create Project
            const newProjectRef = doc(collection(db, 'projects'));
            const finalProjectData = sanitizeData({
                ...projectData,
                organizationId: user.organizationId,
                createdAt: serverTimestamp(),
                // Ensure tasks have unique IDs if not already
                tasks: projectData.tasks.map((t, i) => ({
                    ...t,
                    id: t.id || `task-${Date.now()}-${i}`
                }))
            });

            batch.set(newProjectRef, finalProjectData);

            // 2. Create Milestones
            milestones.forEach((m) => {
                const newMilestoneRef = doc(collection(db, 'project_milestones'));
                batch.set(newMilestoneRef, sanitizeData({
                    ...m,
                    projectId: newProjectRef.id,
                    organizationId: user.organizationId,
                    createdAt: serverTimestamp()
                }));
            });

            await batch.commit();
            await logAction(user, 'CREATE', 'Project', `Projet créé depuis template: ${projectData.name}`);
            addToast("Projet et jalons créés avec succès", "success");

            return newProjectRef.id;

        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'useProjectLogic.createFromTemplate', 'CREATE_FAILED');
            throw e;
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        projects, loading,
        handleProjectFormSubmit, handleDuplicate, deleteProject, updateProjectTasks, checkDependencies, importProjects, createProjectFromTemplateData,
        isSubmitting, role, canEdit, user, organization
    };
};
