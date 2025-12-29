import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { Document } from '../../types';
import { FileText, CheckCircle2, Clock, ArrowRight } from '../ui/Icons';
import { motion } from 'framer-motion';

interface ApprovalsWidgetProps {
    documents: Document[];
}

export const ApprovalsWidget: React.FC<ApprovalsWidgetProps> = ({ documents }) => {
    const { user } = useStore();
    const navigate = useNavigate();

    const pendingApprovals = documents.filter(doc =>
        doc.status === 'En revue' &&
        doc.reviewers?.includes(user?.uid || '') &&
        !doc.approvers?.includes(user?.uid || '')
    );

    const handleDocumentClick = useCallback((docId: string) => {
        navigate('/documents', { state: { voxelSelectedId: docId, voxelSelectedType: 'document' } });
    }, [navigate]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent, docId: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate('/documents', { state: { voxelSelectedId: docId, voxelSelectedType: 'document' } });
        }
    }, [navigate]);

    if (pendingApprovals.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-3xl p-6 border border-amber-100 dark:border-amber-900/30"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Approbations</h3>
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{pendingApprovals.length} document(s) à revoir</p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/documents')}
                    className="p-2 hover:bg-white/50 dark:hover:bg-black/10 rounded-xl transition-colors text-amber-900 dark:text-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>

            <div className="space-y-3">
                {pendingApprovals.slice(0, 3).map(doc => (
                    <div
                        key={doc.id}
                        onClick={() => handleDocumentClick(doc.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => handleKeyDown(e, doc.id)}
                        className="bg-white/80 dark:bg-slate-900/50 p-3 rounded-xl border border-amber-200/50 dark:border-amber-900/20 cursor-pointer hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{doc.title}</span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg whitespace-nowrap">
                                v{doc.version}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                            <Clock className="h-3 w-3" />
                            <span>En attente depuis {new Date(doc.updatedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};
