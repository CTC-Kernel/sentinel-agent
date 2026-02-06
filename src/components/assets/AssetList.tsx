import React, { useMemo } from 'react';
import { Tooltip } from '../ui/Tooltip';
import { Asset, Criticality, UserProfile } from '../../types';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { DataTable } from '../ui/DataTable';
import { Server, Edit, Trash2, Tag, Copy, HardDrive, Cpu, Database, Activity, Users } from '../ui/Icons';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { RowActionsMenu, RowActionItem } from '../ui/RowActionsMenu';
import { canDeleteResource } from '../../utils/permissions';
import { ColumnDef } from '@tanstack/react-table';
import { useStore } from '../../store';

const getTypeStyles = (type: string) => {
 switch (type) {
 case 'Matériel':
 return {
 icon: HardDrive,
 color: 'text-muted-foreground',
 bg: 'bg-muted/30',
 border: 'border-muted',
 badge: 'bg-muted text-muted-foreground border-muted'
 };
 case 'Logiciel':
 return {
 icon: Cpu,
 color: 'text-primary',
 bg: 'bg-primary/10',
 border: 'border-primary/20',
 badge: 'bg-primary/10 text-primary border-primary/20'
 };
 case 'Données':
 return {
 icon: Database,
 color: 'text-purple-600 dark:text-purple-400',
 bg: 'bg-purple-100/50 dark:bg-purple-900/20',
 border: 'border-purple-200 dark:border-purple-800/50',
 badge: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-100 dark:border-purple-800'
 };
 case 'Service':
 return {
 icon: Activity,
 color: 'text-success',
 bg: 'bg-success/10',
 border: 'border-success/20',
 badge: 'bg-success/10 text-success border-success/20'
 };
 case 'Humain':
 return {
 icon: Users,
 color: 'text-warning',
 bg: 'bg-warning/10',
 border: 'border-warning/20',
 badge: 'bg-warning/10 text-warning border-warning/20'
 };
 default:
 return {
 icon: Server,
 color: 'text-muted-foreground',
 bg: 'bg-muted/30',
 border: 'border-muted',
 badge: 'bg-muted text-muted-foreground border-muted'
 };
 }
};

interface AssetListProps {
 assets: Asset[];
 loading: boolean;
 viewMode: 'grid' | 'list' | 'matrix' | 'kanban';
 user: UserProfile | null;
 onEdit: (asset: Asset) => void;
 onDelete: (id: string, name: string) => void;
 onDuplicate?: (asset: Asset) => void;
 onGenerateLabel: (asset: Asset) => void;
 isGeneratingLabels?: boolean;
 canEdit: boolean;
 activeFiltersQuery?: string;
 onBulkDelete?: (ids: string[]) => void;
 users?: UserProfile[];
 duplicatingIds?: Set<string>;
}

const getCriticalityColor = (level: Criticality) => {
 switch (level) {
 case Criticality.CRITICAL: return 'bg-error-bg text-error-text border-error-border/50';
 case Criticality.HIGH: return 'bg-warning-bg text-warning-text border-warning-border/50';
 case Criticality.MEDIUM: return 'bg-warning/10 text-warning border-warning/20';
 default: return 'bg-success-bg text-success-text border-success-border/50';
 }
};

