import React from 'react';
import { EvidenceRequest, UserProfile, Document } from '../../types';
import { Clock, User, ChevronDown, FileText, X, Trash2, ShieldCheck } from '../ui/Icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileUploader } from '../ui/FileUploader';

interface EvidenceRequestItemProps {
    req: EvidenceRequest;
    user: UserProfile | null;
    users: UserProfile[];
    documents: Document[];
    isExpanded: boolean;
    canEdit: boolean;
    onExpand: (id: string | null) => void;
    onStatusChange: (req: EvidenceRequest, status: EvidenceRequest['status']) => void;
    onDelete: (id: string) => void;
    onUpload: (req: EvidenceRequest, url: string, name: string) => void;
}

export const EvidenceRequestItem: React.FC<EvidenceRequestItemProps> = React.memo(({
    req,
    users,
    documents,
    isExpanded,
    canEdit,
    onExpand,
    onStatusChange,
    onDelete,
    onUpload
}) => {
    const [processingAction, setProcessingAction] = React.useState<string | null>(null);

    const handleAction = async (actionName: string, actionFn: () => void | Promise<void>) => {
        if (processingAction) return;
        setProcessingAction(actionName);
        try {
            await actionFn();
        } finally {
            if (actionName !== 'delete') { // If delete, component might unmount, but harmless to set
                setProcessingAction(null);
            }
        }
    };

    const handleUpload = async (url: string, name: string) => {
        await handleAction('upload', async () => onUpload(req, url, name));
    };

    return (
        <div key={req.id} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md hover:border-brand-200 dark:hover:border-brand-600 group">
            <div
                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-xl"
                onClick={() => onExpand(isExpanded ? null : req.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onExpand(isExpanded ? null : req.id)}
            >
                <div className="flex items-center gap-4 min-w-0">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${req.status === 'Accepted' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 dark:bg-slate-800'}`}>
                        <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate pr-4">{req.title}</h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
                            <span className={`inline-flex items-center gap-1 font-semibold ${req.status === 'Accepted' ? 'text-emerald-600' : req.status === 'Provided' ? 'text-blue-600' : 'text-amber-600'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${req.status === 'Accepted' ? 'bg-emerald-500' : req.status === 'Provided' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                                {req.status}
                            </span>
                            {req.dueDate && (
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(req.dueDate), 'dd MMM', { locale: fr })}
                                </span>
                            )}
                            {req.assignedTo && (
                                <span className="flex items-center gap-1 truncate max-w-[120px]">
                                    <User className="w-3 h-3" />
                                    {users.find(u => u.uid === req.assignedTo)?.displayName?.split(' ')[0] || 'Inconnu'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 pl-4">
                    <div className={`p-1.5 rounded-full transition-transform duration-200 ${isExpanded ? 'bg-slate-100 dark:bg-white/10 rotate-180' : ''}`}>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                    <div className="mb-6">
                        <h5 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 tracking-wider mb-2">Description</h5>
                        <p className="text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                            {req.description}
                        </p>
                    </div>

                    {/* Documents List */}
                    <div className="space-y-3 mb-6">
                        <h5 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 tracking-wider mb-2">Preuves fournies</h5>
                        {req.documentIds && req.documentIds.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {req.documentIds.map(docId => {
                                    const docObj = documents.find(d => d.id === docId);
                                    if (!docObj) return null;
                                    return (
                                        <div key={docId} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 text-sm hover:border-brand-300 transition-colors group">
                                            <div className="flex items-center overflow-hidden">
                                                <FileText className="w-4 h-4 text-brand-500 mr-2 flex-shrink-0" />
                                                <span className="truncate font-medium text-slate-700 dark:text-slate-200">{docObj.title}</span>
                                            </div>
                                            <a href={docObj.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700 text-xs font-bold px-3 py-1 bg-brand-50 dark:bg-brand-800 rounded-lg opacity-0 group-hover:opacity-70 transition-opacity focus:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                                                Voir
                                            </a>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                                <p className="text-xs text-slate-500 dark:text-slate-300 italic">Aucun document fourni pour le moment.</p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col md:flex-row gap-6 pt-6 border-t border-slate-200 dark:border-white/10">
                        <div className="flex-1">
                            <h5 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 tracking-wider mb-2">Ajouter une preuve</h5>
                            <FileUploader
                                onUploadComplete={handleUpload}
                                category="evidence"
                                disabled={!!processingAction}
                            />
                        </div>

                        {canEdit && (
                            <div className="flex flex-col gap-2 min-w-[150px]">
                                <h5 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 tracking-wider mb-2">Actions</h5>
                                {req.status !== 'Accepted' && (
                                    <button
                                        type="button"
                                        onClick={() => handleAction('accept', () => onStatusChange(req, 'Accepted'))}
                                        disabled={!!processingAction}
                                        aria-label="Accepter la demande"
                                        className="w-full px-3 py-2 bg-emerald-500 dark:bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 dark:hover:bg-emerald-700 transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600"
                                    >
                                        {processingAction === 'accept' ? <span className="animate-spin mr-2">⌛</span> : <ShieldCheck className="w-4 h-4 mr-2" />}
                                        Accepter
                                    </button>
                                )}
                                {req.status !== 'Rejected' && (
                                    <button
                                        type="button"
                                        onClick={() => handleAction('reject', () => onStatusChange(req, 'Rejected'))}
                                        disabled={!!processingAction}
                                        aria-label="Rejeter la demande"
                                        className="w-full px-3 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-600 dark:hover:bg-red-700 transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600"
                                    >
                                        {processingAction === 'reject' ? <span className="animate-spin mr-2">⌛</span> : <X className="w-4 h-4 mr-2" />}
                                        Rejeter
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleAction('delete', () => onDelete(req.id))}
                                    disabled={!!processingAction}
                                    aria-label="Supprimer la demande"
                                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors flex items-center justify-center mt-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600"
                                >
                                    {processingAction === 'delete' ? <span className="animate-spin mr-2">⌛</span> : <Trash2 className="w-4 h-4 mr-2" />}
                                    Supprimer
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

EvidenceRequestItem.displayName = 'EvidenceRequestItem';
