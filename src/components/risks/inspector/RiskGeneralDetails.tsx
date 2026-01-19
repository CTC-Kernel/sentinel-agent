import React from 'react';
import { ShieldAlert, CheckCircle2, Loader2, CalendarDays } from '../../ui/Icons';
import { Badge } from '../../ui/Badge';
import { SafeHTML } from '../../ui/SafeHTML';
import { RiskAIAssistant } from '../RiskAIAssistant';
import { Risk } from '../../../types';
// import { toast } from '@/lib/toast';

interface RiskGeneralDetailsProps {
    risk: Risk;
    assetName: string;
    canEdit: boolean;
    updating: boolean;
    onStatusChangeRequest: (status: Risk['status']) => void;
    onStatusChange: (status: Risk['status']) => void;
    onReview: () => void;
    onAIAssistantUpdate: (updates: Partial<Risk>) => void;
    getOwnerName: (id?: string) => string;
}

export const RiskGeneralDetails: React.FC<RiskGeneralDetailsProps> = ({
    risk,
    // assetName,
    canEdit,
    updating,
    onStatusChangeRequest,
    onStatusChange,
    onReview,
    onAIAssistantUpdate,
    getOwnerName
}) => {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-6 bg-white/40 dark:bg-white/5 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/20 pointer-events-none" />
                    <div className="relative z-10">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-red-600/80 mb-4 flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4" /> Risque Brut
                        </h4>
                        <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">
                            {Number(risk.score) || (Number(risk.probability) * Number(risk.impact)) || 0}
                        </div>
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Prob: {risk.probability || 0} × Impact: {risk.impact || 0}</div>
                    </div>
                </div>
                <div className="p-6 bg-white/40 dark:bg-white/5 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-900/20 pointer-events-none" />
                    <div className="relative z-10">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-600/80 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> Risque Résiduel
                        </h4>
                        <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">
                            {Number(risk.residualScore) || ((Number(risk.residualProbability) || Number(risk.probability)) * (Number(risk.residualImpact) || Number(risk.impact))) || 0}
                        </div>
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Prob: {risk.residualProbability || risk.probability || 0} × Impact: {risk.residualImpact || risk.impact || 0}</div>
                    </div>
                </div>
            </div>

            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Identification du Risque</h4>
                <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Menace</span>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{risk.threat}</p>
                </div>
                {risk.scenario && (
                    <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Scénario</span>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{risk.scenario}</p>
                    </div>
                )}
                {risk.vulnerability && (
                    <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Vulnérabilité Exploitée</span>
                        <SafeHTML content={risk.vulnerability} className="text-sm text-slate-600 dark:text-slate-300" />
                    </div>
                )}
            </div>

            <RiskAIAssistant
                risk={risk}
                onUpdate={onAIAssistantUpdate}
            />

            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Stratégie de Traitement</h4>
                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{risk.strategy}</div>
            </div>
            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Propriétaire</h4>
                <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{getOwnerName(risk.owner)}</div>
            </div>
            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Statut Actuel</h4>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    {canEdit ? (
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            {['Ouvert', 'En cours', 'Fermé', 'En attente de validation'].map(s => (
                                <button
                                    aria-label={`Changer le statut à ${s}`}
                                    key={s}
                                    onClick={() => onStatusChangeRequest(s as Risk['status'])}
                                    disabled={updating}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex-1 sm:flex-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${risk.status === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-md' : 'bg-transparent border-gray-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-gray-50'} ${updating ? 'opacity-50 cursor-wait' : ''}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    ) : <Badge status={risk.status === 'Ouvert' ? 'error' : risk.status === 'En cours' ? 'warning' : risk.status === 'Fermé' ? 'success' : 'info'} variant="soft">{risk.status}</Badge>}
                    {canEdit && risk.status === 'En attente de validation' && (
                        <div className="flex gap-2">
                            <button
                                aria-label="Rejeter la demande"
                                onClick={() => onStatusChange('Ouvert')} // Reject -> Back to Open
                                className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            >
                                Rejeter
                            </button>
                            <button
                                aria-label="Approuver le risque"
                                onClick={() => onStatusChange('En cours')} // Approve -> In Progress
                                className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            >
                                Approuver
                            </button>
                        </div>
                    )}
                    {canEdit && (
                        <button
                            aria-label="Valider la revue du risque"
                            onClick={onReview}
                            disabled={updating}
                            className={`flex items-center justify-center px-4 py-2 text-xs font-bold bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${updating ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {updating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5 mr-2" />}
                            Valider la revue
                        </button>
                    )}
                </div>
                {risk.lastReviewDate && (<p className="text-xs text-slate-500 mt-3 text-right">Dernière revue le : {new Date(risk.lastReviewDate).toLocaleDateString()}</p>)}
            </div>
        </div>
    );
};
