import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Users, CalendarDays, Scale, ListChecks,
  Clock, AlertCircle, Landmark,
  Calendar, UserCheck
} from '../components/ui/Icons';
import { SEO } from '../components/SEO';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { PageHeader } from '../components/ui/PageHeader';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { SmartSummary, SmartInsight } from '../components/ui/SmartSummary';
import { EmptyState } from '../components/common/EmptyState';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { useGovernance } from '../hooks/useGovernance';

import { usePersistedState } from '../hooks/usePersistedState';
import { Committee, Meeting, Decision, ActionItem } from '../types/governance';

type GovernanceTab = 'comites' | 'reunions' | 'decisions' | 'actions';

// --- Helper Maps ---
const COMMITTEE_TYPE_LABELS: Record<Committee['type'], string> = {
  board: 'Conseil d\'administration',
  steering: 'Comite de pilotage',
  audit: 'Comite d\'audit',
  risk: 'Comite des risques',
  compliance: 'Comite de conformite',
  security: 'Comite de securite',
  custom: 'Personnalise',
};

const MEETING_STATUS_LABELS: Record<Meeting['status'], string> = {
  scheduled: 'Planifiee',
  'in-progress': 'En cours',
  completed: 'Terminee',
  cancelled: 'Annulee',
};

const MEETING_STATUS_COLORS: Record<Meeting['status'], string> = {
  scheduled: 'bg-primary/10 text-primary',
  'in-progress': 'bg-warning/10 text-warning',
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

const DECISION_STATUS_LABELS: Record<Decision['status'], string> = {
  proposed: 'Proposee',
  approved: 'Approuvee',
  rejected: 'Rejetee',
  deferred: 'Differee',
  superseded: 'Remplacee',
};

const DECISION_STATUS_COLORS: Record<Decision['status'], string> = {
  proposed: 'bg-primary/10 text-primary',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  deferred: 'bg-warning/10 text-warning',
  superseded: 'bg-muted text-muted-foreground',
};

const ACTION_PRIORITY_LABELS: Record<ActionItem['priority'], string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Eleve',
  critical: 'Critique',
};

const ACTION_PRIORITY_COLORS: Record<ActionItem['priority'], string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive',
};

const ACTION_STATUS_LABELS: Record<ActionItem['status'], string> = {
  open: 'Ouverte',
  'in-progress': 'En cours',
  completed: 'Terminee',
  overdue: 'En retard',
  cancelled: 'Annulee',
};

const ACTION_STATUS_COLORS: Record<ActionItem['status'], string> = {
  open: 'bg-primary/10 text-primary',
  'in-progress': 'bg-warning/10 text-warning',
  completed: 'bg-success/10 text-success',
  overdue: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const FREQUENCY_LABELS: Record<Committee['meetingFrequency'], string> = {
  weekly: 'Hebdomadaire',
  biweekly: 'Bi-mensuelle',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  annual: 'Annuelle',
  'ad-hoc': 'Ad hoc',
};

// --- Skeleton Components ---
const TableSkeleton: React.FC = () => (
  <div className="glass-premium rounded-2xl border border-border/40 overflow-hidden">
    <div className="p-4 space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={`skeleton-${i}`} className="h-14 rounded-xl bg-muted/20 animate-pulse" />
      ))}
    </div>
  </div>
);

