import React, { useState, useMemo } from 'react';
// React Router imports removed as handled by hooks
import { SEO } from '../components/SEO';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { motion } from 'framer-motion';

import { useAudits } from '../hooks/audits/useAudits';
import { AuditsList } from '../components/audits/AuditsList';
import { AuditsDrawer } from '../components/audits/AuditsDrawer';
import { AuditsToolbar } from '../components/audits/AuditsToolbar';
import { AuditInspector } from '../components/audits/AuditInspector';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useStore } from '../store';
import { usePersistedState } from '../hooks/usePersistedState';
import { Audit } from '../types';
import { AuditFormData } from '../schemas/auditSchema';
import { PageHeader } from '../components/ui/PageHeader';
import { Calendar as CalendarIcon, List, LayoutDashboard, ClipboardCheck, BookOpen, Activity } from '../components/ui/Icons';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { AuditDashboard } from '../components/audits/AuditDashboard';
import { AuditCalendar } from '../components/audits/AuditCalendar';
import { FindingsList } from '../components/audits/FindingsList';
import { AuditMethodsWorkshops } from '../components/audits/AuditMethodsWorkshops';

import { ImportService } from '../services/ImportService';
import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { OnboardingService } from '../services/onboardingService';
import { useDeepLinkAction } from '../hooks/useDeepLinkAction';
import { AuditPremiumStats } from '../components/audits/AuditPremiumStats';
import { useActivityLogs } from '../hooks/useActivityLogs';
import { ActivityLogList } from '../components/activity/ActivityLogList';

