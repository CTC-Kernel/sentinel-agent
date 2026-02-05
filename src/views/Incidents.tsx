import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cn } from '../lib/utils';

import { Menu, Transition } from '@headlessui/react';
import { useStore } from '../store';
import { Incident, UserProfile, Criticality } from '../types';
import { IncidentDashboard } from '../components/incidents/IncidentDashboard';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useIncidentData } from '../hooks/incidents/useIncidentData';
import { useIncidentActions } from '../hooks/incidents/useIncidentActions';
import { useIncidentDependencies } from '../hooks/incidents/useIncidentDependencies';
import { useIncidentExport } from '../hooks/incidents/useIncidentExport';

import { PageHeader } from '../components/ui/PageHeader';
import { Plus, Download, LayoutDashboard, List as ListIcon, MoreVertical, BrainCircuit, Siren } from '../components/ui/Icons';

import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { Button } from '../components/ui/button';

import { ErrorLogger } from '../services/errorLogger';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Drawer } from '../components/ui/Drawer';
// Lazy Loading Heavy Components
const IncidentKanban = React.lazy(() => import('../components/incidents/IncidentKanban').then(m => ({ default: m.IncidentKanban })));
const IncidentForm = React.lazy(() => import('../components/incidents/IncidentForm').then(m => ({ default: m.IncidentForm })));
const IncidentInspector = React.lazy(() => import('../components/incidents/IncidentInspector').then(m => ({ default: m.IncidentInspector })));

import { IncidentOverview } from '../components/incidents/dashboard/IncidentOverview';
import { useAgentData } from '../hooks/useAgentData';
import { CustomSelect } from '../components/ui/CustomSelect';
import { IncidentFormData } from '../schemas/incidentSchema';

import { canEditResource, hasPermission, canDeleteResource } from '../utils/permissions';
import { IncidentImportModal } from '../components/incidents/IncidentImportModal';
import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { ImportService } from '../services/ImportService';
import { SecurityEvent } from '../services/integrationService';

import { SEO } from '../components/SEO';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { usePersistedState } from '../hooks/usePersistedState';
import { OnboardingService } from '../services/onboardingService';

// Spinner from shared component
import { Spinner as SpinnerIcon } from '@/components/ui/Spinner';
const Spinner = () => <div className="flex items-center justify-center p-8"><SpinnerIcon size="lg" className="text-primary" /></div>;

import { useAuth } from '../hooks/useAuth';

