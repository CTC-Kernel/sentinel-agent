import React, { useEffect, useState } from 'react';
import { AdminService, AuditLog } from '../../../services/adminService';
import { Search, User, Clock, Info, Download } from '../../../components/ui/Icons';
import { ErrorLogger } from '../../../services/errorLogger';
import { useStore } from '../../../store';

export const AuditLogList: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { user } = useStore();

    useEffect(() => {
        if (user?.organizationId) loadLogs();
    }, [user?.organizationId]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await AdminService.getAuditLogs(user?.organizationId || '');
            setLogs(data);
        } catch (error) {
            ErrorLogger.error(error, 'AuditLogList.fetchLogs');
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log =>
        log.actorEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.targetId.includes(searchTerm)
    );

    const getActionColor = (action: string) => {
        if (action.includes('SUSPEND') || action.includes('DELETE')) return 'text-red-400 bg-red-50 dark:bg-red-900/30 border-red-500/20';
        if (action.includes('ACTIVATE') || action.includes('CREATE')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (action.includes('UPDATE') || action.includes('EDIT')) return 'text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-500/20';
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    };

    const handleExport = () => {
        if (logs.length === 0) return;

        const headers = ['Timestamp', 'Actor ID', 'Actor Email', 'Action', 'Target ID', 'Metadata'];
        const csvContent = [
            headers.join(','),
            ...logs.map(log => [
                new Date(log.timestamp).toISOString(),
                log.actorId,
                log.actorEmail || '',
                log.action,
                log.targetId,
                `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"` // Escape quotes for CSV
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search logs (Actor, Action, ID)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus-visible:ring-brand-400 text-sm focus:bg-slate-900 transition-colors text-white"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        disabled={logs.length === 0}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600"
                        title="Export CSV"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    <button
                        onClick={loadLogs}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition-colors"
                        title="Refresh"
                    >
                        <Clock className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 text-xs uppercase text-slate-500 dark:text-slate-300 font-semibold bg-slate-900/80 backdrop-blur-sm sticky top-0">
                                <th className="px-6 py-4 whitespace-nowrap">Timestamp</th>
                                <th className="px-6 py-4 whitespace-nowrap">Actor</th>
                                <th className="px-6 py-4 whitespace-nowrap">Action</th>
                                <th className="px-6 py-4 whitespace-nowrap">Target ID</th>
                                <th className="px-6 py-4 whitespace-nowrap text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={5} className="px-6 py-4">
                                            <div className="h-6 bg-slate-800/50 rounded animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : filteredLogs.length > 0 ? (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 text-sm text-muted-foreground font-mono">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <User className="w-3 h-3 mr-2 text-slate-500" />
                                                <span className="text-sm text-white font-medium">{log.actorEmail || log.actorId}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getActionColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                            {log.targetId}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="group relative inline-block text-left">
                                                <Info className="w-4 h-4 text-slate-500 dark:text-slate-300 hover:text-white cursor-pointer" />
                                                <div className="absolute right-0 mt-2 w-64 origin-top-right bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 z-10 hidden group-hover:block">
                                                    <pre className="text-[11px] text-slate-300 whitespace-pre-wrap overflow-auto max-h-48">
                                                        {JSON.stringify(log.metadata, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        No audit logs found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
