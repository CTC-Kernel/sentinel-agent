import { useMemo } from 'react';
import type { Threat } from '@/types/risks';
import type { CommunityActivity } from '@/types/business';
import type { UserProfile } from '@/types/users';

interface MyContributions {
  total: number;
  verified: number;
  votesReceived: number;
  rank: number;
}

interface CommunityStats {
  totalThreats: number;
  criticalCount: number;
  threatsLast24h: number;
  activeContributors: number;
  verificationRate: number;
  averageVotes: number;
  myContributions: MyContributions;
  trendingThreats: Threat[];
  recentActivity: CommunityActivity[];
  topContributors: { name: string; count: number; verified: number; rank: number }[];
}

const AUTOMATED_AUTHORS = new Set(['URLhaus', 'CISA KEV', 'CISA', 'Automated']);

export function useCommunityStats(threats: Threat[], user: UserProfile | null): CommunityStats {
  return useMemo(() => {
    const now = Date.now();
    const ONE_DAY = 86_400_000;
    const TWO_DAYS = 2 * ONE_DAY;
    const THIRTY_DAYS = 30 * ONE_DAY;

    const totalThreats = threats.length;
    const criticalCount = threats.filter(t => t.severity === 'Critical').length;

    const threatsLast24h = threats.filter(t => {
      const ts = t.timestamp || new Date(t.date).getTime();
      return (now - ts) < ONE_DAY;
    }).length;

    // Active contributors: unique authors in last 30 days (excluding automated)
    const recentAuthors = new Set<string>();
    const authorCounts: Record<string, { count: number; verified: number; votes: number }> = {};

    for (const t of threats) {
      const author = t.author || 'Unknown';
      if (AUTOMATED_AUTHORS.has(author)) continue;

      if (!authorCounts[author]) {
        authorCounts[author] = { count: 0, verified: 0, votes: 0 };
      }
      authorCounts[author].count++;
      if (t.verified) authorCounts[author].verified++;
      authorCounts[author].votes += t.votes || 0;

      const ts = t.timestamp || new Date(t.date).getTime();
      if ((now - ts) < THIRTY_DAYS) {
        recentAuthors.add(author);
      }
    }

    const activeContributors = recentAuthors.size;

    const verifiedCount = threats.filter(t => t.verified).length;
    const verificationRate = totalThreats > 0 ? Math.round((verifiedCount / totalThreats) * 100) : 0;

    const totalVotes = threats.reduce((sum, t) => sum + (t.votes || 0), 0);
    const averageVotes = totalThreats > 0 ? Math.round((totalVotes / totalThreats) * 10) / 10 : 0;

    // My contributions
    const myName = user?.displayName || '';
    const myData = myName ? authorCounts[myName] : undefined;
    const sortedAuthors = Object.entries(authorCounts)
      .sort(([, a], [, b]) => b.count - a.count);
    const myRank = myName ? sortedAuthors.findIndex(([name]) => name === myName) + 1 : 0;

    const myContributions: MyContributions = {
      total: myData?.count || 0,
      verified: myData?.verified || 0,
      votesReceived: myData?.votes || 0,
      rank: myRank || 0,
    };

    // Top contributors (top 50)
    const topContributors = sortedAuthors.slice(0, 50).map(([name, data], i) => ({
      name,
      count: data.count,
      verified: data.verified,
      rank: i + 1,
    }));

    // Trending threats: top 5 by votes in last 48h
    const trendingThreats = threats
      .filter(t => {
        const ts = t.timestamp || new Date(t.date).getTime();
        return (now - ts) < TWO_DAYS;
      })
      .sort((a, b) => (b.votes || 0) - (a.votes || 0))
      .slice(0, 5);

    // Recent activity: derive from threats (latest 20)
    const recentActivity: CommunityActivity[] = [...threats]
      .sort((a, b) => {
        const tsA = a.timestamp || new Date(a.date).getTime();
        const tsB = b.timestamp || new Date(b.date).getTime();
        return tsB - tsA;
      })
      .slice(0, 20)
      .map(t => {
        let type: CommunityActivity['type'] = 'threat_reported';
        if (t.verified) type = 'threat_verified';
        else if ((t.votes || 0) > 3) type = 'sighting_confirmed';

        return {
          id: `activity-${t.id}`,
          type,
          threatId: t.id,
          threatTitle: t.title,
          actorName: t.author || 'Unknown',
          timestamp: t.timestamp || new Date(t.date).getTime(),
          severity: t.severity,
          source: t.source,
        };
      });

    return {
      totalThreats,
      criticalCount,
      threatsLast24h,
      activeContributors,
      verificationRate,
      averageVotes,
      myContributions,
      trendingThreats,
      recentActivity,
      topContributors,
    };
  }, [threats, user]);
}
