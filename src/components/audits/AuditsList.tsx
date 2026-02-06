import React, { useMemo } from 'react';
import { DataTable } from '../ui/DataTable';
import { Audit, UserProfile } from '../../types';
import { ColumnDef, Row, Table } from '@tanstack/react-table';
import { CalendarDays, ClipboardCheck, AlertOctagon, UserCheck, Globe, Award, Truck, Shield } from '../ui/Icons';
import { Edit, Trash2, Copy } from '../ui/Icons';
import { RowActionsMenu, RowActionItem } from '../ui/RowActionsMenu';
import { EmptyState } from '../ui/EmptyState';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { useStore } from '../../store';

interface AuditsListProps {
 audits: Audit[];
 isLoading: boolean;
 onEdit: (audit: Audit) => void;
 onDelete: (audit: Audit) => void;
 onDuplicate?: (audit: Audit) => void;
 onOpen: (audit: Audit) => void;
 canEdit: boolean;
 canDelete: boolean;
 selectedIds?: string[];
 onSelect?: (ids: string[]) => void;
 users?: UserProfile[];
 duplicatingIds?: Set<string>;
}

// Helper function moved outside component to be stable
const getStatusColor = (s: string) => {
 switch (s) {
 case 'Planifié': return 'bg-info-bg text-info-text border-info-border';
 case 'En cours': return 'bg-warning-bg text-warning-text border-warning-border';
 case 'Terminé': return 'bg-success-bg text-success-text border-success-border';
 case 'Validé': return 'bg-primary/10 text-primary dark:bg-primary dark:text-primary/70 border-primary/30 dark:border-primary/90';
 case 'Annulé': return 'bg-muted text-foreground border-border/40';
 default: return 'bg-muted text-foreground border-border/40';
 }
};

