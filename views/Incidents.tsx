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

    const getBreadcrumbs = () => {
        const crumbs: { label: string; onClick?: () => void }[] = [{ label: 'Incidents', onClick: () => { setSelectedIncident(null); setCreationMode(false); setIsEditing(false); } }];

        if (creationMode) {
            crumbs.push({ label: 'Déclaration' });
            return crumbs;
        }

        if (selectedIncident) {
            if (selectedIncident.category) {
                crumbs.push({ label: selectedIncident.category });
            }
            crumbs.push({ label: selectedIncident.title });
        }

        return crumbs;
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
                subtitle="Détection, analyse et réponse aux incidents de sécurité"
                icon={<Siren className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={
                    <button
                        onClick={() => setCreationMode(true)}
                        className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-brand-600/20"
                    >
                        <Plus className="h-5 w-5 mr-2" />
                        Déclarer un incident
                    </button>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* ... (Stats cards content remains unchanged) ... */}
            </div>

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
                breadcrumbs={getBreadcrumbs()}
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

                                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-transparent">
                                    {inspectorTab === 'details' && (
                                        <div className="p-8 space-y-8">
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                                <div className="lg:col-span-2 space-y-8">
                                                    {/* Description */}
                                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                                            <BookOpen className="h-5 w-5 text-brand-500" />
                                                            Description
                                                        </h3>
                                                        <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                            {selectedIncident.description}
                                                        </p>
                                                    </div>

                                                    {/* Badges & Status */}
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

                                                    {/* AI Analysis */}
                                                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-white/5 shadow-sm relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                                            <BrainCircuit className="w-24 h-24 text-indigo-600" />
                                                        </div>
                                                        <div className="relative z-10">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                                    <Sparkles className="h-5 w-5 text-indigo-500" />
                                                                    Analyse IA & Recommandations
                                                                </h3>
                                                                {!aiAnalysis && (
                                                                    <button
                                                                        onClick={handleAnalyzeIncident}
                                                                        disabled={analyzing}
                                                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                                                    >
                                                                        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                                                                        {analyzing ? 'Analyse en cours...' : 'Lancer l\'analyse'}
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {aiAnalysis ? (
                                                                <div className="prose dark:prose-invert max-w-none text-sm bg-white/60 dark:bg-black/20 p-4 rounded-xl backdrop-blur-sm">
                                                                    <div dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n/g, '<br/>') }} />
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                                                                    <p>Lancez l'analyse IA pour obtenir des recommandations de remédiation et une analyse de la cause racine.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Impact & Assets */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                                                                <Server className="h-4 w-4" />
                                                                Actif Impacté
                                                            </h3>
                                                            {selectedIncident.affectedAssetId ? (
                                                                <div className="space-y-2">
                                                                    {(() => {
                                                                        const asset = assets.find(a => a.id === selectedIncident.affectedAssetId);
                                                                        return asset ? (
                                                                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5">
                                                                                <span className="font-medium text-slate-700 dark:text-slate-200">{asset.name}</span>
                                                                                <Badge status="neutral" size="sm">{asset.type}</Badge>
                                                                            </div>
                                                                        ) : <p className="text-sm text-slate-500 italic">Actif introuvable</p>;
                                                                    })()}
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-slate-500 italic">Aucun actif lié</p>
                                                            )}
                                                        </div>

                                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                                                                <Activity className="h-4 w-4" />
                                                                Service Impacté
                                                            </h3>
                                                            {selectedIncident.affectedProcessId ? (
                                                                <div className="space-y-2">
                                                                    {(() => {
                                                                        const proc = rawProcesses.find(p => p.id === selectedIncident.affectedProcessId);
                                                                        return proc ? (
                                                                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5">
                                                                                <span className="font-medium text-slate-700 dark:text-slate-200">{proc.name}</span>
                                                                            </div>
                                                                        ) : <p className="text-sm text-slate-500 italic">Processus introuvable</p>;
                                                                    })()}
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm text-slate-500 italic">Aucun service lié</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    {/* Meta Info */}
                                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4">
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Déclaré le</label>
                                                            <p className="font-medium text-slate-900 dark:text-white mt-1">
                                                                {new Date(selectedIncident.dateReported).toLocaleString()}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Déclaré par</label>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <div className="h-6 w-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
                                                                    {selectedIncident.reporter.charAt(0)}
                                                                </div>
                                                                <span className="font-medium text-slate-900 dark:text-white">{selectedIncident.reporter}</span>
                                                            </div>
                                                        </div>
                                                        {/* Assignee Removed */}
                                                    </div>


                                                    {/* Threat Intel Check */}
                                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                                                            <ShieldAlert className="h-4 w-4" />
                                                            Threat Intel
                                                        </h3>
                                                        <div className="space-y-3">
                                                            <input
                                                                type="text"
                                                                placeholder="Vérifier une URL / IP..."
                                                                className="w-full px-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                                                value={urlToCheck}
                                                                onChange={(e) => setUrlToCheck(e.target.value)}
                                                            />
                                                            <button
                                                                onClick={async () => {
                                                                    // Mock check
                                                                    if (!urlToCheck) return;
                                                                    setCheckingUrl(true);
                                                                    setUrlReputationResult(null);
                                                                    try {
                                                                        const result = await integrationService.checkUrlReputation(urlToCheck, user?.safeBrowsingApiKey || '');
                                                                        setUrlReputationResult(result);
                                                                    } catch (err) {
                                                                        ErrorLogger.handleErrorWithToast(err, 'Incidents.checkUrl');
                                                                    } finally {
                                                                        setCheckingUrl(false);
                                                                    }
                                                                }}
                                                                disabled={!urlToCheck || checkingUrl}
                                                                className="w-full py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                                                            >
                                                                {checkingUrl ? 'Vérification...' : 'Vérifier la réputation'}
                                                            </button>

                                                            {urlReputationResult && (
                                                                <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${urlReputationResult.safe ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                                                                    {urlReputationResult.safe ? (
                                                                        <>
                                                                            <ShieldAlert className="h-4 w-4" />
                                                                            URL/IP saine
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <ShieldAlert className="h-4 w-4" />
                                                                            Menace détectée: {urlReputationResult.threatType}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
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
                breadcrumbs={getBreadcrumbs()}
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
