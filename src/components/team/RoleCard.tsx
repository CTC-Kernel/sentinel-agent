import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomRole } from '../../types';
import { Edit, Trash2, Shield } from '../ui/Icons';
import { ConfirmModal } from '../ui/ConfirmModal'; // Keyboard: Escape key supported

interface RoleCardProps {
    role: CustomRole;
    onEdit: (role: CustomRole) => void;
    onDelete: (roleId: string) => void;
}

export const RoleCard = memo(({ role, onEdit, onDelete }: RoleCardProps) => {
    const { t } = useTranslation();
    const [showConfirmDelete, setShowConfirmDelete] = useState(false); // confirmDialog via ConfirmModal

    return (
        <>
        <div className="bg-white dark:bg-slate-800 border border-border/40 dark:border-white/5 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-70 transition-opacity">
                <button
                    onClick={() => onEdit(role)}
                    className="p-2 text-muted-foreground hover:text-brand-500 bg-slate-50 dark:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Modifier le rôle ${role.name}`}
                >
                    <Edit className="h-4 w-4" />
                </button>
                <button
                    onClick={() => setShowConfirmDelete(true)}
                    className="p-2 text-muted-foreground hover:text-red-500 bg-slate-50 dark:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    aria-label={`Supprimer le rôle ${role.name}`}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
            <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-brand-50 dark:bg-brand-800 rounded-3xl text-brand-600 dark:text-brand-400">
                    <Shield className="h-6 w-6" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{role.name}</h4>
                    <p className="text-xs text-slate-600">{Object.keys(role.permissions).length} ressources configurées</p>
                </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-muted-foreground line-clamp-2">{role.description || "Aucune description"}</p>
        </div>

        <ConfirmModal
            isOpen={showConfirmDelete}
            onClose={() => setShowConfirmDelete(false)}
            onConfirm={() => onDelete(role.id)}
            title="Supprimer le rôle"
            message={`Êtes-vous sûr de vouloir supprimer le rôle "${role.name}" ?`}
            details="Les utilisateurs avec ce rôle perdront leurs permissions associées."
            type="danger"
            confirmText={t('common.delete', { defaultValue: 'Supprimer' })}
            cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
        />
        </>
    );
});
