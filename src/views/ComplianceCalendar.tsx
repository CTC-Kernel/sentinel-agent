import React, { useState, useMemo } from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle2, Filter, BarChart3 } from 'lucide-react';
import { useComplianceCalendar } from '../hooks/useComplianceCalendar';
import { PageHeader } from '../components/ui/PageHeader';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import type { ComplianceEvent, ComplianceDeadline } from '../types/complianceCalendar';

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-info-bg text-info-text',
  'in-progress': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'A venir',
  'in-progress': 'En cours',
  completed: 'Termine',
  overdue: 'En retard',
  cancelled: 'Annule',
};

const CATEGORY_LABELS: Record<string, string> = {
  compliance: 'Conformite',
  audit: 'Audit',
  certification: 'Certification',
  risk: 'Risque',
  training: 'Formation',
  governance: 'Gouvernance',
};

const tabs = [
  { id: 'overview', label: 'Vue d\'ensemble' },
  { id: 'events', label: 'Evenements' },
  { id: 'deadlines', label: 'Echeances' },
];

export function ComplianceCalendar() {
  const { events, deadlines, loading, stats } = useComplianceCalendar();
  const [activeTab, setActiveTab] = useState('overview');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (filterStatus && e.status !== filterStatus) return false;
      if (filterCategory && e.category !== filterCategory) return false;
      return true;
    });
  }, [events, filterStatus, filterCategory]);

  const upcomingEvents = useMemo(() => {
    const now = new Date().toISOString();
    return events
      .filter(e => e.date >= now && e.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [events]);

  const overdueEvents = useMemo(() => {
    const now = new Date().toISOString();
    return events.filter(
      e => e.date < now && (e.status === 'upcoming' || e.status === 'in-progress')
    );
  }, [events]);

  const pendingDeadlines = useMemo(() => {
    return deadlines
      .filter(d => d.status === 'pending')
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
  }, [deadlines]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 lg:space-y-10 pb-24">
      <PageHeader
        title="Calendrier de Conformite"
        subtitle="Suivi des echeances reglementaires, audits et evenements de conformite"
        icon={<Calendar className="h-6 w-6" />}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Evenements ce mois" value={stats.eventsThisMonth} icon={Calendar} />
        <StatCard label="En retard" value={stats.overdueCount} icon={AlertTriangle} variant={stats.overdueCount > 0 ? 'danger' : 'default'} />
        <StatCard label="Echeances critiques" value={stats.criticalDeadlines} icon={Clock} variant={stats.criticalDeadlines > 0 ? 'warning' : 'default'} />
        <StatCard label="Taux conformite" value={`${stats.complianceRate}%`} icon={CheckCircle2} variant={stats.complianceRate >= 80 ? 'success' : 'warning'} />
        <StatCard label="Total echeances" value={stats.totalDeadlines} icon={BarChart3} />
      </div>

      <ScrollableTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Events */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Prochains evenements
            </h3>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucun evenement a venir</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>

          {/* Overdue + Critical */}
          <div className="space-y-6">
            {overdueEvents.length > 0 && (
              <div className="glass-panel rounded-2xl p-6 border-l-4 border-red-500">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  En retard ({overdueEvents.length})
                </h3>
                <div className="space-y-3">
                  {overdueEvents.slice(0, 5).map(event => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </div>
            )}

            <div className="glass-panel rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Echeances en attente ({pendingDeadlines.length})
              </h3>
              {pendingDeadlines.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucune echeance en attente</p>
              ) : (
                <div className="space-y-3">
                  {pendingDeadlines.slice(0, 5).map(deadline => (
                    <DeadlineCard key={deadline.id} deadline={deadline} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterStatus || ''}
              onChange={e => setFilterStatus(e.target.value || null)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={filterCategory || ''}
              onChange={e => setFilterCategory(e.target.value || null)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm"
            >
              <option value="">Toutes les categories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucun evenement trouve</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map(event => (
                <EventCard key={event.id} event={event} showDetails />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'deadlines' && (
        <div className="glass-panel rounded-2xl p-6">
          {deadlines.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune echeance enregistree</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deadlines.map(deadline => (
                <DeadlineCard key={deadline.id} deadline={deadline} showDetails />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, variant = 'default' }: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colors = {
    default: 'text-gray-900 dark:text-white',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-orange-600 dark:text-orange-400',
    danger: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colors[variant]}`}>{value}</p>
    </div>
  );
}

function EventCard({ event, showDetails = false }: { event: ComplianceEvent; showDetails?: boolean }) {
  const date = new Date(event.date);

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors">
      <div className="flex-shrink-0 w-12 text-center">
        <div className="text-xs text-gray-500">{date.toLocaleDateString('fr-FR', { month: 'short' })}</div>
        <div className="text-lg font-bold">{date.getDate()}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{event.title}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${STATUS_COLORS[event.status] || ''}`}>
            {STATUS_LABELS[event.status] || event.status}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${PRIORITY_COLORS[event.priority] || ''}`}>
            {event.priority}
          </span>
        </div>
        {showDetails && event.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{event.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          {event.framework && <span>{event.framework}</span>}
          <span>{CATEGORY_LABELS[event.category] || event.category}</span>
          {event.assigneeName && <span>{event.assigneeName}</span>}
        </div>
      </div>
    </div>
  );
}

function DeadlineCard({ deadline, showDetails = false }: { deadline: ComplianceDeadline; showDetails?: boolean }) {
  const date = new Date(deadline.deadline);
  const now = new Date();
  const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntil < 0 && deadline.status === 'pending';
  const isUrgent = daysUntil >= 0 && daysUntil <= 30 && deadline.status === 'pending';

  const deadlineStatusColors: Record<string, string> = {
    pending: isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : isUrgent ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-info-bg text-info-text',
    met: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    missed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    extended: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl bg-white/50 dark:bg-gray-800/50 ${isOverdue ? 'border-l-3 border-red-500' : ''}`}>
      <div className="flex-shrink-0 w-12 text-center">
        <div className="text-xs text-gray-500">{date.toLocaleDateString('fr-FR', { month: 'short' })}</div>
        <div className="text-lg font-bold">{date.getDate()}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{deadline.title}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${deadlineStatusColors[deadline.status] || ''}`}>
            {isOverdue ? `En retard (${Math.abs(daysUntil)}j)` : deadline.status === 'pending' ? `${daysUntil}j restants` : deadline.status}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          <span>{deadline.framework}</span>
          {deadline.article && <span>Art. {deadline.article}</span>}
          {deadline.assigneeName && <span>{deadline.assigneeName}</span>}
        </div>
        {showDetails && deadline.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{deadline.description}</p>
        )}
        {showDetails && deadline.penalty && (
          <p className="text-xs text-red-500 mt-1">Penalite: {deadline.penalty}</p>
        )}
      </div>
    </div>
  );
}

export default ComplianceCalendar;
