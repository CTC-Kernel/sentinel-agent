/**
 * RiskFormIdentificationTab - Threat identification tab for RiskForm
 * Extracted from RiskForm.tsx for better maintainability
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Controller } from 'react-hook-form';
import { FileText, BookOpen } from '../../ui/Icons';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { RichTextEditor } from '../../ui/RichTextEditor';
import { AIAssistButton } from '../../ai/AIAssistButton';
import { STANDARD_THREATS } from '../../../data/riskConstants';
import { RiskFormIdentificationTabProps } from './riskFormTypes';

export const RiskFormIdentificationTab: React.FC<RiskFormIdentificationTabProps> = React.memo(({
    control,
    errors,
    assets,
    getValues,
    setValue,
    setShowLibraryModal,
}) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-6 glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-500" /> {t('risks.tabs.identification')}
            </h3>
            <div className="relative">
                <FloatingLabelInput
                    label={t('common.threat') || "Menace (Cause Potentielle)"}
                    {...control.register('threat')}
                    list="threatsList"
                    required
                    error={errors.threat?.message}
                    placeholder={t('risks.searchPlaceholder') || "Ex: Attaque par ingénierie sociale..."}
                // icon={Search} - Search icon usage was incorrect for this component variant or passed incorrectly
                />
                <div className="absolute right-2 top-2 z-10 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setShowLibraryModal(true)}
                        className="p-1 px-2 bg-violet-50 hover:bg-violet-100 text-violet-600 rounded-lg text-xs font-bold transition-colors flex items-center border border-violet-200"
                    >
                        <BookOpen className="h-3 w-3 mr-1" /> {t('common.library') || "Biblio"}
                    </button>
                    <AIAssistButton
                        context={{ asset: assets.find(a => a.id === getValues('assetId')), existingThreats: STANDARD_THREATS }}
                        fieldName={t('common.threat')}
                        prompt={t('ai.prompts.default') || "Suggère une menace de sécurité pertinente pour cet actif."}
                        onSuggest={(val: string) => setValue('threat', val, { shouldDirty: true })}
                    />
                </div>
                <datalist id="threatsList">
                    {STANDARD_THREATS.map((t) => <option key={t} value={t} />)}
                </datalist>
            </div>

            <div className="relative">
                <Controller
                    control={control}
                    name="vulnerability"
                    render={({ field }) => (
                        <RichTextEditor
                            label={t('common.vulnerability') || "Vulnérabilité (Faiblesse)"}
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.vulnerability?.message}
                        />
                    )}
                />
                <div className="absolute right-2 top-2 z-10">
                    <AIAssistButton
                        context={{ asset: assets.find(a => a.id === getValues('assetId')), threat: getValues('threat') }}
                        fieldName={t('common.vulnerability')}
                        prompt={t('ai.prompts.default') || "Décris une vulnérabilité qui permettrait cette menace."}
                        onSuggest={(val: string) => setValue('vulnerability', val, { shouldDirty: true })}
                    />
                </div>
            </div>

            <FloatingLabelInput
                label={t('risks.scenario') || "Scénario de Risque & Conséquences"}
                {...control.register('scenario')}
                textarea
                rows={4}
            />
        </div>
    );
});

RiskFormIdentificationTab.displayName = 'RiskFormIdentificationTab';
