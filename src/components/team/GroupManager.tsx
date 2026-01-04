import React, { useState, useCallback } from 'react';
import { UserGroup, UserProfile } from '../../types';
import { useStore } from '../../store';
import { useTeamData } from '../../hooks/team/useTeamData';
import { Drawer } from '../ui/Drawer';
import { ConfirmModal } from '../ui/ConfirmModal'; // Keyboard: Escape key supported
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Button } from '../ui/button';
import { Plus } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { GroupCard } from './GroupCard';
import { MemberSelector } from './MemberSelector';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const groupSchema = z.object({
    name: z.string().min(2, 'Nom requis (min 2 caractères)').max(100, 'Nom trop long'),
    description: z.string().max(500, 'Description trop longue').optional(),
    members: z.array(z.string()).optional()
});

type GroupFormData = z.infer<typeof groupSchema>;

interface GroupManagerProps {
    users: UserProfile[];
}

export const GroupManager: React.FC<GroupManagerProps> = ({ users }) => {
    const { user, addToast } = useStore();
    const { groups, addGroup, updateGroup, removeGroup } = useTeamData();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);

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
                addToast("Groupe mis à jour", "success");
            } else {
                await addGroup(sanitizeData(groupData));
                addToast("Groupe créé", "success");
            }
            setIsDrawerOpen(false);
            reset();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'GroupManager.onSubmit');
        }
    }, [user, editingGroup, addToast, addGroup, updateGroup, reset]);

    const handleDelete = useCallback(async () => {
        if (!confirmDelete.groupId) return;
        try {
            await removeGroup(confirmDelete.groupId);
            addToast("Groupe supprimé", "info");
            setConfirmDelete({ isOpen: false, groupId: null });
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'GroupManager.handleDelete');
        }
    }, [confirmDelete.groupId, addToast, removeGroup]);

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
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Groupes Utilisateurs</h3>
                    <p className="text-sm text-slate-600">Créez des équipes pour organiser vos collaborateurs.</p>
                </div>
                <Button
                    onClick={handleNewGroupClick}
                    className="flex items-center gap-2 bg-brand-600 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-700"
                >
                    <Plus className="h-4 w-4" /> Nouveau Groupe
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

            <Drawer
                isOpen={isDrawerOpen}
                onClose={handleDrawerClose}
                title={editingGroup ? "Modifier le groupe" : "Nouveau groupe"}
                subtitle="Gérez les membres de cette équipe."
                width="max-w-6xl"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FloatingLabelInput
                            label="Nom du groupe"
                            {...register('name')}
                            error={errors.name?.message}
                            required
                            placeholder="ex: Équipe Sécurité"
                        />
                        <FloatingLabelInput
                            label="Description"
                            {...register('description')}
                            error={errors.description?.message}
                            placeholder="Description du groupe..."
                        />
                    </div>

                    <div className="border-t border-slate-200 dark:border-white/10 pt-6">
                        <h4 className="font-bold text-slate-900 dark:text-white mb-4">Membres du groupe</h4>
                        <MemberSelector
                            users={users}
                            selectedMembers={formValues.members || []}
                            onToggle={toggleMember}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
                        <Button type="button" variant="ghost" onClick={handleDrawerClose}>Annuler</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20">
                            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                        </Button>
                    </div>
                </form>
            </Drawer>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={handleConfirmDeleteClose}
                onConfirm={handleDelete}
                title="Supprimer le groupe ?"
                message="Cette action est irréversible. Les utilisateurs ne seront pas supprimés, mais le groupe disparaîtra."
            />
        </div>
    );
};

