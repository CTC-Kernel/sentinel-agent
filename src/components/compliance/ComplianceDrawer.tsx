import React from 'react';
// Force IDE re-index
import { useStore } from '../../store';
import { Drawer } from '../ui/Drawer';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Button } from '../ui/button';
import { FolderKanban } from '../ui/Icons';
import { ProjectForm } from '../projects/ProjectForm';
import { RiskForm } from '../risks/RiskForm';
import { AuditForm } from '../audits/AuditForm';
import { ComplianceInspector } from './ComplianceInspector';
import { ProjectFormData } from '../../schemas/projectSchema';
import { Control, Risk, Project, Asset, Supplier, UserProfile, Document, Finding, Framework } from '../../types';

interface ComplianceActions {
    updating: boolean;
    handleStatusChange: (control: Control, newStatus: Control['status']) => Promise<void>;
    handleAssign: (control: Control, userId: string) => Promise<void>;
    handleLinkAsset: (control: Control, assetId: string) => Promise<void>;
    handleUnlinkAsset: (control: Control, assetId: string) => Promise<void>;
    handleLinkSupplier: (control: Control, supplierId: string) => Promise<void>;
    handleUnlinkSupplier: (control: Control, supplierId: string) => Promise<void>;
    handleLinkProject: (control: Control, projectId: string) => Promise<void>;
    handleUnlinkProject: (control: Control, projectId: string) => Promise<void>;
    handleLinkDocument: (control: Control, documentId: string) => Promise<void>;
    handleUnlinkDocument: (control: Control, documentId: string) => Promise<void>;
    updateJustification: (control: Control, text: string) => Promise<void>;
    handleApplicabilityChange: (control: Control, isApplicable: boolean) => Promise<void>;
    handleMapFramework?: (control: Control, frameworkId: Framework) => Promise<void>;
    handleUnmapFramework?: (control: Control, frameworkId: Framework) => Promise<void>;
    createRisk: (riskData: Record<string, unknown>) => Promise<string | null>;
    createAudit: (auditData: Record<string, unknown>) => Promise<string | null>;
    updateControl: (controlId: string, updates: Partial<Control>, successMessage?: string, skipValidation?: boolean) => Promise<boolean>;
    onValidateEvidence?: (documentId: string, action: 'approuver' | 'rejeter') => Promise<boolean>;
}

interface ComplianceDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    creationMode: 'risk' | 'project' | 'audit' | null;
    selectedControl?: Control;
    isProjectSubmitting: boolean;
    projectFormId: string;
    usersList: UserProfile[];
    risks: Risk[];
    frameworkControls: Control[];
    assets: Asset[];
    suppliers: Supplier[];
    projects: Project[];
    documents: Document[];
    findings: Finding[];
    linkingToProjectId: string | null;
    linkingToProjectName: string | null;
    canEdit: boolean;
    projectInitialData?: Partial<ProjectFormData>;
    onProjectSubmit: (data: ProjectFormData) => Promise<void>;
    actions: ComplianceActions;
    onUploadEvidence: () => void;
    enabledFrameworks?: Framework[];
}

export const ComplianceDrawer: React.FC<ComplianceDrawerProps> = ({
    isOpen,
    onClose,
    creationMode,
    selectedControl,
    isProjectSubmitting,
    projectFormId,
    usersList,
    risks,
    frameworkControls,
    assets,
    suppliers,
    projects,
    documents,
    findings,
    linkingToProjectId,
    linkingToProjectName,
    canEdit,
    projectInitialData,
    onProjectSubmit,
    actions,
    onUploadEvidence,
    enabledFrameworks
}) => {
    const { t } = useStore();
    const [isFormDirty, setIsFormDirty] = React.useState(false);

    const handleClose = () => {
        setIsFormDirty(false);
        onClose();
    };

    if (creationMode === 'project') {
        return (
            <InspectorLayout
                isOpen={isOpen}
                onClose={handleClose}
                title={t('compliance.newProject')}
                subtitle={t('projects.drawerSubtitle')}
                icon={FolderKanban}
                width="max-w-3xl"
                hasUnsavedChanges={isFormDirty}
                footer={
                    <div className="flex justify-end gap-3" aria-busy={isProjectSubmitting}>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleClose}
                            disabled={isProjectSubmitting}
                            className="min-w-[120px]"
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            form={projectFormId}
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
                        onCancel={handleClose}
                        onSubmit={async (data) => {
                            await onProjectSubmit(data);
                            setIsFormDirty(false);
                        }}
                        initialData={projectInitialData}
                        isLoading={isProjectSubmitting}
                        onDirtyChange={setIsFormDirty}
                    />
                </div>
            </InspectorLayout>
        );
    }

    return (
        <Drawer
            isOpen={isOpen}
            onClose={handleClose}
            title={creationMode ? (
                creationMode === 'risk' ? t('compliance.newRisk') : t('compliance.newAudit')
            ) : (selectedControl ? `${selectedControl.code} - ${selectedControl.name}` : t('commandPalette.select'))}
            width="max-w-6xl"
            hasUnsavedChanges={isFormDirty}
        >
            {creationMode === 'risk' && (
                <RiskForm
                    onCancel={handleClose}
                    onSubmit={async (data) => {
                        await actions.createRisk(data);
                        setIsFormDirty(false);
                        onClose();
                    }}
                    assets={assets}
                    usersList={usersList}
                    processes={[]}
                    suppliers={suppliers}
                    controls={frameworkControls}
                    onDirtyChange={setIsFormDirty}
                />
            )}

            {creationMode === 'audit' && (
                <AuditForm
                    onCancel={handleClose}
                    onSubmit={async (data) => {
                        await actions.createAudit(data);
                        setIsFormDirty(false);
                        onClose();
                    }}
                    assets={assets}
                    risks={risks}
                    controls={frameworkControls}
                    projects={projects}
                    usersList={usersList}
                    onDirtyChange={setIsFormDirty}
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
                    enabledFrameworks={enabledFrameworks}
                    handlers={{
                        ...actions,
                        onUploadEvidence: onUploadEvidence
                    }}
                    onDirtyChange={setIsFormDirty}
                />
            )}
        </Drawer>
    );
};
