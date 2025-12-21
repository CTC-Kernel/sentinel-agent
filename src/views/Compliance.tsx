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
import { canEditResource } from '../utils/permissions';
import { FRAMEWORKS } from '../data/frameworks';
import { RiskForm } from '../components/risks/RiskForm';
import { ProjectForm } from '../components/projects/ProjectForm';
import { AuditForm } from '../components/audits/AuditForm';

import { ShieldCheck, Download } from '../components/ui/Icons';
import { toast } from 'sonner';
import { SoAView } from '../components/compliance/SoAView';

export const Compliance: React.FC = () => {
    const { user, addToast } = useStore();
    const location = useLocation();
    const canEdit = canEditResource(user, 'Control');

    // UI State
    const [currentFramework, setCurrentFramework] = useState<Framework>('ISO27001');
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

    const [viewMode, setViewMode] = useState<'controls' | 'soa'>('controls');

    // Effects
    useEffect(() => {
        if (initialState.createForProject) {
            // Only toast if we actually have a project ID newly linked (managed via mounting, or we could track previous id)
            // Ideally we just show it on mount.
            // Using a ref to ensure we don't toast repeatedly if location object changes but state doesn't is cleaner,
            // but for now, dependency on location.state which usually comes from pushState is acceptable if we stripped the setState.
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

    // ... (existing code)

    return (
        <>
            <MasterpieceBackground />
            <SEO title={`Conformité ${currentFramework} - Sentinel GRC`} description="Gestion de la conformité et des contrôles" />

            <div className="relative z-10 p-6 space-y-8 max-w-[1920px] mx-auto pb-24">
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

                {/* Framework Tabs */}
                <ScrollableTabs
                    tabs={FRAMEWORKS.filter(f => f.type === 'Compliance').map(f => ({
                        id: f.id,
                        label: f.label,
                        // icon: Globe // Optional
                    }))}
                    activeTab={currentFramework}
                    onTabChange={(id) => setCurrentFramework(id as Framework)}
                />

                {/* Dashboard Stats */}
                <ComplianceDashboard
                    controls={controls}
                />

                {/* View Toggler */}
                <div className="flex border-b border-gray-200 dark:border-white/10">
                    <button
                        onClick={() => setViewMode('controls')}
                        className={`px-4 py-2 border-b-2 text-sm font-medium transition-colors ${viewMode === 'controls' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                    >
                        Contrôles & Preuves
                    </button>
                    <button
                        onClick={() => setViewMode('soa')}
                        className={`px-4 py-2 border-b-2 text-sm font-medium transition-colors ${viewMode === 'soa' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                    >
                        Déclaration d'Applicabilité (SoA)
                    </button>
                </div>

                {/* Content */}
                {viewMode === 'controls' ? (
                    <div className="space-y-6">
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
                ) : (
                    <SoAView
                        controls={filteredControls}
                        risks={risks}
                        handlers={complianceActions}
                    />
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
