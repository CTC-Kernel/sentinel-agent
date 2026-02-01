/**
 * RiskLinkedControls - Displays linked controls in risk inspector (Story 3.3)
 *
 * Shows linked security controls with their implementation status,
 * framework, and calculates aggregate mitigation coverage.
 */

import React, { useMemo } from 'react';
import { Shield, ExternalLink, CheckCircle2, AlertTriangle, Clock } from '../../ui/Icons';
import { useNavigate } from 'react-router-dom';
import { Risk, Control } from '../../../types';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/button';
import { calculateMitigationCoverage } from '../../../utils/riskEvaluation';
import { CONTROL_STATUS } from '../../../constants/complianceConfig';

interface RiskLinkedControlsProps {
    risk: Risk;
    controls: Control[];
}

/**
 * Get control status icon and color
 */
function getControlStatusStyle(status: string): { icon: React.ReactNode; color: string } {
    const isImplemented = status === CONTROL_STATUS.IMPLEMENTED;
    const isPartial = status === CONTROL_STATUS.PARTIAL || status === CONTROL_STATUS.IN_PROGRESS;

    if (isImplemented) {
        return {
            icon: <CheckCircle2 className="h-4 w-4" />,
            color: 'text-success-text'
        };
    }
    if (isPartial) {
        return {
            icon: <Clock className="h-4 w-4" />,
            color: 'text-warning-text'
        };
    }
    return {
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'text-slate-400'
    };
}

export const RiskLinkedControls: React.FC<RiskLinkedControlsProps> = ({
    risk,
    controls
}) => {
    const navigate = useNavigate();

    // Get linked controls with full details
    const linkedControls = useMemo(() => {
        return (risk.mitigationControlIds || [])
            .map(id => controls.find(c => c.id === id))
            .filter((c): c is Control => c !== undefined);
    }, [risk.mitigationControlIds, controls]);

    // Calculate mitigation coverage
    const mitigationCoverage = useMemo(() =>
        calculateMitigationCoverage(linkedControls),
        [linkedControls]
    );

    // Count by status
    const statusCounts = useMemo(() => {
        const counts = { implemented: 0, partial: 0, notStarted: 0 };
        linkedControls.forEach(ctrl => {
            if (ctrl.status === CONTROL_STATUS.IMPLEMENTED) {
                counts.implemented++;
            } else if (ctrl.status === CONTROL_STATUS.PARTIAL || ctrl.status === CONTROL_STATUS.IN_PROGRESS) {
                counts.partial++;
            } else {
                counts.notStarted++;
            }
        });
        return counts;
    }, [linkedControls]);

    // Navigate to control
    const handleControlClick = (controlId: string) => {
        navigate(`/compliance?control=${controlId}`);
    };

    if (linkedControls.length === 0) {
        return (
            <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    <Shield className="h-4 w-4 text-brand-500" />
                    Contrôles Liés
                </h3>
                <div className="text-center py-8">
                    <Shield className="h-12 w-12 text-slate-300 dark:text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Aucun contrôle de sécurité lié</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Ajoutez des contrôles dans l'onglet Traitement pour réduire le risque résiduel
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Shield className="h-4 w-4 text-brand-500" />
                    Contrôles Liés ({linkedControls.length})
                </h3>
            </div>

            {/* Coverage Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Mitigation Coverage */}
                <div className="sm:col-span-2 p-4 bg-white dark:bg-slate-800 rounded-3xl border border-border/40 dark:border-border/40">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                            Couverture de Mitigation
                        </span>
                        <span className={`text-lg font-black ${mitigationCoverage >= 80 ? 'text-success-text' :
                            mitigationCoverage >= 50 ? 'text-warning-text' : 'text-error-text'
                            }`}>
                            {mitigationCoverage}%
                        </span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${mitigationCoverage >= 80 ? 'bg-success-text' :
                                mitigationCoverage >= 50 ? 'bg-warning-text' : 'bg-error-text'
                                }`}
                            style={{ width: `${mitigationCoverage}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-2">
                        Basé sur le statut d'implémentation des contrôles liés
                    </p>
                </div>

                {/* Status Counts */}
                <div className="p-4 bg-success-bg dark:bg-success-bg/20 rounded-3xl border border-success-border dark:border-success-border/30 text-center">
                    <div className="text-2xl font-black text-success-text dark:text-success-text">
                        {statusCounts.implemented}
                    </div>
                    <div className="text-xs font-medium text-success-text dark:text-success-text/80">Implémentés</div>
                </div>

                <div className="p-4 bg-warning-bg dark:bg-warning-bg/20 rounded-3xl border border-warning-border dark:border-warning-border/30 text-center">
                    <div className="text-2xl font-black text-warning-text dark:text-warning-text">
                        {statusCounts.partial + statusCounts.notStarted}
                    </div>
                    <div className="text-xs font-medium text-warning-text dark:text-warning-text/80">En attente</div>
                </div>
            </div>

            {/* Controls List */}
            <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                    Détail des Contrôles
                </h4>
                <div className="space-y-2">
                    {linkedControls.map(ctrl => {
                        const { icon, color } = getControlStatusStyle(ctrl.status);
                        const isImplemented = ctrl.status === CONTROL_STATUS.IMPLEMENTED;
                        const isPartial = ctrl.status === CONTROL_STATUS.PARTIAL || ctrl.status === CONTROL_STATUS.IN_PROGRESS;

                        return (
                            <div
                                key={ctrl.id || 'unknown'}
                                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-3xl border border-border/40 dark:border-slate-700 shadow-sm group hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={color}>{icon}</div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                            {ctrl.code} - {ctrl.name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            {ctrl.framework && (
                                                <span className="text-xs text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                    {ctrl.framework}
                                                </span>
                                            )}
                                            <Badge
                                                status={isImplemented ? 'success' : isPartial ? 'warning' : 'info'}
                                                variant="soft"
                                                size="sm"
                                            >
                                                {ctrl.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleControlClick(ctrl.id)}
                                    className="opacity-0 group-hover:opacity-70 transition-opacity"
                                    aria-label={`Voir le contrôle ${ctrl.name}`}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default RiskLinkedControls;