// --- Main Component ---
export const Governance: React.FC = () => {
  const {
    committees, meetings, decisions, stats, loading
  } = useGovernance();

  const [activeTab, setActiveTab] = usePersistedState<GovernanceTab>('governance-active-tab', 'comites');
  const [filter, setFilter] = useState('');

  // Gather all action items from meetings and decisions
  const allActionItems = useMemo(() => {
    const fromMeetings = meetings.flatMap(m =>
      (m.actionItems || []).map(a => ({ ...a, sourceType: 'meeting' as const, sourceId: m.id }))
    );
    const fromDecisions = decisions.flatMap(d =>
      (d.actionItems || []).map(a => ({ ...a, sourceType: 'decision' as const, sourceId: d.id }))
    );
    return [...fromMeetings, ...fromDecisions];
  }, [meetings, decisions]);

  // Filtered data
  const filteredCommittees = useMemo(() => {
    if (!filter) return committees;
    const lc = filter.toLowerCase();
    return committees.filter(c =>
      c.name.toLowerCase().includes(lc) ||
      c.description?.toLowerCase().includes(lc) ||
      COMMITTEE_TYPE_LABELS[c.type]?.toLowerCase().includes(lc)
    );
  }, [committees, filter]);

  const filteredMeetings = useMemo(() => {
    if (!filter) return meetings;
    const lc = filter.toLowerCase();
    return meetings.filter(m =>
      m.title.toLowerCase().includes(lc) ||
      m.committeeName?.toLowerCase().includes(lc) ||
      m.location?.toLowerCase().includes(lc)
    );
  }, [meetings, filter]);

  const filteredDecisions = useMemo(() => {
    if (!filter) return decisions;
    const lc = filter.toLowerCase();
    return decisions.filter(d =>
      d.title.toLowerCase().includes(lc) ||
      d.description?.toLowerCase().includes(lc)
    );
  }, [decisions, filter]);

  const filteredActions = useMemo(() => {
    if (!filter) return allActionItems;
    const lc = filter.toLowerCase();
    return allActionItems.filter(a =>
      a.title.toLowerCase().includes(lc) ||
      a.assigneeName?.toLowerCase().includes(lc)
    );
  }, [allActionItems, filter]);

  // Smart Insights
  const insights = useMemo<SmartInsight[]>(() => {
    if (loading || !stats) return [];
    return [
      {
        label: 'Comites actifs',
        value: stats.totalCommittees,
        icon: <Building2 className="w-5 h-5" />,
        variant: 'primary',
      },
      {
        label: 'Reunions a venir',
        value: stats.upcomingMeetings,
        subValue: `${stats.totalMeetings} au total`,
        icon: <CalendarDays className="w-5 h-5" />,
        variant: 'secondary',
      },
      {
        label: 'Decisions en attente',
        value: stats.pendingDecisions,
        subValue: `${stats.approvedDecisions} approuvees`,
        icon: <Scale className="w-5 h-5" />,
        variant: stats.pendingDecisions > 0 ? 'warning' : 'success',
      },
      {
        label: 'Actions en retard',
        value: stats.overdueActionItems,
        subValue: `${stats.openActionItems} ouvertes`,
        icon: <AlertCircle className="w-5 h-5" />,
        variant: stats.overdueActionItems > 0 ? 'destructive' : 'success',
      },
    ];
  }, [loading, stats]);

  const tabs = useMemo(() => [
    { id: 'comites', label: 'Comites', icon: Building2, count: committees.length },
    { id: 'reunions', label: 'Reunions', icon: CalendarDays, count: meetings.length },
    { id: 'decisions', label: 'Decisions', icon: Scale, count: decisions.length },
    { id: 'actions', label: 'Actions', icon: ListChecks, count: allActionItems.length },
  ], [committees.length, meetings.length, decisions.length, allActionItems.length]);

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="visible"
      className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
    >
      <MasterpieceBackground />
      <SEO title="Gouvernance" description="Gestion des comites, reunions et decisions de gouvernance" />

      <PageHeader
        title="Gouvernance"
        subtitle="Pilotage des instances de gouvernance, reunions et decisions strategiques"
        icon={<Landmark className="text-primary" />}
      />

      <SmartSummary insights={insights} loading={loading} />

      <div className="mb-6">
        <ScrollableTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as GovernanceTab)}
          isChanging={loading}
        />
      </div>

      {/* Search Bar */}
      <motion.div variants={slideUpVariants} initial="initial" animate="visible">
        <div className="glass-premium rounded-2xl border border-border/40 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                aria-label="Rechercher"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/50 bg-background/50 text-foreground text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tab Content */}
      {activeTab === 'comites' && (
        <motion.div variants={slideUpVariants} initial="initial" animate="visible">
          {loading ? (
            <TableSkeleton />
          ) : filteredCommittees.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Aucun comite"
              description="Creez votre premier comite de gouvernance pour commencer a structurer vos instances decisionnelles."
              color="indigo"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCommittees.map((committee) => (
                <motion.div
                  key={committee.id}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="glass-premium rounded-2xl border border-border/40 p-5 group transition-all duration-300 hover:shadow-lg hover:border-primary/20"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground leading-tight">{committee.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{COMMITTEE_TYPE_LABELS[committee.type]}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      committee.status === 'active'
                        ? 'bg-success/10 text-success'
                        : committee.status === 'inactive'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {committee.status === 'active' ? 'Actif' : committee.status === 'inactive' ? 'Inactif' : 'Archive'}
                    </span>
                  </div>

                  {committee.description && (
                    <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-3 leading-relaxed">
                      {committee.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border/30">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>{committee.members?.length || 0} membres</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{FREQUENCY_LABELS[committee.meetingFrequency]}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'reunions' && (
        <motion.div variants={slideUpVariants} initial="initial" animate="visible">
          {loading ? (
            <TableSkeleton />
          ) : filteredMeetings.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Aucune reunion"
              description="Planifiez votre premiere reunion de comite pour assurer le suivi de vos instances de gouvernance."
              color="blue"
            />
          ) : (
            <div className="glass-premium rounded-2xl border border-border/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Reunion</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Comite</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Lieu</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Statut</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Participants</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredMeetings.map((meeting) => (
                      <tr
                        key={meeting.id}
                        className="hover:bg-muted/20 transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                              <CalendarDays className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">{meeting.title}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">{meeting.committeeName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-sm text-muted-foreground">{meeting.committeeName}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{meeting.date}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">{meeting.location || '-'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${MEETING_STATUS_COLORS[meeting.status]}`}>
                            {MEETING_STATUS_LABELS[meeting.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <span>{meeting.attendees?.length || 0}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'decisions' && (
        <motion.div variants={slideUpVariants} initial="initial" animate="visible">
          {loading ? (
            <TableSkeleton />
          ) : filteredDecisions.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="Aucune decision"
              description="Les decisions prises en comite apparaitront ici pour assurer la tracabilite et le suivi de leur mise en oeuvre."
              color="emerald"
            />
          ) : (
            <div className="glass-premium rounded-2xl border border-border/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Decision</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Statut</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Votes</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Date d'effet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredDecisions.map((decision) => (
                      <tr
                        key={decision.id}
                        className="hover:bg-muted/20 transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                              <Scale className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm">{decision.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{decision.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-sm text-muted-foreground capitalize">
                            {decision.type === 'approval' ? 'Approbation' :
                             decision.type === 'resolution' ? 'Resolution' :
                             decision.type === 'directive' ? 'Directive' :
                             'Recommandation'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${DECISION_STATUS_COLORS[decision.status]}`}>
                            {DECISION_STATUS_LABELS[decision.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-success font-medium">{decision.votesFor} pour</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-destructive font-medium">{decision.votesAgainst} contre</span>
                            {decision.abstentions > 0 && (
                              <>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-muted-foreground">{decision.abstentions} abst.</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground">{decision.effectiveDate || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'actions' && (
        <motion.div variants={slideUpVariants} initial="initial" animate="visible">
          {loading ? (
            <TableSkeleton />
          ) : filteredActions.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Aucune action"
              description="Les actions decidees en comite apparaitront ici pour un suivi rigoureux de leur avancement."
              color="amber"
            />
          ) : (
            <div className="glass-premium rounded-2xl border border-border/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Action</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Responsable</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Echeance</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Priorite</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredActions.map((action, idx) => {
                      const isOverdue = action.status !== 'completed' && action.status !== 'cancelled' && new Date(action.dueDate) < new Date();
                      return (
                        <tr
                          key={action.id || idx}
                          className="hover:bg-muted/20 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl transition-colors ${
                                isOverdue
                                  ? 'bg-destructive/5 text-destructive group-hover:bg-destructive/10'
                                  : 'bg-primary/5 text-primary group-hover:bg-primary/10'
                              }`}>
                                <ListChecks className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground text-sm">{action.title}</p>
                                {action.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{action.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{action.assigneeName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                              {action.dueDate}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_PRIORITY_COLORS[action.priority]}`}>
                              {ACTION_PRIORITY_LABELS[action.priority]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isOverdue && action.status !== 'completed' && action.status !== 'cancelled'
                                ? ACTION_STATUS_COLORS['overdue']
                                : ACTION_STATUS_COLORS[action.status]
                            }`}>
                              {isOverdue && action.status !== 'completed' && action.status !== 'cancelled'
                                ? ACTION_STATUS_LABELS['overdue']
                                : ACTION_STATUS_LABELS[action.status]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};
