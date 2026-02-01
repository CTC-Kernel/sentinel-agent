import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { staggerContainerVariants } from '../components/ui/animationVariants';

import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { Control, Framework } from '../types';

// Interface étendue pour les contrôles avec propriétés optionnelles
interface ControlExtended extends Control {
    linkedProjectId?: string;
    linkedAuditId?: string;
}
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { useComplianceActions } from '../hooks/useComplianceActions';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { canEditResource } from '../utils/permissions';
import { ComplianceDrawer } from '../components/compliance/ComplianceDrawer';
import { useComplianceData } from '../hooks/useComplianceData';
import { useComplianceDataSeeder } from '../hooks/useComplianceDataSeeder';
import { useProjectLogic } from '../hooks/projects/useProjectLogic';
import { useDocumentActions } from '../hooks/documents/useDocumentActions';
import { useDocumentsData } from '../hooks/documents/useDocumentsData';
import { FRAMEWORKS } from '../data/frameworks';
import { ComplianceDashboard } from '../components/compliance/ComplianceDashboard';
import { ComplianceList } from '../components/compliance/ComplianceList';
import { FrameworkMappingMatrix } from '../components/compliance/FrameworkMappingMatrix';
import { SharedRequirementsView } from '../components/compliance/SharedRequirementsView';
import { usePersistedState } from '../hooks/usePersistedState';
import { ShieldCheck, Download, LayoutDashboard, ListChecks, FileText, AlertTriangle, Layers, Link, Archive } from '../components/ui/Icons';
import { toast } from '@/lib/toast';
import { SoAView } from '../components/compliance/SoAView';
import { Button } from '../components/ui/button';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ProjectFormData } from '../schemas/projectSchema';
import { ErrorLogger } from '../services/errorLogger';
import { CONTROL_STATUS } from '../constants/complianceConfig';
import { DocumentUploadWizard } from '../components/documents/DocumentUploadWizard';
import { ControlEffectivenessDashboard } from '../components/controls/dashboard/ControlEffectivenessDashboard';
import { ControlEffectivenessManager } from '../components/controls/ControlEffectivenessManager';
import { AssessmentFormModal } from '../components/controls/AssessmentFormModal';
import { useControlEffectiveness } from '../hooks/controls/useControlEffectiveness';
import { BarChart3, Award } from '../components/ui/Icons';
import Homologation from './Homologation';
// Initialisation du service d'onboarding
import { OnboardingService } from '../services/onboardingService';
import { EvidenceDossierService } from '../services/EvidenceDossierService';
import { ComplianceStatsWidget } from '../components/compliance/ComplianceStatsWidget';

type ComplianceTab = 'overview' | 'controls' | 'mapping' | 'shared' | 'soa' | 'efficiency' | 'homologation';

