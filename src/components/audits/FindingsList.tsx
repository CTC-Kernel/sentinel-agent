import React, { useMemo, useState } from 'react';
import { Audit, Finding } from '../../types';
import { AlertCircle, CheckCircle2 } from '../ui/Icons';
import { format } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';
import { EmptyState } from '../ui/EmptyState';
import { PremiumPageControl } from '../ui/PremiumPageControl';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { useStore } from '../../store';

import { Skeleton } from '../ui/Skeleton';

interface FindingsListProps {
    audits: Audit[];
    onOpenAudit?: (audit: Audit) => void;
    loading?: boolean;
}

export const FindingsList: React.FC<FindingsListProps> = ({ audits, onOpenAudit, loading }) => {
    const { t } = useStore();
    const { dateFnsLocale } = useLocale();
    const [filter, setFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState<string | null>(null);

    // Flatten findings and attach audit info
    const allFindings = useMemo(() => {
        return audits.flatMap(audit =>
            (audit.findings || []).map(finding => ({
                ...finding,
                auditName: audit.name,
                auditId: audit.id,
                auditDate: audit.dateScheduled
            }))
        );
    }, [audits]);

    // Filtering
    const filteredFindings = useMemo(() => {
        return allFindings.filter(f => {
            const matchesSearch =
                f.description.toLowerCase().includes(filter.toLowerCase()) ||
                f.auditName.toLowerCase().includes(filter.toLowerCase());
            const matchesType = typeFilter ? f.type === typeFilter : true;
            return matchesSearch && matchesType;
        });
    }, [allFindings, filter, typeFilter]);

    const getTypeColor = (type: Finding['type']) => {
        switch (type) {
            case 'Majeure': return 'bg-red-100 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
            case 'Mineure': return 'bg-orange-100 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
            case 'Observation': return 'bg-blue-100 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
            case 'Opportunité': return 'bg-green-100 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
            default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-border/40 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
        }
    };

    const getStatusIcon = (status: Finding['status']) => {
        return status === 'Ouvert'
            ? <AlertCircle className="w-4 h-4 text-red-500" />
            : <CheckCircle2 className="w-4 h-4 text-green-500" />;
    };

    if (allFindings.length === 0) {
        return (
            <div className="mt-8">
                <EmptyState
                    icon={CheckCircle2}
                    title={t('audits.findings.emptyTitle', { defaultValue: 'Aucun constat' })}
                    description={t('audits.findings.emptyDescription', { defaultValue: "Bravo ! Aucun constat n'a été relevé dans vos audits pour le moment." })}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PremiumPageControl
                searchQuery={filter}
                onSearchChange={setFilter}
                searchPlaceholder={t('audits.findings.searchPlaceholder', { defaultValue: 'Rechercher un constat...' })}
                actions={
                    <div className="flex gap-2">
                        {['Majeure', 'Mineure', 'Observation', 'Opportunité'].map(type => (
                            <button
                                key={type || 'unknown'}
                                onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${typeFilter === type
                                    ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-800 dark:border-brand-800 dark:text-brand-300'
                                    : 'bg-white border-border/40 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-white/5 dark:border-border/40 dark:text-slate-300 dark:hover:bg-white/10'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                }
            />

            <div className="glass-premium overflow-hidden rounded-2xl border border-border/40 relative">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-border/40 dark:border-white/5">
                                <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Statut</th>
                                <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Description</th>
                                <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Type</th>
                                <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Audit Source</th>
                                <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={`skeleton-${i || 'unknown'}`} className="animate-pulse">
                                        <td className="py-4 px-6"><Skeleton className="h-5 w-20 rounded" /></td>
                                        <td className="py-4 px-6"><Skeleton className="h-4 w-full rounded" /></td>
                                        <td className="py-4 px-6"><Skeleton className="h-5 w-24 rounded-full" /></td>
                                        <td className="py-4 px-6"><Skeleton className="h-4 w-32 rounded" /></td>
                                        <td className="py-4 px-6"><Skeleton className="h-4 w-24 rounded" /></td>
                                    </tr>
                                ))
                            ) : filteredFindings.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                                        {t('audits.findings.noResults', { defaultValue: 'Aucun résultat trouvé pour cette recherche.' })}
                                    </td>
                                </tr>
                            ) : (
                                filteredFindings.map((finding) => (
                                    <motion.tr
                                        variants={slideUpVariants}
                                        initial="initial"
                                        animate="visible"
                                        key={`${finding.auditId || 'unknown'}-${finding.id}`}
                                        className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group"
                                    >
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(finding.status)}
                                                <span className={`text-sm font-medium ${finding.status === 'Ouvert' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}>
                                                    {finding.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium line-clamp-2" title={finding.description}>
                                                {finding.description}
                                            </p>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(finding.type)}`}>
                                                {finding.type}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <button
                                                    type="button"
                                                    className={onOpenAudit ? 'text-sm font-medium rounded text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500' : 'text-sm font-medium text-slate-700 dark:text-slate-300'}
                                                    onClick={() => {
                                                        if (onOpenAudit) {
                                                            const audit = audits.find(a => a.id === finding.auditId);
                                                            if (audit) onOpenAudit(audit);
                                                        }
                                                    }}
                                                >
                                                    {finding.auditName}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-sm text-slate-500 dark:text-muted-foreground">
                                                {finding.createdAt ? format(new Date(finding.createdAt), 'dd MMM yyyy', { locale: dateFnsLocale }) : '-'}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
