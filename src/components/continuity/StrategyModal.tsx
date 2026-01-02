import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../ui/Modal';
import { Asset } from '../../types';
import { Loader2, Save, Clock } from 'lucide-react';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { Button } from '../ui/button';
import { strategySchema, StrategyFormData } from '../../schemas/continuitySchema';

interface StrategyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: StrategyFormData) => Promise<void>;
    initialData?: Partial<StrategyFormData>;
    assets: Asset[];
    isEditing?: boolean;
}

const DatabaseIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s 9-1.34 9-3V5"></path></svg>
);

export const StrategyModal: React.FC<StrategyModalProps> = ({ isOpen, onClose, onSubmit, initialData, assets, isEditing }) => {
    const { handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<StrategyFormData>({
        resolver: zodResolver(strategySchema),
        defaultValues: {
            title: initialData?.title || '',
            type: initialData?.type || undefined,
            rto: initialData?.rto || '',
            rpo: initialData?.rpo || '',
            description: initialData?.description || '',
            linkedAssets: initialData?.linkedAssets || []
        }
    });

    React.useEffect(() => {
        if (initialData) {
            setValue('title', initialData.title || '');
            if (initialData.type) {
                setValue('type', initialData.type);
            }
            setValue('rto', initialData.rto || '');
            setValue('rpo', initialData.rpo || '');
            setValue('description', initialData.description || '');
            setValue('linkedAssets', initialData.linkedAssets || []);
        }
    }, [initialData, setValue]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Modifier la Stratégie" : "Nouvelle Stratégie"}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Controller
                            name="title"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label="Titre"
                                    placeholder="Titre (ex: Réplication S3 Cross-Region)"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.title?.message}
                                />
                            )}
                        />
                    </div>
                    <div>
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Type de stratégie"
                                    options={[
                                        { value: "Active-Active", label: "Active-Active (Haute Dispo)" },
                                        { value: "Active-Passive", label: "Active-Passive (Failover)" },
                                        { value: "Cold Standby", label: "Cold Standby (Redémarrage manuel)" },
                                        { value: "Cloud DR", label: "Cloud Disaster Recovery" }
                                    ]}
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    error={errors.type?.message}
                                />
                            )}
                        />
                    </div>
                    <div className="flex gap-2 col-span-1 md:col-span-2">
                        <div className="flex-1 relative">
                            <Controller
                                name="rto"
                                control={control}
                                render={({ field }) => (
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-400 z-10" />
                                        <FloatingLabelInput
                                            label="RTO"
                                            placeholder="ex: 4h"
                                            value={field.value}
                                            onChange={field.onChange}
                                            className="pl-10"
                                            error={errors.rto?.message}
                                        />
                                    </div>
                                )}
                            />
                        </div>
                        <div className="flex-1 relative">
                            <Controller
                                name="rpo"
                                control={control}
                                render={({ field }) => (
                                    <div className="relative">
                                        <DatabaseIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400 z-10" />
                                        <FloatingLabelInput
                                            label="RPO"
                                            placeholder="ex: 15min"
                                            value={field.value}
                                            onChange={field.onChange}
                                            className="pl-10"
                                            error={errors.rpo?.message}
                                        />
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                        <Controller
                            name="linkedAssets"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Actifs liés"
                                    options={assets.map(a => ({ value: a.id, label: a.name }))}
                                    value={field.value || []}
                                    onChange={field.onChange}
                                    multiple
                                    placeholder="Sélectionner les actifs couverts..."
                                />
                            )}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-brand-600 text-white">
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
