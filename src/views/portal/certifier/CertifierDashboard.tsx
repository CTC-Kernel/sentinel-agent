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
 <div className="flex h-screen items-center justify-center bg-muted">
 <Loader2 className="w-10 h-10 text-primary animate-spin" />
 </div>
 );
 }

 if (!data) return null;

 const stats = [
 { label: t('certifier.dashboard.activeClients'), value: data.clients.length, icon: Building2, color: 'text-info-text', bg: 'bg-info-bg' },
 { label: t('certifier.dashboard.activeAudits'), value: data.assignments.filter(a => a.status !== 'Validé').length, icon: Clock, color: 'text-warning-text', bg: 'bg-warning-bg' },
 { label: t('certifier.dashboard.certifiedAudits'), value: data.assignments.filter(a => a.status === 'Validé').length, icon: CheckCircle, color: 'text-success-text', bg: 'bg-success-bg' },
 ];

 return (
 <div className="min-h-screen bg-muted font-sans">
 {/* Top Bar */}
 <header className="bg-card border-b border-border dark:border-white/5 sticky top-0 z-30">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
  <div className="flex items-center gap-3">
  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
  <Shield className="w-5 h-5 text-white" />
  </div>
  <span className="font-bold text-foreground text-lg">Sentinel <span className="text-primary">Certifier</span></span>
  </div>

  <div className="flex items-center gap-4">
  <div className="text-sm text-right hidden sm:block">
  <p className="text-foreground font-medium">{auth.currentUser?.email}</p>
  <p className="text-muted-foreground text-xs">{t('certifier.dashboard.role')}</p>
  </div>
  <button
  onClick={handleLogout}
  className="p-2 text-muted-foreground hover:text-muted-foreground hover:bg-muted rounded-full transition-colors"
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
  <div key={i || 'unknown'} className="bg-card rounded-xl p-6 border border-border dark:border-white/5 shadow-sm">
  <div className="flex items-center justify-between">
  <div>
   <p className="text-sm font-medium text-muted-foreground mb-1">{stat.label}</p>
   <p className="text-3xl font-bold text-foreground">{stat.value}</p>
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
  <h2 className="text-xl font-bold text-foreground">{t('certifier.dashboard.assignedAudits')}</h2>
  <div className="relative w-64">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
  <input
   type="text"
   placeholder={t('certifier.dashboard.searchPlaceholder')}
   className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:ring-2 focus-visible:ring-primary outline-none"
  />
  </div>
  </div>

  <div className="bg-card rounded-xl border border-border dark:border-white/5 overflow-hidden shadow-sm">
  {data.assignments.length > 0 ? (
  <div className="divide-y divide-border dark:divide-white/5">
   {data.assignments.map((audit) => (
   <Link
   key={audit.shareId || 'unknown'}
   to={`/portal/audit/${audit.shareId}`}
   className="block p-4 hover:bg-muted/50 transition-colors cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
   >
   <div className="flex items-center justify-between">
   <div className="flex items-start gap-4">
    <div className="p-2 bg-primary/10 dark:bg-primary text-primary rounded-lg group-hover:bg-white group-hover:shadow-sm transition-all">
    <FileCheck className="w-6 h-6" />
    </div>
    <div>
    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{audit.auditName}</h3>
    <p className="text-sm text-muted-foreground flex items-center gap-2">
    <Building2 className="w-3 h-3" />
    {audit.tenantName}
    </p>
    </div>
   </div>
   <div className="flex items-center gap-4">
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${audit.status === 'Validé' ? 'bg-green-50 text-green-700 dark:text-green-400 border-green-200' :
    audit.status === 'En cours' ? 'bg-info-bg text-info-text border-info-border' :
    'bg-muted text-muted-foreground border-border'
    }`}>
    {audit.status}
    </span>
    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
   </div>
   </div>
   </Link>
   ))}
  </div>
  ) : (
  <div className="p-12 text-center text-muted-foreground">
   <FileCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
   <p>{t('certifier.dashboard.noAudits')}</p>
  </div>
  )}
  </div>
  </div>

  {/* Sidebar - Clients */}
  <div className="space-y-6">
  <h2 className="text-xl font-bold text-foreground">{t('certifier.dashboard.myClients')}</h2>
  <div className="bg-card rounded-xl border border-border dark:border-white/5 p-4 shadow-sm">
  {data.clients.length > 0 ? (
  <div className="space-y-3">
   {data.clients.map(client => (
   <div key={client.id || 'unknown'} className="flex items-center justify-between p-3 rounded-lg border border-border/60 dark:border-white/5 hover:bg-muted/50 transition-colors">
   <div className="flex items-center gap-3">
   <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-bold text-xs">
    {client.tenantName.substring(0, 2).toUpperCase()}
   </div>
   <div>
    <p className="font-medium text-sm text-foreground">{client.tenantName}</p>
    <p className="text-xs text-muted-foreground">{client.contactEmail}</p>
   </div>
   </div>
   <div className="w-2 h-2 rounded-full bg-green-500" title="Actif" />
   </div>
   ))}
  </div>
  ) : (
  <div className="text-center py-6 text-sm text-muted-foreground">
   {t('certifier.dashboard.noClients')}
  </div>
  )}

  <button className="w-full mt-4 py-2 text-sm text-primary font-medium hover:bg-primary/10 dark:hover:bg-primary rounded-lg transition-colors dashed border border-primary/30">
  {t('certifier.dashboard.inviteClient')}
  </button>
  </div>
  </div>
 </div>
 </main>
 </div>
 );
};
