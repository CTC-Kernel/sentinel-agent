/**
 * Tests for dashboardDefaults.ts
 * Story 2-6: Configurable Dashboard Widgets
 * Task 7.2: Test dashboardDefaults returns correct layouts per role
 */

import { describe, it, expect } from 'vitest';
import {
  getDefaultLayoutForRole,
  getDashboardRole,
  getWidgetCategory,
  WIDGET_CATEGORIES,
  ROLE_DEFAULT_LAYOUTS,
  DIRECTION_DEFAULT_LAYOUT,
  RSSI_DEFAULT_LAYOUT,
  PROJECT_MANAGER_DEFAULT_LAYOUT,
  AUDITOR_DEFAULT_LAYOUT,
  ADMIN_DEFAULT_LAYOUT,
  USER_DEFAULT_LAYOUT,
} from '../dashboardDefaults';
import type { UserRole } from '../../utils/roleUtils';

describe('dashboardDefaults', () => {
  describe('getDefaultLayoutForRole', () => {
    it('should return direction layout for direction role', () => {
      const layout = getDefaultLayoutForRole('direction');

      expect(layout).toBeDefined();
      expect(layout.length).toBeGreaterThan(0);

      // Should include executive-kpi widget for direction
      const hasExecutiveKpi = layout.some((w) => w.widgetId === 'executive-kpi');
      expect(hasExecutiveKpi).toBe(true);
    });

    it('should return rssi layout for rssi role', () => {
      const layout = getDefaultLayoutForRole('rssi');

      expect(layout).toBeDefined();
      expect(layout.length).toBeGreaterThan(0);

      // Should include rssi-specific widgets
      const hasRssiWidgets = layout.some(
        (w) =>
          w.widgetId === 'rssi-critical-risks' ||
          w.widgetId === 'rssi-incidents' ||
          w.widgetId === 'rssi-actions'
      );
      expect(hasRssiWidgets).toBe(true);
    });

    it('should return project_manager layout for project_manager role', () => {
      const layout = getDefaultLayoutForRole('project_manager');

      expect(layout).toBeDefined();
      expect(layout.length).toBeGreaterThan(0);

      // Should include PM-specific widgets
      const hasPmWidgets = layout.some(
        (w) =>
          w.widgetId === 'pm-actions-overdue' ||
          w.widgetId === 'pm-timeline' ||
          w.widgetId === 'pm-progress'
      );
      expect(hasPmWidgets).toBe(true);
    });

    it('should return auditor layout for auditor role', () => {
      const layout = getDefaultLayoutForRole('auditor');

      expect(layout).toBeDefined();
      expect(layout.length).toBeGreaterThan(0);

      // Should include audit-related widgets
      const hasAuditWidgets = layout.some((w) => w.widgetId === 'audits-donut');
      expect(hasAuditWidgets).toBe(true);
    });

    it('should return admin layout for admin role', () => {
      const layout = getDefaultLayoutForRole('admin');

      expect(layout).toBeDefined();
      expect(layout.length).toBeGreaterThan(0);

      // Admin should have comprehensive widgets
      const hasStatsOverview = layout.some((w) => w.widgetId === 'stats-overview');
      expect(hasStatsOverview).toBe(true);
    });

    it('should return user layout for user role', () => {
      const layout = getDefaultLayoutForRole('user');

      expect(layout).toBeDefined();
      expect(layout.length).toBeGreaterThan(0);

      // Basic user should have workspace widget
      const hasMyWorkspace = layout.some((w) => w.widgetId === 'my-workspace');
      expect(hasMyWorkspace).toBe(true);
    });

    it('should return user layout for unknown role', () => {
      const layout = getDefaultLayoutForRole('unknown-role' as UserRole);

      expect(layout).toBeDefined();
      expect(layout.length).toBeGreaterThan(0);
    });

    it('should return fresh copies to avoid mutation', () => {
      const layout1 = getDefaultLayoutForRole('rssi');
      const layout2 = getDefaultLayoutForRole('rssi');

      // Should be different array instances
      expect(layout1).not.toBe(layout2);

      // IDs should be different (generated with timestamp/random)
      expect(layout1[0].id).not.toBe(layout2[0].id);
    });

    it('should include unique IDs for each widget', () => {
      const layout = getDefaultLayoutForRole('rssi');
      const ids = layout.map((w) => w.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getDashboardRole', () => {
    it('should return valid role for known roles', () => {
      const validRoles: UserRole[] = [
        'direction',
        'rssi',
        'project_manager',
        'auditor',
        'admin',
        'user',
      ];

      validRoles.forEach((role) => {
        expect(getDashboardRole(role)).toBe(role);
      });
    });

    it('should return user for unknown role', () => {
      expect(getDashboardRole('unknown')).toBe('user');
      expect(getDashboardRole('')).toBe('user');
    });
  });

  describe('getWidgetCategory', () => {
    it('should return correct category for score/kpi widgets', () => {
      expect(getWidgetCategory('compliance-score')).toBe('scoreKpi');
      expect(getWidgetCategory('executive-kpi')).toBe('scoreKpi');
      expect(getWidgetCategory('stats-overview')).toBe('scoreKpi');
    });

    it('should return correct category for risk widgets', () => {
      expect(getWidgetCategory('rssi-critical-risks')).toBe('risks');
      expect(getWidgetCategory('priority-risks')).toBe('risks');
      expect(getWidgetCategory('risk-heatmap')).toBe('risks');
    });

    it('should return correct category for action widgets', () => {
      expect(getWidgetCategory('pm-actions-overdue')).toBe('actions');
      expect(getWidgetCategory('pm-timeline')).toBe('actions');
      expect(getWidgetCategory('pm-progress')).toBe('actions');
      expect(getWidgetCategory('rssi-actions')).toBe('actions');
    });

    it('should return correct category for audit widgets', () => {
      expect(getWidgetCategory('audits-donut')).toBe('audits');
    });

    it('should return other for uncategorized widgets', () => {
      expect(getWidgetCategory('unknown-widget')).toBe('other');
    });
  });

  describe('WIDGET_CATEGORIES', () => {
    it('should have categories for all Story 2-2 to 2-5 widgets', () => {
      const newWidgets = [
        'compliance-score',
        'executive-kpi',
        'rssi-critical-risks',
        'rssi-incidents',
        'rssi-actions',
        'pm-actions-overdue',
        'pm-timeline',
        'pm-progress',
      ];

      newWidgets.forEach((widgetId) => {
        expect(WIDGET_CATEGORIES[widgetId]).toBeDefined();
      });
    });
  });

  describe('ROLE_DEFAULT_LAYOUTS', () => {
    it('should have layouts for all roles', () => {
      const roles: UserRole[] = [
        'direction',
        'rssi',
        'project_manager',
        'auditor',
        'admin',
        'user',
      ];

      roles.forEach((role) => {
        expect(ROLE_DEFAULT_LAYOUTS[role]).toBeDefined();
        expect(Array.isArray(ROLE_DEFAULT_LAYOUTS[role])).toBe(true);
        expect(ROLE_DEFAULT_LAYOUTS[role].length).toBeGreaterThan(0);
      });
    });
  });

  describe('Role-specific layouts', () => {
    it('DIRECTION_DEFAULT_LAYOUT should have executive widgets', () => {
      const widgetIds = DIRECTION_DEFAULT_LAYOUT.map((w) => w.widgetId);
      expect(widgetIds).toContain('executive-kpi');
      expect(widgetIds).toContain('compliance-score');
    });

    it('RSSI_DEFAULT_LAYOUT should have security widgets', () => {
      const widgetIds = RSSI_DEFAULT_LAYOUT.map((w) => w.widgetId);
      expect(widgetIds).toContain('rssi-critical-risks');
      expect(widgetIds).toContain('rssi-incidents');
      expect(widgetIds).toContain('rssi-actions');
    });

    it('PROJECT_MANAGER_DEFAULT_LAYOUT should have PM widgets', () => {
      const widgetIds = PROJECT_MANAGER_DEFAULT_LAYOUT.map((w) => w.widgetId);
      expect(widgetIds).toContain('pm-actions-overdue');
      expect(widgetIds).toContain('pm-timeline');
      expect(widgetIds).toContain('pm-progress');
    });

    it('AUDITOR_DEFAULT_LAYOUT should have audit widgets', () => {
      const widgetIds = AUDITOR_DEFAULT_LAYOUT.map((w) => w.widgetId);
      expect(widgetIds).toContain('audits-donut');
      expect(widgetIds).toContain('documents-stats');
    });

    it('ADMIN_DEFAULT_LAYOUT should have comprehensive widgets', () => {
      const widgetIds = ADMIN_DEFAULT_LAYOUT.map((w) => w.widgetId);
      expect(widgetIds).toContain('stats-overview');
      expect(widgetIds).toContain('health-check');
    });

    it('USER_DEFAULT_LAYOUT should have basic widgets', () => {
      const widgetIds = USER_DEFAULT_LAYOUT.map((w) => w.widgetId);
      expect(widgetIds).toContain('my-workspace');
      expect(widgetIds).toContain('compliance-progress');
    });
  });
});
