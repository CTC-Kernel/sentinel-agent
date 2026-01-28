import React, { useState } from 'react';
import { cn } from '../../lib/utils';

import { GlobalMetrics } from './components/GlobalMetrics';
import { TenantList } from './components/TenantList';
import { UserManagement } from './components/UserManagement';
import { SystemHealth } from './components/SystemHealth';
import { AuditLogList } from './components/AuditLogList';

const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'users' | 'system' | 'audit'>('overview');

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
            <header>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-400 to-blue-600">
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
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all whitespace-nowrap",
                            activeTab === tab
                                ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20 border-transparent"
                                : "text-slate-500 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                        )}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            <div className="min-h-[400px]">
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
