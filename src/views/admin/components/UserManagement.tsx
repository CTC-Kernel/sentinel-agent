import React, { useState } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useStore } from '../../../store';
import { UserProfile } from '../../../types';
import { ErrorLogger } from '../../../services/errorLogger';
import { Search, User as UserIcon, Mail, Shield, Building2, MoreVertical, LogIn } from '../../../components/ui/Icons';
import { AdminService } from '../../../services/adminService';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

const auth = getAuth();

export const UserManagement: React.FC = () => {
 const { addToast, t } = useStore();
 const [searchTerm, setSearchTerm] = useState('');
 const [users, setUsers] = useState<UserProfile[]>([]);
 const [loading, setLoading] = useState(false);
 const [hasSearched, setHasSearched] = useState(false);
 const [impersonateTarget, setImpersonateTarget] = useState<UserProfile | null>(null);

 const handleImpersonate = async (user: UserProfile) => {
 try {
 const { token } = await AdminService.impersonateUser(user.uid);
 // Use Firebase Auth to sign in with custom token
 await signInWithCustomToken(auth, token);
 window.location.href = '/dashboard';
 } catch (err) {
 ErrorLogger.error(err, 'UserManagement.impersonate');
 addToast(t('admin.toast.impersonationFailed', { defaultValue: 'Échec de la connexion en tant qu\'utilisateur' }), 'error');
 } finally {
 setImpersonateTarget(null);
 }
 };

 const handleSearch = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!searchTerm.trim()) return;

 setLoading(true);
 setHasSearched(true);
 try {
 // Note: Firestore text search is limited. We search by approximate email match using >= and <= technique or just simple equality for now.
 // For a real production app with many users, Algolia or Typesense is recommended.
 // Here we'll try to find by email which is the most common use case for admin.

 const usersRef = collection(db, 'users');
 // Strategy: Try email match first
 const q = query(
 usersRef,
 where('email', '>=', searchTerm),
 where('email', '<=', searchTerm + '\uf8ff'),
 limit(20)
 );

 const snapshot = await getDocs(q);
 const data = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
 setUsers(data);
 } catch (err) {
 ErrorLogger.error(err as Error, 'UserManagement.search');
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="space-y-6 animate-fade-in">
 <div className="bg-card/50 border border-border rounded-2xl p-8 text-center max-w-2xl mx-auto">
 <h3 className="text-xl font-bold text-foreground mb-2">Recherche Globale d'Utilisateurs</h3>
 <p className="text-muted-foreground mb-6">Rechercher un utilisateur par email dans toutes les organisations.</p>

 <form onSubmit={handleSearch} className="relative">
  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
  <input
  type="text"
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  placeholder="Saisir l'email de l'utilisateur..."
  className="w-full pl-12 pr-4 py-3 bg-background/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus-visible:ring-primary text-foreground placeholder:text-muted-foreground"
  />
  <button
  type="submit"
  disabled={loading || !searchTerm}
  className="absolute right-2 top-2 bottom-2 px-4 bg-primary hover:bg-primary disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
  >
  {loading ? 'Recherche...' : 'Rechercher'}
  </button>
 </form>
 </div>

 {hasSearched && (
 <div className="space-y-4">
  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider ml-1">Résultats ({users.length})</h4>

  <div className="grid gap-4">
  {users.map(user => (
  <div key={user.uid || 'unknown'} className="bg-muted/50 border border-border/50 rounded-xl p-4 flex items-center justify-between hover:bg-muted transition-colors group">
  <div className="flex items-center">
   <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mr-4 overflow-hidden">
   {user.photoURL ? (
   <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
   ) : (
   <UserIcon className="w-6 h-6 text-muted-foreground" />
   )}
   </div>
   <div>
   <h4 className="text-foreground font-medium flex items-center">
   {user.displayName}
   {user.role === 'admin' && <Shield className="w-3 h-3 ml-2 text-primary/70" />}
   {user.role === 'super_admin' && <Shield className="w-3 h-3 ml-2 text-red-400" />}
   </h4>
   <div className="flex items-center text-sm text-muted-foreground mt-1 space-x-4">
   <span className="flex items-center"><Mail className="w-3 h-3 mr-1.5" />{user.email}</span>
   {user.organizationId && (
   <span className="flex items-center"><Building2 className="w-3 h-3 mr-1.5" />{user.organizationId}</span>
   )}
   </div>
   </div>
  </div>
  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-70 transition-opacity">
   <button
   className="p-2.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
   title="Se connecter en tant que"
   onClick={(e) => {
   e.stopPropagation();
   setImpersonateTarget(user);
   }}
   >
   <LogIn className="w-4 h-4" />
   </button>
   <button className="p-2.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
   <MoreVertical className="w-4 h-4" />
   </button>
  </div>
  </div>
  ))}

  {users.length === 0 && !loading && (
  <div className="text-center py-12 text-muted-foreground bg-card/30 rounded-2xl border border-dashed border-border">
  Aucun utilisateur trouvé pour "{searchTerm}"
  </div>
  )}
  </div>
 </div>
 )}

 <ConfirmModal
 isOpen={impersonateTarget !== null}
 onClose={() => setImpersonateTarget(null)}
 onConfirm={() => impersonateTarget && handleImpersonate(impersonateTarget)}
 title="Se connecter en tant qu'utilisateur"
 message={`Êtes-vous sûr de vouloir vous connecter en tant que ${impersonateTarget?.email} ?`}
 type="warning"
 confirmText="Se connecter"
 cancelText="Annuler"
 />
 </div>
 );
};
