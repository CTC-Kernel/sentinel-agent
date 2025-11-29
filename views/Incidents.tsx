import React, { useState, useEffect } from 'react';
import { collection, where, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { Incident, Asset, Risk, UserProfile, Criticality, BusinessProcess } from '../types';
import { IncidentDashboard } from '../components/incidents/IncidentDashboard';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { logAction } from '../services/logger';
import { NotificationService } from '../services/notificationService';

import { PageHeader } from '../components/ui/PageHeader';
import { Siren, Plus, ShieldAlert, Edit, Trash2, CalendarDays, BookOpen, BrainCircuit, Sparkles, Loader2 } from '../components/ui/Icons';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { useLocation } from 'react-router-dom';
import { Drawer } from '../components/ui/Drawer';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { IncidentTimeline } from '../components/incidents/IncidentTimeline';
import { IncidentPlaybook } from '../components/incidents/IncidentPlaybook';
import { IncidentForm } from '../components/incidents/IncidentForm';
import { IncidentFormData } from '../schemas/incidentSchema';

import { useFirestoreCollection } from '../hooks/useFirestore';
import { canEditResource } from '../utils/permissions';
import { aiService } from '../services/aiService';

export const Incidents: React.FC = () => {
    const { user, addToast } = useStore();
    const location = useLocation();

    // Data Fetching with Hooks
    const { data: rawIncidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
        'incidents',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    const { data: rawProcesses, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId }
    );

    // Derived State
    const incidents = React.useMemo(() => [...rawIncidents].sort((a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime()), [rawIncidents]);
    const assets = React.useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);
    const risks = React.useMemo(() => [...rawRisks].sort((a, b) => a.threat.localeCompare(b.threat)), [rawRisks]);

    const loading = loadingIncidents || loadingAssets || loadingRisks || loadingUsers || loadingProcesses;

    const [creationMode, setCreationMode] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [inspectorTab, setInspectorTab] = useState<'details' | 'playbook' | 'timeline' | 'ai'>('details');

    // AI State
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || incidents.length === 0) return;
        const incident = incidents.find(i => i.id === state.voxelSelectedId);
        if (incident) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedIncident(incident);
        }
    }, [location.state, loading, incidents]);

    // Reset AI analysis when incident changes
    useEffect(() => {
        setAiAnalysis(null);
    }, [selectedIncident]);

    const handleCreate = async (data: IncidentFormData) => {
        if (!user?.organizationId) return;
        try {
            const incidentData = sanitizeData({ ...data });
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

            const docRef = await addDoc(collection(db, 'incidents'), { ...incidentData, organizationId: user.organizationId, dateReported: new Date().toISOString() });
            await logAction(user, 'CREATE', 'Incident', `Nouvel Incident: ${incidentData.title} `);

            await NotificationService.notifyNewIncident({
                id: docRef.id,
                ...incidentData,
                organizationId: user.organizationId,
                reporter: user.displayName || 'Utilisateur'
            });

            addToast("Incident déclaré (Alerte envoyée)", "success");
            setCreationMode(false);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Incidents.handleCreate', 'CREATE_FAILED');
        }
    };

    const handleUpdate = async (data: IncidentFormData) => {
        if (!user?.organizationId || !selectedIncident) return;
        try {
            const incidentData = sanitizeData({ ...data });
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

            await updateDoc(doc(db, 'incidents', selectedIncident.id), incidentData);
            await logAction(user, 'UPDATE', 'Incident', `MAJ Incident: ${incidentData.title} `);
            addToast("Incident mis à jour", "success");
            setSelectedIncident({ ...selectedIncident, ...incidentData } as Incident);
            setIsEditing(false);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Incidents.handleUpdate', 'UPDATE_FAILED');
        }
    };

    const initiateDelete = (id: string) => { setConfirmData({ isOpen: true, title: "Supprimer l'incident ?", message: "Cette action est définitive.", onConfirm: () => handleDelete(id) }); };
    const handleDelete = async (id: string) => { try { await deleteDoc(doc(db, 'incidents', id)); if (selectedIncident?.id === id) setSelectedIncident(null); addToast("Incident supprimé", "info"); } catch (error) { addToast("Erreur suppression", "error"); } };

    const getTimeToResolve = (incident: Incident) => {
        if (!incident.dateResolved || !incident.dateReported) return null;
        const start = new Date(incident.dateReported).getTime();
        const end = new Date(incident.dateResolved).getTime();
        const diff = end - start;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) return `${days}j ${hours}h`;
        return `${hours}h`;
    };

    const canEdit = canEditResource(user, 'Incident');

    const handleAnalyzeIncident = async () => {
        if (!selectedIncident) return;
        setAnalyzing(true);
        try {
            const prompt = `
                Analyse cet incident de sécurité et fournis un rapport structuré :
                
                Titre: ${selectedIncident.title}
                Description: ${selectedIncident.description}
                Sévérité: ${selectedIncident.severity}
                Catégorie: ${selectedIncident.category}
                
                Structure attendue :
                1. Analyse de la cause racine probable (Root Cause Analysis)
                2. Impact potentiel (Business & Technique)
                3. Recommandations immédiates pour le confinement
                4. Mesures préventives à long terme
                
                Réponds en Markdown.
            `;
            const response = await aiService.chatWithAI(prompt);
            setAiAnalysis(response);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Incidents.analyze', 'UNKNOWN_ERROR');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative">
            <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} />

            <PageHeader
                title="Gestion des Incidents"
                subtitle="Déclaration et traitement des incidents de sécurité (ISO 27001 A.6.8)."
                breadcrumbs={[
                    { label: 'Incidents' }
                ]}
                icon={<Siren className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={
                    <div className="flex gap-3">
                        {canEdit && (
                            <button
                                onClick={() => setCreationMode(true)}
                                className="flex items-center px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-none"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Déclarer un incident
                            </button>
                        )}
                    </div>
                }
            />

            <IncidentDashboard
                incidents={incidents}
                onCreate={() => setCreationMode(true)}
                onSelect={(inc: Incident) => { setSelectedIncident(inc); setIsEditing(false); }}
                loading={loading}
                onDelete={initiateDelete}
            />

            {/* Inspector Drawer */}
            <Drawer
                isOpen={!!selectedIncident}
                onClose={() => { setSelectedIncident(null); setIsEditing(false); }}
                title={selectedIncident?.title || 'Détails de l\'incident'}
                subtitle={selectedIncident?.category}
                width="max-w-6xl"
            >
                {selectedIncident && (
                    <div className="flex flex-col h-full">
                        {isEditing ? (
                            <div className="p-6">
                                <IncidentForm
                                    onSubmit={handleUpdate}
                                    onCancel={() => setIsEditing(false)}
                                    initialData={selectedIncident}
                                    users={usersList}
                                    processes={rawProcesses}
                                    assets={assets}
                                    risks={risks}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="px-6 border-b border-gray-100 dark:border-white/5">
                                    <ScrollableTabs
                                        tabs={[
                                            { id: 'details', label: 'Détails', icon: Siren },
                                            { id: 'playbook', label: 'Playbook', icon: BookOpen },
                                            { id: 'timeline', label: 'Timeline', icon: CalendarDays },
                                            { id: 'ai', label: 'Analyse IA', icon: BrainCircuit },
                                        ]}
                                        activeTab={inspectorTab}
                                        onTabChange={(id) => setInspectorTab(id as 'details' | 'playbook' | 'timeline' | 'ai')}
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                    {inspectorTab === 'details' && (
                                        <div className="space-y-6 animate-fade-in">
                                            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Description</h4>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                    {selectedIncident.description}
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                                    <span className="text-xs text-slate-400 block mb-1">Sévérité</span>
                                                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${selectedIncident.severity === Criticality.CRITICAL ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                                                        {selectedIncident.severity}
                                                    </span>
                                                </div>
                                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                                    <span className="text-xs text-slate-400 block mb-1">Statut</span>
                                                    <span className="font-bold text-slate-900 dark:text-white">{selectedIncident.status}</span>
                                                </div>
                                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                                    <span className="text-xs text-slate-400 block mb-1">Impact Financier</span>
                                                    <span className="font-bold text-slate-900 dark:text-white">{selectedIncident.financialImpact ? `${selectedIncident.financialImpact} €` : '-'}</span>
                                                </div>
                                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                                    <span className="text-xs text-slate-400 block mb-1">Reporter</span>
                                                    <span className="font-bold text-slate-900 dark:text-white">{selectedIncident.reporter}</span>
                                                </div>
                                            </div>

                                            {selectedIncident.isSignificant && (
                                                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <ShieldAlert className="h-5 w-5 text-red-600" />
                                                        <h4 className="font-bold text-red-700 dark:text-red-400">Incident Significatif (NIS 2)</h4>
                                                    </div>
                                                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-3">
                                                        Cet incident nécessite une notification aux autorités compétentes.
                                                    </p>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-600 dark:text-slate-400">Statut Notification:</span>
                                                        <span className="font-bold text-slate-900 dark:text-white">{selectedIncident.notificationStatus}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex gap-3 pt-4">
                                                {canEdit && (
                                                    <>
                                                        <button
                                                            onClick={() => setIsEditing(true)}
                                                            className="flex-1 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                            Modifier
                                                        </button>
                                                        <button
                                                            onClick={() => initiateDelete(selectedIncident.id)}
                                                            className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                                        >
                                                            <Trash2 className="h-5 w-5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {inspectorTab === 'playbook' && (
                                        <div className="animate-fade-in">
                                            <IncidentPlaybook
                                                incident={selectedIncident}
                                                onToggleStep={async (step) => {
                                                    if (!selectedIncident || !user?.organizationId) return;
                                                    const currentSteps = selectedIncident.playbookStepsCompleted || [];
                                                    const newSteps = currentSteps.includes(step)
                                                        ? currentSteps.filter(s => s !== step)
                                                        : [...currentSteps, step];

                                                    try {
                                                        await updateDoc(doc(db, 'incidents', selectedIncident.id), {
                                                            playbookStepsCompleted: newSteps
                                                        });
                                                        setSelectedIncident({ ...selectedIncident, playbookStepsCompleted: newSteps });
                                                        addToast("Playbook mis à jour", "success");
                                                    } catch (error) {
                                                        ErrorLogger.handleErrorWithToast(error, 'Incidents.togglePlaybookStep', 'UPDATE_FAILED');
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}

                                    {inspectorTab === 'timeline' && (
                                        <div className="animate-fade-in h-full">
                                            <IncidentTimeline selectedIncident={selectedIncident} getTimeToResolve={getTimeToResolve} />
                                        </div>
                                    )}

                                    {inspectorTab === 'ai' && (
                                        <div className="animate-fade-in space-y-6">
                                            {!aiAnalysis ? (
                                                <div className="bg-slate-50 dark:bg-white/5 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 text-center">
                                                    <BrainCircuit className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Analyse IA de l'incident</h3>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                                                        L'IA peut analyser les détails de l'incident pour identifier la cause racine probable et suggérer des mesures correctives.
                                                    </p>
                                                    <button
                                                        onClick={handleAnalyzeIncident}
                                                        disabled={analyzing}
                                                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 mx-auto"
                                                    >
                                                        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                                        {analyzing ? 'Analyse en cours...' : 'Lancer l\'analyse'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                                            <Sparkles className="h-5 w-5 text-indigo-500" /> Rapport d'analyse
                                                        </h3>
                                                        <button
                                                            onClick={handleAnalyzeIncident}
                                                            disabled={analyzing}
                                                            className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                                            title="Relancer l'analyse"
                                                        >
                                                            <Loader2 className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
                                                        </button>
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm prose dark:prose-invert max-w-none text-sm">
                                                        {aiAnalysis.split('\n').map((line, i) => (
                                                            <p key={i} className="mb-2 last:mb-0">{line}</p>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Drawer>

            {/* Create Drawer */}
            <Drawer
                isOpen={creationMode}
                onClose={() => setCreationMode(false)}
                title="Déclarer un incident"
                subtitle="Nouvel incident de sécurité"
                width="max-w-4xl"
            >
                <div className="p-6">
                    <IncidentForm
                        onSubmit={handleCreate}
                        onCancel={() => setCreationMode(false)}
                        users={usersList}
                        processes={rawProcesses}
                        assets={assets}
                        risks={risks}
                    />
                </div>
            </Drawer>
        </div>
    );
};
