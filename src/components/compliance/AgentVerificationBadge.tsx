import React from 'react';
import { useControlAgentVerification } from '../../hooks/useAgentData';
import { CheckCircle2, XCircle, AlertTriangle, Bot, Clock } from '../ui/Icons';
import { Tooltip } from '../ui/Tooltip';
import { cn } from '../../lib/utils';
import { useLocale } from '../../hooks/useLocale';

interface AgentVerificationBadgeProps {
 controlId: string;
 framework?: string;
 showLabel?: boolean;
 className?: string;
}

/**
 * Badge component showing if a control has been verified by an agent
 * Shows the verification status, last check time, and evidence link
 */
export const AgentVerificationBadge: React.FC<AgentVerificationBadgeProps> = ({
 controlId,
 framework,
 showLabel = false,
 className
}) => {
 const { t } = useLocale();
 const { verified, status, lastCheck } = useControlAgentVerification(controlId, framework);

 if (!verified) {
 return showLabel ? (
 <span className={cn(
 "inline-flex items-center gap-1 text-xs text-muted-foreground",
 className
 )}>
 <Bot className="w-3 h-3" />
 <span>{t('common.agents.verification.notVerified')}</span>
 </span>
 ) : null;
 }

 const getStatusConfig = () => {
 switch (status) {
 case 'pass':
 return {
  icon: CheckCircle2,
  color: 'text-success-text',
  bgColor: 'bg-success-bg',
  borderColor: 'border-success-border',
  label: 'OK'
 };
 case 'fail':
 return {
  icon: XCircle,
  color: 'text-error-text',
  bgColor: 'bg-error-bg',
  borderColor: 'border-error-border',
  label: 'Fail'
 };
 case 'error':
 return {
  icon: AlertTriangle,
  color: 'text-warning-text',
  bgColor: 'bg-warning-bg',
  borderColor: 'border-warning-border',
  label: 'Error'
 };
 default:
 return {
  icon: Clock,
  color: 'text-muted-foreground',
  bgColor: 'bg-muted',
  borderColor: 'border-border',
  label: 'N/A'
 };
 }
 };

 const config = getStatusConfig();
 const Icon = config.icon;

 const formatLastCheck = (timestamp: string | null) => {
 if (!timestamp) return '';
 const date = new Date(timestamp);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 const diffHours = Math.floor(diffMins / 60);
 const diffDays = Math.floor(diffHours / 24);

 if (diffMins < 1) return t('compliance.time.justNow', { defaultValue: 'À l\'instant' });
 if (diffMins < 60) return t('compliance.time.minutesAgo', { defaultValue: 'Il y a {{mins}} min', mins: diffMins });
 if (diffHours < 24) return t('compliance.time.hoursAgo', { defaultValue: 'Il y a {{hours}}h', hours: diffHours });
 return t('compliance.time.daysAgo', { defaultValue: 'Il y a {{days}}j', days: diffDays });
 };

 const tooltipContent = (
 <div className="text-xs">
 <div className="font-semibold">{t('common.agents.verification.verifiedByAgent')}</div>
 {lastCheck && (
 <div className="text-muted-foreground mt-1">
  {t('common.agents.verification.lastCheck')}: {formatLastCheck(lastCheck)}
 </div>
 )}
 </div>
 );

 return (
 <Tooltip content={tooltipContent} position="top">
 <span className={cn(
 "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-medium transition-colors",
 config.bgColor,
 config.borderColor,
 config.color,
 className
 )}>
 <Bot className="w-3 h-3 opacity-60" />
 <Icon className="w-3.5 h-3.5" />
 {showLabel && <span>{config.label}</span>}
 </span>
 </Tooltip>
 );
};

/**
 * Inline indicator for tables/lists showing agent verification
 */
export const AgentVerificationIndicator: React.FC<{
 controlId: string;
 framework?: string;
}> = ({ controlId, framework }) => {
 const { verified, status } = useControlAgentVerification(controlId, framework);
 const { t } = useLocale();

 if (!verified) return null;

 const getStatusColor = () => {
 switch (status) {
 case 'pass': return 'bg-success';
 case 'fail': return 'bg-error';
 case 'error': return 'bg-warning';
 default: return 'bg-muted-foreground';
 }
 };

 return (
 <Tooltip content={t('common.agents.verification.verifiedByAgent')} position="top">
 <span className="inline-flex items-center gap-1">
 <Bot className="w-3 h-3 text-primary" />
 <span className={cn("w-2 h-2 rounded-full", getStatusColor())} />
 </span>
 </Tooltip>
 );
};

export default AgentVerificationBadge;
