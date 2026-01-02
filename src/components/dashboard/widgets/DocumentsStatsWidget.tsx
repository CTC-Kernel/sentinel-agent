import React, { useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Document } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { FileText, CheckCircle2, Edit, Loader2 } from '../../ui/Icons';
import { useNavigate } from 'react-router-dom';

interface DocumentsStatsWidgetProps {
    navigate?: (path: string) => void;
    t?: (key: string) => string;
}

export const DocumentsStatsWidget: React.FC<DocumentsStatsWidgetProps> = ({ navigate: propNavigate }) => {
    const { user } = useStore();
    const routerNavigate = useNavigate();
    const navigate = propNavigate || routerNavigate;

    const { data: documents, loading } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const stats = useMemo(() => {
        const totalDocs = documents.length;
        const publishedDocs = documents.filter(d => d.status === 'Publié' || d.status === 'Approuvé').length;
        const draftDocs = documents.filter(d => d.status === 'Brouillon').length;
        const validationRate = totalDocs > 0 ? (publishedDocs / totalDocs) * 100 : 0;

        return {
            totalDocs,
            publishedDocs,
            draftDocs,
            validationRate
        };
    }, [documents]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-5 glass-panel rounded-2xl border border-white/60 dark:border-white/5 shadow-sm relative overflow-hidden group hover:shadow-apple transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/5 relative z-10">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                        <FileText className="w-4 h-4" />
                    </div>
                    Documents
                </h3>
                <button
                    onClick={() => navigate('/documents')}
                    className="text-xs font-bold px-2 py-1 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors border border-white/50 dark:border-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                    Voir tout
                </button>
            </div>

            <div className="flex items-center gap-6 flex-1 justify-center relative z-10 py-2">
                {/* Score Circle */}
                <div
                    className="relative group/chart cursor-pointer transform hover:scale-105 transition-transform duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-full"
                    onClick={() => navigate('/documents')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate('/documents')}
                >
                    <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="-4 -4 104 104">
                        <defs>
                            <linearGradient id="docGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={stats.validationRate >= 80 ? 'hsl(var(--success))' : stats.validationRate >= 50 ? 'hsl(var(--primary))' : 'hsl(var(--warning))'} />
                                <stop offset="100%" stopColor={stats.validationRate >= 80 ? 'hsl(var(--emerald-400))' : stats.validationRate >= 50 ? 'hsl(var(--blue-400))' : 'hsl(var(--amber-400))'} />
                            </linearGradient>
                        </defs>
                        <circle
                            className="text-slate-100 dark:text-slate-800"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            r="42"
                            cx="48"
                            cy="48"
                        />
                        <circle
                            stroke="url(#docGradient)"
                            strokeWidth="8"
                            strokeDasharray={263.89}
                            strokeDashoffset={263.89 - (263.89 * stats.validationRate) / 100}
                            strokeLinecap="round"
                            fill="transparent"
                            r="42"
                            cx="48"
                            cy="48"
                            className="drop-shadow-sm"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-foreground tracking-tight">{Math.round(stats.validationRate)}%</span>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">Validés</span>
                    </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[100px]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span className="text-xs text-muted-foreground font-bold">Total</span>
                        </div>
                        <span className="text-xs font-black text-foreground">{stats.totalDocs}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/40" />
                            <span className="text-xs text-muted-foreground font-bold">Publiés</span>
                        </div>
                        <span className="text-xs font-black text-foreground">{stats.publishedDocs}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                            <span className="text-xs text-muted-foreground font-bold">Brouillons</span>
                        </div>
                        <span className="text-xs font-black text-foreground">{stats.draftDocs}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto relative z-10">
                <div className="bg-white/50 dark:bg-white/5 rounded-xl p-2.5 flex items-center gap-3 border border-white/60 dark:border-white/5 hover:bg-white/80 dark:hover:bg-white/10 transition-colors">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider truncate">Publiés</span>
                        <span className="text-sm font-black text-foreground leading-none mt-0.5">{stats.publishedDocs}</span>
                    </div>
                </div>
                <div className="bg-white/50 dark:bg-white/5 rounded-xl p-2.5 flex items-center gap-3 border border-white/60 dark:border-white/5 hover:bg-white/80 dark:hover:bg-white/10 transition-colors">
                    <Edit className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider truncate">Brouillons</span>
                        <span className="text-sm font-black text-foreground leading-none mt-0.5">{stats.draftDocs}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
