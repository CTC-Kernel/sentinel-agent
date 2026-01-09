import React from 'react';
import { ClipboardList, FileText, ChevronRight, Clock, CheckCircle2 } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { SupplierQuestionnaireResponse } from '../../../types';
import { Button } from '../../ui/button';

interface SupplierAssessmentsProps {
    canEdit: boolean;
    onStartAssessment: () => void;
    assessments: SupplierQuestionnaireResponse[];
    onViewAssessment: (id: string) => void;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Submitted': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        case 'Reviewed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        case 'Archived': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'; // Draft, In Progress
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'Draft': return 'Brouillon';
        case 'Sent': return 'Envoyé';
        case 'In Progress': return 'En cours';
        case 'Submitted': return 'Soumis';
        case 'Reviewed': return 'Revu';
        case 'Archived': return 'Archivé';
        default: return status;
    }
}

export const SupplierAssessments: React.FC<SupplierAssessmentsProps> = ({
    canEdit,
    onStartAssessment,
    assessments,
    onViewAssessment
}) => {
    return (
        <div className="p-6 h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="font-bold text-lg text-slate-900 dark:text-white">Évaluations</h2>
                    <p className="text-sm text-slate-500">Historique des évaluations de conformité DORA et ISO.</p>
                </div>
                {canEdit && (
                    <Button
                        onClick={onStartAssessment}
                        className="rounded-xl shadow-lg shadow-brand-500/20"
                    >
                        <ClipboardList className="w-4 h-4 mr-2" />
                        Nouvelle Évaluation
                    </Button>
                )}
            </div>
            <div className="space-y-4">
                {assessments.length === 0 ? (
                    <EmptyState
                        icon={ClipboardList}
                        title="Aucune évaluation"
                        description="Lancez une première évaluation DORA pour ce fournisseur."
                        actionLabel={canEdit ? "Lancer une évaluation" : undefined}
                        onAction={canEdit ? onStartAssessment : undefined}
                    />
                ) : (
                    assessments.map((assessment) => (
                        <div key={assessment.id} className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-white/10 hover:border-brand-300 dark:hover:border-brand-700 transition-colors group">
                            <div className="flex justify-between items-start">
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${assessment.status === 'Submitted' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {assessment.status === 'Submitted' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">
                                            {/* We might need to fetch template title or store it denormalized. 
                                                Assuming templateId is present, we can say "Questionnaire DORA" generic if title missing, 
                                                but ideally we have it. For now let's use a generic title + Date */}
                                            Questionnaire d'évaluation
                                        </h3>
                                        <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                            <Clock className="w-3 h-3" />
                                            {assessment.updatedAt ? new Date((assessment.updatedAt as any).seconds * 1000).toLocaleDateString('fr-FR') : 'Date inconnue'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(assessment.status)}`}>
                                        {getStatusLabel(assessment.status)}
                                    </span>
                                    {typeof assessment.overallScore === 'number' && assessment.overallScore > 0 && (
                                        <span className={`text-sm font-bold ${assessment.overallScore >= 80 ? 'text-green-600' : assessment.overallScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                            Score: {assessment.overallScore}%
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                                <Button variant="ghost" size="sm" onClick={() => onViewAssessment(assessment.id!)} className="text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/20">
                                    Voir les détails
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
