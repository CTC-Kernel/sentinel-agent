import { memo } from 'react';
import { UserProfile, Organization } from '../../types';
import { Star, RefreshCw, Trash2, Loader2 } from '../ui/Icons';
import { CustomSelect } from '../ui/CustomSelect';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
// Focus indicators: focus-visible:ring-2 applied globally via CSS

interface UserRowProps {
    user: UserProfile;
    currentUser: UserProfile;
    currentOrg: Organization | null;
    updating: boolean;
    onUpdateRole: (uid: string, role: UserProfile['role']) => void;
    onTransfer: (uid: string) => void;
    onRemove: (uid: string) => void;
    t: (key: string) => string;
}

export const UserRow = memo(({ user, currentUser, currentOrg, updating, onUpdateRole, onTransfer, onRemove, t }: UserRowProps) => {
    return (
        <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/60 dark:hover:bg-white/10 transition-colors backdrop-blur-[2px]">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700/50 flex-shrink-0 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold border border-white/40 dark:border-white/10 shadow-sm overflow-hidden">
                    <img
                        src={getUserAvatarUrl(user.photoURL, user.role)}
                        alt={user.displayName || 'Avatar'}
                        className="w-full h-full rounded-full object-cover"
                    />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {user.displayName}
                        </p>
                        {currentOrg?.ownerId === user.uid && (
                            <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20 dark:text-amber-400 rounded-full flex items-center gap-1 border border-amber-500/20">
                                <Star size={10} />
                                {t('settings.owner')}
                            </span>
                        )}
                        {user.uid === currentUser?.uid && (
                            <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100/50 text-slate-600 dark:text-slate-300 dark:bg-slate-700/50 dark:text-slate-300 rounded-full border border-slate-200/50 dark:border-slate-600/50">
                                {t('settings.you')}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-300 truncate">{user.email}</p>
                </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
                <div className="w-40">
                    <CustomSelect
                        value={user.role}
                        onChange={(val) => onUpdateRole(user.uid, val as UserProfile['role'])}
                        options={[
                            { value: 'admin', label: t('settings.roles.admin') },
                            { value: 'rssi', label: t('settings.roles.rssi') },
                            { value: 'auditor', label: t('settings.roles.auditor') },
                            { value: 'project_manager', label: t('settings.roles.project_manager') },
                            { value: 'direction', label: t('settings.roles.direction') },
                            { value: 'user', label: t('settings.roles.user') }
                        ]}
                        disabled={user.uid === currentUser.uid || currentOrg?.ownerId === user.uid || updating}
                        label={t('settings.role')}
                    />
                </div>

                <div className="flex items-center border-l border-white/20 dark:border-white/10 pl-3 gap-1">
                    {/* Transfer Ownership Button (Only for Owner) */}
                    {currentOrg?.ownerId === currentUser?.uid && user.uid !== currentUser?.uid && (
                        <button
                            onClick={() => onTransfer(user.uid)}
                            className="p-2 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            title={t('settings.transferOwnership')}
                            aria-label={t('settings.transferOwnership')}
                            type="button"
                        >
                            <RefreshCw size={16} />
                        </button>
                    )}

                    {/* Remove Member Button */}
                    {(currentUser?.role === 'admin' || currentOrg?.ownerId === currentUser?.uid) && user.uid !== currentUser?.uid && currentOrg?.ownerId !== user.uid && (
                        <button
                            onClick={() => onRemove(user.uid)}
                            disabled={updating}
                            className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                            title={t('settings.removeMember')}
                            aria-label={t('settings.removeMember')}
                            type="button"
                        >
                            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={16} />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});
