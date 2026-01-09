import React, { useState } from 'react';
import { Control, Risk, Finding, Framework } from '../../types';
import { ISO_DOMAINS, ISO22301_DOMAINS, NIS2_DOMAINS, DORA_DOMAINS, GDPR_DOMAINS, SOC2_DOMAINS, HDS_DOMAINS, PCI_DSS_DOMAINS, NIST_CSF_DOMAINS } from '../../data/complianceData';
import { ChevronDown, ChevronRight, Paperclip, AlertTriangle, ShieldAlert, AlertOctagon } from '../../components/ui/Icons';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tooltip as CustomTooltip } from '../../components/ui/Tooltip';
import { EmptyState } from '../../components/ui/EmptyState';

interface ComplianceListProps {
    controls: Control[];
    risks: Risk[];
    findings: Finding[];
    loading: boolean;
    currentFramework: Framework;
    selectedControlId?: string;
    onSelectControl: (control: Control) => void;
    filter?: string;
}

export const ComplianceList: React.FC<ComplianceListProps> = ({
    controls,
    risks,
    findings,
    loading,
    currentFramework,
    selectedControlId,
    onSelectControl,
    filter
}) => {
    const [expandedDomains, setExpandedDomains] = useState<string[]>([]);

    const toggleDomain = (domainId: string) => {
        setExpandedDomains(prev =>
            prev.includes(domainId) ? prev.filter(id => id !== domainId) : [...prev, domainId]
        );
    };

    const getDomainStats = (prefix: string) => {
        const domainControls = controls.filter(c => c.code.startsWith(prefix));
        const total = domainControls.length;
        const implemented = domainControls.filter(c => c.status === 'Implémenté').length;
        const partial = domainControls.filter(c => c.status === 'Partiel').length;
        // Progress: implemented is 100%, partial is 50%
        const progress = total > 0 ? Math.round(((implemented + (partial * 0.5)) / total) * 100) : 0;
        return { total, implemented, partial, progress };
    };

    let domains: { id: string, title: string, description: string }[] = [];
    switch (currentFramework) {
        case 'ISO27001': domains = ISO_DOMAINS; break;
        case 'ISO22301': domains = ISO22301_DOMAINS; break;
        case 'NIS2': domains = NIS2_DOMAINS; break;
        case 'DORA': domains = DORA_DOMAINS; break;
        case 'GDPR': domains = GDPR_DOMAINS; break;
        case 'SOC2': domains = SOC2_DOMAINS; break;
        case 'HDS': domains = HDS_DOMAINS; break;
        case 'PCI_DSS': domains = PCI_DSS_DOMAINS; break;
        case 'NIST_CSF': domains = NIST_CSF_DOMAINS; break;
    }

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={`skel-${i}`} className="glass-premium p-6 flex items-center gap-4 rounded-xl">
                        <Skeleton className="w-12 h-12 rounded-xl" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-full max-w-md" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (controls.length === 0) {
        return (
            <EmptyState
                icon={ShieldAlert}
                title="Aucun contrôle trouvé"
                description={filter ? "Aucun contrôle ne correspond à votre recherche." : "Les contrôles n'ont pas été chargés."}
            />
        );
    }

    return (
        <div className="space-y-4">
            {domains.map(domain => {
                const domainControls = controls.filter(c => c.code.startsWith(domain.id));
                // Hide domain if no controls match filter
                if (domainControls.length === 0) return null;

                const stats = getDomainStats(domain.id);
                // Expand if user filtered or manually expanded
                const isExpanded = expandedDomains.includes(domain.id) || (filter && filter.length > 0);

                return (
                    <div key={domain.id} className="glass-premium rounded-[2rem] shadow-sm overflow-hidden transition-all duration-300 hover:shadow-apple group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                        <div
                            data-testid={`domain-header-${domain.id}`}
                            onClick={() => toggleDomain(domain.id)}
                            className={`p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between cursor-pointer transition-colors gap-4 relative z-10 ${isExpanded ? 'bg-slate-50/80 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-lg border border-slate-200 dark:border-white/10 shrink-0">
                                    {domain.id.split('.')[1] || domain.id}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate pr-2">{domain.title}</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1 truncate">{domain.description} • <span className="text-slate-700 dark:text-slate-300">{stats.total} contrôles</span></p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between md:justify-end gap-3 md:gap-8 w-full md:w-auto pl-[4.25rem] md:pl-0">
                                <div className="w-full md:w-40">
                                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                        <span>Progression</span>
                                        <span className="text-slate-900 dark:text-white">{stats.progress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${stats.progress === 100 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} style={{ width: `${stats.progress}%` }}></div>
                                    </div>
                                </div>
                                <div className={`p-2 rounded-full transition-all duration-300 shrink-0 ${isExpanded ? 'bg-white dark:bg-white/10 shadow-sm rotate-180 text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                                    <ChevronDown className="h-5 w-5" />
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="p-4 bg-slate-50/50 dark:bg-black/20 backdrop-blur-sm border-t border-slate-100 dark:border-white/5 relative z-10">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                    {domainControls.map(control => {
                                        const riskCount = risks.filter(r => r.mitigationControlIds?.includes(control.id)).length;
                                        const findingsCount = findings.filter(f => f.relatedControlId === control.id && f.status === 'Ouvert').length;
                                        const isActive = selectedControlId === control.id;

                                        return (
                                            <div
                                                key={control.id}
                                                data-testid={`control-row-${control.code}`}
                                                onClick={() => {

                                                    onSelectControl(control);
                                                }}
                                                className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden hover:shadow-md ${isActive
                                                    ? 'bg-brand-50/50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800'
                                                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-brand-200 dark:hover:border-brand-700/50'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-xl text-xs font-black transition-colors ${isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600'}`}>
                                                            {control.code.split('.').slice(1).join('.') || control.code}
                                                        </div>
                                                        <div className="min-w-0 pt-0.5">
                                                            <h4 className={`text-sm font-bold truncate pr-2 leading-tight ${isActive ? 'text-brand-900 dark:text-brand-100' : 'text-slate-900 dark:text-white'}`}>
                                                                {control.name}
                                                            </h4>
                                                            <p className="text-[11px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider">{control.code}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border shadow-sm whitespace-nowrap ${control.status === 'Implémenté' ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                                                        control.status === 'Partiel' ? 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                                                            control.status === 'Non applicable' ? 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700' :
                                                                'text-slate-600 bg-white border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                        }`}>
                                                        {control.status}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mt-4 pl-[3.25rem]">
                                                    {control.evidenceIds && control.evidenceIds.length > 0 ? (
                                                        <span className="flex items-center text-emerald-600 bg-emerald-50/80 dark:bg-emerald-900/20 px-2 py-1 rounded-md text-[10px] font-bold border border-emerald-100 dark:border-emerald-900/30">
                                                            <Paperclip className="h-3 w-3 mr-1.5" />
                                                            {control.evidenceIds.length}
                                                        </span>
                                                    ) : (control.status === 'Implémenté') ? (
                                                        <CustomTooltip content="Preuve obligatoire manquante">
                                                            <span className="flex items-center text-orange-600 bg-orange-50/80 dark:bg-orange-900/20 px-2 py-1 rounded-md text-[10px] font-bold border border-orange-100 dark:border-orange-900/30">
                                                                <AlertTriangle className="h-3 w-3 mr-1.5" />
                                                                Manquante
                                                            </span>
                                                        </CustomTooltip>
                                                    ) : null}

                                                    {riskCount > 0 && (
                                                        <span className="flex items-center text-blue-600 bg-blue-50/80 dark:bg-blue-900/20 px-2 py-1 rounded-md text-[10px] font-bold border border-blue-100 dark:border-blue-900/30">
                                                            <ShieldAlert className="h-3 w-3 mr-1.5" />
                                                            {riskCount}
                                                        </span>
                                                    )}

                                                    {findingsCount > 0 && (
                                                        <span className="flex items-center text-red-600 bg-red-50/80 dark:bg-red-900/20 px-2 py-1 rounded-md text-[10px] font-bold border border-red-100 dark:border-red-900/30">
                                                            <AlertOctagon className="h-3 w-3 mr-1.5" />
                                                            {findingsCount}
                                                        </span>
                                                    )}

                                                    <div className="flex-1" />

                                                    <div className={`text-slate-300 dark:text-slate-600 transition-transform duration-300 group-hover:translate-x-1 ${isActive ? 'text-brand-300 dark:text-brand-700' : ''}`}>
                                                        <ChevronRight className="h-4 w-4" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
