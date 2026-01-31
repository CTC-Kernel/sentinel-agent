import React, { useState } from 'react';
import { useStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { Key, ShieldAlert } from '../ui/Icons';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema, PasswordFormData } from '../../schemas/settingsSchema';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { ConfirmModal } from '../ui/ConfirmModal';
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
    const [showDisableMFAConfirm, setShowDisableMFAConfirm] = useState(false);
    const [disablingMFA, setDisablingMFA] = useState(false);

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
                addToast(t('settings.securityPage.mfaConfigIncomplete') || "La configuration MFA semble incomplète. Vérifiez que TOTP est activé dans la console Firebase.", "error");
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
            addToast(t('settings.mfaEnabled') || "MFA activé avec succès", "success");
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
        setDisablingMFA(true);
        try {
            await unenrollMFA();
            addToast(t('settings.mfaDisabled') || "MFA désactivé", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'SecuritySettings.handleDisableMFA', 'UNKNOWN_ERROR');
        } finally {
            setDisablingMFA(false);
            setShowDisableMFAConfirm(false);
        }
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 col-span-1 md:col-span-2">{t('settings.security')}</h2>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-border/40 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-border/40 bg-slate-50/50 dark:bg-white/5 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-50 dark:bg-brand-900/40 rounded-2xl text-brand-600 dark:text-brand-400 border border-brand-100/50 dark:border-brand-500/20 shadow-inner">
                            <Key className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.changePassword')}</h3>
                    </div>
                </div>
                <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="p-6 space-y-6 flex-1 flex flex-col justify-between">
                    <div className="space-y-6">
                        <div>
                            <FloatingLabelInput
                                label={t('settings.newPassword')}
                                type="password"
                                {...passwordForm.register('newPassword')}
                                error={passwordForm.formState.errors.newPassword?.message}
                                autoComplete="new-password"
                            />
                            {passwordForm.formState.errors.newPassword?.message && (
                                <p className="text-destructive text-xs mt-1">{passwordForm.formState.errors.newPassword.message}</p>
                            )}
                        </div>
                        <div>
                            <FloatingLabelInput
                                label={t('settings.confirmPassword')}
                                type="password"
                                {...passwordForm.register('confirmPassword')}
                                error={passwordForm.formState.errors.confirmPassword?.message}
                                autoComplete="new-password"
                            />
                            {passwordForm.formState.errors.confirmPassword?.message && (
                                <p className="text-destructive text-xs mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>
                            )}
                        </div>
                    </div>
                    <Button
                        type="submit"
                        isLoading={changingPassword}
                        className="w-full mt-4"
                    >
                        {t('settings.changePassword')}
                    </Button>
                </form>
            </div>

            {/* MFA Settings */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-border/40 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-border/40 bg-slate-50/50 dark:bg-white/5 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-success-50 dark:bg-success-900/30 rounded-2xl text-success-600 dark:text-success-400 border border-success-100/50 dark:border-success-500/10 shadow-inner">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Authentification à deux facteurs</h3>
                    </div>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                    <p className="text-sm text-slate-600 dark:text-muted-foreground">
                        Sécurisez votre compte en ajoutant une seconde étape de validation.
                    </p>

                    {!isEnrollingMFA && !qrCodeUrl ? (
                        <div className="space-y-4">
                            <Button
                                onClick={handleEnrollMFA}
                                className="w-full bg-success-600 hover:bg-success-700 text-white shadow-lg shadow-success-500/20 border-none"
                            >
                                Activer MFA
                            </Button>
                            <button
                                onClick={() => setShowDisableMFAConfirm(true)}
                                className="w-full text-xs text-red-500 hover:text-red-600 font-bold hover:underline"
                            >
                                {t('settings.disableMFA') || 'Désactiver MFA'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-fade-in">
                            {qrCodeUrl && (
                                <div className="flex flex-col items-center p-6 bg-white rounded-3xl border border-border/40 shadow-inner">
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-300 mb-4 text-center uppercase tracking-wider">Scannez ce QR Code</p>
                                    <div className="bg-white p-2 rounded-3xl border border-border/40 shadow-lg">
                                        <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40 mix-blend-multiply" />
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-4 text-center max-w-[200px]">Utilisez Google Authenticator ou Authy</p>
                                </div>
                            )}

                            <div>
                                <FloatingLabelInput
                                    label="Code de vérification (6 chiffres)"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value)}
                                    className="text-center tracking-[0.5em] font-mono text-lg"
                                    maxLength={6}
                                />
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => { setIsEnrollingMFA(false); setQrCodeUrl(null); }}
                                    className="flex-1"
                                >
                                    Annuler
                                </Button>
                                <Button
                                    onClick={handleVerifyMFA}
                                    disabled={verifyingMFA || mfaCode.length < 6}
                                    isLoading={verifyingMFA}
                                    className="flex-1 bg-success-600 hover:bg-success-700 text-white shadow-lg shadow-success-500/20 border-none"
                                >
                                    Vérifier
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={showDisableMFAConfirm}
                onClose={() => setShowDisableMFAConfirm(false)}
                onConfirm={handleDisableMFA}
                title={t('settings.disableMFATitle') || "Désactiver l'authentification à deux facteurs"}
                message={t('settings.disableMFAMessage') || "Êtes-vous sûr de vouloir désactiver l'authentification à deux facteurs ? Votre compte sera moins sécurisé."}
                type="danger"
                confirmText={t('settings.disableMFAConfirm') || "Désactiver"}
                cancelText={t('common.cancel') || "Annuler"}
                loading={disablingMFA}
                closeOnConfirm={false}
            />
        </div>
    );
};
