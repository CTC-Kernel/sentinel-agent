import React, { useMemo, useCallback } from 'react';
import { PremiumCard } from '../ui/PremiumCard';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { Trash2, CalendarDays, Siren, ShieldAlert, Lock, Mail, HardDrive, WifiOff, Database } from '../ui/Icons';
import { Incident, Criticality, UserProfile } from '../../types';
import { useStore } from '../../store';
import { EmptyState } from '../ui/EmptyState';
import { CardSkeleton } from '../ui/Skeleton';
import { hasPermission } from '../../utils/permissions';
import { DataTable } from '../ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { IncidentSummaryCard } from './dashboard/IncidentSummaryCard';
import { IncidentCharts } from './dashboard/IncidentCharts';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { NIS2DeadlineTimer } from './NIS2DeadlineTimer';

interface IncidentDashboardProps {
 incidents: Incident[];
 onCreate: () => void;
 onSelect: (incident: Incident) => void;
 loading?: boolean;
 onDelete?: (id: string) => void;
 onBulkDelete?: (ids: string[]) => void;
 viewMode: 'list' | 'grid';
 filter: string;
 users?: UserProfile[];
}

const getSeverityColor = (s: Criticality) => {
 switch (s) {
 case Criticality.CRITICAL: return 'bg-destructive/10 text-destructive border-destructive/20 shadow-sm';
 case Criticality.HIGH: return 'bg-warning/15 text-warning border-warning/30 shadow-sm';
 case Criticality.MEDIUM: return 'bg-warning/10 text-warning border-warning/20 shadow-sm opacity-80';
 default: return 'bg-info/10 text-info border-info/20 shadow-sm opacity-80';
 }
};

const getStatusColor = (s: string) => {
 switch (s) {
 case 'Nouveau': return 'text-primary bg-primary/10 border-primary/20';
 case 'Analyse': return 'text-info bg-info/10 border-info/20';
 case 'Contenu': return 'text-warning bg-warning/10 border-warning/20';
 case 'Résolu': return 'text-success bg-success/10 border-success/20';
 case 'Fermé': return 'text-muted-foreground bg-muted/20 border-border/40 line-through opacity-70';
 default: return 'text-muted-foreground bg-muted/10 border-border/40';
 }
};

