import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Globe, Loader2, Save, X } from 'lucide-react';
import { useStore } from '../../store';
import { db } from '../../firebase';
import { addDoc, collection } from 'firebase/firestore';
import { Button } from '../ui/button';
import { ErrorLogger } from '../../services/errorLogger';
import { Dialog, Transition } from '@headlessui/react';

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

interface SubmitThreatModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const SubmitThreatModal: React.FC<SubmitThreatModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useStore();
    const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<SubmissionFormData>({
        resolver: zodResolver(submissionSchema),
        defaultValues: {
            type: 'Autre',
            severity: 'Medium',
            country: 'Unknown'
        }
    });

    const onSubmit = async (data: SubmissionFormData) => {
        if (!user) return;
        try {
            await addDoc(collection(db, 'threats'), {
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
            ErrorLogger.handleErrorWithToast(error, 'SubmitThreatModal.onSubmit', 'CREATE_FAILED');
        }
    };

    return (
        <Transition.Root show={isOpen} as={React.Fragment}>
            <Dialog as="div" className="relative z-modal" onClose={onClose}>
                <Transition.Child
                    as={React.Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={React.Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-white/20 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                    <div>
                                        <Dialog.Title as="h2" className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-brand-500" />
                                            Signaler une Menace
                                        </Dialog.Title>
                                        <p className="text-sm text-slate-500">Partagez une observation avec la communauté.</p>
                                    </div>
                                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500">
                                        <X className="h-5 w-5 text-slate-400" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Titre de l'alerte</label>
                                        <input
                                            {...register('title')}
                                            className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-brand-500 focus:border-brand-500 px-4 py-2.5 transition-all outline-none border focus:ring-2"
                                            placeholder="Ex: Campagne de phishing liée aux JO 2024"
                                        />
                                        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                                            <select
                                                {...register('type')}
                                                className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-2.5 outline-none border focus:ring-2 focus:ring-brand-500"
                                            >
                                                <option value="Ransomware">Ransomware</option>
                                                <option value="Phishing">Phishing</option>
                                                <option value="Vulnerability">Vulnérabilité</option>
                                                <option value="DDoS">DDoS</option>
                                                <option value="Malware">Malware</option>
                                                <option value="Espionnage">Espionnage</option>
                                                <option value="Autre">Autre</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sévérité</label>
                                            <select
                                                {...register('severity')}
                                                className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-2.5 outline-none border focus:ring-2 focus:ring-brand-500"
                                            >
                                                <option value="Low">Faible</option>
                                                <option value="Medium">Moyenne</option>
                                                <option value="High">Élevée</option>
                                                <option value="Critical">Critique</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pays/Région ciblé(e)</label>
                                        <div className="relative">
                                            <Globe className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                            <input
                                                {...register('country')}
                                                className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white pl-10 pr-4 py-2.5 outline-none border focus:ring-2 focus:ring-brand-500"
                                                placeholder="Ex: France"
                                            />
                                        </div>
                                        {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country.message}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                                        <textarea
                                            {...register('description')}
                                            rows={3}
                                            className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-2.5 outline-none border focus:ring-2 focus:ring-brand-500 resize-none"
                                            placeholder="Détails techniques, vecteurs d'attaque..."
                                        />
                                        {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Indicateurs de Compromission (IOCs) <span className="text-slate-400 font-normal">(Optionnel)</span>
                                        </label>
                                        <textarea
                                            {...register('iocs')}
                                            rows={2}
                                            className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-2.5 outline-none border focus:ring-2 focus:ring-brand-500 font-mono text-sm"
                                            placeholder="IPs, Domaines, Hashs..."
                                        />
                                    </div>

                                    <div className="pt-4 flex justify-end gap-3">
                                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                                            Annuler
                                        </Button>
                                        <Button type="submit" className="bg-brand-600 hover:bg-brand-500 text-white min-w-[120px]" disabled={isSubmitting}>
                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                            Publier
                                        </Button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
