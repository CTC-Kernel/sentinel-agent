/**
 * Tests for WidgetRegistry.tsx
 * Story 2-6: Configurable Dashboard Widgets
 * Task 7.1: Test WidgetRegistry has all new widgets
 */

import { describe, it, expect } from 'vitest';
import { WIDGET_REGISTRY, type WidgetId } from '../WidgetRegistry';

describe('WidgetRegistry', () => {
 describe('Story 2-2 to 2-5 widgets registration', () => {
 it('should have compliance-score widget (Story 2-2)', () => {
 expect(WIDGET_REGISTRY['compliance-score']).toBeDefined();
 expect(WIDGET_REGISTRY['compliance-score'].component).toBeDefined();
 expect(WIDGET_REGISTRY['compliance-score'].titleKey).toBe('dashboard.complianceScore');
 expect(WIDGET_REGISTRY['compliance-score'].defaultColSpan).toBe(1);
 });

 it('should have executive-kpi widget (Story 2-3)', () => {
 expect(WIDGET_REGISTRY['executive-kpi']).toBeDefined();
 expect(WIDGET_REGISTRY['executive-kpi'].component).toBeDefined();
 expect(WIDGET_REGISTRY['executive-kpi'].titleKey).toBe('dashboard.executiveKpi');
 expect(WIDGET_REGISTRY['executive-kpi'].defaultColSpan).toBe(3);
 });

 it('should have rssi-critical-risks widget (Story 2-4)', () => {
 expect(WIDGET_REGISTRY['rssi-critical-risks']).toBeDefined();
 expect(WIDGET_REGISTRY['rssi-critical-risks'].component).toBeDefined();
 expect(WIDGET_REGISTRY['rssi-critical-risks'].titleKey).toBe('dashboard.rssiCriticalRisks');
 });

 it('should have rssi-incidents widget (Story 2-4)', () => {
 expect(WIDGET_REGISTRY['rssi-incidents']).toBeDefined();
 expect(WIDGET_REGISTRY['rssi-incidents'].component).toBeDefined();
 expect(WIDGET_REGISTRY['rssi-incidents'].titleKey).toBe('dashboard.rssiIncidents');
 });

 it('should have rssi-actions widget (Story 2-4)', () => {
 expect(WIDGET_REGISTRY['rssi-actions']).toBeDefined();
 expect(WIDGET_REGISTRY['rssi-actions'].component).toBeDefined();
 expect(WIDGET_REGISTRY['rssi-actions'].titleKey).toBe('dashboard.rssiActions');
 });

 it('should have pm-actions-overdue widget (Story 2-5)', () => {
 expect(WIDGET_REGISTRY['pm-actions-overdue']).toBeDefined();
 expect(WIDGET_REGISTRY['pm-actions-overdue'].component).toBeDefined();
 expect(WIDGET_REGISTRY['pm-actions-overdue'].titleKey).toBe('dashboard.pmActionsOverdue');
 });

 it('should have pm-timeline widget (Story 2-5)', () => {
 expect(WIDGET_REGISTRY['pm-timeline']).toBeDefined();
 expect(WIDGET_REGISTRY['pm-timeline'].component).toBeDefined();
 expect(WIDGET_REGISTRY['pm-timeline'].titleKey).toBe('dashboard.pmTimeline');
 });

 it('should have pm-progress widget (Story 2-5)', () => {
 expect(WIDGET_REGISTRY['pm-progress']).toBeDefined();
 expect(WIDGET_REGISTRY['pm-progress'].component).toBeDefined();
 expect(WIDGET_REGISTRY['pm-progress'].titleKey).toBe('dashboard.pmProgress');
 });
 });

 describe('Widget structure validation', () => {
 const newWidgetIds: WidgetId[] = [
 'compliance-score',
 'executive-kpi',
 'rssi-critical-risks',
 'rssi-incidents',
 'rssi-actions',
 'pm-actions-overdue',
 'pm-timeline',
 'pm-progress',
 ];

 newWidgetIds.forEach((widgetId) => {
 describe(`${widgetId}`, () => {
 it('should have required properties', () => {
 const widget = WIDGET_REGISTRY[widgetId];

 expect(widget).toBeDefined();
 expect(widget.component).toBeDefined();
 expect(typeof widget.component).toBe('function');
 expect(widget.titleKey).toBeDefined();
 expect(typeof widget.titleKey).toBe('string');
 expect(widget.defaultColSpan).toBeDefined();
 expect([1, 2, 3]).toContain(widget.defaultColSpan);
 });

 it('should have valid id property', () => {
 const widget = WIDGET_REGISTRY[widgetId];

 expect(widget.id).toBe(widgetId);
 });
 });
 });
 });

 describe('Registry integrity', () => {
 it('should have at least 26 widgets registered (18 existing + 8 new)', () => {
 const widgetCount = Object.keys(WIDGET_REGISTRY).length;
 expect(widgetCount).toBeGreaterThanOrEqual(26);
 });

 it('should have all existing widgets still registered', () => {
 const existingWidgets = [
 'stats-overview',
 'my-workspace',
 'compliance-evolution',
 'health-check',
 'priority-risks',
 'recent-activity',
 'maturity-radar',
 'cyber-news',
 'risk-heatmap',
 'audits-donut',
 'project-tasks',
 'incidents-stats',
 'documents-stats',
 'compliance-progress',
 'asset-stats',
 'suppliers-stats',
 'continuity-plans',
 'nis2-dora-kpi',
 ];

 existingWidgets.forEach((widgetId) => {
 expect(WIDGET_REGISTRY[widgetId as WidgetId]).toBeDefined();
 });
 });

 it('should have valid defaultColSpan values (1, 2, or 3)', () => {
 Object.entries(WIDGET_REGISTRY).forEach(([_id, widget]) => {
 expect([1, 2, 3]).toContain(widget.defaultColSpan);
 });
 });

 it('should have titleKey for all widgets', () => {
 Object.entries(WIDGET_REGISTRY).forEach(([_id, widget]) => {
 expect(widget.titleKey).toBeDefined();
 expect(typeof widget.titleKey).toBe('string');
 expect(widget.titleKey.length).toBeGreaterThan(0);
 });
 });
 });
});
