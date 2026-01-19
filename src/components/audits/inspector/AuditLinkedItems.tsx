/**
 * AuditLinkedItems - Displays linked items in audit inspector
 *
 * Shows linked controls, risks, assets, and projects with navigation.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, ExternalLink, CheckCircle2, AlertTriangle, Clock,
    Server, ShieldAlert, FolderKanban, Link as LinkIcon
} from '../../ui/Icons';
import { Audit, Control, Risk, Asset, Project } from '../../../types';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/button';

interface AuditLinkedItemsProps {
    audit: Audit;
    controls: Control[];
    risks: Risk[];
    assets: Asset[];
    projects: Project[];
}

/**
 * Get control status icon and color
 */
function getControlStatusStyle(status: string): { icon: React.ReactNode; color: string } {
    const isImplemented = status === 'Implémenté' || status === 'Actif';
    const isPartial = status === 'Partiel' || status === 'En cours';

    if (isImplemented) {
        return {
            icon: <CheckCircle2 className="h-4 w-4" />,
            color: 'text-emerald-500'
        };
    }
    if (isPartial) {
        return {
            icon: <Clock className="h-4 w-4" />,
            color: 'text-amber-500'
        };
    }
    return {
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'text-slate-400'
    };
}

/**
 * Get risk level from score
 */
function getRiskLevelFromScore(score: number): string {
    if (score >= 15) return 'Critique';
    if (score >= 10) return 'Élevé';
    if (score >= 5) return 'Moyen';
    return 'Faible';
}

/**
 * Get risk level badge styling
 */
function getRiskLevelStyle(score: number): 'error' | 'warning' | 'info' | 'success' {
    if (score >= 15) return 'error';
    if (score >= 10) return 'error';
    if (score >= 5) return 'warning';
    return 'success';
}

export const AuditLinkedItems: React.FC<AuditLinkedItemsProps> = ({
    audit,
    controls,
    risks,
    assets,
    projects
}) => {
    const navigate = useNavigate();

    // Get linked items with full details
    const linkedControls = useMemo(() => {
        return (audit.relatedControlIds || [])
            .map(id => controls.find(c => c.id === id))
            .filter((c): c is Control => c !== undefined);
    }, [audit.relatedControlIds, controls]);

    const linkedRisks = useMemo(() => {
        return (audit.relatedRiskIds || [])
            .map(id => risks.find(r => r.id === id))
            .filter((r): r is Risk => r !== undefined);
    }, [audit.relatedRiskIds, risks]);

    const linkedAssets = useMemo(() => {
        return (audit.relatedAssetIds || [])
            .map(id => assets.find(a => a.id === id))
            .filter((a): a is Asset => a !== undefined);
    }, [audit.relatedAssetIds, assets]);

    const linkedProjects = useMemo(() => {
        return (audit.relatedProjectIds || [])
            .map(id => projects.find(p => p.id === id))
            .filter((p): p is Project => p !== undefined);
    }, [audit.relatedProjectIds, projects]);

    const hasNoLinkedItems =
        linkedControls.length === 0 &&
        linkedRisks.length === 0 &&
        linkedAssets.length === 0 &&
        linkedProjects.length === 0;

    if (hasNoLinkedItems) {
        return (
            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                    <LinkIcon className="h-4 w-4 text-brand-500" />
                    Éléments Liés
                </h3>
                <div className="text-center py-8">
                    <LinkIcon className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Aucun élément lié à cet audit</p>
                    <p className="text-xs text-slate-400 mt-1">
                        Liez des contrôles, risques, actifs ou projets dans l'onglet Détails
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Linked Controls */}
            {linkedControls.length > 0 && (
                <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <Shield className="h-4 w-4 text-brand-500" />
                        Contrôles Audités ({linkedControls.length})
                    </h3>
                    <div className="space-y-2">
                        {linkedControls.map(ctrl => {
                            const { icon, color } = getControlStatusStyle(ctrl.status);
                            const isImplemented = ctrl.status === 'Implémenté' || ctrl.status === 'Actif';
                            const isPartial = ctrl.status === 'Partiel' || ctrl.status === 'En cours';

                            return (
                                <div
                                    key={ctrl.id}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm group hover:shadow-md transition-all"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={color}>{icon}</div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                {ctrl.code} - {ctrl.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                {ctrl.framework && (
                                                    <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
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
                                        onClick={() => navigate(`/compliance?control=${ctrl.id}`)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label={`Voir le contrôle ${ctrl.name}`}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Linked Risks */}
            {linkedRisks.length > 0 && (
                <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <ShieldAlert className="h-4 w-4 text-rose-500" />
                        Risques Associés ({linkedRisks.length})
                    </h3>
                    <div className="space-y-2">
                        {linkedRisks.map(risk => (
                            <div
                                key={risk.id}
                                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm group hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                            {risk.threat}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <Badge
                                                status={getRiskLevelStyle(risk.residualScore ?? risk.score)}
                                                variant="soft"
                                                size="sm"
                                            >
                                                {getRiskLevelFromScore(risk.residualScore ?? risk.score)}
                                            </Badge>
                                            <Badge
                                                status={risk.status === 'Ouvert' || risk.status === 'En cours' ? 'warning' : 'success'}
                                                variant="soft"
                                                size="sm"
                                            >
                                                {risk.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/risks?risk=${risk.id}`)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label={`Voir le risque ${risk.threat}`}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Linked Assets */}
            {linkedAssets.length > 0 && (
                <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <Server className="h-4 w-4 text-cyan-500" />
                        Actifs Concernés ({linkedAssets.length})
                    </h3>
                    <div className="space-y-2">
                        {linkedAssets.map(asset => (
                            <div
                                key={asset.id}
                                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm group hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <Server className="h-4 w-4 text-cyan-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                            {asset.name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-xs text-slate-500">
                                                {asset.type}
                                            </span>
                                            {asset.confidentiality && (
                                                <Badge
                                                    status={asset.confidentiality === 'Critique' ? 'error' :
                                                            asset.confidentiality === 'Élevée' ? 'warning' : 'info'}
                                                    variant="soft"
                                                    size="sm"
                                                >
                                                    C:{asset.confidentiality}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/assets?asset=${asset.id}`)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label={`Voir l'actif ${asset.name}`}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Linked Projects */}
            {linkedProjects.length > 0 && (
                <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                        <FolderKanban className="h-4 w-4 text-indigo-500" />
                        Projets Liés ({linkedProjects.length})
                    </h3>
                    <div className="space-y-2">
                        {linkedProjects.map(project => (
                            <div
                                key={project.id}
                                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm group hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <FolderKanban className="h-4 w-4 text-indigo-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                            {project.name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <Badge
                                                status={project.status === 'Terminé' ? 'success' :
                                                        project.status === 'En cours' ? 'warning' : 'info'}
                                                variant="soft"
                                                size="sm"
                                            >
                                                {project.status}
                                            </Badge>
                                            {project.progress !== undefined && (
                                                <span className="text-xs text-slate-500">
                                                    {project.progress}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/projects?project=${project.id}`)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label={`Voir le projet ${project.name}`}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLinkedItems;
