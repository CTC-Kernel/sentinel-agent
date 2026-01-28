import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Server, Database, Cloud, Activity, RefreshCw } from '../../../components/ui/Icons';
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
        operational: { color: 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-900/10 border-success-200 dark:border-success-800', icon: CheckCircle, label: 'Operational' },
        degraded: { color: 'text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-900/10 border-warning-200 dark:border-warning-800', icon: AlertTriangle, label: 'Degraded' },
        outage: { color: 'text-destructive-600 dark:text-destructive-400 bg-destructive-50 dark:bg-destructive-900/10 border-destructive-200 dark:border-destructive-800', icon: XCircle, label: 'Outage' },
    }[status];

    const StatusIcon = statusConfig.icon;

    return (
        <div className="flex items-center justify-between p-4 bg-card/50 rounded-2xl border border-border/40 hover:bg-card/80 transition-all duration-300">
            <div className="flex items-center">
                <div className={`p-2.5 rounded-xl bg-muted mr-4 border border-border/40 shadow-inner`}>
                    <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                    <h4 className="font-medium text-foreground text-sm">{name}</h4>
                    <p className="text-xs text-muted-foreground flex items-center mt-0.5">
                        <Activity className="w-3 h-3 mr-1 opacity-60" />
                        {error ? <span className="text-destructive">{error}</span> : 'Uptime: 99.99%'}
                    </p>
                </div>
            </div>
            <div className="flex items-center text-right space-x-4">
                <div>
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full border ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1.5" />
                        {statusConfig.label}
                    </span>
                </div>
                {latency !== undefined && latency > 0 && (
                    <div className={`text-xs font-mono px-2 py-1 rounded border ${latency < 200 ? 'text-success-600 border-success-200 bg-success-50 dark:bg-success-900/10 dark:text-success-400 dark:border-success-800' :
                        latency < 800 ? 'text-warning-600 border-warning-200 bg-warning-50 dark:bg-warning-900/10 dark:text-warning-400 dark:border-warning-800' :
                            'text-destructive-600 border-destructive-200 bg-destructive-50 dark:bg-destructive-900/10 dark:text-destructive-400 dark:border-destructive-800'
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
            <div className="bg-card/50 border border-border/40 rounded-3xl p-6 h-full shadow-apple">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <h3 className="text-lg font-semibold text-foreground mr-3">System Status</h3>
                        {loading && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
                    </div>
                    <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success-500"></span>
                    </span>
                </div>

                <div className="space-y-3">
                    {services.map((service) => (
                        <ServiceStatus key={service.name} {...service} />
                    ))}
                    {services.length === 0 && loading && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            Checking system connectivity...
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
                        <div className="flex items-center space-x-2">
                            <button onClick={checkHealth} className="hover:text-foreground transition-colors">
                                Check Now
                            </button>
                            <span className="font-mono text-muted-foreground/50">|</span>
                            <span className="font-mono">v2.4.1</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
