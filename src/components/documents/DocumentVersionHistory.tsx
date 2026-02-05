import React from 'react';
import { DocumentVersion } from '../../types';
import { Clock, Download } from '../ui/Icons';
import { format } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';

interface DocumentVersionHistoryProps {
    versions: DocumentVersion[];
    currentVersionId?: string;
}

export const DocumentVersionHistory: React.FC<DocumentVersionHistoryProps> = ({ versions, currentVersionId }) => {
    const { dateFnsLocale } = useLocale();

    if (versions.length === 0) {
        return <div className="text-center py-8 text-muted-foreground text-sm">Aucune version antérieure disponible.</div>;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-500" />
                Historique des Versions
            </h3>

            <div className="space-y-3">
                {versions.map((version) => (
                    <div key={version.id || 'unknown'} className={`p-4 rounded-3xl border flex items-center justify-between group transition-all ${version.id === currentVersionId
                        ? 'bg-brand-50 border-brand-200 dark:bg-brand-800 dark:border-brand-800'
                        : 'bg-white border-border/40 dark:bg-slate-800/50 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700'
                        }`}>
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-muted-foreground font-mono font-bold text-sm">
                                v{version.version}
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white">
                                    {version.changeLog || 'Mise à jour standard'}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                    <span>{version.uploadedAt ? format(new Date(version.uploadedAt), 'PPP à p', { locale: dateFnsLocale }) : 'Date inconnue'}</span>
                                    {version.id === currentVersionId && (
                                        <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded text-[11px] font-bold">ACTUEL</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-70 transition-opacity">
                            {version.url && (
                                <a
                                    href={version.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-muted-foreground hover:text-brand-600 transition-colors"
                                    title="Télécharger"
                                >
                                    <Download className="h-4 w-4" />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
