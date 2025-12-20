import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Audit, Finding } from '../../types';
import { slideUpVariants } from '../ui/animationVariants';

interface FindingsListProps {
    audits: Audit[];
}

interface EnrichedFinding extends Finding {
    auditName: string;
    auditDate: string;
}

export const FindingsList: React.FC<FindingsListProps> = ({ audits }) => {
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Ouvert' | 'Fermé'>('all');
    const [severityFilter, setSeverityFilter] = useState<'all' | 'Majeure' | 'Mineure' | 'Observation'>('all');

    const findings: EnrichedFinding[] = useMemo(() => {
        return audits.flatMap(audit =>
            (audit.findings || []).map(finding => ({
                ...finding,
                auditName: audit.name,
                auditDate: audit.dateScheduled
            }))
        );
    }, [audits]);

    const filteredFindings = useMemo(() => {
        return findings.filter(f => {
            const matchesSearch = f.description.toLowerCase().includes(filter.toLowerCase()) ||
                f.auditName.toLowerCase().includes(filter.toLowerCase());
            const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
            const matchesSeverity = severityFilter === 'all' || f.type === severityFilter;
            return matchesSearch && matchesStatus && matchesSeverity;
        });
    }, [findings, filter, statusFilter, severityFilter]);

    return (
        <motion.div variants={slideUpVariants} className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher par description ou audit..."
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 focus:ring-2 focus:ring-brand-500 transition-all outline-none"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 outline-none focus:ring-2 focus:ring-brand-500"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                    >
                        <option value="all">Tous les statuts</option>
                        <option value="Ouvert">Ouvert</option>
                        <option value="Fermé">Fermé</option>
                    </select>
                    <select
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 outline-none focus:ring-2 focus:ring-brand-500"
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value as any)}
                    >
                        <option value="all">Toutes sévérités</option>
                        <option value="Majeure">Majeure</option>
                        <option value="Mineure">Mineure</option>
                        <option value="Observation">Observation</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Audit Source</th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-sm">
                        {filteredFindings.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    Aucun constat trouvé
                                </td>
                            </tr>
                        ) : (
                            filteredFindings.map((finding) => (
                                <tr key={finding.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${finding.type === 'Majeure' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' :
                                            finding.type === 'Mineure' ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' :
                                                'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                                            }`}>
                                            {finding.type === 'Majeure' && <AlertCircle className="w-3 h-3" />}
                                            {finding.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-900 dark:text-white font-medium max-w-md truncate">
                                        {finding.description}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-900 dark:text-slate-200">{finding.auditName}</span>
                                            <span className="text-xs">{new Date(finding.auditDate).toLocaleDateString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${finding.status === 'Ouvert' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                            }`}>
                                            {finding.status === 'Ouvert' ? <Clock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                                            {finding.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};
