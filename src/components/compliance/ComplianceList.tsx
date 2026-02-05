import React, { useState } from 'react';
import { Control, Risk, Finding, Framework } from '../../types';
import { ISO_DOMAINS, ISO22301_DOMAINS, NIS2_DOMAINS, DORA_DOMAINS, GDPR_DOMAINS, SOC2_DOMAINS, HDS_DOMAINS, PCI_DSS_DOMAINS, NIST_CSF_DOMAINS } from '../../data/complianceData';
import { ChevronDown, ChevronRight, Paperclip, AlertTriangle, ShieldAlert, AlertOctagon } from '../../components/ui/Icons';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tooltip as CustomTooltip } from '../../components/ui/Tooltip';
import { EmptyState } from '../../components/ui/EmptyState';
import { AgentVerificationIndicator } from './AgentVerificationBadge';
import { useLocale } from '@/hooks/useLocale';
import { CONTROL_STATUS, PARTIAL_CONTROL_WEIGHT, isActionableStatus } from '../../constants/complianceConfig';
import { ErrorLogger } from '../../services/errorLogger';

interface ComplianceListProps {
 controls: Control[];
 risks: Risk[];
 findings: Finding[];
 loading: boolean;
 currentFramework: Framework;
 selectedControlId?: string;
 onSelectControl: (control: Control) => void;
 filter?: string;
}

const getFrameworkStyles = (framework: Framework) => {
 switch (framework) {
 case 'ISO27001':
 return {
 accent: 'text-primary',
 bg: 'bg-primary/10 dark:bg-primary',
 border: 'border-primary/20 dark:border-primary/80',
 progress: 'bg-primary shadow-primary/20'
 };
 case 'NIS2':
 return {
 accent: 'text-purple-600 dark:text-purple-400',
 bg: 'bg-purple-50 dark:bg-purple-900/20',
 border: 'border-purple-100 dark:border-purple-800/50',
 progress: 'bg-purple-600 shadow-purple-600/20'
 };
 case 'GDPR':
 return {
 accent: 'text-green-600 dark:text-green-400',
 bg: 'bg-green-50 dark:bg-green-900/20',
 border: 'border-green-100 dark:border-green-800/50',
 progress: 'bg-green-600 shadow-green-600/20'
 };
 case 'DORA':
 return {
 accent: 'text-yellow-600 dark:text-yellow-400',
 bg: 'bg-yellow-50 dark:bg-yellow-900/20',
 border: 'border-yellow-100 dark:border-yellow-800/50',
 progress: 'bg-yellow-600 shadow-yellow-600/20'
 };
 case 'ISO22301':
 return {
 accent: 'text-violet-600 dark:text-violet-400',
 bg: 'bg-violet-50 dark:bg-violet-900/20',
 border: 'border-violet-100 dark:border-violet-800/50',
 progress: 'bg-violet-600 shadow-violet-600/20'
 };
 case 'SOC2':
 return {
 accent: 'text-red-600 dark:text-red-400',
 bg: 'bg-red-50 dark:bg-red-900/20',
 border: 'border-red-100 dark:border-red-800',
 progress: 'bg-red-600 shadow-red-600/20'
 };
 case 'HDS':
 return {
 accent: 'text-blue-600 dark:text-blue-400',
 bg: 'bg-blue-50 dark:bg-blue-900/20',
 border: 'border-blue-100 dark:border-blue-800',
 progress: 'bg-blue-600 shadow-blue-600/20'
 };
 case 'PCI_DSS':
 return {
 accent: 'text-red-600 dark:text-red-400',
 bg: 'bg-red-50 dark:bg-red-900/20',
 border: 'border-red-100 dark:border-red-800',
 progress: 'bg-red-600 shadow-red-600/20'
 };
 case 'NIST_CSF':
 return {
 accent: 'text-yellow-600 dark:text-yellow-400',
 bg: 'bg-yellow-50 dark:bg-yellow-900/20',
 border: 'border-yellow-100 dark:border-yellow-800/50',
 progress: 'bg-yellow-600 shadow-yellow-600/20'
 };
 default:
 return {
 accent: 'text-primary',
 bg: 'bg-primary/10 dark:bg-primary',
 border: 'border-primary/20 dark:border-primary/80',
 progress: 'bg-primary shadow-primary/20'
 };
 }
};

