import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    SoftwareInventoryEntry,
    getRiskLevelColor,
    getRiskLevelBgColor,
    getAuthorizationColor,
    formatCategoryLabel,
} from '../../types/softwareInventory';
import {
    Package,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Shield,
    ArrowUpDown,
} from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { cn } from '../../utils/cn';

interface SoftwareTableProps {
    software: SoftwareInventoryEntry[];
    viewMode: 'table' | 'grid';
    onSoftwareClick: (software: SoftwareInventoryEntry) => void;
    loading?: boolean;
}

type SortField = 'name' | 'vendor' | 'agentCount' | 'riskScore' | 'authorizationStatus' | 'lastSeen';
type SortDirection = 'asc' | 'desc';

// Authorization status icon
const AuthStatusIcon: React.FC<{ status: SoftwareInventoryEntry['authorizationStatus'] }> = ({ status }) => {
    switch (status) {
        case 'authorized':
            return <CheckCircle className="h-4 w-4 text-success" />;
        case 'pending':
            return <Clock className="h-4 w-4 text-warning" />;
        case 'unauthorized':
            return <AlertTriangle className="h-4 w-4 text-orange-500" />;
        case 'blocked':
            return <XCircle className="h-4 w-4 text-destructive" />;
    }
};

// Software Grid Card
const SoftwareCard: React.FC<{
    software: SoftwareInventoryEntry;
    onClick: () => void;
}> = ({ software, onClick }) => {
    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                'glass-panel rounded-2xl p-4 text-left w-full',
                'hover:shadow-apple-md transition-all duration-300',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                        'p-2 rounded-xl shrink-0',
                        getRiskLevelBgColor(software.riskLevel)
                    )}>
                        <Package className={cn('h-5 w-5', getRiskLevelColor(software.riskLevel))} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-medium truncate">{software.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">{software.vendor}</p>
                    </div>
                </div>
                <AuthStatusIcon status={software.authorizationStatus} />
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                        {formatCategoryLabel(software.category)}
                    </Badge>
                </div>
                <span className="text-muted-foreground">
                    {software.agentCount} agent{software.agentCount > 1 ? 's' : ''}
                </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Risque:</span>
                    <span className={cn('text-sm font-medium', getRiskLevelColor(software.riskLevel))}>
                        {software.riskScore}/100
                    </span>
                </div>
                {software.hasVulnerabilities && (
                    <Badge variant="soft" status="error" className="text-xs">
                        {software.linkedCveIds.length} CVE
                    </Badge>
                )}
            </div>

            {software.versions.length > 1 && (
                <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{software.versions.length} versions</span>
                        <span className="text-warning">
                            ({software.versions.filter(v => v.isOutdated).length} obsolètes)
                        </span>
                    </div>
                </div>
            )}
        </motion.button>
    );
};

