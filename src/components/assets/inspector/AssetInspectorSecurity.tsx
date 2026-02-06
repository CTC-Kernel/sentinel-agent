import React, { useCallback } from 'react';
import { Search, ShieldAlert, Server, Plus, Flame, Siren } from '../../ui/Icons';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import { Asset, Risk, Incident, Vulnerability } from '../../../types';
import { RISK_THRESHOLDS } from '../../../constants/complianceConfig';
import { useLocale } from '../../../hooks/useLocale';

export interface ShodanResult {
 ip_str?: string;
 os?: string;
 ports?: number[];
 org?: string;
}

interface AssetInspectorSecurityProps {
 selectedAsset: Asset;
 scanning: boolean;
 shodanResult: ShodanResult | null;
 vulnerabilities: Vulnerability[];
 linkedRisks: Risk[];
 linkedIncidents: Incident[];
 scanShodan: () => void;
 checkCVEs: () => void;
 createRiskFromVuln: (vuln: Vulnerability) => void;
 navigate: (path: string, state?: Record<string, unknown>) => void;
}

export const AssetInspectorSecurity: React.FC<AssetInspectorSecurityProps> = ({
 selectedAsset,
 scanning,
 shodanResult,
 vulnerabilities,
 linkedRisks,
 linkedIncidents,
 scanShodan,
 checkCVEs,
 createRiskFromVuln,
 navigate
}) => {
 const { t } = useLocale();
 const handleCreateRisk = useCallback(() => {
 navigate('/risks', { state: { createForAsset: selectedAsset.id, assetName: selectedAsset.name } });
 }, [navigate, selectedAsset.id, selectedAsset.name]);

 const handleCreateIncident = useCallback(() => {
 navigate('/incidents', { state: { createForAsset: selectedAsset.id, assetName: selectedAsset.name } });
 }, [navigate, selectedAsset.id, selectedAsset.name]);

 return (
 <div className="space-y-6 sm:space-y-8">
 <div className="flex gap-4">
 <CustomTooltip content={t('common.inspector.security.scanShodanTooltip')}>
  <button
  type="button"
  onClick={scanShodan}
  disabled={scanning}
  aria-label={t('common.inspector.security.scanShodanTooltip')}
  className="flex-1 py-3 bg-primary text-primary-foreground rounded-3xl text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform flex items-center justify-center disabled:bg-muted disabled:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  {scanning ? <span className="animate-spin mr-2">⏳</span> : <Search className="w-4 h-4 mr-2" />}
  {t('common.inspector.security.scanShodan')}
  </button>
 </CustomTooltip>
 <CustomTooltip content={t('common.inspector.security.checkCVEsTooltip')}>
  <button
  type="button"
  onClick={checkCVEs}
  disabled={scanning}
  aria-label={t('common.inspector.security.checkCVEsTooltip')}
  className="flex-1 py-3 bg-muted dark:bg-white/10 text-foreground rounded-3xl text-sm font-bold shadow-sm hover:bg-muted dark:hover:bg-muted transition-colors flex items-center justify-center disabled:bg-muted disabled:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  {scanning ? <span className="animate-spin mr-2">⏳</span> : <ShieldAlert className="w-4 h-4 mr-2" />}
  {t('common.inspector.security.checkCVEs')}
  </button>
 </CustomTooltip>
 </div>

 {shodanResult && (
 <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm relative overflow-hidden group">
  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity" />
  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-4 flex items-center">
  <Server className="h-4 w-4 mr-2" /> {t('common.inspector.security.shodanResult')}
  </h3>
  <div className="space-y-3 text-sm font-mono relative z-decorator">
  <p className="flex justify-between items-center"><span className="text-text-description font-sans font-bold">IP:</span> <span className="text-foreground">{shodanResult.ip_str}</span></p>
  <p className="flex justify-between items-center"><span className="text-text-description font-sans font-bold">OS:</span> <span className="text-foreground">{shodanResult.os || 'N/A'}</span></p>
  <p className="flex justify-between items-center"><span className="text-text-description font-sans font-bold">Ports:</span> <span className="text-foreground">{shodanResult.ports?.join(', ') || 'None'}</span></p>
  <p className="flex justify-between items-center"><span className="text-text-description font-sans font-bold">Org:</span> <span className="text-foreground">{shodanResult.org || 'N/A'}</span></p>
  </div>
 </div>
 )}

 {vulnerabilities.length > 0 && (
 <div className="bg-red-50/50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-200/50 dark:border-red-900/30">
  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400 mb-5 flex items-center">
  <ShieldAlert className="h-4 w-4 mr-2" /> {t('common.inspector.security.nvdVulns')} ({vulnerabilities.length})
  </h3>
  <div className="space-y-3">
  {vulnerabilities.map(vuln => (
  <div key={vuln.cveId || 'unknown'} className="p-4 bg-white/80/40 backdrop-blur-md rounded-2xl border border-red-200/40 dark:border-red-900/40 shadow-sm hover:shadow-md transition-all group">
  <div className="flex justify-between items-start mb-2">
   <span className="text-sm font-bold text-red-700 dark:text-red-400">{vuln.cveId}</span>
   <div className="flex items-center gap-2">
   <span className="text-xs font-black px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full ring-1 ring-red-500/10">{vuln.severity} ({vuln.score})</span>
   <CustomTooltip content={t('common.inspector.security.newRisk')}>
   <button
   onClick={() => createRiskFromVuln(vuln)}
   aria-label={t('common.inspector.security.newRisk')}
   className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
   >
   <Plus className="h-4 w-4" />
   </button>
   </CustomTooltip>
   </div>
  </div>
  <p className="text-xs text-text-description line-clamp-2 leading-relaxed" title={vuln.description}>{vuln.description}</p>
  </div>
  ))}
  </div>
 </div>
 )}

 <div>
 <div className="flex items-center justify-between mb-4">
  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center">
  <ShieldAlert className="h-4 w-4 mr-2" /> {t('common.inspector.security.identifiedRisks')} ({linkedRisks.length})
  </h3>
  <button
  type="button"
  onClick={handleCreateRisk}
  aria-label={t('common.inspector.security.newRisk')}
  className="text-xs font-bold text-primary hover:underline flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1"
  >
  <Plus className="h-3 w-3 mr-1" /> {t('common.inspector.security.newRisk')}
  </button>
 </div>
 {linkedRisks.length === 0 ? (
  <p className="text-sm text-muted-foreground italic text-center py-8 bg-muted/30 rounded-3xl border border-dashed border-border/40">{t('common.inspector.security.noRisks')}</p>
 ) : (
  <div className="grid gap-4">
  {linkedRisks.map(risk => (
  <div key={risk.id || 'unknown'} className="p-5 glass-premium rounded-3xl border border-border/40 shadow-sm hover:shadow-md transition-all">
  <div className="flex justify-between items-start mb-2">
   <span className="text-sm font-bold text-foreground">{risk.threat}</span>
   <span className={`text-xs px-2 py-1 rounded-3xl font-bold ${risk.score >= RISK_THRESHOLDS.CRITICAL ? 'bg-red-500 text-white' : 'bg-muted dark:bg-white/10 text-muted-foreground'}`}>Score {risk.score}</span>
  </div>
  <p className="text-xs text-text-description mb-3">{risk.vulnerability}</p>
  {risk.score >= RISK_THRESHOLDS.CRITICAL && <div className="flex items-center text-xs text-red-600 dark:text-red-400 font-black uppercase tracking-wider bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-full w-fit border border-red-100 dark:border-red-900/30 shadow-sm"><Flame className="h-3 w-3 mr-2" /> {t('common.inspector.security.criticalRisk')}</div>}
  </div>
  ))}
  </div>
 )}
 </div>

 <div className="mt-8">
 <div className="flex items-center justify-between mb-4">
  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center">
  <Siren className="h-4 w-4 mr-2" /> {t('common.inspector.security.incidents')} ({linkedIncidents.length})
  </h3>
  <button
  type="button"
  onClick={handleCreateIncident}
  aria-label={t('common.inspector.security.reportIncident')}
  className="text-xs font-bold text-primary hover:underline flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1"
  >
  <Plus className="h-3 w-3 mr-1" /> {t('common.inspector.security.reportIncident')}
  </button>
 </div>
 {linkedIncidents.length === 0 ? (
  <p className="text-sm text-muted-foreground italic text-center py-8 bg-muted/30 rounded-3xl border border-dashed border-border/40">{t('common.inspector.security.noIncidents')}</p>
 ) : (
  <div className="grid gap-4">
  {linkedIncidents.map(inc => (
  <div key={inc.id || 'unknown'} className="p-5 glass-premium rounded-3xl border border-border/40 shadow-sm hover:shadow-md transition-all">
  <div className="flex justify-between items-start mb-2">
   <span className="text-sm font-bold text-foreground">{inc.title}</span>
   <span className={`text-xs uppercase font-bold px-2 py-1 rounded-3xl ${inc.status === 'Résolu' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inc.status}</span>
  </div>
  <p className="text-xs text-muted-foreground mb-2">{new Date(inc.dateReported).toLocaleDateString()}</p>
  </div>
  ))}
  </div>
 )}
 </div>
 </div>
 );
};
