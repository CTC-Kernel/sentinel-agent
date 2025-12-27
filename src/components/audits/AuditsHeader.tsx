import React from 'react';
import { Plus, Download, Calendar, BrainCircuit } from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';


interface AuditsHeaderProps {
    title: string;
    subtitle: string;
    onNewAudit: () => void;
    onGeneratePlan: () => void;
    onExportCSV: () => void;
    onExportCalendar: () => void;
    canEdit: boolean;
}

export const AuditsHeader: React.FC<AuditsHeaderProps> = ({
    title, subtitle, onNewAudit, onGeneratePlan, onExportCSV, onExportCalendar, canEdit
}) => {
    return (
        <PageHeader
            title={title}
            subtitle={subtitle}

            actions={
                <div className="flex gap-2">
                    <button onClick={onExportCalendar} className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg" title="Exporter Calendrier">
                        <Calendar className="w-5 h-5" />
                    </button>
                    <button onClick={onExportCSV} className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg" title="Exporter CSV">
                        <Download className="w-5 h-5" />
                    </button>
                    {canEdit && (
                        <>
                            <button
                                onClick={onGeneratePlan}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors font-medium text-sm border border-purple-200 dark:border-purple-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                            >
                                <BrainCircuit className="w-4 h-4" />
                                <span>Assistant IA</span>
                            </button>
                            <button
                                onClick={onNewAudit}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors font-medium text-sm shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Nouvel Audit</span>
                            </button>
                        </>
                    )}
                </div>
            }
        />
    );
};
