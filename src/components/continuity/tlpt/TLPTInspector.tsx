import React, { useState } from 'react';
import { TlptCampaign } from '../../../types/tlpt';
import { InspectorLayout } from '../../ui/InspectorLayout';
import { TLPTForm } from './TLPTForm';
import { TlptFindings } from './TlptFindings';
import {
    Target,
    ShieldAlert,
    Trash
} from 'lucide-react';
import { Button } from '../../ui/button';

interface TLPTInspectorProps {
    campaign?: Partial<TlptCampaign>;
    onClose: () => void;
    onUpdate: (data: Partial<TlptCampaign>) => Promise<void>;
    isLoading?: boolean;
    canEdit?: boolean;
    onDelete?: (id: string) => Promise<void>;
}

export const TLPTInspector: React.FC<TLPTInspectorProps> = ({
    campaign,
    onClose,
    onUpdate,
    isLoading,
    canEdit = false,
    onDelete
}) => {
    const [activeTab, setActiveTab] = useState<'details' | 'findings' | 'report'>('details');

    const isNew = !campaign?.id;

    const tabs = [
        { id: 'details', label: 'Détails', icon: Target },
        { id: 'findings', label: 'Constatations', icon: ShieldAlert, disabled: isNew },
        // { id: 'report', label: 'Rapport', icon: FileText } // Future placeholder
    ];

    return (
        <InspectorLayout
            isOpen={true}
            onClose={onClose}
            title={campaign?.name || 'Nouvelle Campagne'}
            subtitle={campaign?.provider ? `Prestataire: ${campaign.provider}` : undefined}
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as any)}
            width="max-w-4xl"
            actions={
                <div className="flex items-center gap-2">
                    {onDelete && campaign?.id && canEdit && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                                if (confirm('Supprimer cette campagne ?')) {
                                    await onDelete(campaign.id!);
                                    onClose();
                                }
                            }}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                            <Trash className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            }
        >
            <div className="h-full flex flex-col">
                <div className="flex-1 overflow-hidden relative">
                    {activeTab === 'details' && (
                        <div className="h-full overflow-y-auto custom-scrollbar">
                            <TLPTForm
                                initialData={campaign as TlptCampaign}
                                onSubmit={onUpdate}
                                onCancel={onClose}
                                isLoading={isLoading}
                                isEditing={!isNew}
                                readOnly={!canEdit && !isNew}
                            />
                        </div>
                    )}

                    {activeTab === 'findings' && campaign && (
                        <div className="p-6 h-full overflow-y-auto custom-scrollbar">
                            <TlptFindings campaign={campaign as TlptCampaign} />
                        </div>
                    )}
                </div>
            </div>
        </InspectorLayout>
    );
};
