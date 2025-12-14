import React, { useEffect, useState, useCallback } from 'react';
import {
    User,
    onIdTokenChanged,
    signOut as firebaseSignOut,
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
    const { setUser, setOrganization, setTheme } = useStore();

    const [isBlocked, setIsBlocked] = useState(isAppCheckFailed);

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

    useEffect(() => {
        if (isAppCheckFailed) {
            setIsBlocked(true);
        }
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
    useEffect(() => {


        let unsubscribeProfile: (() => void) | undefined;
        let unsubscribeOrg: (() => void) | undefined;


        // Sécurité : Timeout pour éviter le chargement infini
        const safetyTimeout = setTimeout(() => {
            if (loading) {
                ErrorLogger.warn("Auth loading timeout - forcing stop", 'AuthContext.safetyTimeout');
                setLoading(false);
            }
        }, 8000);

        const handleUser = async (u: User | null) => {
            setFirebaseUser(u);

            if (!u) {
                setUser(null);
                setLoading(false);
                if (unsubscribeProfile) unsubscribeProfile();
                return;
            }

            // FIX: Ensure loading is true while we fetch the profile to prevent AuthGuard from redirecting prematurely
            setLoading(true);

            try {
                // 1. Mettre à jour le dernier login (Non-blocking & Safe)
                // Use updateDoc to avoid creating a partial document if it doesn't exist yet.
                // We don't await this to prevent blocking the UI/Profile load.
                const userRef = doc(db, 'users', u.uid);
                updateDoc(userRef, {
                    lastLogin: new Date().toISOString(),
                    lastActive: serverTimestamp()
                }).catch((e: unknown) => {
                    // Ignore "not found" errors as the profile might not exist yet (will be created below)
                    const err = e as { code?: string };
                    if (err.code !== 'not-found') {
                        ErrorLogger.warn("Failed to update lastLogin", 'AuthContext.handleUser', { metadata: { error: e } });
                    }
                });

                // 2. Écouter les changements du profil utilisateur en temps réel
                unsubscribeProfile = onSnapshot(userRef, async (snapshot) => {
                    clearTimeout(safetyTimeout); // Clear timeout on success
                    setIsBlocked(false); // Reset blocked state on success

                    if (snapshot.exists()) {
                        const userData = snapshot.data() as UserProfile;

                        // SELF-HEALING: Vérifier la cohérence des données
                        // 1. Si le rôle est manquant, on le force à 'user' par sécurité
                        if (!userData.role) {
                            ErrorLogger.warn("User role missing in Firestore, defaulting to user for safety", 'AuthContext.handleUser');
                            userData.role = 'user';
                            // Fix persistence immediately
                            setDoc(userRef, { role: 'user' }, { merge: true }).catch(e => ErrorLogger.error(e, 'AuthContext.autoFixRole'));
                        }

                        // 2. Si l'utilisateur a une organisation mais onboarding non validé -> Auto-fix
                        if (userData.organizationId && !userData.onboardingCompleted) {
                            ErrorLogger.warn("User has organization but onboarding not marked complete. Auto-fixing.", 'AuthContext.handleUser');
                            userData.onboardingCompleted = true;
                            // Corriger la source en arrière-plan
                            setDoc(userRef, { onboardingCompleted: true }, { merge: true }).catch(e => ErrorLogger.error(e, 'AuthContext.autoFixOnboarding'));
                        }

                        if (!userData.organizationId && !userData.onboardingCompleted) {
                            // Utilisateur sans orga = Nouveau ou Onboarding non fini
                            ErrorLogger.info('User has no organizationId, ready for onboarding', 'AuthContext.handleUser');
                        }

                        setUser(userData);

                        if (userData.theme) {
                            setTheme(userData.theme);
                        }
                        if (userData.organizationId) {
                            // Subscribe to Organization updates
                            if (unsubscribeOrg) unsubscribeOrg();
                            const orgRef = doc(db, 'organizations', userData.organizationId);
                            unsubscribeOrg = onSnapshot(orgRef, (orgSnap) => {
                                if (orgSnap.exists()) {
                                    setOrganization({ id: orgSnap.id, ...orgSnap.data() } as Organization);
                                } else {
                                    setOrganization(null);
                                }
                            }, (err) => {
                                ErrorLogger.error(err, 'AuthContext.orgSnapshot');
                            });
                        } else {
                            setOrganization(null);
                            if (unsubscribeOrg) {
                                unsubscribeOrg();
                                unsubscribeOrg = undefined;
                            }
                        }

                        setLoading(false);
                    } else {
                        // PROFIL INEXISTANT -> CRÉATION AUTOMATIQUE
                        ErrorLogger.info('No user profile found, creating default profile', 'AuthContext.handleUser');

                        try {
                            // Basic initial data - SAFE to create
                            const initialData: Partial<UserProfile> = {
                                uid: u.uid,
                                email: u.email || '',
                                displayName: u.displayName || u.email?.split('@')[0] || 'Utilisateur',
                                photoURL: u.photoURL,
                                onboardingCompleted: false, // Will be updated by backend if invitation exists
                                createdAt: new Date().toISOString()
                            };

                            // Create user document
                            // This will trigger the backend 'setUserClaims' function which will:
                            // 1. Check for invitations
                            // 2. Assign organization/role if invitation exists
                            // 3. Set custom claims
                            await setDoc(userRef, initialData, { merge: true });

                            // Set temporary state to avoid UI flash while waiting for backend
                            setUser(initialData as UserProfile);
                            setLoading(false);

                        } catch (err) {
                            ErrorLogger.error(err, 'AuthContext.createUserProfile');
                            setError(err as Error);
                            setLoading(false);
                        }
                    }
                }, async (err) => {
                    ErrorLogger.error(err, 'AuthContext.onSnapshot');
                    clearTimeout(safetyTimeout); // Clear timeout on error

                    // CRITICAL FIX: Do not use a permissive fallback for production.
                    // If Firestore fails, we should not grant admin access.

                    // Detect stale session (User deleted in Auth but token still cached)
                    if (err.code === 'permission-denied') {
                        // Check if this might be a content blocker issue (App Check failure)
                        // If it happens immediately on load, it's likely App Check.
                        // If it happens after a while, it might be a stale token.
                        // For now, we'll flag it as potential blocker if we can't access the profile.
                        ErrorLogger.warn('Permission denied for user profile. Checking for blockers...', 'AuthContext.onSnapshot');
                        setIsBlocked(true);
                        setLoading(false);
                    } else if (err.code === 'unavailable' || err.code === 'failed-precondition') {
                        // Offline or App Check failure
                        ErrorLogger.warn('Firestore unavailable. Likely content blocker.', 'AuthContext.onSnapshot');
                        setIsBlocked(true);
                        setLoading(false);
                    } else {
                        setError(err as Error);
                        setLoading(false);
                    }
                });

            } catch (err) {
                ErrorLogger.error(err, 'AuthContext.handleUser');
                setError(err as Error);
                setLoading(false);
            }
        };

        // Écouter les changements d'authentification et de token
        const unsubscribeAuth = onIdTokenChanged(auth, async (user) => {
            // onIdTokenChanged est déclenché à la connexion, déconnexion, et rafraîchissement de token
            await handleUser(user);
        });

        // Gestion de la connectivité (Optionnel mais bonne pratique SaaS)
        const handleOnline = () => enableNetwork(db);
        const handleOffline = () => disableNetwork(db); // Ou laisser Firebase gérer le cache

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            clearTimeout(safetyTimeout);
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
            if (unsubscribeOrg) unsubscribeOrg();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [setUser, setTheme, logout]); // eslint-disable-line react-hooks/exhaustive-deps

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
        isBlocked,
        dismissBlockerError: () => setIsBlocked(false),
        isAdmin: useStore.getState().user?.role === 'admin',
        refreshSession,
        logout,
        enrollMFA,
        verifyMFA,
        unenrollMFA
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
