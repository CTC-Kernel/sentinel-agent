/**
 * RiskFormContextTab - Context & Assets tab for RiskForm
 * Extracted from RiskForm.tsx for better maintainability
 */

import React from 'react';
import { Controller } from 'react-hook-form';
import { LayoutGrid } from '../../ui/Icons';
import { CustomSelect } from '../../ui/CustomSelect';
import { FRAMEWORK_OPTIONS } from '../../../data/frameworks';
import { RiskFormContextTabProps } from './riskFormTypes';

export const RiskFormContextTab: React.FC<RiskFormContextTabProps> = React.memo(({
    control,
    errors,
    assets,
    usersList,
    processes,
    suppliers,
    setValue,
}) => {
    return (
        <div className="space-y-6 glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-brand-500" /> Le Contexte du Risque
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <Controller
                    name="framework"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Référentiel / Standard"
                            value={field.value || ''}
                            onChange={(val) => {
                                field.onChange(val);
                                setValue('threat', '');
                                setValue('vulnerability', '');
                            }}
                            options={FRAMEWORK_OPTIONS}
                            placeholder="Sélectionner un référentiel..."
                            required
                        />
                    )}
                />
                <Controller
                    name="assetId"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Actif Principal Concerné"
                            value={field.value || ''}
                            onChange={field.onChange}
                            options={assets.map(a => ({ value: a.id, label: a.name, subLabel: a.type }))}
                            required
                            error={errors.assetId?.message}
                        />
                    )}
                />
                <Controller
                    name="ownerId"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Propriétaire du Risque"
                            value={field.value || ''}
                            onChange={field.onChange}
                            options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                        />
                    )}
                />
                <Controller
                    name="affectedProcessIds"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Processus Métier Impactés"
                            value={field.value || []}
                            onChange={field.onChange}
                            options={processes.map(p => ({ value: p.id, label: p.name, subLabel: `RTO: ${p.rto}` }))}
                            multiple
                        />
                    )}
                />
                <Controller
                    name="relatedSupplierIds"
                    control={control}
                    render={({ field }) => (
                        <CustomSelect
                            label="Fournisseurs / Tiers Concernés"
                            value={field.value || []}
                            onChange={field.onChange}
                            options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.category }))}
                            multiple
                        />
                    )}
                />
            </div>
        </div>
    );
});

RiskFormContextTab.displayName = 'RiskFormContextTab';
