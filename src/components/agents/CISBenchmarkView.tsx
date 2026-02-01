import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CISBaseline,
    CISCheckResult,
    CISCheckStatus,
    getCISStatusColor,
} from '../../types/softwareInventory';
import {
    Shield,
    CheckCircle,
    XCircle,
    AlertCircle,
    MinusCircle,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    Monitor,
    TrendingUp,
    TrendingDown,
    Minus,
    Copy,
    ExternalLink,
    FileText,
} from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { cn } from '../../utils/cn';
import { slideUpVariants } from '../ui/animationVariants';
import { useLocale } from '@/hooks/useLocale';

interface CISBenchmarkViewProps {
    baselines: CISBaseline[];
    searchQuery?: string;
    agentHostnames?: Map<string, string>;
}

// Compliance Score Gauge
const ComplianceGauge: React.FC<{
    score: number;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
}> = ({ score, size = 'md', showLabel = true }) => {
    const sizes = {
        sm: { width: 60, strokeWidth: 6, fontSize: 'text-sm' },
        md: { width: 80, strokeWidth: 8, fontSize: 'text-lg' },
        lg: { width: 120, strokeWidth: 10, fontSize: 'text-2xl' },
    };

    const { width, strokeWidth, fontSize } = sizes[size];
    const radius = (width - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;

    const getColor = () => {
        if (score >= 90) return 'text-success stroke-success';
        if (score >= 70) return 'text-primary stroke-primary';
        if (score >= 50) return 'text-warning stroke-warning';
        return 'text-destructive stroke-destructive';
    };

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={width} height={width} className="transform -rotate-90">
                <circle
                    cx={width / 2}
                    cy={width / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-muted/30"
                />
                <circle
                    cx={width / 2}
                    cy={width / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    strokeLinecap="round"
                    className={cn('transition-all duration-1000', getColor())}
                />
            </svg>
            {showLabel && (
                <span className={cn(
                    'absolute font-bold font-display',
                    fontSize,
                    getColor().split(' ')[0]
                )}>
                    {score}%
                </span>
            )}
        </div>
    );
};

// Status Icon Component
const StatusIcon: React.FC<{ status: CISCheckStatus; className?: string }> = ({ status, className }) => {
    const iconClass = cn('h-4 w-4', getCISStatusColor(status), className);

    switch (status) {
        case 'pass':
            return <CheckCircle className={iconClass} />;
        case 'fail':
            return <XCircle className={iconClass} />;
        case 'manual':
            return <AlertCircle className={iconClass} />;
        case 'not_applicable':
            return <MinusCircle className={iconClass} />;
        case 'error':
            return <AlertTriangle className={iconClass} />;
    }
};

// Score Change Indicator
const ScoreChange: React.FC<{ change: number | undefined }> = ({ change }) => {
    if (change === undefined || change === 0) {
        return (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Minus className="h-3 w-3" />
                Stable
            </span>
        );
    }

    if (change > 0) {
        return (
            <span className="flex items-center gap-1 text-sm text-success">
                <TrendingUp className="h-3 w-3" />
                +{change}%
            </span>
        );
    }

    return (
        <span className="flex items-center gap-1 text-sm text-destructive">
            <TrendingDown className="h-3 w-3" />
            {change}%
        </span>
    );
};

// Agent Baseline Card
const BaselineCard: React.FC<{
    baseline: CISBaseline;
    isExpanded: boolean;
    onToggle: () => void;
    agentDisplayName?: string;
}> = ({ baseline, isExpanded, onToggle, agentDisplayName }) => {
    const { config } = useLocale();
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [showAllChecks, setShowAllChecks] = useState(false);

    const toggleCategory = (categoryId: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const failedChecks = baseline.results.filter(r => r.status === 'fail');
    const displayedChecks = showAllChecks ? failedChecks : failedChecks.slice(0, 5);

    return (
        <motion.div
            variants={slideUpVariants}
            className="glass-premium rounded-2xl overflow-hidden border border-border/40"
        >
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full p-4 sm:p-6 flex items-center gap-4 hover:bg-muted/30 transition-colors"
            >
                <ComplianceGauge score={baseline.complianceScore} size="md" />

                <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-medium truncate">{agentDisplayName || baseline.agentId}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        {baseline.benchmarkName}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                        <ScoreChange change={baseline.scoreChange} />
                        <span className="text-xs text-muted-foreground">
                            Dernier scan: {new Date(baseline.lastScanAt).toLocaleDateString(config.intlLocale)}
                        </span>
                    </div>
                </div>

                {/* Summary Badges */}
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-success gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {baseline.summary.pass}
                    </Badge>
                    <Badge variant="outline" className="text-destructive gap-1">
                        <XCircle className="h-3 w-3" />
                        {baseline.summary.fail}
                    </Badge>
                    {baseline.summary.manual > 0 && (
                        <Badge variant="outline" className="text-warning gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {baseline.summary.manual}
                        </Badge>
                    )}
                </div>

                <ChevronDown className={cn(
                    'h-5 w-5 text-muted-foreground transition-transform',
                    isExpanded && 'rotate-180'
                )} />
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 sm:px-6 pb-6 space-y-6 border-t">
                            {/* Category Results */}
                            <div className="pt-4">
                                <h4 className="text-sm font-medium mb-3">Conformité par catégorie</h4>
                                <div className="space-y-2">
                                    {baseline.categoryResults.map((cat) => (
                                        <div key={cat.categoryId || 'unknown'}>
                                            <button
                                                onClick={() => toggleCategory(cat.categoryId)}
                                                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                                            >
                                                <ChevronRight className={cn(
                                                    'h-4 w-4 transition-transform',
                                                    expandedCategories.has(cat.categoryId) && 'rotate-90'
                                                )} />
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium">
                                                            {cat.categoryName}
                                                        </span>
                                                        <span className={cn(
                                                            'text-sm font-medium',
                                                            cat.compliancePercent >= 90 ? 'text-success' :
                                                                cat.compliancePercent >= 70 ? 'text-primary' :
                                                                    cat.compliancePercent >= 50 ? 'text-warning' :
                                                                        'text-destructive'
                                                        )}>
                                                            {cat.compliancePercent}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                'h-full rounded-full transition-all',
                                                                cat.compliancePercent >= 90 ? 'bg-success' :
                                                                    cat.compliancePercent >= 70 ? 'bg-primary' :
                                                                        cat.compliancePercent >= 50 ? 'bg-warning' :
                                                                            'bg-destructive'
                                                            )}
                                                            style={{ width: `${cat.compliancePercent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {cat.pass}/{cat.total}
                                                </span>
                                            </button>

                                            {/* Category Checks */}
                                            <AnimatePresence>
                                                {expandedCategories.has(cat.categoryId) && (
                                                    <motion.div
                                                        initial={{ height: 0 }}
                                                        animate={{ height: 'auto' }}
                                                        exit={{ height: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="ml-7 pl-4 border-l space-y-1 py-2">
                                                            {baseline.results
                                                                .filter(r => r.checkId.startsWith(cat.categoryId))
                                                                .map((check) => (
                                                                    <CheckResultItem
                                                                        key={check.id || 'unknown'}
                                                                        check={check}
                                                                    />
                                                                ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Failed Checks Summary */}
                            {failedChecks.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-medium text-destructive">
                                            Contrôles échoués ({failedChecks.length})
                                        </h4>
                                        {failedChecks.length > 5 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowAllChecks(!showAllChecks)}
                                            >
                                                {showAllChecks ? 'Voir moins' : `Voir tout (${failedChecks.length})`}
                                            </Button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {displayedChecks.map((check) => (
                                            <FailedCheckCard key={check.id || 'unknown'} check={check} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// Check Result Item (in category list)
const CheckResultItem: React.FC<{ check: CISCheckResult }> = ({ check }) => {
    return (
        <div className="flex items-center gap-2 py-1.5 text-sm">
            <StatusIcon status={check.status} />
            <span className={cn(
                'font-mono text-xs',
                check.status === 'pass' ? 'text-muted-foreground' : 'text-foreground'
            )}>
                {check.checkId}
            </span>
        </div>
    );
};

// Failed Check Card (detailed view)
const FailedCheckCard: React.FC<{ check: CISCheckResult }> = ({ check }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="border border-destructive/20 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 flex items-center gap-3 hover:bg-destructive/5 transition-colors"
            >
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
                <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                            {check.checkId}
                        </span>
                    </div>
                </div>
                <ChevronDown className={cn(
                    'h-4 w-4 transition-transform',
                    isExpanded && 'rotate-180'
                )} />
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 space-y-3 border-t border-destructive/20">
                            {/* Values Comparison */}
                            <div className="pt-3 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Valeur attendue</p>
                                    <code className="text-xs bg-success/10 text-success px-2 py-1 rounded block">
                                        {String(check.expectedValue ?? 'N/A')}
                                    </code>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Valeur trouvée</p>
                                    <code className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded block">
                                        {String(check.actualValue ?? 'N/A')}
                                    </code>
                                </div>
                            </div>

                            {/* Evidence */}
                            {Object.keys(check.evidence).length > 0 && (
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Preuve</p>
                                    <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                                        {JSON.stringify(check.evidence, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2">
                                <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                                    const text = `${check.checkId}\nAttendu: ${String(check.expectedValue ?? 'N/A')}\nTrouvé: ${String(check.actualValue ?? 'N/A')}\n${JSON.stringify(check.evidence, null, 2)}`;
                                    navigator.clipboard.writeText(text);
                                }}>
                                    <Copy className="h-3 w-3" />
                                    Copier
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                                    // Navigate to remediation docs based on checkId
                                    window.open(`https://www.cisecurity.org/benchmark`, '_blank', 'noopener,noreferrer');
                                }}>
                                    <FileText className="h-3 w-3" />
                                    Remédiation
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                                    window.open(`https://www.cisecurity.org/benchmark`, '_blank', 'noopener,noreferrer');
                                }}>
                                    <ExternalLink className="h-3 w-3" />
                                    CIS Docs
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Empty State
const EmptyState: React.FC = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-muted/50 mb-4">
            <Shield className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Aucun benchmark CIS</h3>
        <p className="text-muted-foreground text-sm max-w-md">
            Les résultats des benchmarks CIS apparaîtront ici lorsque les agents
            effectueront leurs scans de conformité.
        </p>
    </div>
);

// Fleet Summary Header
const FleetSummary: React.FC<{ baselines: CISBaseline[] }> = ({ baselines }) => {
    if (baselines.length === 0) return null;

    const averageScore = Math.round(
        baselines.reduce((sum, b) => sum + b.complianceScore, 0) / baselines.length
    );

    const distribution = {
        excellent: baselines.filter(b => b.complianceScore >= 90).length,
        good: baselines.filter(b => b.complianceScore >= 70 && b.complianceScore < 90).length,
        fair: baselines.filter(b => b.complianceScore >= 50 && b.complianceScore < 70).length,
        poor: baselines.filter(b => b.complianceScore < 50).length,
    };

    return (
        <motion.div
            variants={slideUpVariants}
            className="glass-premium rounded-2xl p-4 sm:p-6 mb-6 border border-border/40"
        >
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <ComplianceGauge score={averageScore} size="lg" />

                <div className="flex-1">
                    <h3 className="text-lg font-medium mb-2">Score moyen de la flotte</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Basé sur {baselines.length} agent{baselines.length > 1 ? 's' : ''} scannés
                    </p>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-success" />
                            <span className="text-sm">{distribution.excellent} excellent</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-primary" />
                            <span className="text-sm">{distribution.good} bon</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-warning" />
                            <span className="text-sm">{distribution.fair} moyen</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-destructive" />
                            <span className="text-sm">{distribution.poor} faible</span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// Main Component
export const CISBenchmarkView: React.FC<CISBenchmarkViewProps> = ({
    baselines,
    searchQuery = '',
    agentHostnames,
}) => {
    const [expandedBaselines, setExpandedBaselines] = useState<Set<string>>(new Set());

    const toggleBaseline = (id: string) => {
        const newExpanded = new Set(expandedBaselines);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedBaselines(newExpanded);
    };

    const filteredBaselines = useMemo(() => {
        if (!searchQuery) return baselines;

        const query = searchQuery.toLowerCase();
        return baselines.filter(b =>
            b.agentId.toLowerCase().includes(query) ||
            b.benchmarkName.toLowerCase().includes(query)
        );
    }, [baselines, searchQuery]);

    // Sort by compliance score (ascending - worst first)
    const sortedBaselines = useMemo(() => {
        return [...filteredBaselines].sort((a, b) => a.complianceScore - b.complianceScore);
    }, [filteredBaselines]);

    if (baselines.length === 0) {
        return <EmptyState />;
    }

    return (
        <div className="space-y-4">
            <FleetSummary baselines={baselines} />

            {sortedBaselines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    Aucun résultat pour "{searchQuery}"
                </div>
            ) : (
                sortedBaselines.map((baseline) => (
                    <BaselineCard
                        key={baseline.id || 'unknown'}
                        baseline={baseline}
                        isExpanded={expandedBaselines.has(baseline.id)}
                        onToggle={() => toggleBaseline(baseline.id)}
                        agentDisplayName={agentHostnames?.get(baseline.agentId)}
                    />
                ))
            )}
        </div>
    );
};

export default CISBenchmarkView;
