import React, { useState } from 'react';

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
            <div className="flex space-x-4 border-b border-white/10 pb-4 overflow-x-auto">
                {(['overview', 'tenants', 'users', 'system', 'audit'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab
                            ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                            : 'text-muted-foreground hover:text-white hover:bg-white/5'
                            }`}
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
