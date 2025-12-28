import { memo, useState } from 'react';
import { CustomRole } from '../../types';
import { Edit, Trash2, Shield } from '../ui/Icons';
import { ConfirmModal } from '../ui/ConfirmModal';

interface RoleCardProps {
    role: CustomRole;
    onEdit: (role: CustomRole) => void;
    onDelete: (roleId: string) => void;
}

export const RoleCard = memo(({ role, onEdit, onDelete }: RoleCardProps) => {
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    return (
        <>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onEdit(role)}
                    className="p-2 text-slate-500 hover:text-brand-500 bg-slate-50 dark:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    aria-label={`Modifier le rôle ${role.name}`}
                >
                    <Edit className="h-4 w-4" />
                </button>
                <button
                    onClick={() => setShowConfirmDelete(true)}
                    className="p-2 text-slate-500 hover:text-red-500 bg-slate-50 dark:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    aria-label={`Supprimer le rôle ${role.name}`}
                >
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

        <ConfirmModal
            isOpen={showConfirmDelete}
            onClose={() => setShowConfirmDelete(false)}
            onConfirm={() => onDelete(role.id)}
            title="Supprimer le rôle"
            message={`Êtes-vous sûr de vouloir supprimer le rôle "${role.name}" ?`}
            details="Les utilisateurs avec ce rôle perdront leurs permissions associées."
            type="danger"
            confirmText="Supprimer"
            cancelText="Annuler"
        />
        </>
    );
});
