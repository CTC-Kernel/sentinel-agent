import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import { useStore } from '../../store';
import { useThreatIntelActions } from '../../hooks/threats/useThreatIntelActions';
import { Button } from '../ui/button';
import { Threat, Risk } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { Drawer } from '../ui/Drawer';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';

const schema = z.object({
    assetId: z.string().min(1, "L'actif est requis"),
    scenario: z.string().min(10, "Le scénario est requis"),
    probability: z.string(), // Form returns string usually
    impact: z.string(),
    strategy: z.enum(['Accepter', 'Atténuer', 'Transférer', 'Éviter']),
});

type FormData = z.infer<typeof schema>;

interface ThreatToRiskDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    threat: Threat | null;
}

export const ThreatToRiskDrawer: React.FC<ThreatToRiskDrawerProps> = ({ isOpen, onClose, threat }) => {
    const { user, addToast } = useStore();
    const { assets, addRisk, updateCommunityThreat } = useThreatIntelActions();

    const { control, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            probability: '3',
            impact: '3',
            strategy: 'Atténuer',
            assetId: '',
            scenario: ''
        }
    });

    useEffect(() => {
        if (threat) {
            setValue('scenario', `Menace détectée : ${threat.title}\n\nSource : Threat Intel (${threat.source || 'Community'})`);
        }
    }, [threat, setValue]);

    const onSubmit = async (data: FormData) => {
        if (!user || !threat) return;
        try {
            const prob = parseInt(data.probability);
            const imp = parseInt(data.impact);
            const score = prob * imp;

            const riskId = await addRisk({
                organizationId: user.organizationId,
                assetId: data.assetId,
                threat: threat.title,
                scenario: data.scenario,
                vulnerability: 'Source externe (Threat Intel)',
                probability: prob as 1 | 2 | 3 | 4 | 5,
                impact: imp as 1 | 2 | 3 | 4 | 5,
                score: score,
                strategy: data.strategy,
                status: 'Ouvert',
                owner: user.email,
                ownerId: user.uid,
                createdAt: new Date().toISOString(),
                relatedThreatId: threat.id
            } as unknown as Partial<Risk>);

            // Bidirectional linking: Mark threat as processed into a risk
            if (riskId) {
                await updateCommunityThreat(threat.id, {
                    relatedRiskId: riskId,
                    status: 'Processed'
                });
            }

            addToast("Risque créé avec succès", "success");
            reset();
            onClose();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ThreatToRiskDrawer.onSubmit', 'CREATE_FAILED');
        }
    };

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title="Mettre en Risque"
            subtitle={`Transformer "${threat ? threat.title : 'cette menace'}" en risque formel.`}
            width="max-w-2xl"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    <Controller
                        name="assetId"
                        control={control}
                        render={({ field }) => (
                            <div className="relative">
                                {/* Enhanced Select for Assets would be better, but CustomSelect works if we map it */}
                                <CustomSelect
                                    label="Actif concerné"
                                    options={assets.map(a => ({ value: a.id, label: `${a.name} (${a.type})` }))}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.assetId?.message}
                                />
                            </div>
                        )}
                    />

                    <Controller
                        name="scenario"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput
                                label="Scénario de Risque"
                                {...field}
                                error={errors.scenario?.message}
                                textarea
                                className="min-h-[120px]"
                            />
                        )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Controller
                            name="probability"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Probabilité (1-5)"
                                    options={[1, 2, 3, 4, 5].map(String).map(v => ({ value: v, label: v }))}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                        <Controller
                            name="impact"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Impact (1-5)"
                                    options={[1, 2, 3, 4, 5].map(String).map(v => ({ value: v, label: v }))}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>

                    <Controller
                        name="strategy"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Stratégie"
                                options={[
                                    { value: 'Atténuer', label: 'Atténuer' },
                                    { value: 'Accepter', label: 'Accepter' },
                                    { value: 'Transférer', label: 'Transférer' },
                                    { value: 'Éviter', label: 'Éviter' }
                                ]}
                                value={field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </div>

                <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 shrink-0 flex justify-end gap-3 bg-white dark:bg-slate-900 z-10">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                        Annuler
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20 gap-2"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Créer Risque
                    </Button>
                </div>
            </form>
        </Drawer>
    );
};
