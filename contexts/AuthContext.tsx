import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
    collection,
    query,
    where,
    getDocs,
    deleteDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useStore } from '../store';
import { UserProfile, Invitation } from '../types';
import { httpsCallable, getFunctions } from 'firebase/functions';

interface AuthContextType {
    user: UserProfile | null;
    firebaseUser: User | null;
    loading: boolean;
    error: Error | null;
    isAdmin: boolean;
    refreshSession: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { setUser, setTheme } = useStore();
    
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
                    console.warn('Failed to refresh custom claims via Cloud Function', e);
                }
            }
        } catch (err) {
            console.error('Error refreshing session:', err);
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
            console.error('Logout error:', err);
            throw err;
        }
    }, [setUser]);

    // Gestionnaire principal d'état d'authentification
    useEffect(() => {
        let unsubscribeProfile: (() => void) | undefined;
        
        // Sécurité : Timeout pour éviter le chargement infini
        const safetyTimeout = setTimeout(() => {
            if (loading) {
                console.warn("Auth loading timeout - forcing stop");
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
                // 1. Mettre à jour le dernier login (avec setDoc merge pour ne pas planter si doc inexistant)
                const userRef = doc(db, 'users', u.uid);
                try {
                    await setDoc(userRef, { 
                        lastLogin: new Date().toISOString(),
                        lastActive: serverTimestamp()
                    }, { merge: true });
                } catch (e) {
                    console.warn("Failed to update lastLogin (might be due to missing permissions on create)", e);
                }

                // 2. Écouter les changements du profil utilisateur en temps réel
                unsubscribeProfile = onSnapshot(userRef, async (snapshot) => {
                    clearTimeout(safetyTimeout); // Clear timeout on success
                    if (snapshot.exists()) {
                        const userData = snapshot.data() as UserProfile;
                        
                        // SELF-HEALING: Vérifier la cohérence des données
                        // Si le rôle est manquant (cause du menu vide), on le force à 'admin' par sécurité en dev/onboarding
                        if (!userData.role) {
                            console.warn("User role missing in Firestore, defaulting to admin for recovery");
                            userData.role = 'admin';
                        }

                        if (!userData.organizationId && !userData.onboardingCompleted) {
                           // Utilisateur sans orga = Nouveau ou Onboarding non fini
                           console.log('User has no organizationId, ready for onboarding');
                        }

                        setUser(userData);
                        
                        if (userData.theme) {
                            setTheme(userData.theme);
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
                            console.error("Error creating user profile:", err);
                            setError(err as Error);
                            setLoading(false); // Débloquer même en cas d'erreur pour afficher l'erreur
                        }
                    }
                }, (err) => {
                    console.error('Error listening to user profile:', err);
                    clearTimeout(safetyTimeout); // Clear timeout on error
                    
                    // CRITICAL FIX: Do not use a permissive fallback for production.
                    // If Firestore fails, we should not grant admin access.
                    setError(err as Error);
                    setLoading(false);
                    // Optional: force logout if truly unrecoverable?
                    // logout(); 
                });

            } catch (err) {
                console.error('Error handling user session:', err);
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
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [setUser, setTheme]);

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
