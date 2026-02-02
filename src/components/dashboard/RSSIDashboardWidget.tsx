/**
 * RSSIDashboardWidget Component
 * Assembly of RSSI-specific dashboard widgets
 * Implements Story 2.4: RSSI Risk & Incident View (AC: 1, 2, 3, 4)
 * Per ADR-004: Dashboard Configurable par Role
 */

import { cn } from '../../lib/utils';
import type { UserWithRole } from '../../utils/roleUtils';
import { canViewRSSIDashboard } from './utils';
import { RSSICriticalRisksWidget } from './RSSICriticalRisksWidget';
import { RSSIIncidentsWidget } from './RSSIIncidentsWidget';
import { RSSIActionsWidget } from './RSSIActionsWidget';
import { AlertCircle } from '../ui/Icons';

/**
 * Props for RSSIDashboardWidget
 */
export interface RSSIDashboardWidgetProps {
  /** Organization/tenant ID */
  organizationId: string;
  /** Current user for role checking and action filtering */
  user?: UserWithRole | null;
  /** Widget size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Handler when clicking a risk item */
  onRiskClick?: (riskId: string) => void;
  /** Handler when clicking an incident item */
  onIncidentClick?: (incidentId: string) => void;
  /** Handler when clicking an action item */
  onActionClick?: (actionId: string) => void;
  /** Handler when clicking "Voir tous les risques" */
  onViewAllRisksClick?: () => void;
  /** Handler when clicking "Voir tous les incidents" */
  onViewAllIncidentsClick?: () => void;
  /** Handler when clicking "Voir toutes les actions" */
  onViewAllActionsClick?: () => void;
  /** Whether to skip role check (for admin override) */
  skipRoleCheck?: boolean;
}

/**
 * Not Authorized State
 */
function NotAuthorizedState() {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <AlertCircle className="w-8 h-8 mb-2 text-warning" aria-hidden="true" />
        <p className="text-sm font-medium">Accès non autorisé</p>
        <p className="text-xs mt-1">
          Cette vue est réservée aux responsables sécurité (RSSI)
        </p>
      </div>
    </div>
  );
}

/**
 * RSSIDashboardWidget - Complete RSSI dashboard assembly
 *
 * Per ADR-004 Widget Defaults for RSSI:
 * - risks-critical: Critical risks with criticality sorting
 * - incidents-recent: Active incidents
 * - actions-overdue: Assigned actions with deadline highlighting
 *
 * @example
 * ```tsx
 * <RSSIDashboardWidget
 *   organizationId="org-123"
 *   user={currentUser}
 *   onRiskClick={(id) => navigate(`/risks/${id}`)}
 *   onIncidentClick={(id) => navigate(`/incidents/${id}`)}
 *   onActionClick={(id) => navigate(`/actions/${id}`)}
 * />
 * ```
 */
export function RSSIDashboardWidget({
  organizationId,
  user,
  size = 'md',
  className,
  onRiskClick,
  onIncidentClick,
  onActionClick,
  onViewAllRisksClick,
  onViewAllIncidentsClick,
  onViewAllActionsClick,
  skipRoleCheck = false,
}: RSSIDashboardWidgetProps) {
  // Role check
  if (!skipRoleCheck && !canViewRSSIDashboard(user)) {
    return <NotAuthorizedState />;
  }

  return (
    <div
      className={cn('w-full', className)}
      role="region"
      aria-label="Tableau de bord RSSI"
    >
      {/* Dashboard Title */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          Vue Sécurité (RSSI)
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Risques critiques, incidents actifs et actions en cours
        </p>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Critical Risks Widget */}
        <RSSICriticalRisksWidget
          organizationId={organizationId}
          size={size}
          onRiskClick={onRiskClick}
          onViewAllClick={onViewAllRisksClick}
          maxItems={5}
        />

        {/* Active Incidents Widget */}
        <RSSIIncidentsWidget
          organizationId={organizationId}
          size={size}
          onIncidentClick={onIncidentClick}
          onViewAllClick={onViewAllIncidentsClick}
          maxItems={5}
        />

        {/* Assigned Actions Widget */}
        <RSSIActionsWidget
          organizationId={organizationId}
          userId={user?.id}
          size={size}
          onActionClick={onActionClick}
          onViewAllClick={onViewAllActionsClick}
          maxItems={5}
        />
      </div>
    </div>
  );
}

export default RSSIDashboardWidget;
