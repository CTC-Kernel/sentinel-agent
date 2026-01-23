import React from 'react';
import { Risk } from '../../types';
import { ShieldAlert, ArrowRight, CheckCircle2 } from '../ui/Icons';

interface TopRisksWidgetProps {
    risks: Risk[];
    onMitigate: (risk: Risk) => void;
}

export const TopRisksWidget: React.FC<TopRisksWidgetProps> = ({ risks, onMitigate }) => {
    // Sort by score desc and take top 5, but ONLY high/critical risks (>= 10)
    const topRisks = [...risks]
        .filter(r => r.score >= 10)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    return (
        <div className="glass-panel p-6 rounded-[2.5rem] h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-foreground">Risques Critiques</h3>
                    <p className="text-sm text-muted-foreground">Priorité d'action</p>
                </div>
                <button className="p-2 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50">
                    <ShieldAlert className="h-5 w-5" />
                </button>
            </div>

            <div className="space-y-3">
                {topRisks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center">
                        <CheckCircle2 className="h-12 w-12 mb-2 text-success opacity-50" />
                        <p>Aucun risque critique identifié.</p>
                        <p className="text-xs mt-1">Excellente posture de sécurité !</p>
                    </div>
                ) : (
                    topRisks.map(risk => (
                        <div key={risk.id} className="group p-4 bg-card/40 hover:bg-card border border-border/60 rounded-2xl transition-all cursor-pointer">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="text-sm font-bold text-foreground line-clamp-1">{risk.threat}</h4>
                                <span className={`flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold ${risk.score >= 15 ? 'bg-destructive/10 text-destructive' :
                                    risk.score >= 10 ? 'bg-warning/10 text-warning' :
                                        'bg-warning/10 text-warning'
                                    }`}>
                                    {risk.score}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-3">
                                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    {risk.status === 'Fermé' && <CheckCircle2 className="h-3 w-3 text-success" />}
                                    {risk.strategy}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMitigate(risk); }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-xs font-bold text-primary hover:text-primary/80 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded px-1"
                                >
                                    Traiter <ArrowRight className="h-3 w-3 ml-1" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
