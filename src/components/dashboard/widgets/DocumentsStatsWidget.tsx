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

export const DocumentsStatsWidget: React.FC<DocumentsStatsWidgetProps> = ({ navigate: propNavigate, t = (k) => k }) => {
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
        <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-brand-500" />
                    Documents
                </h3>
                <button
                    onClick={() => navigate('/documents')}
                    className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                    Voir tout
                </button>
            </div>

            <div className="flex items-center gap-6 flex-1 justify-center">
                {/* Simplified Circular Progress */}
                <div className="relative group cursor-pointer" onClick={() => navigate('/documents')}>
                    <svg className="w-24 h-24 transform -rotate-90">
                        <circle
                            className="text-slate-100 dark:text-slate-800"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            r="40"
                            cx="48"
                            cy="48"
                        />
                        <circle
                            className={`${stats.validationRate >= 80 ? 'text-emerald-500' : stats.validationRate >= 50 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                            strokeWidth="8"
                            strokeDasharray={251}
                            strokeDashoffset={251 - (251 * stats.validationRate) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="40"
                            cx="48"
                            cy="48"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black text-foreground">{Math.round(stats.validationRate)}%</span>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground">Validés</span>
                    </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[120px]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            <span className="text-xs text-muted-foreground font-medium">Total</span>
                        </div>
                        <span className="text-sm font-bold text-foreground">{stats.totalDocs}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-xs text-muted-foreground font-medium">Publiés</span>
                        </div>
                        <span className="text-sm font-bold text-foreground">{stats.publishedDocs}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 flex items-center gap-2 border border-slate-100 dark:border-white/5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Publiés</span>
                        <span className="text-sm font-bold text-foreground">{stats.publishedDocs}</span>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 flex items-center gap-2 border border-slate-100 dark:border-white/5">
                    <Edit className="w-4 h-4 text-slate-500" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Brouillons</span>
                        <span className="text-sm font-bold text-foreground">{stats.draftDocs}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
