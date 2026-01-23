import React, { useState } from 'react';
import { Control, Risk, Finding, Framework } from '../../types';
import { ISO_DOMAINS, ISO22301_DOMAINS, NIS2_DOMAINS, DORA_DOMAINS, GDPR_DOMAINS, SOC2_DOMAINS, HDS_DOMAINS, PCI_DSS_DOMAINS, NIST_CSF_DOMAINS } from '../../data/complianceData';
import { ChevronDown, ChevronRight, Paperclip, AlertTriangle, ShieldAlert, AlertOctagon } from '../../components/ui/Icons';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tooltip as CustomTooltip } from '../../components/ui/Tooltip';
import { EmptyState } from '../../components/ui/EmptyState';
import { AgentVerificationIndicator } from './AgentVerificationBadge';

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

const getFrameworkStyles = (framework: Framework) => {
    switch (framework) {
        case 'ISO27001':
            return {
                accent: 'text-brand-600 dark:text-brand-400',
                bg: 'bg-brand-50 dark:bg-brand-900/20',
                border: 'border-brand-100 dark:border-brand-800/50',
                progress: 'bg-brand-600 shadow-brand-600/20'
            };
        case 'NIS2':
            return {
                accent: 'text-purple-600 dark:text-purple-400',
                bg: 'bg-purple-50 dark:bg-purple-900/20',
                border: 'border-purple-100 dark:border-purple-800/50',
                progress: 'bg-purple-600 shadow-purple-600/20'
            };
        case 'GDPR':
            return {
                accent: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                border: 'border-emerald-100 dark:border-emerald-800/50',
                progress: 'bg-emerald-600 shadow-emerald-600/20'
            };
        case 'DORA':
            return {
                accent: 'text-amber-600 dark:text-amber-400',
                bg: 'bg-amber-50 dark:bg-amber-900/20',
                border: 'border-amber-100 dark:border-amber-800/50',
                progress: 'bg-amber-600 shadow-amber-600/20'
            };
        case 'ISO22301':
            return {
                accent: 'text-indigo-600 dark:text-indigo-400',
                bg: 'bg-indigo-50 dark:bg-indigo-900/20',
                border: 'border-indigo-100 dark:border-indigo-800/50',
                progress: 'bg-indigo-600 shadow-indigo-600/20'
            };
        case 'SOC2':
            return {
                accent: 'text-rose-600 dark:text-rose-400',
                bg: 'bg-rose-50 dark:bg-rose-900/20',
                border: 'border-rose-100 dark:border-rose-800/50',
                progress: 'bg-rose-600 shadow-rose-600/20'
            };
        case 'HDS':
            return {
                accent: 'text-cyan-600 dark:text-cyan-400',
                bg: 'bg-cyan-50 dark:bg-cyan-900/20',
                border: 'border-cyan-100 dark:border-cyan-800/50',
                progress: 'bg-cyan-600 shadow-cyan-600/20'
            };
        case 'PCI_DSS':
            return {
                accent: 'text-red-600 dark:text-red-400',
                bg: 'bg-red-50 dark:bg-red-900/20',
                border: 'border-red-100 dark:border-red-800/50',
                progress: 'bg-red-600 shadow-red-600/20'
            };
        case 'NIST_CSF':
            return {
                accent: 'text-orange-600 dark:text-orange-400',
                bg: 'bg-orange-50 dark:bg-orange-900/20',
                border: 'border-orange-100 dark:border-orange-800/50',
                progress: 'bg-orange-600 shadow-orange-600/20'
            };
        default:
            return {
                accent: 'text-brand-600 dark:text-brand-400',
                bg: 'bg-brand-50 dark:bg-brand-900/20',
                border: 'border-brand-100 dark:border-brand-800/50',
                progress: 'bg-brand-600 shadow-brand-600/20'
            };
    }
};

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
                    <div key={`skel-${i}`} className="glass-premium p-6 flex items-center gap-4 rounded-4xl">
                        <Skeleton className="w-12 h-12 rounded-2xl" />
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

                const fwStyles = getFrameworkStyles(currentFramework);

                return (
                    <div key={domain.id} className="glass-premium rounded-5xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-apple group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                        <div
                            data-testid={`domain-header-${domain.id}`}
                            onClick={() => toggleDomain(domain.id)}
                            className={`p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between cursor-pointer transition-colors gap-4 relative z-10 ${isExpanded ? 'bg-slate-50/80 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border shrink-0 shadow-sm shadow-black/5 transition-all group-hover:scale-110 ${fwStyles.bg} ${fwStyles.accent} ${fwStyles.border}`}>
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
                                    <div className="w-full bg-slate-100 dark:bg-slate-800/50 rounded-full h-2 overflow-hidden shadow-inner">
                                        <div className={`h-full rounded-full transition-all duration-700 ease-in-out ${stats.progress === 100 ? 'bg-success-text shadow-glow shadow-success-text/20' : `${fwStyles.progress} shadow-glow`}`} style={{ width: `${stats.progress}%` }}></div>
                                    </div>
                                </div>
                                <div className={`p-2 rounded-xl transition-all duration-500 shrink-0 ${isExpanded ? 'bg-white dark:bg-white/10 shadow-apple-sm rotate-180 text-slate-900 dark:text-white ring-1 ring-black/5' : 'text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-100 dark:group-hover:bg-white/5'}`}>
                                    <ChevronDown className="h-5 w-5" />
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="p-4 bg-slate-50/50 dark:bg-black/20 backdrop-blur-sm border-t border-slate-100 dark:border-white/5 relative z-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                                        <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-2xl text-xs font-black transition-all shadow-sm ${isActive ? 'bg-brand-600 text-white' : `bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 group-hover:${fwStyles.bg} group-hover:${fwStyles.accent} border border-transparent group-hover:${fwStyles.border}`}`}>
                                                            {control.code.split('.').slice(1).join('.') || control.code}
                                                        </div>
                                                        <div className="min-w-0 pt-0.5">
                                                            <h4 className={`text-sm font-bold truncate pr-2 leading-tight ${isActive ? 'text-brand-900 dark:text-brand-100' : 'text-slate-900 dark:text-white'}`}>
                                                                {control.name}
                                                            </h4>
                                                            <p className="text-[11px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider">{control.code}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wide border shadow-sm whitespace-nowrap ${control.status === 'Implémenté' ? 'text-success-text bg-success-bg border-success-border/50' :
                                                        control.status === 'Partiel' ? 'text-warning-text bg-warning-bg border-warning-border/50' :
                                                            control.status === 'Non applicable' ? 'text-slate-500 bg-slate-100 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700' :
                                                                'text-slate-600 bg-white border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                                        }`}>
                                                        {control.status}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mt-4 pl-[3.25rem]">
                                                    {control.evidenceIds && control.evidenceIds.length > 0 ? (
                                                        <span className="flex items-center text-success-text bg-success-bg px-2 py-1 rounded-lg text-[10px] font-bold border border-success-border/30">
                                                            <Paperclip className="h-3 w-3 mr-1.5" />
                                                            {control.evidenceIds.length}
                                                        </span>
                                                    ) : (control.status === 'Implémenté') ? (
                                                        <CustomTooltip content="Preuve obligatoire manquante">
                                                            <span className="flex items-center text-warning-text bg-warning-bg px-2 py-1 rounded-lg text-[10px] font-bold border border-warning-border/30">
                                                                <AlertTriangle className="h-3 w-3 mr-1.5" />
                                                                Manquante
                                                            </span>
                                                        </CustomTooltip>
                                                    ) : null}

                                                    {riskCount > 0 && (
                                                        <span className="flex items-center text-info-text bg-info-bg px-2 py-1 rounded-lg text-[10px] font-bold border border-info-border/30">
                                                            <ShieldAlert className="h-3 w-3 mr-1.5" />
                                                            {riskCount}
                                                        </span>
                                                    )}

                                                    {findingsCount > 0 && (
                                                        <span className="flex items-center text-error-text bg-error-bg px-2 py-1 rounded-lg text-[10px] font-bold border border-error-border/30">
                                                            <AlertOctagon className="h-3 w-3 mr-1.5" />
                                                            {findingsCount}
                                                        </span>
                                                    )}

                                                    {/* Agent Verification Indicator */}
                                                    <AgentVerificationIndicator
                                                        controlId={control.code}
                                                        framework={currentFramework}
                                                    />

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
