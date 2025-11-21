
import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Moon, Sun, ShieldAlert, Database, Save, History, Download, Users, ArrowRight } from '../components/ui/Icons';
import { collection, getDocs, query, orderBy, limit, where, addDoc, updateDoc, doc, startAfter } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemLog, UserProfile } from '../types';

export const Settings: React.FC = () => {
  const { theme, toggleTheme, user, setUser } = useStore();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [lastLog, setLastLog] = useState<any>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Profile state
  const [profile, setProfile] = useState({ displayName: '', department: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
      if(user) {
          setProfile({ displayName: user.displayName || '', department: user.department || '' });
      }
      if(user?.role === 'admin') {
          fetchLogs(true);
      }
  }, [user]);

  const fetchLogs = async (reset = false) => {
      if (loadingLogs || (!hasMoreLogs && !reset)) return;
      setLoadingLogs(true);
      try {
          let q;
          if (reset) {
              q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(10));
          } else {
              q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), startAfter(lastLog), limit(10));
          }
          
          const snap = await getDocs(q);
          
          if (!snap.empty) {
              setLastLog(snap.docs[snap.docs.length - 1]);
              const newLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemLog));
              setLogs(prev => reset ? newLogs : [...prev, ...newLogs]);
              if(snap.docs.length < 10) setHasMoreLogs(false);
              else setHasMoreLogs(true);
          } else {
              setHasMoreLogs(false);
          }
      } catch (e) { 
          console.error(e); 
      } finally {
          setLoadingLogs(false);
      }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!user) return;
      setSavingProfile(true);
      try {
          // Find user doc by UID or Email
          const usersRef = collection(db, 'users');
          // Try by email for guest/initial users
          const q = query(usersRef, where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          
          let userData: UserProfile = { ...user, displayName: profile.displayName, department: profile.department };

          if (!querySnapshot.empty) {
              // Update existing
              const docId = querySnapshot.docs[0].id;
              await updateDoc(doc(db, 'users', docId), {
                  displayName: profile.displayName,
                  department: profile.department
              });
          } else {
              // Create if doesn't exist (rare case for guest)
              await addDoc(usersRef, {
                  uid: user.uid,
                  email: user.email,
                  role: user.role,
                  displayName: profile.displayName,
                  department: profile.department
              });
          }
          
          // Update local store
          setUser(userData);
          alert("Profil mis à jour avec succès.");
      } catch(err) {
          console.error(err);
          alert("Erreur lors de la mise à jour du profil.");
      } finally {
          setSavingProfile(false);
      }
  };

  const handleExport = async () => {
      setExporting(true);
      try {
          const collectionsToExport = ['assets', 'risks', 'controls', 'audits', 'users'];
          const exportData: Record<string, any> = {};

          await Promise.all(collectionsToExport.map(async (colName) => {
              const snap = await getDocs(collection(db, colName));
              exportData[colName] = snap.docs.map(d => d.data());
          }));
          
          exportData['exportedAt'] = new Date().toISOString();
          exportData['version'] = '1.0';

          const jsonString = JSON.stringify(exportData, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `sentinel_backup_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

      } catch(error) {
          console.error("Export failed", error);
          alert("L'export a échoué.");
      } finally {
          setExporting(false);
      }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paramètres Système</h1>

        {/* My Profile */}
        <div className="bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-brand-500" />
                Mon Profil
            </h2>
            <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom d'affichage</label>
                    <input type="text" required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-white"
                        value={profile.displayName} onChange={e => setProfile({...profile, displayName: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Département</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-transparent dark:text-white"
                        value={profile.department} onChange={e => setProfile({...profile, department: e.target.value})} />
                </div>
                <div className="md:col-span-2 flex justify-end mt-2">
                    <button type="submit" disabled={savingProfile} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
                        {savingProfile ? 'Enregistrement...' : 'Mettre à jour mon profil'}
                    </button>
                </div>
            </form>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                <Sun className="h-5 w-5 mr-2 text-brand-500" />
                Apparence
            </h2>
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Mode Sombre</p>
                    <p className="text-sm text-gray-500">Basculer entre le thème clair et sombre.</p>
                </div>
                <button 
                    onClick={toggleTheme}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${theme === 'dark' ? 'bg-brand-600' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>

        {/* Data Management */}
        <div className="bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                <Database className="h-5 w-5 mr-2 text-brand-500" />
                Gestion des Données
            </h2>
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                    <div>
                        <p className="font-medium text-slate-700 dark:text-slate-300">Sauvegarde Complète (JSON)</p>
                        <p className="text-sm text-gray-500">Télécharger une copie de toutes les données de la base.</p>
                    </div>
                    <button 
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-700 rounded text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        {exporting ? 'Export en cours...' : 'Exporter'}
                    </button>
                </div>
            </div>
        </div>

        {/* Audit Logs (Admin Only) */}
        {user?.role === 'admin' && (
            <div className="bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center">
                    <History className="h-5 w-5 mr-2 text-brand-500" />
                    Logs d'activité (Audit Trail)
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left mb-4">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-slate-900/50">
                            <tr>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">Utilisateur</th>
                                <th className="px-4 py-2">Action</th>
                                <th className="px-4 py-2">Détail</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {logs.map(log => (
                                <tr key={log.id}>
                                    <td className="px-4 py-2 text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{log.userEmail}</td>
                                    <td className="px-4 py-2 font-medium">{log.action}</td>
                                    <td className="px-4 py-2 text-gray-500">{log.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {hasMoreLogs && (
                        <button 
                            onClick={() => fetchLogs(false)} 
                            disabled={loadingLogs}
                            className="w-full py-2 bg-gray-50 dark:bg-slate-800 text-gray-500 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center"
                        >
                            {loadingLogs ? 'Chargement...' : (
                                <>
                                    Charger plus d'activités <ArrowRight className="ml-2 h-3 w-3" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
