import React from 'react';
import { Plus, Download, Calendar, BrainCircuit } from '../ui/Icons';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/button';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();

    return (
        <PageHeader
            title={title}
            subtitle={subtitle}

            actions={
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={onExportCalendar} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white" aria-label={t('audits.exportCalendar')}>
                        <Calendar className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onExportCSV} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white" aria-label={t('audits.exportCSV')}>
                        <Download className="w-5 h-5" />
                    </Button>
                    {canEdit && (
                        <>
                            <Button
                                variant="outline"
                                onClick={onGeneratePlan}
                                className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 border-purple-200 dark:border-purple-800"
                            >
                                <BrainCircuit className="w-4 h-4" />
                                <span>{t('audits.aiAssistant')}</span>
                            </Button>
                            <Button
                                onClick={onNewAudit}
                                className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm hover:shadow-md"
                            >
                                <Plus className="w-4 h-4" />
                                <span>{t('audits.newAudit')}</span>
                            </Button>
                        </>
                    )}
                </div>
            }
        />
    );
};
