import React from 'react';
import { Incident, Asset, BusinessProcess, Risk } from '../../../types';
import { Server, Activity, AlertTriangle } from '../../ui/Icons';
import { Badge } from '../../ui/Badge';

interface IncidentImpactDetailsProps {
    incident: Incident;
    assets: Asset[];
    processes: BusinessProcess[];
    risks: Risk[];
}

export const IncidentImpactDetails: React.FC<IncidentImpactDetailsProps> = ({
    incident,
    assets,
    processes,
    risks
}) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Actif Impacté
                    </h3>
                    {incident.affectedAssetId ? (
                        <div className="space-y-2">
                            {(() => {
                                const asset = assets.find(a => a.id === incident.affectedAssetId);
                                return asset ? (
                                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">{asset.name}</span>
                                        <Badge status="neutral" size="sm">{asset.type}</Badge>
                                    </div>
                                ) : <p className="text-sm text-slate-600 italic">Actif introuvable</p>;
                            })()}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-600 italic">Aucun actif lié</p>
                    )}
                </div>
            </div>

            <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Service Impacté
                    </h3>
                    {incident.affectedProcessId ? (
                        <div className="space-y-2">
                            {(() => {
                                const proc = processes.find(p => p.id === incident.affectedProcessId);
                                return proc ? (
                                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">{proc.name}</span>
                                    </div>
                                ) : <p className="text-sm text-slate-600 italic">Processus introuvable</p>;
                            })()}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-600 italic">Aucun service lié</p>
                    )}
                </div>
            </div>

            <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden md:col-span-2">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Risque Lié
                    </h3>
                    {incident.relatedRiskId ? (
                        <div className="space-y-2">
                            {(() => {
                                const risk = risks.find(r => r.id === incident.relatedRiskId);
                                return risk ? (
                                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{risk.threat}</span>
                                            <span className="text-xs text-slate-500">{risk.scenario}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs font-bold uppercase text-slate-500">Score</span>
                                            <span className={`font-bold ${risk.score >= 15 ? 'text-red-500' : risk.score >= 8 ? 'text-orange-500' : 'text-emerald-500'}`}>
                                                {risk.score}/25
                                            </span>
                                        </div>
                                    </div>
                                ) : <p className="text-sm text-slate-600 italic">Risque introuvable</p>;
                            })()}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-600 italic">Aucun risque lié</p>
                    )}
                </div>
            </div>
        </div>
    );
};
