import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Globe, Loader2, Save, Network } from '../ui/Icons';
import { useStore } from '../../store';
import { useThreatIntelActions } from '../../hooks/threats/useThreatIntelActions';
import { Button } from '../ui/button';
import { ErrorLogger } from '../../services/errorLogger';
import { InspectorLayout } from '../ui/InspectorLayout';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';

// Generic schema for user submission (simplified version of Threat)
const submissionSchema = z.object({
    title: z.string().min(5, 'Le titre est trop court'),
    type: z.enum(['Ransomware', 'Phishing', 'Vulnerability', 'DDoS', 'Malware', 'Espionnage', 'Autre']),
    severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
    description: z.string().min(20, 'Veuillez décrire la menace plus en détail'),
    country: z.string().min(2, 'Pays requis'),
    iocs: z.string().optional() // Indicators of Compromise (domains, hashes, etc.)
});

type SubmissionFormData = z.infer<typeof submissionSchema>;

interface SubmitThreatDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const SubmitThreatDrawer: React.FC<SubmitThreatDrawerProps> = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useStore();
    const { addCommunityThreat } = useThreatIntelActions();
    const { control, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<SubmissionFormData>({
        resolver: zodResolver(submissionSchema),
        defaultValues: {
            type: 'Autre',
            severity: 'Medium',
            country: 'Unknown',
            title: '',
            description: '',
            iocs: ''
        }
    });

    const onSubmit = async (data: SubmissionFormData) => {
        if (!user) return;
        try {
            await addCommunityThreat({
                ...data,
                author: user.displayName || 'Community User',
                authorId: user.uid,
                date: 'Just now', // Relative time logic handles this usually, keeping simple for seeding
                votes: 0,
                comments: 0,
                active: true,
                timestamp: new Date().getTime(),
                organizationId: user.organizationId, // Optional, depending on if its private or public
                verified: false,
                source: 'Community Submission'
            });
            reset();
            onSuccess();
            onClose();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'SubmitThreatDrawer.onSubmit', 'CREATE_FAILED');
        }
    };

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title="Signaler une Menace"
            subtitle="Partagez une observation avec la communauté."
            width="max-w-4xl"
            icon={AlertTriangle}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    <Controller
                        name="title"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput
                                label="Titre de l'alerte"
                                {...field}
                                error={errors.title?.message}
                                icon={AlertTriangle}
                            />
                        )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Type de menace"
                                    options={[
                                        { value: "Ransomware", label: "Ransomware" },
                                        { value: "Phishing", label: "Phishing" },
                                        { value: "Vulnerability", label: "Vulnérabilité" },
                                        { value: "DDoS", label: "DDoS" },
                                        { value: "Malware", label: "Malware" },
                                        { value: "Espionnage", label: "Espionnage" },
                                        { value: "Autre", label: "Autre" }
                                    ]}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.type?.message}
                                />
                            )}
                        />
                        <Controller
                            name="severity"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Sévérité"
                                    options={[
                                        { value: "Low", label: "Faible" },
                                        { value: "Medium", label: "Moyenne" },
                                        { value: "High", label: "Élevée" },
                                        { value: "Critical", label: "Critique" }
                                    ]}
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.severity?.message}
                                />
                            )}
                        />
                    </div>

                    <Controller
                        name="country"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput
                                label="Pays/Région ciblé(e)"
                                {...field}
                                error={errors.country?.message}
                                icon={Globe}
                            />
                        )}
                    />

                    <Controller
                        name="description"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput
                                label="Description détaillée"
                                {...field}
                                error={errors.description?.message}
                                textarea
                                className="min-h-[120px]"
                            />
                        )}
                    />

                    <Controller
                        name="iocs"
                        control={control}
                        render={({ field }) => (
                            <FloatingLabelInput
                                label="Indicateurs de Compromission (IOCs)"
                                {...field}
                                textarea
                                className="min-h-[80px] font-mono text-sm"
                                placeholder="IPs, Domaines, Hashs..."
                                icon={Network}
                            />
                        )}
                    />
                </div>

                <div className="px-6 py-4 border-t border-border/40 dark:border-border/40 shrink-0 flex justify-end gap-3 bg-white dark:bg-slate-900 z-10">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                        Annuler
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20 gap-2"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Publier
                    </Button>
                </div>
            </form>
        </InspectorLayout>
    );
};
