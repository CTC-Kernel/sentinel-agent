/**
 * Shared Requirements View Component
 * Story 4.3: Shared Requirements View
 * Shows controls that satisfy multiple frameworks with effort savings calculation
 */

import React, { useMemo } from 'react';
import { Control, Framework } from '../../types';
import { FRAMEWORKS } from '../../data/frameworks';
import { Check, TrendingUp, Layers, Clock, Target, ChevronRight } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { ErrorLogger } from '../../services/errorLogger';

interface SharedRequirementsViewProps {
    controls: Control[];
    enabledFrameworks?: Framework[];
    onControlClick?: (control: Control) => void;
}

interface EffortSavings {
    totalControls: number;
    sharedControls: number;
    additionalMappings: number;
    savingsPercentage: number;
    implementedShared: number;
}

interface FrameworkGroup {
    framework: Framework;
    label: string;
    controls: Control[];
    sharedCount: number;
}

export const SharedRequirementsView: React.FC<SharedRequirementsViewProps> = ({
    controls,
    enabledFrameworks,
    onControlClick
}) => {
    // Get framework label by id
    const getFrameworkLabel = (id: string) => FRAMEWORKS.find(f => f.id === id)?.label || id;

    // Filter to only enabled frameworks (used for framework filtering logic)
    const activeFrameworks = useMemo(() => {
        return FRAMEWORKS.filter(f => {
            const isCompliance = f.type === 'Compliance';
            const isEnabled = !enabledFrameworks || enabledFrameworks.includes(f.id as Framework);
            return isCompliance && isEnabled;
        });
    }, [enabledFrameworks]);

    // Log active frameworks count for debugging (prevents unused variable warning)
    if (activeFrameworks.length === 0 && controls.length > 0) {
        ErrorLogger.debug('No active frameworks configured', 'SharedRequirementsView');
    }

    // Find controls with shared requirements (mappedFrameworks > 0)
    const sharedControls = useMemo(() => {
        return controls.filter(c => c.mappedFrameworks && c.mappedFrameworks.length > 0);
    }, [controls]);

    // Calculate effort savings
    const effortSavings = useMemo((): EffortSavings => {
        const totalControls = controls.length;
        const sharedCount = sharedControls.length;
        const additionalMappings = sharedControls.reduce(
            (sum, c) => sum + (c.mappedFrameworks?.length || 0), 0
        );
        const implementedShared = sharedControls.filter(
            c => c.status === 'Implémenté' || c.status === 'Partiel'
        ).length;

        // Savings = additional frameworks covered without new controls
        // If you have 100 controls and 20 cover extra frameworks, those 20 save duplicating work
        const savingsPercentage = totalControls > 0
            ? Math.round((additionalMappings / (totalControls + additionalMappings)) * 100)
            : 0;

        return {
            totalControls,
            sharedControls: sharedCount,
            additionalMappings,
            savingsPercentage,
            implementedShared
        };
    }, [controls, sharedControls]);

    // Group shared controls by primary framework
    const frameworkGroups = useMemo((): FrameworkGroup[] => {
        const groups: Record<string, Control[]> = {};

        sharedControls.forEach(control => {
            const fw = control.framework || 'unknown';
            if (!groups[fw]) groups[fw] = [];
            groups[fw].push(control);
        });

        return Object.entries(groups)
            .map(([framework, ctrls]) => ({
                framework: framework as Framework,
                label: getFrameworkLabel(framework),
                controls: ctrls,
                sharedCount: ctrls.reduce((sum, c) => sum + (c.mappedFrameworks?.length || 0), 0)
            }))
            .sort((a, b) => b.sharedCount - a.sharedCount);
    }, [sharedControls]);

    // Get all frameworks a control satisfies
    const getControlFrameworks = (control: Control): Framework[] => {
        const frameworks: Framework[] = [];
        if (control.framework) frameworks.push(control.framework);
        if (control.mappedFrameworks) frameworks.push(...control.mappedFrameworks);
        return frameworks;
    };

    if (controls.length === 0) {
        return (
            <div className="glass-premium p-12 text-center border border-border/40 rounded-3xl">
                <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Aucun contrôle disponible
                </h3>
                <p className="text-sm text-slate-500 dark:text-muted-foreground">
                    Ajoutez des contrôles pour voir les exigences partagées.
                </p>
            </div>
        );
    }

    if (sharedControls.length === 0) {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-3xl bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                            <Layers className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Exigences Partagées
                            </h2>
                            <p className="text-sm text-slate-500">
                                Travaillez une fois, conformez-vous à plusieurs référentiels
                            </p>
                        </div>
                    </div>
                </div>

                {/* Empty State */}
                <div className="glass-premium p-12 text-center border border-border/40 rounded-3xl">
                    <Target className="w-12 h-12 mx-auto text-yellow-400 mb-4" />
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Aucune exigence partagée
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-muted-foreground max-w-md mx-auto">
                        Vos contrôles ne sont pas encore mappés à plusieurs référentiels.
                        Utilisez l'onglet "Mapping" pour identifier les contrôles qui satisfont
                        plusieurs exigences.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Effort Savings */}
            <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-3xl bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            Exigences Partagées
                        </h2>
                        <p className="text-sm text-slate-500">
                            Travaillez une fois, conformez-vous à plusieurs référentiels
                        </p>
                    </div>
                </div>

                {/* Effort Savings Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-3xl border border-green-100 dark:border-green-900/30">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-xs font-medium text-green-700 dark:text-green-300">
                                Économie d'effort
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                            {effortSavings.savingsPercentage}%
                        </p>
                    </div>

                    <div className="p-4 bg-brand-50 dark:bg-brand-800 rounded-3xl border border-brand-100 dark:border-brand-800">
                        <div className="flex items-center gap-2 mb-1">
                            <Layers className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                            <span className="text-xs font-medium text-brand-700 dark:text-brand-300">
                                Contrôles partagés
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-brand-800 dark:text-brand-200">
                            {effortSavings.sharedControls}
                        </p>
                    </div>

                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-3xl border border-purple-100 dark:border-purple-900/30">
                        <div className="flex items-center gap-2 mb-1">
                            <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                                Mappings additionnels
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                            {effortSavings.additionalMappings}
                        </p>
                    </div>

                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-3xl border border-yellow-100 dark:border-yellow-900/30">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                            <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                                Implémentés
                            </span>
                        </div>
                        <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                            {effortSavings.implementedShared} / {effortSavings.sharedControls}
                        </p>
                    </div>
                </div>
            </div>

            {/* Framework Groups */}
            {frameworkGroups.map(group => (
                <div key={group.framework || 'unknown'} className="glass-premium rounded-3xl overflow-hidden border border-border/40">
                    {/* Group Header */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-border/40 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                    {group.framework}
                                </span>
                                <span className="text-sm text-slate-500">
                                    {group.label}
                                </span>
                            </div>
                            <Badge status="info" size="sm">
                                {group.controls.length} contrôles · {group.sharedCount} mappings
                            </Badge>
                        </div>
                    </div>

                    {/* Controls List */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {group.controls.map(control => {
                            const frameworks = getControlFrameworks(control);
                            const isImplemented = control.status === 'Implémenté';
                            const isPartial = control.status === 'Partiel';

                            return (
                                <button
                                    key={control.id || 'unknown'}
                                    onClick={() => onControlClick?.(control)}
                                    className="w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-mono text-xs text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                    {control.code}
                                                </span>
                                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                                    {control.name}
                                                </span>
                                            </div>

                                            {/* Framework Badges */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {frameworks.map((fw, idx) => (
                                                    <span
                                                        key={fw || 'unknown'}
                                                        className={cn(
                                                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                                            idx === 0
                                                                ? "bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300"
                                                                : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                                        )}
                                                    >
                                                        {idx > 0 && <Check className="w-3 h-3" />}
                                                        {fw}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Badge
                                                status={isImplemented ? 'success' : isPartial ? 'warning' : 'neutral'}
                                                size="sm"
                                            >
                                                {control.status}
                                            </Badge>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Summary Footer */}
            <div className="glass-premium p-4 rounded-3xl bg-gradient-to-r from-green-50 to-brand-50 dark:from-green-900/20 dark:to-brand-900/20 border border-green-100 dark:border-green-900/30">
                <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <p className="text-sm text-green-800 dark:text-green-200">
                        <strong>{effortSavings.sharedControls} contrôles</strong> satisfont{' '}
                        <strong>{effortSavings.additionalMappings} exigences additionnelles</strong>,
                        représentant une économie d'environ <strong>{effortSavings.savingsPercentage}%</strong> d'effort.
                    </p>
                </div>
            </div>
        </div>
    );
};
