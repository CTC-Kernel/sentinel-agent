import React from 'react';
import { Control } from '../../../types';
import { AlertTriangle } from '../../ui/Icons';

interface ComplianceCriticalControlsProps {
    controls: Control[];
}

export const ComplianceCriticalControls: React.FC<ComplianceCriticalControlsProps> = ({ controls }) => {
    // Critical controls (high priority)
    const criticalControls = controls.filter(c =>
        c.status !== 'Implémenté' &&
        c.code &&
        (c.code.includes('A.5.') || c.code.includes('A.8.') || c.code.includes('A.12.'))
    );

    if (criticalControls.length === 0) return null;

    return (
        <div className="glass-premium p-6 md:p-8 rounded-5xl relative group hover:shadow-apple overflow-hidden transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-5xl" />
            <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 relative z-10 uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4 text-warning-text" />
                Contrôles Critiques à Implémenter ({criticalControls.length})
            </h4>
            <div className="space-y-3 relative z-10">
                {criticalControls.slice(0, 5).map((control, index) => (
                    <div key={`task-${index}`} className="flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/60 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10 transition-colors shadow-sm shadow-black/5">
                        <div className="flex-1">
                            <p className="font-bold text-sm text-foreground">{control.code} - {control.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{control.description}</p>
                        </div>
                        <div className={`shrink-0 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-sm ${control.status === 'Partiel' ? 'bg-warning-bg text-warning-text border-warning-border/50' :
                            'bg-error-bg text-error-text border-error-border/50'
                            }`}>
                            {control.status}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
