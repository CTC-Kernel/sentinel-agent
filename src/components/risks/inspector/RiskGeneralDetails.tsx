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
        <div className="space-y-6 sm:space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-6 bg-white/40 dark:bg-white/5 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/20 pointer-events-none" />
                    <div className="relative z-10">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-red-600/80 mb-4 flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4" /> Risque Brut
                        </h4>
                        <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">
                            {Number(risk.score) || (Number(risk.probability) * Number(risk.impact)) || 0}
                        </div>
                        <div className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Prob: {risk.probability || 0} × Impact: {risk.impact || 0}</div>
                    </div>
                </div>
                <div className="p-6 bg-white/40 dark:bg-white/5 rounded-4xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-success-bg/50 to-transparent dark:from-success-bg/20 pointer-events-none" />
                    <div className="relative z-10">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-success-text/80 mb-4 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> Risque Résiduel
                        </h4>
                        <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">
                            {Number(risk.residualScore) || ((Number(risk.residualProbability) || Number(risk.probability)) * (Number(risk.residualImpact) || Number(risk.impact))) || 0}
                        </div>
                        <div className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Prob: {risk.residualProbability || risk.probability || 0} × Impact: {risk.residualImpact || risk.impact || 0}</div>
                    </div>
                </div>
            </div>

            <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-2">Identification du Risque</h4>
                <div>
                    <span className="text-[11px] uppercase text-muted-foreground font-bold">Menace</span>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{risk.threat}</p>
                </div>
                {risk.scenario && (
                    <div>
                        <span className="text-[11px] uppercase text-muted-foreground font-bold">Scénario</span>
                        <p className="text-sm text-slate-600 dark:text-muted-foreground">{risk.scenario}</p>
                    </div>
                )}
                {risk.vulnerability && (
                    <div>
                        <span className="text-[11px] uppercase text-muted-foreground font-bold">Vulnérabilité Exploitée</span>
                        <SafeHTML content={risk.vulnerability} className="text-sm text-slate-600 dark:text-slate-300" />
                    </div>
                )}
            </div>

            <RiskAIAssistant
                risk={risk}
                onUpdate={onAIAssistantUpdate}
            />

            <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-4">Stratégie de Traitement</h4>
                <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{risk.strategy}</div>
            </div>
            <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-4">Propriétaire</h4>
                <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5 text-sm font-medium text-slate-700 dark:text-slate-200">{getOwnerName(risk.owner)}</div>
            </div>
            <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-4">Statut Actuel</h4>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    {canEdit ? (
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            {['Ouvert', 'En cours', 'Fermé', 'En attente de validation'].map(s => (
                                <button
                                    aria-label={`Changer le statut à ${s}`}
                                    key={s}
                                    onClick={() => onStatusChangeRequest(s as Risk['status'])}
                                    disabled={updating}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex-1 sm:flex-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${risk.status === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-md' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'} ${updating ? 'opacity-60 cursor-wait' : ''}`}
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
                                className="px-4 py-2 bg-error-bg text-error-text rounded-xl text-xs font-bold hover:bg-error-bg/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            >
                                Rejeter
                            </button>
                            <button
                                aria-label="Approuver le risque"
                                onClick={() => onStatusChange('En cours')} // Approve -> In Progress
                                className="px-4 py-2 bg-success-bg text-success-text rounded-xl text-xs font-bold hover:bg-success-bg/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
                            className={`flex items-center justify-center px-4 py-2 text-xs font-bold bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 shadow-sm ${updating ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {updating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5 mr-2" />}
                            Valider la revue
                        </button>
                    )}
                </div>
                {risk.lastReviewDate && (<p className="text-xs text-slate-500 dark:text-slate-300 mt-3 text-right">Dernière revue le : {new Date(risk.lastReviewDate).toLocaleDateString()}</p>)}
            </div>
        </div>
    );
};
