import React from 'react';
import { CheckCircle2, Plus } from '../../ui/Icons';
import { Audit } from '../../../types';

interface RiskLinkedAuditsProps {
    linkedAudits: Audit[];
    canEdit: boolean;
    onNavigateToAudit: () => void;
}

export const RiskLinkedAudits: React.FC<RiskLinkedAuditsProps> = ({
    linkedAudits,
    canEdit,
    onNavigateToAudit
}) => {
    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 flex items-center"><CheckCircle2 className="h-4 w-4 mr-2" /> Audits Liés ({linkedAudits.length})</h3>
                {canEdit && (
                    <button
                        aria-label="Créer un nouvel audit lié"
                        onClick={onNavigateToAudit}
                        className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-800 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900 transition-colors flex items-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Nouvel Audit
                    </button>
                )}
            </div>
            <div className="grid gap-4">
                {linkedAudits.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-300 italic">Aucun audit.</p> : linkedAudits.map(a => (
                    <div key={a.id || 'unknown'} className="glass-premium p-4 border border-border/40 rounded-3xl">{a.name}</div>
                ))}
            </div>
        </div>
    );
};