export const AssetList = React.memo<AssetListProps>(({
 assets,
 loading,
 viewMode,
 user,
 onEdit,
 onDelete,
 onDuplicate,
 onBulkDelete,
 activeFiltersQuery,
 canEdit,
 onGenerateLabel,
 isGeneratingLabels,
 users,
 duplicatingIds = new Set(),
}) => {
 const { t } = useStore();
 const canDelete = canDeleteResource(user, 'Asset');

 const filteredAssets = useMemo(() => {
 if (!activeFiltersQuery) return assets;
 return assets.filter(asset =>
 asset.name.toLowerCase().includes(activeFiltersQuery.toLowerCase()) ||
 asset.type.toLowerCase().includes(activeFiltersQuery.toLowerCase()) ||
 asset.owner?.toLowerCase().includes(activeFiltersQuery.toLowerCase())
 );
 }, [assets, activeFiltersQuery]);

 const columns = useMemo<ColumnDef<Asset>[]>(() => [
 {
 header: t('common.name'),
 accessorKey: 'name',
 cell: ({ row }) => <span className="font-bold text-foreground">{row.original.name}</span>,
 meta: { className: 'w-full md:w-auto' }
 },
 {
 header: t('common.type'),
 accessorKey: 'type',
 meta: { className: 'hidden md:table-cell' },
 cell: ({ row }) => {
 const styles = getTypeStyles(row.original.type);
 const TypeIcon = styles.icon;
 return (
  <div className="flex items-center gap-2">
  <div className={`p-1.5 rounded-3xl ${styles.bg} ${styles.color} border ${styles.border}`}>
  <TypeIcon className="h-3.5 w-3.5" />
  </div>
  <span className={`px-2 py-0.5 rounded-3xl text-[11px] font-bold border shadow-sm ${styles.badge}`}>
  {row.original.type}
  </span>
  </div>
 );
 }
 },
 {
 header: t('common.criticality'),
 accessorKey: 'confidentiality',
 cell: ({ row }) => <span className={`px-2 py-1 rounded-3xl text-[11px] font-bold uppercase tracking-wider border shadow-sm ${getCriticalityColor(row.original.confidentiality)}`}>{row.original.confidentiality}</span>
 },
 {
 header: t('common.owner'),
 accessorKey: 'owner',
 meta: { className: 'hidden lg:table-cell' },
 cell: ({ row }) => {
 const ownerName = row.original.owner;
 const ownerUser = users?.find(u => u.displayName === ownerName || u.email === ownerName);
 return (
  <div className="flex items-center gap-2">
  <img
  src={getUserAvatarUrl(ownerUser?.photoURL, ownerUser?.role)}
  alt={`${ownerName} avatar`}
  className="w-6 h-6 rounded-full border border-muted object-cover bg-muted/30"
  onError={(e) => {
  const target = e.target as HTMLImageElement;
  target.src = getUserAvatarUrl(null, ownerUser?.role);
  }}
  role="presentation"
  />
  <span className="font-medium text-foreground">{ownerName}</span>
  </div>
 );
 }
 },
 {
 header: t('common.status'),
 accessorKey: 'lifecycleStatus',
 meta: { className: 'hidden xl:table-cell' },
 cell: ({ row }) => (
 <div className="flex items-center gap-2">
  <span className={`w-2 h-2 rounded-full ${row.original.lifecycleStatus === 'En service' ? 'bg-success' : 'bg-muted'}`}></span>
  <span>
  {(() => {
  const val = row.original.lifecycleStatus || 'Neuf';
  if (val === 'Neuf') return t('assets.status.new');
  if (val === 'En service') return t('assets.status.inService');
  return val;
  })()}
  </span>
 </div>
 )
 },
 {
 header: t('common.actions.title'),
 id: 'actions',
 cell: ({ row }) => {
 const isDuplicating = duplicatingIds.has(row.original.id);
 const menuItems: RowActionItem[] = [
  {
  label: t('assets.printLabel'),
  icon: Tag,
  onClick: () => onGenerateLabel(row.original),
  disabled: isGeneratingLabels,
  },
  ...(canEdit ? [{
  label: t('assets.editAsset'),
  icon: Edit,
  onClick: () => onEdit(row.original),
  }] : []),
  ...(onDuplicate && canEdit ? [{
  label: t('common.duplicate') || 'Dupliquer',
  icon: Copy,
  onClick: () => onDuplicate(row.original),
  disabled: isDuplicating,
  }] : []),
  ...(canDeleteResource(user, 'Asset') ? [{
  label: t('assets.deleteAssetTooltip'),
  icon: Trash2,
  onClick: () => onDelete(row.original.id, row.original.name),
  variant: 'danger' as const,
  }] : []),
 ];

 if (menuItems.length === 0) return null;

 return (
  <div className="flex justify-end">
  <RowActionsMenu
  items={menuItems}
  aria-label={`Actions pour ${row.original.name}`}
  />
  </div>
 );
 }
 }
 ], [canEdit, isGeneratingLabels, onEdit, onDelete, onDuplicate, onGenerateLabel, user, t, users, duplicatingIds]);

 if (viewMode === 'list') {
 return (
 <div className="w-full max-w-full rounded-3xl overflow-hidden shadow-sm border border-border/40 bg-background/50 backdrop-blur-sm">
 <DataTable
  columns={columns}
  data={assets}
  selectable={canDelete}
  onRowClick={(asset) => onEdit(asset)}
  searchable={false}
  exportable={false}
  loading={loading}
  pageSize={12}
  onBulkDelete={onBulkDelete}
  emptyState={
  <EmptyState
  icon={Server}
  title={t('assets.emptyTitle')}
  description={activeFiltersQuery ? t('assets.emptyDescSearch') : t('assets.emptyDesc')}
  actionLabel={activeFiltersQuery || !canEdit ? undefined : t('assets.createAsset')}
  onAction={activeFiltersQuery || !canEdit ? undefined : () => onEdit({} as Asset)}
  />
  }
 />
 </div>
 );
 }

 return (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
 {loading ? (
 <div className="col-span-full"><CardSkeleton count={6} /></div>
 ) : filteredAssets.length === 0 ? (
 <div className="col-span-full">
  <EmptyState
  icon={Server}
  title={t('assets.emptyTitle')}
  description={activeFiltersQuery ? t('assets.emptyDescSearch') : t('assets.emptyDesc')}
  actionLabel={activeFiltersQuery || !canEdit ? undefined : t('assets.createAsset')}
  onAction={activeFiltersQuery || !canEdit ? undefined : () => onEdit({
  id: '',
  name: '',
  type: 'Matériel',
  lifecycleStatus: 'Opérationnel',
  organizationId: user?.organizationId || '',
  owner: user?.uid || '',
  confidentiality: 'Moyen',
  integrity: 'Moyen',
  availability: 'Moyen',
  location: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
  } as unknown as Asset)}
  />
 </div>
 ) : (
 assets.map((asset) => {
  const warrantyExpired = asset.warrantyEnd && new Date(asset.warrantyEnd) < new Date();
  return (
  <div
  key={asset.id || 'unknown'}
  onClick={() => onEdit(asset)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onEdit(asset); }}
  role="button"
  tabIndex={0}
  className="glass-premium p-4 sm:p-6 rounded-3xl shadow-sm card-hover cursor-pointer group flex flex-col border border-border/40 transition-all duration-300 relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
  >
  <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none" />
  <div className="relative z-10 flex flex-col h-full">
  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-70 transition-opacity flex gap-2">
   <div className="flex gap-2">
   <Tooltip content={t('assets.printLabel')}>
   <button
   onClick={(e) => { e.stopPropagation(); onGenerateLabel(asset); }}
   className="p-2 bg-white/90 dark:bg-white/10 rounded-3xl text-muted-foreground hover:text-primary shadow-sm backdrop-blur-sm transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
   disabled={isGeneratingLabels}
   >
   <Tag className="h-4 w-4" />
   </button>
   </Tooltip>
   {canEdit && (
   <Tooltip content={t('assets.editAsset')}>
   <button
    onClick={(e) => { e.stopPropagation(); onEdit(asset); }}
    className="p-2 bg-background/90/10 rounded-3xl text-muted-foreground hover:text-primary shadow-sm backdrop-blur-sm transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
   >
    <Edit className="h-4 w-4" />
   </button>
   </Tooltip>
   )}
   {canDeleteResource(user, 'Asset') && (
   <Tooltip content={t('assets.deleteAssetTooltip')}>
   <button
    onClick={(e) => { e.stopPropagation(); onDelete(asset.id, asset.name); }}
    className="p-2 bg-background/90/10 rounded-3xl text-muted-foreground hover:text-destructive shadow-sm backdrop-blur-sm transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
   >
    <Trash2 className="h-4 w-4" />
   </button>
   </Tooltip>
   )}
   </div>
  </div>
  <div className="flex justify-between items-start mb-4">
   <div className={`p-3 rounded-2xl border shadow-sm transition-transform group-hover:scale-110 duration-300 ${getTypeStyles(asset.type).bg} ${getTypeStyles(asset.type).color} ${getTypeStyles(asset.type).border}`}>
   {React.createElement(getTypeStyles(asset.type).icon, { className: "h-6 w-6" })}
   </div>
   <div className="flex gap-2">
   <span className={`px-2 py-1 rounded-3xl text-[11px] font-bold uppercase tracking-wider border shadow-sm ${getCriticalityColor(asset.confidentiality)}`}>{asset.confidentiality}</span>
   </div>
  </div>
  <h3 className="text-lg font-bold text-foreground mb-1 leading-tight">{asset.name}</h3>
  <div className="flex items-center gap-2 mb-4">
   <span className={`text-[11px] font-bold px-2 py-0.5 rounded-3xl border shadow-sm ${getTypeStyles(asset.type).badge}`}>{asset.type}</span>
   <span className="text-muted-foreground/50">•</span>
   <div className="flex items-center gap-1.5">
   <img
   src={getUserAvatarUrl(users?.find(u => u.displayName === asset.owner || u.email === asset.owner)?.photoURL, users?.find(u => u.displayName === asset.owner || u.email === asset.owner)?.role)}
   alt={`${asset.owner} avatar`}
   className="w-4 h-4 rounded-full object-cover border border-border/40 bg-muted"
   onError={(e) => {
   const target = e.target as HTMLImageElement;
   target.src = getUserAvatarUrl(null, users?.find(u => u.displayName === asset.owner || u.email === asset.owner)?.role);
   }}
   role="presentation"
   />
   <span className="text-xs text-muted-foreground font-medium">{asset.owner}</span>
   </div>
  </div>

  <div className="mt-auto pt-4 border-t border-dashed border-border/40 flex justify-between items-center">
   <div className="flex items-center gap-2">
   <span className={`w-2 h-2 rounded-full ${asset.lifecycleStatus === 'En service' ? 'bg-success' : 'bg-muted'}`}></span>
   <span className="text-xs font-bold text-muted-foreground">
   {(() => {
   const val = asset.lifecycleStatus || 'Neuf';
   if (val === 'Neuf') return t('assets.status.new');
   if (val === 'En service') return t('assets.status.inService');
   return val;
   })()}
   </span>
   </div>
   {warrantyExpired && <span className="text-[11px] font-bold bg-error-bg text-error-text border border-error-border/50 px-2 py-1 rounded-3xl shadow-sm">{t('assets.warrantyExp')}</span>}
  </div>
  </div>
  </div>
  );
 })
 )}
 </div >
 );
});
