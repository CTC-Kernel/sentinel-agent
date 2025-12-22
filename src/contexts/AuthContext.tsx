import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    User,
    onIdTokenChanged,
    signOut as firebaseSignOut,
    signInWithPopup,
    OAuthProvider,
    TotpSecret
} from 'firebase/auth';
import {
    doc,
    onSnapshot,
    setDoc,
    serverTimestamp,
    enableNetwork,
    disableNetwork,
    updateDoc
} from 'firebase/firestore';
import { auth, db, isAppCheckFailed } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { UserProfile, Organization } from '../types';
import { httpsCallable, getFunctions } from 'firebase/functions';


import { AuthContext } from './AuthContextDefinition';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [profileError, setProfileError] = useState<Error | null>(null);
    const setUser = useStore(s => s.setUser);
    const setOrganization = useStore(s => s.setOrganization);
    const setTheme = useStore(s => s.setTheme);

    const [isBlocked, setIsBlocked] = useState(isAppCheckFailed);

    const loadingRef = useRef(loading);
    const firebaseUserUidRef = useRef<string | undefined>(firebaseUser?.uid);

    useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);



    // Fonction pour rafraîchir le token et les claims
    const refreshSession = useCallback(async () => {
        if (!auth.currentUser) return;
        try {
            // Force le rafraîchissement du token
            await auth.currentUser.getIdToken(true);
            const tokenResult = await auth.currentUser.getIdTokenResult();

            // Si l'organisationId manque dans les claims mais existe dans le profil, on tente de réparer
            if (!tokenResult.claims.organizationId) {
                const functions = getFunctions();
                const refreshUserTokenFn = httpsCallable(functions, 'refreshUserToken');
                try {
                    await refreshUserTokenFn();
                    // Re-rafraîchir après l'appel de la fonction
                    await auth.currentUser.getIdToken(true);
                } catch (e) {
                    ErrorLogger.warn('Failed to refresh custom claims via Cloud Function', 'AuthContext.refreshSession', { metadata: { error: e } });
                }
            }
        } catch (err) {
            ErrorLogger.error(err, 'AuthContext.refreshSession');
            setError(err as Error);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await firebaseSignOut(auth);
            setUser(null);
            setFirebaseUser(null);
            setIsBlocked(false);
            // Nettoyer le stockage local si nécessaire
            localStorage.removeItem('last_org_id');
        } catch (err) {
            ErrorLogger.error(err, 'AuthContext.logout');
            throw err;
        }
    }, [setUser]);

    const loginWithSSO = useCallback(async (providerId: string) => {
        try {
            const provider = new OAuthProvider(providerId);
            await signInWithPopup(auth, provider);
        } catch (err) {
            ErrorLogger.error(err, 'AuthContext.loginWithSSO');
            throw err;
        }
    }, []);

    useEffect(() => {
        // Initial check
        if (isAppCheckFailed) setIsBlocked(true);

        // Poll for App Check failure (as it happens asynchronously)
        const interval = setInterval(() => {
            if (isAppCheckFailed) {
                setIsBlocked(true);
                clearInterval(interval);
            }
        }, 500);

        return () => clearInterval(interval);
    }, []);

    // Session Timeout Logic
    useEffect(() => {
        if (!firebaseUser) return;

        const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
        const CHECK_INTERVAL = 60 * 1000; // Check every minute
        const lastActivityRef = { current: Date.now() };

        const updateActivity = () => {
            lastActivityRef.current = Date.now();
        };

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        // Using a passive listener for scroll to improve performance
        events.forEach(event => window.addEventListener(event, updateActivity, { passive: true }));

        const intervalId = setInterval(() => {
            if (Date.now() - lastActivityRef.current > IDLE_TIMEOUT) {
                ErrorLogger.info('Session timed out due to inactivity', 'AuthContext.sessionTimeout');
                logout();
            }
        }, CHECK_INTERVAL);

        return () => {
            clearInterval(intervalId);
            events.forEach(event => window.removeEventListener(event, updateActivity));
        };
    }, [firebaseUser, logout]);

    // Gestionnaire principal d'état d'authentification
    // Use refs to track subscriptions across async executions and avoid leaks
    const unsubscribeProfileRef = useRef<(() => void) | undefined>(undefined);
    const unsubscribeOrgRef = useRef<(() => void) | undefined>(undefined);

    useEffect(() => {
        // Sécurité : Timeout pour éviter le chargement infini
        const safetyTimeout = setTimeout(() => {
            if (loadingRef.current) {
                ErrorLogger.warn("Auth loading timeout - forcing stop", 'AuthContext.safetyTimeout');
                setProfileError(new Error("Délai d'attente dépassé (Connexion lente)"));
                setLoading(false);
            }
        }, 12000);

        const handleUser = async (u: User | null) => {
            // IMMEDIATE CLEANUP: Stop any existing listeners before doing anything else
            if (unsubscribeProfileRef.current) {
                unsubscribeProfileRef.current();
                unsubscribeProfileRef.current = undefined;
            }
            if (unsubscribeOrgRef.current) {
                unsubscribeOrgRef.current();
                unsubscribeOrgRef.current = undefined;
            }

            setFirebaseUser(u);

            if (!u) {
                setUser(null);
                setOrganization(null); // Ensure org is cleared
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                // 1. Mettre à jour le dernier login
                const lastLoginKey = `last_login_update_${u.uid}`;
                const lastUpdate = sessionStorage.getItem(lastLoginKey);
                const now = Date.now();

                if (!lastUpdate || now - parseInt(lastUpdate) > 3600000) {
                    const userRef = doc(db, 'users', u.uid);
                    // Fire and forget - don't await this to block profile loading
                    updateDoc(userRef, {
                        lastLogin: new Date().toISOString(),
                        lastActive: serverTimestamp()
                    }).then(() => {
                        sessionStorage.setItem(lastLoginKey, now.toString());
                    }).catch((e: unknown) => {
                        const err = e as { code?: string };
                        if (err.code !== 'not-found') {
                            ErrorLogger.warn("Failed to update lastLogin", 'AuthContext.handleUser', { metadata: { error: e } });
                        }
                    });
                }

                // 2. Écouter les changements du profil utilisateur en temps réel
                const userRef = doc(db, 'users', u.uid);
                unsubscribeProfileRef.current = onSnapshot(userRef, async (snapshot) => {
                    clearTimeout(safetyTimeout);
                    setIsBlocked(false);
                    setProfileError(null);

                    if (snapshot.exists()) {
                        const userData = snapshot.data() as UserProfile;

                        // SELF-HEALING
                        if (!userData.role) {
                            userData.role = 'user';
                            setDoc(userRef, { role: 'user' }, { merge: true }).catch(console.error);
                        }
                        if (userData.organizationId && !userData.onboardingCompleted) {
                            userData.onboardingCompleted = true;
                            setDoc(userRef, { onboardingCompleted: true }, { merge: true }).catch(console.error);
                        }

                        setUser(userData);

                        if (userData.organizationId && auth.currentUser) {
                            const key = `claims_refreshed_${auth.currentUser.uid}_${userData.organizationId}`;
                            if (!sessionStorage.getItem(key)) {
                                sessionStorage.setItem(key, '1');
                                try {
                                    const functions = getFunctions();
                                    const refreshUserTokenFn = httpsCallable(functions, 'refreshUserToken');
                                    await refreshUserTokenFn();
                                    await auth.currentUser.getIdToken(true);
                                } catch (e) {
                                    ErrorLogger.warn('Failed to refresh user token via Cloud Function', 'AuthContext.onSnapshot.refreshUserToken', { metadata: { error: e } });
                                }
                            }
                        }

                        if (userData.theme) setTheme(userData.theme);

                        if (userData.organizationId) {
                            // Clean up previous org listener if any (just in case org changed)
                            if (unsubscribeOrgRef.current) unsubscribeOrgRef.current();

                            const orgRef = doc(db, 'organizations', userData.organizationId);
                            unsubscribeOrgRef.current = onSnapshot(orgRef, (orgSnap) => {
                                if (orgSnap.exists()) {
                                    setOrganization({ id: orgSnap.id, ...orgSnap.data() } as Organization);
                                } else {
                                    setOrganization(null);
                                }
                            }, (err) => {
                                ErrorLogger.warn('Failed to subscribe to organization updates', 'AuthContext.onSnapshot.org', { metadata: { error: err } });
                                setOrganization(null); // Fallback
                            });
                        } else {
                            setOrganization(null);
                        }

                        setLoading(false);
                    } else {
                        // PROFIL INEXISTANT -> CRÉATION AUTOMATIQUE
                        ErrorLogger.info('No user profile found, creating default profile', 'AuthContext.handleUser');
                        const initialData: Partial<UserProfile> = {
                            uid: u.uid,
                            email: u.email || '',
                            displayName: u.displayName || u.email?.split('@')[0] || 'Utilisateur',
                            photoURL: u.photoURL,
                            onboardingCompleted: false,
                            createdAt: new Date().toISOString()
                        };
                        try {
                            await setDoc(userRef, initialData, { merge: true });
                            setUser(initialData as UserProfile);
                            setLoading(false);
                        } catch (err) {
                            ErrorLogger.error(err, 'AuthContext.createUserProfile');
                            setError(err as Error);
                            setLoading(false);
                        }
                    }
                }, async (err) => {
                    // ERROR HANDLER
                    ErrorLogger.error(err, 'AuthContext.onSnapshot');
                    clearTimeout(safetyTimeout);

                    // Stop listener if it crashed (though usually onSnapshot stops itself, this is double safety)
                    if (unsubscribeProfileRef.current) {
                        // Don't call it if it's already dead, but clearing ref is important
                        unsubscribeProfileRef.current = undefined;
                    }

                    if (err.code === 'permission-denied') {
                        // Critical: Stop the infinite loop of retries/reloads
                        // If we don't have permission to read our own profile, we should block.
                        ErrorLogger.warn('Permission denied. Likely App Check or Rules.', 'AuthContext.onSnapshot');
                        setIsBlocked(true);
                    } else if (err.code === 'unavailable' || err.code === 'failed-precondition') {
                        setProfileError(new Error("Connexion Firestore impossible."));
                    } else {
                        setError(err as Error);
                    }

                    setLoading(false);
                });

            } catch (err) {
                // CRITICAL FIX: If we get a 401 or similar auth error here, we must log out
                // otherwise the user is stuck in a half-authenticated state with a spinner
                const firebaseErr = err as { code?: string; message?: string };
                if (firebaseErr?.code === 'auth/internal-error' || firebaseErr?.code === 'permission-denied') {
                    ErrorLogger.warn("Critical Auth Error - Force Logout", 'AuthContext.handleUser', { metadata: { error: err } });
                    await logout();
                } else {
                    ErrorLogger.error(err, 'AuthContext.handleUser');
                    setError(err as Error);
                }
                setLoading(false);
            }
        };

        const unsubscribeAuth = onIdTokenChanged(auth, async (user) => {
            // Prevent infinite loops: We must update the ref SYNCHRONOUSLY here.
            // Waiting for useEffect or state updates causes a race condition where
            // rapid token refreshes trigger handleUser() multiple times.
            const currentUid = firebaseUserUidRef.current;
            const newUid = user?.uid;

            // IMMEDIATE UPDATE
            firebaseUserUidRef.current = newUid;

            if (currentUid === newUid && newUid) {
                // Token refreshed but same user identity.
                setFirebaseUser(user);
                return;
            }

            await handleUser(user);
        });

        const handleOnline = () => enableNetwork(db);
        const handleOffline = () => disableNetwork(db);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            clearTimeout(safetyTimeout);
            unsubscribeAuth();
            if (unsubscribeProfileRef.current) unsubscribeProfileRef.current();
            if (unsubscribeOrgRef.current) unsubscribeOrgRef.current();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [setUser, setTheme, logout, setOrganization]);

    // MFA State
    const [mfaSecret, setMfaSecret] = useState<TotpSecret | null>(null);

    const enrollMFA = useCallback(async () => {
        if (!auth.currentUser) throw new Error("No user logged in");
        const { multiFactor, TotpMultiFactorGenerator } = await import('firebase/auth');

        const multiFactorSession = await multiFactor(auth.currentUser).getSession();
        const secret = await TotpMultiFactorGenerator.generateSecret(multiFactorSession);
        setMfaSecret(secret);

        return secret.generateQrCodeUrl(auth.currentUser.email || 'Sentinel GRC', 'Sentinel GRC');
    }, []);

    const verifyMFA = useCallback(async (verificationId: string, code: string) => {
        if (!auth.currentUser || !mfaSecret) throw new Error("MFA setup not initialized");
        const { multiFactor, TotpMultiFactorGenerator } = await import('firebase/auth');

        const multiFactorAssertion = TotpMultiFactorGenerator.assertionForEnrollment(mfaSecret, code);
        await multiFactor(auth.currentUser).enroll(multiFactorAssertion, verificationId);
        setMfaSecret(null);
    }, [mfaSecret]);

    const unenrollMFA = useCallback(async () => {
        if (!auth.currentUser) return;
        const { multiFactor } = await import('firebase/auth');
        const enrolledFactors = multiFactor(auth.currentUser).enrolledFactors;
        if (enrolledFactors.length > 0) {
            await multiFactor(auth.currentUser).unenroll(enrolledFactors[0]);
        }
    }, []);

    const value = {
        user: useStore.getState().user,
        firebaseUser,
        loading,
        error,
        profileError,
        isBlocked,
        dismissBlockerError: () => setIsBlocked(false),
        isAdmin: useStore.getState().user?.role === 'admin',
        refreshSession,
        logout,
        enrollMFA,
        verifyMFA,
        unenrollMFA,
        loginWithSSO
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
