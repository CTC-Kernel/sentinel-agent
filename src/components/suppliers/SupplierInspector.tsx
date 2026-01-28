import React, { useState } from 'react';
import { Supplier, UserProfile, BusinessProcess, Asset, Risk, Document as GRCDocument, SupplierQuestionnaireResponse } from '../../types';
import { InspectorLayout } from '../ui/InspectorLayout';
import { SupplierForm } from './SupplierForm';
import {
    Building,
    FileSpreadsheet,
    MessageSquare,
    ClipboardList,
    Scale
} from '../ui/Icons';
import { ResourceHistory } from '../shared/ResourceHistory';
import { CommentSection } from '../collaboration/CommentSection';
import { getUserAvatarUrl } from '../../utils/avatarUtils';

import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import type { SubmitHandler } from 'react-hook-form';
import { SupplierFormData } from '../../schemas/supplierSchema';
import { SupplierAssessments } from './inspector/SupplierAssessments';
import { SupplierContractCompliance } from './inspector/SupplierContractCompliance';

interface SupplierInspectorProps {
    supplier: Supplier;
    onClose: () => void;
    canEdit: boolean;
    onUpdate: (data: SupplierFormData) => Promise<void>;
    isLoading?: boolean;
    users: UserProfile[];
    processes: BusinessProcess[];
    assets: Asset[];
    risks: Risk[];
    documents: GRCDocument[];
    onStartAssessment: () => void;
    assessments: SupplierQuestionnaireResponse[];
    onViewAssessment: (id: string) => void;
}

export const SupplierInspector: React.FC<SupplierInspectorProps> = ({
    supplier,
    onClose,
    canEdit,
    onUpdate,
    isLoading,
    users,
    processes,
    assets,
    risks,
    documents,
    onStartAssessment,
    assessments,
    onViewAssessment
}) => {
    // Tabs state
    const [inspectorTab, setInspectorTab] = useState<'profile' | 'assessment' | 'contracts' | 'history' | 'comments'>('profile');

    const tabs = [
        { id: 'profile', label: 'Profil', icon: Building },
        { id: 'assessment', label: 'Évaluations', icon: ClipboardList },
        { id: 'contracts', label: 'Contrats & DORA', icon: Scale },
        { id: 'history', label: 'Historique', icon: FileSpreadsheet },
        { id: 'comments', label: 'Commentaires', icon: MessageSquare }
    ];

    const handleUpdate: SubmitHandler<SupplierFormData> = async (data) => {
        // Validation handled by SupplierForm with zodResolver + supplierSchema
        await onUpdate(data);
    };

    const contactUser = users?.find(u =>
        (supplier.contactName && u.displayName === supplier.contactName) ||
        (supplier.contactEmail && u.email === supplier.contactEmail)
    );

    return (
        <InspectorLayout
            isOpen={true}
            onClose={onClose}
            title={supplier.name}
            subtitle={
                <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Contact principal:</span>
                    <div className="flex items-center gap-2">
                        <img
                            src={getUserAvatarUrl(contactUser?.photoURL, contactUser?.role)}
                            alt={supplier.contactName || 'Inconnu'}
                            className="w-5 h-5 rounded-full object-cover bg-slate-100 dark:bg-slate-800 border border-border/40 dark:border-slate-700"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = getUserAvatarUrl(null, contactUser?.role || 'user');
                            }}
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300 dark:text-muted-foreground">
                            {supplier.contactName || 'Non assigné'}
                        </span>
                    </div>
                </div>
            }
            width="max-w-6xl"
            actions={
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <CustomTooltip content="Démarrer une évaluation">
                            <button
                                aria-label="Démarrer une évaluation"
                                onClick={onStartAssessment}
                                className="p-2 text-slate-500 dark:text-slate-300 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            >
                                <ClipboardList className="h-5 w-5" />
                            </button>
                        </CustomTooltip>
                    )}
                    <button
                        aria-label="Discussion"
                        onClick={() => setInspectorTab('comments')}
                        className={`p-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${inspectorTab === 'comments' ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        <MessageSquare className="h-5 w-5" />
                    </button>
                </div>
            }
            tabs={tabs}
            activeTab={inspectorTab}
            onTabChange={(id) => setInspectorTab(id as 'profile' | 'assessment' | 'contracts' | 'history' | 'comments')}
        >
            <div className="h-full flex flex-col">
                <div className="flex-1 overflow-hidden relative">
                    {inspectorTab === 'profile' && (
                        <SupplierForm
                            initialData={supplier}
                            onSubmit={handleUpdate}
                            onCancel={onClose}
                            isLoading={isLoading}
                            users={users}
                            processes={processes}
                            assets={assets}
                            risks={risks}
                            documents={documents}
                            isEditing={true}
                            readOnly={!canEdit} // Pass readOnly based on permissions
                        />
                    )}
                    {inspectorTab === 'assessment' && (
                        <SupplierAssessments
                            canEdit={canEdit}
                            onStartAssessment={onStartAssessment}
                            assessments={assessments}
                            onViewAssessment={onViewAssessment}
                        />
                    )}
                    {inspectorTab === 'contracts' && (
                        <SupplierContractCompliance
                            supplier={supplier}
                            canEdit={canEdit}
                            onUpdate={onUpdate}
                        />
                    )}
                    {inspectorTab === 'history' && (
                        <div className="p-6 h-full overflow-y-auto">
                            <ResourceHistory resourceId={supplier.id} resourceType="suppliers" />
                        </div>
                    )}
                    {inspectorTab === 'comments' && (
                        <div className="p-6 h-full overflow-y-auto">
                            <CommentSection collectionName="suppliers" documentId={supplier.id} />
                        </div>
                    )}
                </div>
            </div>
        </InspectorLayout>
    );
};
