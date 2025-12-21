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
    const { user, addToast } = useStore();
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
    const { controls, documents, risks, findings, usersList, assets, suppliers, projects, loading } = useComplianceData(currentFramework);
    const complianceActions = useComplianceActions(user);

    // Effects
    useEffect(() => {
        if (initialState.createForProject) {
            addToast(`Mode liaison actif: Sélectionnez un contrôle pour le lier au projet ${initialState.projectName || ''}`, 'info');
        }
    }, [initialState.createForProject, initialState.projectName, addToast]);

    // Filtering Logic
    const filteredControls = useMemo(() => {
        return controls.filter(control => {
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
    }, [controls, filter, statusFilter, showMissingEvidence]);

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


    const selectedControl = controls.find(c => c.id === selectedControlId);

    return (
        <>
            <MasterpieceBackground />
            <SEO title={`Conformité ${currentFramework} - Sentinel GRC`} description="Gestion de la conformité et des contrôles" />

            <div className="relative z-10 p-6 space-y-8 max-w-[1920px] mx-auto pb-24 overflow-x-hidden">
                <PageHeader
                    title="Conformité"
                    subtitle="Pilotez votre conformité normative et réglementaire"
                    icon={<ShieldCheck className="h-6 w-6 text-white" />}
                    actions={
                        canEdit ? (
                            <div className="flex gap-2">
                                <button className="btn-secondary" onClick={() => handleCreateClick('risk')}>
                                    <ShieldCheck className="h-4 w-4 mr-2" /> + Risque
                                </button>
                                <button className="btn-secondary" onClick={() => toast.info("Export PDF disponible via le menu d'actions global")}>
                                    <Download className="h-4 w-4 mr-2" /> Export
                                </button>
                            </div>
                        ) : null
                    }
                />

                {/* Framework Selector (Top Level) */}
                <ScrollableTabs
                    tabs={FRAMEWORKS.filter(f => f.type === 'Compliance').map(f => ({
                        id: f.id,
                        label: f.label,
                    }))}
                    activeTab={currentFramework}
                    onTabChange={(id) => setCurrentFramework(id as Framework)}
                />

                {/* Main Navigation Tabs (Feature Level) */}
                <div className="mt-2">
                    <ScrollableTabs
                        tabs={[
                            { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
                            { id: 'controls', label: "Contrôles & Preuves", icon: ListChecks },
                            { id: 'soa', label: "Déclaration d'Applicabilité (SoA)", icon: FileText }
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

            {/* Inspector / Creation Drawer */}
            <Drawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title={creationMode ? (
                    creationMode === 'risk' ? 'Nouveau Risque' :
                        creationMode === 'project' ? 'Nouveau Projet' : 'Nouvel Audit'
                ) : (selectedControl ? `${selectedControl.code} - ${selectedControl.name}` : 'Détails')}
                width={creationMode ? 'max-w-2xl' : 'max-w-7xl'}
            >
                {creationMode === 'risk' && <RiskForm onCancel={() => setIsDrawerOpen(false)} onSubmit={async (data) => { await complianceActions.createRisk(data); setIsDrawerOpen(false); }} assets={assets} usersList={usersList} processes={[]} suppliers={suppliers} controls={controls} />}
                {creationMode === 'project' && <ProjectForm onCancel={() => setIsDrawerOpen(false)} onSubmit={() => { toast.info('Création de projet simulée'); setIsDrawerOpen(false); }} />}
                {creationMode === 'audit' && <AuditForm onCancel={() => setIsDrawerOpen(false)} onSubmit={() => { toast.info('Création d\'audit simulée'); setIsDrawerOpen(false); }} assets={assets} risks={risks} controls={controls} projects={projects} usersList={usersList} />}

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
