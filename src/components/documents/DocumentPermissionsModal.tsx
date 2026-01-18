/**
 * Story 24.5 - Document Permissions Modal
 *
 * UI for managing document access control list (ACL).
 * Allows viewing, adding, and removing user/role/group permissions.
 */

import React, { useState, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  X,
  Shield,
  Users,
  User,
  UserCheck,
  Search,
  Plus,
  Trash2,
  Loader2,
  Info,
  Lock,
  Eye,
  Download,
  Edit3,
  Share2,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useTeamData } from '@/hooks/team/useTeamData';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/hooks/useLocale';
import type { Document } from '@/types/documents';
import type { DocumentPermission } from '@/types/vault';
import {
  grantAccess,
  revokeAccess,
  createPermission,
  PERMISSION_LABELS,
  PERMISSION_DESCRIPTIONS,
  type PermissionLevel,
} from '@/services/aclService';
import { CLASSIFICATION_CONFIG } from '@/services/vaultConfig';
import { getUserAvatarUrl } from '@/utils/avatarUtils';
import { toast } from '@/lib/toast';
import { ErrorLogger } from '@/services/errorLogger';

interface DocumentPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  onPermissionChange?: () => void;
}

const permissionSchema = z.object({
  principalType: z.enum(['user', 'role', 'group']),
  principalId: z.string().min(1, 'Selection requise'),
  access: z.enum(['read', 'download', 'edit', 'delete', 'share', 'admin']),
  expiryDays: z.number().optional(),
});

type PermissionFormData = z.infer<typeof permissionSchema>;

// Permission level icons
const PERMISSION_ICONS: Record<PermissionLevel, React.FC<{ className?: string }>> = {
  read: Eye,
  download: Download,
  edit: Edit3,
  delete: Trash2,
  share: Share2,
  admin: Settings,
};

// Permission levels ordered for display
const PERMISSION_OPTIONS: PermissionLevel[] = ['read', 'download', 'edit', 'share', 'admin'];

