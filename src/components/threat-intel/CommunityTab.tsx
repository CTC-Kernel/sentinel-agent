import React from 'react';
import { Globe, Shield, Users, Activity, AlertTriangle, Share2, TrendingUp, ThumbsUp } from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/EmptyState';
import { CommunityActivityFeed } from './CommunityActivityFeed';
import { CommunityLeaderboard } from './CommunityLeaderboard';
import { SourceBadge } from './SourceBadge';
import { useStore } from '@/store';
import type { Threat } from '@/types/risks';
import type { CommunityActivity } from '@/types/business';

interface CommunityStats {
  totalThreats: number;
  criticalCount: number;
  threatsLast24h: number;
  activeContributors: number;
  verificationRate: number;
  averageVotes: number;
  myContributions: {
    total: number;
    verified: number;
    votesReceived: number;
    rank: number;
  };
  trendingThreats: Threat[];
  recentActivity: CommunityActivity[];
  topContributors: { name: string; count: number; verified: number; rank: number }[];
}

interface CommunityTabProps {
  stats: CommunityStats;
  currentUserName?: string;
  onHunterClick: (hunter: { name: string; count: number; rank: number }) => void;
  onThreatClick?: (threatId: string) => void;
  /* validate */ onSubmitThreat: () => void;
}

export const CommunityTab: React.FC<CommunityTabProps> = React.memo(({
  stats,
  currentUserName,
  onHunterClick,
  onThreatClick,
  onSubmitThreat,
}) => {
  const { t } = useStore();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Stats Hero Card */}
      <div className="bg-gradient-to-br from-primary to-violet-900 rounded-3xl p-8 text-white relative overflow-hidden ring-1 ring-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Globe className="h-48 w-48" />
        </div>

        <div className="relative z-decorator">
          <Badge status="success" className="mb-4">
            {t('threatIntel.community.verifiedCommunity', { defaultValue: 'Communauté Vérifiée' })}
          </Badge>
          <h3 className="text-2xl font-black mb-2 tracking-tight">Sentinel Force</h3>
          <p className="text-white/70 text-sm mb-6 max-w-sm leading-relaxed">
            {t('threats.communityDescription', { defaultValue: 'Rejoignez' })}{' '}
            <span className="text-white font-bold">{stats.activeContributors} {t('threats.experts', { defaultValue: 'experts' })}</span>{' '}
            {t('threats.communityDescriptionEnd', { defaultValue: 'pour la cyberdéfense proactive.' })}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Shield} label={t('threats.totalThreats', { defaultValue: 'Menaces' })} value={stats.totalThreats} />
            <StatCard icon={AlertTriangle} label="Critical" value={stats.criticalCount} highlight />
            <StatCard icon={TrendingUp} label={t('threats.verificationRate', { defaultValue: 'Vérification' })} value={`${stats.verificationRate}%`} />
            <StatCard icon={Activity} label={t('threats.last24h', { defaultValue: 'Dernières 24h' })} value={stats.threatsLast24h} />
          </div>
        </div>
      </div>

      {/* My Contributions */}
      <div className="bg-card/50 rounded-3xl border border-border dark:border-white/5 p-8 backdrop-blur-xl shadow-xl">
        <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {t('threatIntel.community.myContributions', { defaultValue: 'Mes contributions' })}
        </h3>

        {stats.myContributions.total > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-foreground">{stats.myContributions.total}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('threats.threatsReported', { defaultValue: 'Signalements' })}</div>
              </div>
              <div className="bg-muted/50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-success-text">{stats.myContributions.verified}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('common.verified', { defaultValue: 'Vérifiées' })}</div>
              </div>
              <div className="bg-muted/50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-primary">{stats.myContributions.votesReceived}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('threats.votesReceived', { defaultValue: 'Votes reçus' })}</div>
              </div>
              <div className="bg-muted/50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-warning-text">#{stats.myContributions.rank || '—'}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('threats.ranking', { defaultValue: 'Classement' })}</div>
              </div>
            </div>
            <Button
              onClick={onSubmitThreat}
              className="w-full bg-primary hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/50 text-primary-foreground rounded-xl shadow-lg shadow-primary/20"
            >
              <Share2 className="h-4 w-4 mr-2" />
              {t('threats.shareThreat', { defaultValue: 'Partager une menace' })}
            </Button>
          </div>
        ) : (
          <EmptyState
            icon={Share2}
            title={t('threatIntel.community.noContributions', { defaultValue: 'Pas encore de contributions' })}
            description={t('threatIntel.community.startContributing', { defaultValue: 'Partagez votre première menace pour rejoindre la communauté.' })}
            actionLabel={t('threats.shareThreat', { defaultValue: 'Partager une menace' })}
            onAction={onSubmitThreat}
          />
        )}
      </div>

      {/* Activity Feed */}
      <div className="bg-card/50 rounded-3xl border border-border dark:border-white/5 p-6 backdrop-blur-xl shadow-xl">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          {t('threatIntel.community.recentActivity', { defaultValue: 'Activité récente' })}
        </h3>
        <CommunityActivityFeed
          activities={stats.recentActivity}
          onActivityClick={onThreatClick}
        />
      </div>

      {/* Leaderboard */}
      <div className="bg-card/50 rounded-3xl border border-border dark:border-white/5 p-6 backdrop-blur-xl shadow-xl">
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Top Hunters
        </h3>
        <CommunityLeaderboard
          contributors={stats.topContributors}
          currentUserName={currentUserName}
          onHunterClick={onHunterClick}
        />
      </div>

      {/* Trending Threats */}
      {stats.trendingThreats.length > 0 && (
        <div className="lg:col-span-2 bg-card/50 rounded-3xl border border-border dark:border-white/5 p-6 backdrop-blur-xl shadow-xl">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t('threatIntel.community.trending', { defaultValue: 'Tendances (48h)' })}
          </h3>
          <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
            {stats.trendingThreats.map((threat) => (
              <div
                key={threat.id}
                role="button"
                tabIndex={0}
                onClick={() => onThreatClick?.(threat.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onThreatClick?.(threat.id);
                  }
                }}
                className="min-w-[280px] bg-muted/50 rounded-2xl p-4 border border-border/40 hover:border-primary/30 transition-all cursor-pointer shrink-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    status={threat.severity === 'Critical' ? 'error' : threat.severity === 'High' ? 'warning' : 'info'}
                    variant="soft"
                    size="sm"
                  >
                    {threat.severity}
                  </Badge>
                  <SourceBadge source={threat.source} />
                </div>
                <h4 className="font-semibold text-sm text-foreground truncate mb-1">{threat.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{threat.description || threat.type}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {threat.votes}</span>
                  <span>{threat.country}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

CommunityTab.displayName = 'CommunityTab';

// Internal presentational component
const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string | number;
  highlight?: boolean;
}> = ({ icon: Icon, label, value, highlight }) => (
  <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/10 hover:bg-white/15 transition-colors">
    <div className="flex items-center gap-2 mb-1.5">
      <Icon className={`h-4 w-4 ${highlight ? 'text-error-bg' : 'text-white/70'}`} />
      <div className="text-xs uppercase tracking-wider opacity-70">{label}</div>
    </div>
    <div className={`text-2xl font-black tracking-tight ${highlight ? 'text-error-bg' : ''}`}>{value}</div>
  </div>
);
