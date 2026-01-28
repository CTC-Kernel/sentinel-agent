import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, User, Clock, FileText } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/EmptyState';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { usePrivacyRequests } from '../../hooks/privacy/usePrivacyRequests';
import { PrivacyRequest } from '../../types';
import { Loader2 } from '../ui/Icons';

interface PrivacyRequestsProps {
    onCreate?: () => void;
    onSelect?: (request: PrivacyRequest) => void;
}

export const PrivacyRequests: React.FC<PrivacyRequestsProps> = ({ onCreate, onSelect }) => {
    const { requests, loading } = usePrivacyRequests();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('All');

    const filteredRequests = requests.filter(req =>
        (req.dataSubject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.id.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterStatus === 'All' || req.status === filterStatus)
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'New': return 'info';
            case 'Verifying': return 'warning';
            case 'Processing': return 'brand';
            case 'Completed': return 'success';
            case 'Rejected': return 'error';
            default: return 'neutral';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header / Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Rechercher une demande (Nom, ID)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-border/40 dark:border-border/40 rounded-3xl text-sm focus:ring-2 focus-visible:ring-brand-500 outline-none"
                        aria-label="Rechercher une demande"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-border/40 dark:border-border/40 rounded-3xl text-sm font-medium outline-none focus:ring-2 focus-visible:ring-brand-500"
                    >
                        <option value="All">Tous les statuts</option>
                        <option value="New">Nouveaux</option>
                        <option value="Processing">En cours</option>
                        <option value="Completed">Terminés</option>
                    </select>
                    <Button onClick={onCreate} className="whitespace-nowrap">
                        <Plus className="h-4 w-4 mr-2" /> Nouvelle Demande
                    </Button>
                </div>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
                    </div>
                ) : filteredRequests.length > 0 ? (
                    filteredRequests.map(req => (
                        <motion.div
                            key={req.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-slate-800/50 p-4 rounded-2xl border border-border/40 dark:border-white/5 hover:border-brand-500 dark:hover:border-brand-500 cursor-pointer transition-all shadow-sm group"
                            onClick={() => onSelect?.(req)}
                        >
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-brand-50 dark:bg-brand-800 rounded-3xl text-brand-600 dark:text-brand-400 group-hover:bg-brand-100 dark:group-hover:bg-brand-900 transition-colors">
                                        <User className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-900 dark:text-white">{req.dataSubject}</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-300 px-2 py-0.5 bg-slate-100 dark:bg-slate-900 rounded-md font-mono">{req.id}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <FileText className="h-3.5 w-3.5" /> {req.requestType}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3.5 w-3.5" /> Échéance: {format(new Date(req.dueDate), 'dd MMM yyyy', { locale: fr })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 self-end md:self-center">
                                    <div className="text-right hidden md:block">
                                        <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Reçu le</div>
                                        <div className="text-sm font-medium">{format(new Date(req.submissionDate), 'dd MMM yyyy', { locale: fr })}</div>
                                    </div>
                                    <Badge status={getStatusColor(req.status) as 'info' | 'brand' | 'success' | 'error' | 'neutral'}>{req.status}</Badge>
                                </div>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <EmptyState
                        icon={User}
                        title="Aucune demande trouvée"
                        description="Il n'y a pas de demandes d'exercice de droits correspondant à vos critères."
                        actionLabel="Créer une demande"
                        onAction={onCreate}
                    />
                )}
            </div>
        </div>
    );
};
