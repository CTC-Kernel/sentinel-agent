import React, { useState } from 'react';
import { integrationService, SecurityEvent } from '../../services/integrationService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/EmptyState';
import { Shield, Activity, CheckCircle, Disc } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { toast } from '@/lib/toast';
import { useStore } from '../../store';

interface IncidentImportModalProps {
 isOpen: boolean;
 onClose: () => void;
 onImport: (events: SecurityEvent[]) => Promise<void>;
}

export const IncidentImportModal: React.FC<IncidentImportModalProps> = ({ isOpen, onClose, onImport }) => {
 const [step, setStep] = useState<'source' | 'select'>('source');
 const [loading, setLoading] = useState(false);
 const [events, setEvents] = useState<SecurityEvent[]>([]);
 const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
 const [selectedSource, setSelectedSource] = useState<string>('');

 const { demoMode, t } = useStore();

 const handleSourceSelect = async (source: 'splunk' | 'crowdstrike' | 'sentinelone' | 'microsoft') => {
 setSelectedSource(source);
 setLoading(true);
 try {
 const fetchedEvents = await integrationService.fetchSecurityEvents(source, demoMode);
 setEvents(fetchedEvents);
 setSelectedEvents(new Set(fetchedEvents.map(e => e.id)));
 setStep('select');
 } catch {
 toast.error(t('incidents.toast.connectorError', { defaultValue: "Erreur de connexion au connecteur" }));
 } finally {
 setLoading(false);
 }
 };

 const handleImport = async () => {
 setLoading(true);
 const toImport = events.filter(e => selectedEvents.has(e.id));
 try {
 await onImport(toImport);
 onClose();
 setStep('source');
 setEvents([]);
 } catch {
 // Error handling in parent
 } finally {
 setLoading(false);
 }
 };

 const toggleSelection = (id: string) => {
 const newSet = new Set(selectedEvents);
 if (newSet.has(id)) newSet.delete(id);
 else newSet.add(id);
 setSelectedEvents(newSet);
 };

 return (
 <Modal
 isOpen={isOpen}
 onClose={onClose}
 title={step === 'source' ? t('incidents.import.title', { defaultValue: 'Importer depuis une source externe' }) : t('incidents.import.detectedTitle', { defaultValue: `Incidents détectés - ${selectedSource}`, source: selectedSource })}
 maxWidth="max-w-3xl"
 >
 <div className="p-1">
 <p className="text-sm text-muted-foreground mb-6 px-1">
  {step === 'source'
  ? t('incidents.import.sourceDesc', { defaultValue: 'Connectez-vous à vos outils de sécurité (SIEM/EDR) pour importer des alertes.' })
  : t('incidents.import.selectDesc', { defaultValue: 'Sélectionnez les alertes à transformer en incidents.' })}
 </p>

 {step === 'source' && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
  <button
  onClick={() => handleSourceSelect('splunk')}
  disabled={loading}
  className="flex flex-col items-center justify-center p-6 border-2 border-border/40 rounded-3xl hover:border-primary hover:bg-primary/10 dark:hover:bg-primary/10 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
  <span className="text-white font-bold text-xs">&gt;_</span>
  </div>
  <span className="font-bold text-foreground">Splunk</span>
  <span className="text-xs text-muted-foreground mt-1">SIEM</span>
  </button>

  <button
  onClick={() => handleSourceSelect('microsoft')}
  disabled={loading}
  className="flex flex-col items-center justify-center p-6 border-2 border-border/40 rounded-3xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:bg-blue-900 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
  >
  <div className="w-12 h-12 bg-sky-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
  <Disc className="text-white h-6 w-6" />
  </div>
  <span className="font-bold text-foreground">Microsoft</span>
  <span className="text-xs text-muted-foreground mt-1">Sentinel / Defender</span>
  </button>

  <button
  onClick={() => handleSourceSelect('crowdstrike')}
  disabled={loading}
  className="flex flex-col items-center justify-center p-6 border-2 border-border/40 rounded-3xl hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
  >
  <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
  <Activity className="text-white h-6 w-6" />
  </div>
  <span className="font-bold text-foreground">CrowdStrike</span>
  <span className="text-xs text-muted-foreground mt-1">EDR</span>
  </button>

  <button
  onClick={() => handleSourceSelect('sentinelone')}
  disabled={loading}
  className="flex flex-col items-center justify-center p-6 border-2 border-border/40 rounded-3xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
  >
  <div className="w-12 h-12 bg-purple-700 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
  <Shield className="text-white h-6 w-6" />
  </div>
  <span className="font-bold text-foreground">SentinelOne</span>
  <span className="text-xs text-muted-foreground mt-1">EDR</span>
  </button>
  </div>
 )}

 {step === 'select' && (
  <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pb-4">
  {events.length === 0 ? (
  <div className="py-8">
  <EmptyState
   icon={Activity}
   title={t('incidents.import.noAlerts', { defaultValue: 'Aucune alerte' })}
   description={t('incidents.import.noAlertsDesc', { defaultValue: 'Aucune nouvelle alerte détectée par ce connecteur.' })}
   compact
  />
  </div>
  ) : (
  events.map(event => (
  <div
   key={event.id || 'unknown'}
   onClick={() => toggleSelection(event.id)}
   onKeyDown={(e) => {
   if (e.key === 'Enter' || e.key === ' ') {
   e.preventDefault();
   toggleSelection(event.id);
   }
   }}
   role="checkbox"
   aria-checked={selectedEvents.has(event.id)}
   tabIndex={0}
   className={`p-4 rounded-3xl border cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selectedEvents.has(event.id)
   ? 'border-primary bg-primary/10 dark:bg-primary'
   : 'border-border/40 hover:bg-muted/50'
   }`}
  >
   <div className="flex justify-between items-start mb-2">
   <div className="flex items-center gap-2">
   {selectedEvents.has(event.id) ? (
   <CheckCircle className="h-5 w-5 text-primary" />
   ) : (
   <div className="h-5 w-5 rounded-full border-2 border-border/40" />
   )}
   <span className="font-bold text-foreground">{event.title}</span>
   </div>
   <Badge status={event.severity === 'Critical' ? 'error' : event.severity === 'High' ? 'warning' : 'info'} size="sm">
   {event.severity}
   </Badge>
   </div>
   <p className="text-sm text-muted-foreground ml-7">{event.description}</p>
   <div className="flex items-center gap-4 mt-2 ml-7 text-xs text-muted-foreground">
   <span>{new Date(event.timestamp).toLocaleString('fr-FR')}</span>
   <span>•</span>
   <span className="font-mono">{event.id}</span>
   </div>
  </div>
  ))
  )}
  </div>
 )}

 <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border/40">
  {step === 'select' && (
  <Button variant="ghost" onClick={() => setStep('source')} disabled={loading}>
  {t('common.back', { defaultValue: 'Retour' })}
  </Button>
  )}
  <Button variant="ghost" onClick={onClose} disabled={loading}>
  {t('common.cancel', { defaultValue: 'Annuler' })}
  </Button>
  {step === 'select' && (
  <Button onClick={handleImport} disabled={loading || selectedEvents.size === 0}>
  {loading ? t('incidents.import.importing', { defaultValue: 'Importation...' }) : t('incidents.import.importCount', { defaultValue: `Importer (${selectedEvents.size})`, count: selectedEvents.size })}
  </Button>
  )}
 </div>
 </div>
 </Modal>
 );
};
