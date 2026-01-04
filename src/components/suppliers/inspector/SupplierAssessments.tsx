import React from 'react';
import { ClipboardList } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
// import { SupplierAssessment } from '../../../types'; // Future use

interface SupplierAssessmentsProps {
    canEdit: boolean;
    onStartAssessment: () => void;
    // assessments: SupplierAssessment[]; // Future
}

export const SupplierAssessments: React.FC<SupplierAssessmentsProps> = ({
    canEdit,
    onStartAssessment
}) => {
    return (
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
                {/* 
                  TODO: Map over actual assessments here.
                  Currently mostly a placeholder/empty state in original code.
                */}
                <EmptyState
                    icon={ClipboardList}
                    title="Aucune évaluation"
                    description="Lancez une évaluation pour ce fournisseur."
                />
            </div>
        </div>
    );
};
