import React, { useState } from 'react';
import { CustomRole, ResourceType, ActionType } from '../../types';
import { useStore } from '../../store';
import { useTeamData } from '../../hooks/team/useTeamData';
import { Drawer } from '../ui/Drawer';
import { ConfirmModal } from '../ui/ConfirmModal';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Button } from '../ui/button';
import { Plus, Shield } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { EmptyState } from '../ui/EmptyState';
import { RoleCard } from './RoleCard';
import { PermissionCheck } from './PermissionCheck';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const roleSchema = z.object({
    name: z.string().min(2, 'Nom requis (min 2 caractères)').max(100, 'Nom trop long'),
    description: z.string().max(500, 'Description trop longue').optional(),
    permissions: z.record(z.string(), z.array(z.string())).optional()
});

type RoleFormData = z.infer<typeof roleSchema>;

interface RoleManagerProps {
    roles: CustomRole[];
    onRefresh: () => void;
}

const RESOURCES: ResourceType[] = [
    'Asset', 'Risk', 'Project', 'Audit', 'Document', 'Control', 'Incident', 'Supplier', 'BusinessProcess'
];

const ACTIONS: ActionType[] = ['read', 'create', 'update', 'delete', 'manage'];

export const RoleManager: React.FC<RoleManagerProps> = ({ roles, onRefresh }) => {
    const { user, addToast } = useStore();
    const { addRole, updateRole, removeRole } = useTeamData();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<CustomRole | null>(null);

    const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<RoleFormData>({
        resolver: zodResolver(roleSchema),
        defaultValues: {
            name: '',
            description: '',
            permissions: {}
        }
    });

    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; roleId: string | null }>({ isOpen: false, roleId: null });

    const permissions = useWatch({ control, name: 'permissions' });
    const formValues = { permissions };

    const handleOpenDrawer = React.useCallback((role?: CustomRole) => {
        if (role) {
            setEditingRole(role);
            reset({
                name: role.name,
                description: role.description || '',
                permissions: role.permissions as Record<string, ActionType[]>
            });
        } else {
            setEditingRole(null);
            reset({ name: '', description: '', permissions: {} });
        }
        setIsDrawerOpen(true);
    }, [reset]);

    const togglePermission = React.useCallback((resource: string, action: ActionType) => {
        const currentPermissions = formValues.permissions || {};
        const currentActions = (currentPermissions[resource] as ActionType[]) || [];
        let newActions;
        if (currentActions.includes(action)) {
            newActions = currentActions.filter(a => a !== action);
        } else {
            newActions = [...currentActions, action];
        }
        setValue('permissions', {
            ...currentPermissions,
            [resource]: newActions
        });
    }, [formValues.permissions, setValue]);

    const onSubmit = React.useCallback(async (data: RoleFormData) => {
        if (!user?.organizationId) return;

        try {
            const roleData = {
                organizationId: user.organizationId,
                name: data.name,
                description: data.description || '',
                permissions: data.permissions || {},
                updatedAt: new Date().toISOString()
            };

            if (editingRole) {
                await updateRole(editingRole.id, sanitizeData(roleData));
                addToast("Rôle mis à jour", "success");
            } else {
                await addRole(sanitizeData({
                    ...roleData,
                    createdAt: new Date().toISOString()
                }));
                addToast("Rôle créé", "success");
            }
            setIsDrawerOpen(false);
            reset();
            onRefresh();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RoleManager.onSubmit');
        }
    }, [user, editingRole, onRefresh, addToast, addRole, updateRole, reset]);

    const handleDelete = React.useCallback(async () => {
        if (!confirmDelete.roleId) return;
        try {
            await removeRole(confirmDelete.roleId);
            addToast("Rôle supprimé", "info");
            setConfirmDelete({ isOpen: false, roleId: null });
            onRefresh();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RoleManager.handleDelete');
        }
    }, [confirmDelete.roleId, onRefresh, addToast, removeRole]);

    const handleConfirmDelete = React.useCallback((roleId: string) => {
        setConfirmDelete({ isOpen: true, roleId });
    }, []);

    const handleNewRole = React.useCallback(() => {
        handleOpenDrawer();
    }, [handleOpenDrawer]);

    const handleCloseDrawer = React.useCallback(() => {
        setIsDrawerOpen(false);
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rôles Personnalisés</h3>
                    <p className="text-sm text-slate-600">Gérez les permissions fines pour votre organisation.</p>
                </div>
                <Button
                    onClick={handleNewRole}
                    className="flex items-center gap-2 bg-brand-600 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-700"
                >
                    <Plus className="h-4 w-4" /> Nouveau Rôle
                </Button>
            </div>

            {roles.length === 0 ? (
                <EmptyState
                    icon={Shield}
                    title="Aucun rôle personnalisé"
                    description="Créez des rôles sur mesure pour gérer les accès de vos équipes."
                    actionLabel="Créer un rôle"
                    onAction={handleNewRole}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {roles.map(role => (
                        <RoleCard
                            key={role.id}
                            role={role}
                            onEdit={handleOpenDrawer}
                            onDelete={handleConfirmDelete}
                        />
                    ))}
                </div>
            )}

            <Drawer
                isOpen={isDrawerOpen}
                onClose={handleCloseDrawer}
                title={editingRole ? "Modifier le rôle" : "Nouveau rôle"}
                subtitle="Définissez les permissions d'accès."
                width="max-w-4xl"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FloatingLabelInput
                            label="Nom du rôle"
                            {...register('name')}
                            error={errors.name?.message}
                            required
                            placeholder="ex: Stagiaire Marketing"
                        />
                        <FloatingLabelInput
                            label="Description"
                            {...register('description')}
                            error={errors.description?.message}
                            placeholder="Description du rôle..."
                        />
                    </div>

                    <div className="border-t border-slate-200 dark:border-white/10 pt-6">
                        <h4 className="font-bold text-slate-900 dark:text-white mb-4">Matrice des Permissions</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-left">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider rounded-tl-lg">Ressource</th>
                                        {ACTIONS.map(action => (
                                            <th key={action} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">{action}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {RESOURCES.map(resource => (
                                        <tr key={resource} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{resource}</td>
                                            {ACTIONS.map(action => (
                                                <PermissionCheck
                                                    key={action}
                                                    resource={resource}
                                                    action={action}
                                                    isChecked={((formValues.permissions || {})[resource] as ActionType[] || []).includes(action) || false}
                                                    onToggle={togglePermission}
                                                />
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
                        <Button type="button" variant="ghost" onClick={handleCloseDrawer}>Annuler</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20">
                            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                        </Button>
                    </div>
                </form>
            </Drawer>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, roleId: null })}
                onConfirm={handleDelete}
                title="Supprimer le rôle ?"
                message="Cette action est irréversible. Les utilisateurs assignés à ce rôle perdront leurs permissions spécifiques."
            />
        </div>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
