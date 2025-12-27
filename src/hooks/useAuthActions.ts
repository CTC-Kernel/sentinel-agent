import { useState, useEffect } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithRedirect,
    signInWithPopup,
    signInWithCredential,
    getRedirectResult,
    GoogleAuthProvider,
    OAuthProvider,
    getMultiFactorResolver,
    TotpMultiFactorGenerator,
    MultiFactorResolver,
    MultiFactorError,
    // signOut removed
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { LoginFormData, RegisterFormData, ResetPasswordFormData } from '../schemas/authSchema';
import { logAuthAuditEvent } from '../services/logger';

const safeLogAuthEvent = (payload: Parameters<typeof logAuthAuditEvent>[0]) => {
    logAuthAuditEvent(payload).catch(() => undefined);
};

export const useAuthActions = () => {
    const { addToast, t } = useStore();
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // MFA State
    const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
    const [showMfaModal, setShowMfaModal] = useState(false);
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaError, setMfaError] = useState<string | null>(null);

    const getIsNativePlatform = async (): Promise<boolean> => {
        try {
            const { Capacitor } = await import('@capacitor/core');
            return Capacitor.isNativePlatform();
        } catch {
            return false;
        }
    };

    const isPopupRecoverableError = (error: unknown): boolean => {
        const code = (error as { code?: string })?.code;
        return code === 'auth/popup-blocked' ||
            code === 'auth/popup-closed-by-user' ||
            code === 'auth/cancelled-popup-request';
    };

    // Handle Google Redirect Result on Mount
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const result = await getRedirectResult(auth);
                if (!isMounted) return;

                if (result?.user) {
                    addToast(t('auth.success'), 'success');
                    window.location.hash = '#/';
                }
            } catch (error: unknown) {
                if (!isMounted) return;
                ErrorLogger.error(error as Error, 'Login.getRedirectResult');
                setErrorMsg(t('auth.errors.google'));
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [addToast, t]); // Correctly includes hook dependencies

    const handleEmailAuth = async (data: LoginFormData | RegisterFormData, isLogin: boolean): Promise<boolean> => {
        setLoading(true);
        setErrorMsg(null);
        safeLogAuthEvent({
            provider: 'password',
            status: 'attempt',
            email: data.email,
            metadata: { mode: isLogin ? 'login' : 'register' }
        });
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, data.email, data.password);
                addToast(t('auth.success'), "success");
                safeLogAuthEvent({
                    provider: 'password',
                    status: 'success',
                    email: data.email,
                    metadata: { mode: 'login' }
                });
            } else {
                await createUserWithEmailAndPassword(auth, data.email, data.password);
                addToast(t('auth.created'), "success");
                safeLogAuthEvent({
                    provider: 'password',
                    status: 'success',
                    email: data.email,
                    metadata: { mode: 'register' }
                });
            }
            return true;
        } catch (error: unknown) {
            console.error('Auth Error Details:', error);
            const err = error as { code?: string; message?: string };
            if (err.code === 'auth/multi-factor-auth-required') {
                const resolver = getMultiFactorResolver(auth, error as MultiFactorError);
                setMfaResolver(resolver);
                setShowMfaModal(true);
                return false;
            }

            let msg = t('auth.errors.auth');
            const code = (error as { code?: string })?.code;
            if (code === 'auth/invalid-credential') msg = t('auth.errors.invalid');
            if (code === 'auth/email-already-in-use') msg = t('auth.errors.emailInUse');
            if (code === 'auth/weak-password') msg = t('auth.errors.weak');
            setErrorMsg(msg);
            safeLogAuthEvent({
                provider: 'password',
                status: 'failure',
                email: data.email,
                errorCode: code,
                metadata: { mode: isLogin ? 'login' : 'register' }
            });
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const isNative = await getIsNativePlatform();
            safeLogAuthEvent({
                provider: 'google',
                status: 'attempt',
                metadata: { platform: isNative ? 'native' : 'web' }
            });

            if (isNative) {
                const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
                const result = await FirebaseAuthentication.signInWithGoogle();

                if (result.credential?.idToken) {
                    const credential = GoogleAuthProvider.credential(
                        result.credential.idToken,
                        result.credential.accessToken
                    );

                    await signInWithCredential(auth, credential);
                    addToast(t('auth.success'), "success");
                    safeLogAuthEvent({
                        provider: 'google',
                        status: 'success',
                        email: result.user?.email,
                        metadata: { platform: 'native' }
                    });
                    window.location.hash = '#/';
                } else {
                    throw new Error("No ID Token from Google");
                }
            } else {
                const provider = new GoogleAuthProvider();
                try {
                    await signInWithPopup(auth, provider);
                    addToast(t('auth.success'), "success");
                    safeLogAuthEvent({
                        provider: 'google',
                        status: 'success',
                        email: auth.currentUser?.email || undefined,
                        metadata: { platform: 'web', method: 'popup' }
                    });
                    window.location.hash = '#/';
                } catch (popupError) {
                    if (isPopupRecoverableError(popupError)) {
                        addToast(t('auth.redirectingGoogle'), 'info');
                        safeLogAuthEvent({
                            provider: 'google',
                            status: 'attempt',
                            metadata: { platform: 'web', method: 'redirect-fallback' }
                        });
                        await signInWithRedirect(auth, provider);
                    } else {
                        throw popupError;
                    }
                }
            }
        } catch (error: unknown) {
            ErrorLogger.error(error as Error, 'Login.handleGoogleLogin');
            setErrorMsg(t('auth.errors.generic'));
            const code = (error as { code?: string })?.code;
            safeLogAuthEvent({
                provider: 'google',
                status: 'failure',
                email: auth.currentUser?.email || undefined,
                errorCode: code,
                metadata: { context: 'handleGoogleLogin' }
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAppleLogin = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const isNative = await getIsNativePlatform();
            safeLogAuthEvent({
                provider: 'apple',
                status: 'attempt',
                metadata: { platform: isNative ? 'native' : 'web' }
            });

            if (isNative) {
                const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
                const result = await FirebaseAuthentication.signInWithApple();

                if (result.credential?.idToken) {
                    const provider = new OAuthProvider('apple.com');
                    const credential = provider.credential({
                        idToken: result.credential.idToken
                    });

                    await signInWithCredential(auth, credential);
                    addToast(t('auth.success'), 'success');
                    safeLogAuthEvent({
                        provider: 'apple',
                        status: 'success',
                        email: result.user?.email,
                        metadata: { platform: 'native' }
                    });
                    window.location.hash = '#/';
                } else {
                    throw new Error('No ID Token from Apple');
                }
            } else {
                const provider = new OAuthProvider('apple.com');
                provider.addScope('email');
                provider.addScope('name');
                try {
                    await signInWithPopup(auth, provider);
                    addToast(t('auth.success'), 'success');
                    safeLogAuthEvent({
                        provider: 'apple',
                        status: 'success',
                        email: auth.currentUser?.email || undefined,
                        metadata: { platform: 'web', method: 'popup' }
                    });
                    window.location.hash = '#/';
                } catch (popupError) {
                    if (isPopupRecoverableError(popupError)) {
                        addToast(t('auth.redirectingApple') ?? t('auth.redirectingGoogle'), 'info');
                        safeLogAuthEvent({
                            provider: 'apple',
                            status: 'attempt',
                            metadata: { platform: 'web', method: 'redirect-fallback' }
                        });
                        await signInWithRedirect(auth, provider);
                    } else {
                        throw popupError;
                    }
                }
            }
        } catch (error: unknown) {
            ErrorLogger.error(error as Error, 'Login.handleAppleLogin');
            setErrorMsg(t('auth.errors.generic'));
            const code = (error as { code?: string })?.code;
            safeLogAuthEvent({
                provider: 'apple',
                status: 'failure',
                email: auth.currentUser?.email || undefined,
                errorCode: code,
                metadata: { context: 'handleAppleLogin' }
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async (data: ResetPasswordFormData): Promise<boolean> => {
        setLoading(true);
        try {
            const requestResetFn = httpsCallable(functions, 'requestPasswordReset');
            await requestResetFn({ email: data.email });
            addToast(t('auth.resetSent'), "success");
            return true;
        } catch (_error) {
            ErrorLogger.handleErrorWithToast(_error as Error, 'Login.handlePasswordReset');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleMfaVerification = async (mfaCode: string) => {
        if (!mfaResolver || !mfaCode) return;
        setMfaLoading(true);
        setMfaError(null);
        try {
            const hint = mfaResolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
            if (!hint) {
                throw new Error(t('auth.errors.totpNotFound'));
            }
            const multiFactorAssertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, mfaCode);
            await mfaResolver.resolveSignIn(multiFactorAssertion);
            setShowMfaModal(false);
            addToast(t('auth.success'), "success");
        } catch (error) {
            setMfaError(t('auth.mfa.error'));
            ErrorLogger.error(error as Error, 'Login.handleMfaVerification');
        } finally {
            setMfaLoading(false);
        }
    };

    const checkEmailVerification = async (): Promise<boolean> => {
        if (!auth.currentUser) return false;
        try {
            await auth.currentUser.reload();
            return auth.currentUser.emailVerified;
        } catch (error) {
            ErrorLogger.error(error as Error, 'useAuthActions.checkEmailVerification');
            return false;
        }
    };

    const sendVerificationEmail = async () => {
        if (!auth.currentUser) return;
        try {
            await import('firebase/auth').then(({ sendEmailVerification }) => sendEmailVerification(auth.currentUser!));
            addToast(t('auth.verificationSent'), 'success');
        } catch (error) {
            ErrorLogger.error(error as Error, 'useAuthActions.sendVerificationEmail');
            throw error;
        }
    };

    const logout = async () => {
        try {
            await auth.signOut();
            addToast(t('auth.logoutSuccess'), 'success');
            window.location.href = '/login';
        } catch (error) {
            ErrorLogger.error(error as Error, 'useAuthActions.logout');
        }
    };

    return {
        loading,
        errorMsg,
        setErrorMsg,

        handleEmailAuth,
        handleGoogleLogin,
        handleAppleLogin,
        handlePasswordReset,
        handleMfaVerification,
        checkEmailVerification,
        sendVerificationEmail,
        logout,

        showMfaModal,
        setShowMfaModal,
        mfaLoading,
        mfaError
    };
};
