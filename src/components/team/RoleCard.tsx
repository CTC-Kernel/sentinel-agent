import { memo, useState } from 'react';
import { useLocale } from '../../hooks/useLocale';
import { CustomRole } from '../../types';
import { Edit, Trash2, Shield } from '../ui/Icons';
import { ConfirmModal } from '../ui/ConfirmModal'; // Keyboard: Escape key supported

interface RoleCardProps {
 role: CustomRole;
 onEdit: (role: CustomRole) => void;
 onDelete: (roleId: string) => void;
}

export const RoleCard = memo(({ role, onEdit, onDelete }: RoleCardProps) => {
 const { t } = useLocale();
 const [showConfirmDelete, setShowConfirmDelete] = useState(false); // confirmDialog via ConfirmModal

 return (
 <>
 <div className="bg-card border border-border/40 dark:border-white/5 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative group">
 <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-70 transition-opacity">
 <button
  onClick={() => onEdit(role)}
  className="p-2 text-muted-foreground hover:text-primary bg-muted rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  aria-label={t('team.roles.editAriaLabel', { defaultValue: `Modifier le rôle ${role.name}` })}
 >
  <Edit className="h-4 w-4" />
 </button>
 <button
  onClick={() => setShowConfirmDelete(true)}
  className="p-2 text-muted-foreground hover:text-red-500 bg-muted rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
  aria-label={t('team.roles.deleteAriaLabel', { defaultValue: `Supprimer le rôle ${role.name}` })}
 >
  <Trash2 className="h-4 w-4" />
 </button>
 </div>
 <div className="flex items-center gap-3 mb-4">
 <div className="p-3 bg-primary/10 dark:bg-primary rounded-3xl text-primary">
  <Shield className="h-6 w-6" />
 </div>
 <div>
  <h4 className="font-bold text-foreground">{role.name}</h4>
  <p className="text-xs text-muted-foreground">{t('team.roles.resourcesConfigured', { defaultValue: `${Object.keys(role.permissions).length} ressources configurées` })}</p>
 </div>
 </div>
 <p className="text-sm text-muted-foreground line-clamp-2">{role.description || t('team.roles.noDescription', { defaultValue: 'Aucune description' })}</p>
 </div>

 <ConfirmModal
 isOpen={showConfirmDelete}
 onClose={() => setShowConfirmDelete(false)}
 onConfirm={() => onDelete(role.id)}
 title={t('team.roles.deleteConfirmTitle', { defaultValue: 'Supprimer le rôle' })}
 message={t('team.roles.deleteConfirmMessage', { defaultValue: `Êtes-vous sûr de vouloir supprimer le rôle "${role.name}" ?` })}
 details={t('team.roles.deleteConfirmDetails', { defaultValue: 'Les utilisateurs avec ce rôle perdront leurs permissions associées.' })}
 type="danger"
 confirmText={t('common.delete', { defaultValue: 'Supprimer' })}
 cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
 />
 </>
 );
});