// Table Row Component
const SoftwareRow: React.FC<{
    software: SoftwareInventoryEntry;
    onClick: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
}> = ({ software, onClick, isExpanded, onToggleExpand }) => {
    const latestVersion = software.versions.find(v => v.isLatest);
    const outdatedCount = software.versions.filter(v => v.isOutdated).length;

    return (
        <>
            <tr
                className={cn(
                    'group cursor-pointer hover:bg-muted/30 transition-colors',
                    isExpanded && 'bg-muted/20'
                )}
            >
                <td className="px-4 py-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand();
                        }}
                        className="p-1 hover:bg-muted rounded"
                    >
                        {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </button>
                </td>
                <td className="px-4 py-3" onClick={onClick}>
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            'p-2 rounded-lg shrink-0',
                            getRiskLevelBgColor(software.riskLevel)
                        )}>
                            <Package className={cn('h-4 w-4', getRiskLevelColor(software.riskLevel))} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-medium truncate max-w-[200px]">{software.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {software.vendor}
                            </p>
                        </div>
                    </div>
                </td>
                <td className="px-4 py-3" onClick={onClick}>
                    <Badge variant="outline" className="text-xs">
                        {formatCategoryLabel(software.category)}
                    </Badge>
                </td>
                <td className="px-4 py-3" onClick={onClick}>
                    <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
                            {latestVersion?.version || '-'}
                        </code>
                        {outdatedCount > 0 && (
                            <Badge variant="outline" className="text-xs text-warning">
                                +{outdatedCount}
                            </Badge>
                        )}
                    </div>
                </td>
                <td className="px-4 py-3 text-center" onClick={onClick}>
                    {software.agentCount}
                </td>
                <td className="px-4 py-3" onClick={onClick}>
                    <div className="flex items-center gap-2">
                        <AuthStatusIcon status={software.authorizationStatus} />
                        <span className={cn('text-sm', getAuthorizationColor(software.authorizationStatus))}>
                            {software.authorizationStatus === 'authorized' ? 'Autorisé' :
                                software.authorizationStatus === 'pending' ? 'En attente' :
                                    software.authorizationStatus === 'unauthorized' ? 'Non autorisé' : 'Bloqué'}
                        </span>
                    </div>
                </td>
                <td className="px-4 py-3" onClick={onClick}>
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            'w-16 h-2 rounded-full bg-muted overflow-hidden'
                        )}>
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all',
                                    software.riskScore >= 70 ? 'bg-destructive' :
                                        software.riskScore >= 40 ? 'bg-warning' : 'bg-success'
                                )}
                                style={{ width: `${software.riskScore}%` }}
                            />
                        </div>
                        <span className={cn('text-sm font-medium', getRiskLevelColor(software.riskLevel))}>
                            {software.riskScore}
                        </span>
                    </div>
                </td>
                <td className="px-4 py-3" onClick={onClick}>
                    {software.hasVulnerabilities ? (
                        <Badge variant="soft" status="error" className="text-xs">
                            {software.linkedCveIds.length} CVE
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-xs text-success">
                            <Shield className="h-3 w-3 mr-1" />
                            Sécurisé
                        </Badge>
                    )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground" onClick={onClick}>
                    {new Date(software.lastSeen).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClick}
                        className="opacity-0 group-hover:opacity-70 transition-opacity"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                </td>
            </tr>

            {/* Expanded Row - Version Details */}
            <AnimatePresence>
                {isExpanded && (
                    <tr>
                        <td colSpan={10} className="px-4 py-0">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="py-4 pl-12 pr-4 bg-muted/20 rounded-lg my-2">
                                    <h4 className="text-sm font-medium mb-3">Versions installées</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {software.versions.map((version, idx) => (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    'p-3 rounded-lg border',
                                                    version.isLatest ? 'border-success/50 bg-success/5' :
                                                        version.isOutdated ? 'border-warning/50 bg-warning/5' :
                                                            'border-border bg-background'
                                                )}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <code className="text-sm font-medium">{version.version}</code>
                                                    {version.isLatest && (
                                                        <Badge variant="outline" className="text-xs text-success">
                                                            Dernière
                                                        </Badge>
                                                    )}
                                                    {version.isOutdated && (
                                                        <Badge variant="outline" className="text-xs text-warning">
                                                            Obsolète
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {version.agentCount} agent{version.agentCount > 1 ? 's' : ''}
                                                </p>
                                                {version.cveIds.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {version.cveIds.slice(0, 2).map(cve => (
                                                            <Badge key={cve} variant="soft" status="error" className="text-xs">
                                                                {cve}
                                                            </Badge>
                                                        ))}
                                                        {version.cveIds.length > 2 && (
                                                            <Badge variant="outline" className="text-xs">
                                                                +{version.cveIds.length - 2}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        </td>
                    </tr>
                )}
            </AnimatePresence>
        </>
    );
};

// Empty State
const EmptyState: React.FC = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-muted/50 mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Aucun logiciel détecté</h3>
        <p className="text-muted-foreground text-sm max-w-md">
            Les logiciels seront automatiquement inventoriés lorsque les agents
            effectueront leur scan d'inventaire.
        </p>
    </div>
);

// Loading Skeleton
const LoadingSkeleton: React.FC<{ viewMode: 'table' | 'grid' }> = ({ viewMode }) => {
    if (viewMode === 'grid') {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="h-40 bg-muted/50 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-2 animate-pulse">
            <div className="h-12 bg-muted/50 rounded-lg" />
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted/30 rounded-lg" />
            ))}
        </div>
    );
};

// Sort Header
const SortHeader: React.FC<{
    label: string;
    field: SortField;
    currentSort: SortField;
    currentDirection: SortDirection;
    onSort: (field: SortField) => void;
    className?: string;
}> = ({ label, field, currentSort, currentDirection, onSort, className }) => {
    const isActive = currentSort === field;

    return (
        <button
            onClick={() => onSort(field)}
            className={cn(
                'flex items-center gap-1 hover:text-foreground transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground',
                className
            )}
        >
            {label}
            <ArrowUpDown className={cn(
                'h-3 w-3',
                isActive && currentDirection === 'desc' && 'rotate-180'
            )} />
        </button>
    );
};

// Main Component
export const SoftwareTable: React.FC<SoftwareTableProps> = ({
    software,
    viewMode,
    onSoftwareClick,
    loading = false,
}) => {
    const [sortField, setSortField] = useState<SortField>('riskScore');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const toggleRowExpand = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const sortedSoftware = useMemo(() => {
        return [...software].sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'vendor':
                    comparison = a.vendor.localeCompare(b.vendor);
                    break;
                case 'agentCount':
                    comparison = a.agentCount - b.agentCount;
                    break;
                case 'riskScore':
                    comparison = a.riskScore - b.riskScore;
                    break;
                case 'authorizationStatus':
                    comparison = a.authorizationStatus.localeCompare(b.authorizationStatus);
                    break;
                case 'lastSeen':
                    comparison = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [software, sortField, sortDirection]);

    if (loading) {
        return <LoadingSkeleton viewMode={viewMode} />;
    }

    if (software.length === 0) {
        return <EmptyState />;
    }

    if (viewMode === 'grid') {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedSoftware.map((sw) => (
                    <SoftwareCard
                        key={sw.id}
                        software={sw}
                        onClick={() => onSoftwareClick(sw)}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b bg-muted/30">
                            <th className="px-4 py-3 w-10"></th>
                            <th className="px-4 py-3 text-left">
                                <SortHeader
                                    label="Logiciel"
                                    field="name"
                                    currentSort={sortField}
                                    currentDirection={sortDirection}
                                    onSort={handleSort}
                                />
                            </th>
                            <th className="px-4 py-3 text-left text-sm text-muted-foreground">
                                Catégorie
                            </th>
                            <th className="px-4 py-3 text-left text-sm text-muted-foreground">
                                Version
                            </th>
                            <th className="px-4 py-3 text-center">
                                <SortHeader
                                    label="Agents"
                                    field="agentCount"
                                    currentSort={sortField}
                                    currentDirection={sortDirection}
                                    onSort={handleSort}
                                    className="justify-center"
                                />
                            </th>
                            <th className="px-4 py-3 text-left">
                                <SortHeader
                                    label="Statut"
                                    field="authorizationStatus"
                                    currentSort={sortField}
                                    currentDirection={sortDirection}
                                    onSort={handleSort}
                                />
                            </th>
                            <th className="px-4 py-3 text-left">
                                <SortHeader
                                    label="Risque"
                                    field="riskScore"
                                    currentSort={sortField}
                                    currentDirection={sortDirection}
                                    onSort={handleSort}
                                />
                            </th>
                            <th className="px-4 py-3 text-left text-sm text-muted-foreground">
                                CVE
                            </th>
                            <th className="px-4 py-3 text-left">
                                <SortHeader
                                    label="Dernière vue"
                                    field="lastSeen"
                                    currentSort={sortField}
                                    currentDirection={sortDirection}
                                    onSort={handleSort}
                                />
                            </th>
                            <th className="px-4 py-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedSoftware.map((sw) => (
                            <SoftwareRow
                                key={sw.id}
                                software={sw}
                                onClick={() => onSoftwareClick(sw)}
                                isExpanded={expandedRows.has(sw.id)}
                                onToggleExpand={() => toggleRowExpand(sw.id)}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t bg-muted/20 flex items-center justify-between text-sm text-muted-foreground">
                <span>{software.length} logiciel{software.length > 1 ? 's' : ''}</span>
                <span>
                    {software.reduce((sum, sw) => sum + sw.agentCount, 0)} installations totales
                </span>
            </div>
        </div>
    );
};

export default SoftwareTable;
