import React, { useState, useEffect, useCallback } from 'react';
import { Incident } from '../types';
import { IncidentPlaybookService, IncidentPlaybook, IncidentResponse } from '../services/incidentPlaybookService';
import { ErrorLogger } from '../services/errorLogger';
import { useStore } from '../store';
import { sanitizeData } from '../utils/dataSanitizer';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Button } from '../components/ui/button';
import { useIncidentActions } from '../hooks/incidents/useIncidentActions';
import {
  AlertTriangle,
  CheckCircle2,
  Users,
  MessageSquare,
  Activity,
  ChevronRight,
  XCircle,
  ArrowRight,
  Timer,
  Target,
  Zap,
  Eye,
  ShieldCheck
} from '../components/ui/Icons';

interface IncidentPlaybookViewProps {
  incident: Incident;
  onClose: () => void;
}

export const IncidentPlaybookView: React.FC<IncidentPlaybookViewProps> = ({ incident, onClose }) => {
  const [playbooks, setPlaybooks] = useState<IncidentPlaybook[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<IncidentPlaybook | null>(null);
  const [response, setResponse] = useState<IncidentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => { });
  const [confirmMessage, setConfirmMessage] = useState('');
  const { user, addToast, t } = useStore();
  const { updateIncident } = useIncidentActions();

  const loadPlaybooks = useCallback(async () => {
    if (!user?.organizationId) return;
    try {
      const availablePlaybooks = await IncidentPlaybookService.getPlaybooks(user.organizationId, incident.category || 'Autre');
      setPlaybooks(availablePlaybooks);
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'IncidentPlaybookView.loadPlaybooks', 'FETCH_FAILED');
    } finally {
      setLoading(false);
    }
  }, [incident.category, user?.organizationId]);

  const loadResponse = useCallback(async () => {
    if (!user?.organizationId) return;
    try {
      const existingResponse = await IncidentPlaybookService.getResponse(incident.id, user.organizationId);
      setResponse(existingResponse);
      if (existingResponse) {
        const playbook = await IncidentPlaybookService.getPlaybook(existingResponse.playbookId);
        setSelectedPlaybook(playbook);
        setCurrentStep(existingResponse.currentStepIndex);
      }
    } catch (error) {
      ErrorLogger.error(error, 'IncidentPlaybookView.loadResponse');
    }
  }, [incident.id, user?.organizationId]);

  useEffect(() => {
    if (user?.organizationId) {
      loadPlaybooks();
      loadResponse();
    }
  }, [loadPlaybooks, loadResponse, user?.organizationId]);

  const handleInitiateResponse = async () => {
    if (!selectedPlaybook || !user || !user.organizationId) return;

    setInitiating(true);
    try {
      await IncidentPlaybookService.initiateResponse(
        incident.id,
        selectedPlaybook.id,
        [user.uid],
        user.organizationId
      );

      await loadResponse();
      addToast(t('incidents.playbook.responseInitiated', { defaultValue: 'Response initiée avec succès' }), 'success');
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'IncidentPlaybookView.handleInitiateResponse', 'CREATE_FAILED');
    } finally {
      setInitiating(false);
    }
  };

  const handleStepComplete = async (stepId: string) => {
    if (!response) return;

    try {
      await IncidentPlaybookService.updateStepProgress(
        response.id,
        stepId,
        true,
        evidence,
        notes,
        user?.uid,
        user?.displayName,
        user?.organizationId
      );

      await loadResponse();
      setNotes('');
      setEvidence({});
      setCurrentStep(currentStep + 1);
      addToast(t('incidents.playbook.stepCompleted', { defaultValue: 'Étape complétée' }), 'success');
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'IncidentPlaybookView.handleStepComplete', 'UPDATE_FAILED');
    }
  };

  const handleEscalate = async () => {
    if (!response) return;

    setConfirmMessage('Voulez-vous escalader cet incident ?');
    setConfirmAction(async () => {
      try {
        await IncidentPlaybookService.escalateIncident(
          response.id,
          'Escalade manuelle',
          ['management'],
          user?.organizationId
        );
        await loadResponse();
        addToast(t('incidents.playbook.escalated', { defaultValue: 'Incident escaladé' }), 'success');
      } catch (error) {
        ErrorLogger.handleErrorWithToast(error, 'IncidentPlaybookView.handleEscalate', 'UPDATE_FAILED');
      }
    });
    setShowConfirmModal(true);
  };

  const handleCompleteResponse = async () => {
    if (!response) return;

    setConfirmMessage('Voulez-vous marquer cette response comme terminée ?');
    setConfirmAction(async () => {
      try {
        await IncidentPlaybookService.completeResponse(response.id, notes, user?.organizationId);
        await updateIncident(incident.id, sanitizeData({
          status: 'Résolu',
          dateResolved: new Date().toISOString(),
          lessonsLearned: notes
        }));
        addToast(t('incidents.playbook.responseCompleted', { defaultValue: 'Response terminée' }), 'success');
        onClose();
      } catch (error) {
        ErrorLogger.handleErrorWithToast(error, 'IncidentPlaybookView.handleCompleteResponse', 'UPDATE_FAILED');
      }
    });
    setShowConfirmModal(true);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'text-red-600 bg-red-50';
      case 'High': return 'text-orange-600 bg-orange-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'Low': return 'text-green-600 bg-green-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'detection': return <Eye className="h-4 w-4" />;
      case 'containment': return <ShieldCheck className="h-4 w-4" />;
      case 'eradication': return <Zap className="h-4 w-4" />;
      case 'recovery': return <CheckCircle2 className="h-4 w-4" />;
      case 'communication': return <MessageSquare className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={`skeleton-${i || 'unknown'}`} className="h-20 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-modal">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Playbook de Response</h2>
              <p className="text-slate-600 mt-1">Incident: {incident.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-600"
              aria-label="Fermer le playbook"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!response ? (
            // Playbook Selection
            <div>
              <h3 className="text-lg font-semibold mb-4">Sélectionner un Playbook</h3>
              {playbooks.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-slate-600">Aucun playbook disponible pour cette catégorie</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {playbooks.map((playbook) => (
                    <div
                      key={playbook.id || 'unknown'}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedPlaybook?.id === playbook.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-border/40 dark:border-slate-700 hover:border-border/40 dark:hover:border-slate-600'
                        }`}
                      onClick={() => setSelectedPlaybook(playbook)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Sélectionner le playbook ${playbook.title}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedPlaybook(playbook);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{playbook.title}</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{playbook.description}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(playbook.severity)}`}>
                              {playbook.severity}
                            </span>
                            <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center">
                              <Timer className="h-3 w-3 mr-1" />
                              {playbook.estimatedDuration}
                            </span>
                            <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center">
                              <Users className="h-3 w-3 mr-1" />
                              {playbook.requiredResources.length} ressources
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedPlaybook && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleInitiateResponse}
                    disabled={initiating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground"
                    aria-label="Initier la réponse à l'incident"
                  >
                    {initiating ? 'Initialisation...' : 'Initier la Response'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Active Response
            <div>
              {/* Progress Overview */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {selectedPlaybook?.title} - Progression
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">
                      Étape {currentStep + 1} sur {selectedPlaybook?.steps.length}
                    </span>
                    <div className="w-32 bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${((currentStep + 1) / (selectedPlaybook?.steps.length || 1)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleEscalate}
                    className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
                    aria-label="Escalader l'incident"
                  >
                    <ArrowRight className="h-3 w-3 inline mr-1" />
                    Escalader
                  </button>
                  <button
                    onClick={handleCompleteResponse}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    aria-label="Terminer la réponse"
                  >
                    <CheckCircle2 className="h-3 w-3 inline mr-1" />
                    Terminer
                  </button>
                </div>
              </div>

              {/* Current Step */}
              {selectedPlaybook?.steps.map((step, index) => (
                <div
                  key={step.id || 'unknown'}
                  className={`border rounded-3xl p-3 mb-3 transition-colors ${index === currentStep
                    ? 'border-blue-500/30 bg-blue-500'
                    : index < currentStep
                      ? 'border-green-500/30 bg-green-500'
                      : 'border-border/40 bg-slate-50/30'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStepIcon(step.type)}
                        <h4 className="font-bold text-sm text-slate-800">{step.title}</h4>
                        {index < currentStep && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        )}
                        {index === currentStep && (
                          <Activity className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 pl-6">{step.description}</p>

                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground pl-6 uppercase tracking-wide font-medium">
                        <span className="flex items-center">
                          <Timer className="h-3 w-3 mr-1" />
                          {step.estimatedTime}
                        </span>
                        <span className="flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {step.requiredRole}
                        </span>
                      </div>

                      {index === currentStep && (
                        <div className="mt-3 pl-6 space-y-3">
                          {/* Evidence Input */}
                          <div>
                            <label
                              htmlFor={`evidence-${step.id}`}
                              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                            >
                              Evidence
                            </label>
                            <textarea
                              id={`evidence-${step.id}`}
                              className="w-full p-2 text-xs border border-border/40 rounded-lg focus:ring-2 focus-visible:ring-primary focus:border-transparent outline-none bg-white"
                              rows={2}
                              placeholder="Décrire l'evidence collectée..."
                              value={evidence[step.id] || ''}
                              onChange={(e) => setEvidence({
                                ...evidence,
                                [step.id]: e.target.value
                              })}
                            />
                          </div>

                          {/* Notes */}
                          <div>
                            <label
                              htmlFor={`notes-${step.id}`}
                              className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                            >
                              Notes
                            </label>
                            <textarea
                              id={`notes-${step.id}`}
                              className="w-full p-2 text-xs border border-border/40 rounded-lg focus:ring-2 focus-visible:ring-primary focus:border-transparent outline-none bg-white"
                              rows={2}
                              placeholder="Notes sur cette étape..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                            />
                          </div>

                          {/* Complete Step Button */}
                          <Button
                            onClick={() => handleStepComplete(step.id)}
                            className="w-full"
                            size="sm"
                            aria-label={`Valider l'étape ${step.title}`}
                          >
                            Valider l'étape
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Timeline */}
              <div className="mt-8 pt-6 border-t border-border/40 dark:border-slate-800">
                <h4 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-4">Timeline de réponse</h4>
                <div className="relative pl-4 border-l-2 border-border/40 space-y-4">
                  {response.timeline.map((event) => (
                    <div key={event.id || 'unknown'} className="relative pl-4">
                      <div className="absolute -left-[21px] top-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full"></div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                        <span className="text-xs font-bold text-slate-700">{event.type}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{event.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Minimized Step Cards Logic - applied via CSS classes mainly */}

        {/* Confirm Modal */}
        {showConfirmModal && (
          <ConfirmModal
            isOpen={showConfirmModal}
            title="Confirmation"
            message={confirmMessage}
            onConfirm={() => {
              confirmAction();
              setShowConfirmModal(false);
            }}
            onClose={() => setShowConfirmModal(false)}
          />
        )}
      </div>
    </div>
  );
};
