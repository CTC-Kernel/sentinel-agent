import React from 'react';
import { Edit2, Trash2, HeartPulse, Clock, Server, Truck, AlertTriangle, Zap } from 'lucide-react';
import { BusinessProcess, Asset, Supplier, Risk, BcpDrill } from '../../types';
import { InspectorLayout } from '../ui/InspectorLayout';

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

export const ProcessInspector: React.FC<ProcessInspectorProps> = ({ process, isOpen, onClose, onEdit, onDelete, assets, suppliers, risks, drills }) => {
    if (!process) return null;

    const linkedAssets = assets.filter(a => process.supportingAssetIds?.includes(a.id));
    const linkedSuppliers = suppliers.filter(s => process.supplierIds?.includes(s.id));
    const linkedRisks = risks.filter(r => process.relatedRiskIds?.includes(r.id));

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={process.name}
            subtitle={`Géré par ${process.owner}`}
            icon={HeartPulse}
            statusBadge={
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${process.priority === 'Critique' ? 'bg-red-50 text-red-700 border-red-100' :
                    process.priority === 'Élevée' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                        'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                    {process.priority}
                </span>
            }
            actions={
                <div className="flex gap-2">
                    <button onClick={() => onDelete(process.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => onEdit(process)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                        <Edit2 className="h-4 w-4" />
                    </button>
                </div>
            }
            footer={
                <div className="flex justify-between w-full">
                    <button onClick={() => onDelete(process.id)} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-sm font-bold">
                        <Trash2 className="h-4 w-4" /> Supprimer
                    </button>
                    <button onClick={() => onEdit(process)} className="flex items-center gap-2 px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-500/20 transition-all text-sm font-bold">
                        <Edit2 className="h-4 w-4" /> Modifier
                    </button>
                </div>
            }
        >
            <div className="space-y-8 p-6 md:p-8">

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-slate-500" />
                            <span className="text-xs font-bold text-slate-500 uppercase">RTO (Objectif Temps)</span>
                        </div>
                        <span className="text-2xl font-black text-slate-900 dark:text-white">{process.rto}</span>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-slate-500" />
                            <span className="text-xs font-bold text-slate-500 uppercase">RPO (Perte Données)</span>
                        </div>
                        <span className="text-2xl font-black text-slate-900 dark:text-white">{process.rpo}</span>
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Description</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{process.description}</p>
                </div>

                {/* Recovery Tasks */}
                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Plan de Reprise (Étapes)</h3>
                    <div className="space-y-2">
                        {process.recoveryTasks?.length ? process.recoveryTasks.map((task, i) => (
                            <div key={i} className="flex gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                                <div className="text-[10px] font-bold text-slate-500 w-5 h-5 flex items-center justify-center bg-white dark:bg-black/20 rounded border">{i + 1}</div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{task.title}</p>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-xs text-slate-500">Resp: {task.owner}</span>
                                        <span className="text-xs text-slate-500">Durée: {task.duration}</span>
                                    </div>
                                </div>
                            </div>
                        )) : <p className="text-sm text-slate-500 italic">Aucune étape définie</p>}
                    </div>
                </div>

                {/* Dependencies */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dépendances</h3>

                    {/* Assets */}
                    {linkedAssets.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Server className="h-3 w-3" /> Actifs Support</p>
                            <div className="flex flex-wrap gap-2">
                                {linkedAssets.map(a => (
                                    <span key={a.id} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold border border-blue-100 dark:border-blue-900/30">
                                        {a.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suppliers */}
                    {linkedSuppliers.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Truck className="h-3 w-3" /> Fournisseurs</p>
                            <div className="flex flex-wrap gap-2">
                                {linkedSuppliers.map(s => (
                                    <span key={s.id} className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold border border-purple-100 dark:border-purple-900/30">
                                        {s.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Risks */}
                    {linkedRisks.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Risques Associés</p>
                            <div className="space-y-2">
                                {linkedRisks.map(r => (
                                    <div key={r.id} className="flex justify-between items-center p-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/20">
                                        <span className="text-xs font-medium text-amber-900 dark:text-amber-100 truncate flex-1 mr-2">{r.threat}</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/50 text-amber-800">{r.score}/25</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Recent Drills */}
                <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Exercices Récents</h3>
                    {drills.length > 0 ? (
                        <div className="space-y-2">
                            {drills.map(d => (
                                <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg ${d.result === 'Succès' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            <Zap className="h-3 w-3" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">{new Date(d.date).toLocaleDateString()}</p>
                                            <p className="text-[10px] text-slate-500 uppercase">{d.type}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${d.result === 'Succès' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        {d.result}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 italic">Aucun exercice enregistré pour ce processus.</p>
                    )}
                </div>
            </div>
        </InspectorLayout>
    );
};
