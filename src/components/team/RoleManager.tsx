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

const createRoleSchema = (t: (key: string, options?: { defaultValue: string }) => string) => z.object({
    name: z.string().min(2, t('team.roles.validation.nameRequired', { defaultValue: 'Name required (min 2 characters)' })).max(100, t('team.roles.validation.nameTooLong', { defaultValue: 'Name is too long' })),
    description: z.string().max(500, t('team.roles.validation.descriptionTooLong', { defaultValue: 'Description is too long' })).optional(),
    permissions: z.record(z.string(), z.array(z.string())).optional()
});

type RoleFormData = z.infer<ReturnType<typeof createRoleSchema>>;

interface RoleManagerProps {
    roles: CustomRole[];
    onRefresh: () => void;
}

const RESOURCES: ResourceType[] = [
    'Asset', 'Risk', 'Project', 'Audit', 'Document', 'Control', 'Incident', 'Supplier', 'BusinessProcess'
];

const ACTIONS: ActionType[] = ['read', 'create', 'update', 'delete', 'manage'];

export const RoleManager: React.FC<RoleManagerProps> = ({ roles, onRefresh }) => {
    const { user, addToast, t } = useStore();
    const { addRole, updateRole, removeRole } = useTeamData();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<CustomRole | null>(null);

    const roleSchema = React.useMemo(() => createRoleSchema(t), [t]);
    const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting, isDirty } } = useForm<RoleFormData>({
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
                permissions: (data.permissions || {}) as Record<string, ActionType[]>
            };

            if (editingRole) {
                await updateRole(editingRole.id, sanitizeData(roleData));
                addToast(t('team.roles.toast.updated', { defaultValue: 'Rôle mis à jour' }), "success");
            } else {
                await addRole(sanitizeData(roleData));
                addToast(t('team.roles.toast.created', { defaultValue: 'Rôle créé' }), "success");
            }
            setIsDrawerOpen(false);
            reset();
            onRefresh();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RoleManager.onSubmit');
        }
    }, [user, editingRole, onRefresh, addToast, addRole, updateRole, reset, t]);

    const handleDelete = React.useCallback(async () => {
        if (!confirmDelete.roleId) return;
        try {
            await removeRole(confirmDelete.roleId);
            addToast(t('team.roles.toast.deletedWithImpact', { defaultValue: 'Rôle supprimé. Les utilisateurs concernés ont été réattribués au rôle par défaut.' }), "info");
            setConfirmDelete({ isOpen: false, roleId: null });
            onRefresh();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RoleManager.handleDelete');
        }
    }, [confirmDelete.roleId, onRefresh, addToast, removeRole, t]);

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
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('team.roles.title', { defaultValue: 'Rôles Personnalisés' })}</h3>
                    <p className="text-sm text-slate-600">{t('team.roles.subtitle', { defaultValue: 'Gérez les permissions fines pour votre organisation.' })}</p>
                </div>
                <Button
                    onClick={handleNewRole}
                    className="flex items-center gap-2 bg-brand-600 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-700"
                >
                    <Plus className="h-4 w-4" /> {t('team.roles.newRole', { defaultValue: 'Nouveau Rôle' })}
                </Button>
            </div>

            {roles.length === 0 ? (
                <EmptyState
                    icon={Shield}
                    title={t('team.roles.emptyTitle', { defaultValue: 'Aucun rôle personnalisé' })}
                    description={t('team.roles.emptyDescription', { defaultValue: 'Créez des rôles sur mesure pour gérer les accès de vos équipes.' })}
                    actionLabel={t('team.roles.createRole', { defaultValue: 'Créer un rôle' })}
                    onAction={handleNewRole}
                />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {roles.map(role => (
                        <RoleCard
                            key={role.id || 'unknown'}
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
                title={editingRole ? t('team.roles.editRole', { defaultValue: 'Modifier le rôle' }) : t('team.roles.newRoleDrawer', { defaultValue: 'Nouveau rôle' })}
                subtitle={t('team.roles.drawerSubtitle', { defaultValue: "Définissez les permissions d'accès." })}
                width="max-w-6xl"
                hasUnsavedChanges={isDirty}
            >
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <FloatingLabelInput
                            label={t('team.roles.form.name', { defaultValue: 'Nom du rôle' })}
                            {...register('name')}
                            error={errors.name?.message}
                            required
                            placeholder={t('team.roles.form.namePlaceholder', { defaultValue: 'ex: Stagiaire Marketing' })}
                        />
                        <FloatingLabelInput
                            label={t('common.description', { defaultValue: 'Description' })}
                            {...register('description')}
                            error={errors.description?.message}
                            placeholder={t('team.roles.form.descriptionPlaceholder', { defaultValue: 'Description du rôle...' })}
                        />
                    </div>

                    <div className="border-t border-border/40 dark:border-border/40 pt-6">
                        <h4 className="font-bold text-slate-900 dark:text-white mb-4">{t('team.roles.permissionsMatrix', { defaultValue: 'Matrice des Permissions' })}</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-left">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider rounded-tl-lg">{t('team.roles.resource', { defaultValue: 'Ressource' })}</th>
                                        {ACTIONS.map(action => (
                                            <th key={action || 'unknown'} scope="col" className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider text-center">{action}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {RESOURCES.map(resource => (
                                        <tr key={resource || 'unknown'} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{resource}</td>
                                            {ACTIONS.map(action => (
                                                <PermissionCheck
                                                    key={action || 'unknown'}
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

                    <div className="flex justify-end gap-3 pt-6 border-t border-border/40 dark:border-border/40">
                        <Button type="button" variant="ghost" onClick={handleCloseDrawer}>{t('common.cancel', { defaultValue: 'Annuler' })}</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20">
                            {isSubmitting ? t('common.saving', { defaultValue: 'Enregistrement...' }) : t('common.save', { defaultValue: 'Enregistrer' })}
                        </Button>
                    </div>
                </form>
            </Drawer>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, roleId: null })}
                onConfirm={handleDelete}
                title={t('team.roles.deleteTitle', { defaultValue: 'Supprimer le rôle ?' })}
                message={t('team.roles.deleteMessage', { defaultValue: 'Cette action est irréversible. Les utilisateurs assignés à ce rôle perdront leurs permissions spécifiques.' })}
            />
        </div>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