export const ComplianceList: React.FC<ComplianceListProps> = ({
 controls,
 risks,
 findings,
 loading,
 currentFramework,
 selectedControlId,
 onSelectControl,
 filter
}) => {
 const { t } = useLocale();
 const [expandedDomains, setExpandedDomains] = useState<string[]>([]);

 const toggleDomain = (domainId: string) => {
 setExpandedDomains(prev =>
 prev.includes(domainId) ? prev.filter(id => id !== domainId) : [...prev, domainId]
 );
 };

 const getDomainStats = (prefix: string) => {
 const domainControls = controls.filter(c => c.code.startsWith(prefix));
 const total = domainControls.length;
 const actionable = domainControls.filter(c => isActionableStatus(c.status));
 const implemented = actionable.filter(c => c.status === CONTROL_STATUS.IMPLEMENTED).length;
 const partial = actionable.filter(c => c.status === CONTROL_STATUS.PARTIAL).length;
 const progress = actionable.length > 0 ? Math.round(((implemented + (partial * PARTIAL_CONTROL_WEIGHT)) / actionable.length) * 100) : 100;
 return { total, implemented, partial, progress };
 };

 const frameworkDomainsMap: Record<string, { id: string, title: string, description: string }[]> = {
 'ISO27001': ISO_DOMAINS,
 'ISO22301': ISO22301_DOMAINS,
 'NIS2': NIS2_DOMAINS,
 'DORA': DORA_DOMAINS,
 'GDPR': GDPR_DOMAINS,
 'SOC2': SOC2_DOMAINS,
 'HDS': HDS_DOMAINS,
 'PCI_DSS': PCI_DSS_DOMAINS,
 'NIST_CSF': NIST_CSF_DOMAINS,
 };
 const domains = frameworkDomainsMap[currentFramework] || [];
 if (!frameworkDomainsMap[currentFramework]) {
 ErrorLogger.info(`Unknown framework "${currentFramework}", no domains found. Falling back to empty list.`, 'ComplianceList');
 }

 if (loading) {
 return (
 <div className="space-y-4">
 {[1, 2, 3, 4].map(i => (
  <div key={`skel-${i || 'unknown'}`} className="glass-premium p-6 flex items-center gap-4 rounded-4xl">
  <Skeleton className="w-12 h-12 rounded-2xl" />
  <div className="space-y-2 flex-1">
  <Skeleton className="h-5 w-48" />
  <Skeleton className="h-4 w-full max-w-md" />
  </div>
  </div>
 ))}
 </div>
 );
 }

 if (controls.length === 0) {
 return (
 <EmptyState
 icon={ShieldAlert}
 title={t('compliance.noControlsFound', { defaultValue: 'Aucun contrôle trouvé' })}
 description={filter ? t('compliance.noControlsMatchSearch', { defaultValue: 'Aucun contrôle ne correspond à votre recherche.' }) : t('compliance.controlsNotLoaded', { defaultValue: 'Les contrôles n\'ont pas été chargés.' })}
 />
 );
 }

 return (
 <div className="space-y-4">
 {domains.map(domain => {
 const domainControls = controls.filter(c => c.code.startsWith(domain.id));
 // Hide domain if no controls match filter
 if (domainControls.length === 0) return null;

 const stats = getDomainStats(domain.id);
 // Expand if user filtered or manually expanded
 const isExpanded = expandedDomains.includes(domain.id) || (filter && filter.length > 0);

 const fwStyles = getFrameworkStyles(currentFramework);

 return (
  <div key={domain.id || 'unknown'} className="glass-premium rounded-3xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-apple group relative border border-border/40">
  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
  <div
  data-testid={`domain-header-${domain.id}`}
  onClick={() => toggleDomain(domain.id)}
  onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
   e.preventDefault();
   toggleDomain(domain.id);
  }
  }}
  role="button"
  tabIndex={0}
  aria-expanded={!!isExpanded}
  aria-label={t('compliance.toggleDomain', { defaultValue: `${domain.id} - ${domain.title}` })}
  className={`p-4 md:p-8 flex flex-col md:flex-row md:items-center justify-between cursor-pointer transition-colors gap-4 relative z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isExpanded ? 'bg-muted/50/80 dark:bg-white/5' : 'hover:bg-muted/50 dark:hover:bg-white/5'}`}
  >
  <div className="flex items-center gap-5 flex-1 min-w-0">
  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border shrink-0 shadow-sm shadow-black/5 transition-all group-hover:scale-110 ${fwStyles.bg} ${fwStyles.accent} ${fwStyles.border}`}>
   {domain.id.split('.')[1] || domain.id}
  </div>
  <div className="min-w-0">
   <h3 className="text-lg font-bold text-foreground leading-tight truncate pr-2">{domain.title}</h3>
   <p className="text-sm text-muted-foreground font-medium mt-1 truncate">{domain.description} • <span className="text-foreground text-muted-foreground">{stats.total} contrôles</span></p>
  </div>
  </div>
  <div className="flex items-center justify-between md:justify-end gap-3 md:gap-8 w-full md:w-auto pl-[4.25rem] md:pl-0">
  <div className="w-full md:w-40">
   <div className="flex justify-between text-xs font-bold text-muted-foreground mb-1.5">
   <span>{t('compliance.progress', { defaultValue: 'Progression' })}</span>
   <span className="text-foreground">{stats.progress}%</span>
   </div>
   <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden shadow-inner">
   <div className={`h-full rounded-full transition-all duration-700 ease-in-out ${stats.progress === 100 ? 'bg-success-text shadow-glow shadow-success-text/20' : `${fwStyles.progress} shadow-glow`}`} style={{ width: `${stats.progress}%` }}></div>
   </div>
  </div>
  <div className={`p-2 rounded-3xl transition-all duration-500 shrink-0 ${isExpanded ? 'bg-white dark:bg-white/10 shadow-apple-sm rotate-180 text-foreground ring-1 ring-black/5' : 'text-muted-foreground group-hover:text-muted-foreground group-hover:bg-muted dark:group-hover:bg-white/5'}`}>
   <ChevronDown className="h-5 w-5" />
  </div>
  </div>
  </div>

  {isExpanded && (
  <div className="p-4 bg-muted/50 dark:bg-black/20 backdrop-blur-sm border-t border-border/40 dark:border-white/5 relative z-10">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
   {domainControls.map(control => {
   const riskCount = risks.filter(r => r.mitigationControlIds?.includes(control.id)).length;
   const findingsCount = findings.filter(f => f.relatedControlId === control.id && f.status === 'Ouvert').length;
   const isActive = selectedControlId === control.id;

   return (
   <div
   key={control.id || 'unknown'}
   data-testid={`control-row-${control.code}`}
   onClick={() => {
    onSelectControl(control);
   }}
   onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onSelectControl(control);
    }
   }}
   role="button"
   tabIndex={0}
   className={`group relative p-4 rounded-3xl border transition-all duration-200 cursor-pointer overflow-hidden hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive
    ? 'bg-primary/10 border-primary/30 dark:bg-primary dark:border-primary/90'
    : 'bg-white dark:bg-white/5 border-border/40 hover:border-primary/30 dark:hover:border-primary'
    }`}
   >
   <div className="flex items-start justify-between gap-4">
    <div className="flex items-start gap-3 min-w-0">
    <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-2xl text-xs font-black transition-all shadow-sm ${isActive ? 'bg-primary text-primary-foreground' : `bg-muted dark:bg-white/10 text-muted-foreground group-hover:${fwStyles.bg} group-hover:${fwStyles.accent} border border-transparent group-hover:${fwStyles.border}`}`}>
    {control.code.split('.').slice(1).join('.') || control.code}
    </div>
    <div className="min-w-0 pt-0.5">
    <h4 className={`text-sm font-bold truncate pr-2 leading-tight ${isActive ? 'text-primary dark:text-primary/30' : 'text-foreground'}`}>
    {control.name}
    </h4>
    <p className="text-[11px] text-muted-foreground font-mono mt-0.5 uppercase tracking-wider">{control.code}</p>
    </div>
    </div>
    <div className={`shrink-0 px-2.5 py-1 rounded-3xl text-[11px] font-bold uppercase tracking-wide border shadow-sm whitespace-nowrap ${control.status === CONTROL_STATUS.IMPLEMENTED ? 'text-success-text bg-success-bg border-success-border/50' :
    control.status === CONTROL_STATUS.PARTIAL ? 'text-warning-text bg-warning-bg border-warning-border/50' :
    control.status === CONTROL_STATUS.NOT_APPLICABLE ? 'text-muted-foreground bg-muted border-border/40 ' :
    'text-muted-foreground bg-white border-border/40 '
    }`}>
    {control.status}
    </div>
   </div>

   <div className="flex items-center gap-2 mt-4 pl-[3.25rem]">
    {control.evidenceIds && control.evidenceIds.length > 0 ? (
    <span className="flex items-center text-success-text bg-success-bg px-2 py-1 rounded-lg text-[11px] font-bold border border-success-border/30">
    <Paperclip className="h-3 w-3 mr-1.5" />
    {control.evidenceIds.length}
    </span>
    ) : (control.status === CONTROL_STATUS.IMPLEMENTED) ? (
    <CustomTooltip content="Preuve obligatoire manquante">
    <span className="flex items-center text-warning-text bg-warning-bg px-2 py-1 rounded-lg text-[11px] font-bold border border-warning-border/30">
    <AlertTriangle className="h-3 w-3 mr-1.5" />
    {t('compliance.missing', { defaultValue: 'Manquante' })}
    </span>
    </CustomTooltip>
    ) : null}

    {riskCount > 0 && (
    <span className="flex items-center text-info-text bg-info-bg px-2 py-1 rounded-lg text-[11px] font-bold border border-info-border/30">
    <ShieldAlert className="h-3 w-3 mr-1.5" />
    {riskCount}
    </span>
    )}

    {findingsCount > 0 && (
    <span className="flex items-center text-error-text bg-error-bg px-2 py-1 rounded-lg text-[11px] font-bold border border-error-border/30">
    <AlertOctagon className="h-3 w-3 mr-1.5" />
    {findingsCount}
    </span>
    )}

    {/* Agent Verification Indicator */}
    <AgentVerificationIndicator
    controlId={control.code}
    framework={currentFramework}
    />

    <div className="flex-1" />

    <div className={`text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 ${isActive ? 'text-primary/50 dark:text-primary' : ''}`}>
    <ChevronRight className="h-4 w-4" />
    </div>
   </div>
   </div>
   );
   })}
  </div>
  </div>
  )}
  </div>
 );
 })}
 </div>
 );
};
