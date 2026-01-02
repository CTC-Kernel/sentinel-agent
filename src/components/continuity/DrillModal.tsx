import { useForm, Controller } from 'react-hook-form';
import { Modal } from '../ui/Modal';
import { BusinessProcess, BcpDrill } from '../../types';
import { Loader2, Save } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/button';

interface DrillModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<BcpDrill>) => Promise<void>;
    processes: BusinessProcess[];
    isLoading?: boolean;
}

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const drillSchema = z.object({
    processId: z.string().min(1, 'Ce champ est requis'),
    type: z.enum(["Tabletop", "Simulation", "Bascule réelle", "Full Scale", "Call Tree"]),
    date: z.string().min(1, 'Une date est requise'),
    result: z.enum(["Succès", "Succès partiel", "Échec"]),
    notes: z.string().optional()
});

type DrillFormData = z.infer<typeof drillSchema>;

export const DrillModal: React.FC<DrillModalProps> = ({ isOpen, onClose, onSubmit, processes }) => {
    const { handleSubmit, control, formState: { errors, isSubmitting } } = useForm<DrillFormData>({
        resolver: zodResolver(drillSchema)
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Enregistrer un Exercice">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <Controller<DrillFormData>
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

                <div>
                    <Controller<DrillFormData>
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
                </div>

                <div>
                    <Controller<DrillFormData>
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

                <div>
                    <Controller<DrillFormData>
                        name="result"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Résultat"
                                options={[
                                    { value: "Succès", label: "Succès" },
                                    { value: "Succès partiel", label: "Partiel" },
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

                <div className="flex justify-end gap-2 pt-4">
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

// Headless UI handles FocusTrap and keyboard navigation
