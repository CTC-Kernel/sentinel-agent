import React from 'react';
import { useTranslation } from 'react-i18next';
import { useZodForm } from '../../hooks/useZodForm';
import { Controller } from 'react-hook-form';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { createEbiosAnalysisSchema, type CreateEbiosAnalysisFormData } from '../../schemas/ebiosSchema';
import { Shield } from '../ui/Icons';

interface CreateAnalysisDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: CreateEbiosAnalysisFormData) => Promise<void> | void;
    isLoading?: boolean;
}

export const CreateAnalysisDrawer: React.FC<CreateAnalysisDrawerProps> = ({
    isOpen,
    onClose,
    onSave,
    isLoading = false
}) => {
    const { t } = useTranslation();

    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
        control
    } = useZodForm({
        schema: createEbiosAnalysisSchema,
        defaultValues: {
            name: '',
            description: '',
            sector: '',
            targetCertificationDate: ''
        },
    });

    // Reset form when opening
    React.useEffect(() => {
        if (isOpen) {
            reset();
        }
    }, [isOpen, reset]);

    const onSubmit = async (data: CreateEbiosAnalysisFormData) => {
        await onSave(data);
    };

    const sectorOptions = [
        { value: 'finance', label: t('ebios.sectors.finance') },
        { value: 'healthcare', label: t('ebios.sectors.healthcare') },
        { value: 'energy', label: t('ebios.sectors.energy') },
        { value: 'transport', label: t('ebios.sectors.transport') },
        { value: 'telecommunications', label: t('ebios.sectors.telecommunications') },
        { value: 'government', label: t('ebios.sectors.government') },
        { value: 'industry', label: t('ebios.sectors.industry') },
        { value: 'retail', label: t('ebios.sectors.retail') },
        { value: 'other', label: t('ebios.sectors.other') },
    ];

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 shadow-sm border border-border/40">
                        <Shield className="h-5 w-5" />
                    </div>
                    {t('ebios.createAnalysis')}
                </div>
            }
            subtitle={t('ebios.createAnalysisInfo')}
            width="max-w-xl"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
                <div className="flex-1 space-y-6 pt-6 px-1">
                    {/* Name */}
                    <FloatingLabelInput
                        label={t('ebios.analysisName')}
                        placeholder={t('ebios.analysisNamePlaceholder')}
                        error={errors.name?.message}
                        {...register('name')}
                        autoFocus
                    />

                    {/* Description */}
                    <FloatingLabelInput
                        label={t('ebios.analysisDescription')}
                        placeholder={t('ebios.analysisDescriptionPlaceholder')}
                        textarea
                        rows={4}
                        error={errors.description?.message}
                        {...register('description')}
                    />

                    {/* Sector */}
                    <Controller
                        name="sector"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label={t('ebios.sector')}
                                options={[
                                    { value: "", label: t('ebios.selectSector') },
                                    ...sectorOptions
                                ]}
                                value={field.value || ""}
                                onChange={field.onChange}
                                error={errors.sector?.message}
                            />
                        )}
                    />

                    {/* Target Date */}
                    <FloatingLabelInput
                        type="date"
                        label={t('ebios.targetCertificationDate')}
                        error={errors.targetCertificationDate?.message}
                        {...register('targetCertificationDate')}
                    />
                </div>

                <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-border/40">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isLoading}
                    >
                        {t('ebios.startAnalysis')}
                    </Button>
                </div>
            </form>
        </Drawer>
    );
};

export default CreateAnalysisDrawer;
