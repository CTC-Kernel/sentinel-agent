import { GlassCard } from '../ui/GlassCard';

// ... imports

export const SecuritySettings: React.FC = () => {
    // ... code ...

    {/* Change Password */ }
    <GlassCard className="p-6 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden flex flex-col h-full">
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
    </GlassCard>

    {/* MFA Settings */ }
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
        </GlassCard>

        {/* Active Sessions */}
        <ActiveSessions />

        {/* SSO Configuration */}
        <SSOManager />
    </div >
    );
};
