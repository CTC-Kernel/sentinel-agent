import React, { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Incident } from '../types';
import { IncidentPlaybookService, IncidentPlaybook, IncidentResponse } from '../services/incidentPlaybookService';
import { ErrorLogger } from '../services/errorLogger';
import { useStore } from '../store';
import { ConfirmModal } from '../components/ui/ConfirmModal';
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
  const { user, addToast } = useStore();

  const loadPlaybooks = useCallback(async () => {
    try {
      const availablePlaybooks = await IncidentPlaybookService.getPlaybooks(incident.category);
      setPlaybooks(availablePlaybooks);
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'IncidentPlaybookView.loadPlaybooks', 'FETCH_FAILED');
    } finally {
      setLoading(false);
    }
  }, [incident.category, addToast]);

  const loadResponse = useCallback(async () => {
    try {
      const existingResponse = await IncidentPlaybookService.getResponse(incident.id);
      setResponse(existingResponse);
      if (existingResponse) {
        const playbook = await IncidentPlaybookService.getPlaybook(existingResponse.playbookId);
        setSelectedPlaybook(playbook);
        setCurrentStep(existingResponse.currentStepIndex);
      }
    } catch (error) {
      ErrorLogger.error(error, 'IncidentPlaybookView.loadResponse');
    }
  }, [incident.id]);

  useEffect(() => {
    loadPlaybooks();
    loadResponse();
  }, [loadPlaybooks, loadResponse]);

  const handleInitiateResponse = async () => {
    if (!selectedPlaybook || !user) return;

    setInitiating(true);
    try {
      await IncidentPlaybookService.initiateResponse(
        incident.id,
        selectedPlaybook.id,
        [user.uid]
      );

      await loadResponse();
      addToast('Response initiée avec succès', 'success');
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
        notes
      );

      await loadResponse();
      setNotes('');
      setEvidence({});
      setCurrentStep(currentStep + 1);
      addToast('Étape complétée', 'success');
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
          ['management']
        );
        await loadResponse();
        addToast('Incident escaladé', 'success');
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
        await IncidentPlaybookService.completeResponse(response.id, notes);
        await updateDoc(doc(db, 'incidents', incident.id), {
          status: 'Résolu',
          dateResolved: new Date().toISOString(),
          lessonsLearned: notes
        });
        addToast('Response terminée', 'success');
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
      default: return 'text-gray-600 bg-gray-50';
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
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Playbook de Response</h2>
              <p className="text-gray-600 mt-1">Incident: {incident.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
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
                  <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Aucun playbook disponible pour cette catégorie</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {playbooks.map((playbook) => (
                    <div
                      key={playbook.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedPlaybook?.id === playbook.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                      onClick={() => setSelectedPlaybook(playbook)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{playbook.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{playbook.description}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(playbook.severity)}`}>
                              {playbook.severity}
                            </span>
                            <span className="text-sm text-gray-500 flex items-center">
                              <Timer className="h-3 w-3 mr-1" />
                              {playbook.estimatedDuration}
                            </span>
                            <span className="text-sm text-gray-500 flex items-center">
                              <Users className="h-3 w-3 mr-1" />
                              {playbook.requiredResources.length} ressources
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
                    <span className="text-sm text-gray-500">
                      Étape {currentStep + 1} sur {selectedPlaybook?.steps.length}
                    </span>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
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
                  >
                    <ArrowRight className="h-3 w-3 inline mr-1" />
                    Escalader
                  </button>
                  <button
                    onClick={handleCompleteResponse}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    <CheckCircle2 className="h-3 w-3 inline mr-1" />
                    Terminer
                  </button>
                </div>
              </div>

              {/* Current Step */}
              {selectedPlaybook?.steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`border rounded-lg p-4 mb-4 ${index === currentStep
                    ? 'border-blue-500 bg-blue-50'
                    : index < currentStep
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStepIcon(step.type)}
                        <h4 className="font-semibold">{step.title}</h4>
                        {index < currentStep && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                        {index === currentStep && (
                          <Activity className="h-4 w-4 text-blue-600 animate-pulse" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{step.description}</p>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
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
                        <div className="mt-4 space-y-4">
                          {/* Evidence Input */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Evidence collectée
                            </label>
                            <textarea
                              className="w-full p-2 border rounded-lg"
                              rows={3}
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Notes
                            </label>
                            <textarea
                              className="w-full p-2 border rounded-lg"
                              rows={2}
                              placeholder="Notes sur cette étape..."
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                            />
                          </div>

                          {/* Complete Step Button */}
                          <button
                            onClick={() => handleStepComplete(step.id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Compléter cette étape
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Timeline */}
              <div className="mt-6">
                <h4 className="font-semibold mb-3">Timeline</h4>
                <div className="space-y-2">
                  {response.timeline.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5"></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{event.type}</span>
                          <span className="text-gray-500">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-gray-600">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

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
