import React from 'react';
import { Controller } from 'react-hook-form';
import { useZodForm } from '../../../hooks/useZodForm';
import { bcpDrillSchema, BcpDrillFormData } from '../../../schemas/continuitySchema';
import { BusinessProcess, BcpDrill } from '../../../types';
import { Loader2, Zap, Save, Calendar } from '../../ui/Icons';
import { InspectorLayout } from '../../ui/InspectorLayout';
import { Button } from '../../ui/button';
import { CustomSelect } from '../../ui/CustomSelect';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { DatePicker } from '../../ui/DatePicker';

interface DrillInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<BcpDrill>) => Promise<void>;
    processes: BusinessProcess[];
    isLoading?: boolean;
}

export const DrillInspector: React.FC<DrillInspectorProps> = ({
    isOpen,
    onClose,
    onSubmit,
    processes,
    isLoading
}) => {
    const { handleSubmit, control, formState: { errors, isSubmitting } } = useZodForm({
        schema: bcpDrillSchema,
        mode: 'onChange'
    });

    const handleFormSubmit = async (data: BcpDrillFormData) => {
        await onSubmit(data);
        onClose();
    };

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title="Nouvel Exercice"
            subtitle="Planifier ou enregistrer un exercice de continuité"
            icon={Zap}
            width="max-w-2xl"
            footer={
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
                    <Button
                        onClick={handleSubmit(handleFormSubmit)}
                        disabled={isSubmitting || isLoading}
                        className="bg-brand-600 text-white hover:bg-brand-700"
                    >
                        {isSubmitting || isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Enregistrer
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Planification de l'exercice
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-400 dark:text-blue-300 mt-1">
                        Les exercices réguliers sont essentiels pour valider vos plans de continuité.
                    </p>
                </div>

                <form className="space-y-6">
                    <div>
                        <Controller<BcpDrillFormData>
                            name="processId"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Processus Testé"
                                    options={processes.map(p => ({ value: p.id, label: p.name }))}
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    error={errors.processId?.message}
                                />
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Controller<BcpDrillFormData>
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Type d'Exercice"
                                    options={[
                                        { value: "Tabletop", label: "Tabletop (Sur table)" },
                                        { value: "Simulation", label: "Simulation Technique" },
                                        { value: "Full Scale", label: "Grandeur Nature" },
                                        { value: "Call Tree", label: "Arbre d'Appel" }
                                    ]}
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    error={errors.type?.message}
                                />
                            )}
                        />

                        <Controller<BcpDrillFormData>
                            name="date"
                            control={control}
                            render={({ field }) => (
                                <DatePicker
                                    label="Date de l'Exercice"
                                    value={field.value}
                                    onChange={(d) => field.onChange(d)}
                                    error={errors.date?.message}
                                />
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Controller<BcpDrillFormData>
                            name="result"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Résultat"
                                    options={[
                                        { value: "Succès", label: "Succès" },
                                        { value: "Succès partiel", label: "Succès Partiel" },
                                        { value: "Échec", label: "Échec" }
                                    ]}
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    error={errors.result?.message}
                                />
                            )}
                        />
                    </div>

                    <div>
                        <Controller
                            name="notes"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label="Notes / Observations"
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    textarea
                                    className="min-h-[100px]"
                                />
                            )}
                        />
                    </div>
                </form>
            </div>
        </InspectorLayout>
    );
};
