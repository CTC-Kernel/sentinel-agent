import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';

import { GlobalMetrics } from './components/GlobalMetrics';
import { TenantList } from './components/TenantList';
import { UserManagement } from './components/UserManagement';
import { SystemHealth } from './components/SystemHealth';
import { AuditLogList } from './components/AuditLogList';

const AdminDashboard: React.FC = () => {
 const { user, t } = useStore();
 const navigate = useNavigate();
 const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'users' | 'system' | 'audit'>('overview');

 useEffect(() => {
 if (user?.role !== 'super_admin') {
 navigate('/dashboard');
 }
 }, [user, navigate]);

 if (user?.role !== 'super_admin') {
 return <div className="p-8 text-center text-red-500">{t('common.accessDenied', { defaultValue: 'Access Denied' })}</div>;
 }

 return (
 <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
 <header>
 <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary/80 to-blue-600">
  Super Admin Console
 </h1>
 <p className="text-muted-foreground mt-2">
  Supervision globale de l'instance et gestion multi-tenant.
 </p>
 </header>

 {/* Navigation Tabs */}
 <div className="flex space-x-2 border-b border-border/40 pb-4 overflow-x-auto no-scrollbar">
 {(['overview', 'tenants', 'users', 'system', 'audit'] as const).map((tab) => (
  <button
  key={tab || 'unknown'}
  onClick={() => setActiveTab(tab)}
  className={cn(
  "px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all whitespace-nowrap",
  activeTab === tab
  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 border-transparent"
  : "text-muted-foreground hover:text-foreground/60 hover:bg-muted/50 dark:hover:bg-muted/50"
  )}
  >
  {tab.charAt(0).toUpperCase() + tab.slice(1)}
  </button>
 ))}
 </div>

 <div className="min-h-[400px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
 {activeTab === 'overview' && <GlobalMetrics />}
 {activeTab === 'tenants' && <TenantList />}
 {activeTab === 'users' && <UserManagement />}
 {activeTab === 'system' && <SystemHealth />}
 {activeTab === 'audit' && <AuditLogList />}
 </div>
 </div>
 );
};

export default AdminDashboard;
