import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Risk, Asset, UserProfile, Control } from '../../../types';
import { ShieldAlert, Clock, Shield, CheckCircle, ShieldCheck, Share2, XCircle, FileText, AlertTriangle, CreditCard, Globe, User } from '../../ui/Icons';
import { Edit, Copy, Trash2 } from '../../ui/Icons';
import { Badge } from '../../ui/Badge';
import { DraftBadge } from '../../ui/DraftBadge';
import { RowActionsMenu, RowActionItem } from '../../ui/RowActionsMenu';
import { getRiskLevel, getSLAStatus, CONTROL_STATUS_WEIGHTS } from '../../../utils/riskUtils';
import { getUserAvatarUrl } from '../../../utils/avatarUtils';
import { RISK_DRAFT_STATUS } from '../../../utils/riskDraftSchema';
import { TextHighlight } from '../../ui/TextHighlight';

interface UseRiskColumnsProps {
 canEdit: boolean;
 assets: Asset[];
 users: UserProfile[];
 controls?: Control[];
 onEdit: (risk: Risk) => void;
 onDelete: (id: string, name: string) => void;
 onDuplicate?: (risk: Risk) => void;
 deletingIds: Set<string>;
 duplicatingIds?: Set<string>;
 searchQuery?: string;
}

/**
 * Calculate mitigation coverage for a risk based on linked controls
 */
function getMitigationCoverage(risk: Risk, controls: Control[]): { count: number; coverage: number } {
 const linkedIds = risk.mitigationControlIds || [];
 if (linkedIds.length === 0) return { count: 0, coverage: 0 };

 const linkedControls = linkedIds
 .map(id => controls.find(c => c.id === id))
 .filter((c): c is Control => c !== undefined);

 if (linkedControls.length === 0) return { count: linkedIds.length, coverage: 0 };

 const effectiveScore = linkedControls.reduce((sum, ctrl) => {
 return sum + (CONTROL_STATUS_WEIGHTS[ctrl.status] ?? 0);
 }, 0);

 const coverage = Math.min(Math.round((effectiveScore / linkedControls.length) * 100), 100);
 return { count: linkedControls.length, coverage };
}

const getStrategyStyles = (strategy: string) => {
 switch (strategy) {
 case 'Accepter':
 return {
 icon: CheckCircle,
 color: 'text-muted-foreground',
 bg: 'bg-muted',
 border: 'border-border/40',
 badge: 'bg-muted text-foreground border-border/40'
 };
 case 'Atténuer':
 return {
 icon: ShieldCheck,
 color: 'text-blue-700 dark:text-blue-400',
 bg: 'bg-blue-50 dark:bg-blue-900/20',
 border: 'border-blue-100 dark:border-blue-800',
 badge: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800'
 };
 case 'Transférer':
 return {
 icon: Share2,
 color: 'text-violet-600 dark:text-violet-400',
 bg: 'bg-violet-50 dark:bg-violet-900/20',
 border: 'border-violet-100 dark:border-violet-800/50',
 badge: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-100 dark:border-violet-800'
 };
 case 'Éviter':
 return {
 icon: XCircle,
 color: 'text-red-600 dark:text-red-400',
 bg: 'bg-red-50 dark:bg-red-900/20',
 border: 'border-red-100 dark:border-red-800',
 badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-100 dark:border-red-800'
 };
 default:
 return {
 icon: Shield,
 color: 'text-muted-foreground',
 bg: 'bg-muted',
 border: 'border-border/40',
 badge: 'bg-muted text-foreground border-border/40'
 };
 }
};

