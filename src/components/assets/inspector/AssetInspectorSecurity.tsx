import React, { useCallback } from 'react';
import { Search, ShieldAlert, Server, Plus, Flame, Siren } from '../../ui/Icons';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import { Asset, Risk, Incident, Vulnerability } from '../../../types';

export interface ShodanResult {
    ip_str?: string;
    os?: string;
    ports?: number[];
    org?: string;
}

interface AssetInspectorSecurityProps {
    selectedAsset: Asset;
    scanning: boolean;
    shodanResult: ShodanResult | null;
    vulnerabilities: Vulnerability[];
    linkedRisks: Risk[];
    linkedIncidents: Incident[];
    scanShodan: () => void;
    checkCVEs: () => void;
    createRiskFromVuln: (vuln: Vulnerability) => void;
    navigate: (path: string, state?: Record<string, unknown>) => void;
}

export const AssetInspectorSecurity: React.FC<AssetInspectorSecurityProps> = ({
    selectedAsset,
    scanning,
    shodanResult,
    vulnerabilities,
    linkedRisks,
    linkedIncidents,
    scanShodan,
    checkCVEs,
    createRiskFromVuln,
    navigate
}) => {
    const handleCreateRisk = useCallback(() => {
        navigate('/risks', { state: { createForAsset: selectedAsset.id, assetName: selectedAsset.name } });
    }, [navigate, selectedAsset.id, selectedAsset.name]);

    const handleCreateIncident = useCallback(() => {
        navigate('/incidents', { state: { createForAsset: selectedAsset.id, assetName: selectedAsset.name } });
    }, [navigate, selectedAsset.id, selectedAsset.name]);

    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="flex gap-4">
                <CustomTooltip content="Scanner l'actif avec Shodan.io">
                    <button
                        type="button"
                        onClick={scanShodan}
                        disabled={scanning}
                        aria-label="Lancer un scan Shodan"
                        className="flex-1 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                        {scanning ? <span className="animate-spin mr-2">⏳</span> : <Search className="w-4 h-4 mr-2" />}
                        Scan Shodan
                    </button>
                </CustomTooltip>
                <CustomTooltip content="Rechercher des CVEs (NVD)">
                    <button
                        type="button"
                        onClick={checkCVEs}
                        disabled={scanning}
                        aria-label="Rechercher des vulnérabilités CVE"
                        className="flex-1 py-3 bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white rounded-xl text-sm font-bold shadow-sm hover:bg-slate-200 dark:hover:bg-white/20 transition-colors flex items-center justify-center disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                        {scanning ? <span className="animate-spin mr-2">⏳</span> : <ShieldAlert className="w-4 h-4 mr-2" />}
                        Check CVEs (NVD)
                    </button>
                </CustomTooltip>
            </div>

            {shodanResult && (
                <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4 flex items-center">
                        <Server className="h-4 w-4 mr-2" /> Résultat Shodan
                    </h3>
                    <div className="space-y-2 text-sm font-mono">
                        <p><span className="text-slate-500">IP:</span> {shodanResult.ip_str}</p>
                        <p><span className="text-slate-500">OS:</span> {shodanResult.os || 'N/A'}</p>
                        <p><span className="text-slate-500">Ports:</span> {shodanResult.ports?.join(', ') || 'None'}</p>
                        <p><span className="text-slate-500">Org:</span> {shodanResult.org || 'N/A'}</p>
                    </div>
                </div>
            )}

            {vulnerabilities.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/30">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-4 flex items-center">
                        <ShieldAlert className="h-4 w-4 mr-2" /> Vulnérabilités NVD ({vulnerabilities.length})
                    </h3>
                    <div className="space-y-3">
                        {vulnerabilities.map(vuln => (
                            <div key={vuln.cveId} className="p-4 bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm rounded-xl border border-red-200/60 dark:border-red-900/30 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-sm font-bold text-red-700 dark:text-red-400">{vuln.cveId}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold px-2.5 py-1 bg-red-500/15 text-red-700 dark:text-red-400 rounded-lg ring-1 ring-red-500/20">{vuln.severity} ({vuln.score})</span>
                                        <CustomTooltip content="Créer un risque">
                                            <button
                                                onClick={() => createRiskFromVuln(vuln)}
                                                aria-label={`Créer un risque pour ${vuln.cveId}`}
                                                className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-600 dark:text-red-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </CustomTooltip>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2" title={vuln.description}>{vuln.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center">
                        <ShieldAlert className="h-4 w-4 mr-2" /> Risques Identifiés ({linkedRisks.length})
                    </h3>
                    <button
                        type="button"
                        onClick={handleCreateRisk}
                        aria-label="Créer un nouveau risque"
                        className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
                    >
                        <Plus className="h-3 w-3 mr-1" /> Nouveau Risque
                    </button>
                </div>
                {linkedRisks.length === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun risque associé.</p>
                ) : (
                    <div className="grid gap-4">
                        {linkedRisks.map(risk => (
                            <div key={risk.id} className="p-5 glass-panel rounded-3xl border border-white/60 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{risk.threat}</span>
                                    <span className={`text-[10px] px-2 py-1 rounded-lg font-bold ${risk.score >= 15 ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'}`}>Score {risk.score}</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-muted-foreground mb-3">{risk.vulnerability}</p>
                                {risk.score >= 15 && <div className="flex items-center text-[10px] text-red-600 font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-xl w-fit"><Flame className="h-3 w-3 mr-1.5" /> Risque Critique</div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center">
                        <Siren className="h-4 w-4 mr-2" /> Incidents ({linkedIncidents.length})
                    </h3>
                    <button
                        type="button"
                        onClick={handleCreateIncident}
                        aria-label="Signaler un incident"
                        className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
                    >
                        <Plus className="h-3 w-3 mr-1" /> Signaler Incident
                    </button>
                </div>
                {linkedIncidents.length === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun incident signalé.</p>
                ) : (
                    <div className="grid gap-4">
                        {linkedIncidents.map(inc => (
                            <div key={inc.id} className="p-5 glass-panel rounded-3xl border border-white/60 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{inc.title}</span>
                                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${inc.status === 'Résolu' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inc.status}</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-muted-foreground mb-2">{new Date(inc.dateReported).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
