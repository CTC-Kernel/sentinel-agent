import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { orderBy, limit } from 'firebase/firestore';
import { useFirestoreCollection } from '../hooks/useFirestore';

import { UserProfile } from '../types';
import { useStore } from '../store';
import { ShieldAlert, Users, Building, Activity, Search } from 'lucide-react';
import { LoadingScreen } from '../components/ui/LoadingScreen';

import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { useAdminActions } from '../hooks/useAdminActions';

interface OrganizationSummary {
    id: string;
    name: string;
    planId: string;
    createdAt: string;
    userCount?: number;
}

export const AdminDashboard: React.FC = () => {
    const { user } = useStore();
    const { t } = useTranslation();
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Use the custom hook for admin actions
    const { verifySuperAdmin, handleManage, switchingOrg } = useAdminActions();

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
        const checkAdmin = async () => {
            if (user) {
                const isAdmin = await verifySuperAdmin();
                setIsSuperAdmin(isAdmin);
            }
            setCheckingAuth(false);
        };

        checkAdmin();
    }, [user, verifySuperAdmin]);

    if (checkingAuth) return <LoadingScreen />;

    if (!isSuperAdmin) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('admin.accessDenied')}</h1>
                    <p className="text-slate-600 mt-2">{t('admin.accessDeniedDesc')}</p>
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
                title={t('admin.dashboard')}
                subtitle={t('admin.subtitle')}
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
                            <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.stats.orgs')}</p>
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
                            <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.stats.users')}</p>
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
                            <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.stats.health')}</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{t('admin.stats.operational')}</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Tenants Table */}
            <motion.div variants={slideUpVariants} className="space-y-6">
                {/* Search Bar - Premium Glass Design */}
                <div className="flex flex-col md:flex-row gap-4 p-1.5 bg-white/60 dark:bg-slate-950/60 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-xl">
                    <div className="relative flex-1 min-w-0 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                        <input
                            type="text"
                            placeholder={t('admin.orgs.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-transparent rounded-xl border-none focus:ring-0 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                        />
                    </div>
                </div>

                <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
                    <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50/50 dark:bg-white/5">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('admin.orgs.title')} ({filteredOrgs.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('admin.orgs.name')}</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('admin.orgs.plan')}</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('admin.orgs.created')}</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('admin.orgs.actions')}</th>
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
                                                {switchingOrg === org.id ? t('admin.orgs.switching') : t('admin.orgs.manage')}
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
