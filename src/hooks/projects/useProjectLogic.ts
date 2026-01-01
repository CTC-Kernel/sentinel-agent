
import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { where, doc, updateDoc, addDoc, collection, writeBatch, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { Project, ProjectTask, Risk, Control, Asset, Audit, UserProfile } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { ProjectService } from '../../services/projectService';
import { logAction } from '../../services/logger';
import { projectSchema } from '../../schemas/projectSchema';
import { sanitizeData } from '../../utils/dataSanitizer';
import { z } from 'zod';
import { SubscriptionService } from '../../services/subscriptionService';
import { canEditResource, canDeleteResource } from '../../utils/permissions';
import { usePlanLimits } from '../usePlanLimits';
import { CsvParser } from '../../utils/csvUtils';

export const useProjectLogic = () => {
    const { user, addToast, organization, demoMode } = useStore();
    const role = user?.role || 'user';
    const canEdit = canEditResource(user, 'Project');
    const { limits } = usePlanLimits();

    // Mock Data State
    const [mockData, setMockData] = useState<{
        projects: Project[];
        risks: Risk[];
        controls: Control[];
        assets: Asset[];
        audits: Audit[];
        users: UserProfile[];
    } | null>(null);

    // Data Fetching
    const { data: rawProjects, loading: loadingProjects } = useFirestoreCollection<Project>('projects', [where('organizationId', '==', user?.organizationId), limit(500)], { logError: true, realtime: true });
    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>('risks', [where('organizationId', '==', user?.organizationId), limit(500)], { logError: true, realtime: true });
    const { data: rawAudits, loading: loadingAudits } = useFirestoreCollection<Audit>('audits', [where('organizationId', '==', user?.organizationId), limit(500)], { logError: true, realtime: true });
    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>('controls', [where('organizationId', '==', user?.organizationId), limit(1000)], { logError: true, realtime: true });
    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>('assets', [where('organizationId', '==', user?.organizationId), limit(500)], { logError: true, realtime: true });
    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>('users', [where('organizationId', '==', user?.organizationId), limit(100)], { logError: true, realtime: true });

    // Load Mock Data Effect
    useState(() => { // Using generic effect for mount if demoMode
        if (demoMode && !mockData) {
            import('../../services/mockDataService').then(({ MockDataService }) => {
                setMockData({
                    projects: MockDataService.getCollection('projects') as Project[],
                    risks: MockDataService.getCollection('risks') as Risk[],
                    controls: MockDataService.getCollection('controls') as Control[],
                    assets: MockDataService.getCollection('assets') as Asset[],
                    audits: MockDataService.getCollection('audits') as Audit[],
                    users: MockDataService.getCollection('users') as unknown as UserProfile[]
                });
                users: MockDataService.getCollection('users') as unknown as UserProfile[]
            });
        }).catch(err => {
            console.error('Failed to load mock data module', err);
            setMockData({ projects: [], risks: [], controls: [], assets: [], audits: [], users: [] });
        });
}
    });

// Derived State
const projects = useMemo(() => {
    const source = demoMode && mockData ? mockData.projects : rawProjects;
    return [...source].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}, [rawProjects, mockData, demoMode]);

const risks = useMemo(() => {
    const source = demoMode && mockData ? mockData.risks : rawRisks;
    return [...source].sort((a, b) => b.score - a.score);
}, [rawRisks, mockData, demoMode]);

const audits = useMemo(() => {
    const source = demoMode && mockData ? mockData.audits : rawAudits;
    return [...source].sort((a, b) => new Date(b.dateScheduled).getTime() - new Date(a.dateScheduled).getTime());
}, [rawAudits, mockData, demoMode]);

const controls = useMemo(() => {
    const source = demoMode && mockData ? mockData.controls : rawControls;
    return [...source].sort((a, b) => a.code.localeCompare(b.code));
}, [rawControls, mockData, demoMode]);

const assets = useMemo(() => {
    const source = demoMode && mockData ? mockData.assets : rawAssets;
    return [...source].sort((a, b) => a.name.localeCompare(b.name));
}, [rawAssets, mockData, demoMode]);

// Fix: Ensure usersList is never empty if we are logged in (fallback to self)
// This prevents "Manager Required" validation errors if RBAC prevents listing other users
const effectiveUsers = useMemo(() => {
    const source = demoMode && mockData ? mockData.users : usersList;
    if (source && source.length > 0) return source;
    if (user && user.uid) return [user];
    return [];
}, [usersList, user, mockData, demoMode]);

const loading = demoMode ? !mockData : (loadingProjects || loadingRisks || loadingControls || loadingAssets || loadingUsers || loadingAudits);

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
    const canAdd = await SubscriptionService.checkLimit(user.organizationId, 'projects', projects.length);
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

const importProjects = async (csvContent: string) => {
    if (!user?.organizationId) return;
    setIsSubmitting(true);
    try {
        const lines = CsvParser.parseCSV(csvContent);
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
};

return {
    projects, risks, audits, controls, assets, usersList: effectiveUsers, loading,
    handleProjectFormSubmit, handleDuplicate, deleteProject, updateProjectTasks, checkDependencies, importProjects,
    isSubmitting, role, canEdit, user, organization
};
};
