import React, { useState } from 'react';
import { Supplier, UserProfile, BusinessProcess, Asset, Risk, Document as GRCDocument } from '../../types';
import { InspectorLayout } from '../ui/InspectorLayout';
import { SupplierForm } from './SupplierForm';
import {
    Building,
    FileSpreadsheet,
    MessageSquare,
    ClipboardList,
} from '../ui/Icons';
import { ResourceHistory } from '../shared/ResourceHistory';
import { CommentSection } from '../collaboration/CommentSection';
import { EmptyState } from '../ui/EmptyState';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import type { SubmitHandler } from 'react-hook-form';
import { SupplierFormData } from '../../schemas/supplierSchema';

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
    onStartAssessment
}) => {
    // Tabs state
    const [inspectorTab, setInspectorTab] = useState<'profile' | 'assessment' | 'history' | 'comments'>('profile');

    const tabs = [
        { id: 'profile', label: 'Profil', icon: Building }, // Changed ID from 'details' to 'profile' to match original usage in Suppliers.tsx if we want, but 'profile' is fine.
        { id: 'assessment', label: 'Évaluations', icon: ClipboardList }, // Added Assessment tab
        { id: 'history', label: 'Historique', icon: FileSpreadsheet },
        { id: 'comments', label: 'Commentaires', icon: MessageSquare }
    ];

    const handleUpdate: SubmitHandler<SupplierFormData> = async (data) => {
        // Validation handled by SupplierForm with zodResolver + supplierSchema
        await onUpdate(data);
    };

    return (
        <InspectorLayout
            isOpen={true}
            onClose={onClose}
            title={supplier.name}
            subtitle="Détails du fournisseur"
            width="max-w-4xl"
            actions={
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <CustomTooltip content="Démarrer une évaluation">
                            <button
                                aria-label="Démarrer une évaluation"
                                onClick={onStartAssessment}
                                className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
            onTabChange={(id) => setInspectorTab(id as 'profile' | 'assessment' | 'history' | 'comments')}
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
                        <div className="p-6 h-full overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="font-bold text-lg text-slate-900 dark:text-white">Évaluations</h2>
                                {canEdit && (
                                    <button
                                        aria-label="Nouvelle Évaluation"
                                        onClick={onStartAssessment}
                                        className="px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 shadow-lg shadow-brand-500/20"
                                    >
                                        Nouvelle Évaluation
                                    </button>
                                )}
                            </div>
                            <div className="space-y-4">
                                <EmptyState
                                    icon={ClipboardList}
                                    title="Aucune évaluation"
                                    description="Lancez une évaluation pour ce fournisseur."
                                />
                            </div>
                        </div>
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
