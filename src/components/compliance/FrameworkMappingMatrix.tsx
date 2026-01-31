/**
 * Framework Mapping Matrix Component
 * Story 4.2: Cross-Framework Control Mapping
 * Displays a matrix showing control → framework relationships with coverage stats
 */

import React, { useMemo, useState } from 'react';
import { Control, Framework } from '../../types';
import { FRAMEWORKS } from '../../data/frameworks';
import { Check, AlertTriangle, ChevronDown, ChevronUp, Layers } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { useLocale } from '@/hooks/useLocale';

interface FrameworkMappingMatrixProps {
    controls: Control[];
    enabledFrameworks?: Framework[];
    onControlClick?: (control: Control) => void;
}

interface FrameworkCoverage {
    id: Framework;
    label: string;
    mappedCount: number;
    totalControls: number;
    percentage: number;
    gaps: Control[];
}

export const FrameworkMappingMatrix: React.FC<FrameworkMappingMatrixProps> = ({
    controls,
    enabledFrameworks,
    onControlClick
}) => {
    const { t } = useLocale();
    const [expandedFramework, setExpandedFramework] = useState<Framework | null>(null);
    const [showGapsOnly, setShowGapsOnly] = useState(false);

    // Filter to only enabled compliance frameworks
    const activeFrameworks = useMemo(() => {
        return FRAMEWORKS.filter(f => {
            const isCompliance = f.type === 'Compliance';
            const isEnabled = !enabledFrameworks || enabledFrameworks.includes(f.id as Framework);
            return isCompliance && isEnabled;
        });
    }, [enabledFrameworks]);

    // Calculate coverage for each framework
    const frameworkCoverage = useMemo((): FrameworkCoverage[] => {
        return activeFrameworks.map(fw => {
            const fwId = fw.id as Framework;

            // Controls that map to this framework (primary or additional)
            const mappedControls = controls.filter(c =>
                c.framework === fwId || c.mappedFrameworks?.includes(fwId)
            );

            // Controls that could map to this framework but don't
            // (controls from other frameworks that might share requirements)
            const gaps = controls.filter(c =>
                c.framework !== fwId &&
                !c.mappedFrameworks?.includes(fwId) &&
                c.status === 'Implémenté' // Only implemented controls as potential mappings
            );

            const totalControls = controls.filter(c => c.framework === fwId).length;
            const percentage = totalControls > 0
                ? Math.round((mappedControls.length / totalControls) * 100)
                : 0;

            return {
                id: fwId,
                label: fw.label,
                mappedCount: mappedControls.length,
                totalControls,
                percentage,
                gaps
            };
        });
    }, [controls, activeFrameworks]);

    // Get framework label by id
    const getFrameworkLabel = (id: string) => FRAMEWORKS.find(f => f.id === id)?.label || id;

    // Check if a control maps to a specific framework
    const controlMapsToFramework = (control: Control, frameworkId: Framework): boolean => {
        return control.framework === frameworkId || control.mappedFrameworks?.includes(frameworkId) || false;
    };

    // Filter controls based on showGapsOnly
    const displayedControls = useMemo(() => {
        if (!showGapsOnly) return controls;

        // Show controls that only map to their primary framework (have gaps)
        return controls.filter(c =>
            !c.mappedFrameworks || c.mappedFrameworks.length === 0
        );
    }, [controls, showGapsOnly]);

    if (controls.length === 0) {
        return (
            <div className="glass-premium p-12 text-center border border-border/40 rounded-3xl">
                <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">
                    {t('compliance.noControlsAvailable', { defaultValue: 'Aucun contrôle disponible' })}
                </h3>
                <p className="text-sm text-slate-500 dark:text-muted-foreground">
                    {t('compliance.addControlsForMapping', { defaultValue: 'Ajoutez des contrôles pour voir la matrice de mapping.' })}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Coverage Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {frameworkCoverage.map(fw => (
                    <button
                        key={fw.id}
                        onClick={() => setExpandedFramework(expandedFramework === fw.id ? null : fw.id)}
                        className={cn(
                            "glass-premium p-4 rounded-3xl text-left transition-all hover:shadow-md border border-border/40",
                            expandedFramework === fw.id && "ring-2 ring-brand-500"
                        )}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {fw.id}
                            </span>
                            <Badge
                                status={fw.percentage >= 80 ? 'success' : fw.percentage >= 50 ? 'warning' : 'error'}
                                size="sm"
                            >
                                {fw.percentage}%
                            </Badge>
                        </div>
                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {fw.mappedCount}
                                </p>
                                <p className="text-xs text-slate-500">
                                    contrôles mappés
                                </p>
                            </div>
                            {expandedFramework === fw.id ? (
                                <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                        </div>
                        {/* Coverage bar */}
                        <div className="mt-3 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all",
                                    fw.percentage >= 80 ? "bg-green-500" :
                                        fw.percentage >= 50 ? "bg-yellow-500" : "bg-red-500"
                                )}
                                style={{ width: `${fw.percentage}%` }}
                            />
                        </div>
                    </button>
                ))}
            </div>

            {/* Expanded Framework Details */}
            {expandedFramework && (
                <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-brand-200 dark:border-brand-800 animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {getFrameworkLabel(expandedFramework)}
                        </h3>
                        <button
                            onClick={() => setExpandedFramework(null)}
                            className="text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300"
                        >
                            Fermer
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        {(() => {
                            const coverage = frameworkCoverage.find(f => f.id === expandedFramework);
                            return coverage ? (
                                <>
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <p className="text-sm text-green-700 dark:text-green-300">Mappés</p>
                                        <p className="text-xl font-bold text-green-800 dark:text-green-200">{coverage.mappedCount}</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                        <p className="text-sm text-slate-600 dark:text-muted-foreground">Total référentiel</p>
                                        <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{coverage.totalControls}</p>
                                    </div>
                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                        <p className="text-sm text-yellow-700 dark:text-yellow-300">Mappings potentiels</p>
                                        <p className="text-xl font-bold text-yellow-800 dark:text-yellow-200">{coverage.gaps.length}</p>
                                    </div>
                                </>
                            ) : null;
                        })()}
                    </div>
                </div>
            )}

            {/* Matrix Controls */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    Matrice de Mapping
                </h3>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-muted-foreground">
                    <input
                        type="checkbox"
                        checked={showGapsOnly}
                        onChange={(e) => setShowGapsOnly(e.target.checked)}
                        className="rounded border-border/40 text-brand-600 focus-visible:ring-brand-500"
                    />
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Afficher les gaps uniquement
                </label>
            </div>

            {/* Matrix Table */}
            <div className="glass-premium rounded-3xl overflow-hidden border border-border/40">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50">
                                <th className="sticky left-0 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 min-w-[200px] z-10">
                                    Contrôle
                                </th>
                                {activeFrameworks.map(fw => (
                                    <th
                                        key={fw.id}
                                        className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]"
                                    >
                                        <span className="block text-xs">{fw.id}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {displayedControls.slice(0, 50).map(control => (
                                <tr
                                    key={control.id}
                                    className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                                    onClick={() => onControlClick?.(control)}
                                >
                                    <td className="sticky left-0 bg-white/95 dark:bg-slate-900/95 group-hover:bg-slate-50 dark:hover:bg-slate-800 dark:group-hover:bg-slate-800/30 px-4 py-3 z-10 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-slate-500">{control.code}</span>
                                            <span className="text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                                                {control.name}
                                            </span>
                                        </div>
                                    </td>
                                    {activeFrameworks.map(fw => {
                                        const isMapped = controlMapsToFramework(control, fw.id as Framework);
                                        const isPrimary = control.framework === fw.id;

                                        return (
                                            <td key={fw.id} className="px-4 py-3 text-center">
                                                {isMapped ? (
                                                    <div className={cn(
                                                        "inline-flex items-center justify-center w-6 h-6 rounded-full",
                                                        isPrimary
                                                            ? "bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400"
                                                            : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                                                    )}>
                                                        <Check className="w-4 h-4" />
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-700">—</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {displayedControls.length > 50 && (
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-center text-sm text-slate-500">
                        Affichage des 50 premiers contrôles sur {displayedControls.length}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                        <Check className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                    </div>
                    <span>Référentiel principal</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                    </div>
                    <span>Mapping additionnel</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-slate-300 dark:text-slate-700">—</span>
                    <span>Non mappé</span>
                </div>
            </div>
        </div>
    );
};
