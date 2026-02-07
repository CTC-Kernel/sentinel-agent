import React from 'react';
import { CheckSquare, CalendarClock, AlertTriangle } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import type { Audit } from '../../../types';
import { useLocale } from '../../../hooks/useLocale';

interface AssetInspectorAuditsProps {
 linkedAudits: Audit[];
}

export const AssetInspectorAudits: React.FC<AssetInspectorAuditsProps> = ({
 linkedAudits
}) => {
 const { t } = useLocale();
 return (
 <div className="space-y-6 sm:space-y-8">
 <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center">
 <CheckSquare className="h-4 w-4 mr-2" /> {t('assets.inspector.linkedAudits', { defaultValue: 'Audits Liés' })} ({linkedAudits.length})
 </h3>
 {linkedAudits.length === 0 ? (
 <EmptyState compact icon={CheckSquare} title={t('assets.inspector.noAudit', { defaultValue: 'Aucun audit' })} description={t('assets.inspector.noAuditDesc', { defaultValue: 'Aucun audit associé.' })} />
 ) : (
 <div className="grid gap-4">
  {linkedAudits.map(audit => (
  <div key={audit.id || 'unknown'} className="p-5 glass-premium rounded-3xl border border-border/40 shadow-sm hover:shadow-md transition-all">
  <div className="flex justify-between items-start mb-2">
  <span className="text-sm font-bold text-foreground">{audit.name}</span>
  <span className={`text-xs uppercase font-bold px-2.5 py-1 rounded-3xl ${audit.status === 'Terminé' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-amber-100 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20'}`}>
   {audit.status}
  </span>
  </div>
  <div className="flex items-center gap-4 mt-2">
  <div className="text-xs text-muted-foreground flex items-center gap-1">
   <CalendarClock className="h-3 w-3" />
   {new Date(audit.dateScheduled).toLocaleDateString('fr-FR')}
  </div>
  <div className="text-xs text-muted-foreground flex items-center gap-1">
   <AlertTriangle className="h-3 w-3" />
   {audit.findingsCount} {t('assets.inspector.findings', { defaultValue: 'constats' })}
  </div>
  </div>
  </div>
  ))}
 </div>
 )}
 </div>
 );
};
