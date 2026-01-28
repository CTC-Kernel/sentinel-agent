import React from 'react';
import { History } from '../../ui/Icons';
import { ResourceHistory } from '../../shared/ResourceHistory';
import { Asset } from '../../../types';

interface AssetInspectorHistoryProps {
    selectedAsset: Asset;
}

export const AssetInspectorHistory: React.FC<AssetInspectorHistoryProps> = ({
    selectedAsset
}) => {
    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-6 flex items-center">
                    <History className="h-4 w-4 mr-2" /> Historique DICP
                </h3>
                {!selectedAsset.history || selectedAsset.history.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-300 italic">Aucune modification enregistrée.</p>
                ) : (
                    <div className="space-y-4">
                        {selectedAsset.history.slice().reverse().map((h, i) => (
                            <div key={`rec-${i}`} className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-600 dark:text-muted-foreground">{new Date(h.date).toLocaleString()}</span>
                                    <span className="text-xs font-medium text-slate-500">par {h.userName}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="flex flex-col items-center p-2 rounded-xl bg-white dark:bg-black/20">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-300 uppercase">Confidentialité</span>
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className="line-through opacity-60">{h.previousConfidentiality}</span>
                                            <span>→</span>
                                            <span className="font-bold">{h.newConfidentiality}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center p-2 rounded-xl bg-white dark:bg-black/20">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-300 uppercase">Intégrité</span>
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className="line-through opacity-60">{h.previousIntegrity}</span>
                                            <span>→</span>
                                            <span className="font-bold">{h.newIntegrity}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center p-2 rounded-xl bg-white dark:bg-black/20">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-300 uppercase">Disponibilité</span>
                                        <div className="flex items-center gap-1 mt-1">
                                            <span className="line-through opacity-60">{h.previousAvailability}</span>
                                            <span>→</span>
                                            <span className="font-bold">{h.newAvailability}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="px-1">
                <ResourceHistory resourceId={selectedAsset.id} resourceType="Asset" />
            </div>
        </div>
    );
};
