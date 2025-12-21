import React, { useState } from 'react';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { Key, ShieldAlert } from '../ui/Icons';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema, PasswordFormData } from '../../schemas/settingsSchema';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { updatePassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import QRCode from 'qrcode';
import { ActiveSessions } from './ActiveSessions';
import { SSOPlaceholder } from './SSOPlaceholder';

export const SecuritySettings: React.FC = () => {
    const { addToast, t } = useStore();
    const { enrollMFA, verifyMFA, unenrollMFA } = useAuth();

    // Password State
    const [changingPassword, setChangingPassword] = useState(false);
    const passwordForm = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { newPassword: '', confirmPassword: '' }
    });

    // MFA State
    const [isEnrollingMFA, setIsEnrollingMFA] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [mfaCode, setMfaCode] = useState('');
    const [verifyingMFA, setVerifyingMFA] = useState(false);

    const handleChangePassword: SubmitHandler<PasswordFormData> = async (data) => {
        setChangingPassword(true);
        const currentUser = auth.currentUser;
        if (currentUser) {
            try {
                await updatePassword(currentUser, data.newPassword);
                addToast(t('settings.passwordChanged'), "success");
                passwordForm.reset();
            } catch (error) {
                if ((error as { code?: string }).code === 'auth/requires-recent-login') {
                    addToast(t('settings.reloginRequired'), "error");
                } else {
                    ErrorLogger.handleErrorWithToast(error, 'SecuritySettings.handleChangePassword', 'UPDATE_FAILED');
                }
            }
        }
        setChangingPassword(false);
    };

    const handleEnrollMFA = async () => {
        try {
            setIsEnrollingMFA(true);
            const uri = await enrollMFA();
            const dataUrl = await QRCode.toDataURL(uri);
            setQrCodeUrl(dataUrl);
        } catch (error) {
            setIsEnrollingMFA(false);
            ErrorLogger.error(error as Error, "SecuritySettings.handleEnrollMFA.enrollmentErrors");

            const firebaseError = error as { code?: string; message?: string };

            if (firebaseError.code === 'auth/requires-recent-login') {
                addToast(t('settings.reloginRequired'), "error");
            } else if (firebaseError.code === 'auth/operation-not-allowed' || firebaseError.message?.includes('400')) {
                addToast("La configuration MFA semble incomplète. Vérifiez que TOTP est activé dans la console Firebase.", "error");
                ErrorLogger.warn("Possible MFA Configuration Issue (TOTP disabled?)", 'SecuritySettings.handleEnrollMFA', { metadata: { error } });
            } else {
                ErrorLogger.handleErrorWithToast(error, 'SecuritySettings.handleEnrollMFA', 'UNKNOWN_ERROR');
            }
        }
    };

    const handleVerifyMFA = async () => {
        setVerifyingMFA(true);
        try {
            await verifyMFA('Sentinel Authenticator', mfaCode);
            addToast("MFA activé avec succès", "success");
            setIsEnrollingMFA(false);
            setQrCodeUrl(null);
            setMfaCode('');
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'SecuritySettings.handleVerifyMFA', 'UNKNOWN_ERROR');
        } finally {
            setVerifyingMFA(false);
        }
    };

    const handleDisableMFA = async () => {
        if (!confirm("Êtes-vous sûr de vouloir désactiver l'authentification à deux facteurs ?")) return;
        try {
            await unenrollMFA();
            addToast("MFA désactivé", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'SecuritySettings.handleDisableMFA', 'UNKNOWN_ERROR');
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 col-span-1 md:col-span-2">{t('settings.security')}</h2>

            {/* Change Password */}
            <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden flex flex-col h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 backdrop-blur-md">
                            <Key className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.changePassword')}</h3>
                    </div>
                </div>
                <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="relative z-10 p-6 space-y-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-6">
                        <FloatingLabelInput
                            label={t('settings.newPassword')}
                            type="password"
                            {...passwordForm.register('newPassword')}
                            error={passwordForm.formState.errors.newPassword?.message}
                            autoComplete="new-password"
                        />
                        <FloatingLabelInput
                            label={t('settings.confirmPassword')}
                            type="password"
                            {...passwordForm.register('confirmPassword')}
                            error={passwordForm.formState.errors.confirmPassword?.message}
                            autoComplete="new-password"
                        />
                    </div>
                    <Button
                        type="submit"
                        isLoading={changingPassword}
                        className="w-full mt-4 h-11 text-base shadow-lg shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 text-white border-none"
                    >
                        {t('settings.changePassword')}
                    </Button>
                </form>
            </div>

            {/* MFA Settings */}
            <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden flex flex-col h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 backdrop-blur-md">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Authentification à deux facteurs</h3>
                    </div>
                </div>
                <div className="relative z-10 p-6 flex-1 flex flex-col justify-between space-y-6">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        Sécurisez votre compte en ajoutant une seconde étape de validation.
                    </p>

                    {!isEnrollingMFA && !qrCodeUrl ? (
                        <div className="space-y-4">
                            <Button
                                onClick={handleEnrollMFA}
                                className="w-full h-11 text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 border-none"
                            >
                                Activer MFA
                            </Button>
                            <button
                                onClick={handleDisableMFA}
                                className="w-full text-xs text-rose-500 hover:text-rose-600 font-bold hover:underline py-2"
                            >
                                Désactiver MFA
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-fade-in">
                            {qrCodeUrl && (
                                <div className="flex flex-col items-center p-6 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/60 dark:border-white/10 shadow-inner backdrop-blur-sm">
                                    <p className="text-xs font-bold text-slate-500 mb-4 text-center uppercase tracking-wider">Scannez ce QR Code</p>
                                    <div className="bg-white p-2 rounded-xl shadow-lg">
                                        <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40 mix-blend-multiply" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-4 text-center max-w-[200px]">Utilisez Google Authenticator ou Authy</p>
                                </div>
                            )}

                            <div>
                                <FloatingLabelInput
                                    label="Code de vérification (6 chiffres)"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
                                    className="text-center tracking-[0.5em] font-mono text-lg bg-white/50 dark:bg-black/20 backdrop-blur-sm border-white/20"
                                    maxLength={6}
                                />
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => { setIsEnrollingMFA(false); setQrCodeUrl(null); }}
                                    className="flex-1 border-slate-200 dark:border-slate-700"
                                >
                                    Annuler
                                </Button>
                                <Button
                                    onClick={handleVerifyMFA}
                                    disabled={verifyingMFA || mfaCode.length < 6}
                                    isLoading={verifyingMFA}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 border-none"
                                >
                                    Vérifier
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Active Sessions */}
            <ActiveSessions />

            {/* SSO Placeholder */}
            <SSOPlaceholder />
        </div>
    );
};
