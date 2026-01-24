import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ShieldCheck, Mail, Lock } from '../../../components/ui/Icons';
import { toast } from '@/lib/toast';
import { MasterpieceBackground } from '../../../components/ui/MasterpieceBackground';
import { ErrorLogger } from '../../../services/errorLogger';

const loginSchema = z.object({
    email: z.string().email('Email invalide'),
    password: z.string().min(1, 'Mot de passe requis')
});

type LoginData = z.infer<typeof loginSchema>;

export const CertifierLogin: React.FC = () => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { register, handleSubmit, formState: { errors } } = useForm<LoginData>({
        resolver: zodResolver(loginSchema)
    });

    const onSubmit = async (data: LoginData) => {
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, data.email, data.password);
            // Simple redirect after login/register
            toast.success('Connexion réussie', 'Bienvenue sur le portail certificateur');
            navigate('/portal/dashboard');
        } catch (error) {
            ErrorLogger.error(error, 'CertifierLogin.handleLogin');
            toast.error('Erreur', 'Identifiants invalides ou erreur de connexion');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-200px)] flex-col justify-center py-12 px-6 lg:px-8 relative overflow-hidden">
            <MasterpieceBackground className="opacity-50" />
            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center">
                        <ShieldCheck className="w-10 h-10 text-brand-600" />
                    </div>
                </div>
                <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {t('certifier.portalTitle')}
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
                    {t('certifier.portalSubtitle')}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-xl border border-slate-200 dark:border-white/5 sm:rounded-2xl sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                        <div>
                            <label className="block text-sm font-medium text-slate-900 dark:text-white">{t('certifier.emailLabel')}</label>
                            <div className="mt-2 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    {...register('email')}
                                    type="email"
                                    className="block w-full pl-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 py-2.5 text-slate-900 dark:text-white placeholder:text-muted-foreground focus:ring-2 focus-visible:ring-brand-500 focus:border-transparent sm:text-sm"
                                    placeholder="nom@organisme-certif.com"
                                />
                            </div>
                            {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-900 dark:text-white">{t('certifier.passwordLabel')}</label>
                            <div className="mt-2 relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    {...register('password')}
                                    type="password"
                                    className="block w-full pl-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 py-2.5 text-slate-900 dark:text-white placeholder:text-muted-foreground focus:ring-2 focus-visible:ring-brand-500 focus:border-transparent sm:text-sm"
                                    placeholder="••••••••"
                                />
                            </div>
                            {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>}
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex w-full justify-center rounded-lg bg-brand-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('certifier.loginButton')}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="bg-white dark:bg-slate-800 px-2 text-slate-500">{t('certifier.newPartner')}</span>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <Link to="/portal/register" className="font-medium text-brand-600 hover:text-brand-500 hover:underline">
                                {t('certifier.registerLink')}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
