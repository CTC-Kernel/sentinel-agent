import React from 'react';
import { FileText, ExternalLink } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import type { Document } from '../../../types';

interface AssetInspectorDocumentsProps {
    linkedDocuments: Document[];
}

export const AssetInspectorDocuments: React.FC<AssetInspectorDocumentsProps> = ({
    linkedDocuments
}) => {
    return (
        <div className="space-y-6 sm:space-y-8">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 flex items-center">
                <FileText className="h-4 w-4 mr-2" /> Documents Liés ({linkedDocuments.length})
            </h3>
            {linkedDocuments.length === 0 ? (
                <EmptyState compact icon={FileText} title="Aucun document" description="Aucun document associé." />
            ) : (
                <div className="grid gap-4">
                    {linkedDocuments.map(doc => (
                        <div key={doc.id} className="p-5 glass-panel-lite rounded-3xl border border-white/60 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white truncate pr-4">{doc.title}</span>
                                <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-lg ${doc.status === 'Publié' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-1 ring-slate-500/20'}`}>
                                    {doc.status}
                                </span>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <span className="text-xs text-slate-500">{doc.type} • v{doc.version}</span>
                                <CustomTooltip content="Ouvrir le document dans un nouvel onglet">
                                    <a href={doc.url} target="_blank" rel="noreferrer" aria-label={`Voir le document ${doc.title}`} className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center">
                                        Voir <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                </CustomTooltip>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
