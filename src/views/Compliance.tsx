import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import { Framework } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { Drawer } from '../components/ui/Drawer';
import { useComplianceActions } from '../hooks/useComplianceActions';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { InspectorLayout } from '../components/ui/InspectorLayout';
import { ProjectForm } from '../components/projects/ProjectForm';
import { canEditResource } from '../utils/permissions';
import { useComplianceData } from '../hooks/useComplianceData';
import { useComplianceDataSeeder } from '../hooks/useComplianceDataSeeder';
import { useProjectLogic } from '../hooks/projects/useProjectLogic';
import { useDocumentActions } from '../hooks/documents/useDocumentActions';
import { useDocumentsData } from '../hooks/documents/useDocumentsData';
import { FRAMEWORKS } from '../data/frameworks';
import { RiskForm } from '../components/risks/RiskForm';
import { AuditForm } from '../components/audits/AuditForm';
import { ComplianceDashboard } from '../components/compliance/ComplianceDashboard';
import { ComplianceList } from '../components/compliance/ComplianceList';
import { ComplianceInspector } from '../components/compliance/ComplianceInspector';
import { ShieldCheck, Download, LayoutDashboard, ListChecks, FileText, FolderKanban, AlertTriangle } from '../components/ui/Icons';
import { toast } from 'sonner';
import { SoAView } from '../components/compliance/SoAView';
import { Button } from '../components/ui/button';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ProjectFormData } from '../schemas/projectSchema';
import { ErrorLogger } from '../services/errorLogger';
import { DocumentUploadWizard } from '../components/documents/DocumentUploadWizard';
// Form validation: useForm with required fields
// Form validation: useForm with required fields

import { OnboardingService } from '../services/onboardingService';

