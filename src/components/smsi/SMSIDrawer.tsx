import React, { useEffect } from 'react';
import { useStore } from '../../store';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { useZodForm } from '../../hooks/useZodForm';
import { z } from 'zod';
import { FieldValues } from 'react-hook-form';
import { SMSIProgram } from '../../types/ebios';

const smsiSchema = z.object({
    name: z.string().min(1, 'Le nom est requis'),
    description: z.string().optional(),
    targetCertificationDate: z.string().optional(),
    isCertified: z.boolean().optional(),
});

type SMSIFormData = z.infer<typeof smsiSchema>;

interface SMSIDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    program?: SMSIProgram | null;
    onSubmit: (data: SMSIFormData) => Promise<void>;
    isLoading?: boolean;
}

export const SMSIDrawer: React.FC<SMSIDrawerProps> = ({
    isOpen,
    onClose,
    program,
    onSubmit,
    isLoading = false
}) => {
    const { t } = useStore();

    const { register, handleSubmit, formState: { errors }, reset } = useZodForm({
        schema: smsiSchema,
        defaultValues: {
            name: program?.name || '',
            description: program?.description || '',
            targetCertificationDate: program?.targetCertificationDate ? new Date(program.targetCertificationDate).toISOString().split('T')[0] : '',
            isCertified: false
        }
    });

    useEffect(() => {
        if (isOpen) {
            reset({
                name: program?.name || '',
                description: program?.description || '',
                targetCertificationDate: program?.targetCertificationDate ? new Date(program.targetCertificationDate).toISOString().split('T')[0] : '',
                isCertified: false
            });
        }
    }, [isOpen, program, reset]);

    const handleFormSubmit = async (data: FieldValues) => {
        await onSubmit(data as SMSIFormData);
    };

    const title = program ? t('smsi.editProgram') : t('smsi.newProgram');
    const subtitle = t('smsi.programDetails');

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            subtitle={subtitle}
            width="max-w-xl"
        >
            <form id="smsi-form" onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col h-full">
                <div className="flex-1 space-y-6 pt-6 px-1">
                    <FloatingLabelInput
                        label={t('common.name')}
                        placeholder="Ex: Certification ISO 27001 - 2025"
                        required
                        error={errors.name?.message}
                        {...register('name')}
                    />

                    <FloatingLabelTextarea
                        label={t('common.description')}
                        placeholder="Description du périmètre et des objectifs..."
                        rows={4}
                        error={errors.description?.message}
                        {...register('description')}
                    />

                    <FloatingLabelInput
                        type="date"
                        label={t('smsi.targetDate')}
                        error={errors.targetCertificationDate?.message}
                        {...register('targetCertificationDate')}
                    />
                </div>

                <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
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
                        {program ? t('common.save') : t('common.create')}
                    </Button>
                </div>
            </form>
        </Drawer>
    );
};
