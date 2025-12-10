import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { CustomRole, ResourceType, ActionType } from '../../types';
import { useStore } from '../../store';
import { Drawer } from '../ui/Drawer';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Plus, Edit, Trash2, Shield, Check } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';

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
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
    const [formData, setFormData] = useState<{ name: string; description: string; permissions: Record<string, ActionType[]> }>({
        name: '', description: '', permissions: {}
    });

    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; roleId: string | null }>({ isOpen: false, roleId: null });

    const handleOpenDrawer = (role?: CustomRole) => {
        if (role) {
            setEditingRole(role);
            setFormData({
                name: role.name,
                description: role.description || '',
                permissions: role.permissions as Record<string, ActionType[]>
            });
        } else {
            setEditingRole(null);
            setFormData({ name: '', description: '', permissions: {} });
        }
        setIsDrawerOpen(true);
    };

    const togglePermission = (resource: string, action: ActionType) => {
        setFormData(prev => {
            const currentActions = prev.permissions[resource] || [];
            let newActions;
            if (currentActions.includes(action)) {
                newActions = currentActions.filter(a => a !== action);
            } else {
                newActions = [...currentActions, action];
            }
            return {
                ...prev,
                permissions: {
                    ...prev.permissions,
                    [resource]: newActions
                }
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.organizationId) return;

        try {
            const roleData = {
                organizationId: user.organizationId,
                name: formData.name,
                description: formData.description,
                permissions: formData.permissions,
                updatedAt: new Date().toISOString()
            };

            if (editingRole) {
                await updateDoc(doc(db, 'custom_roles', editingRole.id), roleData);
                addToast("Rôle mis à jour", "success");
            } else {
                await addDoc(collection(db, 'custom_roles'), {
                    ...roleData,
                    createdAt: new Date().toISOString()
                });
                addToast("Rôle créé", "success");
            }
            setIsDrawerOpen(false);
            onRefresh();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RoleManager.handleSubmit');
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete.roleId) return;
        try {
            await deleteDoc(doc(db, 'custom_roles', confirmDelete.roleId));
            addToast("Rôle supprimé", "info");
            setConfirmDelete({ isOpen: false, roleId: null });
            onRefresh();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RoleManager.handleDelete');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rôles Personnalisés</h3>
                    <p className="text-sm text-slate-600">Gérez les permissions fines pour votre organisation.</p>
                </div>
                <button
                    onClick={() => handleOpenDrawer()}
                    className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20"
                >
                    <Plus className="h-4 w-4 mr-2" /> Nouveau Rôle
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roles.map(role => (
                    <div key={role.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative group">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenDrawer(role)} className="p-2 text-slate-500 hover:text-brand-500 bg-slate-50 dark:bg-slate-700 rounded-lg transition-colors">
                                <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={() => setConfirmDelete({ isOpen: true, roleId: role.id })} className="p-2 text-slate-500 hover:text-red-500 bg-slate-50 dark:bg-slate-700 rounded-lg transition-colors">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-brand-50 dark:bg-brand-900/20 rounded-xl text-brand-600 dark:text-brand-400">
                                <Shield className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white">{role.name}</h4>
                                <p className="text-xs text-slate-600">{Object.keys(role.permissions).length} ressources configurées</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{role.description || "Aucune description"}</p>
                    </div>
                ))}
            </div>

            <Drawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title={editingRole ? "Modifier le rôle" : "Nouveau rôle"}
                subtitle="Définissez les permissions d'accès."
                width="max-w-4xl"
            >
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Nom du rôle</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="ex: Stagiaire Marketing"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Description</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="Description du rôle..."
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-white/10 pt-6">
                        <h4 className="font-bold text-slate-900 dark:text-white mb-4">Matrice des Permissions</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-600 uppercase bg-slate-50 dark:bg-slate-800/50">
                                    <tr>
                                        <th className="px-4 py-3 rounded-tl-lg">Ressource</th>
                                        {ACTIONS.map(action => (
                                            <th key={action} className="px-4 py-3 text-center">{action}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {RESOURCES.map(resource => (
                                        <tr key={resource} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{resource}</td>
                                            {ACTIONS.map(action => {
                                                const isChecked = formData.permissions[resource]?.includes(action);
                                                return (
                                                    <td key={action} className="px-4 py-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => togglePermission(resource, action)}
                                                            className={`w-5 h-5 rounded border flex items-center justify-center transition-all mx-auto ${isChecked
                                                                ? 'bg-brand-600 border-brand-600 text-white'
                                                                : 'border-slate-300 dark:border-slate-600 hover:border-brand-500'
                                                                }`}
                                                        >
                                                            {isChecked && <Check className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
                        <button type="button" onClick={() => setIsDrawerOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="px-6 py-2.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20">Enregistrer</button>
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
