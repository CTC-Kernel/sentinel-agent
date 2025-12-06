import React, { useEffect, useState } from 'react';
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
    const { user } = useStore();
    const [response, setResponse] = useState<IncidentResponse | null>(null);
    const [playbook, setPlaybook] = useState<IPlaybook | null>(null);
    const [loading, setLoading] = useState(true);
    const [availablePlaybooks, setAvailablePlaybooks] = useState<IPlaybook[]>([]);
    const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>('');

    useEffect(() => {
        loadData();
    }, [incident.id]);

    const loadData = async () => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            // 1. Check for existing response
            const existingResponse = await IncidentPlaybookService.getResponse(incident.id);
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
    };

    const handleStartResponse = async () => {
        if (!selectedPlaybookId || !user?.uid || !user?.organizationId) return;
        try {
            setLoading(true);
            await IncidentPlaybookService.initiateResponse(
                incident.id,
                selectedPlaybookId,
                [user.uid],
                user.organizationId
            );
            await loadData(); // Reload to show the active response
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'IncidentPlaybook.handleStartResponse', 'CREATE_FAILED');
            setLoading(false);
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
                true // completed
            );
            // Optimistic update or reload
            const updatedResponse = { ...response, completedSteps: [...response.completedSteps, step.id] };
            setResponse(updatedResponse);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'IncidentPlaybook.handleStepToggle', 'UPDATE_FAILED');
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-400">Chargement du playbook...</div>;
    }

    // CASE 1: No active response -> Selection Mode
    if (!response) {
        return (
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm space-y-6">
                <div className="flex items-center gap-3 text-amber-500">
                    <AlertTriangle className="h-6 w-6" />
                    <h3 className="font-bold text-lg">Aucune réponse initiée</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                    Pour traiter cet incident selon les normes ISO 27001, vous devez initier une procédure de réponse formelle.
                </p>

                {availablePlaybooks.length > 0 ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Sélectionner un Playbook
                            </label>
                            <select
                                value={selectedPlaybookId}
                                onChange={(e) => setSelectedPlaybookId(e.target.value)}
                                className="w-full rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3"
                            >
                                {availablePlaybooks.map(pb => (
                                    <option key={pb.id} value={pb.id}>{pb.title} ({pb.severity})</option>
                                ))}
                            </select>
                        </div>

                        {/* Preview selected playbook */}
                        {(() => {
                            const selected = availablePlaybooks.find(p => p.id === selectedPlaybookId);
                            if (!selected) return null;
                            return (
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 text-sm space-y-2">
                                    <p><strong>Durée estimée:</strong> {selected.estimatedDuration}</p>
                                    <p><strong>Étapes:</strong> {selected.steps.length}</p>
                                    <p className="text-slate-500">{selected.description}</p>
                                </div>
                            );
                        })()}

                        <button
                            onClick={handleStartResponse}
                            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            <MonitorPlay className="h-5 w-5" />
                            Démarrer la réponse
                        </button>
                    </div>
                ) : (
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                        <p className="text-slate-500">Aucun playbook disponible pour la catégorie "{incident.category}".</p>
                        <button
                            onClick={() => user?.organizationId && IncidentPlaybookService.initializeDefaultPlaybooks(user.organizationId).then(loadData)}
                            className="mt-2 text-brand-600 hover:underline text-sm"
                        >
                            Générer les playbooks par défaut
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // CASE 2: Active Response -> Execution Mode
    if (!playbook) return <div className="p-4 text-red-500">Erreur: Playbook introuvable</div>;

    const completedCount = response.completedSteps.length;
    const totalCount = playbook.steps.length;
    const progress = Math.round((completedCount / totalCount) * 100);

    return (
        <div className="space-y-6">
            {/* Header / Progress */}
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Playbook Actif</h3>
                        <h2 className="font-bold text-lg text-slate-900 dark:text-white">{playbook.title}</h2>
                    </div>
                    <Badge status={progress === 100 ? 'success' : 'info'} size="md">{progress}%</Badge>
                </div>

                <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-2 mb-4">
                    <div className="bg-brand-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>Débuté le: {new Date(response.startedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Shield className="h-4 w-4" />
                        <span>Sévérité: {playbook.severity}</span>
                    </div>
                </div>
            </div>

            {/* Steps List */}
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Étapes de résolution</h3>
                <div className="space-y-4">
                    {playbook.steps.sort((a, b) => a.order - b.order).map((step) => {
                        const isCompleted = response.completedSteps.includes(step.id);
                        // Check dependencies
                        const dependenciesMet = !step.dependencies || step.dependencies.every(depId => response.completedSteps.includes(depId));
                        const isNext = !isCompleted && dependenciesMet;

                        return (
                            <div
                                key={step.id}
                                onClick={() => isNext && !readOnly && handleStepToggle(step)}
                                className={`relative flex items-start p-4 rounded-xl border transition-all ${isCompleted
                                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'
                                    : isNext
                                        ? 'bg-white dark:bg-white/5 border-brand-200 dark:border-brand-500/30 ring-1 ring-brand-100 dark:ring-brand-900/20 cursor-pointer hover:shadow-md'
                                        : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5 opacity-60 cursor-not-allowed'
                                    }`}
                            >
                                {/* Status Icon */}
                                <div className="mr-4 mt-1 flex-shrink-0">
                                    {isCompleted ? (
                                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                    ) : (
                                        <Circle className={`h-6 w-6 ${isNext ? 'text-brand-500 animate-pulse' : 'text-slate-300'}`} />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className={`font-bold ${isCompleted ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-900 dark:text-white'}`}>
                                            {step.title}
                                        </h4>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-md">
                                            {step.type}
                                        </span>
                                    </div>

                                    <p className={`text-sm mt-1 ${isCompleted ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                                        {step.description}
                                    </p>

                                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> {step.estimatedTime}
                                        </span>
                                        <span className="flex items-center gap-1">
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

