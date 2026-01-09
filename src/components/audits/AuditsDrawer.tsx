import React from 'react';
import { Document } from '@/types/documents';
import { Drawer } from '../ui/Drawer';
import { AuditForm } from './AuditForm';
import { AuditInspector } from './AuditInspector';
import { useStore } from '../../store';
import { Audit, Control, Asset, Risk, Project, UserProfile } from '../../types';
import { AuditFormData } from '../../schemas/auditSchema';

interface AuditsDrawerProps {
    creationMode: boolean;
    editingAudit: Audit | null;
    selectedAudit: Audit | null;
    onClose: () => void;
    onFormSubmit: (data: AuditFormData) => Promise<void> | void;
    isLoading: boolean;
    assets: Asset[];
    risks: Risk[];
    controls: Control[];
    projects: Project[];
    usersList: UserProfile[];
    refreshAudits: () => Promise<void> | void;
    canEdit: boolean;
    onDelete?: (audit: Audit) => void;
    documents?: Document[];
}

export const AuditsDrawer: React.FC<AuditsDrawerProps> = ({
    creationMode,
    editingAudit,
    selectedAudit,
    onClose,
    onFormSubmit,
    isLoading,
    assets,
    risks,
    controls,
    projects,
    usersList,
    refreshAudits,
    canEdit,
    onDelete,
    documents = []
}) => {
    const { t } = useStore();

    if (selectedAudit) {
        return (
            <AuditInspector
                audit={selectedAudit}
                onClose={onClose}
                controls={controls}
                documents={documents}
                assets={assets}
                risks={risks}
                projects={projects}
                usersList={usersList}
                refreshAudits={refreshAudits}
                canEdit={canEdit}
                onDelete={(id, name) => onDelete?.({ id, name } as Audit)}
            />
        );
    }

    return (
        <Drawer
            isOpen={creationMode}
            onClose={onClose}
            title={editingAudit ? t('audits.editAudit') : t('audits.newAudit')}
            width="max-w-6xl"
        >
            <AuditForm
                initialData={editingAudit || undefined}
                onSubmit={onFormSubmit}
                onCancel={onClose}
                isLoading={isLoading}
                assets={assets}
                risks={risks}
                controls={controls}
                projects={projects}
                usersList={usersList}
            />
        </Drawer>
    );
};