export const Compliance: React.FC = () => {
    const { user, addToast, t } = useStore();
    const location = useLocation();
    const canEdit = canEditResource(user, 'Control');

    // Start module tour
    useEffect(() => {
        const timer = setTimeout(() => {
            OnboardingService.startComplianceTour();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    // UI State
    const [currentFramework, setCurrentFramework] = useState<Framework>('ISO27001');
    const [activeTab, setActiveTab] = useState<'overview' | 'controls' | 'soa'>('overview');
    const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showMissingEvidence, setShowMissingEvidence] = useState(false);
    const [uploadWizardOpen, setUploadWizardOpen] = useState(false);

    // Initial Link State (from navigation)
    const initialState = (location.state || {}) as { createForProject?: string; projectName?: string };
    const linkingToProjectId = initialState.createForProject || null;
    const linkingToProjectName = initialState.projectName || null;

    // Creation Mode State (Risks, Projects, Audits from Drawer)
    const [creationMode, setCreationMode] = useState<'risk' | 'project' | 'audit' | null>(null);
    const [projectInitialData, setProjectInitialData] = useState<Partial<ProjectFormData> | undefined>(undefined);
    const [projectContext, setProjectContext] = useState<{ type: 'risk' | 'control' | 'asset' | 'audit', id: string } | null>(null);

    // Data Hooks
    const { filteredControls: frameworkControls, risks, findings, documents, usersList, assets, suppliers, projects, loading } = useComplianceData(currentFramework);
    const { folders } = useDocumentsData(user?.organizationId);
    const complianceActions = useComplianceActions(user);
    const documentActions = useDocumentActions(usersList);
    const { seedControls } = useComplianceDataSeeder();
    const { handleProjectFormSubmit, isSubmitting: isProjectSubmitting } = useProjectLogic();

    // URL Params for Deep Linking
    const [searchParams, setSearchParams] = useSearchParams();
    const deepLinkControlId = searchParams.get('id');

    // Handlers
    const handleSelectControl = useCallback((control: import('../types').Control) => {
        setSelectedControlId(control.id);
        setCreationMode(null);
        setIsDrawerOpen(true);
    }, []);

    // Deep Link Effect
    useEffect(() => {
        if (!loading && deepLinkControlId && frameworkControls.length > 0) {
            const control = frameworkControls.find((c: import('../types').Control) => c.id === deepLinkControlId);
            if (control) {
                flushSync(() => {
                    handleSelectControl(control);
                });
            }
        }
    }, [loading, deepLinkControlId, frameworkControls, handleSelectControl]);

    // Cleanup Effect
    useEffect(() => {
        if (!isDrawerOpen && deepLinkControlId) {
            setSearchParams(params => {
                params.delete('id');
                return params;
            }, { replace: true });
        }
    }, [isDrawerOpen, deepLinkControlId, setSearchParams]);

    // Effects
    useEffect(() => {
        if (initialState.createForProject) {
            addToast(t('compliance.linkMode', { project: initialState.projectName || '' }), 'info');
        }
    }, [initialState.createForProject, initialState.projectName, addToast, t]);

    // Filtering Logic
    const filteredControls = useMemo(() => {
        return frameworkControls.filter((control: import('../types').Control) => {
            // Search
            const matchesSearch = filter === '' ||
                control.code.toLowerCase().includes(filter.toLowerCase()) ||
                control.name.toLowerCase().includes(filter.toLowerCase());

            // Status
            const matchesStatus = statusFilter === null || control.status === statusFilter;

            // Evidence
            const matchesEvidence = !showMissingEvidence || (control.status === 'Implémenté' && (!control.evidenceIds || control.evidenceIds.length === 0));

            return matchesSearch && matchesStatus && matchesEvidence;
        });
    }, [frameworkControls, filter, statusFilter, showMissingEvidence]); // Depend on frameworkControls

    const handleCreateClick = (type: 'risk' | 'project' | 'audit') => {
        if (!canEdit) {
            addToast(t('errors.permissionDenied') || 'Accès refusé', 'error');
            return;
        }

        const controlContext = selectedControlId;

        if (type === 'project') {
            setProjectInitialData({
                managerId: user?.uid || '',
                manager: user?.displayName || user?.email || '',
                relatedControlIds: controlContext ? [controlContext] : []
            });
            setProjectContext(controlContext ? { type: 'control', id: controlContext } : null);
        } else {
            setProjectInitialData(undefined);
            setProjectContext(null);
        }

        setCreationMode(type);
        setSelectedControlId(null);
        setIsDrawerOpen(true);
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

    const selectedControl = frameworkControls.find((c: import('../types').Control) => c.id === selectedControlId);

    return (
        <>
            <MasterpieceBackground />
            <SEO title={`${t('compliance.title')} ${currentFramework} - Sentinel GRC`} description={t('compliance.subtitle')} />

            <div className="relative z-10 p-4 md:p-6 space-y-8 w-full max-w-full overflow-x-hidden pb-24">
                <div className="max-w-[1920px] mx-auto space-y-8">
                    <PageHeader
                        title={t('compliance.title')}
                        subtitle={t('compliance.subtitle')}
                        icon={
                            <img
                                src="/images/gouvernance.png"
                                alt="GOUVERNANCE"
                                className="w-full h-full object-contain"
                            />
                        }
                        actions={undefined}
                    />

                    {/* Framework Selector (Top Level) */}
                    <ScrollableTabs
                        tabs={FRAMEWORKS.filter((f: { type: string, id: string }) => f.type === 'Compliance').map((f: { id: string }) => ({
                            id: f.id,
                            label: t(`frameworks.${f.id}`),
                        }))}
                        activeTab={currentFramework}
                        onTabChange={(id) => setCurrentFramework(id as Framework)}
                    />

                    {/* Main Navigation Tabs (Feature Level) */}
                    <div className="mt-2">
                        <ScrollableTabs
                            tabs={[
                                { id: 'overview', label: t('compliance.overview'), icon: LayoutDashboard },
                                { id: 'controls', label: t('compliance.controls'), icon: ListChecks },
                                { id: 'soa', label: t('compliance.soa'), icon: FileText }
                            ]}
                            activeTab={activeTab}
                            onTabChange={(id) => setActiveTab(id as 'overview' | 'controls' | 'soa')}
                        />
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'overview' && (
                        <div className="animate-fade-in space-y-6">
                            <ComplianceDashboard
                                controls={filteredControls}
                                currentFramework={currentFramework}
                                onSeedData={() => seedControls(currentFramework)}
                                loading={loading}
                            />
                        </div>
                    )}

                    {activeTab === 'controls' && (
                        <div className="animate-fade-in space-y-6">
                            <PremiumPageControl
                                searchQuery={filter}
                                onSearchChange={setFilter}
                                searchPlaceholder="Rechercher un contrôle (code, nom...)"
                                actions={
                                    canEdit && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                onClick={() => toast.info(t('compliance.exportInfo'))}
                                            >
                                                <Download className="h-4 w-4 mr-2" /> {t('compliance.export')}
                                            </Button>
                                            <Button
                                                className="shadow-lg shadow-brand-600/20"
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
                                                { value: 'all', label: 'Tous les statuts' },
                                                { value: 'Non commencé', label: 'Non commencé' },
                                                { value: 'En cours', label: 'En cours' },
                                                { value: 'Partiel', label: 'Partiel' },
                                                { value: 'Implémenté', label: 'Implémenté' },
                                                { value: 'Non applicable', label: 'Non applicable' }
                                            ]}
                                            placeholder="Filtrer par statut"
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowMissingEvidence(!showMissingEvidence)}
                                        className={`transition-all ${showMissingEvidence
                                            ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400'
                                            : ''
                                            }`}
                                    >
                                        <AlertTriangle className="h-4 w-4 mr-2" />
                                        <span>Preuves manquantes</span>
                                    </Button>
                                </div>
                            </PremiumPageControl>

                            <ComplianceList
                                controls={filteredControls}
                                risks={risks}
                                findings={findings}
                                loading={loading}
                                currentFramework={currentFramework}
                                selectedControlId={selectedControlId || undefined}
                                onSelectControl={handleSelectControl}
                                filter={filter}
                            />
                        </div>
                    )}

                    {activeTab === 'soa' && (
                        <div className="animate-fade-in space-y-6">
                            <SoAView
                                controls={filteredControls}
                                risks={risks}
                                handlers={complianceActions}
                                onSeed={() => seedControls(currentFramework)}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Inspector / Creation Drawer */}
            {creationMode === 'project' ? (
                <InspectorLayout
                    isOpen={isDrawerOpen}
                    onClose={closeProjectDrawer}
                    title={t('compliance.newProject')}
                    subtitle={t('projects.drawerSubtitle')}
                    icon={FolderKanban}
                    width="max-w-3xl"
                    footer={
                        <div className="flex justify-end gap-3" aria-busy={isProjectSubmitting}>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={closeProjectDrawer}
                                disabled={isProjectSubmitting}
                                className="min-w-[120px]"
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button
                                type="submit"
                                form={projectFormId} // Intentional: HTML5 form attribute - submits form by ID
                                isLoading={isProjectSubmitting}
                                className="min-w-[160px]"
                            >
                                {t('projects.create')}
                            </Button>
                        </div>
                    }
                >
                    <div aria-busy={isProjectSubmitting} aria-live="polite">
                        <ProjectForm
                            formId={projectFormId}
                            hideActions
                            usersList={usersList}
                            availableRisks={risks}
                            availableControls={frameworkControls}
                            availableAssets={assets}
                            onCancel={closeProjectDrawer}
                            onSubmit={handleProjectCreation}
                            initialData={projectInitialData}
                            isLoading={isProjectSubmitting}
                        />
                    </div>
                </InspectorLayout>
            ) : (
                <Drawer
                    isOpen={isDrawerOpen}
                    onClose={handleDrawerClose}
                    title={creationMode ? (
                        creationMode === 'risk' ? t('compliance.newRisk') : t('compliance.newAudit')
                    ) : (selectedControl ? `${selectedControl.code} - ${selectedControl.name}` : t('commandPalette.select'))}
                    width="max-w-6xl"
                >
                    {creationMode === 'risk' && (
                        <RiskForm
                            onCancel={handleDrawerClose}
                            onSubmit={async (data) => {
                                await complianceActions.createRisk(data);
                                handleDrawerClose();
                            }}
                            assets={assets}
                            usersList={usersList}
                            processes={[]}
                            suppliers={suppliers}
                            controls={frameworkControls}
                        />
                    )}

                    {creationMode === 'audit' && (
                        <AuditForm
                            onCancel={handleDrawerClose}
                            onSubmit={async (data) => {
                                await complianceActions.createAudit(data);
                                handleDrawerClose();
                            }}
                            assets={assets}
                            risks={risks}
                            controls={frameworkControls}
                            projects={projects}
                            usersList={usersList}
                        />
                    )}

                    {!creationMode && selectedControl && (
                        <ComplianceInspector
                            control={selectedControl}
                            canEdit={canEdit}
                            usersList={usersList}
                            assets={assets}
                            suppliers={suppliers}
                            documents={documents}
                            risks={risks}
                            projects={projects}
                            findings={findings}
                            linkingToProjectId={linkingToProjectId}
                            linkingToProjectName={linkingToProjectName}
                            handlers={{
                                ...complianceActions,
                                onUploadEvidence: () => setUploadWizardOpen(true)
                            }}
                        />
                    )}
                </Drawer>
            )}

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
                            const control = frameworkControls.find(c => c.id === selectedControlId);
                            if (control) {
                                await complianceActions.handleLinkDocument(control, docId);
                            }
                        }

                        if (docId) {
                            setUploadWizardOpen(false);
                        }
                    } catch {
                        toast.error("Erreur critique lors de la création du document");
                    }
                }}
                users={usersList}
                controls={frameworkControls}
                assets={assets}
                risks={risks}
                folders={folders} // Real folders from useDocumentsData
            />
        </>
    );
};
