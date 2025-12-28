import React, { useState, useCallback } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserGroup, UserProfile } from '../../types';
import { useStore } from '../../store';
import { useTeamData } from '../../hooks/team/useTeamData';
import { Drawer } from '../ui/Drawer';
import { ConfirmModal } from '../ui/ConfirmModal';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Button } from '../ui/button';
import { Plus } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { GroupCard } from './GroupCard';
import { MemberSelector } from './MemberSelector';

interface GroupManagerProps {
    users: UserProfile[];
}

export const GroupManager: React.FC<GroupManagerProps> = ({ users }) => {
    const { user, addToast } = useStore();
    const { groups } = useTeamData();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
    const [formData, setFormData] = useState<{ name: string; description: string; members: string[] }>({
        name: '', description: '', members: []
    });

    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; groupId: string | null }>({ isOpen: false, groupId: null });

    const handleOpenDrawer = useCallback((group?: UserGroup) => {
        if (group) {
            setEditingGroup(group);
            setFormData({
                name: group.name,
                description: group.description || '',
                members: group.members || []
            });
        } else {
            setEditingGroup(null);
            setFormData({ name: '', description: '', members: [] });
        }
        setIsDrawerOpen(true);
    }, []);

    const toggleMember = useCallback((uid: string) => {
        setFormData(prev => {
            const currentMembers = prev.members || [];
            if (currentMembers.includes(uid)) {
                return { ...prev, members: currentMembers.filter(id => id !== uid) };
            } else {
                return { ...prev, members: [...currentMembers, uid] };
            }
        });
    }, []);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.organizationId) return;

        try {
            const groupData = {
                organizationId: user.organizationId,
                name: formData.name,
                description: formData.description,
                members: formData.members,
                updatedAt: new Date().toISOString()
            };

            if (editingGroup) {
                await updateDoc(doc(db, 'user_groups', editingGroup.id), sanitizeData(groupData));
                addToast("Groupe mis à jour", "success");
            } else {
                await addDoc(collection(db, 'user_groups'), sanitizeData({
                    ...groupData,
                    createdAt: new Date().toISOString()
                }));
                addToast("Groupe créé", "success");
            }
            setIsDrawerOpen(false);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'GroupManager.handleSubmit');
        }
    }, [user, formData, editingGroup, addToast]);

    const handleDelete = useCallback(async () => {
        if (!confirmDelete.groupId) return;
        try {
            await deleteDoc(doc(db, 'user_groups', confirmDelete.groupId));
            addToast("Groupe supprimé", "info");
            setConfirmDelete({ isOpen: false, groupId: null });
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'GroupManager.handleDelete');
        }
    }, [confirmDelete.groupId, addToast]);

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
                width="max-w-4xl"
            >
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FloatingLabelInput
                            label="Nom du groupe"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="ex: Équipe Sécurité"
                        />
                        <FloatingLabelInput
                            label="Description"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Description du groupe..."
                        />
                    </div>

                    <div className="border-t border-slate-200 dark:border-white/10 pt-6">
                        <h4 className="font-bold text-slate-900 dark:text-white mb-4">Membres du groupe</h4>
                        <MemberSelector
                            users={users}
                            selectedMembers={formData.members}
                            onToggle={toggleMember}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
                        <Button type="button" variant="ghost" onClick={handleDrawerClose}>Annuler</Button>
                        <Button type="submit" className="bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20">Enregistrer</Button>
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

