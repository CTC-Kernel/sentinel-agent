import React, { useMemo, useState } from 'react';
import { Audit, Finding } from '../../types';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EmptyState } from '../ui/EmptyState';
import { PremiumPageControl } from '../ui/PremiumPageControl';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';

interface FindingsListProps {
    audits: Audit[];
}

export const FindingsList: React.FC<FindingsListProps> = ({ audits }) => {
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
            case 'Majeure': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
            case 'Mineure': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
            case 'Observation': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
            case 'Opportunité': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
            default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
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
                    title="Aucun constat"
                    description="Bravo ! Aucun constat n'a été relevé dans vos audits pour le moment."
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PremiumPageControl
                searchQuery={filter}
                onSearchChange={setFilter}
                searchPlaceholder="Rechercher un constat..."
                actions={
                    <div className="flex gap-2">
                        {['Majeure', 'Mineure', 'Observation', 'Opportunité'].map(type => (
                            <button
                                key={type}
                                onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${typeFilter === type
                                        ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/20 dark:border-brand-800 dark:text-brand-300'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-white/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                }
            />

            <div className="glass-panel overflow-hidden rounded-2xl border border-white/20 dark:border-white/5 relative">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                                <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Statut</th>
                                <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Description</th>
                                <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Type</th>
                                <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Audit Source</th>
                                <th className="py-4 px-6 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredFindings.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                                        Aucun résultat trouvé pour cette recherche.
                                    </td>
                                </tr>
                            ) : (
                                filteredFindings.map((finding) => (
                                    <motion.tr
                                        variants={slideUpVariants}
                                        initial="initial"
                                        animate="visible"
                                        key={`${finding.auditId}-${finding.id}`}
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
                                                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{finding.auditName}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                                {finding.createdAt ? format(new Date(finding.createdAt), 'dd MMM yyyy', { locale: fr }) : '-'}
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
