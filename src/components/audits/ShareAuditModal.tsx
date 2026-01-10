import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X, Mail, Link, ShieldCheck, Loader2, Copy } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import { toast } from '@/lib/toast';

interface ShareAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    auditId: string;
    auditName?: string; // Made optional or use it
}

const shareSchema = z.object({
    email: z.string().email('Email invalide'),
    organization: z.string().min(2, 'Nom requis'),
    expiryDays: z.number().min(1).max(90)
});

type ShareFormData = z.infer<typeof shareSchema>;

export const ShareAuditModal: React.FC<ShareAuditModalProps> = ({ isOpen, onClose, auditId }) => { // Removed auditName destructuring if unused
    const [isLoading, setIsLoading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors }, reset } = useForm<ShareFormData>({
        resolver: zodResolver(shareSchema),
        defaultValues: { expiryDays: 30 }
    });

    const onSubmit = async (data: ShareFormData) => {
        setIsLoading(true);
        try {
            const generateLinkFn = httpsCallable(functions, 'generateAuditShareLink');
            const result = await generateLinkFn({
                auditId,
                auditorEmail: data.email,
                expiryDays: data.expiryDays
            });

            const response = result.data as { success: boolean, link: string, token: string };
            if (response.success) {
                // Construct full URL (handled somewhat by backend but we ensure base URL here)
                const baseUrl = window.location.origin + '/#';
                setGeneratedLink(`${baseUrl}${response.link}`);
                toast.success('Lien généré avec succès');
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ShareAuditModal.generate', 'LINK_GEN_FAILED');
        } finally {
            setIsLoading(false);
        }
    };

    const copyLink = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink);
            toast.success('Lien copié !');
        }
    };

    const handleClose = () => {
        setGeneratedLink(null);
        reset();
        onClose();
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[200]" onClose={handleClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-xl transition-all border border-slate-200 dark:border-white/10">
                                <div className="flex justify-between items-start mb-4">
                                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-slate-900 dark:text-white flex items-center gap-2">
                                        <ShieldCheck className="w-5 h-5 text-brand-500" />
                                        Certification & Audit Externe
                                    </Dialog.Title>
                                    <button onClick={handleClose} className="text-slate-400 hover:text-slate-500 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {!generatedLink ? (
                                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Invitez un auditeur externe ou un organisme de certification à accéder à cet audit via un portail sécurisé dédié.
                                        </p>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email de l'auditeur</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input
                                                    {...register('email')}
                                                    type="email"
                                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                                                    placeholder="auditeur@certif-org.com"
                                                />
                                            </div>
                                            {errors.email && <span className="text-xs text-red-500 mt-1">{errors.email.message}</span>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Organisation</label>
                                            <input
                                                {...register('organization')}
                                                type="text"
                                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                                                placeholder="Ex: Bureau Veritas, AFNOR..."
                                            />
                                            {errors.organization && <span className="text-xs text-red-500 mt-1">{errors.organization.message}</span>}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Durée d'accès (jours)</label>
                                            <select
                                                {...register('expiryDays', { valueAsNumber: true })}
                                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                                            >
                                                <option value={7}>7 jours</option>
                                                <option value={15}>15 jours</option>
                                                <option value={30}>30 jours</option>
                                                <option value={60}>60 jours</option>
                                            </select>
                                        </div>

                                        <div className="mt-6 flex justify-end gap-3">
                                            <button
                                                type="button"
                                                onClick={handleClose}
                                                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                            >
                                                Annuler
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-lg shadow-brand-500/20 flex items-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                                                Générer le lien d'accès
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                                            <div className="bg-green-100 dark:bg-green-800 p-1 rounded-full text-green-600 dark:text-green-300">
                                                <ShieldCheck className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-green-800 dark:text-green-300">Accès sécurisé généré</h4>
                                                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                                                    Un lien unique a été créé. Partagez-le avec votre auditeur. Ce lien expirera automatiquement.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <input
                                                readOnly
                                                value={generatedLink}
                                                className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-600 dark:text-slate-400 font-mono"
                                            />
                                            <button
                                                onClick={copyLink}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-brand-500 transition-colors"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <button
                                                onClick={handleClose}
                                                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 rounded-lg transition-colors"
                                            >
                                                Fermer
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};
