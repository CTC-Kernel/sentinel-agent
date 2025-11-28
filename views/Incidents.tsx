
import React, { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { incidentSchema, IncidentFormData } from '../schemas/incidentSchema';
import { collection, where, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { Incident, Asset, Risk, UserProfile, Criticality, BusinessProcess } from '../types';
import { IncidentDashboard } from '../components/incidents/IncidentDashboard';
import { IncidentPlaybookModal } from '../components/incidents/IncidentPlaybookModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { logAction } from '../services/logger';
import { sendEmail } from '../services/emailService';
import { getIncidentAlertTemplate } from '../services/emailTemplates';

import { AIAssistButton } from '../components/ai/AIAssistButton';
import { PageHeader } from '../components/ui/PageHeader';
import { Siren, Plus, ShieldAlert, Edit, Trash2, CalendarDays, BookOpen, BrainCircuit } from '../components/ui/Icons';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { useLocation } from 'react-router-dom';
import { Drawer } from '../components/ui/Drawer';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { IncidentTimeline } from '../components/incidents/IncidentTimeline';
import { IncidentPlaybook } from '../components/incidents/IncidentPlaybook';

import { useFirestoreCollection } from '../hooks/useFirestore';

const PLAYBOOKS: Record<string, string[]> = {
    'Ransomware': ['Déconnecter la machine', 'Ne PAS éteindre', 'Photo de la rançon', 'Vérifier backups', 'Identifier malware', 'Isoler partages', 'Déclarer CNIL', 'Restaurer'],
    'Phishing': ['Changer mot de passe', 'Activer MFA', 'Scanner règles email', 'Purger email', 'Vérifier logs', 'Rappel utilisateurs'],
    'Vol Matériel': ['Effacement à distance', 'Révoquer certificats', 'Changer MDP locaux', 'Plainte police', 'Assurance'],
    'Indisponibilité': ['Vérifier élec/ondulateur', 'Ping/Traceroute', 'Basculer lien secours', 'Contacter FAI', 'Activer PCA > 4h'],
    'Fuite de Données': ['Identifier source', 'Colmater brèche', 'Lister données', 'Qualifier sensibilité', 'Notifier personnes', 'Notifier CNIL'],
    'Autre': ['Documenter faits', 'Qualifier impact', 'Prévenir RSSI', 'Sauvegarder logs', 'Sécuriser preuves']
};

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

    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null);

    const form = useForm<IncidentFormData>({
        resolver: zodResolver(incidentSchema),
        defaultValues: {
            title: '',
            description: '',
            severity: Criticality.MEDIUM,
            status: 'Nouveau',
            category: 'Autre',
            playbookStepsCompleted: [],
            affectedAssetId: '',
            relatedRiskId: '',
            affectedProcessId: '',
            reporter: user?.displayName || user?.email || '',
            financialImpact: 0,
            dateResolved: '',
            lessonsLearned: '',
            isSignificant: false,
            notificationStatus: 'Not Required',
            relevantAuthorities: []
        }
    });

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

    const affectedAssetId = form.watch('affectedAssetId');

    useEffect(() => {
        if (!affectedAssetId) return;
        const currentProcess = form.getValues('affectedProcessId');
        if (currentProcess) return;

        const relatedProcesses = rawProcesses.filter(p => p.supportingAssetIds?.includes(affectedAssetId));
        if (relatedProcesses.length === 1) {
            form.setValue('affectedProcessId', relatedProcesses[0].id, { shouldDirty: true });
            addToast(`Processus lié suggéré : ${relatedProcesses[0].name}`, 'info');
        }
    }, [affectedAssetId, rawProcesses]);

    const openModal = (incident?: Incident) => {
        if (incident) {
            setCurrentIncidentId(incident.id);
            setIsEditing(true);
            form.reset({
                title: incident.title,
                description: incident.description,
                severity: incident.severity,
                status: incident.status,
                category: incident.category,
                playbookStepsCompleted: incident.playbookStepsCompleted || [],
                affectedAssetId: incident.affectedAssetId || '',
                relatedRiskId: incident.relatedRiskId || '',
                affectedProcessId: incident.affectedProcessId || '',
                financialImpact: incident.financialImpact || 0,
                reporter: incident.reporter,
                dateReported: incident.dateReported,
                dateAnalysis: incident.dateAnalysis,
                dateContained: incident.dateContained,
                dateResolved: incident.dateResolved || '',
                lessonsLearned: incident.lessonsLearned || '',
                isSignificant: incident.isSignificant || false,
                notificationStatus: incident.notificationStatus || 'Not Required',
                relevantAuthorities: incident.relevantAuthorities || []
            });
        } else {
            setCurrentIncidentId(null);
            setIsEditing(false);
            form.reset({
                title: '',
                description: '',
                severity: Criticality.MEDIUM,
                status: 'Nouveau',
                category: 'Autre',
                playbookStepsCompleted: [],
                affectedAssetId: '',
                relatedRiskId: '',
                affectedProcessId: '',
                reporter: user?.displayName || user?.email || '',
                financialImpact: 0,
                dateResolved: '',
                lessonsLearned: '',
                isSignificant: false,
                notificationStatus: 'Not Required',
                relevantAuthorities: []
            });
        }
        setShowModal(true);
    };

    const onSubmit: SubmitHandler<IncidentFormData> = async (data) => {
        if (!user?.organizationId) return;
        try {
            const incidentData = sanitizeData({ ...data });
            const now = new Date().toISOString();

            if (incidentData.status === 'Analyse' && !incidentData.dateAnalysis) incidentData.dateAnalysis = now;
            if (incidentData.status === 'Contenu' && !incidentData.dateContained) incidentData.dateContained = now;
            if ((incidentData.status === 'Résolu' || incidentData.status === 'Fermé') && !incidentData.dateResolved) incidentData.dateResolved = now;

            if (isEditing && currentIncidentId) {
                await updateDoc(doc(db, 'incidents', currentIncidentId), incidentData);
                await logAction(user, 'UPDATE', 'Incident', `MAJ Incident: ${incidentData.title} `);
                addToast("Incident mis à jour", "success");
                if (selectedIncident?.id === currentIncidentId) setSelectedIncident({ ...selectedIncident, ...incidentData, id: currentIncidentId } as Incident);
            } else {
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
            }
            setShowModal(false);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Incidents.onSubmit', 'UPDATE_FAILED');
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
                                onClick={() => openModal()}
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
                onCreate={() => openModal()}
                onSelect={(inc: Incident) => setSelectedIncident(inc)}
                loading={loading}
                onDelete={initiateDelete}
            />

            {/* Inspector Drawer */}
            <Drawer
                isOpen={!!selectedIncident}
                onClose={() => setSelectedIncident(null)}
                title={selectedIncident?.title || 'Détails de l\'incident'}
                subtitle={selectedIncident?.category}
                width="600px"
            >
                {selectedIncident && (
                    <div className="flex flex-col h-full">
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
                                                    onClick={() => openModal(selectedIncident)}
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
                    </div>
                )}
            </Drawer>

            {/* Create/Edit Modal */}
            <IncidentPlaybookModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={isEditing ? "Modifier l'incident" : "Déclarer un incident"}
            >
                <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Titre de l'incident</label>
                        <input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium"
                            {...form.register('title')} placeholder="Ex: Attaque Ransomware sur Serveur RH" />
                        {form.formState.errors.title && <p className="text-red-500 text-xs mt-1">{form.formState.errors.title.message}</p>}
                    </div>
                    <div>
                        {/* NIS 2 Section */}
                        <div className="bg-red-50/50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/30 space-y-4">
                            <div className="flex items-center space-x-3">
                                <input type="checkbox" className="h-5 w-5 rounded text-red-600 focus:ring-red-500 border-gray-300" {...form.register('isSignificant')} />
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center">
                                    <ShieldAlert className="h-4 w-4 mr-2 text-red-500" />
                                    Incident Significatif (NIS 2)
                                </label>
                            </div>

                            {form.watch('isSignificant') && (
                                <div className="animate-fade-in pl-8">
                                    <div className="p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-red-100 dark:border-red-900/30 mb-4">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-2">Délais de Notification</h4>
                                        <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                                            <li className="flex justify-between"><span>Pré-notification (Early Warning)</span> <span className="font-bold">24h</span></li>
                                            <li className="flex justify-between"><span>Notification Initiale</span> <span className="font-bold">72h</span></li>
                                            <li className="flex justify-between"><span>Rapport Final</span> <span className="font-bold">1 mois</span></li>
                                        </ul>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut Notification</label>
                                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                                            {...form.register('notificationStatus')}>
                                            <option value="Not Required">Non Requis</option>
                                            <option value="Pending">En attente</option>
                                            <option value="Reported">Signalé</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Description détaillée</label>
                            <AIAssistButton
                                context={{
                                    title: form.watch('title'),
                                    category: form.watch('category'),
                                    severity: form.watch('severity'),
                                    affectedAsset: assets.find(a => a.id === form.watch('affectedAssetId'))?.name
                                }}
                                fieldName="description"
                                onSuggest={(val: string) => form.setValue('description', val)}
                                prompt="Rédige une description détaillée et professionnelle pour cet incident de sécurité. Inclus les éléments factuels probables basés sur le titre et la catégorie."
                            />
                        </div>
                        <textarea rows={4} className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium resize-none"
                            {...form.register('description')} placeholder="Décrivez les faits, l'heure de découverte, les symptômes..." />
                        {form.formState.errors.description && <p className="text-red-500 text-xs mt-1">{form.formState.errors.description.message}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Catégorie (Playbook)</label>
                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                                {...form.register('category')}>
                                {Object.keys(PLAYBOOKS).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Sévérité</label>
                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                                {...form.register('severity')}>
                                {Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label>
                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                                {...form.register('status')}>
                                {['Nouveau', 'Analyse', 'Contenu', 'Résolu', 'Fermé'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Actif Impacté</label>
                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                                {...form.register('affectedAssetId')}>
                                <option value="">Aucun / Inconnu</option>
                                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Processus Impacté</label>
                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                                {...form.register('affectedProcessId')}>
                                <option value="">Aucun / Inconnu</option>
                                {rawProcesses.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Lier à un Risque Identifié</label>
                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                                {...form.register('relatedRiskId')}>
                                <option value="">Non lié</option>
                                {risks.map(r => <option key={r.id} value={r.id}>{r.threat} (Score: {r.score})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Déclaré par</label>
                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium appearance-none"
                                {...form.register('reporter')}>
                                <option value="">Sélectionner...</option>
                                {usersList.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Coût estimé (€)</label>
                            <input type="number" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none font-medium"
                                {...form.register('financialImpact', { valueAsNumber: true })} placeholder="0.00" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm shadow-lg shadow-red-500/20 hover:scale-105 transition-all">Enregistrer</button>
                    </div>
                </form>
            </IncidentPlaybookModal>
        </div>
    );
};
