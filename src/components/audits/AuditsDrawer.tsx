
import React from 'react';
import { Drawer } from '../ui/Drawer';
import { AuditForm } from './AuditForm';
import { useStore } from '../../store';
import { Audit, Control, Asset, Risk, Project, UserProfile } from '../../types';
import { AuditFormData } from '../../schemas/auditSchema';

interface AuditsDrawerProps {
    creationMode: boolean;
    editingAudit: Audit | null;
    onClose: () => void;
    onFormSubmit: (data: AuditFormData) => Promise<void> | void;
    isLoading: boolean;
    assets: Asset[];
    risks: Risk[];
    controls: Control[];
    projects: Project[];
    usersList: UserProfile[];
}

export const AuditsDrawer: React.FC<AuditsDrawerProps> = ({
    creationMode,
    editingAudit,
    onClose,
    onFormSubmit,
    isLoading,
    assets,
    risks,
    controls,
    projects,
    usersList,
}) => {
    const { t } = useStore();

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
