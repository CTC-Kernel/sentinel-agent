import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { useStore } from '../store';
import { Incident, UserProfile, Criticality } from '../types';
import { IncidentDashboard } from '../components/incidents/IncidentDashboard';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useIncidents } from '../hooks/useIncidents';
import { useIncidentsData } from '../hooks/incidents/useIncidentsData';

import { PageHeader } from '../components/ui/PageHeader';
import { Siren, Plus, ShieldAlert, BrainCircuit, Clock, AlertTriangle, MoreVertical } from '../components/ui/Icons';


import { PremiumPageControl } from '../components/ui/PremiumPageControl';



import { ErrorLogger } from '../services/errorLogger';
import { useLocation } from 'react-router-dom';
import { Drawer } from '../components/ui/Drawer';
import { IncidentKanban } from '../components/incidents/IncidentKanban';
import { IncidentForm } from '../components/incidents/IncidentForm';
import { IncidentInspector } from '../components/incidents/IncidentInspector';
import { CustomSelect } from '../components/ui/CustomSelect';
import { IncidentFormData } from '../schemas/incidentSchema';

import { canEditResource, hasPermission, canDeleteResource } from '../utils/permissions';
import { IncidentImportModal } from '../components/incidents/IncidentImportModal';
import { SecurityEvent } from '../services/integrationService';


import { SEO } from '../components/SEO';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';

