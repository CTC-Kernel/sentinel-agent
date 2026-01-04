import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../../types';
import { Edit, Trash2, Mail, Timer, Building, Clock } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { RoleBadge } from '../ui/RoleBadge';
import { getDefaultAvatarUrl } from '../../utils/avatarUtils';

interface UserCardProps {
    user: UserProfile;
    canAdmin: boolean;
    onEdit: (u: UserProfile) => void;
    onDelete: (u: UserProfile) => void;
}

export const UserCard = React.memo(({ user, canAdmin, onEdit, onDelete }: UserCardProps) => {
    const { t } = useTranslation();
    const handleEdit = React.useCallback(() => onEdit(user), [onEdit, user]);
    const handleDelete = React.useCallback(() => {
        onDelete(user);
    }, [onDelete, user]);

    return (
        <div className={`glass-panel rounded-[2.5rem] p-6 flex flex-col items-center text-center card-hover group relative border border-white/50 dark:border-white/5 ${user.isPending ? 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/20' : ''}`}>
            {canAdmin && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!user.isPending && (
                        <CustomTooltip content={t('team.actions.edit')}>
                            <button
                                type="button"
                                onClick={handleEdit}
                                className="p-2 bg-white dark:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white shadow-sm hover:scale-105 transition-all"
                                aria-label={t('team.actions.edit')}
                            >
                                <Edit className="h-4 w-4" />
                            </button>
                        </CustomTooltip>
                    )}
                    <CustomTooltip content={user.isPending ? t('team.delete.titleInvite').replace('?', '') : t('team.actions.delete')}>
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="p-2 bg-white dark:bg-slate-800 rounded-xl text-slate-500 hover:text-red-500 shadow-sm hover:scale-105 transition-all"
                            aria-label={t('team.actions.delete')}
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </CustomTooltip>
                </div>
            )}

            <div className="relative mb-4 mt-2">
                <img 
                    src={getDefaultAvatarUrl()} 
                    alt={user.displayName} 
                    loading="lazy" 
                    className={`w-24 h-24 rounded-full object-cover shadow-xl ring-4 ring-white dark:ring-slate-800 ${user.isPending ? 'opacity-50 grayscale' : ''}`} 
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = getDefaultAvatarUrl();
                    }}
                />
                <div className="absolute bottom-0 right-0 transform translate-x-2 translate-y-1">
                    <RoleBadge role={user.role} />
                </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{user.displayName}</h3>
            <div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-400 mb-4 bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-full">
                <Mail className="h-3 w-3 mr-1.5 opacity-70" /> {user.email}
            </div>

            {user.isPending ? (
                <div className="w-full pt-4 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-center items-center text-xs mt-auto">
                    <div className="flex items-center text-amber-500 font-bold bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg">
                        <Timer className="h-3.5 w-3.5 mr-1.5" />
                        {t('team.invite.success').split(' ')[0]} {t('team.stats.pending')}
                    </div>
                </div>
            ) : (
                <div className="w-full pt-4 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-between items-center text-xs mt-auto">
                    <div className="flex items-center text-slate-600 dark:text-slate-300 font-medium">
                        <Building className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                        {user.department || 'Général'}
                    </div>
                    {user.lastLogin && (
                        <div className="flex items-center text-slate-500 font-medium" title={t('team.columns.lastLogin')}>
                            <Clock className="h-3.5 w-3.5 mr-1.5" />
                            {new Date(user.lastLogin).toLocaleDateString()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
