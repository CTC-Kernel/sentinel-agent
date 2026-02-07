import React from 'react';
import { useLocale } from '../../hooks/useLocale';
import { JoinRequest } from '../../types';
import { Check, XCircle } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';

interface JoinRequestCardProps {
 req: JoinRequest;
 onApprove: (req: JoinRequest) => void;
 onReject: (req: JoinRequest) => void;
}

export const JoinRequestCard = React.memo(({ req, onApprove, onReject }: JoinRequestCardProps) => {
 const { t } = useLocale();
 const handleReject = React.useCallback(() => onReject(req), [onReject, req]);
 const handleApprove = React.useCallback(() => onApprove(req), [onApprove, req]);

 return (
 <div className="glass-premium p-5 rounded-2xl border border-border/40 shadow-sm flex flex-col relative overflow-hidden group">
 <div className="absolute inset-0 bg-blue-50/30 dark:bg-blue-900/30 dark:bg-blue-900 pointer-events-none" />
 <div className="relative z-decorator">
 <div className="flex items-center gap-3 mb-3">
  <div className="w-10 h-10 rounded-full bg-info-bg text-info-text flex items-center justify-center font-bold shadow-sm">
  {req.displayName.charAt(0).toUpperCase()}
  </div>
  <div>
  <p className="font-bold text-foreground">{req.displayName}</p>
  <p className="text-xs text-muted-foreground">{req.userEmail}</p>
  </div>
 </div>
 <div className="mt-auto flex gap-2 pt-3">
  <CustomTooltip content={t('team.actions.reject')}>
  <button
  type="button"
  aria-label={t('team.actions.reject')}
  onClick={handleReject}
  className="flex-1 py-2 bg-card/50 border border-border/40 text-muted-foreground rounded-3xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all flex items-center justify-center gap-1"
  >
  <XCircle className="h-3.5 w-3.5" /> {t('team.actions.reject')}
  </button>
  </CustomTooltip>
  <CustomTooltip content={t('team.actions.approve')}>
  <button
  type="button"
  aria-label={t('team.actions.approve')}
  onClick={handleApprove}
  className="flex-1 py-2 bg-primary hover:bg-primary/90 text-primary-foreground border border-primary rounded-3xl text-xs font-bold hover:bg-primary hover:shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-1"
  >
  <Check className="h-3.5 w-3.5" /> {t('team.actions.approve')}
  </button>
  </CustomTooltip>
 </div>
 </div>
 </div>
 );
});
