import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { X, Users, Database, Shield, AlertTriangle, CreditCard, Save } from '../../../components/ui/Icons';
import { Organization, PlanType } from '../../../types';
import { AdminService } from '../../../services/adminService';
import { toast } from '../../../lib/toast';
import { ErrorLogger } from '../../../services/errorLogger';

interface TenantDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    tenant: Organization | null;
    onUpdate: () => void;
}

export const TenantDetailModal: React.FC<TenantDetailModalProps> = ({ isOpen, onClose, tenant, onUpdate }) => {
    const [stats, setStats] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Subscription Form State
    const [plan, setPlan] = useState<PlanType>('discovery');
    const [maxUsers, setMaxUsers] = useState(0);
    const [maxProjects, setMaxProjects] = useState(0);

    const loadStats = useCallback(async () => {
        if (!tenant) return;
        setLoading(true);
        try {
            const data = await AdminService.getTenantStats(tenant.id);
            setStats(data);
        } catch (error) {
            ErrorLogger.error(error, 'TenantDetailModal.loadStats');
            toast.error("Failed to load stats");
        } finally {
            setLoading(false);
        }
    }, [tenant]);

    useEffect(() => {
        if (isOpen && tenant) {
            loadStats();
            // Initialize form
            setPlan((tenant?.subscription?.planId as PlanType) || 'discovery');
            // We try to access custom limits if they exist, otherwise default to 0 or we could fetch plan defaults
            // Type casting to access dynamic fields not in strict Organization type yet
            const customLimits = tenant.subscription.customLimits || {};
            setMaxUsers(customLimits.maxUsers || 5); // Default fallback
            setMaxProjects(customLimits.maxProjects || 1);
        }
    }, [isOpen, tenant, loadStats]);

    const handleToggleStatus = async () => {
        if (!tenant) return;
        const newStatus = !tenant.isActive;
        if (!window.confirm(`Are you sure you want to ${newStatus ? 'activate' : 'suspend'} this tenant?`)) return;

        setProcessing(true);
        try {
            await AdminService.toggleTenantStatus(tenant.id, newStatus);
            toast.success(`Tenant ${newStatus ? 'activated' : 'suspended'} successfully`);
            onUpdate();
            onClose();
        } catch {
            toast.error("Status update failed");
        } finally {
            setProcessing(false);
        }
    };

    const handleSaveSubscription = async () => {
        if (!tenant) return;
        setProcessing(true);
        try {
            await AdminService.updateTenantSubscription(tenant.id, plan, {
                maxUsers,
                maxProjects
            });
            toast.success("Subscription updated successfully");
            onUpdate();
        } catch {
            toast.error("Update failed");
        } finally {
            setProcessing(false);
        }
    };

    if (!tenant) return null;
    const isTenantActive = tenant.isActive !== false;

    return (
        <Transition show={isOpen} as={React.Fragment}>
            <Dialog onClose={onClose} className="relative z-50">
                <Transition.Child
                    as={React.Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Transition.Child
                        as={React.Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0 scale-95"
                        enterTo="opacity-100 scale-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100 scale-100"
                        leaveTo="opacity-0 scale-95"
                    >
                        <Dialog.Panel className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                                        {tenant.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <Dialog.Title className="text-xl font-bold text-white mb-0.5">
                                            {tenant.name}
                                        </Dialog.Title>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-sm text-slate-400 font-mono">{tenant.id}</span>
                                            <span className={`px-2 py-0.5 text-[10px] rounded-full uppercase font-bold tracking-wide ${isTenantActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                                }`}>
                                                {isTenantActive ? 'Active' : 'Suspended'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <Tab.Group>
                                <div className="border-b border-slate-800 bg-slate-900/50 px-6">
                                    <Tab.List className="flex space-x-6">
                                        {['Overview', 'Subscription'].map((category) => (
                                            <Tab
                                                key={category}
                                                className={({ selected }) =>
                                                    `py-4 text-sm font-medium border-b-2 transition-colors focus:outline-none ${selected
                                                        ? 'border-brand-500 text-brand-400'
                                                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                                    }`
                                                }
                                            >
                                                {category}
                                            </Tab>
                                        ))}
                                    </Tab.List>
                                </div>

                                <Tab.Panels className="p-6 overflow-y-auto custom-scrollbar">
                                    {/* Overview Panel */}
                                    <Tab.Panel className="space-y-8 focus:outline-none">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 flex items-center">
                                                    <Users className="w-3 h-3 mr-1.5" /> Users
                                                </p>
                                                {loading ? (
                                                    <div className="h-6 w-12 bg-slate-700 rounded animate-pulse" />
                                                ) : (
                                                    <p className="text-2xl font-bold text-white">{(stats?.userCount as number) || 0}</p>
                                                )}
                                            </div>
                                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 flex items-center">
                                                    <Shield className="w-3 h-3 mr-1.5" /> Projects
                                                </p>
                                                {loading ? (
                                                    <div className="h-6 w-12 bg-slate-700 rounded animate-pulse" />
                                                ) : (
                                                    <p className="text-2xl font-bold text-white">{(stats?.projectCount as number) || 0}</p>
                                                )}
                                            </div>
                                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 flex items-center">
                                                    <Database className="w-3 h-3 mr-1.5" /> Storage
                                                </p>
                                                <p className="text-2xl font-bold text-white">--</p>
                                            </div>
                                        </div>

                                        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
                                            <h4 className="text-red-400 font-medium flex items-center mb-4">
                                                <AlertTriangle className="w-4 h-4 mr-2" />
                                                Danger Zone
                                            </h4>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-slate-300 font-medium">Suspend Organization</p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Stop all access immediately.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handleToggleStatus}
                                                    disabled={processing}
                                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-colors"
                                                >
                                                    {isTenantActive ? 'Suspend' : 'Activate'}
                                                </button>
                                            </div>
                                        </div>
                                    </Tab.Panel>

                                    {/* Subscription Panel */}
                                    <Tab.Panel className="space-y-6 focus:outline-none">
                                        <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
                                            <h3 className="text-lg font-medium text-white mb-4 flex items-center">
                                                <CreditCard className="w-5 h-5 mr-2 text-brand-400" />
                                                Plan & Quotas
                                            </h3>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Current Plan</label>
                                                    <select
                                                        value={plan}
                                                        onChange={(e) => setPlan(e.target.value as PlanType)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                                    >
                                                        <option value="discovery">Discovery (Free)</option>
                                                        <option value="professional">Professional</option>
                                                        <option value="enterprise">Enterprise</option>
                                                    </select>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Max Users</label>
                                                        <input
                                                            type="number"
                                                            value={maxUsers}
                                                            onChange={(e) => setMaxUsers(parseInt(e.target.value))}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-400 mb-1.5">Max Projects</label>
                                                        <input
                                                            type="number"
                                                            value={maxProjects}
                                                            onChange={(e) => setMaxProjects(parseInt(e.target.value))}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-6 flex justify-end">
                                                <button
                                                    onClick={handleSaveSubscription}
                                                    disabled={processing}
                                                    className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Save className="w-4 h-4 mr-2" />
                                                    Save Changes
                                                </button>
                                            </div>
                                        </div>
                                    </Tab.Panel>
                                </Tab.Panels>
                            </Tab.Group>
                        </Dialog.Panel>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    );
};
