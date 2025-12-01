import React, { useEffect, useState, useCallback } from 'react';
import {
    User,
    onIdTokenChanged,
    signOut as firebaseSignOut
} from 'firebase/auth';
import {
    doc,
    onSnapshot,
    setDoc,
    serverTimestamp,
    enableNetwork,
    disableNetwork,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    deleteDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { UserProfile, Invitation, Organization } from '../types';
import { httpsCallable, getFunctions } from 'firebase/functions';


import { AuthContext } from './AuthContextDefinition';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { setUser, setOrganization, setTheme } = useStore();

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
            // Nettoyer le stockage local si nécessaire
            localStorage.removeItem('last_org_id');
        } catch (err) {
            ErrorLogger.error(err, 'AuthContext.logout');
            throw err;
        }
    }, [setUser]);

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
                    if (snapshot.exists()) {
                        const userData = snapshot.data() as UserProfile;

                        // SELF-HEALING: Vérifier la cohérence des données
                        // 1. Si le rôle est manquant, on le force à 'admin' et ON LE SAUVEGARDE
                        if (!userData.role) {
                            ErrorLogger.warn("User role missing in Firestore, defaulting to admin for recovery", 'AuthContext.handleUser');
                            userData.role = 'admin';
                            // Fix persistence immediately
                            setDoc(userRef, { role: 'admin' }, { merge: true }).catch(e => ErrorLogger.error(e, 'AuthContext.autoFixRole'));
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
                            console.log('User has no organizationId, ready for onboarding');
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
                        console.log('No user profile found, creating default profile...');

                        try {
                            // Vérifier s'il y a une invitation en attente
                            let initialData: Partial<UserProfile> = {
                                uid: u.uid,
                                email: u.email || '',
                                displayName: u.displayName || u.email?.split('@')[0] || 'Utilisateur',
                                photoURL: u.photoURL,
                                role: 'user',
                                onboardingCompleted: false,
                                createdAt: new Date().toISOString() // Ajout timestamp création
                            };

                            const inviteQuery = query(collection(db, 'invitations'), where('email', '==', u.email));
                            const inviteSnap = await getDocs(inviteQuery);

                            if (!inviteSnap.empty) {
                                const invite = inviteSnap.docs[0].data() as Invitation;
                                console.log('Invitation found, linking to organization:', invite.organizationName);
                                initialData = {
                                    ...initialData,
                                    organizationId: invite.organizationId,
                                    organizationName: invite.organizationName,
                                    department: invite.department,
                                    role: invite.role || 'user',
                                    // Onboarding considéré comme non terminé pour confirmer les infos, 
                                    // ou true si on veut skip. Laissons false pour qu'il vérifie ses infos.
                                    onboardingCompleted: false
                                };
                                // Supprimer l'invitation utilisée
                                await deleteDoc(inviteSnap.docs[0].ref);
                            }

                            // Création du document utilisateur
                            // Cela va déclencher le snapshot listener à nouveau avec exists=true
                            await setDoc(userRef, initialData, { merge: true });

                            // On ne met pas setLoading(false) ici, on attend que le snapshot repasse
                            // Cependant, par sécurité pour éviter un blocage si le snapshot ne trigger pas vite :
                            // On set un état temporaire
                            setUser(initialData as UserProfile);
                            setLoading(false);

                        } catch (err) {
                            ErrorLogger.error(err, 'AuthContext.createUserProfile');
                            setError(err as Error);
                            setLoading(false); // Débloquer même en cas d'erreur pour afficher l'erreur
                        }
                    }
                }, async (err) => {
                    ErrorLogger.error(err, 'AuthContext.onSnapshot');
                    clearTimeout(safetyTimeout); // Clear timeout on error

                    // CRITICAL FIX: Do not use a permissive fallback for production.
                    // If Firestore fails, we should not grant admin access.

                    // Detect stale session (User deleted in Auth but token still cached)
                    if (err.code === 'permission-denied') {
                        ErrorLogger.warn('Permission denied for user profile. Session might be invalid or user deleted. Logging out...', 'AuthContext.onSnapshot');
                        try {
                            await logout();
                        } catch (logoutErr) {
                            ErrorLogger.error(logoutErr, 'AuthContext.forcedLogout');
                            // Force local state cleanup even if firebase logout fails
                            setUser(null);
                            setFirebaseUser(null);
                            localStorage.removeItem('last_org_id');
                        }
                    } else {
                        setError(err as Error);
                    }

                    setLoading(false);
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

    const value = {
        user: useStore.getState().user, // On lit depuis le store pour être synchro
        firebaseUser,
        loading,
        error,
        isAdmin: useStore.getState().user?.role === 'admin',
        refreshSession,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
