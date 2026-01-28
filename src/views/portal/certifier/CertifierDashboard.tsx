import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import { Loader2, Building2, FileCheck, Clock, CheckCircle, Search, ChevronRight, LogOut, Shield } from '../../../components/ui/Icons';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from '@/lib/toast';
import { signOut } from 'firebase/auth';
import { auth } from '../../../firebase';

interface Client {
    id: string;
    tenantName: string;
    contactEmail: string;
    status: string;
}

interface AssignedAudit {
    shareId: string; // The token
    auditId: string;
    auditName: string;
    tenantName: string;
    status: string;
    assignedAt: string;
}

export const CertifierDashboard: React.FC = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{ clients: Client[], assignments: AssignedAudit[] } | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const loadDashboard = async () => {
            // Basic auth check
            if (!auth.currentUser) {
                navigate('/portal/login');
                return;
            }

            try {
                const getDashboardFn = httpsCallable(functions, 'getCertifierDashboard');
                const result = await getDashboardFn();
                setData(result.data as { clients: Client[], assignments: AssignedAudit[] });
            } catch {
                toast.error(t('common.errors.loading'));
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [navigate, t]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/portal/login');
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
                <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
            </div>
        );
    }

    if (!data) return null;

    const stats = [
        { label: t('certifier.dashboard.activeClients'), value: data.clients.length, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: t('certifier.dashboard.activeAudits'), value: data.assignments.filter(a => a.status !== 'Validé').length, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' },
        { label: t('certifier.dashboard.certifiedAudits'), value: data.assignments.filter(a => a.status === 'Validé').length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans">
            {/* Top Bar */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-white/5 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white text-lg">Sentinel <span className="text-brand-600">Certifier</span></span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-sm text-right hidden sm:block">
                            <p className="text-slate-900 dark:text-white font-medium">{auth.currentUser?.email}</p>
                            <p className="text-slate-500 text-xs">{t('certifier.dashboard.role')}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-muted-foreground hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            title="Se déconnecter"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-white/5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-300 mb-1">{stat.label}</p>
                                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                                </div>
                                <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content - Audits List */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('certifier.dashboard.assignedAudits')}</h2>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder={t('certifier.dashboard.searchPlaceholder')}
                                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus-visible:ring-brand-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                            {data.assignments.length > 0 ? (
                                <div className="divide-y divide-slate-100 dark:divide-white/5">
                                    {data.assignments.map((audit) => (
                                        <Link
                                            key={audit.shareId}
                                            to={`/portal/audit/${audit.shareId}`}
                                            className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-2 bg-brand-50 dark:bg-brand-800 text-brand-600 rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all">
                                                        <FileCheck className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">{audit.auditName}</h3>
                                                        <p className="text-sm text-slate-500 dark:text-slate-300 flex items-center gap-2">
                                                            <Building2 className="w-3 h-3" />
                                                            {audit.tenantName}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${audit.status === 'Validé' ? 'bg-green-50 text-green-700 dark:text-green-400 border-green-200' :
                                                        audit.status === 'En cours' ? 'bg-blue-50 text-blue-700 dark:text-blue-400 border-blue-200' :
                                                            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                                        }`}>
                                                        {audit.status}
                                                    </span>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-brand-500" />
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-slate-500">
                                    <FileCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                    <p>{t('certifier.dashboard.noAudits')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - Clients */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('certifier.dashboard.myClients')}</h2>
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5 p-4 shadow-sm">
                            {data.clients.length > 0 ? (
                                <div className="space-y-3">
                                    {data.clients.map(client => (
                                        <div key={client.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold text-xs">
                                                    {client.tenantName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm text-slate-900 dark:text-white">{client.tenantName}</p>
                                                    <p className="text-xs text-slate-500">{client.contactEmail}</p>
                                                </div>
                                            </div>
                                            <div className="w-2 h-2 rounded-full bg-green-500" title="Actif" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-sm text-slate-500">
                                    {t('certifier.dashboard.noClients')}
                                </div>
                            )}

                            <button className="w-full mt-4 py-2 text-sm text-brand-600 font-medium hover:bg-brand-50 dark:hover:bg-brand-800 rounded-lg transition-colors dashed border border-brand-200">
                                {t('certifier.dashboard.inviteClient')}
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
