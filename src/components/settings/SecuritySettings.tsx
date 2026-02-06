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
 addToast(t('settings.passwordChangedDetailed', { defaultValue: 'Mot de passe modifié avec succès. Votre nouveau mot de passe est actif immédiatement.' }), "success");
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
 addToast(t('settings.mfaEnabledDetailed', { defaultValue: 'Authentification à deux facteurs activée. Votre compte est désormais protégé par une double vérification.' }), "success");
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
 <h2 className="text-2xl font-bold text-foreground mb-6 col-span-1 md:col-span-2">{t('settings.security')}</h2>

 <div className="glass-premium rounded-3xl border border-border/40 shadow-sm overflow-hidden flex flex-col h-full relative">
 <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none" />
 <div className="relative z-decorator p-6 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md">
  <div className="flex items-center gap-3">
  <div className="p-2.5 bg-primary/10 rounded-3xl text-primary">
  <Key className="w-5 h-5" />
  </div>
  <h3 className="text-lg font-bold text-foreground">{t('settings.changePassword')}</h3>
  </div>
 </div>
 <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="relative z-decorator p-6 space-y-6 flex-1 flex flex-col justify-between">
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
 <div className="glass-premium rounded-3xl border border-border/40 shadow-sm overflow-hidden flex flex-col h-full relative">
 <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none" />
 <div className="relative z-decorator p-6 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md">
  <div className="flex items-center gap-3">
  <div className="p-2.5 bg-success/10 rounded-3xl text-success">
  <ShieldAlert className="w-5 h-5" />
  </div>
  <h3 className="text-lg font-bold text-foreground">{t('settings.mfa.title', { defaultValue: 'Authentification à deux facteurs' })}</h3>
  </div>
 </div>
 <div className="relative z-decorator p-6 flex-1 flex flex-col justify-between space-y-6">
  <p className="text-sm text-muted-foreground">
  {t('settings.mfa.description', { defaultValue: 'Sécurisez votre compte en ajoutant une seconde étape de validation.' })}
  </p>

  {!isEnrollingMFA && !qrCodeUrl ? (
  <div className="space-y-4">
  <Button
  onClick={handleEnrollMFA}
  className="w-full bg-success-600 hover:bg-success-700 text-white shadow-lg shadow-success-500/20 border-none"
  >
  {t('settings.mfa.enable', { defaultValue: 'Activer MFA' })}
  </Button>
  <button
  onClick={() => setShowDisableMFAConfirm(true)}
  className="w-full text-xs text-red-500 hover:text-red-600 font-bold hover:underline"
  >
  {t('settings.mfa.disable', { defaultValue: 'Désactiver MFA' })}
  </button>
  </div>
  ) : (
  <div className="space-y-6 animate-fade-in">
  {qrCodeUrl && (
  <div className="flex flex-col items-center p-6 bg-white rounded-3xl border border-border/40 shadow-inner">
   <p className="text-xs font-bold text-muted-foreground mb-4 text-center uppercase tracking-wider">Scannez ce QR Code</p>
   <div className="bg-white p-2 rounded-3xl border border-border/40 shadow-lg">
   <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32 sm:w-40 sm:h-40 mix-blend-multiply" />
   </div>
   <p className="text-[11px] text-muted-foreground mt-4 text-center max-w-[200px]">Utilisez Google Authenticator ou Authy</p>
  </div>
  )}

  <div>
  <FloatingLabelInput
   label={t('settings.mfa.verificationCode', { defaultValue: 'Code de vérification (6 chiffres)' })}
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
   {t('common.cancel', { defaultValue: 'Annuler' })}
  </Button>
  <Button
   onClick={handleVerifyMFA}
   disabled={verifyingMFA || mfaCode.length < 6}
   isLoading={verifyingMFA}
   className="flex-1 bg-success-600 hover:bg-success-700 text-white shadow-lg shadow-success-500/20 border-none"
  >
   {t('common.verify', { defaultValue: 'Vérifier' })}
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
 title={t('settings.mfa.disableTitle', { defaultValue: "Désactiver l'authentification à deux facteurs" })}
 message={t('settings.mfa.disableMessage', { defaultValue: "Êtes-vous sûr de vouloir désactiver l'authentification à deux facteurs ? Votre compte sera moins sécurisé." })}
 type="danger"
 confirmText={t('settings.mfa.disableConfirm', { defaultValue: "Désactiver" })}
 cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
 loading={disablingMFA}
 closeOnConfirm={false}
 />
 </div>
 );
};
