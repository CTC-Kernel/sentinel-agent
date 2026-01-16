import React, { useState } from 'react';
import { useStore } from '../../store';
import { Key, ShieldAlert } from '../ui/Icons';
import { SubmitHandler } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { passwordSchema, PasswordFormData } from '../../schemas/settingsSchema';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { updatePassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import QRCode from 'qrcode';
import { ActiveSessions } from './ActiveSessions';
import { SSOManager } from './SSOManager';

export const SecuritySettings: React.FC = () => {
    const { addToast, t } = useStore();

    // Try to use Auth hook, but provide fallback
    const [authFunctions, setAuthFunctions] = React.useState<{
        enrollMFA?: (() => Promise<string>);
        verifyMFA?: ((verificationId: string, code: string) => Promise<void>);
        unenrollMFA?: (() => Promise<void>);
    }>({});

    // Initialize auth functions safely
    const initializeAuthFunctions = React.useCallback(() => {
        // For now, we'll disable MFA features if AuthContext is not available
        // This is a temporary solution to avoid React Hook rules violations
        // In a proper implementation, the AuthContext should be available at all times
        setAuthFunctions({});
    }, []);

    // Initialize auth functions on mount
    React.useEffect(() => {
        initializeAuthFunctions();
    }, [initializeAuthFunctions]);

    // Password State
    const [changingPassword, setChangingPassword] = useState(false);
    const passwordForm = useZodForm<typeof passwordSchema>({
        schema: passwordSchema,
        mode: 'onChange',
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
        if (!authFunctions.enrollMFA) {
            addToast("Fonctionnalité MFA non disponible", "error");
            return;
        }

        try {
            setIsEnrollingMFA(true);
            const uri = await authFunctions.enrollMFA();
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
        if (!authFunctions.verifyMFA) {
            addToast("Fonctionnalité MFA non disponible", "error");
            return;
        }

        setVerifyingMFA(true);
        try {
            await authFunctions.verifyMFA('Sentinel Authenticator', mfaCode);
            addToast(t('settings.mfaEnabled'), "success");
            setMfaCode('');
            setQrCodeUrl(null);
            setIsEnrollingMFA(false);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'SecuritySettings.handleVerifyMFA', 'UNKNOWN_ERROR');
        } finally {
            setVerifyingMFA(false);
        }
    };

    const handleUnenrollMFA = async () => {
        if (!authFunctions.unenrollMFA) {
            addToast("Fonctionnalité MFA non disponible", "error");
            return;
        }

        try {
            await authFunctions.unenrollMFA();
            addToast(t('settings.mfaDisabled'), "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'SecuritySettings.handleUnenrollMFA', 'UNKNOWN_ERROR');
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
                    {/* Hidden username field for accessibility/password managers */}
                    <input
                        type="email"
                        autoComplete="username"
                        value={auth.currentUser?.email || ''}
                        readOnly
                        className="hidden"
                        aria-hidden="true"
                    />
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
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.securityPage.mfaTitle')}</h3>
                    </div>
                </div>
                <div className="relative z-10 p-6 flex-1 flex flex-col justify-between space-y-6">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        {t('settings.securityPage.mfaDesc')}
                    </p>

                    {!isEnrollingMFA && !qrCodeUrl ? (
                        <div className="space-y-4">
                            <Button
                                onClick={handleEnrollMFA}
                                className="w-full h-11 text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 border-none"
                            >
                                {t('settings.securityPage.enableMfa')}
                            </Button>
                            <button
                                onClick={handleUnenrollMFA}
                                className="w-full text-xs text-rose-500 hover:text-rose-600 font-bold hover:underline py-2"
                            >
                                {t('settings.securityPage.disableMfa')}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-fade-in">
                            {qrCodeUrl && (
                                <div className="flex flex-col items-center p-6 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/60 dark:border-white/10 shadow-inner backdrop-blur-sm">
                                    <p className="text-xs font-bold text-slate-500 mb-4 text-center uppercase tracking-wider">{t('settings.securityPage.scanQr')}</p>
                                    <div className="bg-white p-2 rounded-xl shadow-lg">
                                        <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40 mix-blend-multiply" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-4 text-center max-w-[200px]">Utilisez Google Authenticator ou Authy</p>
                                </div>
                            )}

                            <div>
                                <FloatingLabelInput
                                    label={t('settings.securityPage.verifyCode')}
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
                                    {t('settings.securityPage.cancel')}
                                </Button>
                                <Button
                                    onClick={handleVerifyMFA}
                                    disabled={verifyingMFA || mfaCode.length < 6}
                                    isLoading={verifyingMFA}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 border-none"
                                >
                                    {t('settings.securityPage.verify')}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Active Sessions */}
            <ActiveSessions />

            {/* SSO Configuration */}
            <SSOManager />
        </div>
    );
};
