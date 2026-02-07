import React, { useState } from 'react';
import { Monitor, CheckCircle2, AlertTriangle, WifiOff, Settings, ExternalLink } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import { DashboardCard } from '../DashboardCard';
import { useAgentData } from '../../../hooks/useAgentData';
import { cn } from '../../../lib/utils';
import { validateUrl } from '../../../utils/urlValidation';

interface AgentStatusWidgetProps {
 navigate: (path: string) => void;
 t: (key: string) => string;
}

export const AgentStatusWidget: React.FC<AgentStatusWidgetProps> = React.memo(({ navigate, t }) => {
 const [isExpanded, setIsExpanded] = useState(false);
 const {
 activeAgents,
 offlineAgents,
 errorAgents,
 averageComplianceScore,
 checkResultsSummary,
 hasAgents,
 agents,
 loading
 } = useAgentData();

 // Status color based on agent health
 const getStatusColor = () => {
 if (errorAgents > 0) return 'bg-destructive';
 if (offlineAgents > 0) return 'bg-warning animate-pulse';
 if (activeAgents > 0) return 'bg-success';
 return 'bg-muted-foreground';
 };

 const getStatusBgColor = () => {
 if (errorAgents > 0) return 'bg-destructive/10';
 if (offlineAgents > 0) return 'bg-warning/10';
 if (activeAgents > 0) return 'bg-success/10';
 return 'bg-muted/10';
 };

 const getStatusMessage = () => {
 if (errorAgents > 0) return t('agents.widget.hasErrors');
 if (offlineAgents > 0) return t('agents.widget.someOffline');
 if (activeAgents > 0) return t('agents.widget.allHealthy');
 return t('agents.widget.noAgents');
 };

 const displayAgents = isExpanded ? agents : agents.slice(0, 4);

 const handleManageClick = () => {
 const safeUrl = validateUrl('/agents');
 if (safeUrl) navigate(/* sanitize */ safeUrl);
 };

 return (
 <DashboardCard
 title={t('agents.widget.title')}
 subtitle={t('agents.widget.subtitle')}
 icon={<Monitor className="w-5 h-5" />}
 isExpanded={isExpanded}
 onToggleExpand={() => setIsExpanded(!isExpanded)}
 expandable={agents.length > 4}
 headerAction={
 <CustomTooltip content={getStatusMessage()} position="left">
  <div className={`p-1.5 rounded-lg ${getStatusBgColor()}`}>
  <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
  </div>
 </CustomTooltip>
 }
 >
 <div className="p-4 h-full overflow-y-auto custom-scrollbar">
 {loading ? (
  <div className="space-y-3">
  <Skeleton className="h-16 w-full rounded-2xl" />
  <Skeleton className="h-24 w-full rounded-2xl" />
  </div>
 ) : !hasAgents ? (
  <div className="flex flex-col items-center justify-center p-6 bg-muted/50 rounded-2xl border border-border/40/30 backdrop-blur-sm">
  <Monitor className="h-10 w-10 text-muted-foreground mb-3" />
  <span className="text-sm font-bold text-muted-foreground text-center">
  {t('agents.widget.noAgentsInstalled')}
  </span>
  <span className="text-xs text-muted-foreground text-center mt-1">
  {t('agents.widget.installDescription')}
  </span>
  <button
  onClick={handleManageClick}
  className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-3xl text-sm font-semibold transition-colors flex items-center gap-2"
  >
  <Settings className="w-4 h-4" />
  {t('agents.widget.installNow')}
  </button>
  </div>
 ) : (
  <div className="space-y-4">
  {/* Summary Stats */}
  <div className="grid grid-cols-3 gap-2">
  <CustomTooltip content={t('agents.widget.activeTooltip')} position="top">
  <div className="flex flex-col items-center p-3 bg-success-bg/80 dark:bg-success/10 rounded-2xl border border-success-border dark:border-success/20">
   <CheckCircle2 className="h-5 w-5 text-success-text dark:text-success mb-1" />
   <span className="text-lg font-black text-success-text dark:text-success">{activeAgents}</span>
   <span className="text-xs font-semibold text-success-text/70 dark:text-success/70 uppercase tracking-wide">
   {t('agents.status.active')}
   </span>
  </div>
  </CustomTooltip>

  <CustomTooltip content={t('agents.widget.offlineTooltip')} position="top">
  <div className="flex flex-col items-center p-3 bg-warning-bg/80 dark:bg-warning/10 rounded-2xl border border-warning-border dark:border-warning/20">
   <WifiOff className="h-5 w-5 text-warning-text dark:text-warning mb-1" />
   <span className="text-lg font-black text-warning-text dark:text-warning">{offlineAgents}</span>
   <span className="text-xs font-semibold text-warning-text/70 dark:text-warning/70 uppercase tracking-wide">
   {t('agents.status.offline')}
   </span>
  </div>
  </CustomTooltip>

  <CustomTooltip content={t('agents.widget.errorTooltip')} position="top">
  <div className="flex flex-col items-center p-3 bg-error-bg/80 dark:bg-error/10 rounded-2xl border border-error-border dark:border-error/20">
   <AlertTriangle className="h-5 w-5 text-error-text dark:text-error mb-1" />
   <span className="text-lg font-black text-error-text dark:text-error">{errorAgents}</span>
   <span className="text-xs font-semibold text-error-text/70 dark:text-error/70 uppercase tracking-wide">
   {t('agents.status.error')}
   </span>
  </div>
  </CustomTooltip>
  </div>

  {/* Compliance Score */}
  {averageComplianceScore !== null && (
  <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/15/50 dark:from-primary/20 dark:to-primary/10 rounded-2xl border border-primary/20 dark:border-primary/90">
  <div className="flex items-center justify-between">
   <div>
   <span className="text-xs font-semibold text-primary uppercase tracking-wide">
   {t('agents.widget.machineCompliance')}
   </span>
   <div className="flex items-baseline gap-1 mt-1">
   <span className="text-2xl font-black text-primary dark:text-primary/50">
   {averageComplianceScore}%
   </span>
   <span className="text-xs text-primary">
   {t('agents.widget.avgScore')}
   </span>
   </div>
   </div>
   <div className="text-right">
   <div className="text-xs text-muted-foreground mb-1">
   {t('agents.widget.checkResults')}
   </div>
   <div className="flex gap-2 text-xs font-semibold">
   <span className="text-success-text dark:text-success">
   {checkResultsSummary.pass} {t('agents.checks.pass')}
   </span>
   <span className="text-error-text dark:text-error">
   {checkResultsSummary.fail} {t('agents.checks.fail')}
   </span>
   </div>
   </div>
  </div>
  </div>
  )}

  {/* Agent List */}
  <div className="space-y-2">
  {displayAgents.map(agent => (
  <div
   key={agent.id || 'unknown'}
   className={cn(
   "flex items-center p-3 rounded-3xl border transition-all hover:scale-[1.01]",
   agent.status === 'active'
   ? "bg-white/80 border-border/40/30"
   : agent.status === 'offline'
   ? "bg-warning-bg/50 dark:bg-warning/5 border-warning-border/50 dark:border-warning/20"
   : "bg-error-bg/50 dark:bg-error/5 border-error-border/50 dark:border-error/20"
   )}
  >
   <div className={cn(
   "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
   agent.os === 'windows' ? "bg-info-bg dark:bg-info/20" :
   agent.os === 'darwin' ? "bg-muted" :
   "bg-warning-bg dark:bg-warning/10"
   )}>
   <Monitor className={cn(
   "w-4 h-4",
   agent.os === 'windows' ? "text-info-text dark:text-info" :
   agent.os === 'darwin' ? "text-muted-foreground" :
   "text-warning-text dark:text-warning"
   )} />
   </div>
   <div className="flex-1 min-w-0">
   <span className="text-sm font-semibold text-foreground block truncate">
   {agent.name || agent.hostname || agent.id}
   </span>
   <span className="text-xs text-muted-foreground uppercase">
   {agent.os === 'windows' ? 'Windows' : agent.os === 'darwin' ? 'macOS' : 'Linux'}
   {agent.osVersion && ` ${agent.osVersion}`}
   </span>
   </div>
   <div className="text-right">
   {agent.complianceScore !== null && agent.complianceScore !== undefined && (
   <span className={cn(
   "text-sm font-bold",
   agent.complianceScore >= 80 ? "text-success-text dark:text-success" :
   agent.complianceScore >= 60 ? "text-warning-text dark:text-warning" :
   "text-error-text dark:text-error"
   )}>
   {agent.complianceScore}%
   </span>
   )}
   <div className={cn(
   "w-2 h-2 rounded-full ml-auto mt-1",
   agent.status === 'active' ? "bg-success" :
   agent.status === 'offline' ? "bg-warning" :
   "bg-destructive"
   )} />
   </div>
  </div>
  ))}
  </div>

  {/* Show more indicator */}
  {!isExpanded && agents.length > 4 && (
  <div className="text-center">
  <button
   className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary rounded"
   onClick={() => setIsExpanded(true)}
  >
   +{agents.length - 4} {t('common.more').toLowerCase()}
  </button>
  </div>
  )}

  {/* Manage Link */}
  <button
  onClick={handleManageClick}
  className="w-full flex items-center justify-center gap-2 p-3 text-sm font-semibold text-primary hover:bg-primary/10 dark:hover:bg-primary rounded-3xl transition-colors"
  >
  <Settings className="w-4 h-4" />
  {t('agents.widget.manage')}
  <ExternalLink className="w-3 h-3 ml-1" />
  </button>
  </div>
 )}
 </div>
 </DashboardCard>
 );
});

AgentStatusWidget.displayName = 'AgentStatusWidget';