export const Incidents: React.FC = () => {
 const { user, claimsSynced, loading: authLoading } = useAuth();
 const { t, addToast } = useStore();
 const location = useLocation();

 // Start module tour
 useEffect(() => {
 const timer = setTimeout(() => {
 OnboardingService.startIncidentsTour();
 }, 1000);
 return () => clearTimeout(timer);
 }, []);

 // State Declarations - Lifted up
 const [creationMode, setCreationMode] = useState(false);
 const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
 const [confirmData, setConfirmData] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, loading?: boolean, closeOnConfirm?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [importModalOpen, setImportModalOpen] = useState(false);
 const [csvImportOpen, setCsvImportOpen] = useState(false);
 const [viewMode, setViewMode] = useState<'list' | 'grid' | 'kanban'>('grid');
 const [filter, setFilter] = useState('');
 const [statusFilter, setStatusFilter] = useState('');
 const [severityFilter, setSeverityFilter] = useState('');
 const [activeTab, setActiveTab] = usePersistedState<string>('incidents-active-tab', 'overview');
 const [isFormDirty, setIsFormDirty] = useState(false);

 useEffect(() => {
 setFilter('');
 setStatusFilter('');
 setSeverityFilter('');
 }, [activeTab]);
 const pendingSelectId = useRef<string | null>(null);

 // Optimized Data Hooks
 const {
 incidents: sortedIncidents,
 loading: loadingData,
 refreshIncidents
 } = useIncidentData(user?.organizationId, claimsSynced);

 const {
 addIncident,
 updateIncident,
 deleteIncident,
 deleteIncidentsBulk,
 importIncidentsFromEvents,
 importIncidents,
 simulateAttack,
 loading: loadingAction
 } = useIncidentActions();

 // Lazy load dependencies
 const shouldLoadDeps = !!selectedIncident || creationMode || importModalOpen || csvImportOpen;
 const {
 assets,
 risks,
 processes: rawProcesses,
 usersList,
 loading: loadingDeps
 } = useIncidentDependencies({
 fetchAssets: shouldLoadDeps,
 fetchRisks: shouldLoadDeps,
 fetchProcesses: shouldLoadDeps,
 fetchUsers: shouldLoadDeps || viewMode === 'list' // Authors might differ in list view
 }, claimsSynced);

 // FIX: Ensure usersList is never empty if logged in
 const effectiveUsers = React.useMemo(() => {
 if (usersList && usersList.length > 0) return usersList;
 if (user && user.uid) return [user as UserProfile];
 return [];
 }, [usersList, user]);

 // Derived State
 const incidents = React.useMemo(() => {
 return sortedIncidents.filter(incident => {
 const matchesStatus = statusFilter ? incident.status === statusFilter : true;
 const matchesSeverity = severityFilter ? incident.severity === severityFilter : true;
 return matchesStatus && matchesSeverity;
 });
 }, [sortedIncidents, statusFilter, severityFilter]);

 const loading = authLoading || !claimsSynced || loadingData || (shouldLoadDeps && loadingDeps);

 // Agent data for overview dashboard
 const { agents } = useAgentData();

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

 // CSV Import Handlers
 const incidentGuidelines = {
 required: [t('common.name')],
 optional: [t('common.description'), t('common.status'), t('common.criticality'), t('common.category'), t('incidents.author')],
 format: 'CSV'
 };

 const handleDownloadTemplate = React.useCallback(() => {
 ImportService.downloadIncidentTemplate();
 }, []);

 const handleImportCsvFile = React.useCallback(async (file: File) => {
 if (!file) return;
 // File size check to prevent UI freeze (max 5MB / ~50k rows)
 const MAX_CSV_SIZE = 5 * 1024 * 1024;
 if (file.size > MAX_CSV_SIZE) {
 const { addToast } = useStore.getState();
 addToast(t('incidents.csvTooLarge', { defaultValue: 'Le fichier CSV est trop volumineux (max 5 Mo). Veuillez r\u00e9duire le nombre de lignes.' }), 'error');
 return;
 }
 const text = await file.text();
 const lineCount = text.split('\n').filter(l => l.trim()).length;
 if (lineCount > 10000) {
 const { addToast } = useStore.getState();
 addToast(t('incidents.csvTooManyRows', { defaultValue: 'Le fichier contient trop de lignes (max 10 000). Veuillez le d\u00e9couper.' }), 'error');
 return;
 }
 await importIncidents(text);
 setCsvImportOpen(false);
 }, [importIncidents, t]);

 const { exportCSV } = useIncidentExport();
 const handleExportCSV = useCallback(() => exportCSV(incidents), [exportCSV, incidents]);

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

 // URL Params
 const [searchParams, setSearchParams] = useSearchParams();
 const deepLinkIncidentId = searchParams.get('id');
 const deepLinkAction = searchParams.get('action');

 // Deep Link Effect
 useEffect(() => {
 if (loading) return;

 // 1. Open Inspector
 if (deepLinkIncidentId && incidents.length > 0) {
 const incident = incidents.find(i => i.id === deepLinkIncidentId);
 if (incident && selectedIncident?.id !== incident.id) {
 setSelectedIncident(incident);
 // Also switch to incidents tab if inspecting
 setActiveTab('incidents');
 }
 }

 // 2. Open Creation Mode
 if (deepLinkAction === 'create' && !creationMode) {
 setCreationMode(true);
 setActiveTab('incidents');
 // Consume action immediately
 setSearchParams(params => {
 params.delete('action');
 return params;
 }, { replace: true });
 }
 }, [loading, deepLinkIncidentId, deepLinkAction, incidents, creationMode, selectedIncident, setSearchParams, setActiveTab]);

 // Cleanup Effect
 useEffect(() => {
 if (loading) return;

 if (!selectedIncident && deepLinkIncidentId) {
 setSearchParams(params => {
 params.delete('id');
 return params;
 }, { replace: true });
 }
 }, [selectedIncident, deepLinkIncidentId, setSearchParams, loading]);

 // Auto-open inspector on newly created incident
 useEffect(() => {
 if (!pendingSelectId.current || loading) return;
 const created = sortedIncidents.find(i => i.id === pendingSelectId.current);
 if (created) {
 pendingSelectId.current = null;
 setSelectedIncident(created);
 }
 }, [sortedIncidents, loading]);

 useEffect(() => {
 const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
 if (!state.fromVoxel || !state.voxelSelectedId) return;
 if (loading || incidents.length === 0) return;
 const incident = incidents.find(i => i.id === state.voxelSelectedId);
 if (incident) {
 setSelectedIncident(incident);
 setActiveTab('incidents');
 }
 }, [location.state, loading, incidents, setActiveTab]);

 const handleCreate = useCallback(async (data: IncidentFormData) => {
 if (!user?.organizationId || (!canEditResource(user, 'Incident') && !hasPermission(user, 'Incident', 'create'))) return;
 setIsSubmitting(true);
 try {
 const newId = await addIncident(data);
 if (newId) {
 pendingSelectId.current = newId;
 }
 setIsFormDirty(false);
 setCreationMode(false);
 setActiveTab('incidents');
 } catch (error) {
 ErrorLogger.warn('Creation handled in hook', 'Incidents.handleCreate', { metadata: { error } });
 } finally {
 setIsSubmitting(false);
 }
 }, [user, addIncident, setActiveTab]);

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
 addToast(t('incidents.deleted', { defaultValue: 'Incident supprimé' }), 'info');
 } catch (error) {
 ErrorLogger.warn('Delete handled in hook', 'Incidents.handleDelete', { metadata: { error } });
 } finally {
 setConfirmData(prev => ({ ...prev, loading: false }));
 }
 }, [deleteIncident, selectedIncident, addToast, t]);

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
 const canCreate = hasPermission(user, 'Incident', 'create');
 // Note: incidentStats available via useIncidentStats hook if needed for dashboard

 const breadcrumbs = useMemo(() => {
 const crumbs: { label: string; onClick?: () => void }[] = [{ label: t('incidents.title'), onClick: () => { setSelectedIncident(null); setCreationMode(false); } }];

 if (creationMode) {
 crumbs.push({ label: t('incidents.declare') });
 return crumbs;
 }

 if (selectedIncident) {
 if (selectedIncident.category) {
 crumbs.push({ label: selectedIncident.category });
 }
 crumbs.push({ label: selectedIncident.title });
 }

 return crumbs;
 }, [creationMode, selectedIncident, t]);

 // UI Handlers
 const handleViewModeChange = useCallback((mode: string) => setViewMode(mode as 'list' | 'grid' | 'kanban'), [setViewMode]);
 const handleConfirmClose = useCallback(() => setConfirmData(prev => ({ ...prev, isOpen: false })), []);
 const handleImportModalClose = useCallback(() => setImportModalOpen(false), []);
 const handleStatusFilterChange = useCallback((val: string | string[]) => setStatusFilter(val as string), []);
 const handleSeverityFilterChange = useCallback((val: string | string[]) => setSeverityFilter(val as string), []);
 const handleOpenImport = useCallback(() => setImportModalOpen(true), []);
 const handleOpenCreate = useCallback(() => setCreationMode(true), []);
 const handleSelectIncident = useCallback((inc: Incident) => setSelectedIncident(inc), []);
 const handleInspectorClose = useCallback(() => setSelectedIncident(null), []);
 const handleCloseCreateDrawer = useCallback(() => { setCreationMode(false); setIsFormDirty(false); }, []);
 const handleCancelCreate = useCallback(() => { setCreationMode(false); setIsFormDirty(false); }, []);

 const tabs = [
 { id: 'overview', label: t('common.overview'), icon: LayoutDashboard },
 { id: 'incidents', label: t('incidents.title'), icon: ListIcon, count: incidents.length }
 ];

 return (
 <motion.div
 variants={staggerContainerVariants}
 initial="initial"
 animate="visible"
 className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
 >
 <MasterpieceBackground />
 <SEO
 title={t('incidents.title')}
 description={t('incidents.seoDescription')}
 keywords={t('incidents.seoKeywords')}
 />
 <ConfirmModal isOpen={confirmData.isOpen} onClose={handleConfirmClose} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} loading={confirmData.loading || loadingAction} closeOnConfirm={confirmData.closeOnConfirm} />

 <motion.div variants={slideUpVariants}>
 <PageHeader
  title={t('incidents.title')}
  subtitle={t('incidents.subtitle')}
  icon={
  <img
  src="/images/operations.png"
  alt="OPÉRATIONS"
  className="w-full h-full object-contain"
  />
  }
  trustType={undefined}
 />
 </motion.div>

 <motion.div variants={slideUpVariants}>
 <ScrollableTabs
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  className="mb-6"
  isChanging={loading}
 />
 </motion.div>

 <IncidentImportModal
 isOpen={importModalOpen}
 onClose={handleImportModalClose}
 onImport={handleImportFromEvents}
 />

 <ImportGuidelinesModal
 isOpen={csvImportOpen}
 onClose={() => setCsvImportOpen(false)}
 entityName={t('incidents.title')}
 guidelines={incidentGuidelines}
 onImport={handleImportCsvFile}
 onDownloadTemplate={handleDownloadTemplate}
 />

 <AnimatePresence mode="wait">
 {activeTab === 'overview' ? (
  <motion.div
  key="overview"
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.2 }}
  >
  <IncidentOverview incidents={sortedIncidents} agents={agents} loading={loading} />
  </motion.div>
 ) : (
  <motion.div
  key="incidents"
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.2 }}
  className="space-y-6"
  >
  {/* Standardized Page Control */}
  <PremiumPageControl
  searchQuery={filter}
  onSearchChange={setFilter}
  onRefresh={refreshIncidents}
  searchPlaceholder={t('incidents.searchPlaceholder', { defaultValue: 'Rechercher un incident...' })}
  viewMode={viewMode}
  onViewModeChange={handleViewModeChange}
  actions={
  <>
   <div className="w-full md:w-40 mr-2">
   <CustomSelect
   value={statusFilter}
   onChange={handleStatusFilterChange}
   options={[
   { value: '', label: t('incidents.allStatuses') },
   { value: 'Nouveau', label: t('incidents.status.new') },
   { value: 'Analyse', label: t('incidents.status.analysis') },
   { value: 'Contenu', label: t('incidents.status.containment') },
   { value: 'Résolu', label: t('incidents.status.resolved') },
   { value: 'Fermé', label: t('incidents.status.closed') }
   ]}
   placeholder={t('incidents.statusFilter')}
   />
   </div>
   <div className="w-full md:w-40 mr-4">
   <CustomSelect
   value={severityFilter}
   onChange={handleSeverityFilterChange}
   options={[
   { value: '', label: t('incidents.allSeverities') },
   { value: Criticality.CRITICAL, label: t('incidents.severity.critical') },
   { value: Criticality.HIGH, label: t('incidents.severity.high') },
   { value: Criticality.MEDIUM, label: t('incidents.severity.medium') },
   { value: Criticality.LOW, label: t('incidents.severity.low') }
   ]}
   placeholder={t('incidents.severityFilter')}
   />
   </div>
   <div className="h-8 w-px bg-border mx-2 hidden md:block" />

   <Menu as="div" className="relative inline-block text-left">
   <Menu.Button className="p-2 bg-background border border-border text-foreground rounded-xl hover:bg-muted/50 transition-colors shadow-sm">
   <MoreVertical className="h-5 w-5" />
   </Menu.Button>
   <Transition
   as={React.Fragment}
   enter="transition ease-apple duration-normal"
   enterFrom="transform opacity-0 scale-95 translate-y-2"
   enterTo="transform opacity-100 scale-100 translate-y-0"
   leave="transition ease-apple duration-fast"
   leaveFrom="transform opacity-100 scale-100 translate-y-0"
   leaveTo="transform opacity-0 scale-95 translate-y-2"
   >
   <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-border/20 rounded-xl bg-background/95 backdrop-blur-xl text-popover-foreground shadow-premium ring-1 ring-border/40 focus:outline-none z-dropdown overflow-hidden">
   <div className="p-1.5 bg-[var(--glass-bg)]">
    <div className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-70">
    {t('incidents.tools')}
    </div>
    {canEdit && (
    <>
    <Menu.Item>
    {({ active }) => (
     <button
     aria-label={t('incidents.importSiem')}
     onClick={handleOpenImport}
     className={cn(
     "group flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-normal ease-apple",
     active ? "bg-primary text-primary-foreground shadow-md" : "text-foreground hover:bg-muted/50"
     )}
     >
     <BrainCircuit className={cn("mr-2.5 h-4 w-4", active ? "text-primary-foreground" : "text-muted-foreground")} />
     {t('incidents.importSiem')}
     </button>
    )}
    </Menu.Item>
    <Menu.Item>
    {({ active }) => (
     <button
     aria-label={t('incidents.simulateAttack')}
     onClick={handleSimulateAttack}
     className={cn(
     "group flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-normal ease-apple",
     active ? "bg-destructive text-destructive-foreground shadow-md" : "text-destructive hover:bg-destructive/10"
     )}
     >
     <Siren className={cn("mr-2.5 h-4 w-4", active ? "text-destructive-foreground" : "text-destructive")} />
     {t('incidents.simulateAttack')}
     </button>
    )}
    </Menu.Item>
    <Menu.Item>
    {({ active }) => (
     <button
     onClick={() => setCsvImportOpen(true)}
     className={cn(
     "group flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-normal ease-apple",
     active ? "bg-primary text-primary-foreground shadow-md" : "text-foreground hover:bg-muted/50"
     )}
     >
     <ListIcon className={cn("mr-2.5 h-4 w-4", active ? "text-primary-foreground" : "text-muted-foreground")} />
     {t('common.importCsv')}
     </button>
    )}
    </Menu.Item>
    </>
    )}
    <Menu.Item>
    {({ active }) => (
    <button
    aria-label={t('common.exportCsv')}
    onClick={handleExportCSV}
    className={cn(
     "group flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-normal ease-apple",
     active ? "bg-primary text-primary-foreground shadow-md" : "text-foreground hover:bg-muted/50"
    )}
    >
    <Download className={cn("mr-2.5 h-4 w-4", active ? "text-primary-foreground" : "text-muted-foreground")} />
    {t('common.exportCsv')}
    </button>
    )}
    </Menu.Item>
   </div>
   </Menu.Items>
   </Transition>
   </Menu>

   {(canEdit || canCreate) && (
   <CustomTooltip content={t('incidents.declare')}>
   <Button
   aria-label={t('incidents.declare')}
   onClick={handleOpenCreate}
   className="flex items-center px-4 py-2 rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95"
   >
   <Plus className="h-5 w-5 mr-2" />
   <span className="hidden sm:inline uppercase tracking-wider text-xs">{t('incidents.declare')}</span>
   </Button>
   </CustomTooltip>
   )}
  </>
  }
  />

  {/* Incidents Board */}
  <motion.div variants={slideUpVariants} className={viewMode === 'kanban' ? 'h-[600px]' : ''}>
  {viewMode === 'kanban' ? (
  <React.Suspense fallback={<Spinner />}>
   <IncidentKanban
   incidents={incidents.filter(i => i.title.toLowerCase().includes(filter.toLowerCase()))}
   onSelect={handleSelectIncident}
   onEdit={(inc) => {
   setSelectedIncident(inc);
   setCreationMode(false);
   }}
   onDelete={initiateDelete}
   canEdit={canEdit}
   loading={loading}
   />
  </React.Suspense>
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
   users={effectiveUsers}
  />
  )}
  </motion.div>
  </motion.div>
 )}
 </AnimatePresence>

 {/* Inspector */}
 <React.Suspense fallback={null}>
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
  onDelete={initiateDelete}
  isSubmitting={isSubmitting}
 />
 </React.Suspense>

 {/* Create Drawer */}
 <Drawer
 isOpen={creationMode}
 onClose={handleCloseCreateDrawer}
 title={t('incidents.declare')}
 subtitle={t('incidents.newIncident')}
 width="max-w-6xl"
 breadcrumbs={breadcrumbs}
 hasUnsavedChanges={isFormDirty}
 >
 <div className="p-6">
  <React.Suspense fallback={<Spinner />}>
  <IncidentForm
  onSubmit={handleCreate}
  onCancel={handleCancelCreate}
  onDirtyChange={setIsFormDirty}
  users={effectiveUsers}
  processes={rawProcesses}
  assets={assets}
  risks={risks}
  isLoading={isSubmitting || loadingAction}
  />
  </React.Suspense>
 </div>
 </Drawer>
 </motion.div >
 );
};

// Headless UI handles FocusTrap and keyboard navigation
