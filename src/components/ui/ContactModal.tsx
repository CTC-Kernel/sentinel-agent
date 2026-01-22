import React, { Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Send, Mail, User, MessageSquare } from './Icons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { sendEmail } from '../../services/emailService';
import { getContactMessageTemplate } from '../../services/emailTemplates';
import { Button } from './button';
import { FormError } from './FormError';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';

const contactSchema = z.object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
    email: z.string().email('Adresse email invalide'),
    subject: z.string().min(3, 'Le sujet doit contenir au moins 3 caractères'),
    message: z.string().min(10, 'Le message doit contenir au moins 10 caractères')
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    subject?: string;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, subject = '' }) => {
    const { user, addToast } = useStore();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<ContactFormData>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: user?.displayName || '',
            email: user?.email || '',
            subject: subject,
            message: ''
        }
    });

    useEffect(() => {
        if (isOpen) {
            reset({
                name: user?.displayName || '',
                email: user?.email || '',
                subject: subject,
                message: ''
            });
        }
    }, [isOpen, user, subject, reset]);

    const onSubmit = async (data: ContactFormData) => {
        try {
            await sendEmail(user, {
                to: 'contact@cyber-threat-consulting.com',
                subject: `[Contact App] ${data.subject}`,
                html: getContactMessageTemplate(data.name, data.email, data.subject, data.message),
                type: 'GENERIC',
                metadata: {
                    source: 'contact_form'
                }
            });

            addToast('Votre message a été envoyé avec succès.', 'success');
            onClose();
            reset();
        } catch (error) {
            ErrorLogger.error(error, 'ContactModal.handleSubmit');
            addToast("Erreur lors de l'envoi du message.", 'error');
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-modal" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
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
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl glass-panel p-8 text-left align-middle transition-all">
                                <div className="flex justify-between items-center mb-6">
                                    <Dialog.Title as="h3" className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        Nous contacter
                                    </Dialog.Title>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600"
                                        aria-label="Fermer"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                    <div>
                                        <label htmlFor="contact-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Nom complet
                                        </label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                id="contact-name"
                                                {...register('name')}
                                                type="text"
                                                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white text-sm ${errors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                                placeholder="Votre nom"
                                            />
                                        </div>
                                        <FormError message={errors.name?.message} />
                                    </div>

                                    <div>
                                        <label htmlFor="contact-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Email
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                id="contact-email"
                                                {...register('email')}
                                                type="email"
                                                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white text-sm ${errors.email ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                                placeholder="votre@email.com"
                                            />
                                        </div>
                                        <FormError message={errors.email?.message} />
                                    </div>

                                    <div>
                                        <label htmlFor="contact-subject" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Sujet
                                        </label>
                                        <div className="relative">
                                            <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                id="contact-subject"
                                                {...register('subject')}
                                                type="text"
                                                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white text-sm ${errors.subject ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                                placeholder="Sujet de votre message"
                                            />
                                        </div>
                                        <FormError message={errors.subject?.message} />
                                    </div>

                                    <div>
                                        <label htmlFor="contact-message" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Message
                                        </label>
                                        <textarea
                                            id="contact-message"
                                            {...register('message')}
                                            rows={4}
                                            className={`w-full p-4 bg-slate-50 dark:bg-slate-800 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 dark:text-white text-sm resize-none ${errors.message ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'}`}
                                            placeholder="Comment pouvons-nous vous aider ?"
                                        />
                                        <FormError message={errors.message?.message} />
                                    </div>

                                    <div className="pt-2">
                                        <Button
                                            type="submit"
                                            isLoading={isSubmitting}
                                            className="w-full"
                                            aria-label="Envoyer le message"
                                        >
                                            <Send className="w-4 h-4 mr-2" />
                                            Envoyer le message
                                        </Button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
