/**
 * PMDashboardWidget Component
 * Assembly of Project Manager-specific dashboard widgets
 * Implements Story 2.5: Project Manager Progress View (AC: 1, 2, 3, 4, 5)
 * Per ADR-004: Dashboard Configurable par Role
 * Per FR10: "Les project managers peuvent voir l'avancement du projet de conformite"
 */

import { cn } from '../../lib/utils';
import type { UserWithRole } from '../../utils/roleUtils';
import { canViewPMDashboard } from './utils';
import { PMProgressWidget } from './PMProgressWidget';
import { PMTimelineWidget } from './PMTimelineWidget';
import { PMActionsOverdueWidget } from './PMActionsOverdueWidget';
import { AlertCircle } from 'lucide-react';

/**
 * Props for PMDashboardWidget
 */
export interface PMDashboardWidgetProps {
  /** Organization/tenant ID */
  organizationId: string;
  /** Current user for role checking */
  user?: UserWithRole | null;
  /** Widget size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Handler when clicking a category in progress widget */
  onCategoryClick?: (category: string) => void;
  /** Handler when clicking a timeline item */
  onTimelineItemClick?: (itemId: string) => void;
  /** Handler when clicking an overdue action */
  onActionClick?: (actionId: string) => void;
  /** Handler when clicking "Voir toutes les echeances" */
  onViewAllDeadlinesClick?: () => void;
  /** Handler when clicking "Voir toutes les actions en retard" */
  onViewAllOverdueClick?: () => void;
  /** Days ahead to show in timeline (default: 30) */
  daysAhead?: number;
  /** Whether to skip role check (for admin override) */
  skipRoleCheck?: boolean;
}

/**
 * Not Authorized State
 */
function NotAuthorizedState() {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <AlertCircle className="w-8 h-8 mb-2 text-orange-500" aria-hidden="true" />
        <p className="text-sm font-medium">Acces non autorise</p>
        <p className="text-xs mt-1">
          Cette vue est reservee aux chefs de projet
        </p>
      </div>
    </div>
  );
}

/**
 * PMDashboardWidget - Complete Project Manager dashboard assembly
 *
 * Per ADR-004 Widget Defaults for PM:
 * - progress-global: Overall project completion percentage
 * - timeline-next: Upcoming deadlines with date highlighting
 * - actions-overdue: Overdue actions requiring attention
 *
 * @example
 * ```tsx
 * <PMDashboardWidget
 *   organizationId="org-123"
 *   user={currentUser}
 *   onCategoryClick={(cat) => navigate(`/${cat}`)}
 *   onTimelineItemClick={(id) => navigate(`/actions/${id}`)}
 *   onActionClick={(id) => navigate(`/actions/${id}`)}
 * />
 * ```
 */
export function PMDashboardWidget({
  organizationId,
  user,
  size = 'md',
  className,
  onCategoryClick,
  onTimelineItemClick,
  onActionClick,
  onViewAllDeadlinesClick,
  onViewAllOverdueClick,
  daysAhead = 30,
  skipRoleCheck = false,
}: PMDashboardWidgetProps) {
  // Role check
  if (!skipRoleCheck && !canViewPMDashboard(user)) {
    return <NotAuthorizedState />;
  }

  return (
    <div
      className={cn('w-full', className)}
      role="region"
      aria-label="Tableau de bord Chef de Projet"
    >
      {/* Dashboard Title */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Vue Chef de Projet
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Progression du projet, echeances et actions en retard
        </p>
      </div>

      {/* Widget Grid - Progress spans full width on mobile, 2 cols on md+ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Progress Widget - Featured, spans 2 columns on large screens */}
        <div className="lg:col-span-2">
          <PMProgressWidget
            organizationId={organizationId}
            size={size}
            onCategoryClick={onCategoryClick}
          />
        </div>

        {/* Actions Overdue Widget - Important attention area */}
        <PMActionsOverdueWidget
          organizationId={organizationId}
          size={size}
          onActionClick={onActionClick}
          onViewAllClick={onViewAllOverdueClick}
          maxItems={5}
        />

        {/* Timeline Widget - Spans full width for better timeline visibility */}
        <div className="lg:col-span-3">
          <PMTimelineWidget
            organizationId={organizationId}
            size={size}
            onItemClick={onTimelineItemClick}
            onViewAllClick={onViewAllDeadlinesClick}
            daysAhead={daysAhead}
            maxItems={6}
          />
        </div>
      </div>
    </div>
  );
}

export default PMDashboardWidget;
