import React from 'react';
import { Control, Finding, Risk } from '../../types';
import { ChevronDown, ChevronRight, Paperclip, AlertTriangle, ShieldAlert, AlertOctagon } from 'lucide-react';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';

interface ComplianceListProps {
    controls: Control[];
    domains: { id: string; title: string; description: string }[];
    expandedDomains: string[];
    toggleDomain: (id: string) => void;
    onOpenInspector: (control: Control) => void;
    risks: Risk[];
    findings: Finding[];
}

export const ComplianceList: React.FC<ComplianceListProps> = ({
    controls,
    domains,
    expandedDomains,
    toggleDomain,
    onOpenInspector,
    risks,
    findings
}) => {

    const getDomainStats = (domainId: string) => {
        const domainControls = controls.filter(c => c.code.toLowerCase().startsWith(domainId.toLowerCase()));
        const total = domainControls.length;
        const implemented = domainControls.filter(c => c.status === 'Implémenté').length;
        const progress = total > 0 ? Math.round((implemented / total) * 100) : 0;
        return { total, implemented, progress };
    };

    return (
        <div className="space-y-4">
            {domains.map(domain => {
                const stats = getDomainStats(domain.id);
                // If it's the ISO "Other" generic domain or similar, we might want to hide if empty, but for now show all

                const isExpanded = expandedDomains.includes(domain.id);
                const domainControls = controls.filter(c => c.code.toLowerCase().startsWith(domain.id.toLowerCase()));

                if (domainControls.length === 0) return null; // Hide domains with no controls

                return (
                    <div key={domain.id} className="glass-panel rounded-[2.5rem] shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md max-w-full">
                        <div
                            onClick={() => toggleDomain(domain.id)}
                            className={`p-6 flex flex-col md:flex-row md:items-center justify-between cursor-pointer transition-colors gap-4 ${isExpanded ? 'bg-slate-50/80 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-5 min-w-0">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-lg border border-slate-200 dark:border-white/10 shrink-0">
                                    {domain.id.split('.').pop()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight break-words">{domain.title}</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 truncate">
                                        {domain.description} • <span className="text-slate-700 dark:text-slate-300 whitespace-normal inline-block">{stats.total} contrôles</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between md:justify-end gap-3 md:gap-8 w-full md:w-auto pl-0 sm:pl-[4.25rem] md:pl-0 shrink-0">
                                <div className="w-full md:w-40">
                                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                        <span>Progression</span>
                                        <span className="text-slate-900 dark:text-white">{stats.progress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${stats.progress === 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${stats.progress}%` }}></div>
                                    </div>
                                </div>
                                <div className={`p-2 rounded-full transition-all duration-300 shrink-0 ${isExpanded ? 'bg-white dark:bg-white/10 shadow-sm rotate-180 text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                                    <ChevronDown className="h-5 w-5" />
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="border-t border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
                                {domainControls.map(control => {
                                    const riskCount = risks.filter(r => r.mitigationControlIds?.includes(control.id)).length;
                                    const findingsCount = findings.filter(f => f.relatedControlId === control.id && f.status === 'Ouvert').length;
                                    return (
                                        <CustomTooltip key={control.id} content={`Cliquez pour voir les détails de ${control.code}`} position="top" className="w-full">
                                            <div onClick={() => onOpenInspector(control)} className="p-4 sm:p-5 hover:bg-gray-50/80 dark:hover:bg-white/5 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-4 sm:pl-8 active:scale-[0.99] duration-200 w-full max-w-full">
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5 flex-1 min-w-0 w-full">
                                                    <div className="min-w-[50px] shrink-0">
                                                        <span className="text-xs font-black text-slate-500 group-hover:text-brand-600 transition-colors">{control.code}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0 w-full">
                                                        <h4 className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 break-words pr-4">
                                                            {control.name}
                                                        </h4>
                                                        <div className="flex flex-wrap items-center mt-2 gap-2 text-xs">
                                                            {control.evidenceIds && control.evidenceIds.length > 0 ? (
                                                                <span className="flex items-center text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap">
                                                                    <Paperclip className="h-3 w-3 mr-1.5" /> {control.evidenceIds.length} preuve(s)
                                                                </span>
                                                            ) : (control.status === 'Implémenté') ? (
                                                                <span className="flex items-center text-orange-500 font-medium bg-orange-50 dark:bg-orange-900/10 px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap">
                                                                    <AlertTriangle className="h-3 w-3 mr-1.5" /> Preuve manquante
                                                                </span>
                                                            ) : null}
                                                            {riskCount > 0 && (
                                                                <span className="flex items-center text-blue-500 font-medium bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap">
                                                                    <ShieldAlert className="h-3 w-3 mr-1.5" /> {riskCount} risques
                                                                </span>
                                                            )}
                                                            {findingsCount > 0 && (
                                                                <span className="flex items-center text-red-500 font-medium bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap">
                                                                    <AlertOctagon className="h-3 w-3 mr-1.5" /> {findingsCount} écarts
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 shrink-0">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm whitespace-nowrap ${control.status === 'Implémenté' ? 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' :
                                                        control.status === 'Partiel' ? 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
                                                            'text-slate-600 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                        }`}>
                                                        {control.status}
                                                    </span>
                                                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors hidden sm:block" />
                                                </div>
                                            </div>
                                        </CustomTooltip>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
