import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import ReactDiffViewer from 'react-diff-viewer-continued';
import {
    History,
    User,
    Calendar,
    Filter,
    Search,
    Download,
    Eye,
    ChevronRight,
    AlertCircle
} from '../ui/Icons';

interface AuditLog {
    id: string;
    action: 'create' | 'update' | 'delete';
    entityType: string;
    entityId: string;
    userId: string;
    userName: string;
    timestamp: Date;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    changes?: string[];
}

export const AuditTrailViewer: React.FC = () => {
    const { user } = useStore();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const [filters, setFilters] = useState({
        action: 'all' as 'all' | 'create' | 'update' | 'delete',
        entityType: 'all',
        userId: 'all',
        searchQuery: ''
    });
    const [dateRange, setDateRange] = useState({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
    });

    // Fetch audit logs
    useEffect(() => {
        if (!user?.organizationId) return;

        const fetchLogs = async () => {
            setLoading(true);
            try {
                const logsRef = collection(db, 'system_logs');
                const q = query(
                    logsRef,
                    where('organizationId', '==', user.organizationId),
                    orderBy('timestamp', 'desc'),
                    limit(500)
                );

                const snapshot = await getDocs(q);
                const fetchedLogs: AuditLog[] = [];

                snapshot.forEach(doc => {
                    const data = doc.data();
                    fetchedLogs.push({
                        id: doc.id,
                        action: data.action,
                        entityType: data.entityType,
                        entityId: data.entityId,
                        userId: data.userId,
                        userName: data.userName || 'Utilisateur inconnu',
                        timestamp: data.timestamp?.toDate() || new Date(),
                        before: data.before,
                        after: data.after,
                        changes: data.changes
                    });
                });

                setLogs(fetchedLogs);
            } catch (error) {
                ErrorLogger.error(error, 'AuditTrailViewer.fetchLogs');
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [user]);

    // Filter logs
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Action filter
            if (filters.action !== 'all' && log.action !== filters.action) return false;

            // Entity type filter
            if (filters.entityType !== 'all' && log.entityType !== filters.entityType) return false;

            // User filter
            if (filters.userId !== 'all' && log.userId !== filters.userId) return false;

            // Search query
            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                const searchableText = `${log.entityType} ${log.action} ${log.userName}`.toLowerCase();
                if (!searchableText.includes(query)) return false;
            }

            // Date range
            if (log.timestamp < dateRange.start || log.timestamp > dateRange.end) return false;

            return true;
        });
    }, [logs, filters, dateRange]);

    // Get unique entity types and users
    const entityTypes = useMemo(() => {
        return Array.from(new Set(logs.map(log => log.entityType)));
    }, [logs]);

    const users = useMemo(() => {
        return Array.from(new Set(logs.map(log => ({ id: log.userId, name: log.userName }))));
    }, [logs]);

    const getActionColor = (action: string) => {
        switch (action) {
            case 'create': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
            case 'update': return 'bg-blue-100 text-blue-700 dark:bg-slate-900/20 dark:text-blue-400';
            case 'delete': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'create': return '➕';
            case 'update': return '✏️';
            case 'delete': return '🗑️';
            default: return '📝';
        }
    };

    const handleExport = () => {
        const csv = [
            ['Date', 'Action', 'Type', 'Utilisateur', 'Modifications'].join(','),
            ...filteredLogs.map(log => [
                log.timestamp.toISOString(),
                log.action,
                log.entityType,
                log.userName,
                (log.changes || []).join('; ')
            ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Audit Trail
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Traçabilité complète de toutes les modifications
                    </p>
                </div>

                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:scale-105 transition-transform"
                >
                    <Download className="h-4 w-4" />
                    Exporter CSV
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={filters.searchQuery}
                            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                    </div>

                    {/* Action filter */}
                    <select
                        value={filters.action}
                        onChange={(e) => setFilters({ ...filters, action: e.target.value as 'all' | 'create' | 'update' | 'delete' })}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    >
                        <option value="all">Toutes les actions</option>
                        <option value="create">Création</option>
                        <option value="update">Modification</option>
                        <option value="delete">Suppression</option>
                    </select>

                    {/* Entity type filter */}
                    <select
                        value={filters.entityType}
                        onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    >
                        <option value="all">Tous les types</option>
                        {entityTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>

                    {/* User filter */}
                    <select
                        value={filters.userId}
                        onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                        className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    >
                        <option value="all">Tous les utilisateurs</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>

                {/* Date Range Filter */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="date"
                            value={dateRange.start.toISOString().split('T')[0]}
                            onChange={(e) => setDateRange({ ...dateRange, start: new Date(e.target.value) })}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                    </div>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="date"
                            value={dateRange.end.toISOString().split('T')[0]}
                            onChange={(e) => setDateRange({ ...dateRange, end: new Date(e.target.value) })}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Filter className="h-4 w-4" />
                    <span>{filteredLogs.length} événement(s) trouvé(s)</span>
                </div>
            </div>

            {/* Logs List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: List */}
                <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>Aucun événement trouvé</p>
                        </div>
                    ) : (
                        filteredLogs.map(log => (
                            <button
                                key={log.id}
                                onClick={() => setSelectedLog(log)}
                                className={`w-full text-left p-4 rounded-xl border transition-all ${selectedLog?.id === log.id
                                    ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 hover:border-brand-200 dark:hover:border-brand-800'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getActionColor(log.action)}`}>
                                            {getActionIcon(log.action)} {log.action.toUpperCase()}
                                        </span>
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            {log.entityType}
                                        </span>
                                    </div>
                                    <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${selectedLog?.id === log.id ? 'rotate-90' : ''}`} />
                                </div>

                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
                                    <User className="h-3 w-3" />
                                    <span>{log.userName}</span>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                                    <Calendar className="h-3 w-3" />
                                    <span>{log.timestamp.toLocaleString('fr-FR')}</span>
                                </div>

                                {log.changes && log.changes.length > 0 && (
                                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                                        {log.changes.length} modification(s)
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Right: Diff Viewer */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {selectedLog ? (
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Eye className="h-5 w-5" />
                                Détails de la modification
                            </h3>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action</span>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                                        {getActionIcon(selectedLog.action)} {selectedLog.action.toUpperCase()}
                                    </p>
                                </div>

                                <div>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</span>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{selectedLog.entityType}</p>
                                </div>

                                <div>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Utilisateur</span>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{selectedLog.userName}</p>
                                </div>

                                <div>
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</span>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                                        {selectedLog.timestamp.toLocaleString('fr-FR')}
                                    </p>
                                </div>
                            </div>

                            {selectedLog.before && selectedLog.after && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Comparaison Avant/Après</h4>
                                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                        <ReactDiffViewer
                                            oldValue={JSON.stringify(selectedLog.before, null, 2)}
                                            newValue={JSON.stringify(selectedLog.after, null, 2)}
                                            splitView={false}
                                            showDiffOnly={true}
                                            useDarkTheme={document.documentElement.classList.contains('dark')}
                                            styles={{
                                                variables: {
                                                    light: {
                                                        diffViewerBackground: '#fafafa',
                                                        addedBackground: '#e6ffed',
                                                        addedColor: '#24292e',
                                                        removedBackground: '#ffeef0',
                                                        removedColor: '#24292e',
                                                    },
                                                    dark: {
                                                        diffViewerBackground: '#0f172a',
                                                        addedBackground: '#0d3d1a',
                                                        addedColor: '#e6e6e6',
                                                        removedBackground: '#3d0d0d',
                                                        removedColor: '#e6e6e6',
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedLog.changes && selectedLog.changes.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Champs modifiés</h4>
                                    <ul className="space-y-1">
                                        {selectedLog.changes.map((change, idx) => (
                                            <li key={idx} className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                <span className="w-2 h-2 bg-brand-500 rounded-full"></span>
                                                {change}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>Sélectionnez un événement pour voir les détails</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
