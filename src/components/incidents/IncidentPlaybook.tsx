import React, { useEffect, useState, useCallback } from 'react';
import { Incident } from '../../types';
import { CheckCircle2, Circle, MonitorPlay, AlertTriangle, Clock, Shield, User } from '../ui/Icons';
import { IncidentPlaybookService, IncidentResponse, IncidentPlaybook as IPlaybook, PlaybookStep } from '../../services/incidentPlaybookService';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { Badge } from '../ui/Badge';

interface IncidentPlaybookProps {
 incident: Incident;
 onToggleStep?: (step: string) => void; // Kept for compatibility but might be deprecated
 readOnly?: boolean;
}

export const IncidentPlaybook: React.FC<IncidentPlaybookProps> = ({ incident, readOnly = false }) => {
 const { user, t } = useStore();
 const [response, setResponse] = useState<IncidentResponse | null>(null);
 const [playbook, setPlaybook] = useState<IPlaybook | null>(null);
 const [loading, setLoading] = useState(true);
 const [isStarting, setIsStarting] = useState(false);
 const [availablePlaybooks, setAvailablePlaybooks] = useState<IPlaybook[]>([]);
 const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>('');

 const loadData = useCallback(async () => {
 if (!user?.organizationId) return;
 setLoading(true);
 try {
 // 1. Check for existing response
 const existingResponse = await IncidentPlaybookService.getResponse(incident.id, user.organizationId);
 setResponse(existingResponse);

 if (existingResponse) {
 // 2. If response exists, load the specific playbook
 const pb = await IncidentPlaybookService.getPlaybook(existingResponse.playbookId);
 setPlaybook(pb);
 } else {
 // 3. If no response, load available playbooks for this category
 // First ensure defaults exist (idempotent)
 await IncidentPlaybookService.initializeDefaultPlaybooks(user.organizationId);

 const playbooks = await IncidentPlaybookService.getPlaybooks(user.organizationId, incident.category);
 setAvailablePlaybooks(playbooks);
 if (playbooks.length > 0) {
  setSelectedPlaybookId(playbooks[0].id);
 }
 }
 } catch (error) {
 ErrorLogger.error(error, 'IncidentPlaybook.loadData');
 } finally {
 setLoading(false);
 }
 }, [incident.id, incident.category, user?.organizationId]);

 useEffect(() => {
 void loadData();
 }, [loadData]);

 const handleStartResponse = async () => {
 if (!selectedPlaybookId || !user?.uid || !user?.organizationId) return;
 try {
 setIsStarting(true);
 await IncidentPlaybookService.initiateResponse(
 incident.id,
 selectedPlaybookId,
 [user.uid],
 user.organizationId
 );
 await loadData(); // Reload to show the active response
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'IncidentPlaybook.handleStartResponse', 'CREATE_FAILED');
 } finally {
 setIsStarting(false);
 }
 };

 const handleStepToggle = async (step: PlaybookStep) => {
 if (readOnly || !response) return;

 const isCompleted = response.completedSteps.includes(step.id);
 // If already completed, we might want to allow un-checking, but the service logic
 // usually adds timeline events. For now, let's assume we can only mark as complete.
 if (isCompleted) return;

 try {
 await IncidentPlaybookService.updateStepProgress(
 response.id,
 step.id,
 true, // completed
 undefined, // evidence
 undefined, // note
 user?.uid,
 user?.displayName,
 user?.organizationId
 );
 // Optimistic update or reload
 const updatedResponse = { ...response, completedSteps: [...response.completedSteps, step.id] };
 setResponse(updatedResponse);
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'IncidentPlaybook.handleStepToggle', 'UPDATE_FAILED');
 }
 };

 const handleInitializePlaybooks = useCallback(async () => {
 if (!user?.organizationId) return;
 try {
 await IncidentPlaybookService.initializeDefaultPlaybooks(user.organizationId);
 await loadData();
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'IncidentPlaybook.handleInitializePlaybooks', 'CREATE_FAILED');
 }
 }, [user?.organizationId, loadData]);

 if (loading) {
 return <div className="p-8 text-center text-muted-foreground">{t('incidents.playbook.loading', { defaultValue: 'Chargement du playbook...' })}</div>;
 }

 // CASE 1: No active response -> Selection Mode
 if (!response) {
 return (
 <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-xl border border-border/40 shadow-premium space-y-6">
 <div className="flex items-center gap-3 text-warning">
  <AlertTriangle className="h-6 w-6" />
  <h3 className="font-bold text-lg">{t('incidents.playbook.noResponse', { defaultValue: 'Aucune réponse initiée' })}</h3>
 </div>
 <p className="text-muted-foreground">
  {t('incidents.playbook.noResponseDesc', { defaultValue: 'Pour traiter cet incident selon les normes ISO 27001, vous devez initier une procédure de réponse formelle.' })}
 </p>

 {availablePlaybooks.length > 0 ? (
  <div className="space-y-4">
  <div>
  <label htmlFor="playbook-select" className="block text-sm font-bold text-foreground mb-2">
  {t('incidents.playbook.selectLabel', { defaultValue: 'Sélectionner un Playbook' })}
  </label>
  <select
  id="playbook-select"
  value={selectedPlaybookId}
  onChange={(e) => setSelectedPlaybookId(e.target.value)}
  className="w-full rounded-xl border-border/40 bg-background text-foreground p-3 focus:outline-none focus:ring-2 focus-visible:ring-primary transition-all duration-normal ease-apple"
  >
  {availablePlaybooks.map(pb => (
   <option key={pb.id || 'unknown'} value={pb.id}>{pb.title} ({pb.severity})</option>
  ))}
  </select>
  </div>

  {/* Preview selected playbook */}
  {(() => {
  const selected = availablePlaybooks.find(p => p.id === selectedPlaybookId);
  if (!selected) return null;
  return (
  <div className="bg-muted/10 p-4 rounded-xl border border-border/40 text-sm space-y-2">
   <p><strong className="text-foreground">{t('incidents.playbook.estimatedDuration', { defaultValue: 'Durée estimée' })}:</strong> {selected.estimatedDuration}</p>
   <p><strong className="text-foreground">{t('incidents.playbook.steps', { defaultValue: 'Étapes' })}:</strong> {selected.steps.length}</p>
   <p className="text-muted-foreground">{selected.description}</p>
  </div>
  );
  })()}

  <button
  onClick={handleStartResponse}
  disabled={isStarting}
  className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all duration-normal ease-apple flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none dark:disabled:bg-muted/20"
  >
  {isStarting ? <span className="animate-spin text-xl">⏳</span> : <MonitorPlay className="h-5 w-5" />}
  {t('incidents.playbook.startResponse', { defaultValue: 'Démarrer la réponse' })}
  </button>
  </div>
 ) : (
  <div className="text-center p-6 bg-muted/10 rounded-xl border border-dashed border-border/40">
  <p className="text-muted-foreground">{t('incidents.playbook.noPlaybook', { defaultValue: `Aucun playbook disponible pour la catégorie "${incident.category}".`, category: incident.category })}</p>
  <button
  onClick={handleInitializePlaybooks}
  className="mt-3 text-primary hover:underline text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2"
  >
  {t('incidents.playbook.generateDefaults', { defaultValue: 'Générer les playbooks par défaut' })}
  </button>
  </div>
 )}
 </div>
 );
 }

 // CASE 2: Active Response -> Execution Mode
 if (!playbook) return <div className="p-4 text-destructive font-bold">{t('incidents.playbook.notFound', { defaultValue: 'Erreur: Playbook introuvable' })}</div>;

 const completedCount = response.completedSteps.length;
 const totalCount = playbook.steps.length;
 const progress = Math.round((completedCount / totalCount) * 100);

 return (
 <div className="space-y-6">
 {/* Header / Progress */}
 <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-xl border border-border/40 shadow-premium">
 <div className="flex justify-between items-center mb-4">
  <div>
  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t('incidents.playbook.activePlaybook', { defaultValue: 'Playbook Actif' })}</h3>
  <h2 className="font-bold text-xl text-foreground">{playbook.title}</h2>
  </div>
  <Badge status={progress === 100 ? 'success' : 'info'} size="md" variant="soft" className="font-bold">{progress}%</Badge>
 </div>

 <div className="w-full bg-muted/20 rounded-full h-2.5 mb-4 overflow-hidden">
  <div className="bg-primary h-full rounded-full transition-all duration-1000 ease-apple relative shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)]" style={{ width: `${progress}%` }}>
  <div className="absolute inset-0 bg-white/20 animate-pulse" />
  </div>
 </div>

 <div className="flex gap-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
  <div className="flex items-center gap-1.5">
  <Clock className="h-3.5 w-3.5" />
  <span>{t('incidents.playbook.startedOn', { defaultValue: 'Débuté le' })}: {new Date(response.startedAt).toLocaleDateString()}</span>
  </div>
  <div className="flex items-center gap-1.5">
  <Shield className="h-3.5 w-3.5" />
  <span>{t('incidents.playbook.severity', { defaultValue: 'Sévérité' })}: {playbook.severity}</span>
  </div>
 </div>
 </div>

 {/* Steps List */}
 <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-xl border border-border/40 shadow-premium">
 <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-6">{t('incidents.playbook.resolutionSteps', { defaultValue: 'Étapes de résolution' })}</h3>
 <div className="space-y-4">
  {playbook.steps.sort((a, b) => a.order - b.order).map((step) => {
  const isCompleted = response.completedSteps.includes(step.id);
  // Check dependencies
  const dependenciesMet = !step.dependencies || step.dependencies.every(depId => response.completedSteps.includes(depId));
  const isNext = !isCompleted && dependenciesMet;

  return (
  <div
  key={step.id || 'unknown'}
  onClick={() => isNext && !readOnly && handleStepToggle(step)}
  onKeyDown={(e) => {
   if (isNext && !readOnly && (e.key === 'Enter' || e.key === ' ')) {
   e.preventDefault();
   handleStepToggle(step);
   }
  }}
  role="button"
  tabIndex={isNext && !readOnly ? 0 : -1}
  className={`relative flex items-start p-4 rounded-xl border transition-all duration-normal ease-apple focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isCompleted
   ? 'bg-success/5 border-success/20'
   : isNext
   ? 'bg-background border-primary/30 ring-1 ring-primary/10 cursor-pointer hover:shadow-md hover:border-primary/50'
   : 'bg-muted/5 border-border/20 opacity-60 cursor-not-allowed text-muted-foreground'
   }`}
  >
  {/* Status Icon */}
  <div className="mr-4 mt-1 flex-shrink-0">
   {isCompleted ? (
   <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
   ) : (
   <Circle className={`h-6 w-6 ${isNext ? 'text-primary animate-pulse' : 'text-muted/40'}`} aria-hidden="true" />
   )}
  </div>

  {/* Content */}
  <div className="flex-1">
   <div className="flex justify-between items-start">
   <h4 className={`font-bold text-sm ${isCompleted ? 'text-success' : isNext ? 'text-foreground' : 'text-muted-foreground'}`}>
   {step.title}
   </h4>
   <span className="text-xs uppercase font-bold tracking-widest text-muted-foreground bg-muted/10 px-2 py-1 rounded-lg border border-border/40">
   {step.type}
   </span>
   </div>

   <p className={`text-xs mt-1 leading-relaxed ${isCompleted ? 'text-success/80' : 'text-muted-foreground'}`}>
   {step.description}
   </p>

   <div className="flex items-center gap-4 mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
   <span className="flex items-center gap-1.5">
   <Clock className="h-3 w-3" /> {step.estimatedTime}
   </span>
   <span className="flex items-center gap-1.5">
   <User className="h-3 w-3" /> {step.requiredRole}
   </span>
   </div>
  </div>
  </div>
  );
  })}
 </div>
 </div>
 </div>
 );
};

