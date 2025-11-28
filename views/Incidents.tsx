import React, { useState, useEffect } from 'react';
import { collection, where, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { Incident, Asset, Risk, UserProfile, Criticality, BusinessProcess } from '../types';
import { IncidentDashboard } from '../components/incidents/IncidentDashboard';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { logAction } from '../services/logger';
import { sendEmail } from '../services/emailService';
import { getIncidentAlertTemplate } from '../services/emailTemplates';

import { PageHeader } from '../components/ui/PageHeader';
import { Siren, Plus, ShieldAlert, Edit, Trash2, CalendarDays, BookOpen, BrainCircuit } from '../components/ui/Icons';
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

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || incidents.length === 0) return;
        const incident = incidents.find(i => i.id === state.voxelSelectedId);
        if (incident) {
            setSelectedIncident(incident);
        }
    }, [location.state, loading, incidents]);

    const handleCreate = async (data: IncidentFormData) => {
        if (!user?.organizationId) return;
        try {
            const incidentData = sanitizeData({ ...data });
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

            await addDoc(collection(db, 'incidents'), { ...incidentData, organizationId: user.organizationId, dateReported: new Date().toISOString() });
            await logAction(user, 'CREATE', 'Incident', `Nouvel Incident: ${incidentData.title} `);

            const incidentLink = `${window.location.origin} /#/incidents`;
            const htmlContent = getIncidentAlertTemplate(data.title || 'Incident', data.severity || 'Moyenne', user?.displayName || 'Utilisateur', incidentLink);

            // Find recipients (Admins & RSSI)
            const recipients = usersList
                .filter(u => u.role === 'admin' || u.role === 'rssi')
                .map(u => u.email)
                .filter(email => email && email.includes('@')); // Basic validation

            const to = recipients.length > 0 ? recipients.join(',') : user.email;

            await sendEmail(user, { to, subject: `[ALERTE SÉCURITÉ] ${data.severity?.toUpperCase()} - ${data.title} `, type: 'INCIDENT_ALERT', html: htmlContent });
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

    const canEdit = user?.role === 'admin' || user?.role === 'auditor';

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
                width="600px"
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
                                        onTabChange={(id) => setInspectorTab(id as any)}
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
                                            <IncidentPlaybook incident={selectedIncident} />
                                        </div>
                                    )}

                                    {inspectorTab === 'timeline' && (
                                        <div className="animate-fade-in h-full">
                                            <IncidentTimeline selectedIncident={selectedIncident} getTimeToResolve={getTimeToResolve} />
                                        </div>
                                    )}

                                    {inspectorTab === 'ai' && (
                                        <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 text-center animate-fade-in">
                                            <BrainCircuit className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                            <h3 className="font-bold text-slate-900 dark:text-white mb-2">Analyse IA</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                L'analyse automatique des causes racines et des recommandations sera bientôt disponible.
                                            </p>
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
                width="600px"
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
