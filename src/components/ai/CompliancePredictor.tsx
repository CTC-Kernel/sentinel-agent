/**
 * CompliancePredictor Component
 *
 * AI-powered compliance predictions with trend visualization,
 * time-to-target estimates, and confidence intervals.
 *
 * Sprint 7 - AI-Powered Features
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CompliancePrediction,
    ScorePrediction,
    TrendAnalysis,
    TrendDirection,
    getConfidenceColor,
} from '../../types/compliancePrediction';
import {
    subscribeToPredictions,
} from '../../services/CompliancePredictionService';
import { useStore } from '../../store';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Target,
    Calendar,
    AlertCircle,
    CheckCircle,
    Clock,
    ChevronDown,
    ChevronRight,
    Sparkles,
    RefreshCw,
    Info,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { slideUpVariants } from '../ui/animationVariants';

interface CompliancePredictorProps {
    frameworkId?: string;
    className?: string;
    compact?: boolean;
}

// Trend Icon Component
const TrendIcon: React.FC<{ direction: TrendDirection; className?: string }> = ({
    direction,
    className,
}) => {
    switch (direction) {
        case 'up':
            return <TrendingUp className={cn('h-4 w-4 text-success', className)} />;
        case 'down':
            return <TrendingDown className={cn('h-4 w-4 text-destructive', className)} />;
        default:
            return <Minus className={cn('h-4 w-4 text-muted-foreground', className)} />;
    }
};

// Confidence Badge Component
const ConfidenceBadge: React.FC<{ confidence: ScorePrediction['confidence'] }> = ({
    confidence,
}) => {
    const labels = {
        high: 'Haute confiance',
        medium: 'Confiance moyenne',
        low: 'Faible confiance',
    };

    return (
        <Badge
            variant="outline"
            className={cn('text-xs', getConfidenceColor(confidence))}
        >
            {labels[confidence]}
        </Badge>
    );
};

// Mini Sparkline Chart
const MiniSparkline: React.FC<{
    data: { timestamp: string; score: number }[];
    width?: number;
    height?: number;
    className?: string;
}> = ({ data, width = 120, height = 40, className }) => {
    if (data.length < 2) return null;

    const minScore = Math.min(...data.map(d => d.score));
    const maxScore = Math.max(...data.map(d => d.score));
    const range = maxScore - minScore || 1;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d.score - minScore) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    const isUp = data[data.length - 1].score >= data[0].score;

    return (
        <svg width={width} height={height} className={className}>
            <polyline
                points={points}
                fill="none"
                stroke={isUp ? 'var(--success)' : 'var(--destructive)'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle
                cx={(data.length - 1) / (data.length - 1) * width}
                cy={height - ((data[data.length - 1].score - minScore) / range) * (height - 4) - 2}
                r="3"
                fill={isUp ? 'var(--success)' : 'var(--destructive)'}
            />
        </svg>
    );
};

// Prediction Card Component
const PredictionCard: React.FC<{
    prediction: ScorePrediction;
    isPrimary?: boolean;
}> = ({ prediction, isPrimary = false }) => {
    const getStatusIcon = () => {
        if (prediction.isReached) {
            return <CheckCircle className="h-5 w-5 text-success" />;
        }
        if (prediction.isUnreachable) {
            return <AlertCircle className="h-5 w-5 text-destructive" />;
        }
        return <Target className="h-5 w-5 text-primary" />;
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <motion.div
            variants={slideUpVariants}
            className={cn(
                'p-4 rounded-xl border transition-all',
                isPrimary ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30',
                prediction.isReached && 'border-success/50 bg-success/5',
                prediction.isUnreachable && 'border-destructive/50 bg-destructive/5'
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    {getStatusIcon()}
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{prediction.targetLabel}</span>
                            <span className="text-lg font-bold">{prediction.targetScore}%</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {prediction.message}
                        </p>
                    </div>
                </div>
                <ConfidenceBadge confidence={prediction.confidence} />
            </div>

            {!prediction.isReached && !prediction.isUnreachable && prediction.daysUntil && (
                <div className="mt-4 flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Prévu:</span>
                        <span className="font-medium">{formatDate(prediction.predictedDate)}</span>
                    </div>
                    {prediction.lowerBound && prediction.upperBound && (
                        <div className="text-muted-foreground">
                            ({formatDate(prediction.lowerBound)} - {formatDate(prediction.upperBound)})
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

// Trend Summary Component
const TrendSummary: React.FC<{
    trend: TrendAnalysis;
    compact?: boolean;
}> = ({ trend, compact = false }) => {
    const velocityLabel = trend.velocity > 0
        ? `+${trend.velocity} pts/jour`
        : trend.velocity < 0
            ? `${trend.velocity} pts/jour`
            : 'Stable';

    if (compact) {
        return (
            <div className="flex items-center gap-4">
                <TrendIcon direction={trend.direction} />
                <span className={cn(
                    'text-sm font-medium',
                    trend.direction === 'up' ? 'text-success' :
                        trend.direction === 'down' ? 'text-destructive' :
                            'text-muted-foreground'
                )}>
                    {velocityLabel}
                </span>
                <MiniSparkline data={trend.history} />
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-muted-foreground">Tendance</h4>
                <TrendIcon direction={trend.direction} className="h-5 w-5" />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                    <p className="text-xs text-muted-foreground">Score actuel</p>
                    <p className="text-xl font-bold">{trend.currentScore}%</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">7 jours</p>
                    <p className={cn(
                        'text-lg font-medium',
                        trend.weeklyChange > 0 ? 'text-success' :
                            trend.weeklyChange < 0 ? 'text-destructive' :
                                'text-muted-foreground'
                    )}>
                        {trend.weeklyChange > 0 ? '+' : ''}{trend.weeklyChange}%
                    </p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">30 jours</p>
                    <p className={cn(
                        'text-lg font-medium',
                        trend.monthlyChange > 0 ? 'text-success' :
                            trend.monthlyChange < 0 ? 'text-destructive' :
                                'text-muted-foreground'
                    )}>
                        {trend.monthlyChange > 0 ? '+' : ''}{trend.monthlyChange}%
                    </p>
                </div>
            </div>

            <MiniSparkline
                data={trend.history}
                width={280}
                height={60}
                className="w-full"
            />

            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Vélocité:</span>
                    <span className="font-medium">{velocityLabel}</span>
                </div>
                <div className="text-muted-foreground">
                    R² = {trend.trendLine.r2.toFixed(2)}
                </div>
            </div>
        </div>
    );
};

// Main Component
export const CompliancePredictor: React.FC<CompliancePredictorProps> = ({
    frameworkId,
    className,
    compact = false,
}) => {
    const { user } = useStore();
    const [predictions, setPredictions] = useState<CompliancePrediction[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedFramework, setExpandedFramework] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Subscribe to predictions
    useEffect(() => {
        if (!user?.organizationId) return;

        const unsubscribe = subscribeToPredictions(
            user.organizationId,
            (predictionList) => {
                setPredictions(predictionList);
                setLoading(false);
            },
            (error) => {
                console.error('Failed to load predictions:', error);
                setLoading(false);
            },
            frameworkId ? [frameworkId] : undefined
        );

        return unsubscribe;
    }, [user?.organizationId, frameworkId]);

    // Filter for specific framework if provided
    const displayPredictions = useMemo(() => {
        if (frameworkId) {
            return predictions.filter(p => p.frameworkId === frameworkId);
        }
        return predictions;
    }, [predictions, frameworkId]);

    // Handle refresh
    const handleRefresh = async () => {
        if (!user?.organizationId) return;
        setRefreshing(true);
        try {
            // Would trigger Cloud Function to regenerate predictions
            await new Promise(resolve => setTimeout(resolve, 1000)); // Placeholder
        } finally {
            setRefreshing(false);
        }
    };

    if (loading) {
        return (
            <div className={cn('animate-pulse space-y-4', className)}>
                <div className="h-8 bg-muted/50 rounded-lg w-1/3" />
                <div className="h-32 bg-muted/50 rounded-xl" />
                <div className="h-24 bg-muted/50 rounded-xl" />
            </div>
        );
    }

    if (displayPredictions.length === 0) {
        return (
            <div className={cn('glass-panel rounded-2xl p-6 text-center', className)}>
                <div className="p-4 rounded-full bg-muted/50 inline-block mb-4">
                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Prédictions non disponibles</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Des données historiques sont nécessaires pour générer des prédictions.
                    Les prédictions seront disponibles après quelques jours d'utilisation.
                </p>
                <Button variant="outline" size="sm" className="gap-2">
                    <Info className="h-4 w-4" />
                    En savoir plus
                </Button>
            </div>
        );
    }

    if (compact) {
        // Compact view for dashboard widgets
        const primaryPrediction = displayPredictions[0];
        const primaryTarget = primaryPrediction?.predictions.find(p => !p.isReached);

        return (
            <div className={cn('glass-panel rounded-xl p-4', className)}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <h3 className="font-medium text-sm">Prédiction IA</h3>
                    </div>
                    {primaryTarget && (
                        <ConfidenceBadge confidence={primaryTarget.confidence} />
                    )}
                </div>

                {primaryPrediction && (
                    <>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-2xl font-bold">
                                {primaryPrediction.currentScore}%
                            </span>
                            <TrendSummary trend={primaryPrediction.trend} compact />
                        </div>

                        {primaryTarget && (
                            <p className="text-sm text-muted-foreground">
                                {primaryTarget.message}
                            </p>
                        )}
                    </>
                )}
            </div>
        );
    }

    // Full view
    return (
        <div className={cn('space-y-6', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Prédictions de Conformité</h2>
                        <p className="text-sm text-muted-foreground">
                            Estimations basées sur vos tendances historiques
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="gap-2"
                >
                    <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                    Actualiser
                </Button>
            </div>

            {/* Predictions by Framework */}
            <div className="space-y-4">
                {displayPredictions.map((prediction) => (
                    <motion.div
                        key={prediction.id}
                        variants={slideUpVariants}
                        className="glass-panel rounded-2xl overflow-hidden"
                    >
                        {/* Framework Header */}
                        <button
                            onClick={() => setExpandedFramework(
                                expandedFramework === prediction.frameworkId
                                    ? null
                                    : prediction.frameworkId
                            )}
                            className="w-full p-4 sm:p-6 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-semibold">{prediction.frameworkName}</h3>
                                    <Badge variant="outline">{prediction.frameworkCode}</Badge>
                                    {!prediction.isReliable && (
                                        <Badge variant="outline" className="text-warning">
                                            Données limitées
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 mt-2">
                                    <span className="text-2xl font-bold">
                                        {prediction.currentScore}%
                                    </span>
                                    <TrendSummary trend={prediction.trend} compact />
                                </div>
                            </div>

                            {/* Quick Prediction Summary */}
                            <div className="hidden sm:block text-right">
                                {prediction.predictions.find(p => !p.isReached && !p.isUnreachable) && (
                                    <p className="text-sm text-muted-foreground">
                                        {prediction.predictions.find(p => !p.isReached)?.message}
                                    </p>
                                )}
                            </div>

                            {expandedFramework === prediction.frameworkId ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                        </button>

                        {/* Expanded Content */}
                        <AnimatePresence>
                            {expandedFramework === prediction.frameworkId && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-4 sm:px-6 pb-6 space-y-6 border-t">
                                        {/* Trend Analysis */}
                                        <div className="pt-4">
                                            <TrendSummary trend={prediction.trend} />
                                        </div>

                                        {/* Target Predictions */}
                                        <div>
                                            <h4 className="text-sm font-medium text-muted-foreground mb-3">
                                                Objectifs
                                            </h4>
                                            <div className="space-y-3">
                                                {prediction.predictions.map((target, idx) => (
                                                    <PredictionCard
                                                        key={idx}
                                                        prediction={target}
                                                        isPrimary={idx === 0}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Factors */}
                                        {prediction.factors.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                                                    Facteurs d'influence
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {prediction.factors.map((factor, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={cn(
                                                                'p-3 rounded-lg text-sm',
                                                                factor.type === 'positive' && 'bg-success/10',
                                                                factor.type === 'negative' && 'bg-destructive/10',
                                                                factor.type === 'neutral' && 'bg-muted/50'
                                                            )}
                                                        >
                                                            <p className="font-medium">{factor.name}</p>
                                                            <p className="text-muted-foreground text-xs mt-0.5">
                                                                {factor.description}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Data Quality Indicator */}
                                        <div className="flex items-center justify-between text-sm pt-4 border-t">
                                            <div className="flex items-center gap-2">
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-muted-foreground">
                                                    Qualité des données: {prediction.dataQuality}%
                                                </span>
                                            </div>
                                            <span className="text-muted-foreground">
                                                {prediction.dataPointsUsed} points de données
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default CompliancePredictor;
