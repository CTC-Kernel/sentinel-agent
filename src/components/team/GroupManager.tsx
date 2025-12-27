import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserGroup, UserProfile } from '../../types';
import { useStore } from '../../store';
import { Drawer } from '../ui/Drawer';
import { ConfirmModal } from '../ui/ConfirmModal';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Button } from '../ui/button';
import { Plus, Edit, Trash2, Users, Check } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';

interface GroupManagerProps {
    users: UserProfile[];
}

export const GroupManager: React.FC<GroupManagerProps> = ({ users }) => {
    const { user, addToast } = useStore();
    const [groups, setGroups] = useState<UserGroup[]>([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
    const [formData, setFormData] = useState<{ name: string; description: string; members: string[] }>({
        name: '', description: '', members: []
    });

    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; groupId: string | null }>({ isOpen: false, groupId: null });

    useEffect(() => {
        if (!user?.organizationId) return;

        const q = query(collection(db, 'user_groups'), where('organizationId', '==', user.organizationId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const groupsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserGroup));
            setGroups(groupsData);
        }, (error) => {
            console.error("Error fetching groups:", error);
            ErrorLogger.error(error, 'GroupManager.fetchGroups');
        });

        return () => unsubscribe();
    }, [user?.organizationId]);

    const handleOpenDrawer = (group?: UserGroup) => {
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
    };

    const toggleMember = (uid: string) => {
        setFormData(prev => {
            const currentMembers = prev.members || [];
            if (currentMembers.includes(uid)) {
                return { ...prev, members: currentMembers.filter(id => id !== uid) };
            } else {
                return { ...prev, members: [...currentMembers, uid] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
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
    };

    const handleDelete = async () => {
        if (!confirmDelete.groupId) return;
        try {
            await deleteDoc(doc(db, 'user_groups', confirmDelete.groupId));
            addToast("Groupe supprimé", "info");
            setConfirmDelete({ isOpen: false, groupId: null });
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'GroupManager.handleDelete');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Groupes Utilisateurs</h3>
                    <p className="text-sm text-slate-600">Créez des équipes pour organiser vos collaborateurs.</p>
                </div>
                <Button
                    onClick={() => handleOpenDrawer()}
                    className="flex items-center gap-2 bg-brand-600 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-700"
                >
                    <Plus className="h-4 w-4" /> Nouveau Groupe
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map(group => (
                    <div key={group.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative group">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenDrawer(group)} className="p-2 text-slate-500 hover:text-brand-500 bg-slate-50 dark:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label={`Modifier le groupe ${group.name}`}>
                                <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={() => setConfirmDelete({ isOpen: true, groupId: group.id })} className="p-2 text-slate-500 hover:text-red-500 bg-slate-50 dark:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500" aria-label={`Supprimer le groupe ${group.name}`}>
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white">{group.name}</h4>
                                <p className="text-xs text-slate-600">{group.members?.length || 0} membres</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{group.description || "Aucune description"}</p>

                        {/* Member Avatars Preview */}
                        <div className="mt-4 flex -space-x-2 overflow-hidden">
                            {group.members?.slice(0, 5).map(memberId => {
                                const member = users.find(u => u.uid === memberId);
                                if (!member) return null;
                                return (
                                    <div key={memberId} className="relative inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 overflow-hidden" title={member.displayName}>
                                        {member.photoURL ? (
                                            <img src={member.photoURL} alt={member.displayName} className="h-full w-full object-cover" />
                                        ) : (
                                            member.displayName?.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                );
                            })}
                            {(group.members?.length || 0) > 5 && (
                                <div className="relative inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-500">
                                    +{(group.members?.length || 0) - 5}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Drawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-1">
                            {users.filter(u => !u.isPending).map(u => {
                                const isSelected = formData.members.includes(u.uid);
                                return (
                                    <div
                                        key={u.uid}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => toggleMember(u.uid)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                toggleMember(u.uid);
                                            }
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isSelected
                                            ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/5 hover:border-brand-300'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected
                                            ? 'bg-brand-600 border-brand-600 text-white'
                                            : 'border-slate-300 dark:border-slate-600'
                                            }`}>
                                            {isSelected && <Check className="h-3 w-3" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{u.displayName}</p>
                                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
                        <Button type="button" variant="ghost" onClick={() => setIsDrawerOpen(false)}>Annuler</Button>
                        <Button type="submit" className="bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20">Enregistrer</Button>
                    </div>
                </form>
            </Drawer>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, groupId: null })}
                onConfirm={handleDelete}
                title="Supprimer le groupe ?"
                message="Cette action est irréversible. Les utilisateurs ne seront pas supprimés, mais le groupe disparaîtra."
            />
        </div>
    );
};