export const DocumentPermissionsModal: React.FC<DocumentPermissionsModalProps> = ({
  isOpen,
  onClose,
  document,
  onPermissionChange,
}) => {
  const { t } = useLocale();
  const { user } = useAuth();
  const { users, groups } = useTeamData();
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PermissionFormData>({
    resolver: zodResolver(permissionSchema),
    defaultValues: {
      principalType: 'user',
      principalId: '',
      access: 'read',
    },
  });

  const watchPrincipalType = watch('principalType');

  // Get current permissions from document
  const currentPermissions = document.acl?.permissions || [];

  // Classification info
  const classification = document.classification?.level || 'internal';
  const classificationConfig = CLASSIFICATION_CONFIG[classification];

  // Filter users/groups based on search
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      u =>
        u.displayName?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groups;
    const query = searchQuery.toLowerCase();
    return groups.filter(g => g.name?.toLowerCase().includes(query));
  }, [groups, searchQuery]);

  // Get available roles for role-based permissions
  const availableRoles = ['user', 'auditor', 'project_manager', 'rssi', 'admin'];

  // Find user/group info for a permission entry
  const getPrincipalInfo = (permission: DocumentPermission) => {
    switch (permission.principalType) {
      case 'user': {
        const foundUser = users.find(u => u.uid === permission.principalId);
        return {
          name: foundUser?.displayName || permission.principalId,
          email: foundUser?.email,
          avatar: foundUser ? getUserAvatarUrl(foundUser.photoURL, foundUser.role) : undefined,
        };
      }
      case 'role': {
        return {
          name: permission.principalId,
          email: 'Role',
          avatar: undefined,
        };
      }
      case 'group': {
        const foundGroup = groups.find(g => g.id === permission.principalId);
        return {
          name: foundGroup?.name || permission.principalId,
          email: `${foundGroup?.members.length || 0} membres`,
          avatar: undefined,
        };
      }
      default:
        return { name: permission.principalId, email: '', avatar: undefined };
    }
  };

  const handleAddPermission = async (data: PermissionFormData) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const expiresAt = data.expiryDays
        ? new Date(Date.now() + data.expiryDays * 24 * 60 * 60 * 1000)
        : undefined;

      const permission = createPermission(
        data.principalType,
        data.principalId,
        data.access,
        user.uid,
        expiresAt
      );

      await grantAccess(document.id, permission);
      toast.success(t('permissions.granted', 'Permission accordee'));
      reset();
      setIsAdding(false);
      onPermissionChange?.();
    } catch (error) {


      ErrorLogger.handleErrorWithToast(error, 'DocumentPermissionsModal.add', 'PERMISSION_DENIED');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokePermission = async (
    principalType: 'user' | 'role' | 'group',
    principalId: string
  ) => {
    setRemovingId(`${principalType}-${principalId}`);
    try {
      await revokeAccess(document.id, principalType, principalId);
      toast.success(t('permissions.revoked', 'Permission revoquee'));
      onPermissionChange?.();
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'DocumentPermissionsModal.revoke', 'PERMISSION_DENIED');
    } finally {
      setRemovingId(null);
    }
  };

  const canManagePermissions =
    user &&
    (user.role === 'admin' ||
      user.role === 'super_admin' ||
      user.role === 'rssi' ||
      document.ownerId === user.uid);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[200]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-left align-middle shadow-xl transition-all border border-slate-200 dark:border-white/10">
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-slate-200 dark:border-white/10">
                  <div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-slate-900 dark:text-white flex items-center gap-2"
                    >
                      <Shield className="w-5 h-5 text-brand-500" />
                      {t('permissions.title', 'Permissions du document')}
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 truncate max-w-md">
                      {document.title}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {/* Classification Info */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-white/5">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${classificationConfig.color}20` }}
                      >
                        <Lock
                          className="w-5 h-5"
                          style={{ color: classificationConfig.color }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 dark:text-white">
                            {t('classification.inheritedAccess', 'Acces herite de la classification')}
                          </span>
                          <Badge variant="outline" status={classification === 'public' ? 'success' : classification === 'internal' ? 'info' : classification === 'confidential' ? 'warning' : 'error'}>
                            {classification === 'public' ? 'Public' : classification === 'internal' ? 'Interne' : classification === 'confidential' ? 'Confidentiel' : 'Secret'}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {classificationConfig.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {CLASSIFICATION_CONFIG[classification].requiredRoles.length === 0 ? (
                            <Badge variant="soft" className="text-xs">
                              Tous les utilisateurs
                            </Badge>
                          ) : (
                            CLASSIFICATION_CONFIG[classification].requiredRoles.map(role => (
                              <Badge key={role} variant="outline" status={role === 'admin' ? 'error' : role === 'project_manager' ? 'warning' : 'info'}>
                                {role}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Current Permissions */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {t('permissions.explicit', 'Permissions explicites')}
                        <Badge variant="outline" className="gap-1 pl-1 pr-2">
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="bg-transparent text-xs">
                              {currentPermissions.length}
                            </AvatarFallback>
                          </Avatar>
                          {currentPermissions.length}
                        </Badge>
                      </h4>
                      {canManagePermissions && !isAdding && (
                        <Button
                          size="sm"
                          onClick={() => setIsAdding(true)}
                          className="gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          {t('permissions.add', 'Ajouter')}
                        </Button>
                      )}
                    </div>

                    {currentPermissions.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                        <Info className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {t(
                            'permissions.noExplicit',
                            "Aucune permission explicite. L'acces est base sur la classification."
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {currentPermissions.map((permission, index) => {
                          const info = getPrincipalInfo(permission);
                          const PermissionIcon = PERMISSION_ICONS[permission.access];
                          const isRemoving =
                            removingId ===
                            `${permission.principalType}-${permission.principalId}`;

                          return (
                            <div
                              key={`${permission.principalType}-${permission.principalId}-${index}`}
                              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-white/5"
                            >
                              <div className="flex items-center gap-3">
                                {permission.principalType === 'user' ? (
                                  info.avatar ? (
                                    <img
                                      src={info.avatar}
                                      alt={info.name}
                                      className="w-8 h-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                                      <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                                    </div>
                                  )
                                ) : permission.principalType === 'group' ? (
                                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                                    <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-white text-sm">
                                    {info.name}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {info.email}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="gap-1"
                                >
                                  <PermissionIcon className="w-3 h-3" />
                                  {PERMISSION_LABELS[permission.access]}
                                </Badge>
                                {canManagePermissions && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                                    disabled={isRemoving}
                                    onClick={() =>
                                      handleRevokePermission(
                                        permission.principalType,
                                        permission.principalId
                                      )
                                    }
                                  >
                                    {isRemoving ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Add Permission Form */}
                  {isAdding && canManagePermissions && (
                    <form
                      onSubmit={handleSubmit(handleAddPermission)}
                      className="bg-brand-50 dark:bg-brand-900/20 rounded-xl p-4 border border-brand-200 dark:border-brand-800"
                    >
                      <h4 className="font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        {t('permissions.addNew', 'Ajouter une permission')}
                      </h4>

                      <div className="space-y-4">
                        {/* Principal Type */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('permissions.type', 'Type')}
                          </label>
                          <Controller
                            name="principalType"
                            control={control}
                            render={({ field }) => (
                              <div className="flex gap-2">
                                {[
                                  { value: 'user', label: 'Utilisateur', icon: User },
                                  { value: 'role', label: 'Role', icon: UserCheck },
                                  { value: 'group', label: 'Groupe', icon: Users },
                                ].map(({ value, label, icon: Icon }) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => {
                                      field.onChange(value);
                                      setValue('principalId', '');
                                    }}
                                    className={cn(
                                      'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-all',
                                      field.value === value
                                        ? 'bg-brand-600 text-white border-brand-600'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-brand-300'
                                    )}
                                  >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                  </button>
                                ))}
                              </div>
                            )}
                          />
                        </div>

                        {/* Principal Selection */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {watchPrincipalType === 'user'
                              ? t('permissions.selectUser', 'Selectionner un utilisateur')
                              : watchPrincipalType === 'role'
                                ? t('permissions.selectRole', 'Selectionner un role')
                                : t('permissions.selectGroup', 'Selectionner un groupe')}
                          </label>

                          {watchPrincipalType === 'user' && (
                            <>
                              <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                  type="text"
                                  value={searchQuery}
                                  onChange={e => setSearchQuery(e.target.value)}
                                  placeholder={t('common.search', 'Rechercher...')}
                                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm"
                                />
                              </div>
                              <Controller
                                name="principalId"
                                control={control}
                                render={({ field }) => (
                                  <div className="max-h-40 overflow-y-auto space-y-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-white/10 p-2">
                                    {filteredUsers.length === 0 ? (
                                      <p className="text-sm text-slate-500 text-center py-2">
                                        {t('common.noResults', 'Aucun resultat')}
                                      </p>
                                    ) : (
                                      filteredUsers.map(u => (
                                        <button
                                          key={u.uid}
                                          type="button"
                                          onClick={() => field.onChange(u.uid)}
                                          className={cn(
                                            'w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all',
                                            field.value === u.uid
                                              ? 'bg-brand-100 dark:bg-brand-900/50'
                                              : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                                          )}
                                        >
                                          <img
                                            src={getUserAvatarUrl(u.photoURL, u.role)}
                                            alt={u.displayName}
                                            className="w-6 h-6 rounded-full object-cover"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                              {u.displayName}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">
                                              {u.email}
                                            </p>
                                          </div>
                                          <Badge variant="soft" className="text-xs shrink-0">
                                            {u.role}
                                          </Badge>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                )}
                              />
                            </>
                          )}

                          {watchPrincipalType === 'role' && (
                            <Controller
                              name="principalId"
                              control={control}
                              render={({ field }) => (
                                <select
                                  {...field}
                                  className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                                >
                                  <option value="">
                                    {t('permissions.selectRole', 'Selectionner un role')}
                                  </option>
                                  {availableRoles.map(role => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                              )}
                            />
                          )}

                          {watchPrincipalType === 'group' && (
                            <Controller
                              name="principalId"
                              control={control}
                              render={({ field }) => (
                                <div className="max-h-40 overflow-y-auto space-y-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-white/10 p-2">
                                  {filteredGroups.length === 0 ? (
                                    <p className="text-sm text-slate-500 text-center py-2">
                                      {t('permissions.noGroups', 'Aucun groupe disponible')}
                                    </p>
                                  ) : (
                                    filteredGroups.map(g => (
                                      <button
                                        key={g.id}
                                        type="button"
                                        onClick={() => field.onChange(g.id)}
                                        className={cn(
                                          'w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all',
                                          field.value === g.id
                                            ? 'bg-brand-100 dark:bg-brand-900/50'
                                            : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                                        )}
                                      >
                                        <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                          <Users className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                                            {g.name}
                                          </p>
                                        </div>
                                        <Badge variant="soft" className="text-xs">
                                          {g.members.length} membres
                                        </Badge>
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            />
                          )}

                          {errors.principalId && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.principalId.message}
                            </p>
                          )}
                        </div>

                        {/* Permission Level */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('permissions.level', 'Niveau de permission')}
                          </label>
                          <Controller
                            name="access"
                            control={control}
                            render={({ field }) => (
                              <div className="grid grid-cols-5 gap-2">
                                {PERMISSION_OPTIONS.map(level => {
                                  const Icon = PERMISSION_ICONS[level];
                                  return (
                                    <button
                                      key={level}
                                      type="button"
                                      onClick={() => field.onChange(level)}
                                      title={PERMISSION_DESCRIPTIONS[level]}
                                      className={cn(
                                        'flex flex-col items-center gap-1 py-2 px-2 rounded-lg border transition-all text-xs',
                                        field.value === level
                                          ? 'bg-brand-600 text-white border-brand-600'
                                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-brand-300'
                                      )}
                                    >
                                      <Icon className="w-4 h-4" />
                                      {PERMISSION_LABELS[level]}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsAdding(false);
                              reset();
                            }}
                          >
                            {t('common.cancel', 'Annuler')}
                          </Button>
                          <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                {t('common.saving', 'Enregistrement...')}
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4 mr-2" />
                                {t('permissions.add', 'Ajouter')}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end p-6 border-t border-slate-200 dark:border-white/10">
                  <Button variant="outline" onClick={onClose}>
                    {t('common.close', 'Fermer')}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default DocumentPermissionsModal;
