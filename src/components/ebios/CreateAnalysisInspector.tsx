import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Info } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '../../utils/cn';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Button } from '../ui/button';
import { createEbiosAnalysisSchema, type CreateEbiosAnalysisFormData } from '../../schemas/ebiosSchema';

interface CreateAnalysisInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string; description?: string; sector?: string; targetCertificationDate?: string }) => void;
}

export const CreateAnalysisInspector: React.FC<CreateAnalysisInspectorProps> = ({
    isOpen,
    onClose,
    onSave,
}) => {
    const { t } = useTranslation();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<CreateEbiosAnalysisFormData>({
        resolver: zodResolver(createEbiosAnalysisSchema),
        defaultValues: {
            name: '',
            description: '',
        },
    });

    // Reset form when opening/closing
    React.useEffect(() => {
        if (isOpen) {
            reset();
        }
    }, [isOpen, reset]);

    const onSubmit = (data: CreateEbiosAnalysisFormData) => {
        onSave(data);
    };

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={t('ebios.createAnalysis')}
            subtitle={t('ebios.createAnalysisSubtitle') || "Nouvelle analyse des risques"}
            icon={ShieldCheck}
            width="max-w-xl"
            footer={
                <div className="flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isSubmitting ? t('common.saving') : t('ebios.startAnalysis')}
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                {/* Info Box */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50 flex gap-3">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        {t('ebios.createAnalysisInfo')}
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {t('ebios.analysisName')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register('name')}
                            className={cn(
                                "w-full px-4 py-2.5 rounded-xl border transition-colors",
                                "bg-white dark:bg-slate-800 text-gray-900 dark:text-white",
                                errors.name
                                    ? "border-red-300 dark:border-red-700 focus:ring-red-500/20"
                                    : "border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            )}
                            placeholder={t('ebios.analysisNamePlaceholder')}
                            autoFocus
                        />
                        {errors.name && (
                            <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {t('ebios.analysisDescription')}
                        </label>
                        <textarea
                            {...register('description')}
                            rows={4}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white resize-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                            placeholder={t('ebios.analysisDescriptionPlaceholder')}
                        />
                    </div>

                    {/* Sector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {t('ebios.sector')}
                        </label>
                        <select
                            {...register('sector')}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        >
                            <option value="">{t('ebios.selectSector')}</option>
                            <option value="finance">{t('ebios.sectors.finance')}</option>
                            <option value="healthcare">{t('ebios.sectors.healthcare')}</option>
                            <option value="energy">{t('ebios.sectors.energy')}</option>
                            <option value="transport">{t('ebios.sectors.transport')}</option>
                            <option value="telecommunications">{t('ebios.sectors.telecommunications')}</option>
                            <option value="government">{t('ebios.sectors.government')}</option>
                            <option value="industry">{t('ebios.sectors.industry')}</option>
                            <option value="retail">{t('ebios.sectors.retail')}</option>
                            <option value="other">{t('ebios.sectors.other')}</option>
                        </select>
                    </div>

                    {/* Target Certification Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            {t('ebios.targetCertificationDate')}
                        </label>
                        <input
                            type="date"
                            {...register('targetCertificationDate')}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                    </div>
                </form>
            </div>
        </InspectorLayout>
    );
};

export default CreateAnalysisInspector;
