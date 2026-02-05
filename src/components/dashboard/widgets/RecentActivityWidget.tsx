import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, ShieldAlert, Siren, Server, CheckCircle2 } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { SystemLog } from '../../../types';
import { DashboardCard } from '../DashboardCard';
import { EmptyState } from '../../ui/EmptyState';

interface RecentActivityWidgetProps {
 recentActivity: SystemLog[];
 loading: boolean;
 t: (key: string) => string;
}

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = React.memo(({ recentActivity, loading, t }) => {
 const [isExpanded, setIsExpanded] = useState(false);
 type ActivityFilter = 'All' | 'Risk' | 'Incident' | 'Asset';
 const [filter, setFilter] = useState<ActivityFilter>('All');

 const navigate = useNavigate();

 const handleLogClick = (log: SystemLog) => {
 if (!log.resourceId) return;

 switch (log.resource) {
 case 'Risk':
 navigate(`/risks?id=${log.resourceId}`);
 break;
 case 'Incident':
 navigate(`/incidents?id=${log.resourceId}`);
 break;
 case 'Asset':
 navigate(`/assets?id=${log.resourceId}`);
 break;
 case 'Project':
 navigate(`/projects?id=${log.resourceId}`);
 break;
 case 'Document':
 navigate(`/documents?id=${log.resourceId}`);
 break;
 case 'BusinessProcess':
 navigate(`/continuity?id=${log.resourceId}`);
 break;
 case 'Supplier':
 navigate(`/suppliers?id=${log.resourceId}`);
 break;
 default:
 break;
 }
 };

 const getActivityIcon = (resource: string) => {
 switch (resource) {
 case 'Risk': return <ShieldAlert className="h-3.5 w-3.5 text-warning" />;
 case 'Incident': return <Siren className="h-3.5 w-3.5 text-destructive" />;
 case 'Asset': return <Server className="h-3.5 w-3.5 text-info" />;
 default: return <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />;
 }
 };

 const allFilteredActivity = recentActivity.filter(log => filter === 'All' || log.resource === filter);
 const displayActivity = isExpanded ? allFilteredActivity : allFilteredActivity.slice(0, 5);

 return (
 <DashboardCard
 title={t('dashboard.recentActivity')}
 subtitle={t('dashboard.realTime')}
 icon={<History className="w-5 h-5 text-muted-foreground" />}
 isExpanded={isExpanded}
 onToggleExpand={() => setIsExpanded(!isExpanded)}
 expandable={true}
 headerAction={
 <select
  value={filter}
  onClick={(e) => e.stopPropagation()}
  onChange={(e) => setFilter(e.target.value as ActivityFilter)}
  className="px-2 py-1.5 bg-background rounded-lg text-[11px] font-bold text-muted-foreground border border-border/40 hover:bg-muted/50 transition-all duration-normal ease-apple outline-none cursor-pointer"
  aria-label={t('dashboard.filterActivity')}
 >
  <option value="All">{t('common.all')}</option>
  <option value="Risk">{t('common.risks')}</option>
  <option value="Incident">{t('common.incidents')}</option>
  <option value="Asset">{t('common.assets')}</option>
 </select>
 }
 >
 <div className="p-0 h-full overflow-y-auto custom-scrollbar">
 <div className="border-l border-border space-y-8 py-8 ml-14 pr-8 relative">
  {loading ? <Skeleton className="h-20 w-full" /> : displayActivity.length === 0 ? (
  <EmptyState
  icon={CheckCircle2}
  title={t('dashboard.nothingToReport')}
  description={t('dashboard.systemRunningSmoothly')}
  className="py-8"
  />
  ) : displayActivity.map((log, i) => (
  <div
  key={`activity-${i || 'unknown'}`}
  className={`relative group ${log.resourceId ? 'rounded-xl cursor-pointer' : 'rounded-xl opacity-60 cursor-default'}`}
  >
  {log.resourceId && (
  <button
   onClick={() => handleLogClick(log)}
   className="absolute inset-0 w-full h-full bg-transparent border-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
   aria-label={`Voir les détails: ${log.action}`}
  />
  )}
  <span className="absolute -left-[41px] flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border shadow-sm group-hover:scale-110 group-hover:border-primary/50 transition-all z-10">
  {getActivityIcon(log.resource)}
  </span>
  <div className="flex justify-between items-start bg-card/60 p-3 rounded-xl border border-transparent hover:border-border transition-all duration-normal ease-apple group-hover:bg-muted/50">
  <div>
   <p className="text-sm font-bold text-foreground">
   {t(`dashboard.actions.${log.action}`) !== `dashboard.actions.${log.action}`
   ? t(`dashboard.actions.${log.action}`)
   : log.action.replace(/_/g, ' ')}
   </p>
   <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[500px] font-medium leading-relaxed">{log.details}</p>
  </div>
  <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide bg-muted/50 px-2 py-1 rounded-md ml-4 whitespace-nowrap">
   {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
  </span>
  </div>
  </div>
  ))}
  {!isExpanded && allFilteredActivity.length > 5 && (
  <div className="mt-3 text-center pl-8">
  <button
  onClick={() => setIsExpanded(true)}
  onKeyDown={(e) => {
   if (e.key === 'Enter' || e.key === ' ') {
   e.preventDefault();
   setIsExpanded(true);
   }
  }}
  className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1"
  >
  +{allFilteredActivity.length - 5} {t('common.more').toLowerCase()}
  </button>
  </div>
  )}
 </div>
 </div>
 </DashboardCard>
 );
});

RecentActivityWidget.displayName = 'RecentActivityWidget';
