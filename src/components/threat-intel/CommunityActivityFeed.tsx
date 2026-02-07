import React from 'react';
import { Shield, CheckCircle, Eye } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { useStore } from '@/store';
import type { CommunityActivity } from '@/types/business';

const activityConfig: Record<CommunityActivity['type'], { icon: React.ElementType; verb: string; color: string }> = {
  threat_reported: { icon: Shield, verb: 'a signalé', color: 'text-primary' },
  threat_verified: { icon: CheckCircle, verb: 'a vérifié', color: 'text-success-text' },
  sighting_confirmed: { icon: Eye, verb: 'a confirmé', color: 'text-warning-text' },
};

function timeAgo(timestamp: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t('common.justNow', { defaultValue: "À l'instant" });
  if (minutes < 60) return t('common.minutesAgo', { defaultValue: 'Il y a {{count}} min', count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('common.hoursAgo', { defaultValue: 'Il y a {{count}}h', count: hours });
  const days = Math.floor(hours / 24);
  return t('common.daysAgo', { defaultValue: 'Il y a {{count}}j', count: days });
}

interface CommunityActivityFeedProps {
  activities: CommunityActivity[];
  onActivityClick?: (threatId: string) => void;
}

export const CommunityActivityFeed: React.FC<CommunityActivityFeedProps> = React.memo(({ activities, onActivityClick }) => {
  const { t } = useStore();

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {t('threatIntel.community.noActivity', { defaultValue: 'Aucune activité récente' })}
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar">
      {activities.slice(0, 15).map((activity) => {
        const config = activityConfig[activity.type];
        const Icon = config.icon;

        return (
          <div
            key={activity.id}
            role="button"
            tabIndex={0}
            onClick={() => onActivityClick?.(activity.threatId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivityClick?.(activity.threatId);
              }
            }}
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            <div className={`p-1.5 rounded-lg bg-muted/80 shrink-0 ${config.color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-snug">
                <span className="font-semibold">{activity.actorName}</span>{' '}
                <span className="text-muted-foreground">{config.verb}</span>{' '}
                <span className="font-medium group-hover:text-primary transition-colors truncate">
                  &lsquo;{activity.threatTitle}&rsquo;
                </span>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{timeAgo(activity.timestamp, t)}</span>
                {activity.severity && (
                  <Badge
                    status={activity.severity === 'Critical' ? 'error' : activity.severity === 'High' ? 'warning' : 'info'}
                    variant="soft"
                    size="sm"
                    className="scale-75 origin-left"
                  >
                    {activity.severity}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

CommunityActivityFeed.displayName = 'CommunityActivityFeed';
