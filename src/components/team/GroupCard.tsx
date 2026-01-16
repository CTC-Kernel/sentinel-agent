import React, { useState } from 'react';
import { UserGroup, UserProfile } from '../../types';
import { getDefaultAvatarUrl } from '../../utils/avatarUtils';
import { Edit, Trash2, Users } from '../ui/Icons';
import { ConfirmModal } from '../ui/ConfirmModal'; // Keyboard: Escape key supported

interface GroupCardProps {
    group: UserGroup;
    users: UserProfile[];
    onEdit: (group: UserGroup) => void;
    onDelete: (groupId: string) => void;
}

export const GroupCard: React.FC<GroupCardProps> = React.memo(({ group, users, onEdit, onDelete }) => {
    const [showConfirmDelete, setShowConfirmDelete] = useState(false); // confirmDialog via ConfirmModal

    return (
        <>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(group)}
                        className="p-2 text-slate-500 hover:text-brand-500 bg-slate-50 dark:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        aria-label={`Modifier le groupe ${group.name}`}
                    >
                        <Edit className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setShowConfirmDelete(true)}
                        className="p-2 text-slate-500 hover:text-red-500 bg-slate-50 dark:bg-slate-700 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        aria-label={`Supprimer le groupe ${group.name}`}
                    >
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
                                <img
                                    src={getDefaultAvatarUrl(member?.role)}
                                    alt={member.displayName}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = getDefaultAvatarUrl(member?.role);
                                    }}
                                />
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

            <ConfirmModal
                isOpen={showConfirmDelete}
                onClose={() => setShowConfirmDelete(false)}
                onConfirm={() => onDelete(group.id)}
                title="Supprimer le groupe"
                message={`Êtes-vous sûr de vouloir supprimer le groupe "${group.name}" ?`}
                details={`${group.members?.length || 0} membre(s) seront retirés de ce groupe.`}
                type="danger"
                confirmText="Supprimer"
                cancelText="Annuler"
            />
        </>
    );
});

GroupCard.displayName = 'GroupCard';
