/**
 * RemediationSuggestions Component
 *
 * Shows top recommended actions with impact scores, effort estimates,
 * and downloadable remediation scripts.
 *
 * Sprint 7 - AI-Powered Features
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorLogger } from '@/services/errorLogger';
import {
    RecommendedAction,
    ActionImpactSummary,
    ActionCategory,
    getEffortLabel,
    getEffortColor,
    getCategoryLabel,
} from '../../types/compliancePrediction';
import {
    subscribeToRecommendedActions,
    getActionImpactSummary,
    getRemediationScripts,
    rankActionsByQuickWin,
    getTopImpactActions,
} from '../../services/CompliancePredictionService';
import { useStore } from '../../store';
import {
    Zap,
    TrendingUp,
    Clock,
    ChevronDown,
    ChevronRight,
    Download,
    Play,
    Bot,
    Settings,
    FileText,
    GraduationCap,
    BookOpen,
    Wrench,
    GitBranch,
    CheckCircle,
    Target,
    Filter,
    ExternalLink,
    Copy,
    Users,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';

interface RemediationSuggestionsProps {
    frameworkId?: string;
    className?: string;
    maxActions?: number;
    showQuickWinsOnly?: boolean;
}

// Category Icon Mapping
const CategoryIcons: Record<ActionCategory, React.FC<{ className?: string }>> = {
    agent_remediation: Bot,
    configuration: Settings,
    policy: FileText,
    training: GraduationCap,
    documentation: BookOpen,
    technical: Wrench,
    process: GitBranch,
};

// Impact Summary Card
const ImpactSummaryCard: React.FC<{
    summary: ActionImpactSummary;
}> = ({ summary }) => {
    return (
        <motion.div
            variants={slideUpVariants}
            className="glass-premium rounded-2xl p-4 sm:p-6 border border-border/40"
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-3xl bg-success/10">
                    <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                    <h3 className="font-semibold">Impact Potentiel</h3>
                    <p className="text-sm text-muted-foreground">
                        Si toutes les actions sont complétées
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-3xl bg-success/10">
                    <p className="text-2xl font-bold text-success">
                        +{summary.totalPotentialIncrease}
                    </p>
                    <p className="text-xs text-muted-foreground">Points total</p>
                </div>
                <div className="text-center p-3 rounded-3xl bg-primary/10">
                    <p className="text-2xl font-bold text-primary">
                        +{summary.quickWinIncrease}
                    </p>
                    <p className="text-xs text-muted-foreground">Quick wins</p>
                </div>
                <div className="text-center p-3 rounded-3xl bg-muted">
                    <p className="text-2xl font-bold">
                        {summary.quickWinCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Actions rapides</p>
                </div>
                <div className="text-center p-3 rounded-3xl bg-muted">
                    <p className="text-2xl font-bold">
                        {summary.quickWinHours}h
                    </p>
                    <p className="text-xs text-muted-foreground">Effort quick wins</p>
                </div>
            </div>

            {summary.byCategory.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Par catégorie</p>
                    <div className="flex flex-wrap gap-2">
                        {summary.byCategory.map((cat) => {
                            const Icon = CategoryIcons[cat.category];
                            return (
                                <Badge
                                    key={cat.category || 'unknown'}
                                    variant="outline"
                                    className="gap-1"
                                >
                                    <Icon className="h-3 w-3" />
                                    {getCategoryLabel(cat.category)}: +{cat.totalImpact}
                                </Badge>
                            );
                        })}
                    </div>
                </div>
            )}
        </motion.div>
    );
};

// Action Card Component
const ActionCard: React.FC<{
    action: RecommendedAction;
    onExecute?: () => void;
    onDownloadScript?: () => void;
}> = ({ action, onExecute, onDownloadScript }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const Icon = CategoryIcons[action.category];

    return (
        <motion.div
            variants={slideUpVariants}
            className={cn(
                'glass-premium rounded-3xl overflow-hidden border border-border/40',
                action.isQuickWin && 'ring-2 ring-primary/30'
            )}
        >
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-start gap-4 hover:bg-muted/30 transition-colors text-left"
            >
                {/* Rank Badge */}
                <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm',
                    action.rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                    {action.rank}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium">{action.title}</h4>
                        {action.isQuickWin && (
                            <Badge className="bg-primary/20 text-primary gap-1">
                                <Zap className="h-3 w-3" />
                                Quick Win
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {action.description}
                    </p>

                    {/* Metrics */}
                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4 text-success" />
                            <span className="text-sm font-medium text-success">
                                +{action.scoreImpact} pts
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className={cn('text-sm', getEffortColor(action.effort))}>
                                {action.estimatedHours}h ({getEffortLabel(action.effort)})
                            </span>
                        </div>
                        <Badge variant="outline" className="gap-1">
                            <Icon className="h-3 w-3" />
                            {getCategoryLabel(action.category)}
                        </Badge>
                        {action.hasAutomatedRemediation && (
                            <Badge variant="outline" className="gap-1 text-success">
                                <Bot className="h-3 w-3" />
                                Auto
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Expand Icon */}
                {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
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
                        <div className="px-4 pb-4 space-y-4 border-t">
                            {/* Steps */}
                            {action.steps.length > 0 && (
                                <div className="pt-4">
                                    <h5 className="text-sm font-medium mb-2">Étapes</h5>
                                    <div className="space-y-2">
                                        {action.steps.map((step) => (
                                            <div
                                                key={step.stepNumber || 'unknown'}
                                                className="flex items-start gap-3 text-sm"
                                            >
                                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium">
                                                    {step.stepNumber}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{step.title}</p>
                                                    <p className="text-muted-foreground text-xs mt-0.5">
                                                        {step.description}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        ~{step.estimatedMinutes} min
                                                        {step.isOptional && ' (optionnel)'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Affected Items */}
                            <div className="flex items-center gap-4 text-sm">
                                {action.affectedRequirements > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <Target className="h-4 w-4 text-muted-foreground" />
                                        <span>{action.affectedRequirements} exigences</span>
                                    </div>
                                )}
                                {action.affectedAgentCount && action.affectedAgentCount > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        <span>{action.affectedAgentCount} agents</span>
                                    </div>
                                )}
                            </div>

                            {/* Resources */}
                            {action.resources.length > 0 && (
                                <div>
                                    <h5 className="text-sm font-medium mb-2">Ressources</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {action.resources.map((resource, idx) => (
                                            <Button
                                                key={idx || 'unknown'}
                                                variant="outline"
                                                size="sm"
                                                className="gap-1"
                                                onClick={() => window.open(resource.url, '_blank')}
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                {resource.title}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2 border-t">
                                {action.hasAutomatedRemediation && onExecute && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={onExecute}
                                        className="gap-2"
                                    >
                                        <Play className="h-4 w-4" />
                                        Exécuter
                                    </Button>
                                )}
                                {action.remediationScriptId && onDownloadScript && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onDownloadScript}
                                        className="gap-2"
                                    >
                                        <Download className="h-4 w-4" />
                                        Script
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                >
                                    <Copy className="h-4 w-4" />
                                    Copier
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// Filter/Sort Controls
const FilterControls: React.FC<{
    sortBy: 'rank' | 'impact' | 'effort' | 'quickWin';
    onSortChange: (sort: 'rank' | 'impact' | 'effort' | 'quickWin') => void;
    showQuickWinsOnly: boolean;
    onQuickWinsToggle: () => void;
    categoryFilter: ActionCategory | null;
    onCategoryChange: (category: ActionCategory | null) => void;
}> = ({
    sortBy,
    onSortChange,
    showQuickWinsOnly,
    onQuickWinsToggle,
    categoryFilter,
    onCategoryChange: _onCategoryChange,
}) => {
        const sortOptions = [
            { value: 'rank' as const, label: 'Rang' },
            { value: 'impact' as const, label: 'Impact' },
            { value: 'effort' as const, label: 'Effort' },
            { value: 'quickWin' as const, label: 'Quick Win Score' },
        ];

        return (
            <div className="flex flex-wrap items-center gap-2">
                {/* Sort Dropdown */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                    {sortOptions.map((option) => (
                        <Button
                            key={option.value || 'unknown'}
                            variant={sortBy === option.value ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => onSortChange(option.value)}
                            className="h-7 text-xs"
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>

                {/* Quick Wins Toggle */}
                <Button
                    variant={showQuickWinsOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={onQuickWinsToggle}
                    className="gap-1"
                >
                    <Zap className="h-3 w-3" />
                    Quick Wins
                </Button>

                {/* Category Filter */}
                <div className="relative group">
                    <Button variant="outline" size="sm" className="gap-1">
                        <Filter className="h-3 w-3" />
                        {categoryFilter ? getCategoryLabel(categoryFilter) : 'Catégorie'}
                    </Button>
                </div>
            </div>
        );
    };

// Empty State
const EmptyState: React.FC = () => (
    <div className="glass-premium rounded-2xl p-6 text-center border border-border/40">
        <div className="p-4 rounded-full bg-muted/50 inline-block mb-4">
            <CheckCircle className="h-8 w-8 text-success" />
        </div>
        <h3 className="text-lg font-medium mb-2">Aucune action recommandée</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Félicitations ! Votre conformité est excellente et aucune action
            prioritaire n'est identifiée pour le moment.
        </p>
    </div>
);

// Main Component
export const RemediationSuggestions: React.FC<RemediationSuggestionsProps> = ({
    frameworkId,
    className,
    maxActions = 10,
    showQuickWinsOnly: initialQuickWinsOnly = false,
}) => {
    const { user } = useStore();
    const [actions, setActions] = useState<RecommendedAction[]>([]);
    const [summary, setSummary] = useState<ActionImpactSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<'rank' | 'impact' | 'effort' | 'quickWin'>('rank');
    const [showQuickWinsOnly, setShowQuickWinsOnly] = useState(initialQuickWinsOnly);
    const [categoryFilter, setCategoryFilter] = useState<ActionCategory | null>(null);

    // Subscribe to recommended actions
    useEffect(() => {
        if (!user?.organizationId) return;

        const unsubscribe = subscribeToRecommendedActions(
            user.organizationId,
            (actionList) => {
                setActions(actionList);
                setLoading(false);
            },
            (error) => {
                ErrorLogger.error(error, 'RemediationSuggestions.subscribeToRecommendedActions');
                setLoading(false);
            },
            {
                frameworkId,
                limit: maxActions * 2, // Fetch more for filtering
            }
        );

        return unsubscribe;
    }, [user?.organizationId, frameworkId, maxActions]);

    // Load impact summary
    useEffect(() => {
        if (!user?.organizationId) return;

        getActionImpactSummary(user.organizationId)
            .then(setSummary)
            .catch((error) => ErrorLogger.error(error, 'RemediationSuggestions.getActionImpactSummary'));
    }, [user?.organizationId]);

    // Sort and filter actions
    const displayActions = useMemo(() => {
        let filtered = [...actions];

        // Apply quick wins filter
        if (showQuickWinsOnly) {
            filtered = filtered.filter(a => a.isQuickWin);
        }

        // Apply category filter
        if (categoryFilter) {
            filtered = filtered.filter(a => a.category === categoryFilter);
        }

        // Apply sorting
        switch (sortBy) {
            case 'impact':
                filtered = getTopImpactActions(filtered, maxActions);
                break;
            case 'effort':
                filtered = filtered.sort((a, b) => a.estimatedHours - b.estimatedHours);
                break;
            case 'quickWin':
                filtered = rankActionsByQuickWin(filtered);
                break;
            default:
                filtered = filtered.sort((a, b) => a.rank - b.rank);
        }

        return filtered.slice(0, maxActions);
    }, [actions, sortBy, showQuickWinsOnly, categoryFilter, maxActions]);

    // Handle script execution
    const handleExecute = async (action: RecommendedAction) => {
        if (!user?.organizationId || !action.remediationScriptId) return;

        try {
            // Would trigger script execution request
            ErrorLogger.debug(`Executing script for action: ${action.id}`, 'RemediationSuggestions.handleExecute');
        } catch (error) {
            ErrorLogger.error(error, 'RemediationSuggestions.handleExecute');
        }
    };

    // Handle script download
    const handleDownloadScript = async (action: RecommendedAction) => {
        if (!user?.organizationId || !action.remediationScriptId) return;

        try {
            const scripts = await getRemediationScripts(user.organizationId, {
                checkId: action.controlIds[0],
            });

            if (scripts.length > 0) {
                // Download script content
                const script = scripts[0];
                const blob = new Blob([atob(script.content)], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${script.name}.${script.extension}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            ErrorLogger.error(error, 'RemediationSuggestions.handleDownloadScript');
        }
    };

    if (loading) {
        return (
            <div className={cn('animate-pulse space-y-4', className)}>
                <div className="h-32 bg-muted/50 rounded-2xl" />
                <div className="h-24 bg-muted/50 rounded-3xl" />
                <div className="h-24 bg-muted/50 rounded-3xl" />
                <div className="h-24 bg-muted/50 rounded-3xl" />
            </div>
        );
    }

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className={cn('space-y-6', className)}
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-3xl bg-primary/10">
                        <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Actions Recommandées</h2>
                        <p className="text-sm text-muted-foreground">
                            Top actions pour améliorer votre conformité
                        </p>
                    </div>
                </div>

                <FilterControls
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    showQuickWinsOnly={showQuickWinsOnly}
                    onQuickWinsToggle={() => setShowQuickWinsOnly(!showQuickWinsOnly)}
                    categoryFilter={categoryFilter}
                    onCategoryChange={setCategoryFilter}
                />
            </div>

            {/* Impact Summary */}
            {summary && <ImpactSummaryCard summary={summary} />}

            {/* Actions List */}
            {displayActions.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="space-y-3">
                    {displayActions.map((action) => (
                        <ActionCard
                            key={action.id || 'unknown'}
                            action={action}
                            onExecute={action.hasAutomatedRemediation ? () => handleExecute(action) : undefined}
                            onDownloadScript={action.remediationScriptId ? () => handleDownloadScript(action) : undefined}
                        />
                    ))}
                </div>
            )}

            {/* Show More */}
            {actions.length > maxActions && (
                <div className="text-center">
                    <Button variant="outline" className="gap-2">
                        Voir toutes les actions ({actions.length})
                    </Button>
                </div>
            )}
        </motion.div>
    );
};

export default RemediationSuggestions;
