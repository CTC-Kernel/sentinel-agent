import React, { useState, useEffect } from 'react';
import { Menu, Transition } from '@headlessui/react';
// import { Helmet } from 'react-helmet-async'; // Replaced by SEO component
import { collection, where, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { Incident, Asset, Risk, UserProfile, Criticality, BusinessProcess } from '../types';
import { IncidentDashboard } from '../components/incidents/IncidentDashboard';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { logAction } from '../services/logger';
import { NotificationService } from '../services/notificationService';

import { PageHeader } from '../components/ui/PageHeader';
import { Siren, Plus, ShieldAlert, BrainCircuit, Clock, AlertTriangle, MoreVertical } from '../components/ui/Icons';


import { PremiumPageControl } from '../components/ui/PremiumPageControl';



import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { useLocation } from 'react-router-dom';
import { Drawer } from '../components/ui/Drawer';
import { IncidentKanban } from '../components/incidents/IncidentKanban';
import { IncidentForm } from '../components/incidents/IncidentForm';
import { IncidentInspector } from '../components/incidents/IncidentInspector';
import { CustomSelect } from '../components/ui/CustomSelect';
import { IncidentFormData } from '../schemas/incidentSchema';



import { useFirestoreCollection } from '../hooks/useFirestore';
import { canEditResource, hasPermission, canDeleteResource } from '../utils/permissions';
import { hybridService } from '../services/hybridService';
import { IncidentImportModal } from '../components/incidents/IncidentImportModal';
import { SecurityEvent } from '../services/integrationService';


import { SEO } from '../components/SEO';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';

export const Incidents: React.FC = () => {
    const { user, addToast } = useStore();
    const location = useLocation();

    // Data Fetching with Hooks
    const { data: rawIncidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
        'incidents',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );

    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );

    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );



    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );

    const { data: rawProcesses, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );

    // State Declarations
    const [creationMode, setCreationMode] = useState(false);

    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, loading?: boolean, closeOnConfirm?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });



    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid' | 'kanban'>('grid');
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [severityFilter, setSeverityFilter] = useState('');

    // Derived State
    const sortedIncidents = React.useMemo(() => [...rawIncidents].sort((a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime()), [rawIncidents]);
    const incidents = React.useMemo(() => {
        return sortedIncidents.filter(incident => {
            const matchesStatus = statusFilter ? incident.status === statusFilter : true;
            const matchesSeverity = severityFilter ? incident.severity === severityFilter : true;
            return matchesStatus && matchesSeverity;
        });
    }, [sortedIncidents, statusFilter, severityFilter]);

    const assets = React.useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);
    const risks = React.useMemo(() => [...rawRisks].sort((a, b) => a.threat.localeCompare(b.threat)), [rawRisks]);

    const loading = loadingIncidents || loadingAssets || loadingRisks || loadingUsers || loadingProcesses;

    const handleImportFromEvents = async (events: SecurityEvent[]) => {
        if (!user?.organizationId) return;
        setIsSubmitting(true);
        try {
            const mapSeverity = (sev: string): Criticality => {
                switch (sev) {
                    case 'Low': return Criticality.LOW;
                    case 'Medium': return Criticality.MEDIUM;
                    case 'High': return Criticality.HIGH;
                    case 'Critical': return Criticality.CRITICAL;
                    default: return Criticality.MEDIUM;
                }
            };

            const batch = events.map(event => sanitizeData({
                organizationId: user.organizationId,
                title: event.title,
                description: event.description + `\n\n**Source**: ${event.source}\n**Raw Data**: ${JSON.stringify(event.rawData)}`,
                severity: mapSeverity(event.severity),
                dateReported: new Date().toISOString(),
                status: 'Analyse',
                type: 'SecurityAlert',
                reporter: 'Connecteur ' + event.source,
                category: 'Intrusion', // Default
                financialImpact: 0,
                history: []
            }));

            await Promise.all(batch.map(data => addDoc(collection(db, 'incidents'), data)));
            await logAction(user, 'IMPORT', 'Incident', `Import de ${events.length} incidents depuis ${events[0]?.source}`);

            addToast(`${events.length} incidents importés avec succès`, "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Incidents.handleImportFromEvents');
        } finally {
            setIsSubmitting(false);
        }
    };


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
        if (!user?.organizationId || (!canEdit && !hasPermission(user, 'Incident', 'create'))) return;
        setIsSubmitting(true);
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
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async (data: IncidentFormData) => {
        if (!user?.organizationId || !selectedIncident || !canEdit) return;
        setIsSubmitting(true);
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
        } catch (error) {

            ErrorLogger.handleErrorWithToast(error, 'Incidents.handleUpdate', 'UPDATE_FAILED');
        } finally {
            setIsSubmitting(false);
        }
    };

    const initiateDelete = (id: string) => {
        if (!canDeleteResource(user, 'Incident')) return;
        setConfirmData({
            isOpen: true,
            title: "Supprimer l'incident ?",
            message: "Cette action est définitive.",
            onConfirm: () => handleDelete(id),
            closeOnConfirm: false
        });
    };
    const performDelete = async (id: string) => {
        await deleteDoc(doc(db, 'incidents', id));
        // Backend Audit Log
        await hybridService.logCriticalEvent({
            action: 'DELETE',
            resource: 'Incident',
            details: `Deleted incident ID: ${id}`,
            metadata: { incidentId: id }
        });
    };

    const handleDelete = async (id: string) => {
        if (!canDeleteResource(user, 'Incident')) return;
        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            await performDelete(id);
            if (selectedIncident?.id === id) setSelectedIncident(null);
            addToast("Incident supprimé", "info");
            setConfirmData(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Incidents.handleDelete', 'DELETE_FAILED');
        } finally {
            setConfirmData(prev => ({ ...prev, loading: false }));
        }
    };

    const handleBulkDelete = async (ids: string[]) => {
        if (!canDeleteResource(user, 'Incident')) return;

        setConfirmData({
            isOpen: true,
            title: "Supprimer ces incidents ?",
            message: `Vous êtes sur le point de supprimer ${ids.length} incidents. Cette action est définitive.`,
            onConfirm: async () => {
                setConfirmData(prev => ({ ...prev, loading: true }));
                try {
                    await Promise.all(ids.map(performDelete));
                    const selectedId = selectedIncident?.id;
                    if (selectedId && ids.includes(selectedId)) setSelectedIncident(null);
                    addToast(`${ids.length} incidents supprimés`, "info");
                    setConfirmData(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    ErrorLogger.handleErrorWithToast(error, 'Incidents.handleBulkDelete', 'DELETE_FAILED');
                } finally {
                    setConfirmData(prev => ({ ...prev, loading: false }));
                }
            }
        });
    };



    const canEdit = canEditResource(user, 'Incident');



    const incidentStats = React.useMemo(() => {
        const total = incidents.length;
        const openCount = incidents.filter(i => i.status !== 'Fermé' && i.status !== 'Résolu').length;
        const resolvedCount = incidents.filter(i => i.status === 'Fermé' || i.status === 'Résolu').length;
        const criticalCount = incidents.filter(i => i.severity === Criticality.CRITICAL).length;

        let totalResolutionHours = 0;
        let resolvedWithTimes = 0;

        incidents.forEach(inc => {
            if (inc.dateReported && inc.dateResolved) {
                const start = new Date(inc.dateReported).getTime();
                const end = new Date(inc.dateResolved).getTime();
                if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
                    const diffHours = (end - start) / (1000 * 60 * 60);
                    totalResolutionHours += diffHours;
                    resolvedWithTimes++;
                }
            }
        });

        const avgMttrHours = resolvedWithTimes > 0 ? Math.round(totalResolutionHours / resolvedWithTimes) : null;
        const criticalRatio = total > 0 ? Math.round((criticalCount / total) * 100) : null;

        return {
            total,
            open: openCount,
            resolved: resolvedCount,
            avgMttrHours,
            criticalRatio,
        };
    }, [incidents]);


    const getBreadcrumbs = () => {
        const crumbs: { label: string; onClick?: () => void }[] = [{ label: 'Incidents', onClick: () => { setSelectedIncident(null); setCreationMode(false); } }];

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
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO
                title="Gestion des Incidents"
                description="Détection, analyse et réponse aux incidents de sécurité (SOC/CSIRT)."
                keywords="Incidents, SOC, CSIRT, Cyberattaque, Réponse, Analyse, Playbooks, SIEM"
            />
            <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} loading={confirmData.loading} closeOnConfirm={confirmData.closeOnConfirm} />

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title="Gestion des Incidents"
                    subtitle="Détection, analyse et réponse aux incidents de sécurité"
                    icon={<Siren className="h-6 w-6 text-white" strokeWidth={2.5} />}
                    trustType="confidentiality"
                    breadcrumbs={[{ label: 'Opérations' }, { label: 'Incidents' }]}
                />
            </motion.div>

            <IncidentImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onImport={handleImportFromEvents}
            />

            {/* Carte de synthèse Incidents */}
            <motion.div variants={slideUpVariants} className="glass-panel p-6 md:p-8 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="space-y-2 relative z-10">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        Vue globale des incidents
                    </p>
                    <div className="flex items-baseline gap-3">
                        <p className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                            {incidentStats.open}
                        </p>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">incidents actifs</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto relative z-10">
                    {/* Active Incidents Card */}
                    <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-red-50/50 dark:hover:bg-red-900/20">
                        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Actifs</span>
                            <div className="p-1.5 rounded-lg bg-red-100/50 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                                <ShieldAlert className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{incidentStats.open}</p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">à traiter</p>
                        </div>
                    </div>

                    {/* MTTR Card */}
                    <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20">
                        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">MTTR</span>
                            <div className="p-1.5 rounded-lg bg-emerald-100/50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                <Clock className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {incidentStats.avgMttrHours !== null ? `${incidentStats.avgMttrHours}h` : '-'}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">délai moyen</p>
                        </div>
                    </div>

                    {/* Critical Ratio Card */}
                    <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-orange-50/50 dark:hover:bg-orange-900/20">
                        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">Critiques</span>
                            <div className="p-1.5 rounded-lg bg-orange-100/50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                                <AlertTriangle className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {incidentStats.criticalRatio !== null ? `${incidentStats.criticalRatio}%` : '-'}
                            </p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">du volume total</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Standardized Page Control */}
            <PremiumPageControl
                searchQuery={filter}
                onSearchChange={setFilter}
                searchPlaceholder="Rechercher par titre, description..."
                viewMode={viewMode}
                onViewModeChange={(mode) => setViewMode(mode as 'list' | 'grid' | 'kanban')}
                actions={
                    canEdit && (
                        <>
                            <div className="hidden md:block w-40 mr-2">
                                <CustomSelect
                                    value={statusFilter}
                                    onChange={(val) => setStatusFilter(val as string)}
                                    options={[
                                        { value: '', label: 'Tous les statuts' },
                                        { value: 'Nouveau', label: 'Nouveau' },
                                        { value: 'Analyse', label: 'Analyse' },
                                        { value: 'Contenu', label: 'Contenu' },
                                        { value: 'Résolu', label: 'Résolu' },
                                        { value: 'Fermé', label: 'Fermé' }
                                    ]}
                                    placeholder="Statut"
                                />
                            </div>
                            <div className="hidden md:block w-40 mr-4">
                                <CustomSelect
                                    value={severityFilter}
                                    onChange={(val) => setSeverityFilter(val as string)}
                                    options={[
                                        { value: '', label: 'Toutes sévérités' },
                                        { value: Criticality.CRITICAL, label: 'Critique' },
                                        { value: Criticality.HIGH, label: 'Élevé' },
                                        { value: Criticality.MEDIUM, label: 'Moyen' },
                                        { value: Criticality.LOW, label: 'Faible' }
                                    ]}
                                    placeholder="Sévérité"
                                />
                            </div>
                            <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-2 hidden md:block" />

                            <Menu as="div" className="relative inline-block text-left">
                                <Menu.Button className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                                    <MoreVertical className="h-5 w-5" />
                                </Menu.Button>
                                <Transition
                                    as={React.Fragment}
                                    enter="transition ease-out duration-100"
                                    enterFrom="transform opacity-0 scale-95"
                                    enterTo="transform opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="transform opacity-100 scale-100"
                                    leaveTo="transform opacity-0 scale-95"
                                >
                                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                        <div className="p-1">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Outils
                                            </div>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        onClick={() => setImportModalOpen(true)}
                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                    >
                                                        <BrainCircuit className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />
                                                        Importer SIEM/EDR
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>

                            <CustomTooltip content="Déclarer un nouvel incident de sécurité">
                                <button
                                    onClick={() => setCreationMode(true)}
                                    className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-brand-600/20"
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    <span className="hidden sm:inline">Déclarer un incident</span>
                                </button>
                            </CustomTooltip>
                        </>
                    )
                }
            />

            <motion.div variants={slideUpVariants} className={viewMode === 'kanban' ? 'h-[600px]' : ''}>
                {viewMode === 'kanban' ? (
                    <IncidentKanban
                        incidents={incidents.filter(i => i.title.toLowerCase().includes(filter.toLowerCase()))}
                        onSelect={(inc: Incident) => { setSelectedIncident(inc); }}
                    />
                ) : (
                    <IncidentDashboard
                        incidents={incidents}
                        filter={filter}
                        viewMode={viewMode}
                        onCreate={() => setCreationMode(true)}
                        onSelect={(inc: Incident) => { setSelectedIncident(inc); }}
                        loading={loading}
                        onDelete={initiateDelete}
                        onBulkDelete={handleBulkDelete}
                    />
                )}
            </motion.div>


            {/* Inspector */}
            <IncidentInspector
                isOpen={!!selectedIncident}
                onClose={() => { setSelectedIncident(null); }}
                incident={selectedIncident}

                users={usersList}
                processes={rawProcesses}
                assets={assets}
                risks={risks}
                canEdit={canEdit}
                onUpdate={handleUpdate}
                isSubmitting={isSubmitting}
            />

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
                        isLoading={isSubmitting}
                    />
                </div>
            </Drawer>
        </motion.div >
    );
};
