/**
 * ConfigurableDashboard Component
 * Main integration component for role-based configurable dashboard
 *
 * Story 2-6: Configurable Dashboard Widgets
 * Implements Task 5: Main dashboard integration (AC: 1, 2, 3, 4, 5)
 */

import { useState, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useDashboardPreferences, type WidgetLayout } from '../../hooks/useDashboardPreferences';
import { getDefaultLayoutForRole, getDashboardRole } from '../../config/dashboardDefaults';
import { ConfigurableDashboardGrid } from './configurable/ConfigurableDashboardGrid';
import { AddWidgetModal } from './configurable/AddWidgetModal';
import { DashboardEditModeToggle } from './DashboardEditModeToggle';
import { EmptyState } from '../ui/EmptyState';
import { WIDGET_REGISTRY, type WidgetId } from './configurable/WidgetRegistry';
import { useTranslation } from 'react-i18next';
import { Plus } from '../ui/Icons';
import type { UserRole } from '../../utils/roleUtils';

export interface ConfigurableDashboardProps {
  /** Additional CSS classes */
  className?: string;
  /** Props to pass to widget components (stats, organization data, etc.) */
  widgetProps?: Record<string, unknown>;
  /** Override default role detection */
  roleOverride?: UserRole;
}

/**
 * ConfigurableDashboard - Full dashboard with edit mode and widget management
 *
 * @example
 * ```tsx
 * <ConfigurableDashboard
 *   widgetProps={{
 *     organizationId: user.organizationId,
 *     userId: user.uid,
 *   }}
 * />
 * ```
 */
export function ConfigurableDashboard({
  className,
  widgetProps = {},
  roleOverride,
}: ConfigurableDashboardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showAddWidgetModal, setShowAddWidgetModal] = useState(false);

  // Determine user role for default layout
  const userRole = useMemo(() => {
    if (roleOverride) return roleOverride;
    if (!user?.role) return 'user';
    return getDashboardRole(user.role);
  }, [roleOverride, user]);

  // Get default layout for the role
  const roleDefaultLayout = useMemo(() => {
    return getDefaultLayoutForRole(userRole);
  }, [userRole]);

  // Dashboard preferences with Firestore persistence
  const {
    layout,
    updateLayout,
    resetLayout,
    hasLoaded,
    isCustomized,
    isSyncing,
  } = useDashboardPreferences(
    user?.uid,
    user?.organizationId,
    userRole,
    roleDefaultLayout
  );

  // Get list of widget IDs currently in the layout
  const currentWidgetIds = useMemo(() => {
    return layout.map((w) => w.widgetId);
  }, [layout]);

  // Handle adding a widget
  const handleAddWidget = useCallback(
    (widgetId: WidgetId) => {
      const widgetConfig = WIDGET_REGISTRY[widgetId];
      if (!widgetConfig) return;

      const newWidget: WidgetLayout = {
        id: `${widgetId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        widgetId,
        colSpan: widgetConfig.defaultColSpan,
      };

      updateLayout([...layout, newWidget]);
    },
    [layout, updateLayout]
  );

  // Handle layout reordering/changes from the grid
  const handleLayoutChange = useCallback(
    (newLayout: WidgetLayout[]) => {
      updateLayout(newLayout);
    },
    [updateLayout]
  );

  // Handle reset to defaults
  const handleReset = useCallback(() => {
    resetLayout();
  }, [resetLayout]);

  // Merge default widgetProps with user context
  const mergedWidgetProps = useMemo(() => {
    return {
      organizationId: user?.organizationId,
      userId: user?.uid,
      ...widgetProps,
    };
  }, [user?.organizationId, user?.uid, widgetProps]);

  // Loading state
  if (!hasLoaded) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="h-10 w-48 bg-muted rounded mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i || 'unknown'}
              className="h-48 bg-muted rounded-2xl"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with edit controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex-1" />

        <div className="flex items-center gap-3">
          {/* Add widget button - only in edit mode */}
          {isEditing && (
            <button
              type="button"
              onClick={() => setShowAddWidgetModal(true)}
              className={cn(
                'group inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shadow-sm transition-all duration-200',
                'text-white bg-slate-900 hover:bg-slate-800 hover:scale-[1.02] active:scale-95',
                'dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2'
              )}
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" strokeWidth={2.5} />
              {t('dashboard.addWidget')}
            </button>
          )}

          {/* Edit mode toggle */}
          <DashboardEditModeToggle
            isEditing={isEditing}
            onEditModeChange={setIsEditing}
            onReset={handleReset}
            isCustomized={isCustomized}
            isSyncing={isSyncing}
          />
        </div>
      </div>

      {/* Dashboard grid */}
      <ConfigurableDashboardGrid
        layout={layout}
        onLayoutChange={handleLayoutChange}
        isEditing={isEditing}
        widgetProps={mergedWidgetProps}
      />

      {/* Empty state */}
      {layout.length === 0 && (
        <EmptyState
          icon={Plus}
          title={t('dashboard.addWidget')}
          description={t('dashboard.customizeDashboard')}
          actionLabel={t('dashboard.addWidget')}
          onAction={() => {
            setIsEditing(true);
            setShowAddWidgetModal(true);
          }}
          className="py-16"
        />
      )}

      {/* Add widget modal */}
      <AddWidgetModal
        isOpen={showAddWidgetModal}
        onClose={() => setShowAddWidgetModal(false)}
        onAdd={handleAddWidget}
        currentWidgetIds={currentWidgetIds}
      />
    </div>
  );
}

export default ConfigurableDashboard;
