/**
 * RiskFormAssessmentTab - Risk assessment matrices tab for RiskForm
 * Extracted from RiskForm.tsx for better maintainability
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, AlertTriangle } from '../../ui/Icons';
import { RiskMatrixSelector } from '../RiskMatrixSelector';
import { Risk } from '../../../types';
import { RiskFormAssessmentTabProps } from './riskFormTypes';

export const RiskFormAssessmentTab: React.FC<RiskFormAssessmentTabProps> = React.memo(({
    probability,
    impact,
    residualProbability,
    residualImpact,
    setValue,
    readOnly,
}) => {
    const { t } = useTranslation();
    const showResidualWarning = (residualProbability && residualImpact && probability && impact) &&
        (residualProbability * residualImpact > probability * impact);

    return (
        <div className="space-y-8 glass-panel p-4 sm:p-6 rounded-3xl border border-white/60 dark:border-white/5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-brand-500" /> {t('risks.tabs.assessment')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Initial Risk Matrix - shows residual as reference */}
                <RiskMatrixSelector
                    label={t('risks.matrix.inherent') || "Évaluation du Risque Brut (Inhérent)"}
                    probability={probability}
                    impact={impact}
                    residualProbability={residualProbability}
                    residualImpact={residualImpact}
                    onChange={(p, i) => {
                        setValue('probability', p, { shouldDirty: true });
                        setValue('impact', i, { shouldDirty: true });
                    }}
                    showLegend={true}
                    showComparison={true}
                    readOnly={readOnly}
                />
                {/* Residual Risk Matrix - shows initial as reference */}
                <RiskMatrixSelector
                    label={t('risks.matrix.residual') || "Objectif / Risque Résiduel (Cible)"}
                    probability={residualProbability || probability}
                    impact={residualImpact || impact}
                    onChange={(p, i) => {
                        setValue('residualProbability', p as Risk['probability'], { shouldDirty: true });
                        setValue('residualImpact', i as Risk['impact'], { shouldDirty: true });
                    }}
                    showLegend={false}
                    showComparison={false}
                    readOnly={readOnly}
                />
            </div>

            {/* Validation Warning */}
            {showResidualWarning && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-800 dark:border-red-800 text-sm font-bold flex items-center animate-pulse">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    {t('risks.validation_residual') || `Attention: Le risque résiduel (${residualProbability * residualImpact}) ne peut pas être supérieur au risque brut (${probability * impact}).`}
                </div>
            )}
        </div>
    );
});

RiskFormAssessmentTab.displayName = 'RiskFormAssessmentTab';
