import React, { useState } from 'react';
import { Shield, ChevronRight, ChevronDown, ChevronUp } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { useStore } from '@/store';

interface Contributor {
  name: string;
  count: number;
  verified: number;
  rank: number;
}

interface CommunityLeaderboardProps {
  contributors: Contributor[];
  currentUserName?: string;
  onHunterClick: (hunter: { name: string; count: number; rank: number }) => void;
}

const podiumGradients = [
  'bg-gradient-to-br from-warning-text to-warning-text/80', // Gold
  'bg-gradient-to-br from-muted-foreground/50 to-muted-foreground/30', // Silver
  'bg-gradient-to-br from-warning-text/70 to-warning-text/50', // Bronze
];

export const CommunityLeaderboard: React.FC<CommunityLeaderboardProps> = React.memo(({
  contributors,
  currentUserName,
  onHunterClick,
}) => {
  const { t } = useStore();
  const [showAll, setShowAll] = useState(false);

  const displayedContributors = showAll ? contributors : contributors.slice(0, 10);

  if (contributors.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {t('threatIntel.community.noContributors', { defaultValue: 'Aucun contributeur pour le moment' })}
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {displayedContributors.map((c, i) => {
          const isCurrentUser = currentUserName === c.name;
          const isPodium = i < 3;

          return (
            <div
              key={c.name}
              role="button"
              tabIndex={0}
              className={`flex items-center justify-between group p-3 rounded-2xl transition-all cursor-pointer
                ${isCurrentUser ? 'ring-1 ring-primary/30 bg-primary/5' : 'hover:bg-muted/50 dark:hover:bg-muted/50'}`}
              onClick={() => onHunterClick(c)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onHunterClick(c);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm text-sm transition-transform group-hover:scale-105 ${isPodium ? podiumGradients[i] : 'bg-primary/80'}`}>
                  {isPodium ? i + 1 : c.name.charAt(0).toUpperCase()}
                  {isPodium && (
                    <div className="absolute -top-1 -right-1 bg-card rounded-full p-0.5">
                      <Shield className={`h-2.5 w-2.5 ${i === 0 ? 'text-warning-text' : i === 1 ? 'text-muted-foreground' : 'text-warning-text/80'}`} />
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                    {c.name}
                    {i === 0 && <Badge status="warning" className="scale-75 origin-left">MVP</Badge>}
                    {isCurrentUser && <Badge status="brand" variant="outline" className="scale-75 origin-left">{t('common.you', { defaultValue: 'Vous' })}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.count} {t('threats.threatsReported', { defaultValue: 'signalements' })}
                    {c.verified > 0 && (
                      <span className="text-success-text ml-2">· {c.verified} {t('common.verified', { defaultValue: 'vérifiées' })}</span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity" />
            </div>
          );
        })}
      </div>

      {contributors.length > 10 && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-bold text-primary hover:text-primary/70 h-auto p-0 hover:bg-transparent gap-1"
          >
            {showAll ? (
              <><ChevronUp className="h-3.5 w-3.5" /> {t('common.showLess', { defaultValue: 'Voir moins' })}</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" /> {t('common.viewAll', { defaultValue: 'Voir tout' })} ({contributors.length})</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
});

CommunityLeaderboard.displayName = 'CommunityLeaderboard';
