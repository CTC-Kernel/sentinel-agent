import React, { useState, useMemo } from 'react';
import { useStore } from '../../store';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { motion } from 'framer-motion';
import { staggerContainerVariants } from '../ui/animationVariants';
import { MasterpieceBackground } from '../ui/MasterpieceBackground';
import { PageHeader } from '../ui/PageHeader';
import { SEO } from '../SEO';
import {
 History,
 User,
 Calendar,
 Filter,
 Search,
 Download,
 Eye,
 ChevronRight,
 AlertCircle
} from '../ui/Icons';
import { useAuditLogs, type AuditLog } from '../../hooks/audit/useAuditLogs';
import { useLocale } from '@/hooks/useLocale';

export const AuditTrailViewer: React.FC = () => {
 const { user } = useStore();
 const { config } = useLocale();
 const { logs, loading } = useAuditLogs(user?.organizationId);
 const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
 const [filters, setFilters] = useState({
 action: 'all' as 'all' | 'create' | 'update' | 'delete',
 entityType: 'all',
 userId: 'all',
 searchQuery: ''
 });
 const [dateRange, setDateRange] = useState(() => ({
 start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
 end: new Date()
 }));

 // Filter logs
 const filteredLogs = useMemo(() => {
 return logs.filter(log => {
 // Action filter
 if (filters.action !== 'all' && log.action !== filters.action) return false;

 // Entity type filter
 if (filters.entityType !== 'all' && log.entityType !== filters.entityType) return false;

 // User filter
 if (filters.userId !== 'all' && log.userId !== filters.userId) return false;

 // Search query
 if (filters.searchQuery) {
 const query = filters.searchQuery.toLowerCase();
 const searchableText = `${log.entityType} ${log.action} ${log.userName}`.toLowerCase();
 if (!searchableText.includes(query)) return false;
 }

 // Date range
 if (log.timestamp < dateRange.start || log.timestamp > dateRange.end) return false;

 return true;
 });
 }, [logs, filters, dateRange]);

 // Get unique entity types and users
 const entityTypes = useMemo(() => {
 return Array.from(new Set(logs.map(log => log.entityType)));
 }, [logs]);

 const users = useMemo(() => {
 return Array.from(new Set(logs.map(log => ({ id: log.userId, name: log.userName }))));
 }, [logs]);

 const getActionColor = (action: string) => {
 switch (action) {
 case 'create': return 'bg-green-100 text-green-700 dark:text-green-400 dark:bg-green-900/20 dark:text-green-400';
 case 'update': return 'bg-blue-100 text-blue-700 dark:text-blue-400/20 dark:text-blue-400';
 case 'delete': return 'bg-red-100 text-red-700 dark:text-red-400 dark:bg-red-900/20 dark:text-red-400';
 default: return 'bg-muted text-foreground ';
 }
 };

 const getActionIcon = (action: string) => {
 switch (action) {
 case 'create': return '➕';
 case 'update': return '✏️';
 case 'delete': return '🗑️';
 default: return '📝';
 }
 };

 const handleExport = () => {
 const csv = [
 ['Date', 'Action', 'Type', 'Utilisateur', 'Modifications'].join(','),
 ...filteredLogs.map(log => [
 log.timestamp.toISOString(),
 log.action,
 log.entityType,
 log.userName,
 (log.changes || []).join('; ')
 ].join(','))
 ].join('\n');

 const blob = new Blob([csv], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
 </div>
 );
 }

 return (
 <motion.div
 variants={staggerContainerVariants}
 initial="initial"
 animate="visible"
 className="space-y-6 sm:space-y-8"
 >
 <MasterpieceBackground />
 <SEO title="Journal d'Audit" />

 <PageHeader
 title="Journal d'Audit"
 subtitle="Traçabilité complète et immuable de toutes les activités système."
 icon={<History className="h-6 w-6 text-white" />}
 breadcrumbs={[
  { label: 'Système' },
  { label: 'Journal d\'Audit' }
 ]}
 actions={
  <button
  type="button"
  onClick={handleExport}
  className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-3xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
  aria-label="Exporter les logs d'audit en CSV"
  >
  <Download className="h-4 w-4" />
  Exporter CSV
  </button>
 }
 />

 {/* Filters */}
 <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-border/40 shadow-sm">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  {/* Search */}
  <div className="relative flex-1 md:min-w-[300px]">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
  <input
  value={filters.searchQuery}
  aria-label="Rechercher dans l'audit trail"
  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
  placeholder="Rechercher (Utilisateur, Action, Ressource...)"
  className="w-full pl-10 pr-4 py-2 bg-muted border border-border/40 rounded-3xl text-sm focus:ring-2 focus-visible:ring-primary outline-none"
  />
  </div>

  {/* Action filter */}
  <select
  value={filters.action}
  onChange={(e) => setFilters({ ...filters, action: e.target.value as 'all' | 'create' | 'update' | 'delete' })}
  className="px-4 py-2 bg-background border border-border rounded-3xl text-sm focus:ring-2 focus-visible:ring-primary focus:border-transparent"
  aria-label="Filtrer par action"
  >
  <option value="all">Toutes les actions</option>
  <option value="create">Création</option>
  <option value="update">Modification</option>
  <option value="delete">Suppression</option>
  </select>

  {/* Entity type filter */}
  <select
  value={filters.entityType}
  onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
  className="px-4 py-2 bg-background border border-border rounded-3xl text-sm focus:ring-2 focus-visible:ring-primary focus:border-transparent"
  aria-label="Filtrer par type d'entité"
  >
  <option value="all">Tous les types</option>
  {entityTypes.map(type => (
  <option key={type || 'unknown'} value={type}>{type}</option>
  ))}
  </select>

  {/* User filter */}
  <select
  value={filters.userId}
  onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
  className="px-4 py-2 bg-background border border-border rounded-3xl text-sm focus:ring-2 focus-visible:ring-primary focus:border-transparent"
  aria-label="Filtrer par utilisateur"
  >
  <option value="all">Tous les utilisateurs</option>
  {users.map(u => (
  <option key={u.id || 'unknown'} value={u.id}>{u.name}</option>
  ))}
  </select>
 </div>

 {/* Date Range Filter */}
 <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
  <div className="relative">
  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <input
  aria-label="Date de début"
  value={dateRange.start.toISOString().split('T')[0]}
  onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
  type="date"
  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-3xl text-sm focus:ring-2 focus-visible:ring-primary focus:border-transparent"
  />
  </div>
  <div className="relative">
  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <input
  aria-label="Date de fin"
  value={dateRange.end.toISOString().split('T')[0]}
  onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
  type="date"
  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-3xl text-sm focus:ring-2 focus-visible:ring-primary focus:border-transparent"
  />
  </div>
 </div>

 <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
  <Filter className="h-4 w-4" />
  <span>{filteredLogs.length} événement(s) trouvé(s)</span>
 </div>
 </div>

 {/* Logs List */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Left: List */}
 <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
  {filteredLogs.length === 0 ? (
  <div className="text-center py-12 text-muted-foreground">
  <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
  <p>Aucun événement trouvé</p>
  </div>
  ) : (
  filteredLogs.map(log => (
  <button
  type="button"
  key={log.id || 'unknown'}
  onClick={() => setSelectedLog(log)}
  className={`w-full text-left p-4 rounded-3xl border transition-all ${selectedLog?.id === log.id
   ? 'bg-primary/10 dark:bg-primary border-primary/30 dark:border-primary/90'
   : 'bg-card border-border hover:border-primary/30 dark:hover:border-primary/90'
   }`}
  aria-label={`Voir les détails du log ${log.action} sur ${log.entityType} par ${log.userName}`}
  >
  <div className="flex items-start justify-between mb-2">
   <div className="flex items-center gap-2">
   <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getActionColor(log.action)}`}>
   {getActionIcon(log.action)} {log.action.toUpperCase()}
   </span>
   <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
   {log.entityType}
   </span>
   </div>
   <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${selectedLog?.id === log.id ? 'rotate-90' : ''}`} />
  </div>

  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
   <User className="h-3 w-3" />
   <span>{log.userName}</span>
  </div>

  <div className="flex items-center gap-2 text-xs text-muted-foreground">
   <Calendar className="h-3 w-3" />
   <span>{log.timestamp.toLocaleString(config.intlLocale)}</span>
  </div>

  {log.changes && log.changes.length > 0 && (
   <div className="mt-2 text-xs text-muted-foreground">
   {log.changes.length} modification(s)
   </div>
  )}
  </button>
  ))
  )}
 </div>

 {/* Right: Diff Viewer */}
 <div className="bg-card text-card-foreground p-6 rounded-2xl border border-border max-h-[600px] overflow-y-auto custom-scrollbar">
  {selectedLog ? (
  <div>
  <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
  <Eye className="h-5 w-5" />
  Détails de la modification
  </h3>

  <div className="space-y-4 mb-6">
  <div>
   <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Action</span>
   <p className="text-sm font-bold text-foreground mt-1">
   {getActionIcon(selectedLog.action)} {selectedLog.action.toUpperCase()}
   </p>
  </div>

  <div>
   <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Type</span>
   <p className="text-sm font-bold text-foreground mt-1">{selectedLog.entityType}</p>
  </div>

  <div>
   <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Utilisateur</span>
   <p className="text-sm font-bold text-foreground mt-1">{selectedLog.userName}</p>
  </div>

  <div>
   <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</span>
   <p className="text-sm font-bold text-foreground mt-1">
   {selectedLog.timestamp.toLocaleString(config.intlLocale)}
   </p>
  </div>
  </div>

  {selectedLog.before && selectedLog.after && (
  <div>
   <h4 className="text-sm font-bold text-foreground mb-3">Comparaison Avant/Après</h4>
   <div className="rounded-3xl overflow-hidden border border-border/40">
   <ReactDiffViewer
   oldValue={JSON.stringify(selectedLog.before, null, 2)}
   newValue={JSON.stringify(selectedLog.after, null, 2)}
   splitView={false}
   showDiffOnly={true}
   useDarkTheme={document.documentElement.classList.contains('dark')}
   styles={{
   variables: {
    light: {
    diffViewerBackground: 'hsl(var(--background))',
    addedBackground: 'hsl(var(--success-bg))',
    addedColor: 'hsl(var(--foreground))',
    removedBackground: 'hsl(var(--error-bg))',
    removedColor: 'hsl(var(--foreground))',
    },
    dark: {
    diffViewerBackground: 'hsl(var(--background))',
    addedBackground: 'hsl(var(--success-bg))',
    addedColor: 'hsl(var(--foreground))',
    removedBackground: 'hsl(var(--error-bg))',
    removedColor: 'hsl(var(--foreground))',
    }
   }
   }}
   />
   </div>
  </div>
  )}

  {selectedLog.changes && selectedLog.changes.length > 0 && (
  <div className="mt-4">
   <h4 className="text-sm font-bold text-foreground mb-2">Champs modifiés</h4>
   <ul className="space-y-1">
   {selectedLog.changes.map((change, idx) => (
   <li key={`${idx || 'unknown'}-${change}`} className="text-sm text-muted-foreground flex items-center gap-2">
   <span className="w-2 h-2 bg-primary rounded-full"></span>
   {change}
   </li>
   ))}
   </ul>
  </div>
  )}
  </div>
  ) : (
  <div className="text-center py-12 text-muted-foreground">
  <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
  <p>Sélectionnez un événement pour voir les détails</p>
  </div>
  )}
 </div>
 </div>
 </motion.div>
 );
};
