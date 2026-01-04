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
        <div className="glass-premium p-6 md:p-8 rounded-[2rem] relative group hover:shadow-apple overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
            <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 relative z-10">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Contrôles Critiques à Implémenter ({criticalControls.length})
            </h4>
            <div className="space-y-3 relative z-10">
                {criticalControls.slice(0, 5).map((control, index) => (
                    <div key={`task-${index}`} className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-white/60 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10 transition-colors">
                        <div className="flex-1">
                            <p className="font-bold text-sm text-foreground">{control.code} - {control.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{control.description}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-lg text-xs font-bold ${control.status === 'Partiel' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            }`}>
                            {control.status}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