const getCategoryStyles = (category: string) => {
 const cat = category.toLowerCase();
 if (cat.includes('financier')) return { icon: CreditCard, color: 'text-success-text', bg: 'bg-success-bg' };
 if (cat.includes('opérationnel')) return { icon: AlertTriangle, color: 'text-warning-text', bg: 'bg-warning-bg' };
 if (cat.includes('juridique') || cat.includes('compliance')) return { icon: FileText, color: 'text-info-text', bg: 'bg-info-bg' };
 if (cat.includes('cyber') || cat.includes('sécurité')) return { icon: Shield, color: 'text-violet-600', bg: 'bg-violet-50' };
 if (cat.includes('réputation')) return { icon: Globe, color: 'text-violet-600', bg: 'bg-violet-50' };
 return { icon: ShieldAlert, color: 'text-muted-foreground', bg: 'bg-muted/50' };
};

import { useTranslation } from 'react-i18next';

export const useRiskColumns = ({
 canEdit,
 assets,
 users,
 controls = [],
 onEdit,
 onDelete,
 onDuplicate,
 deletingIds,
 duplicatingIds = new Set(),
 searchQuery = '',
}: UseRiskColumnsProps): ColumnDef<Risk>[] => {
 const { t } = useTranslation();

 const getOwnerName = React.useCallback((ownerId?: string) => {
 if (!ownerId) return t('common.unknown'); // Was 'Non assigné'
 const user = users.find(u => u.uid === ownerId);
 return user ? (user.displayName || user.email) : ownerId;
 }, [users, t]);

 return React.useMemo(() => [
 {
 header: t('common.threat'),
 accessorKey: 'threat',
 meta: { className: 'w-full md:w-auto' },
 cell: ({ row }) => {
 const ownerUser = users.find(u => u.uid === row.original.owner);
 return (
  <div className="flex items-center">
  <div className="w-10 h-10 rounded-3xl bg-muted border border-border/40 flex items-center justify-center mr-4 text-muted-foreground overflow-hidden shrink-0">
  {ownerUser ? (
  <div className="relative">
   <img
   src={getUserAvatarUrl(ownerUser.photoURL, ownerUser.role)}
   alt={getOwnerName(row.original.owner)}
   className="w-full h-full object-cover"
   />
  </div>
  ) : (
  <div className="w-full h-full flex items-center justify-center">
   <User className="w-5 h-5 text-muted-foreground" />
  </div>
  )}
  </div>
  <div className="min-w-0">
  <div className="font-bold text-foreground text-base truncate max-w-[200px] sm:max-w-xs transition-all">
  <TextHighlight text={row.original.threat} query={searchQuery} />
  </div>
  <div className="text-sm text-foreground">{getOwnerName(row.original.owner)}</div>
  </div>
  </div>
 );
 },
 },
 {
 header: t('common.vulnerability'),
 accessorKey: 'vulnerability',
 meta: { className: 'hidden lg:table-cell' },
 cell: ({ row }) => (
 <div className="max-w-xs truncate" title={row.original.vulnerability}>
  <TextHighlight text={row.original.vulnerability || ''} query={searchQuery} />
 </div>
 ),
 },
 {
 header: t('common.assets'),
 accessorFn: (row) => assets.find(a => a.id === row.assetId)?.name || 'Actif inconnu',
 meta: { className: 'hidden xl:table-cell' },
 cell: ({ row }) => (
 <span className="text-muted-foreground font-medium">
  {assets.find(a => a.id === row.original.assetId)?.name || 'Actif inconnu'}
 </span>
 ),
 },
 {
 header: t('common.category'),
 accessorKey: 'category',
 meta: { className: 'hidden xl:table-cell' },
 cell: ({ row }) => {
 const category = row.original.category;
 if (!category) {
  return <span className="text-xs text-muted-foreground italic">Non définie</span>;
 }
 const styles = getCategoryStyles(category);
 const CategoryIcon = styles.icon;
 return (
  <div className="flex items-center gap-2">
  <div className={`p-1 rounded-md ${styles.bg} ${styles.color} dark:bg-white/5`}>
  <CategoryIcon className="h-3 w-3" />
  </div>
  <span className="text-muted-foreground font-medium whitespace-nowrap">
  {category}
  </span>
  </div>
 );
 },
 },
 {
 header: t('dashboard.score'),
 accessorKey: 'score',
 cell: ({ row }) => (
 <Badge status={getRiskLevel(row.original.score).status} variant="soft" size="sm">
  {row.original.score}
 </Badge>
 ),
 },
 {
 header: t('dashboard.strategy'),
 accessorKey: 'strategy',
 meta: { className: 'hidden lg:table-cell' },
 cell: ({ row }) => {
 const styles = getStrategyStyles(row.original.strategy);
 const StrategyIcon = styles.icon;
 return (
  <div className="flex items-center gap-2">
  <div className={`p-1.5 rounded-lg ${styles.bg} ${styles.color} border ${styles.border}`}>
  <StrategyIcon className="h-3.5 w-3.5" />
  </div>
  <span className={`px-2 py-0.5 rounded-md text-xs font-bold border shadow-sm ${styles.badge}`}>
  {row.original.strategy}
  </span>
  </div>
 );
 },
 },
 {
 header: t('common.stepControls'),
 id: 'controls',
 accessorFn: (row) => row.mitigationControlIds?.length || 0,
 meta: { className: 'hidden lg:table-cell' },
 cell: ({ row }) => {
 const { count, coverage } = getMitigationCoverage(row.original, controls);
 if (count === 0) {
  return (
  <span className="text-xs text-muted-foreground italic">Aucun</span>
  );
 }
 return (
  <div className="flex items-center gap-2">
  <div className="flex items-center gap-1">
  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
  <span className="text-sm font-medium text-foreground text-muted-foreground">{count}</span>
  </div>
  <div className="flex items-center gap-1" title={`Couverture: ${coverage}%`}>
  <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
  <div
   className={`h-full rounded-full transition-all duration-500 ${coverage >= 80 ? 'bg-success-text' :
   coverage >= 50 ? 'bg-warning-text' : 'bg-error-text'
   }`}
   style={{ width: `${coverage}%` }}
  />
  </div>
  </div>
  </div>
 );
 },
 },
 {
 header: t('common.status'),
 accessorKey: 'status',
 meta: { className: 'hidden md:table-cell' },
 cell: ({ row }) => {
 const isDraft = row.original.status === RISK_DRAFT_STATUS;
 return (
  <div className="flex flex-col items-start gap-1">
  {isDraft ? (
  <DraftBadge showIcon size="sm" />
  ) : (
  <Badge status={row.original.status === 'Ouvert' ? 'error' : row.original.status === 'En cours' ? 'warning' : row.original.status === 'En attente de validation' ? 'info' : 'success'} variant="outline">
  {row.original.status}
  </Badge>
  )}

  {(() => {
  const sla = getSLAStatus(row.original);
  if (sla) return (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold mt-1 ${sla.color}`}>
   <Clock className="h-3 w-3 mr-1" /> {sla.label}
  </span>
  );
  return null;
  })()}
  </div>
 );
 },
 },
 {
 id: 'actions',
 header: '',
 cell: ({ row }) => {
 if (!canEdit) return null;

 const isDeleting = deletingIds.has(row.original.id);
 const isDuplicating = duplicatingIds.has(row.original.id);

 const menuItems: RowActionItem[] = [
  {
  label: 'Modifier',
  icon: Edit,
  onClick: () => onEdit(row.original),
  },
  ...(onDuplicate ? [{
  label: 'Dupliquer',
  icon: Copy,
  onClick: () => onDuplicate(row.original),
  disabled: isDuplicating,
  }] : []),
  {
  label: 'Supprimer',
  icon: Trash2,
  onClick: () => onDelete(row.original.id, row.original.threat),
  variant: 'danger' as const,
  disabled: isDeleting,
  },
 ];

 return (
  <div className="flex justify-end">
  <RowActionsMenu
  items={menuItems}
  aria-label={`Actions pour ${row.original.threat}`}
  />
  </div>
 );
 },
 },
 ], [canEdit, assets, controls, onEdit, onDelete, onDuplicate, deletingIds, duplicatingIds, getOwnerName, users, searchQuery, t]);
};
