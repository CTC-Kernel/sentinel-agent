import React, { useState } from 'react';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { Key, ShieldAlert } from '../ui/Icons';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema, PasswordFormData } from '../../schemas/settingsSchema';
import { Button } from '../ui/button';
import { updatePassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import QRCode from 'qrcode';

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
            <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-border/60 shadow-sm flex flex-col h-full">
                <div className="p-6 border-b border-border/60 bg-background/50">
                    <h3 className="text-lg font-bold text-foreground flex items-center"><Key className="h-5 w-5 mr-3 text-indigo-500" />{t('settings.security')}</h3>
                </div>
                <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                        <div>
                            <input
                                id="settings-newPassword"
                                type="password"
                                autoComplete="new-password"
                                className="w-full px-4 py-3 bg-background/60 border border-border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm text-foreground"
                                placeholder={t('settings.newPassword')}
                                {...passwordForm.register('newPassword')}
                            />
                            {passwordForm.formState.errors.newPassword && (
                                <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.newPassword.message}</p>
                            )}
                        </div>
                        <div>
                            <input
                                id="settings-confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm dark:text-white"
                                placeholder={t('settings.confirmPassword')}
                                {...passwordForm.register('confirmPassword')}
                            />
                            {passwordForm.formState.errors.confirmPassword && (
                                <p className="text-red-500 text-xs mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>
                            )}
                        </div>
                    </div>
                    <Button
                        type="submit"
                        isLoading={changingPassword}
                        className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-900/10 dark:shadow-white/10 mt-4"
                    >
                        {t('settings.changePassword')}
                    </Button>
                </form>
            </div>

            {/* MFA Settings */}
            <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-full">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center"><ShieldAlert className="h-5 w-5 mr-3 text-emerald-500" />Authentification à deux facteurs (MFA)</h3>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Sécurisez votre compte en ajoutant une seconde étape de validation.
                    </p>

                    {!isEnrollingMFA && !qrCodeUrl ? (
                        <button
                            onClick={handleEnrollMFA}
                            className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-900/10 dark:shadow-white/10 flex items-center justify-center"
                        >
                            Activer MFA
                        </button>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            {qrCodeUrl && (
                                <div className="flex flex-col items-center p-4 bg-white rounded-xl border border-slate-200">
                                    <p className="text-xs text-slate-600 mb-2 text-center">Scannez ce code avec votre application d'authentification (Google Authenticator, Authy...)</p>
                                    <div className="bg-slate-100 p-2 rounded">
                                        <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32" />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">Code de vérification</label>
                                <input
                                    type="text"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-center tracking-widest text-lg dark:text-white"
                                    placeholder="000 000"
                                    maxLength={6}
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setIsEnrollingMFA(false); setQrCodeUrl(null); }}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleVerifyMFA}
                                    disabled={verifyingMFA || mfaCode.length < 6}
                                    className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                >
                                    {verifyingMFA ? '...' : 'Vérifier'}
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleDisableMFA}
                        className="text-xs text-red-500 hover:text-red-600 font-bold mt-2"
                    >
                        Désactiver MFA
                    </button>
                </div>
            </div>
        </div>
    );
};
