import React from 'react';
import { ClipboardList } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';
import { SupplierAssessment } from '../../../types';

interface SupplierAssessmentsProps {
    canEdit: boolean;
    onStartAssessment: () => void;
    assessments: SupplierAssessment[];
}

export const SupplierAssessments: React.FC<SupplierAssessmentsProps> = ({
    canEdit,
    onStartAssessment,
    assessments
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
                {assessments.length === 0 ? (
                    <EmptyState
                        icon={ClipboardList}
                        title="Aucune évaluation"
                        description="Lancez une évaluation pour ce fournisseur."
                    />
                ) : (
                    assessments.map((assessment) => (
                        <div key={assessment.id} className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-white/10">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                                        Évaluation du {new Date(assessment.assessmentDate).toLocaleDateString('fr-FR')}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        Évaluateur : {assessment.assessorName}
                                    </p>
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                    Terminé
                                </span>
                            </div>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{assessment.categories.security.score}</div>
                                        <div className="text-xs text-slate-600 dark:text-slate-400">Sécurité</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{assessment.categories.compliance.score}</div>
                                        <div className="text-xs text-slate-600 dark:text-slate-400">Conformité</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{assessment.categories.operational.score}</div>
                                        <div className="text-xs text-slate-600 dark:text-slate-400">Opérationnel</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{assessment.categories.financial.score}</div>
                                        <div className="text-xs text-slate-600 dark:text-slate-400">Financier</div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Score global</span>
                                    <span className="text-lg font-bold text-slate-900 dark:text-white">{assessment.overallScore}/100</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
