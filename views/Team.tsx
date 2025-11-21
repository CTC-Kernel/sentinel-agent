import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { Users, Mail, Plus } from '../components/ui/Icons';
import { useStore } from '../store';

export const Team: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const { addToast } = useStore();
  const [newUser, setNewUser] = useState({ displayName: '', email: '', role: 'user', department: '' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      // If empty, we show nothing or default
      if (!snap.empty) {
          setUsers(snap.docs.map(d => d.data() as UserProfile));
      } else {
          // Keep a default user visible if DB is empty for demo purposes until they add one
          setUsers([
            { uid: '1', displayName: 'Admin', email: 'admin@sentinel.local', role: 'admin', department: 'IT' }
          ]);
      }
    } catch (e) {
       console.warn("Erreur fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await addDoc(collection(db, 'users'), newUser);
          setShowModal(false);
          setNewUser({ displayName: '', email: '', role: 'user', department: '' });
          addToast("Invitation envoyée (Profil créé)", "success");
          fetchUsers();
      } catch(e) { 
          addToast("Erreur lors de la création", "error");
      }
  };

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Équipe & Rôles</h1>
                <p className="text-slate-500 dark:text-slate-400">Gestion des accès et des collaborateurs.</p>
            </div>
            <button onClick={() => setShowModal(true)} className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
                <Plus className="h-4 w-4 mr-2" />
                Inviter un membre
            </button>
        </div>

        <div className="bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-gray-800 text-gray-500 uppercase text-xs">
                    <tr>
                        <th className="px-6 py-3">Utilisateur</th>
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3">Rôle</th>
                        <th className="px-6 py-3">Département</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {users.map((u, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center">
                                <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 flex items-center justify-center mr-3 font-bold">
                                    {u.displayName.charAt(0).toUpperCase()}
                                </div>
                                {u.displayName}
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                                <div className="flex items-center">
                                    <Mail className="h-3 w-3 mr-2 opacity-50"/>
                                    {u.email}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                    u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                    u.role === 'auditor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                    'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-400'
                                }`}>
                                    {u.role}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-gray-500">{u.department || '-'}</td>
                            <td className="px-6 py-4 text-right">
                                <button className="text-brand-600 hover:underline text-xs font-medium">Éditer</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-850 rounded-2xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-800">
                    <h3 className="text-lg font-bold mb-4 dark:text-white">Inviter un utilisateur</h3>
                    <form onSubmit={handleAddUser} className="space-y-4">
                        <input type="text" placeholder="Nom complet" className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white" required 
                            value={newUser.displayName} onChange={e => setNewUser({...newUser, displayName: e.target.value})} />
                        <input type="email" placeholder="Email professionnel" className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white" required
                            value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                        <select className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white dark:bg-slate-800"
                             value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                            <option value="user">Utilisateur</option>
                            <option value="auditor">Auditeur</option>
                            <option value="admin">Administrateur</option>
                        </select>
                         <input type="text" placeholder="Département" className="w-full p-2 border rounded dark:bg-transparent dark:border-gray-700 dark:text-white"
                            value={newUser.department} onChange={e => setNewUser({...newUser, department: e.target.value})} />
                        <div className="flex justify-end gap-2 mt-4">
                            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-500">Annuler</button>
                            <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded">Inviter</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};