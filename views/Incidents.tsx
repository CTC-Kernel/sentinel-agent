import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { collection, where, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { Incident, Asset, Risk, UserProfile, Criticality, BusinessProcess } from '../types';
import { IncidentDashboard } from '../components/incidents/IncidentDashboard';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { logAction } from '../services/logger';
import { NotificationService } from '../services/notificationService';

import { PageHeader } from '../components/ui/PageHeader';
import { Siren, Plus, ShieldAlert, Edit, Trash2, CalendarDays, BookOpen, BrainCircuit, Sparkles, Loader2, Server, Activity } from '../components/ui/Icons';
import { Badge } from '../components/ui/Badge';
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
import { canEditResource, hasPermission, canDeleteResource } from '../utils/permissions';
import { aiService } from '../services/aiService';
import { hybridService } from '../services/hybridService';
import { integrationService } from '../services/integrationService';

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

    // Threat Intel State
    const [urlToCheck, setUrlToCheck] = useState('');
    const [urlReputationResult, setUrlReputationResult] = useState<{ safe: boolean; threatType?: string } | null>(null);
    const [checkingUrl, setCheckingUrl] = useState(false);

    // AI State
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || incidents.length === 0) return;
        const incident = incidents.find(i => i.id === state.voxelSelectedId);
        if (incident) {

            setSelectedIncident(incident);
        }
    }, [location.state, loading, incidents]);

    // Reset AI analysis when incident changes
    useEffect(() => {
        setAiAnalysis(null);
    }, [selectedIncident]);

    const handleCreate = async (data: IncidentFormData) => {
        if (!user?.organizationId || (!canEdit && !hasPermission(user, 'Incident', 'create'))) return;
        try {
            const incidentData = sanitizeData({ ...data });
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

            const docRef = await addDoc(collection(db, 'incidents'), { ...incidentData, organizationId: user.organizationId, dateReported: new Date().toISOString() });
            await logAction(user, 'CREATE', 'Incident', `Nouvel Incident: ${incidentData.title} `);

            // Backend Audit Log (ISO 27001)
            await hybridService.logCriticalEvent({
                action: 'CREATE',
                resource: 'Incident',
                details: `Created incident: ${incidentData.title}`,
                metadata: { severity: incidentData.severity, category: incidentData.category }
            });

            await NotificationService.notifyNewIncident({
                id: docRef.id,
                ...incidentData,
                dateReported: new Date().toISOString(),
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
        if (!user?.organizationId || !selectedIncident || !canEdit) return;
        try {
            const incidentData = sanitizeData({ ...data });
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

            await updateDoc(doc(db, 'incidents', selectedIncident.id), incidentData);
            await logAction(user, 'UPDATE', 'Incident', `MAJ Incident: ${incidentData.title} `);

            // Backend Audit Log
            await hybridService.logCriticalEvent({
                action: 'UPDATE',
                resource: 'Incident',
                details: `Updated incident: ${incidentData.title}`,
                metadata: {
                    status: incidentData.status,
                    changes: Object.keys(incidentData).join(', ')
                }
            });

            addToast("Incident mis à jour", "success");
            setSelectedIncident({ ...selectedIncident, ...incidentData } as Incident);
            setIsEditing(false);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Incidents.handleUpdate', 'UPDATE_FAILED');
        }
    };

    const initiateDelete = (id: string) => {
        if (!canDeleteResource(user, 'Incident')) return;
        setConfirmData({ isOpen: true, title: "Supprimer l'incident ?", message: "Cette action est définitive.", onConfirm: () => handleDelete(id) });
    };
    const handleDelete = async (id: string) => {
        if (!canDeleteResource(user, 'Incident')) return;
        try {
            await deleteDoc(doc(db, 'incidents', id));

            // Backend Audit Log
            await hybridService.logCriticalEvent({
                action: 'DELETE',
                resource: 'Incident',
                details: `Deleted incident ID: ${id}`,
                metadata: { incidentId: id }
            });

            if (selectedIncident?.id === id) setSelectedIncident(null);
            addToast("Incident supprimé", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Incidents.handleDelete', 'DELETE_FAILED');
        }
    };

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
            <Helmet>
                <title>Gestion des Incidents - Sentinel GRC</title>
                <meta name="description" content="Déclarez et gérez les incidents de sécurité, suivez les playbooks et générez des rapports." />
            </Helmet>
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
                        {(canEdit || hasPermission(user, 'Incident', 'create')) && (
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
                                                    <Badge
                                                        status={selectedIncident.severity === Criticality.CRITICAL ? 'error' : selectedIncident.severity === Criticality.HIGH ? 'warning' : 'info'}
                                                        variant="soft"
                                                    >
                                                        {selectedIncident.severity}
                                                    </Badge>
                                                </div>
                                                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                                                    <span className="text-xs text-slate-400 block mb-1">Statut</span>
                                                    <Badge status={selectedIncident.status === 'Résolu' ? 'success' : 'info'} variant="outline">
                                                        {selectedIncident.status}
                                                    </Badge>
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

                                            {/* Linked Items Section */}
                                            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Impact & Portée</h4>

                                                {selectedIncident.affectedAssetId && (
                                                    <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600">
                                                                <Server className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">Actif Affecté</p>
                                                                <p className="font-bold text-sm text-slate-900 dark:text-white">
                                                                    {assets.find(a => a.id === selectedIncident.affectedAssetId)?.name || 'Actif introuvable'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {selectedIncident.relatedRiskId && (
                                                    <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600">
                                                                <ShieldAlert className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">Risque Lié</p>
                                                                <p className="font-bold text-sm text-slate-900 dark:text-white">
                                                                    {risks.find(r => r.id === selectedIncident.relatedRiskId)?.threat || 'Risque introuvable'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {selectedIncident.affectedProcessId && (
                                                    <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600">
                                                                <Activity className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400">Processus Affecté</p>
                                                                <p className="font-bold text-sm text-slate-900 dark:text-white">
                                                                    {rawProcesses.find(p => p.id === selectedIncident.affectedProcessId)?.name || 'Processus introuvable'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Threat Intelligence Section */}
                                            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center">
                                                    <ShieldAlert className="h-4 w-4 mr-2" />
                                                    Threat Intelligence (Google Safe Browsing)
                                                </h4>

                                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                                                    {!user?.safeBrowsingApiKey ? (
                                                        <div className="text-sm text-amber-600 dark:text-amber-400 flex items-center">
                                                            <ShieldAlert className="h-4 w-4 mr-2" />
                                                            Veuillez configurer votre clé API Google Safe Browsing dans les paramètres pour utiliser cette fonctionnalité.
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="url"
                                                                    placeholder="Entrez une URL suspecte (ex: http://malware.site)..."
                                                                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                                                    value={urlToCheck}
                                                                    onChange={(e) => setUrlToCheck(e.target.value)}
                                                                />
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!urlToCheck) return;
                                                                        setCheckingUrl(true);
                                                                        setUrlReputationResult(null);
                                                                        try {
                                                                            const result = await integrationService.checkUrlReputation(urlToCheck, user.safeBrowsingApiKey!);
                                                                            setUrlReputationResult(result);
                                                                        } catch (err) {
                                                                            ErrorLogger.handleErrorWithToast(err, 'Incidents.checkUrl');
                                                                        } finally {
                                                                            setCheckingUrl(false);
                                                                        }
                                                                    }}
                                                                    disabled={checkingUrl || !urlToCheck}
                                                                    className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                                                >
                                                                    {checkingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Analyser'}
                                                                </button>
                                                            </div>

                                                            {urlReputationResult && (
                                                                <div className={`p-3 rounded-lg border flex items-center gap-3 ${urlReputationResult.safe
                                                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400'
                                                                    : 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400'
                                                                    }`}>
                                                                    {urlReputationResult.safe ? (
                                                                        <>
                                                                            <ShieldAlert className="h-5 w-5" />
                                                                            <div>
                                                                                <p className="font-bold text-sm">URL Sûre</p>
                                                                                <p className="text-xs opacity-80">Aucune menace détectée par Google Safe Browsing.</p>
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <ShieldAlert className="h-5 w-5" />
                                                                            <div>
                                                                                <p className="font-bold text-sm">URL Malveillante !</p>
                                                                                <p className="text-xs opacity-80">Type de menace : {urlReputationResult.threatType}</p>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex gap-3 pt-4">
                                                {canEdit && (
                                                    <button
                                                        onClick={() => setIsEditing(true)}
                                                        className="flex-1 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                        Modifier
                                                    </button>
                                                )}
                                                {canDeleteResource(user, 'Incident') && (
                                                    <button
                                                        onClick={() => initiateDelete(selectedIncident.id)}
                                                        className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {inspectorTab === 'playbook' && (
                                        <div className="animate-fade-in">
                                            <IncidentPlaybook
                                                incident={selectedIncident}
                                                onToggleStep={async (step) => {
                                                    if (!selectedIncident || !user?.organizationId || !canEdit) return;
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
