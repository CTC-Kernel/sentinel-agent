import React from 'react';
import { Control } from '../../../types';
import { ShieldAlert } from '../../ui/Icons';

interface ComplianceDomainDetailsProps {
    controls: Control[];
    currentFramework: string;
}

export const ComplianceDomainDetails: React.FC<ComplianceDomainDetailsProps> = ({ controls, currentFramework }) => {
    // Group by Domain
    const domainData = controls.reduce((acc, control) => {
        if (!control.code) return acc;
        const parts = control.code.split('.');
        const domain = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];

        if (!acc[domain]) {
            acc[domain] = { total: 0, implemented: 0 };
        }
        acc[domain].total++;
        if (control.status === 'Implémenté') acc[domain].implemented++;
        return acc;
    }, {} as Record<string, { total: number; implemented: number }>);

    return (
        <div className="glass-premium p-6 md:p-8 rounded-4xl relative group hover:shadow-apple transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-4xl" />
            <h4 className="text-sm font-bold text-foreground mb-4 relative z-10 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-brand-500" />
                Détail par Domaine {currentFramework}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                {Object.entries(domainData).map(([domain, data]) => {
                    const rate = (data.implemented / data.total * 100);
                    return (
                        <div key={domain} className="p-4 bg-white/40 dark:bg-white/5 rounded-3xl border border-border/40 dark:border-border/40 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-foreground text-sm">{domain}</span>
                                <span className="text-xs font-bold text-muted-foreground">{data.implemented}/{data.total}</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 mb-2 overflow-hidden">
                                <div
                                    className={`h-2 rounded-full transition-all duration-1000 ease-out ${rate >= 80 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                                        rate >= 50 ? 'bg-yellow-500' :
                                            'bg-red-500'
                                        }`}
                                    style={{
                                        width: `${rate}%`
                                    }}
                                ></div>
                            </div>
                            <div className="text-xs text-muted-foreground font-medium">
                                {rate.toFixed(0)}% conformité
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
