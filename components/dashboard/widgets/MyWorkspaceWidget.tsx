import React, { useState } from 'react';
import { User, CheckCircle2, ArrowRight } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { DashboardCard } from '../DashboardCard';

interface ActionItem {
    id: string;
    type: 'audit' | 'document' | 'project' | 'policy' | 'incident' | 'risk';
    title: string;
    date: string;
    status: string;
    link: string;
}

interface MyWorkspaceWidgetProps {
    myActionItems: ActionItem[];
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
}

export const MyWorkspaceWidget: React.FC<MyWorkspaceWidgetProps> = ({ myActionItems, loading, navigate, t }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Filter items for compact view (show max 5)
    const displayItems = isExpanded ? myActionItems : myActionItems.slice(0, 5);

    return (
        <DashboardCard
            title={t('dashboard.myWorkspace')}
            subtitle={t('dashboard.todoThisWeek')}
            icon={<User className="w-5 h-5" />}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandable={true}
            className="min-h-[400px]"
        >
            <div className={`h-full overflow-y-auto custom-scrollbar ${isExpanded ? 'p-0' : 'p-0'}`}>
                {loading ? <Skeleton className="h-full w-full m-4" /> : myActionItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center"><CheckCircle2 className="h-12 w-12 text-emerald-500/30 mb-4" /><p className="text-sm font-bold text-slate-600">{t('dashboard.nothingToReport')}</p></div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {displayItems.map(item => (
                            <div key={item.id} onClick={() => navigate(item.link)} className="p-4 hover:bg-white dark:hover:bg-white/5 cursor-pointer group/item transition-all flex items-center gap-4">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.type === 'audit' ? 'bg-blue-500' :
                                    item.type === 'policy' ? 'bg-red-500' :
                                        item.type === 'incident' ? 'bg-rose-600' :
                                            item.type === 'risk' ? 'bg-amber-500' :
                                                'bg-orange-500'
                                    }`}></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${item.type === 'audit' ? 'bg-blue-50 dark:bg-slate-900 border-blue-100 text-blue-600 dark:bg-slate-900/20 dark:border-blue-900/30 dark:text-blue-400' :
                                            item.type === 'policy' ? 'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400' :
                                                item.type === 'incident' ? 'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-900/20 dark:border-rose-900/30 dark:text-rose-400' :
                                                    item.type === 'risk' ? 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-900/20 dark:border-amber-900/30 dark:text-amber-400' :
                                                        'bg-orange-50 border-orange-100 text-orange-600 dark:bg-orange-900/20 dark:border-orange-900/30 dark:text-orange-400'
                                            }`}>
                                            {item.type === 'audit' ? t('dashboard.typeAudit') :
                                                item.type === 'policy' ? t('dashboard.typeSignature') :
                                                    item.type === 'document' ? t('dashboard.typeReview') :
                                                        item.type === 'incident' ? 'Incident' :
                                                            item.type === 'risk' ? 'Risque' :
                                                                t('dashboard.typeProject')}
                                        </span>
                                        <span className="text-xs text-slate-500 font-medium tabular-nums">{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors truncate">{item.title}</h4>
                                    <p className="text-xs text-slate-600 mt-0.5 truncate">{item.status}</p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover/item:text-slate-600 -translate-x-2 opacity-0 group-hover/item:translate-x-0 group-hover/item:opacity-100 transition-all" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {!isExpanded && myActionItems.length > 5 && (
                <div className="p-3 bg-slate-50/50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 text-center">
                    <span className="text-xs font-semibold text-slate-600">{myActionItems.length - 5} {t('common.more').toLowerCase()}...</span>
                </div>
            )}
        </DashboardCard>
    );
};