const getAuditTypeStyles = (type: string) => {
 switch (type) {
 case 'Interne':
 return { icon: UserCheck, color: 'text-primary', bg: 'bg-primary/10 dark:bg-primary', border: 'border-primary/20 dark:border-primary/80' };
 case 'Externe':
 return { icon: Globe, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-500/20', border: 'border-violet-200 dark:border-violet-500/30' };
 case 'Certification':
 return { icon: Award, color: 'text-warning-text', bg: 'bg-warning-bg', border: 'border-warning-border' };
 case 'Fournisseur':
 return { icon: Truck, color: 'text-success-text', bg: 'bg-success-bg', border: 'border-success-border' };
 default:
 return { icon: Shield, color: 'text-muted-foreground', bg: 'bg-muted/50 dark:bg-white/5', border: 'border-border/40' };
 }
};

export const AuditsList: React.FC<AuditsListProps> = ({
 audits, isLoading, onEdit, onDelete, onDuplicate, onOpen, canEdit, canDelete, selectedIds = [], onSelect, users, duplicatingIds = new Set(),
}) => {
 const { t } = useStore();

 const columns = useMemo<ColumnDef<Audit>[]>(() => [
 ...(canDelete ? [{
 id: 'select',
 header: ({ table }: { table: Table<Audit> }) => {
 const isAllSelected = table.getIsAllPageRowsSelected();
 const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
  const allIds = audits.map(a => a.id);
  onSelect?.(e.target.checked ? allIds : []);
 };
 return (
  <div className="px-1">
  <input checked={isAllSelected} onChange={handleSelectAll}
  type="checkbox" disabled={!onSelect} aria-label="Tout sélectionner"
  className="rounded border-border/40 text-primary focus-visible:ring-primary" />
  </div>
 );
 },
 cell: ({ row }: { row: Row<Audit> }) => {
 const isSelected = selectedIds.includes(row.original.id);
 const handleSelectRow = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.checked) {
  onSelect?.([...selectedIds, row.original.id]);
  } else {
  onSelect?.(selectedIds.filter(id => id !== row.original.id));
  }
 };
 return (
  <div className="px-1">
  <input checked={isSelected} onChange={handleSelectRow}
  type="checkbox" disabled={!onSelect} aria-label={`Sélectionner l'audit ${row.original.name}`}
  className="rounded border-border/40 text-primary focus-visible:ring-primary" />
  </div>
 );
 },
 enableSorting: false,
 enableHiding: false,
 }] : []),
 {
 accessorKey: 'name',
 header: t('audits.list.columns.audit', { defaultValue: 'Audit' }),
 cell: ({ row }) => {
 const styles = getAuditTypeStyles(row.original.type);
 const TypeIcon = styles.icon;
 return (
  <div className="flex items-center gap-3">
  <div className={`p-1.5 rounded-lg border shadow-sm ${styles.bg} ${styles.color} ${styles.border}`}>
  <TypeIcon className="h-4 w-4" />
  </div>
  <div className="flex flex-col">
  <button type="button" className="text-left font-bold text-foreground hover:text-primary dark:hover:text-primary/70 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded" onClick={() => onOpen(row.original)} aria-label={`Ouvrir l'audit ${row.original.name}`}>
  {row.original.name}
  </button>
  <span className={`text-xs font-bold uppercase tracking-wider ${styles.color}`}>{row.original.type}</span>
  </div>
  </div>
 );
 }
 },
 {
 accessorKey: 'dateScheduled',
 header: t('audits.list.columns.date', { defaultValue: 'Date' }),
 cell: ({ row }) => (
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
  <CalendarDays className="w-4 h-4 text-muted-foreground" />
  <span>{row.original.dateScheduled ? new Date(row.original.dateScheduled).toLocaleDateString() : 'TBD'}</span>
 </div>
 )
 },
 {
 accessorKey: 'auditor',
 header: t('audits.list.columns.auditor', { defaultValue: 'Auditeur' }),
 cell: ({ row }) => {
 const auditorName = row.original.auditor;
 if (!auditorName) return <span className="text-muted-foreground italic">{t('common.unassigned', { defaultValue: 'Non assigné' })}</span>;

 const auditorUser = users?.find(u => u.displayName === auditorName || u.email === auditorName);

 return (
  <div className="flex items-center gap-2">
  <img
  src={getUserAvatarUrl(auditorUser?.photoURL, auditorUser?.role)}
  alt={t('audits.list.auditorAvatar', { defaultValue: 'Avatar de l\'auditeur', name: auditorName })}
  className="w-6 h-6 rounded-full border border-border/40 object-cover bg-muted"
  />
  <span className="text-sm text-foreground text-muted-foreground">{auditorName}</span>
  </div>
 );
 }
 },
 {
 accessorKey: 'status',
 header: t('audits.list.columns.status', { defaultValue: 'Statut' }),
 cell: ({ row }) => (
 <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(row.original.status)}`}>
  {row.original.status}
 </span>
 )
 },
 {
 accessorKey: 'findingsCount',
 header: t('audits.list.columns.findings', { defaultValue: 'Écarts' }),
 cell: ({ row }) => {
 const count = (row.original.findings || []).filter((f: { status: string }) => f.status === 'Ouvert').length;
 return (
  <div className={`flex items-center gap-1.5 ${count > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
  <AlertOctagon className="w-4 h-4" />
  <span>{count}</span>
  </div>
 );
 }
 },
 {
 id: 'actions',
 cell: ({ row }) => {
 const isDuplicating = duplicatingIds.has(row.original.id);
 const menuItems: RowActionItem[] = [
  {
  label: 'Ouvrir',
  icon: ClipboardCheck,
  onClick: () => onOpen(row.original),
  },
  ...(canEdit ? [{
  label: 'Modifier',
  icon: Edit,
  onClick: () => onEdit(row.original),
  }] : []),
  ...(onDuplicate && canEdit ? [{
  label: 'Dupliquer',
  icon: Copy,
  onClick: () => onDuplicate(row.original),
  disabled: isDuplicating,
  }] : []),
  ...(canDelete ? [{
  label: 'Supprimer',
  icon: Trash2,
  onClick: () => onDelete(row.original),
  variant: 'danger' as const,
  }] : []),
 ];

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
 ], [canEdit, canDelete, onEdit, onDelete, onDuplicate, onOpen, onSelect, selectedIds, audits, users, duplicatingIds, t]);

 return (
 <DataTable
 columns={columns}
 data={audits}
 loading={isLoading}
 emptyState={
 <EmptyState
  icon={ClipboardCheck}
  title={t('audits.list.emptyTitle', { defaultValue: 'Aucun audit trouvé' })}
  description={t('audits.list.emptyDescription', { defaultValue: 'Aucun audit ne correspond à vos critères.' })}
 // No action button here as creation is usually in the page header
 />
 }
 />
 );
};
