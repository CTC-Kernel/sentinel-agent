import React, { useState, useCallback } from 'react';
import { UserGroup, UserProfile } from '../../types';
import { useStore } from '../../store';
import { useTeamData } from '../../hooks/team/useTeamData';
import { Drawer } from '../ui/Drawer';
import { ConfirmModal } from '../ui/ConfirmModal'; // Keyboard: Escape key supported
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Button } from '../ui/button';
import { Plus, Users } from '../ui/Icons';
import { EmptyState } from '../ui/EmptyState';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { GroupCard } from './GroupCard';
import { MemberSelector } from './MemberSelector';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const createGroupSchema = (t: (key: string, options?: { defaultValue: string }) => string) => z.object({
    name: z.string().min(2, t('team.groups.validation.nameRequired', { defaultValue: 'Nom requis (min 2 caractères)' })).max(100, t('team.groups.validation.nameTooLong', { defaultValue: 'Nom trop long' })),
    description: z.string().max(500, t('team.groups.validation.descriptionTooLong', { defaultValue: 'Description trop longue' })).optional(),
    members: z.array(z.string()).optional()
});

type GroupFormData = z.infer<ReturnType<typeof createGroupSchema>>;

interface GroupManagerProps {
    users: UserProfile[];
}

export const GroupManager: React.FC<GroupManagerProps> = ({ users }) => {
    const { user, addToast, t } = useStore();
    const { groups, addGroup, updateGroup, removeGroup } = useTeamData();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);

    const groupSchema = React.useMemo(() => createGroupSchema(t), [t]);
    const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<GroupFormData>({
        resolver: zodResolver(groupSchema),
        defaultValues: {
            name: '',
            description: '',
            members: []
        }
    });

    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; groupId: string | null }>({ isOpen: false, groupId: null });

    const members = useWatch({ control, name: 'members' });
    const formValues = { members };

    const handleOpenDrawer = useCallback((group?: UserGroup) => {
        if (group) {
            setEditingGroup(group);
            reset({
                name: group.name,
                description: group.description || '',
                members: group.members || []
            });
        } else {
            setEditingGroup(null);
            reset({ name: '', description: '', members: [] });
        }
        setIsDrawerOpen(true);
    }, [reset]);

    const toggleMember = useCallback((uid: string) => {
        const currentMembers = formValues.members || [];
        if (currentMembers.includes(uid)) {
            setValue('members', currentMembers.filter((id: string) => id !== uid));
        } else {
            setValue('members', [...currentMembers, uid]);
        }
    }, [formValues.members, setValue]);

    const onSubmit = useCallback(async (data: GroupFormData) => {
        if (!user?.organizationId) return;

        try {
            const groupData = {
                organizationId: user.organizationId,
                name: data.name,
                description: data.description || '',
                members: data.members || []
            };

            if (editingGroup) {
                await updateGroup(editingGroup.id, sanitizeData(groupData));
                addToast(t('team.groups.toast.updated', { defaultValue: 'Groupe mis à jour' }), "success");
            } else {
                await addGroup(sanitizeData(groupData));
                if (!data.members || data.members.length === 0) {
                    addToast(t('team.groups.toast.createdEmpty', { defaultValue: 'Groupe créé. Ajoutez des membres pour commencer.' }), "info");
                } else {
                    addToast(t('team.groups.toast.created', { defaultValue: 'Groupe créé' }), "success");
                }
            }
            setIsDrawerOpen(false);
            reset();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'GroupManager.onSubmit');
        }
    }, [user, editingGroup, addToast, addGroup, updateGroup, reset, t]);

    const handleDelete = useCallback(async () => {
        if (!confirmDelete.groupId) return;
        try {
            await removeGroup(confirmDelete.groupId);
            addToast(t('team.groups.toast.deleted', { defaultValue: 'Groupe supprimé' }), "info");
            setConfirmDelete({ isOpen: false, groupId: null });
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'GroupManager.handleDelete');
        }
    }, [confirmDelete.groupId, addToast, removeGroup, t]);

    const handleConfirmDeleteOpen = useCallback((groupId: string) => {
        setConfirmDelete({ isOpen: true, groupId });
    }, []);

    const handleConfirmDeleteClose = useCallback(() => {
        setConfirmDelete({ isOpen: false, groupId: null });
    }, []);

    const handleDrawerClose = useCallback(() => setIsDrawerOpen(false), []);

    const handleNewGroupClick = useCallback(() => handleOpenDrawer(), [handleOpenDrawer]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('team.groups.title', { defaultValue: 'Groupes Utilisateurs' })}</h3>
                    <p className="text-sm text-slate-600">{t('team.groups.subtitle', { defaultValue: 'Créez des équipes pour organiser vos collaborateurs.' })}</p>
                </div>
                <Button
                    onClick={handleNewGroupClick}
                    className="flex items-center gap-2 bg-brand-600 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-700"
                >
                    <Plus className="h-4 w-4" /> {t('team.groups.newGroup', { defaultValue: 'Nouveau Groupe' })}
                </Button>
            </div>

            {groups.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title={t('team.groups.emptyTitle', { defaultValue: 'Aucun groupe' })}
                    description={t('team.groups.emptyDescription', { defaultValue: 'Créez des groupes pour organiser vos collaborateurs en équipes.' })}
                    actionLabel={t('team.groups.createGroup', { defaultValue: 'Créer un groupe' })}
                    onAction={handleNewGroupClick}
                />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {groups.map(group => (
                        <GroupCard
                            key={group.id}
                            group={group}
                            users={users}
                            onEdit={handleOpenDrawer}
                            onDelete={handleConfirmDeleteOpen}
                        />
                    ))}
                </div>
            )}

            <Drawer
                isOpen={isDrawerOpen}
                onClose={handleDrawerClose}
                title={editingGroup ? t('team.groups.editGroup', { defaultValue: 'Modifier le groupe' }) : t('team.groups.newGroupDrawer', { defaultValue: 'Nouveau groupe' })}
                subtitle={t('team.groups.drawerSubtitle', { defaultValue: 'Gérez les membres de cette équipe.' })}
                width="max-w-6xl"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <FloatingLabelInput
                            label={t('team.groups.form.name', { defaultValue: 'Nom du groupe' })}
                            {...register('name')}
                            error={errors.name?.message}
                            required
                            placeholder={t('team.groups.form.namePlaceholder', { defaultValue: 'ex: Équipe Sécurité' })}
                        />
                        <FloatingLabelInput
                            label={t('common.description', { defaultValue: 'Description' })}
                            {...register('description')}
                            error={errors.description?.message}
                            placeholder={t('team.groups.form.descriptionPlaceholder', { defaultValue: 'Description du groupe...' })}
                        />
                    </div>

                    <div className="border-t border-border/40 dark:border-border/40 pt-6">
                        <h4 className="font-bold text-slate-900 dark:text-white mb-4">{t('team.groups.members', { defaultValue: 'Membres du groupe' })}</h4>
                        <MemberSelector
                            users={users}
                            selectedMembers={formValues.members || []}
                            onToggle={toggleMember}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-border/40 dark:border-border/40">
                        <Button type="button" variant="ghost" onClick={handleDrawerClose}>{t('common.cancel', { defaultValue: 'Annuler' })}</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20">
                            {isSubmitting ? t('common.saving', { defaultValue: 'Enregistrement...' }) : t('common.save', { defaultValue: 'Enregistrer' })}
                        </Button>
                    </div>
                </form>
            </Drawer>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={handleConfirmDeleteClose}
                onConfirm={handleDelete}
                title={t('team.groups.deleteTitle', { defaultValue: 'Supprimer le groupe ?' })}
                message={t('team.groups.deleteMessage', { defaultValue: 'Cette action est irréversible. Les utilisateurs ne seront pas supprimés, mais le groupe disparaîtra.' })}
            />
        </div>
    );
};

