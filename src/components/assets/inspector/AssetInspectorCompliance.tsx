import React from 'react';
import { Shield, HeartPulse } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import type { Asset, BusinessProcess, Control } from '../../../types';

interface AssetInspectorComplianceProps {
    selectedAsset: Asset;
    linkedControls: Control[];
    processes: BusinessProcess[];
}

export const AssetInspectorCompliance: React.FC<AssetInspectorComplianceProps> = ({
    selectedAsset,
    linkedControls,
    processes
}) => {
    return (
        <div className="space-y-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center">
                <Shield className="h-4 w-4 mr-2" /> Contrôles de Sécurité ({linkedControls.length})
            </h3>
            {linkedControls.length === 0 ? (
                <EmptyState compact icon={Shield} title="Aucun contrôle" description="Aucun contrôle associé." />
            ) : (
                <div className="grid gap-4">
                    {linkedControls.map(ctrl => (
                        <div key={ctrl.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {ctrl.code}
                                </span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${ctrl.status === 'Implémenté' ? 'bg-green-100 text-green-700' : ctrl.status === 'Partiel' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                    {ctrl.status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{ctrl.name}</p>
                            <div className="text-[10px] text-slate-400">Type: {ctrl.type || 'Non défini'}</div>
                        </div>
                    ))}
                </div>
            )}
            <p className="text-xs text-slate-400 text-center mt-4">Les contrôles sont gérés dans le module Conformité.</p>

            {/* Supported Processes */}
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center">
                    <HeartPulse className="h-4 w-4 mr-2" /> Processus Supportés
                </h3>
                {(() => {
                    const supported = processes.filter(p => p.supportingAssetIds?.includes(selectedAsset.id));
                    return supported.length > 0 ? (
                        <div className="space-y-2">
                            {supported.map(p => (
                                <div key={p.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-700 dark:text-white">{p.name}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${p.priority === 'Critique' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{p.priority}</span>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-sm text-slate-500 italic">Cet actif ne supporte aucun processus critique.</p>;
                })()}
            </div>
        </div>
    );
};
