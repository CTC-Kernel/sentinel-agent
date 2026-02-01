import React from 'react';
import { useStore } from '../../../store';
import { Server, Truck, AlertTriangle } from '../../ui/Icons';
import { Badge } from '../../ui/Badge';
import { Asset, Supplier, Risk } from '../../../types';
import { RISK_THRESHOLDS } from '../../../constants/complianceConfig';

interface ProcessDependenciesProps {
    linkedAssets: Asset[];
    linkedSuppliers: Supplier[];
    linkedRisks: Risk[];
}

export const ProcessDependencies: React.FC<ProcessDependenciesProps> = ({ linkedAssets, linkedSuppliers, linkedRisks }) => {
    const { t } = useStore();

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Assets */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <Server className="h-4 w-4" /> {t('continuity.assetsSupport')} ({linkedAssets.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                    {linkedAssets.length > 0 ? linkedAssets.map(a => (
                        <div key={a.id || 'unknown'} className="p-3 bg-white dark:bg-white/5 rounded-3xl border border-border/40 dark:border-border/40 shadow-sm flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.name}</span>
                        </div>
                    )) : <p className="text-sm text-slate-500 dark:text-slate-300 italic">Aucun actif support lié.</p>}
                </div>
            </div>

            {/* Suppliers */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <Truck className="h-4 w-4" /> {t('common.suppliers')} ({linkedSuppliers.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                    {linkedSuppliers.length > 0 ? linkedSuppliers.map(s => (
                        <div key={s.id || 'unknown'} className="p-3 bg-white dark:bg-white/5 rounded-3xl border border-border/40 dark:border-border/40 shadow-sm flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.name}</span>
                        </div>
                    )) : <p className="text-sm text-slate-500 dark:text-slate-300 italic">Aucun fournisseur lié.</p>}
                </div>
            </div>

            {/* Risks */}
            <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> {t('common.associatedRisks')} ({linkedRisks.length})
                </h3>
                <div className="grid gap-3">
                    {linkedRisks.length > 0 ? linkedRisks.map(r => (
                        <div key={r.id || 'unknown'} className="flex justify-between items-center p-4 bg-white dark:bg-white/5 rounded-3xl border border-border/40 dark:border-border/40 shadow-sm">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{r.threat}</span>
                            <Badge status={r.score >= RISK_THRESHOLDS.CRITICAL ? 'error' : r.score >= RISK_THRESHOLDS.HIGH ? 'warning' : 'info'}>
                                Score: {r.score}/25
                            </Badge>
                        </div>
                    )) : <p className="text-sm text-slate-500 dark:text-slate-300 italic">Aucun risque associé.</p>}
                </div>
            </div>
        </div>
    );
};