const getIncidentCategoryStyles = (category: string) => {
 switch (category) {
 case 'Ransomware':
 return { icon: Lock, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' };
 case 'Phishing':
 return { icon: Mail, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' };
 case 'Vol Matériel':
 return { icon: HardDrive, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' };
 case 'Indisponibilité':
 return { icon: WifiOff, color: 'text-info', bg: 'bg-info/10', border: 'border-info/20' };
 case 'Fuite de Données':
 return { icon: Database, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' };
 default:
 return { icon: ShieldAlert, color: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-border/40' };
 }
};

export const IncidentDashboard: React.FC<IncidentDashboardProps> = ({ incidents, onCreate, onSelect, loading = false, onDelete, onBulkDelete, viewMode, filter, users }) => {
 const { user, t } = useStore();
 const canDelete = !!user && hasPermission(user, 'Incident', 'delete');

 const filteredIncidents = useMemo(() => {
 if (!filter) return incidents;
 return incidents.filter(inc =>
 inc.title.toLowerCase().includes(filter.toLowerCase()) ||
 inc.description.toLowerCase().includes(filter.toLowerCase()) ||
 inc.category?.toLowerCase().includes(filter.toLowerCase())
 );
 }, [incidents, filter]);

 // Memoized category data for pie chart
 const categoryData = useMemo(() => {
 const data = incidents.reduce((acc, inc) => {
 const cat = inc.category || t('incidents.uncategorized');
 acc[cat] = (acc[cat] || 0) + 1;
 return acc;
 }, {} as Record<string, number>);
 return Object.entries(data).map(([name, value]) => ({ name, value }));
 }, [incidents, t]);

 // Memoized timeline data for bar chart
 const timelineData = useMemo(() => {
 const months = new Array(6).fill(0).map((_, i) => {
 const d = new Date();
 d.setMonth(d.getMonth() - 5 + i);
 return {
 name: d.toLocaleString('default', { month: 'short' }),
 date: d,
 count: 0
 };
 });

 incidents.forEach(inc => {
 const d = new Date(inc.dateReported);
 const monthIndex = months.findIndex(m =>
 m.date.getMonth() === d.getMonth() &&
 m.date.getFullYear() === d.getFullYear()
 );
 if (monthIndex !== -1) months[monthIndex].count++;
 });
 return months.every(m => m.count === 0) ? [] : months;
 }, [incidents]);

 // Helper for localizing status/severity labels - wrapped in useCallback for memoization stability
 const getStatusLabel = useCallback((s: string) => {
 switch (s) {
 case 'Nouveau': return t('incidents.status.new');
 case 'Analyse': return t('incidents.status.analysis');
 case 'Contenu': return t('incidents.status.containment');
 case 'Résolu': return t('incidents.status.resolved');
 case 'Fermé': return t('incidents.status.closed');
 default: return s;
 }
 }, [t]);

 const getSeverityLabel = useCallback((s: Criticality) => {
 switch (s) {
 case Criticality.CRITICAL: return t('incidents.severity.critical');
 case Criticality.HIGH: return t('incidents.severity.high');
 case Criticality.MEDIUM: return t('incidents.severity.medium');
 case Criticality.LOW: return t('incidents.severity.low');
 default: return s;
 }
 }, [t]);

 // Metrics for Summary Card
 const columns = useMemo<ColumnDef<Incident>[]>(() => [
 {
 accessorKey: 'title',
 header: t('incidents.column.incident'),
 cell: ({ row }) => {
 const styles = getIncidentCategoryStyles(row.original.category || '');
 const CategoryIcon = styles.icon;
 return (
  <div className="flex items-center gap-3">
  <div className={`p-1.5 rounded-xl border shadow-sm ${styles.bg} ${styles.color} ${styles.border}`}>
  <CategoryIcon className="h-4 w-4" />
  </div>
  <div>
  <div className="font-bold text-foreground text-base">{row.original.title}</div>
  <div className="text-xs text-muted-foreground font-medium line-clamp-1">{row.original.description}</div>
  </div>
  </div>
 );
 }
 },
 {
 accessorKey: 'severity',
 header: t('incidents.column.severity'),
 meta: { className: 'hidden sm:table-cell' },
 cell: ({ row }) => (
 <span className={`px-2 py-0.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-normal ease-apple ${getSeverityColor(row.original.severity)}`}>
  {getSeverityLabel(row.original.severity)}
 </span>
 )
 },
 {
 accessorKey: 'status',
 header: t('incidents.column.status'),
 meta: { className: 'hidden md:table-cell' },
 cell: ({ row }) => (
 <span className={`px-2 py-0.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-normal ease-apple ${getStatusColor(row.original.status)}`}>
  {getStatusLabel(row.original.status)}
 </span>
 )
 },
 {
 accessorKey: 'dateReported',
 header: t('incidents.column.date'),
 meta: { className: 'hidden lg:table-cell' },
 cell: ({ row }) => (
 <span className="text-muted-foreground font-medium">
  {new Date(row.original.dateReported).toLocaleDateString('fr-FR')}
 </span>
 )
 },
 {
 accessorKey: 'reporter',
 header: t('incidents.column.reporter'),
 meta: { className: 'hidden xl:table-cell' },
 cell: ({ row }) => {
 const reporterName = row.original.reporter;
 const reporterUser = users?.find(u => u.displayName === reporterName || u.email === reporterName);
 return (
  <div className="flex items-center gap-2">
  <div className="relative">
  <img alt={reporterName}
  src={getUserAvatarUrl(reporterUser?.photoURL, reporterUser?.role)}
  className="w-6 h-6 rounded-full border border-border/40 object-cover bg-muted/20"
  />
  </div>
  <span className="text-muted-foreground font-medium">
  {reporterName}
  </span>
  </div>
 );
 }
 },
 {
 accessorKey: 'category',
 header: t('incidents.column.category'),
 meta: { className: 'hidden md:table-cell' },
 cell: ({ row }) => (
 <span className="text-muted-foreground font-medium">
  {row.original.category || '-'}
 </span>
 )
 },
 {
 id: 'actions',
 cell: ({ row }) => (
 <div className="text-right flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()} role="presentation">
  {canDelete && onDelete && (
  <CustomTooltip content={t('common.delete')}>
  <button
  onClick={(e) => {
   e.stopPropagation();
   onDelete(row.original.id);
  }}
  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-normal ease-apple opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
  >
  <Trash2 className="h-4 w-4" />
  </button>
  </CustomTooltip>
  )}
 </div>
 )
 }
 ], [canDelete, onDelete, users, t, getSeverityLabel, getStatusLabel]);

 const totalIncidents = incidents.length;
 const openIncidents = incidents.filter(i => i.status !== 'Fermé').length;
 const criticalIncidents = incidents.filter(i => i.severity === Criticality.CRITICAL && (i.status !== 'Résolu' && i.status !== 'Fermé')).length;
 const resolutionRate = totalIncidents > 0
 ? Math.round(((totalIncidents - openIncidents) / totalIncidents) * 100)
 : 0;

 return (
 <div className="space-y-8 animate-fade-in pb-10">
 {/* Summary Card */}
 <IncidentSummaryCard
 resolutionRate={resolutionRate}
 totalIncidents={totalIncidents}
 openIncidents={openIncidents}
 criticalIncidents={criticalIncidents}
 />

 {/* Graphs Section (Added for "Overview" request) */}
 <IncidentCharts
 categoryData={categoryData}
 timelineData={timelineData}
 />

 {/* Incident list */}
 {viewMode === 'list' ? (
 <div className="bg-[var(--glass-bg)] backdrop-blur-xl w-full max-w-full rounded-xl shadow-premium border border-border/40">
  <DataTable
  columns={columns}
  data={filteredIncidents}
  selectable={true}
  onBulkDelete={onBulkDelete}
  onRowClick={onSelect} // onSelect handles navigation or drawer opening
  searchable={false}
  loading={loading}
  />
 </div>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {loading ? (
  <div className="col-span-full"><CardSkeleton count={4} /></div>
  ) : filteredIncidents.length === 0 ? (
  <div className="col-span-full">
  <EmptyState
  icon={Siren}
  title={t('incidents.empty.title')}
  description={filter ? t('incidents.empty.noResults') : t('incidents.empty.desc')}
  actionLabel={filter || !hasPermission(user, 'Incident', 'create') ? undefined : t('incidents.declare')}
  onAction={filter || !hasPermission(user, 'Incident', 'create') ? undefined : onCreate}
  />
  </div>
  ) : (
  filteredIncidents.map((inc) => (
  <PremiumCard glass
  key={inc.id || 'unknown'}
  onClick={() => onSelect(inc)}
  onKeyDown={(e) => {
   if (e.key === 'Enter' || e.key === ' ') {
   e.preventDefault();
   onSelect(inc);
   }
  }}
  role="button"
  tabIndex={0}
  hover={true}
  className="p-7 flex flex-col relative group border border-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background rounded-xl transition-all duration-normal ease-apple"
  >
  {inc.severity === Criticality.CRITICAL && (
   <div className="absolute top-6 right-6 z-decorator">
   <span className="relative flex h-3.5 w-3.5">
   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
   <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-destructive shadow-sm border-2 border-white dark:border-background"></span>
   </span>
   </div>
  )}
  <div className="flex justify-between items-start mb-4">
   <div className="flex gap-2">
   <div className={`p-2 rounded-xl border shadow-premium ${getIncidentCategoryStyles(inc.category || '').bg} ${getIncidentCategoryStyles(inc.category || '').color} ${getIncidentCategoryStyles(inc.category || '').border}`}>
   {React.createElement(getIncidentCategoryStyles(inc.category || '').icon, { className: "h-5 w-5" })}
   </div>
   <div className="flex flex-col gap-1">
   <div className="flex gap-2">
   <span className={`px-2 py-0.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-normal ease-apple ${getSeverityColor(inc.severity)}`}>
    {getSeverityLabel(inc.severity)}
   </span>
   <span className={`px-2 py-0.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-normal ease-apple ${getStatusColor(inc.status)}`}>
    {getStatusLabel(inc.status)}
   </span>
   </div>
   {inc.isSignificant && (
   <div className="mt-1">
    <NIS2DeadlineTimer incident={inc} compact={true} />
   </div>
   )}
   </div>
   </div>
   {canDelete && onDelete && (
   <CustomTooltip content={t('common.delete')}>
   <button
   onClick={(e) => {
    e.stopPropagation();
    onDelete(inc.id);
   }}
   className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-error-bg rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
   >
   <Trash2 className="h-4 w-4" />
   </button>
   </CustomTooltip>
   )}
  </div>
  <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors duration-normal ease-apple leading-tight">
   {inc.title}
  </h3>
  <p className="text-sm text-muted-foreground mb-6 line-clamp-2 leading-relaxed">
   {inc.description}
  </p>
  <div className="flex items-center justify-between pt-5 border-t border-dashed border-border/40 mt-auto">
   <div className="flex items-center text-xs font-medium text-muted-foreground">
   <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
   <span>{new Date(inc.dateReported).toLocaleDateString('fr-FR')}</span>
   <span className="mx-2">•</span>
   <div className="flex items-center gap-1.5">
   <div className="relative">
   <img alt={inc.reporter}
    src={getUserAvatarUrl(users?.find(u => u.displayName === inc.reporter || u.email === inc.reporter)?.photoURL, users?.find(u => u.displayName === inc.reporter || u.email === inc.reporter)?.role)}
    className="w-4 h-4 rounded-full object-cover bg-muted/20"
   />
   </div>
   <span>{inc.reporter}</span>
   </div>
   </div>
   <div className="flex items-center gap-2">
   {inc.category && (
   <button
   onClick={(e) => {
    e.stopPropagation();
    onSelect(inc);
   }}
   className="text-xs px-2 py-1 bg-primary text-white rounded-lg hover:bg-primary/90 hover:scale-[1.05] transition-all duration-normal ease-apple font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
   >
   {t('incidents.playbook')}
   </button>
   )}
   <div className="text-xs text-primary font-bold flex items-center group-hover:translate-x-1 transition-transform duration-normal ease-apple">
   {t('incidents.open')} <ShieldAlert className="ml-1.5 h-3.5 w-3.5" />
   </div>
   </div>
  </div>
  </PremiumCard>
  ))
  )}
 </div>
 )}
 </div>
 );
};
