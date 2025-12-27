import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Modal } from '../ui/Modal';
import { BusinessProcess, BcpDrill } from '../../types';
import { Loader2 } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { DatePicker } from '../ui/DatePicker';
interface DrillModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<BcpDrill>) => Promise<void>;
    processes: BusinessProcess[];
    isLoading?: boolean;
}

export const DrillModal: React.FC<DrillModalProps> = ({ isOpen, onClose, onSubmit, processes }) => {
    const { handleSubmit, control, formState: { errors, isSubmitting } } = useForm<Partial<BcpDrill>>();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Enregistrer un Exercice">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <Controller
                        name="processId"
                        control={control}
                        rules={{ required: 'Requis' }}
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

                <div>
                    <Controller
                        name="type"
                        control={control}
                        rules={{ required: 'Requis' }}
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
                </div>

                <div>
                    <Controller
                        name="date"
                        control={control}
                        rules={{ required: 'Requis' }}
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

                <div>
                    <Controller
                        name="result"
                        control={control}
                        rules={{ required: 'Requis' }}
                        render={({ field }) => (
                            <CustomSelect
                                label="Résultat"
                                options={[
                                    { value: "Succès", label: "Succès" },
                                    { value: "Partiel", label: "Partiel" },
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
                            />
                        )}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Enregistrer
                    </button>
                </div>
            </form>
        </Modal>
    );
};
