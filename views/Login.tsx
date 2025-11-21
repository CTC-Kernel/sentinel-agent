
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../firebase';
import { Lock, Mail, ArrowRight, ShieldAlert, AlertTriangle, Server } from '../components/ui/Icons';
import { useStore } from '../store';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Logos SVG natifs pour un rendu parfait
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { addToast } = useStore();

  const createUserProfile = async (user: any) => {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email,
                role: 'user',
                displayName: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
                department: ''
            });
        }
      } catch (e) {
        console.error("Erreur création profil:", e);
      }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        addToast("Connexion réussie", "success");
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await createUserProfile(userCred.user);
        addToast("Compte créé avec succès", "success");
      }
    } catch (error: any) {
      console.error("Auth Error:", error.code, error.message);
      let msg = "Erreur d'authentification.";
      if (error.code === 'auth/invalid-credential') msg = "Email ou mot de passe incorrect.";
      if (error.code === 'auth/user-not-found') msg = "Aucun compte trouvé avec cet email.";
      if (error.code === 'auth/wrong-password') msg = "Mot de passe incorrect.";
      if (error.code === 'auth/email-already-in-use') msg = "Cet email est déjà utilisé.";
      if (error.code === 'auth/weak-password') msg = "Le mot de passe doit faire au moins 6 caractères.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          await createUserProfile(result.user);
          addToast(`Bienvenue ${result.user.displayName || ''}`, "success");
      } catch (error: any) {
          console.error("Social Auth Error", error.code, error.message);
          if(error.code === 'auth/unauthorized-domain' || error.code === 'auth/operation-not-allowed') {
             // Message spécifique pour l'environnement de dev
             setErrorMsg("RESTRICTION ENVIRONNEMENT : Google Auth est bloqué sur ce domaine de prévisualisation. Utilisez l'email ci-dessous.");
          } else if (error.code === 'auth/popup-closed-by-user') {
             setErrorMsg(null);
          } else {
             setErrorMsg("Erreur de connexion Google. Réessayez ou utilisez l'Email.");
          }
      } finally {
          setLoading(false);
      }
  };

  const fillDemoCredentials = () => {
      setEmail('demo@sentinel.local');
      setPassword('demo1234');
      setIsLogin(false); // Switch to register in case it doesn't exist, user can switch back
      setErrorMsg(null);
      addToast("Identifiants de démo pré-remplis", "info");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-400/20 dark:bg-brand-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
            <div className="absolute bottom-[-20%] right-[-20%] w-96 h-96 bg-purple-400/20 dark:bg-purple-900/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      </div>

      <div className="w-full max-w-md p-8 relative z-10">
         <div className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/20 dark:border-white/10 p-8 md:p-10">
            <div className="flex justify-center mb-8">
                <div className="relative">
                    <div className="absolute inset-0 bg-brand-500 blur-xl opacity-30"></div>
                    <div className="relative bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-gray-300 p-4 rounded-2xl shadow-lg ring-1 ring-white/10">
                        <Lock className="h-8 w-8 text-white dark:text-slate-900" />
                    </div>
                </div>
            </div>
            
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Sentinel GRC</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Plateforme de Gouvernance & Conformité</p>
            </div>

            {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex flex-col gap-3 text-sm text-red-600 dark:text-red-400 animate-fade-in shadow-sm">
                    <div className="flex items-start">
                        <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5"/>
                        <span className="font-semibold">{errorMsg}</span>
                    </div>
                    {errorMsg.includes('RESTRICTION') && (
                        <button 
                            onClick={fillDemoCredentials}
                            className="self-end text-xs bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-800 dark:text-red-200 px-3 py-2 rounded-lg transition-colors font-bold flex items-center"
                        >
                            <Server className="h-3 w-3 mr-2"/>
                            Utiliser Compte Démo (Email)
                        </button>
                    )}
                </div>
            )}

            <div className="mb-6">
                <button 
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center px-4 py-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors shadow-sm group"
                >
                    <div className="group-hover:scale-110 transition-transform duration-300">
                        <GoogleIcon />
                    </div>
                    <span className="ml-3 text-sm font-medium text-slate-700 dark:text-white">Continuer avec Google</span>
                </button>
            </div>

            <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-slate-50/50 dark:bg-slate-800 text-gray-500 uppercase tracking-wider">ou via email</span>
                </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-5">
                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Email Professionnel</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-brand-500 transition-colors"/>
                        </div>
                        <input 
                            type="email" 
                            required
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all"
                            placeholder="admin@sentinel.local"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Mot de passe</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-brand-500 transition-colors"/>
                        </div>
                        <input 
                            type="password" 
                            required
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-brand-500 dark:text-white transition-all"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center group"
                >
                    {loading ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <>
                            {isLogin ? 'Se connecter' : 'Créer un compte'}
                            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-6 text-center">
                <button 
                    onClick={() => {
                        setIsLogin(!isLogin);
                        setErrorMsg(null);
                    }}
                    className="text-sm text-slate-500 hover:text-brand-600 transition-colors font-medium underline decoration-transparent hover:decoration-brand-600 underline-offset-4"
                >
                    {isLogin ? "Pas encore de compte ? S'inscrire gratuitement" : "Déjà un compte ? Se connecter"}
                </button>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700/50 text-center">
                 <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                    <ShieldAlert className="w-3 h-3 mr-1.5"/>
                    Environnement Sécurisé
                 </div>
            </div>
         </div>
      </div>
    </div>
  );
};
