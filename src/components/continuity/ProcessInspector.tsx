import React, { useState } from 'react';
import {
    Edit2, Trash2, HeartPulse, Clock, Server, Truck,
    AlertTriangle, Zap, Activity, History
} from 'lucide-react';
import { BusinessProcess, Asset, Supplier, Risk, BcpDrill } from '../../types';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Badge } from '../ui/Badge';
import { TimelineView } from '../shared/TimelineView';

interface ProcessInspectorProps {
    process: BusinessProcess | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit: (p: BusinessProcess) => void;
    onDelete: (id: string) => void;
    assets: Asset[];
    suppliers: Supplier[];
    risks: Risk[];
    drills: BcpDrill[];
}

export const ProcessInspector: React.FC<ProcessInspectorProps> = ({
    process, isOpen, onClose, onEdit, onDelete, assets, suppliers, risks, drills
}) => {
    // Note: 'any' cast used for setInspectorTab to avoid strict generic matching issues with the layout component,
    // though the types align.
    const [inspectorTab, setInspectorTab] = useState<'details' | 'dependencies' | 'drills' | 'history'>('details');

    if (!process) return null;

    const linkedAssets = assets.filter(a => process.supportingAssetIds?.includes(a.id));
    const linkedSuppliers = suppliers.filter(s => process.supplierIds?.includes(s.id));
    const linkedRisks = risks.filter(r => process.relatedRiskIds?.includes(r.id));

    const handleClose = () => {
        setInspectorTab('details');
        onClose();
    };

    const tabs = [
        { id: 'details', label: "Vue d'ensemble", icon: Activity },
        { id: 'dependencies', label: "Dépendances", icon: Server },
        { id: 'drills', label: "Exercices", icon: Zap },
        { id: 'history', label: "Historique", icon: History },
    ];

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={handleClose}
            title={process.name}
            subtitle={`Géré par ${process.owner}`}
            icon={HeartPulse}
            statusBadge={
                <Badge
                    status={
                        process.priority === 'Critique' ? 'error' :
                            process.priority === 'Élevée' ? 'warning' :
                                'info'
                    }
                >
                    {process.priority}
                </Badge>
            }
            tabs={tabs}
            activeTab={inspectorTab}
            onTabChange={(id) => setInspectorTab(id as 'details' | 'dependencies' | 'drills' | 'history')}
            actions={
                <div className="flex gap-2">
                    <button onClick={() => onDelete(process.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => onEdit(process)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors">
                        <Edit2 className="h-4 w-4" />
                    </button>
                </div>
            }
        >
            <div className="p-6 md:p-8 space-y-8 bg-slate-50/50 dark:bg-transparent min-h-full">
                {inspectorTab === 'details' && (
                    <div className="space-y-8">
                        {/* Metrics Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 bg-white dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Clock className="w-16 h-16" />
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="h-4 w-4 text-slate-500" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">RTO (Objectif Temps)</span>
                                </div>
                                <span className="text-3xl font-black text-slate-900 dark:text-white">{process.rto}</span>
                            </div>
                            <div className="p-6 bg-white dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Activity className="w-16 h-16" />
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Activity className="h-4 w-4 text-slate-500" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">RPO (Perte Données)</span>
                                </div>
                                <span className="text-3xl font-black text-slate-900 dark:text-white">{process.rpo}</span>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Description</h3>
                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{process.description}</p>
                        </div>

                        {/* Recovery Tasks */}
                        <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Plan de Reprise (Étapes)</h3>
                            <div className="space-y-3">
                                {process.recoveryTasks?.length ? process.recoveryTasks.map((task, i) => (
                                    <div key={i} className="flex gap-4 p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5 group hover:border-brand-200 dark:hover:border-brand-800 transition-colors">
                                        <div className="flex-none">
                                            <div className="w-8 h-8 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200 dark:border-white/10 shadow-sm">
                                                {i + 1}
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{task.title}</p>
                                            <div className="flex items-center gap-4">
                                                <Badge variant="soft" size="sm" className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10">
                                                    Resp: {task.owner}
                                                </Badge>
                                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {task.duration}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )) : <p className="text-sm text-slate-500 italic">Aucune étape définie</p>}
                            </div>
                        </div>
                    </div>
                )}

                {inspectorTab === 'dependencies' && (
                    <div className="space-y-8">
                        {/* Assets */}
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                                <Server className="h-4 w-4" /> Actifs Support ({linkedAssets.length})
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {linkedAssets.length > 0 ? linkedAssets.map(a => (
                                    <div key={a.id} className="p-3 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.name}</span>
                                    </div>
                                )) : <p className="text-sm text-slate-500 italic">Aucun actif support lié.</p>}
                            </div>
                        </div>

                        {/* Suppliers */}
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                                <Truck className="h-4 w-4" /> Fournisseurs ({linkedSuppliers.length})
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {linkedSuppliers.length > 0 ? linkedSuppliers.map(s => (
                                    <div key={s.id} className="p-3 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.name}</span>
                                    </div>
                                )) : <p className="text-sm text-slate-500 italic">Aucun fournisseur lié.</p>}
                            </div>
                        </div>

                        {/* Risks */}
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" /> Risques Associés ({linkedRisks.length})
                            </h3>
                            <div className="grid gap-3">
                                {linkedRisks.length > 0 ? linkedRisks.map(r => (
                                    <div key={r.id} className="flex justify-between items-center p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{r.threat}</span>
                                        <Badge status={r.score >= 15 ? 'error' : r.score >= 8 ? 'warning' : 'info'}>
                                            Score: {r.score}/25
                                        </Badge>
                                    </div>
                                )) : <p className="text-sm text-slate-500 italic">Aucun risque associé.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {inspectorTab === 'drills' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Exercices Récents</h3>
                            {/* Optional: Add button to log new drill if needed inside inspector */}
                        </div>

                        {drills.length > 0 ? (
                            <div className="space-y-3">
                                {drills.map(d => (
                                    <div key={d.id} className="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm hover:border-brand-200 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl ${d.result === 'Succès' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                <Zap className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white capitalize">{d.type}</p>
                                                <p className="text-xs text-slate-500">{new Date(d.date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <Badge status={d.result === 'Succès' ? 'success' : 'error'}>
                                            {d.result}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                                <Zap className="h-8 w-8 mb-2 opacity-50" />
                                <p className="text-sm">Aucun exercice enregistré pour ce processus.</p>
                            </div>
                        )}
                    </div>
                )}

                {inspectorTab === 'history' && (
                    <TimelineView resourceId={process.id} />
                )}
            </div>
        </InspectorLayout>
    );
};
