import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Incident, Asset, BusinessProcess, Risk } from '../../../types';
import { Server, Activity, AlertTriangle } from '../../ui/Icons';
import { RISK_THRESHOLDS } from '../../../constants/complianceConfig';
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
    const navigate = useNavigate();
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-4 sm:p-6 rounded-xl border border-border/40 shadow-premium relative overflow-hidden glass-premium">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10">
                    <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" />
                        Actif Impacté
                    </h3>
                    {incident.affectedAssetId ? (
                        <div className="space-y-2">
                            {(() => {
                                const asset = assets.find(a => a.id === incident.affectedAssetId);
                                return asset ? (
                                    <div
                                        onClick={() => navigate(`/assets?id=${asset.id}`)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/assets?id=${asset.id}`); } }}
                                        className="flex items-center justify-between p-3 bg-muted/10 rounded-xl border border-border/40 cursor-pointer hover:shadow-md hover:ring-2 hover:ring-brand-500/30 transition-all"
                                    >
                                        <span className="font-medium text-foreground">{asset.name}</span>
                                        <Badge status="neutral" size="sm" variant="soft">{asset.type}</Badge>
                                    </div>
                                ) : <p className="text-sm text-muted-foreground italic">Actif introuvable</p>;
                            })()}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">Aucun actif lié</p>
                    )}
                </div>
            </div>

            <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-4 sm:p-6 rounded-xl border border-border/40 shadow-premium relative overflow-hidden glass-premium">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10">
                    <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Service Impacté
                    </h3>
                    {incident.affectedProcessId ? (
                        <div className="space-y-2">
                            {(() => {
                                const proc = processes.find(p => p.id === incident.affectedProcessId);
                                return proc ? (
                                    <div
                                        onClick={() => navigate(`/continuity?id=${proc.id}`)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/continuity?id=${proc.id}`); } }}
                                        className="flex items-center justify-between p-3 bg-muted/10 rounded-xl border border-border/40 cursor-pointer hover:shadow-md hover:ring-2 hover:ring-brand-500/30 transition-all"
                                    >
                                        <span className="font-medium text-foreground">{proc.name}</span>
                                    </div>
                                ) : <p className="text-sm text-muted-foreground italic">Processus introuvable</p>;
                            })()}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">Aucun service lié</p>
                    )}
                </div>
            </div>

            <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-4 sm:p-6 rounded-xl border border-border/40 shadow-premium relative overflow-hidden md:col-span-2 glass-premium">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10">
                    <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        Risque Lié
                    </h3>
                    {incident.relatedRiskId ? (
                        <div className="space-y-2">
                            {(() => {
                                const risk = risks.find(r => r.id === incident.relatedRiskId);
                                return risk ? (
                                    <div
                                        onClick={() => navigate(`/risks?id=${risk.id}`)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/risks?id=${risk.id}`); } }}
                                        className="flex items-center justify-between p-3 bg-muted/10 rounded-xl border border-border/40 cursor-pointer hover:shadow-md hover:ring-2 hover:ring-brand-500/30 transition-all"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{risk.threat}</span>
                                            <span className="text-xs text-muted-foreground">{risk.scenario}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs font-bold uppercase text-muted-foreground">Score</span>
                                            <span className={`font-bold transition-colors ${risk.score >= RISK_THRESHOLDS.CRITICAL ? 'text-destructive' : risk.score >= RISK_THRESHOLDS.HIGH ? 'text-warning' : 'text-success'}`}>
                                                {risk.score}/25
                                            </span>
                                        </div>
                                    </div>
                                ) : <p className="text-sm text-muted-foreground italic">Risque introuvable</p>;
                            })()}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">Aucun risque lié</p>
                    )}
                </div>
            </div>
        </div>
    );
};
