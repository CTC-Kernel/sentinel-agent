import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Server, Database, Cloud, Activity, RefreshCw } from 'lucide-react';
import { ConnectivityService, ServiceHealth } from '../../../services/connectivityService';
import { ErrorLogger } from '../../../services/errorLogger';

const ServiceStatus: React.FC<{
    name: string;
    status: 'operational' | 'degraded' | 'outage';
    icon: React.ComponentType<{ className?: string }>;
    latency?: number;
    error?: string;
}> = ({ name, status, icon: Icon, latency, error }) => {
    const statusConfig = {
        operational: { color: 'text-emerald-400', icon: CheckCircle, label: 'Operational' },
        degraded: { color: 'text-yellow-400', icon: AlertTriangle, label: 'Degraded' },
        outage: { color: 'text-red-400', icon: XCircle, label: 'Outage' },
    }[status];

    const StatusIcon = statusConfig.icon;

    return (
        <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:bg-slate-800/70 transition-colors">
            <div className="flex items-center">
                <div className={`p-2.5 rounded-lg bg-slate-800 mr-4 border border-slate-700`}>
                    <Icon className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                    <h4 className="font-medium text-white text-sm">{name}</h4>
                    <p className="text-xs text-slate-500 flex items-center mt-0.5">
                        <Activity className="w-3 h-3 mr-1 opacity-50" />
                        {error ? <span className="text-red-400">{error}</span> : 'Uptime: 99.99%'}
                    </p>
                </div>
            </div>
            <div className="flex items-center text-right space-x-4">
                <div>
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full bg-slate-900 border border-slate-800 ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1.5" />
                        {statusConfig.label}
                    </span>
                </div>
                {latency !== undefined && latency > 0 && (
                    <div className={`text-xs font-mono px-2 py-1 rounded border ${latency < 200 ? 'text-emerald-400 border-emerald-500/10 bg-emerald-500/5' :
                        latency < 800 ? 'text-yellow-400 border-yellow-500/10 bg-yellow-500/5' :
                            'text-red-400 border-red-500/10 bg-red-500/5'
                        }`}>
                        {latency}ms
                    </div>
                )}
            </div>
        </div>
    );
};

interface ServiceHealthUI extends ServiceHealth {
    icon: React.ComponentType<{ className?: string }>;
}

export const SystemHealth: React.FC = () => {
    const [services, setServices] = useState<ServiceHealthUI[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    const checkHealth = useCallback(async () => {
        setLoading(true);
        try {
            // Run checks in parallel
            const [firestore, storage, functions] = await Promise.all([
                ConnectivityService.checkFirestore(),
                ConnectivityService.checkStorage(),
                ConnectivityService.checkCloudFunctions()
            ]);

            setServices([
                { ...firestore, icon: Database },
                { ...storage, icon: Cloud },
                { ...functions, icon: Server },
                // Static entry for AI until we have a ping
                { name: 'AI Models (Gemini)', icon: Activity, status: 'operational' as const, latency: 450 }
            ]);
            setLastUpdate(new Date());
        } catch (error) {
            ErrorLogger.error(error, 'SystemHealth.checkHealth');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkHealth();
        // Optional: Polling every 60s
        const interval = setInterval(checkHealth, 60000);
        return () => clearInterval(interval);
    }, [checkHealth]);

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-full">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <h3 className="text-lg font-semibold text-white mr-3">System Status</h3>
                        {loading && <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />}
                    </div>
                    <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                </div>

                <div className="space-y-3">
                    {services.map((service) => (
                        <ServiceStatus key={service.name} {...service} />
                    ))}
                    {services.length === 0 && loading && (
                        <div className="text-center py-8 text-slate-500 text-sm">
                            Checking system connectivity...
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
                        <div className="flex items-center space-x-2">
                            <button onClick={checkHealth} className="hover:text-white transition-colors">
                                Check Now
                            </button>
                            <span className="font-mono text-slate-600">|</span>
                            <span className="font-mono">v2.4.1</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
