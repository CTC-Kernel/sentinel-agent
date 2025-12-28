
import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { where, doc, updateDoc, addDoc, collection, arrayUnion, arrayRemove, getDocs, query, writeBatch, limit } from 'firebase/firestore';
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
    const { data: rawProjects, loading: loadingProjects } = useFirestoreCollection<Project>('projects', [where('organizationId', '==', user?.organizationId), limit(500)], { logError: true, realtime: true });
    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>('risks', [where('organizationId', '==', user?.organizationId), limit(500)], { logError: true, realtime: true });
    const { data: rawAudits, loading: loadingAudits } = useFirestoreCollection<Audit>('audits', [where('organizationId', '==', user?.organizationId), limit(500)], { logError: true, realtime: true });
    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>('controls', [where('organizationId', '==', user?.organizationId), limit(1000)], { logError: true, realtime: true });
    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>('assets', [where('organizationId', '==', user?.organizationId), limit(500)], { logError: true, realtime: true });
    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>('users', [where('organizationId', '==', user?.organizationId), limit(100)], { logError: true, realtime: true });

    // Derived State
    const projects = useMemo(() => [...rawProjects].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), [rawProjects]);
    const risks = useMemo(() => [...rawRisks].sort((a, b) => b.score - a.score), [rawRisks]);
    const audits = useMemo(() => [...rawAudits].sort((a, b) => new Date(b.dateScheduled).getTime() - new Date(a.dateScheduled).getTime()), [rawAudits]);
    const controls = useMemo(() => [...rawControls].sort((a, b) => a.code.localeCompare(b.code)), [rawControls]);
    const assets = useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);

    // Fix: Ensure usersList is never empty if we are logged in (fallback to self)
    // This prevents "Manager Required" validation errors if RBAC prevents listing other users
    const effectiveUsers = useMemo(() => {
        if (usersList && usersList.length > 0) return usersList;
        if (user && user.uid) return [user];
        return [];
    }, [usersList, user]);

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
            const batch = writeBatch(db);

            if (editingProject) {
                // Update
                const projectRef = doc(db, 'projects', editingProject.id);
                batch.update(projectRef, { ...cleanData });

                // Helper for sync
                const syncLinks = (collectionName: string, fieldName: string, newIds: string[] = [], oldIds: string[] = []) => {
                    const added = newIds.filter(id => !oldIds.includes(id));
                    const removed = oldIds.filter(id => !newIds.includes(id));
                    added.forEach(id => {
                        batch.update(doc(db, collectionName, id), { [fieldName]: arrayUnion(editingProject.id) });
                    });
                    removed.forEach(id => {
                        batch.update(doc(db, collectionName, id), { [fieldName]: arrayRemove(editingProject.id) });
                    });
                };

                syncLinks('risks', 'relatedProjectIds', validatedData.relatedRiskIds, editingProject.relatedRiskIds);
                syncLinks('controls', 'relatedProjectIds', validatedData.relatedControlIds, editingProject.relatedControlIds);
                syncLinks('assets', 'relatedProjectIds', validatedData.relatedAssetIds, editingProject.relatedAssetIds);
                syncLinks('audits', 'relatedProjectIds', validatedData.relatedAuditIds, editingProject.relatedAuditIds);

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
                    createdAt: new Date().toISOString()
                });

                // Sync for Create
                const pId = newProjectRef.id;
                const syncNew = (coll: string, ids: string[]) => {
                    ids.forEach(id => {
                        batch.update(doc(db, coll, id), { relatedProjectIds: arrayUnion(pId) });
                    });
                }
                if (finalData.relatedRiskIds) syncNew('risks', finalData.relatedRiskIds);
                if (finalData.relatedControlIds) syncNew('controls', finalData.relatedControlIds);
                if (finalData.relatedAssetIds) syncNew('assets', finalData.relatedAssetIds);
                if (finalData.relatedAuditIds) syncNew('audits', finalData.relatedAuditIds);

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

    const checkDependencies = async (projectId: string) => {
        if (!user?.organizationId) return { hasDependencies: false, dependencies: [] };

        const [rSnap, cSnap, aSnap, auSnap] = await Promise.all([
            getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId), where('relatedProjectIds', 'array-contains', projectId), limit(20))),
            getDocs(query(collection(db, 'controls'), where('organizationId', '==', user.organizationId), where('relatedProjectIds', 'array-contains', projectId), limit(20))),
            getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId), where('relatedProjectIds', 'array-contains', projectId), limit(20))),
            getDocs(query(collection(db, 'audits'), where('organizationId', '==', user.organizationId), where('relatedProjectIds', 'array-contains', projectId), limit(20)))
        ]);

        const dependencies = [
            ...rSnap.docs.map(d => ({ id: d.id, name: d.data().threat || 'Risque', type: 'Risque' })),
            ...cSnap.docs.map(d => ({ id: d.id, name: d.data().code || d.data().name || 'Contrôle', type: 'Contrôle' })),
            ...aSnap.docs.map(d => ({ id: d.id, name: d.data().name || 'Actif', type: 'Actif' })),
            ...auSnap.docs.map(d => ({ id: d.id, name: d.data().name || 'Audit', type: 'Audit' }))
        ];

        return { hasDependencies: dependencies.length > 0, dependencies };
    };

    const deleteProject = async (id: string, name?: string) => {
        if (!canDeleteResource(user, 'Project')) return;
        try {
            const { hasDependencies, dependencies } = await checkDependencies(id);

            const batch = writeBatch(db);

            if (hasDependencies && dependencies.length > 0) {
                // Risks
                const riskDeps = dependencies.filter(d => d.type === 'Risque');
                riskDeps.forEach(dep => {
                    batch.update(doc(db, 'risks', dep.id), { relatedProjectIds: arrayRemove(id) });
                });
                // Controls
                const controlDeps = dependencies.filter(d => d.type === 'Contrôle');
                controlDeps.forEach(dep => {
                    batch.update(doc(db, 'controls', dep.id), { relatedProjectIds: arrayRemove(id) });
                });
                // Assets
                const assetDeps = dependencies.filter(d => d.type === 'Actif');
                assetDeps.forEach(dep => {
                    batch.update(doc(db, 'assets', dep.id), { relatedProjectIds: arrayRemove(id) });
                });
                // Audits
                const auditDeps = dependencies.filter(d => d.type === 'Audit');
                auditDeps.forEach(dep => {
                    batch.update(doc(db, 'audits', dep.id), { relatedProjectIds: arrayRemove(id) });
                });
            }

            batch.delete(doc(db, 'projects', id));
            await batch.commit();

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

    return {
        projects, risks, audits, controls, assets, usersList: effectiveUsers, loading,
        handleProjectFormSubmit, handleDuplicate, deleteProject, updateProjectTasks, checkDependencies,
        isSubmitting, role, canEdit, user, organization
    };
};