export const Incidents: React.FC = () => {
    const { user, t } = useStore();
    const location = useLocation();

    // Action Hooks
    const {
        addIncident,
        updateIncident,
        deleteIncident,
        deleteIncidentsBulk,
        importIncidentsFromEvents,
        simulateAttack,
        loading: loadingAction
    } = useIncidents();

    // Data Hook
    const {
        sortedIncidents,
        assets,
        risks,
        usersList,
        rawProcesses,
        loading: loadingData
    } = useIncidentsData(user?.organizationId);

    // FIX: Ensure usersList is never empty if logged in
    const effectiveUsers = React.useMemo(() => {
        if (usersList && usersList.length > 0) return usersList;
        if (user && user.uid) return [user as UserProfile];
        return [];
    }, [usersList, user]);

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
    const incidents = React.useMemo(() => {
        return sortedIncidents.filter(incident => {
            const matchesStatus = statusFilter ? incident.status === statusFilter : true;
            const matchesSeverity = severityFilter ? incident.severity === severityFilter : true;
            return matchesStatus && matchesSeverity;
        });
    }, [sortedIncidents, statusFilter, severityFilter]);

    const loading = loadingData;

    const handleImportFromEvents = useCallback(async (events: SecurityEvent[]) => {
        setIsSubmitting(true);
        try {
            await importIncidentsFromEvents(events);
        } catch (error) {
            ErrorLogger.warn('Import handled in hook', 'Incidents.handleImportFromEvents', { metadata: { error } });
        } finally {
            setIsSubmitting(false);
        }
    }, [importIncidentsFromEvents]);

    const handleSimulateAttack = useCallback(async () => {
        setIsSubmitting(true);
        try {
            const result = await simulateAttack();
            if (result) {
                // Auto-select for "Wow" effect
                setSelectedIncident(result);
            }
        } catch (error) {
            // Already handled in hook usually, but strict here
            ErrorLogger.warn('Attack simulation handled in hook', 'Incidents.handleSimulateAttack', { metadata: { error } });
        } finally {
            setIsSubmitting(false);
        }
    }, [simulateAttack]);

    // ... useEffect restored ...
    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || incidents.length === 0) return;
        const incident = incidents.find(i => i.id === state.voxelSelectedId);
        if (incident) {
            setSelectedIncident(incident);
        }
    }, [location.state, loading, incidents]);

    const handleCreate = useCallback(async (data: IncidentFormData) => {
        if (!user?.organizationId || (!canEditResource(user, 'Incident') && !hasPermission(user, 'Incident', 'create'))) return;
        setIsSubmitting(true);
        try {
            await addIncident(data);
            setCreationMode(false);
        } catch (error) {
            ErrorLogger.warn('Creation handled in hook', 'Incidents.handleCreate', { metadata: { error } });
        } finally {
            setIsSubmitting(false);
        }
    }, [user, addIncident]); // removed canEdit since we use canEditResource directly inside

    const handleUpdate = useCallback(async (data: IncidentFormData) => {
        if (!user?.organizationId || !selectedIncident || !canEditResource(user, 'Incident')) return;
        setIsSubmitting(true);
        try {
            const updated = await updateIncident(selectedIncident.id, data, selectedIncident);
            if (updated) {
                setSelectedIncident(updated);
            }
        } catch (error) {
            ErrorLogger.warn('Update handled in hook', 'Incidents.handleUpdate', { metadata: { error } });
        } finally {
            setIsSubmitting(false);
        }
    }, [user, selectedIncident, updateIncident]);

    const handleDelete = useCallback(async (id: string) => {
        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            await deleteIncident(id);
            if (selectedIncident?.id === id) setSelectedIncident(null);
            setConfirmData(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            ErrorLogger.warn('Delete handled in hook', 'Incidents.handleDelete', { metadata: { error } });
        } finally {
            setConfirmData(prev => ({ ...prev, loading: false }));
        }
    }, [deleteIncident, selectedIncident]);

    const initiateDelete = useCallback((id: string) => {
        if (!canDeleteResource(user, 'Incident')) return;
        setConfirmData({
            isOpen: true,
            title: t('incidents.deleteTitle'),
            message: t('incidents.deleteMessage'),
            onConfirm: () => handleDelete(id),
            closeOnConfirm: false
        });
    }, [user, t, handleDelete]);

    const handleBulkDelete = useCallback(async (ids: string[]) => {
        if (!canDeleteResource(user, 'Incident')) return;

        setConfirmData({
            isOpen: true,
            title: t('incidents.deleteBulkTitle'),
            message: t('incidents.deleteBulkMessage', { count: ids.length }),
            onConfirm: async () => {
                setConfirmData(prev => ({ ...prev, loading: true }));
                try {
                    await deleteIncidentsBulk(ids);
                    if (selectedIncident?.id && ids.includes(selectedIncident.id)) setSelectedIncident(null);
                    setConfirmData(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    ErrorLogger.warn('Bulk delete handled in hook', 'Incidents.handleBulkDelete', { metadata: { error } });
                } finally {
                    setConfirmData(prev => ({ ...prev, loading: false }));
                }
            }
        });
    }, [user, t, deleteIncidentsBulk, selectedIncident]);

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

    const breadcrumbs = useMemo(() => {
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
    }, [creationMode, selectedIncident]);

    // UI Handlers
    const handleViewModeChange = useCallback((mode: string) => setViewMode(mode as any), [setViewMode]);
    const handleConfirmClose = useCallback(() => setConfirmData(prev => ({ ...prev, isOpen: false })), []);
    const handleImportModalClose = useCallback(() => setImportModalOpen(false), []);
    const handleStatusFilterChange = useCallback((val: string | string[]) => setStatusFilter(val as string), []);
    const handleSeverityFilterChange = useCallback((val: string | string[]) => setSeverityFilter(val as string), []);
    const handleOpenImport = useCallback(() => setImportModalOpen(true), []);
    const handleOpenCreate = useCallback(() => setCreationMode(true), []);
    const handleSelectIncident = useCallback((inc: Incident) => setSelectedIncident(inc), []);
    const handleInspectorClose = useCallback(() => setSelectedIncident(null), []);
    const handleCloseCreateDrawer = useCallback(() => setCreationMode(false), []);
    const handleCancelCreate = useCallback(() => setCreationMode(false), []);

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
            <ConfirmModal isOpen={confirmData.isOpen} onClose={handleConfirmClose} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} loading={confirmData.loading || loadingAction} closeOnConfirm={confirmData.closeOnConfirm} />

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title={t('incidents.title')}
                    subtitle={t('incidents.subtitle')}
                    icon={<Siren className="h-6 w-6 text-white" strokeWidth={2.5} />}
                    trustType="confidentiality"
                    breadcrumbs={[{ label: t('common.pilotage') }, { label: t('sidebar.incidents') }]}
                />
            </motion.div>

            <IncidentImportModal
                isOpen={importModalOpen}
                onClose={handleImportModalClose}
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
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{t('incidents.activeIncidents')}</span>
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
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('incidents.toTreat')}</p>
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
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('incidents.avgDelay')}</p>
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
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('incidents.volumeTotal')}</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Standardized Page Control */}
            <PremiumPageControl
                searchQuery={filter}
                onSearchChange={setFilter}
                searchPlaceholder={t('risks.searchPlaceholder')}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                actions={
                    canEdit && (
                        <>
                            <div className="hidden md:block w-40 mr-2">
                                <CustomSelect
                                    value={statusFilter}
                                    onChange={handleStatusFilterChange}
                                    options={[
                                        { value: '', label: t('incidents.allStatuses') },
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
                                    onChange={handleSeverityFilterChange}
                                    options={[
                                        { value: '', label: t('incidents.allSeverities') },
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
                                                {t('incidents.tools')}
                                            </div>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        aria-label={t('incidents.importSiem')}
                                                        onClick={handleOpenImport}
                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                    >
                                                        <BrainCircuit className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />
                                                        {t('incidents.importSiem')}
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        aria-label={t('incidents.simulateAttack')}
                                                        onClick={handleSimulateAttack}
                                                        className={`${active ? 'bg-red-500 text-white' : 'text-red-600 dark:text-red-400'
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                    >
                                                        <Siren className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-red-500'}`} />
                                                        {t('incidents.simulateAttack')}
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>

                            <CustomTooltip content={t('incidents.declare')}>
                                <button
                                    aria-label={t('incidents.declare')}
                                    onClick={handleOpenCreate}
                                    className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-brand-600/20"
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    <span className="hidden sm:inline">{t('incidents.declare')}</span>
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
                        onSelect={handleSelectIncident}
                    />
                ) : (
                    <IncidentDashboard
                        incidents={incidents}
                        filter={filter}
                        viewMode={viewMode}
                        onCreate={handleOpenCreate}
                        onSelect={handleSelectIncident}
                        loading={loading}
                        onDelete={initiateDelete}
                        onBulkDelete={handleBulkDelete}
                    />
                )}
            </motion.div>


            {/* Inspector */}
            <IncidentInspector
                isOpen={!!selectedIncident}
                onClose={handleInspectorClose}
                incident={selectedIncident}

                users={effectiveUsers}
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
                onClose={handleCloseCreateDrawer}
                title={t('incidents.declare')}
                subtitle={t('incidents.newIncident')}
                width="max-w-4xl"
                breadcrumbs={breadcrumbs}
            >
                <div className="p-6">
                    <IncidentForm
                        onSubmit={handleCreate}
                        onCancel={handleCancelCreate}
                        users={effectiveUsers}
                        processes={rawProcesses}
                        assets={assets}
                        risks={risks}
                        isLoading={isSubmitting || loadingAction}
                    />
                </div>
            </Drawer>
        </motion.div >
    );
};

// Headless UI handles FocusTrap and keyboard navigation
