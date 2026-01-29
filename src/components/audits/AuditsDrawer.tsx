
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
    const [isFormDirty, setIsFormDirty] = React.useState(false);

    const handleClose = () => {
        setIsFormDirty(false);
        onClose();
    };

    return (
        <Drawer
            isOpen={creationMode}
            onClose={handleClose}
            title={editingAudit ? t('audits.editAudit') : t('audits.newAudit')}
            width="max-w-6xl"
            hasUnsavedChanges={isFormDirty}
        >
            <AuditForm
                initialData={editingAudit || undefined}
                onSubmit={async (data) => {
                    await onFormSubmit(data);
                    setIsFormDirty(false);
                }}
                onCancel={handleClose}
                isLoading={isLoading}
                assets={assets}
                risks={risks}
                controls={controls}
                projects={projects}
                usersList={usersList}
                onDirtyChange={setIsFormDirty}
            />
        </Drawer>
    );
};
