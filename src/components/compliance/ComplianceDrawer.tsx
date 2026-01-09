import React from 'react';
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
import { Control, Risk, Project, Asset, Supplier, UserProfile, Document, Finding } from '../../types';

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
    actions: any;
    onUploadEvidence: () => void;
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
    onUploadEvidence
}) => {
    const { t } = useStore();

    if (creationMode === 'project') {
        return (
            <InspectorLayout
                isOpen={isOpen}
                onClose={onClose}
                title={t('compliance.newProject')}
                subtitle={t('projects.drawerSubtitle')}
                icon={FolderKanban}
                width="max-w-3xl"
                footer={
                    <div className="flex justify-end gap-3" aria-busy={isProjectSubmitting}>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
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
                        onCancel={onClose}
                        onSubmit={onProjectSubmit}
                        initialData={projectInitialData}
                        isLoading={isProjectSubmitting}
                    />
                </div>
            </InspectorLayout>
        );
    }

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={creationMode ? (
                creationMode === 'risk' ? t('compliance.newRisk') : t('compliance.newAudit')
            ) : (selectedControl ? `${selectedControl.code} - ${selectedControl.name}` : t('commandPalette.select'))}
            width="max-w-6xl"
        >
            {creationMode === 'risk' && (
                <RiskForm
                    onCancel={onClose}
                    onSubmit={async (data) => {
                        await actions.createRisk(data);
                        onClose();
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
                    onCancel={onClose}
                    onSubmit={async (data) => {
                        await actions.createAudit(data);
                        onClose();
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
                        ...actions,
                        onUploadEvidence: onUploadEvidence
                    }}
                />
            )}
        </Drawer>
    );
};
