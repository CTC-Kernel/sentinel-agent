import React, { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Organization } from '../../../types';
import { ErrorLogger } from '../../../services/errorLogger';
import { Search, Filter, MoreVertical, ExternalLink, Shield } from 'lucide-react';
import { TenantDetailModal } from './TenantDetailModal';

export const TenantList: React.FC = () => {
    const [tenants, setTenants] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTenant, setSelectedTenant] = useState<Organization | null>(null);

    const fetchTenants = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'organizations'), orderBy('createdAt', 'desc'), limit(50));
            const snapshot = await getDocs(q);
            // Safe casting or validation would be better here in prod
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
            setTenants(data);
        } catch (err) {
            ErrorLogger.error(err as Error, 'TenantList.fetchTenants');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTenants();
    }, [fetchTenants]);

    const filteredTenants = tenants.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id.includes(searchTerm)
    );

    const handleTenantUpdate = async () => {
        await fetchTenants();
    };

    if (loading && tenants.length === 0) return (
        <div className="space-y-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
            ))}
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search tenants..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-sm focus:bg-slate-900 transition-colors text-white"
                    />
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors flex items-center text-slate-300">
                        <Filter className="w-4 h-4 mr-2" />
                        Filter
                    </button>
                    <button className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-brand-500/20">
                        Add Tenant
                    </button>
                </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold bg-slate-900/80 backdrop-blur-sm sticky top-0">
                            <th className="px-6 py-4">Organization</th>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Created</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {filteredTenants.map((tenant) => (
                            <tr
                                key={tenant.id}
                                className="hover:bg-white/5 transition-colors group cursor-pointer"
                                onClick={() => setSelectedTenant(tenant)}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold mr-3 shadow-lg shrink-0">
                                            {tenant.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{tenant.name}</div>
                                            <div className="text-xs text-slate-400 flex items-center mt-0.5">
                                                <Shield className="w-3 h-3 mr-1" />
                                                {(tenant.subscription?.planId as string) === 'enterprise' ? 'Enterprise' :
                                                    (tenant.subscription?.planId as string) === 'professional' ? 'Professional' : 'Discovery'}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-slate-400">
                                    {tenant.id}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${tenant.isActive !== false
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>
                                        {tenant.isActive !== false ? 'Active' : 'Suspended'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-400">
                                    {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                            title="Manage Tenant"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedTenant(tenant);
                                            }}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredTenants.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    No tenants found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <TenantDetailModal
                isOpen={!!selectedTenant}
                onClose={() => setSelectedTenant(null)}
                tenant={selectedTenant}
                onUpdate={handleTenantUpdate}
            />
        </div>
    );
};
