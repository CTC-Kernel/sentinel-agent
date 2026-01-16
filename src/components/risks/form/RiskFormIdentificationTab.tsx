/**
 * RiskFormIdentificationTab - Threat identification tab for RiskForm
 * Extracted from RiskForm.tsx for better maintainability
 */

import React from 'react';
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
    return (
        <div className="space-y-6 glass-panel p-6 rounded-3xl border border-white/60 dark:border-white/5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-500" /> Identification de la Menace
            </h3>
            <div className="relative">
                <FloatingLabelInput
                    label="Menace (Cause Potentielle)"
                    {...control.register('threat')}
                    list="threatsList"
                    required
                    error={errors.threat?.message}
                    placeholder="Ex: Attaque par ingénierie sociale..."
                // icon={Search} - Search icon usage was incorrect for this component variant or passed incorrectly
                />
                <div className="absolute right-2 top-2 z-10 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setShowLibraryModal(true)}
                        className="p-1 px-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg text-xs font-bold transition-colors flex items-center border border-purple-200"
                    >
                        <BookOpen className="h-3 w-3 mr-1" /> Biblio
                    </button>
                    <AIAssistButton
                        context={{ asset: assets.find(a => a.id === getValues('assetId')), existingThreats: STANDARD_THREATS }}
                        fieldName="Menace"
                        prompt="Suggère une menace de sécurité pertinente pour cet actif. Réponds uniquement par le titre."
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
                            label="Vulnérabilité (Faiblesse)"
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.vulnerability?.message}
                        />
                    )}
                />
                <div className="absolute right-2 top-2 z-10">
                    <AIAssistButton
                        context={{ asset: assets.find(a => a.id === getValues('assetId')), threat: getValues('threat') }}
                        fieldName="Vulnérabilité"
                        prompt="Décris une vulnérabilité qui permettrait cette menace. Sois concis."
                        onSuggest={(val: string) => setValue('vulnerability', val, { shouldDirty: true })}
                    />
                </div>
            </div>

            <FloatingLabelInput
                label="Scénario de Risque & Conséquences"
                {...control.register('scenario')}
                textarea
                rows={4}
            />
        </div>
    );
});

RiskFormIdentificationTab.displayName = 'RiskFormIdentificationTab';
