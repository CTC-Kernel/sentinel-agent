import React from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, Globe, Users, ThumbsUp, MessageSquare, CheckCircle } from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { SourceBadge } from './SourceBadge';
import { useStore } from '@/store';
import type { Threat } from '@/types/risks';

const severityBorderColor: Record<string, string> = {
  Critical: 'border-l-error-text',
  High: 'border-l-warning-text',
  Medium: 'border-l-info-text',
  Low: 'border-l-muted-foreground/40',
};

const severityBadgeStatus = (severity: string): 'error' | 'warning' | 'info' | 'neutral' => {
  if (severity === 'Critical') return 'error';
  if (severity === 'High') return 'warning';
  if (severity === 'Medium') return 'info';
  return 'neutral';
};

interface ThreatCardProps {
  threat: Threat;
  onSelect: (t: Threat) => void;
  onConfirmSighting: (id: string) => void;
  onDownloadRule: (e: React.MouseEvent, t: Threat) => void;
  onCreateRisk: (t: Threat) => void;
}

export const ThreatCard: React.FC<ThreatCardProps> = React.memo(({
  threat,
  onSelect,
  onConfirmSighting,
  onDownloadRule,
  onCreateRisk,
}) => {
  const { t } = useStore();

  const isSimulated = threat.id.startsWith('simulated') || threat.id.startsWith('baseline');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(threat)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(threat);
        }
      }}
      className={`bg-card/50 rounded-2xl border border-border dark:border-white/5 hover:border-primary/40 transition-all group relative cursor-pointer border-l-4 ${severityBorderColor[threat.severity] || 'border-l-muted-foreground/40'}`}
    >
      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`p-2.5 rounded-2xl shrink-0 ${threat.type === 'Ransomware' ? 'bg-error-bg text-error-text' : 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'}`}>
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {threat.title}
                </h3>
                {threat.verified && (
                  <CheckCircle className="h-4 w-4 text-success-text shrink-0" aria-label="Verified" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSimulated && (
              <Badge status="neutral" variant="outline" className="opacity-70">Sim</Badge>
            )}
            <SourceBadge source={threat.source} />
            <Badge status={severityBadgeStatus(threat.severity)} variant="soft">{threat.severity}</Badge>
            <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">{threat.date}</span>
          </div>
        </div>

        {/* Description preview */}
        {threat.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3 ml-12">
            {threat.description}
          </p>
        )}

        {/* Subtitle: country + author */}
        <div className="flex items-center text-sm text-muted-foreground gap-4 mb-4 ml-12">
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" /> {threat.country}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {threat.author}
          </span>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-4 pt-3 border-t border-border/60 dark:border-white/5 ml-12">
          <Button
            variant="ghost"
            aria-label="Confirm sighting"
            onClick={(e) => { e.stopPropagation(); onConfirmSighting(threat.id); }}
            className="flex items-center text-xs font-bold text-muted-foreground hover:text-primary h-auto p-0 hover:bg-transparent"
            title="Confirm sighting"
          >
            <ThumbsUp className="h-4 w-4 mr-1.5" /> {threat.votes} Confirmations
          </Button>
          <Button
            variant="ghost"
            aria-label="View discussions"
            className="flex items-center text-xs font-bold text-muted-foreground hover:text-primary h-auto p-0 hover:bg-transparent"
            title="View discussions"
          >
            <MessageSquare className="h-4 w-4 mr-1.5" /> {threat.comments || 0} Discussions
          </Button>
          <div className="ml-auto flex gap-2">
            <Button
              aria-label="Download SIGMA rule"
              onClick={(e) => onDownloadRule(e, threat)}
              className="text-xs font-bold text-success-text px-3 py-1 h-auto bg-success-bg rounded-lg hover:bg-success-bg/80"
              title="Download SIGMA rule"
            >
              SIGMA
            </Button>
            <Button
              aria-label="Create risk from threat"
              onClick={(e) => { e.stopPropagation(); onCreateRisk(threat); }}
              className="text-xs font-bold text-warning-text px-3 py-1 h-auto bg-warning-bg rounded-lg hover:bg-warning-bg/80"
              title="Create risk from threat"
            >
              {t('threats.createRisk', { defaultValue: 'Risque' })}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

ThreatCard.displayName = 'ThreatCard';
