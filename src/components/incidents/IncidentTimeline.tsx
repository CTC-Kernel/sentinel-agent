import React from 'react';
import { CheckCircle2, AlertCircle, Clock, FileText } from '../ui/Icons';
import { Incident } from '../../types';
import { useLocale } from '@/hooks/useLocale';

interface IncidentTimelineProps {
 selectedIncident?: Incident;
 getTimeToResolve?: (incident: Incident) => string | null;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ selectedIncident, getTimeToResolve }) => {
 const { t, config } = useLocale();
 if (!selectedIncident) {
 return (
 <div className="bg-background/40 backdrop-blur-xl p-6 rounded-xl border border-border/40 shadow-premium h-full flex flex-col justify-center items-center text-center">
 <div className="p-4 bg-muted/10 rounded-full mb-4">
  <Clock className="h-8 w-8 text-muted-foreground" />
 </div>
 <h3 className="text-sm font-bold text-foreground mb-1">{t('incidents.timeline.title', { defaultValue: 'Chronologie' })}</h3>
 <p className="text-xs text-muted-foreground">{t('incidents.timeline.selectPrompt', { defaultValue: 'Sélectionnez un incident pour voir son historique.' })}</p>
 </div>
 );
 }

 // Define timeline steps based on incident status
 const steps = [
 {
 id: 'reported',
 label: t('incidents.timeline.reported', { defaultValue: 'Signalé' }),
 date: selectedIncident.dateReported,
 status: 'completed',
 icon: AlertCircle,
 description: t('incidents.timeline.reportedBy', { defaultValue: 'Incident signalé par {{reporter}}', reporter: selectedIncident.reporter })
 },
 {
 id: 'analysis',
 label: t('incidents.timeline.analysis', { defaultValue: 'En Analyse' }),
 date: selectedIncident.dateAnalysis || (['Analyse', 'Contenu', 'Résolu', 'Fermé'].includes(selectedIncident.status) ? selectedIncident.dateReported : undefined),
 status: ['Analyse', 'Contenu', 'Résolu', 'Fermé'].includes(selectedIncident.status) ? 'completed' : selectedIncident.status === 'Nouveau' ? 'current' : 'upcoming',
 icon: FileText,
 description: t('incidents.timeline.analysisDesc', { defaultValue: 'Analyse initiale et qualification' })
 },
 {
 id: 'contained',
 label: t('incidents.timeline.contained', { defaultValue: 'Contenu' }),
 date: selectedIncident.dateContained,
 status: ['Contenu', 'Résolu', 'Fermé'].includes(selectedIncident.status) ? 'completed' : selectedIncident.status === 'Analyse' ? 'current' : 'upcoming',
 icon: CheckCircle2,
 description: t('incidents.timeline.containedDesc', { defaultValue: 'Mesures de contournement appliquées' })
 },
 {
 id: 'resolved',
 label: t('incidents.timeline.resolved', { defaultValue: 'Résolu' }),
 date: selectedIncident.dateResolved,
 status: ['Résolu', 'Fermé'].includes(selectedIncident.status) ? 'completed' : selectedIncident.status === 'Contenu' ? 'current' : 'upcoming',
 icon: CheckCircle2,
 description: t('incidents.timeline.resolvedDesc', { defaultValue: 'Incident résolu et service rétabli' })
 }
 ];

 return (
 <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-xl border border-border/40 shadow-premium h-full">
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('incidents.timeline.title', { defaultValue: 'Chronologie' })}</h3>
 {selectedIncident.dateResolved && (
  <div className="flex items-center text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-lg border border-success/20">
  <Clock className="h-3 w-3 mr-1" />
  {t('incidents.timeline.resolvedIn', { defaultValue: 'Résolu en' })} {getTimeToResolve ? getTimeToResolve(selectedIncident) : '-'}
  </div>
 )}
 </div>

 <div className="relative pl-4 border-l border-border/40 space-y-8 my-4 ml-2">
 {steps.map((step) => {
  const isCompleted = step.status === 'completed';
  const isCurrent = step.status === 'current';

  return (
  <div key={step.id || 'unknown'} className="relative">
  {/* Dot */}
  <div className={`absolute -left-[21.5px] top-1 h-3 w-3 rounded-full border-2 transition-all duration-normal ease-apple ${isCompleted ? 'bg-primary border-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]' :
  isCurrent ? 'bg-background border-primary animate-pulse' :
   'bg-muted border-border/40'
  }`} />

  <div className={`flex flex-col transition-all duration-normal ease-apple ${isCompleted || isCurrent ? 'opacity-100' : 'opacity-40'}`}>
  <div className="flex items-center justify-between">
   <span className={`text-sm font-bold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
   {step.label}
   </span>
   {step.date && (
   <span className="text-xs text-muted-foreground font-mono">
   {new Date(step.date).toLocaleDateString(config.intlLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
   </span>
   )}
  </div>
  <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
  </div>
  </div>
  );
 })}
 </div>
 </div>
 );
};
