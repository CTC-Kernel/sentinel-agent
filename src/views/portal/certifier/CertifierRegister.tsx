import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ShieldCheck, Mail, Lock, Building2, Ticket } from '../../../components/ui/Icons';
import { toast } from '@/lib/toast';

const registerSchema = z.object({
    orgName: z.string().min(2, "Nom de l'organisation requis"),
    siret: z.string().min(9, 'SIRET invalide').optional(), // Optional for international
    email: z.string().email('Email invalide'),
    password: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
});

type RegisterData = z.infer<typeof registerSchema>;

export const CertifierRegister: React.FC = () => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { register, handleSubmit, formState: { errors } } = useForm<RegisterData>({
        resolver: zodResolver(registerSchema)
    });

    const onSubmit = async (data: RegisterData) => {
        setIsLoading(true);
        try {
            // 1. Create User
            await createUserWithEmailAndPassword(auth, data.email, data.password);

            // 2. Create Organization (via Cloud Function to secure 'CERTIFIER' type)
            const createOrgFn = httpsCallable(functions, 'createCertifierOrganization');
            await createOrgFn({
                name: data.orgName,
                siret: data.siret
            });

            toast.success('Compte créé avec succès !');
            navigate('/portal/dashboard');

        } catch (_error: unknown) {
            const firebaseError = _error as { code?: string };
            if (firebaseError?.code === 'auth/email-already-in-use') {
                toast.error('Cet email est déjà utilisé');
            } else {
                toast.error("Erreur lors de l'inscription");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-200px)] flex-col justify-center py-12 px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center">
                        <ShieldCheck className="w-10 h-10 text-brand-600" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {t('certifier.registerTitle')}
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
                    {t('certifier.registerSubtitle')}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-xl border border-slate-200 dark:border-white/5 sm:rounded-2xl sm:px-10">
                    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                        <div>
                            <label className="block text-sm font-medium text-slate-900 dark:text-white">{t('certifier.orgNameLabel')}</label>
                            <div className="mt-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Building2 className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    {...register('orgName')}
                                    type="text"
                                    className="block w-full pl-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent sm:text-sm"
                                    placeholder="Bureau Veritas..."
                                />
                            </div>
                            {errors.orgName && <p className="mt-1 text-sm text-red-600">{errors.orgName.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-900 dark:text-white">{t('certifier.siretLabel')}</label>
                            <div className="mt-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Ticket className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    {...register('siret')}
                                    type="text"
                                    className="block w-full pl-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent sm:text-sm"
                                    placeholder="Optionnel"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-900 dark:text-white">{t('certifier.emailLabel')}</label>
                            <div className="mt-1 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    {...register('email')}
                                    type="email"
                                    className="block w-full pl-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent sm:text-sm"
                                    placeholder="contact@organisme.com"
                                />
                            </div>
                            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-900 dark:text-white">{t('certifier.passwordLabel')}</label>
                                <div className="mt-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        {...register('password')}
                                        type="password"
                                        className="block w-full pl-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent sm:text-sm"
                                        placeholder="Min 8 car."
                                    />
                                </div>
                                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-900 dark:text-white">{t('certifier.confirmPasswordLabel')}</label>
                                <div className="mt-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        {...register('confirmPassword')}
                                        type="password"
                                        className="block w-full pl-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent sm:text-sm"
                                    />
                                </div>
                                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex w-full justify-center rounded-lg bg-brand-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('certifier.registerButton')}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {t('certifier.alreadyRegistered')}{' '}
                            <Link to="/portal/login" className="font-medium text-brand-600 hover:text-brand-500 hover:underline">
                                {t('certifier.loginLink')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