export const Compliance: React.FC = () => {
    const { user, addToast, t, organization, activeFramework, setActiveFramework } = useStore();
    const { claimsSynced, loading: authLoading } = useAuth();
    const location = useLocation();
    const canEdit = canEditResource(user, 'Control');

    // Start module tour
    useEffect(() => {
        const timer = setTimeout(() => {
            OnboardingService.startComplianceTour();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    // Filter frameworks by organization's enabled frameworks
    const enabledComplianceFrameworks = useMemo(() => {
        // We now want to show ALL framework types (Risk, Governance, Compliance) in this view
        // so the user has a central place to see all their chosen standards.
        const allFrameworks = FRAMEWORKS;
        const enabled = organization?.enabledFrameworks;

        // If no frameworks enabled, show all default compliance frameworks (fallback for new orgs)
        if (!enabled || enabled.length === 0) {
            // FIX: If plan is discovery, restrict to a default one (e.g. ISO27001) to avoid overwhelming
            const planId = organization?.subscription?.planId || 'discovery';
            if (planId === 'discovery') {
                return allFrameworks.filter(f => f.id === 'ISO27001');
            }
            return allFrameworks.filter(f => f.type === 'Compliance');
        }

        // Filter to only show enabled frameworks (ANY type)
        // We filter FRAMEWORKS array to preserve order and metadata
        return allFrameworks.filter(f => enabled.includes(f.id as Framework));
    }, [organization?.enabledFrameworks, organization?.subscription?.planId]);

    // Tab state
    const [activeTab, setActiveTab] = usePersistedState<ComplianceTab>('compliance-active-tab', 'overview');

    // Link to global store choice
    // If no framework is active, try to pick the first enabled one
    useEffect(() => {
        if (!activeFramework && enabledComplianceFrameworks.length > 0) {
            setActiveFramework(enabledComplianceFrameworks[0].id as Framework);
        } else if (activeFramework && !enabledComplianceFrameworks.some(f => f.id === activeFramework)) {
            // If currently selected framework is no longer enabled, fallback
            setActiveFramework(enabledComplianceFrameworks.length > 0 ? enabledComplianceFrameworks[0].id as Framework : 'ISO27001');
        }
    }, [enabledComplianceFrameworks, activeFramework, setActiveFramework]);

    // Derived state for rendering to avoid null flashes
    const currentFrameworkId = useMemo(() => {
        if (activeFramework && enabledComplianceFrameworks.some(f => f.id === activeFramework)) {
            return activeFramework as Framework;
        }
        return enabledComplianceFrameworks.length > 0 ? (enabledComplianceFrameworks[0].id as Framework) : 'ISO27001';
    }, [activeFramework, enabledComplianceFrameworks]);

    const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showMissingEvidence, setShowMissingEvidence] = useState(false);
    const [uploadWizardOpen, setUploadWizardOpen] = useState(false);
    const [generatingDossier, setGeneratingDossier] = useState(false);
    const [showAssessmentForm, setShowAssessmentForm] = useState(false);
    const [selectedEffControl, setSelectedEffControl] = useState<{ code: string; name: string } | null>(null);
    const deepLinkProcessedRef = useRef(false);

    const {
        assessments,
        domainScores,
        loading: effLoading,
        error: effError,
        createAssessment
    } = useControlEffectiveness();

    const handleOpenAssessment = (control?: { code: string; name: string }) => {
        setSelectedEffControl(control || null);
        setShowAssessmentForm(true);
    };

    const handleAssessmentSubmit = async (data: { controlId: string; controlCode: string; effectivenessScore: number; assessmentMethod: string; }) => {
        await createAssessment(data);
        setShowAssessmentForm(false);
        setSelectedEffControl(null);
    };

    // Initial Link State (from navigation)
    const initialState = (location.state || {}) as { createForProject?: string; projectName?: string };
    const linkingToProjectId = initialState.createForProject || null;
    const linkingToProjectName = initialState.projectName || null;

    // Creation Mode State (Risks, Projects, Audits from Drawer)
    const [creationMode, setCreationMode] = useState<'risk' | 'project' | 'audit' | null>(null);
    const [projectInitialData, setProjectInitialData] = useState<Partial<ProjectFormData> | undefined>(undefined);
    const [projectContext, setProjectContext] = useState<{ type: 'risk' | 'control' | 'asset' | 'audit', id: string } | null>(null);

    // Utiliser le hook de données avec les propriétés disponibles
    const {
        controls,
        risks,
        assets,
        documents,
        usersList,
        suppliers,
        projects,
        loading: dataLoading
    } = useComplianceData(currentFrameworkId, claimsSynced);
    const { folders } = useDocumentsData(user?.organizationId, claimsSynced);
    const complianceActions = useComplianceActions(user);
    const documentActions = useDocumentActions(usersList);
    const { seedControls } = useComplianceDataSeeder();
    const { handleProjectFormSubmit, isSubmitting: isProjectSubmitting } = useProjectLogic();

    // URL Params for Deep Linking
    const [searchParams, setSearchParams] = useSearchParams();
    const deepLinkControlId = searchParams.get('id');

    // Handlers
    const handleSelectControl = useCallback((control: Control) => {
        setSelectedControlId(control.id);
        setProjectContext({ type: 'control', id: control.id });
        setIsDrawerOpen(true);
    }, []);

    // Filtering Logic
    const filteredControlsList = useMemo(() => {
        if (!controls) return [];
        return currentFrameworkId
            ? controls.filter(c => c.framework === currentFrameworkId)
            : controls;
    }, [controls, currentFrameworkId]);

    const filteredControls = useMemo(() => {
        return filteredControlsList.filter((control: Control) => {
            // Search
            const matchesSearch = filter === '' ||
                control.code.toLowerCase().includes(filter.toLowerCase()) ||
                control.name.toLowerCase().includes(filter.toLowerCase());

            // Status
            const matchesStatus = statusFilter === null || control.status === statusFilter;

            // Evidence
            const matchesEvidence = !showMissingEvidence || (control.status === CONTROL_STATUS.IMPLEMENTED && (!control.evidenceIds || control.evidenceIds.length === 0));

            return matchesSearch && matchesStatus && matchesEvidence;
        });
    }, [filteredControlsList, filter, statusFilter, showMissingEvidence]);

    const loading = authLoading || !claimsSynced || dataLoading;

    // Deep Link Effect
    useEffect(() => {
        if (!loading && deepLinkControlId && filteredControls.length > 0 && !deepLinkProcessedRef.current) {
            const control = filteredControls.find((c: Control) => c.id === deepLinkControlId);

            if (control) {
                deepLinkProcessedRef.current = true;
                handleSelectControl(control);
            }
        }
    }, [loading, deepLinkControlId, filteredControls, handleSelectControl]);

    // Cleanup Effect
    useEffect(() => {
        // CRITICAL FIX: Do not clean up while loading, otherwise we strip params before using them
        if (loading) return;

        // Only clean up params after the drawer has been opened and then closed
        // (not on initial render before deep link is processed)
        if (!isDrawerOpen && deepLinkControlId && deepLinkProcessedRef.current) {
            deepLinkProcessedRef.current = false;
            setSearchParams(params => {
                params.delete('id');
                return params;
            }, { replace: true });
        }
    }, [isDrawerOpen, deepLinkControlId, setSearchParams, loading]);

    // Effects
    useEffect(() => {
        if (initialState.createForProject) {
            addToast(t('compliance.linkMode', { project: initialState.projectName || '' }), 'info');
        }
    }, [initialState.createForProject, initialState.projectName, addToast, t]);

    // Sync tab with URL
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['overview', 'controls', 'mapping', 'shared', 'soa', 'efficiency', 'homologation'].includes(tab)) {
            setActiveTab(tab as ComplianceTab);
        }
    }, [searchParams, setActiveTab]);

    const handleTabChange = (id: string) => {
        setActiveTab(id as ComplianceTab);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', id);
            return next;
        }, { replace: true });
    };


    const handleCreateClick = (type: 'risk' | 'project' | 'audit') => {
        if (!canEdit) {
            addToast(t('common.accessDenied', { defaultValue: 'Access denied' }), 'error');
            return;
        }

        const controlContext = selectedControlId ? filteredControls.find((c: Control) => c.id === selectedControlId) as ControlExtended | null : null;

        if (type === 'project' && controlContext) {
            // Vérifier si le contrôle est déjà lié à un projet
            const isLinkedToProject = !!controlContext.linkedProjectId;

            if (isLinkedToProject) {
                addToast(t('compliance.controlAlreadyLinked') || 'Ce contrôle est déjà lié à un projet', 'info');
                return;
            }
        }

        if (type === 'audit' && controlContext) {
            // Vérifier si le contrôle est déjà lié à un audit
            const isLinkedToAudit = !!controlContext.linkedAuditId;

            if (isLinkedToAudit) {
                addToast(t('compliance.controlAlreadyLinked') || 'Ce contrôle est déjà lié à un audit', 'info');
                return;
            }
        }

        // Ouvrir le tiroir de création avec le contexte approprié
        setCreationMode(type);
        setProjectInitialData(type === 'project' ? {
            name: t('compliance.projectFor', { name: controlContext?.name || '', defaultValue: 'Project for {{name}}' }),
            relatedControlIds: controlContext?.id ? [controlContext.id] : []
        } : type === 'audit' ? {
            name: t('compliance.auditFor', { name: controlContext?.name || '', defaultValue: 'Audit for {{name}}' }),
            relatedControlIds: controlContext?.id ? [controlContext.id] : []
        } : undefined);
        setProjectContext({ type: type === 'project' ? 'control' : 'audit', id: controlContext?.id || '' });
        setUploadWizardOpen(true);
    };

    const closeProjectDrawer = () => {
        setIsDrawerOpen(false);
        setCreationMode(null);
        setProjectInitialData(undefined);
        setProjectContext(null);
    };

    const handleDrawerClose = () => {
        setIsDrawerOpen(false);
        setCreationMode(null);
    };

    const projectFormId = 'compliance-project-form';

    const handleProjectCreation = async (data: ProjectFormData) => {
        try {
            await handleProjectFormSubmit(
                data as unknown as Omit<import('../types').Project, 'id' | 'organizationId' | 'tasks' | 'progress' | 'createdAt'>,
                null,
                projectContext || undefined
            );
            closeProjectDrawer();
        } catch (_error) {
            ErrorLogger.handleErrorWithToast(_error as Error, 'Compliance.handleProjectCreation');
        }
    };

    const selectedControl = filteredControls.find((c: Control) => c.id === selectedControlId);

    // Generate Evidence Dossier
    const handleGenerateEvidenceDossier = async () => {
        if (filteredControls.length === 0) {
            toast.warning(t('compliance.noControlsForDossier') || 'Aucun contrôle disponible pour générer le dossier');
            return;
        }

        setGeneratingDossier(true);
        try {
            EvidenceDossierService.generateEvidenceDossier(
                filteredControls,
                documents,
                {
                    framework: currentFrameworkId,
                    organizationName: organization?.name,
                    generatedBy: user?.displayName || user?.email || undefined
                }
            );
            toast.success(t('compliance.dossierGenerated') || 'Dossier de preuves généré avec succès');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error as Error, 'Compliance.handleGenerateEvidenceDossier');
        } finally {
            setGeneratingDossier(false);
        }
    };

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
        >
            <MasterpieceBackground />
            <SEO title={`${t('compliance.title')} ${currentFrameworkId || ''}- Sentinel GRC`} description={t('compliance.subtitle')} />

            <div className="max-w-[1920px] mx-auto w-full flex flex-col gap-6 sm:gap-8 lg:gap-10">
                <PageHeader
                    title={t('compliance.title')}
                    subtitle={t('compliance.subtitle')}
                    icon={
                        <img
                            src="/images/pilotage.png"
                            alt="CONFORMITÉ"
                            className="w-full h-full object-contain"
                        />
                    }
                    actions={undefined}
                />

                {/* Stats Widget */}
                <div className="mt-6">
                    <ComplianceStatsWidget controls={filteredControls} currentFramework={currentFrameworkId} />
                </div>

                {/* Framework Selector (Top Level) - filtered by enabled frameworks */}
                <ScrollableTabs
                    tabs={enabledComplianceFrameworks.map((f) => ({
                        id: f.id,
                        label: t(`frameworks.${f.id}`),
                    }))}
                    activeTab={currentFrameworkId}
                    onTabChange={(id) => setActiveFramework(id as Framework)}
                    isChanging={loading}
                />

                {/* Main Navigation Tabs (Feature Level) */}
                <div className="mt-2">
                    <ScrollableTabs
                        tabs={[
                            { id: 'overview', label: t('compliance.overview'), icon: LayoutDashboard },
                            { id: 'controls', label: t('compliance.controls'), icon: ListChecks },
                            { id: 'efficiency', label: t('compliance.efficiency') || 'Efficacité', icon: BarChart3 },
                            { id: 'homologation', label: t('compliance.homologation') || 'Homologation', icon: Award },
                            { id: 'mapping', label: t('compliance.mapping') || 'Mapping', icon: Layers },
                            { id: 'shared', label: t('compliance.shared') || 'Partagées', icon: Link },
                            { id: 'soa', label: t('compliance.soa'), icon: FileText }
                        ]}
                        activeTab={activeTab}
                        onTabChange={handleTabChange}
                        isChanging={loading}
                    />
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div className="animate-fade-in space-y-6">
                        <ComplianceDashboard
                            controls={filteredControls}
                            currentFramework={currentFrameworkId}
                            onSeedData={() => seedControls(currentFrameworkId)}
                            loading={loading}
                        />
                    </div>
                )}

                {activeTab === 'controls' && (
                    <div className="animate-fade-in space-y-6">
                        <PremiumPageControl
                            searchQuery={filter}
                            onSearchChange={setFilter}
                            searchPlaceholder={t('compliance.searchPlaceholder')}
                            actions={
                                canEdit && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="secondary"
                                            onClick={handleGenerateEvidenceDossier}
                                            disabled={generatingDossier || filteredControls.length === 0}
                                        >
                                            <Archive className="h-4 w-4 mr-2" />
                                            {generatingDossier ? t('compliance.generating') : t('compliance.generateDossier')}
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={() => toast.info(t('compliance.exportComingSoon', { defaultValue: 'Export des contrôles - Fonctionnalité bientôt disponible' }))}
                                            title={t('compliance.exportComingSoon', { defaultValue: 'Bientôt disponible' })}
                                        >
                                            <Download className="h-4 w-4 mr-2" /> {t('compliance.export')}
                                        </Button>
                                        <Button
                                            className="shadow-lg shadow-brand-600/10"
                                            onClick={() => handleCreateClick('risk')}
                                        >
                                            <ShieldCheck className="h-4 w-4 mr-2" />
                                            {t('compliance.newRisk')}
                                        </Button>
                                    </div>
                                )
                            }
                        >
                            <div className="flex gap-3 items-center">
                                <div className="w-48">
                                    <CustomSelect
                                        label=""
                                        value={statusFilter || 'all'}
                                        onChange={(val) => setStatusFilter(val === 'all' ? null : val as string)}
                                        options={[
                                            { value: 'all', label: t('common.statuses.all') },
                                            { value: CONTROL_STATUS.NOT_STARTED, label: t('common.statuses.notStarted') },
                                            { value: CONTROL_STATUS.IN_PROGRESS, label: t('common.statuses.inProgress') },
                                            { value: CONTROL_STATUS.PLANNED, label: t('common.statuses.planned') },
                                            { value: CONTROL_STATUS.OVERDUE, label: t('common.statuses.overdue') },
                                            { value: CONTROL_STATUS.PARTIAL, label: t('common.statuses.partial') },
                                            { value: CONTROL_STATUS.IMPLEMENTED, label: t('common.statuses.implemented') },
                                            { value: CONTROL_STATUS.NOT_APPLICABLE, label: t('common.statuses.notApplicable') },
                                            { value: CONTROL_STATUS.EXCLUDED, label: t('common.statuses.excluded') }
                                        ]}
                                        placeholder={t('compliance.filterByStatus', { defaultValue: 'Filtrer par statut' })}
                                        className="rounded-xl"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    aria-pressed={showMissingEvidence}
                                    onClick={() => setShowMissingEvidence(!showMissingEvidence)}
                                    className={`transition-all ${showMissingEvidence
                                        ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400'
                                        : ''
                                        }`}
                                >
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    <span>{t('compliance.missingEvidence')}</span>
                                </Button>
                            </div>
                        </PremiumPageControl>

                        <ComplianceList
                            controls={filteredControls}
                            risks={risks}
                            findings={[]}
                            loading={loading}
                            currentFramework={currentFrameworkId}
                            selectedControlId={selectedControlId || undefined}
                            onSelectControl={handleSelectControl}
                            filter={filter}
                        />
                    </div>
                )}

                {activeTab === 'mapping' && (
                    <div className="animate-fade-in space-y-6">
                        <FrameworkMappingMatrix
                            controls={filteredControls}
                            enabledFrameworks={organization?.enabledFrameworks}
                            onControlClick={handleSelectControl}
                        />
                    </div>
                )}

                {activeTab === 'shared' && (
                    <div className="animate-fade-in space-y-6">
                        <SharedRequirementsView
                            controls={filteredControls}
                            enabledFrameworks={organization?.enabledFrameworks}
                            onControlClick={handleSelectControl}
                        />
                    </div>
                )}

                {activeTab === 'soa' && (
                    <div className="animate-fade-in space-y-6">
                        <SoAView
                            controls={filteredControls}
                            risks={risks}
                            framework={currentFrameworkId}
                            handlers={complianceActions}
                            onSeed={() => seedControls(currentFrameworkId)}
                        />
                    </div>
                )}

                {activeTab === 'efficiency' && (
                    <div className="animate-fade-in space-y-6 sm:space-y-8">
                        <ControlEffectivenessDashboard
                            onAssessClick={() => handleOpenAssessment(undefined)}
                        />
                        <ControlEffectivenessManager
                            assessments={assessments}
                            domainScores={domainScores}
                            loading={effLoading}
                            error={effError}
                            onAssessControl={handleOpenAssessment}
                        />
                    </div>
                )}

                {activeTab === 'homologation' && (
                    <div className="animate-fade-in">
                        <Homologation hideHeader />
                    </div>
                )}
            </div>

            <ComplianceDrawer
                isOpen={isDrawerOpen}
                onClose={handleDrawerClose}
                creationMode={creationMode}
                selectedControl={selectedControl}
                isProjectSubmitting={isProjectSubmitting}
                projectFormId={projectFormId}
                usersList={usersList}
                risks={risks}
                frameworkControls={filteredControls}
                assets={assets}
                suppliers={suppliers}
                projects={projects}
                documents={documents}
                findings={[]}
                linkingToProjectId={linkingToProjectId}
                linkingToProjectName={linkingToProjectName}
                canEdit={canEdit}
                projectInitialData={projectInitialData}
                onProjectSubmit={handleProjectCreation}
                actions={complianceActions}
                onUploadEvidence={() => setUploadWizardOpen(true)}
                enabledFrameworks={organization?.enabledFrameworks}
            />

            <DocumentUploadWizard
                isOpen={uploadWizardOpen}
                onClose={() => setUploadWizardOpen(false)}
                onSubmit={async (data) => {
                    try {
                        // 1. Create the document
                        const docId = await documentActions.handleCreate({
                            ...data,
                            ownerId: user?.uid, // Default to current user if not specified
                        });

                        // 2. Link to Control if successful and context exists
                        if (docId && selectedControlId) {
                            const control = filteredControls.find(c => c.id === selectedControlId);
                            if (control) {
                                await complianceActions.handleLinkDocument(control, docId);
                            }
                        }

                        if (docId) {
                            setUploadWizardOpen(false);
                        }
                    } catch {
                        toast.error(t('common.errors.creating'));
                    }
                }}
                users={usersList}
                controls={filteredControls}
                assets={assets}
                risks={risks}
                folders={folders} // Real folders from useDocumentsData
            />

            {/* Efficiency Assessment Modal */}
            {
                showAssessmentForm && (
                    <AssessmentFormModal
                        control={selectedEffControl}
                        controls={filteredControlsList}
                        onClose={() => {
                            setShowAssessmentForm(false);
                            setSelectedEffControl(null);
                        }}
                        onSubmit={handleAssessmentSubmit}
                    />
                )
            }
        </motion.div>
    );
};
