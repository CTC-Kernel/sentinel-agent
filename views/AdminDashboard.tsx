import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { ShieldAlert, Users, Building, Activity, Search } from 'lucide-react';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { ErrorLogger } from '../services/errorLogger';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface OrganizationSummary {
    id: string;
    name: string;
    planId: string;
    createdAt: string;
    userCount?: number;
}

export const AdminDashboard: React.FC = () => {
    const { user } = useStore();
    const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalOrgs: 0, totalUsers: 0 });

    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        const checkSuperAdmin = async () => {
            if (!user?.email) {
                setCheckingAuth(false);
                return;
            }

            try {
                const functions = getFunctions();
                const verifySuperAdmin = httpsCallable(functions, 'verifySuperAdmin');
                const result = await verifySuperAdmin();
                const data = result.data as { isSuperAdmin: boolean };
                setIsSuperAdmin(data.isSuperAdmin);
            } catch (error) {
                console.error('Failed to verify super admin status', error);
                setIsSuperAdmin(false);
            } finally {
                setCheckingAuth(false);
            }
        };

        checkSuperAdmin();
    }, [user]);

    useEffect(() => {
        const fetchData = async () => {
            if (!isSuperAdmin) return;

            try {
                // Fetch Organizations
                const orgsSnap = await getDocs(query(collection(db, 'organizations'), orderBy('createdAt', 'desc'), limit(50)));
                const orgs = orgsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as OrganizationSummary[];

                setOrganizations(orgs);

                // Fetch basic stats (approximate)
                const usersSnap = await getDocs(collection(db, 'users'));

                setStats({
                    totalOrgs: orgs.length,
                    totalUsers: usersSnap.size
                });

            } catch (error) {
                ErrorLogger.error(error, 'AdminDashboard.fetchData');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isSuperAdmin]);

    if (checkingAuth) return <LoadingScreen />;

    if (!isSuperAdmin) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accès Refusé</h1>
                    <p className="text-slate-500 mt-2">Vous n'avez pas les droits Super Admin.</p>
                </div>
            </div>
        );
    }

    if (loading) return <LoadingScreen />;

    return (
        <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Super Admin Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400">Vue globale de l'instance Sentinel GRC</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600">
                            <Building className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Organisations</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalOrgs}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600">
                            <Users className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Utilisateurs Total</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalUsers}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600">
                            <Activity className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Santé Système</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">Opérationnel</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tenants Table */}
            <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
                <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Organisations Récentes</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Nom</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Plan</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Création</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                            {organizations.map(org => (
                                <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{org.name}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${org.planId === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                                            org.planId === 'professional' ? 'bg-blue-100 text-blue-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                            {org.planId || 'discovery'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-brand-600 hover:text-brand-700 text-sm font-medium">
                                            Gérer
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
