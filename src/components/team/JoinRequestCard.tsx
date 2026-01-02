import React from 'react';
import { useTranslation } from 'react-i18next';
import { JoinRequest } from '../../types';
import { Check, XCircle } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';

interface JoinRequestCardProps {
    req: JoinRequest;
    onApprove: (req: JoinRequest) => void;
    onReject: (req: JoinRequest) => void;
}

export const JoinRequestCard = React.memo(({ req, onApprove, onReject }: JoinRequestCardProps) => {
    const { t } = useTranslation();
    const handleReject = React.useCallback(() => onReject(req), [onReject, req]);
    const handleApprove = React.useCallback(() => onApprove(req), [onApprove, req]);

    return (
        <div className="glass-panel p-5 rounded-2xl border border-blue-200/50 dark:border-blue-900/30 shadow-sm flex flex-col relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-50/30 dark:bg-blue-900/10 pointer-events-none" />
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shadow-sm">
                        {req.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-bold text-slate-900 dark:text-white">{req.displayName}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{req.userEmail}</p>
                    </div>
                </div>
                <div className="mt-auto flex gap-2 pt-3">
                    <CustomTooltip content={t('team.actions.reject')}>
                        <button
                            type="button"
                            aria-label={t('team.actions.reject')}
                            onClick={handleReject}
                            className="flex-1 py-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all flex items-center justify-center gap-1"
                        >
                            <XCircle className="h-3.5 w-3.5" /> {t('team.actions.reject')}
                        </button>
                    </CustomTooltip>
                    <CustomTooltip content={t('team.actions.approve')}>
                        <button
                            type="button"
                            aria-label={t('team.actions.approve')}
                            onClick={handleApprove}
                            className="flex-1 py-2 bg-blue-600 text-white border border-blue-500 rounded-xl text-xs font-bold hover:bg-blue-700 hover:shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1"
                        >
                            <Check className="h-3.5 w-3.5" /> {t('team.actions.approve')}
                        </button>
                    </CustomTooltip>
                </div>
            </div>
        </div>
    );
});
