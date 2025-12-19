import React, { useEffect, useState } from 'react';
import { orderBy, limit } from 'firebase/firestore';
import { useFirestoreCollection } from '../hooks/useFirestore';

import { UserProfile } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { ShieldAlert, Users, Building, Activity, Search } from 'lucide-react';
import { LoadingScreen } from '../components/ui/LoadingScreen';

import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../firebase';
import { toast } from 'sonner';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';

interface OrganizationSummary {
    id: string;
    name: string;
    planId: string;
    createdAt: string;
    userCount?: number;
}

export const AdminDashboard: React.FC = () => {
    const { user } = useStore();
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [switchingOrg, setSwitchingOrg] = useState<string | null>(null);

    const { data: organizations, loading: orgsLoading } = useFirestoreCollection<OrganizationSummary>(
        'organizations',
        [orderBy('createdAt', 'desc'), limit(1000)],
        { logError: true, realtime: true, enabled: isSuperAdmin }
    );

    const { data: users, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [],
        { logError: true, realtime: true, enabled: isSuperAdmin }
    );

    const filteredOrgs = organizations.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        totalOrgs: organizations.length,
        totalUsers: users.length
    };

    const loading = checkingAuth || (isSuperAdmin && (orgsLoading || usersLoading));

    useEffect(() => {
        const verifySuperAdmin = async () => {
            try {
                const functions = getFunctions();
                // Check if user has superAdmin claim OR check via backend function
                // We use a backend check to be sure
                const checkAdmin = httpsCallable(functions, 'verifySuperAdmin');
                const result = await checkAdmin();
                const data = result.data as { isSuperAdmin: boolean };

                if (data.isSuperAdmin) {
                    setIsSuperAdmin(true);
                } else {
                    setIsSuperAdmin(false);
                }
            } catch (error) {
                // If it fails (e.g. not found), check custom claim or just assume false
                // But we can check context claim too?
                // For now stick to existing logic but safe check
                ErrorLogger.error(error, 'AdminDashboard.verifySuperAdmin');
                setIsSuperAdmin(false);
            } finally {
                setCheckingAuth(false);
            }
        };

        if (user) {
            verifySuperAdmin();
        } else {
            setCheckingAuth(false);
        }
    }, [user]);

    const handleManage = async (orgId: string, orgName: string) => {
        setSwitchingOrg(orgId);
        try {
            const functions = getFunctions();
            const switchOrgFn = httpsCallable(functions, 'switchOrganization');
            await switchOrgFn({ targetOrgId: orgId });

            // Force token refresh to pick up new claims
            if (auth.currentUser) {
                await auth.currentUser.getIdToken(true);
            }

            toast.success(`Switched to ${orgName} `);
            // Redirect to dashboard
            window.location.href = '/';
        } catch (error) {
            ErrorLogger.error(error, 'AdminDashboard.handleManage');
            toast.error("Failed to switch organization");
            setSwitchingOrg(null);
        }
    };


    if (checkingAuth) return <LoadingScreen />;

    if (!isSuperAdmin) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accès Refusé</h1>
                    <p className="text-slate-600 mt-2">Vous n'avez pas les droits Super Admin.</p>
                </div>
            </div>
        );
    }

    if (loading) return <LoadingScreen />;

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO title="Super Admin Dashboard" description="Vue globale de l'instance Sentinel GRC" />

            <PageHeader
                title="Super Admin Dashboard"
                subtitle="Vue globale de l'instance Sentinel GRC, gestion des organisations et maintenance."
                breadcrumbs={[{ label: 'Admin', path: '/admin' }]}
                icon={<ShieldAlert className="h-6 w-6 text-white" strokeWidth={2.5} />}
            />

            {/* Stats Cards */}
            <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600">
                            <Building className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Organisations</p>
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
                            <p className="text-sm text-slate-600 dark:text-slate-400">Utilisateurs Total</p>
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
                            <p className="text-sm text-slate-600 dark:text-slate-400">Santé Système</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">Opérationnel</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Tenants Table */}
            <motion.div variants={slideUpVariants} className="space-y-6">
                {/* Search Bar - Premium Glass Design */}
                <div className="flex flex-col md:flex-row gap-4 p-1.5 bg-white/60 dark:bg-[#0B1120]/60 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-xl">
                    <div className="relative flex-1 min-w-0 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Rechercher une organisation..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-transparent rounded-xl border-none focus:ring-0 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                        />
                    </div>
                </div>

                <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
                    <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Organisations ({filteredOrgs.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nom</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Création</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredOrgs.map(org => (
                                    <tr key={org.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors group">
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{org.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${org.planId === 'enterprise' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30' :
                                                org.planId === 'professional' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30' :
                                                    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-600'
                                                } `}>
                                                {org.planId || 'discovery'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                                            {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleManage(org.id, org.name)}
                                                disabled={switchingOrg === org.id}
                                                className="px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-brand-50 dark:hover:bg-brand-500/20 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-200 dark:hover:border-brand-500/30 transition-all disabled:opacity-50 shadow-sm"
                                            >
                                                {switchingOrg === org.id ? '...' : 'Gérer'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