export const Audits: React.FC = () => {
    const { t } = useStore();

    // Activity logs for audit-trail tab
    const { logs: activityLogs, loading: activityLoading, hasMore: activityHasMore, loadMore: loadMoreActivity } = useActivityLogs();

    // Start module tour
    React.useEffect(() => {
        const timer = setTimeout(() => {
            OnboardingService.startAuditsTour();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    // Local UI State (Hoisted to top for useAudits)
    const [activeTab, setActiveTab] = usePersistedState<'overview' | 'list' | 'calendar' | 'findings' | 'methods' | 'audit-trail'>('audits-active-tab', 'overview');
    const [creationMode, setCreationMode] = useState(false);
    const [editingAudit, setEditingAudit] = useState<Audit | null>(null);
    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);

    // Optimized Data Fetching
    const needsDependencies = creationMode || !!editingAudit || !!selectedAudit;
    const isListView = activeTab === 'list';
    const isFindingsView = activeTab === 'findings';

    const {
        audits, loading, canEdit, canDelete, controls, documents, assets, risks, usersList, projects,
        handleDeleteAudit, handleGeneratePlan, handleCreateAudit, handleUpdateAudit,
        refreshAudits, handleExportCSV, handleExportCalendar, bulkDeleteAudits, checkDependencies, importAudits
    } = useAudits({
        fetchUsers: needsDependencies || isListView, // Users needed for list avatars and forms
        fetchControls: needsDependencies,
        fetchAssets: needsDependencies,
        fetchRisks: needsDependencies,
        fetchProjects: needsDependencies,
        fetchDocuments: needsDependencies,
        fetchFindings: isFindingsView // Only load all findings if viewing the findings tab
    });
    const [selectedAudits, setSelectedAudits] = useState<string[]>([]);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    // URL Params for Deep Linking
    // searchParams handled by hook

    // Deep Link Hook
    useDeepLinkAction({
        data: audits,
        loading,
        currentSelection: selectedAudit,
        isCreationMode: creationMode,
        onOpen: setSelectedAudit,
        onCreate: () => {
            setEditingAudit(null);
            setCreationMode(true);
        }
    });

    const tabs = [
        { id: 'overview', label: t('audits.dashboard'), icon: LayoutDashboard },
        { id: 'list', label: t('audits.list'), icon: List },
        { id: 'calendar', label: t('audits.calendar'), icon: CalendarIcon },
        { id: 'findings', label: t('audits.findings'), icon: ClipboardCheck },
        { id: 'methods', label: t('audits.methods') || 'Méthodes', icon: BookOpen },
        { id: 'audit-trail', label: t('audits.auditTrail') || 'Journal d\'audit', icon: Activity },
    ];

    // Filter Logic
    const filteredAudits = useMemo(() => {
        return audits.filter(audit => {
            const matchesSearch =
                audit.name.toLowerCase().includes(filter.toLowerCase()) ||
                audit.auditor?.toLowerCase().includes(filter.toLowerCase()) ||
                audit.type?.toLowerCase().includes(filter.toLowerCase());
            const matchesStatus = statusFilter ? audit.status === statusFilter : true;
            const matchesType = typeFilter ? audit.type === typeFilter : true;

            return matchesSearch && matchesStatus && matchesType;
        });
    }, [audits, filter, statusFilter, typeFilter]);

    // Handle "View" or "Edit" Logic
    const handleEdit = (audit: Audit) => {
        setEditingAudit(audit);
        setCreationMode(true);
    };

    const handleDelete = async (audit: Audit) => {
        if (!canDelete) return;
        // Dependencies check
        const { hasDependencies, dependencies } = await checkDependencies(audit.id);

        let message = t('audits.deleteMessage');
        if (hasDependencies && dependencies && dependencies.length > 0) {
            const depDetails = dependencies.slice(0, 5).map((d: { type: string; name: string }) => `${d.type}: ${d.name}`).join(', ');
            const count = dependencies.length;
            message = t('audits.deleteWarning', { count, details: depDetails + (count > 5 ? '...' : '') });
        }

        setConfirmData({
            isOpen: true,
            title: t('audits.deleteTitle'),
            message: message,
            onConfirm: () => handleDeleteAudit(audit.id, audit.name)
        });
    };

    const handleBulkDelete = () => {
        if (!canDelete) return;
        if (selectedAudits.length === 0) return;
        setConfirmData({ // confirmDialog via ConfirmModal
            isOpen: true,
            title: t('audits.deleteBulkTitle', { count: selectedAudits.length }),
            message: t('audits.deleteBulkMessage'),
            onConfirm: async () => {
                await bulkDeleteAudits(selectedAudits);
                setSelectedAudits([]);
            }
        });
    };

    const handleOpen = (audit: Audit) => {
        setSelectedAudit(audit);
    };

    const onFormSubmit = async (data: AuditFormData) => {
        if (!canEdit) return;
        if (editingAudit) {
            await handleUpdateAudit(editingAudit.id, data);
        } else {
            await handleCreateAudit(data);
        }
        setCreationMode(false);
        setEditingAudit(null);
    };

    // Import Logic
    const [importModalOpen, setImportModalOpen] = useState(false);
    const auditGuidelines = {
        required: ['Nom'],
        optional: ['Type', 'Statut', 'Auditeur', 'Date', 'Description'],
        format: 'CSV'
    };

    const handleDownloadTemplate = React.useCallback(() => {
        ImportService.downloadAuditTemplate();
    }, []);

    const handleImportFile = React.useCallback(async (file: File) => {
        if (!file) return;
        const text = await file.text();
        await importAudits(text);
        setImportModalOpen(false);
    }, [importAudits]);

    // Role-based Title

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24">
            <MasterpieceBackground />
            <SEO title={t('audits.title')} description={t('audits.subtitle')} />

            <PageHeader
                title={t('audits.title')}
                subtitle={t('audits.subtitle')}
                icon={
                    <img
                        src="/images/pilotage.png"
                        alt="PILOTAGE"
                        className="w-full h-full object-contain"
                    />
                }
            />

            <div className="mb-6">
                <ScrollableTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as 'overview' | 'list' | 'calendar' | 'findings' | 'methods' | 'audit-trail')}
                />
            </div>

            <AuditPremiumStats
                audits={filteredAudits}
                findingsCount={filteredAudits.flatMap(a => a.findings || []).filter(f => f.status === 'Ouvert').length}
            />

            <AuditsToolbar
                searchQuery={filter}
                onSearchChange={setFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilter}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as 'overview' | 'list' | 'calendar' | 'findings' | 'methods' | 'audit-trail')}
                selectedAudits={selectedAudits}
                handleBulkDelete={handleBulkDelete}
                handleExportCalendar={handleExportCalendar}
                handleExportCSV={handleExportCSV}
                setImportModalOpen={setImportModalOpen}
                handleGeneratePlan={handleGeneratePlan}
                handleCreateAudit={() => {
                    setEditingAudit(null);
                    setCreationMode(true);
                }}
                canEdit={canEdit}
                canDelete={canDelete}
                loading={loading}
            />

            {
                activeTab === 'overview' && (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible">
                        <div data-tour="audits-dashboard">
                            <AuditDashboard
                                audits={filteredAudits}
                                findings={filteredAudits.flatMap(a => a.findings || [])}
                                loading={loading}
                                onFilterChange={(f) => {
                                    if (f?.type === 'status') {
                                        setFilter(f.value);
                                        setActiveTab('list');
                                    }
                                }}
                            />
                        </div>
                    </motion.div>
                )
            }

            {
                activeTab === 'list' && (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible" className="space-y-6 sm:space-y-8">
                        <div className="glass-premium overflow-hidden rounded-3xl border border-white/60 dark:border-white/5 shadow-apple-sm">
                            <AuditsList
                                audits={filteredAudits}
                                isLoading={loading}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onOpen={handleOpen}
                                canEdit={canEdit}
                                canDelete={canDelete}
                                selectedIds={selectedAudits}
                                onSelect={setSelectedAudits}
                                users={usersList}
                            />
                        </div>
                    </motion.div>
                )
            }

            {
                activeTab === 'calendar' && (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible">
                        <AuditCalendar
                            audits={filteredAudits}
                            loading={loading}
                            onAuditClick={handleOpen}
                        />
                    </motion.div>
                )
            }

            {
                activeTab === 'findings' && (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible">
                        <motion.div variants={slideUpVariants} initial="initial" animate="visible">
                            <FindingsList audits={filteredAudits} loading={loading} onOpenAudit={handleOpen} />
                        </motion.div>
                    </motion.div>
                )
            }

            {
                activeTab === 'methods' && (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible">
                        <AuditMethodsWorkshops
                            onStartWorkshop={(_templateId) => {
                                // TODO: Implement workshop start functionality
                            }}
                        />
                    </motion.div>
                )
            }

            {
                activeTab === 'audit-trail' && (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible">
                        <div className="glass-premium rounded-3xl p-6 border border-white/60 dark:border-white/5">
                            <ActivityLogList
                                logs={activityLogs}
                                loading={activityLoading}
                                hasMore={activityHasMore}
                                onLoadMore={loadMoreActivity}
                            />
                        </div>
                    </motion.div>
                )
            }

            {/* Creation/Edit Drawer */}
            <AuditsDrawer
                creationMode={creationMode}
                editingAudit={editingAudit}
                onClose={() => {
                    setCreationMode(false);
                    setEditingAudit(null);
                }}
                onFormSubmit={onFormSubmit}
                isLoading={loading}
                assets={assets}
                risks={risks}
                controls={controls}
                projects={projects}
                usersList={usersList}
            />

            {/* Inspector (separat from Drawer) */}
            {selectedAudit && (
                <AuditInspector
                    audit={selectedAudit}
                    onClose={() => setSelectedAudit(null)}
                    controls={controls}
                    documents={documents}
                    assets={assets}
                    risks={risks}
                    projects={projects}
                    usersList={usersList}
                    refreshAudits={refreshAudits}
                    canEdit={canEdit}
                    onDelete={(id, name) => handleDelete({ id, name } as Audit)}
                />
            )}

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <ImportGuidelinesModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                entityName={t('audits.title')}
                guidelines={auditGuidelines}
                onImport={handleImportFile}
                onDownloadTemplate={handleDownloadTemplate}
            />
        </motion.div >
    );
};

// Headless UI handles FocusTrap and keyboard navigation
