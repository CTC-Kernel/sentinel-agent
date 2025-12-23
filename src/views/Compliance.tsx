import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../store';
import { Framework } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { Drawer } from '../components/ui/Drawer';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { ComplianceDashboard } from '../components/compliance/ComplianceDashboard';
import { ComplianceList } from '../components/compliance/ComplianceList';
import { ComplianceFilters } from '../components/compliance/ComplianceFilters';
import { ComplianceInspector } from '../components/compliance/ComplianceInspector';
import { useComplianceData } from '../hooks/useComplianceData';
import { useComplianceActions } from '../hooks/useComplianceActions';
import { usePersistedState } from '../hooks/usePersistedState';
import { canEditResource } from '../utils/permissions';
import { FRAMEWORKS } from '../data/frameworks';
import { RiskForm } from '../components/risks/RiskForm';
import { ProjectForm } from '../components/projects/ProjectForm';
import { AuditForm } from '../components/audits/AuditForm';

import { ShieldCheck, Download, LayoutDashboard, ListChecks, FileText } from '../components/ui/Icons';
import { toast } from 'sonner';
import { SoAView } from '../components/compliance/SoAView';

export const Compliance: React.FC = () => {
    const { user, addToast, t } = useStore();
    const location = useLocation();
    const canEdit = canEditResource(user, 'Control');

    // UI State
    const [currentFramework, setCurrentFramework] = useState<Framework>('ISO27001');
    const [activeTab, setActiveTab] = usePersistedState<'overview' | 'controls' | 'soa'>('compliance-active-tab', 'overview');
    const [selectedControlId, setSelectedControlId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showMissingEvidence, setShowMissingEvidence] = useState(false);

    // Initial Link State (from navigation)
    const initialState = (location.state || {}) as { createForProject?: string; projectName?: string };
    const linkingToProjectId = initialState.createForProject || null;
    const linkingToProjectName = initialState.projectName || null;

    // Creation Mode State (Risks, Projects, Audits from Drawer)
    const [creationMode, setCreationMode] = useState<'risk' | 'project' | 'audit' | null>(null);

    // Data Hooks
    const { filteredControls: frameworkControls, risks, findings, documents, usersList, assets, suppliers, projects, loading } = useComplianceData(currentFramework);
    const complianceActions = useComplianceActions(user);

    // Effects
    useEffect(() => {
        if (initialState.createForProject) {
            addToast(t('compliance.linkMode', { project: initialState.projectName || '' }), 'info');
        }
    }, [initialState.createForProject, initialState.projectName, addToast, t]);

    // Filtering Logic
    const filteredControls = useMemo(() => {
        return frameworkControls.filter(control => {
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

    // Handlers
    const handleSelectControl = (control: import('../types').Control) => {
        setSelectedControlId(control.id);
        setCreationMode(null);
        setIsDrawerOpen(true);
    };

    const handleCreateClick = (type: 'risk' | 'project' | 'audit') => {
        setCreationMode(type);
        setSelectedControlId(null);
        setIsDrawerOpen(true);
    };


    const selectedControl = frameworkControls.find(c => c.id === selectedControlId);

    return (
        <>
            <MasterpieceBackground />
            <SEO title={`${t('compliance.title')} ${currentFramework} - Sentinel GRC`} description={t('compliance.subtitle')} />

            <div className="relative z-10 p-4 md:p-6 space-y-8 w-full max-w-full overflow-x-hidden pb-24">
                <div className="max-w-[1920px] mx-auto space-y-8">
                    <PageHeader
                        title={t('compliance.title')}
                        subtitle={t('compliance.subtitle')}
                        icon={<ShieldCheck className="h-6 w-6 text-white" />}
                        actions={
                            canEdit ? (
                                <div className="flex gap-2">
                                    <button className="btn-secondary" onClick={() => handleCreateClick('risk')}>
                                        <ShieldCheck className="h-4 w-4 mr-2" /> + {t('compliance.newRisk')}
                                    </button>
                                    <button className="btn-secondary" onClick={() => toast.info(t('compliance.exportInfo'))}>
                                        <Download className="h-4 w-4 mr-2" /> {t('compliance.export')}
                                    </button>
                                </div>
                            ) : null
                        }
                    />

                    {/* Framework Selector (Top Level) */}
                    <ScrollableTabs
                        tabs={FRAMEWORKS.filter(f => f.type === 'Compliance').map(f => ({
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
                            <ComplianceDashboard controls={filteredControls} currentFramework={currentFramework} />
                        </div>
                    )}

                    {activeTab === 'controls' && (
                        <div className="animate-fade-in space-y-6">
                            <ComplianceFilters
                                searchQuery={filter}
                                onSearchChange={setFilter}
                                statusFilter={statusFilter}
                                onStatusFilterChange={setStatusFilter}
                                showMissingEvidence={showMissingEvidence}
                                onShowMissingEvidenceChange={setShowMissingEvidence}
                            />

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
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Inspector / Creation Drawer */}
            <Drawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title={creationMode ? (
                    creationMode === 'risk' ? t('compliance.newRisk') :
                        creationMode === 'project' ? t('compliance.newProject') : t('compliance.newAudit')
                ) : (selectedControl ? `${selectedControl.code} - ${selectedControl.name}` : t('settings.commandPalette.select'))}
                width={creationMode ? 'max-w-2xl' : 'max-w-7xl'}
            >
                {creationMode === 'risk' && <RiskForm onCancel={() => setIsDrawerOpen(false)} onSubmit={async (data) => { await complianceActions.createRisk(data); setIsDrawerOpen(false); }} assets={assets} usersList={usersList} processes={[]} suppliers={suppliers} controls={frameworkControls} />}
                {creationMode === 'project' && <ProjectForm onCancel={() => setIsDrawerOpen(false)} onSubmit={() => { toast.info(t('compliance.projectSim')); setIsDrawerOpen(false); }} />}
                {creationMode === 'audit' && <AuditForm onCancel={() => setIsDrawerOpen(false)} onSubmit={() => { toast.info(t('compliance.auditSim')); setIsDrawerOpen(false); }} assets={assets} risks={risks} controls={frameworkControls} projects={projects} usersList={usersList} />}

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
                        handlers={complianceActions}
                    />
                )}
            </Drawer>
        </>
    );
};
