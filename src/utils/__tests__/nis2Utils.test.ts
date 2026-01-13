/**
 * NIS2 Utils Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getIncidentDeadlines, DeadlineStatus } from '../nis2Utils';
import { Incident } from '../../types';
import { Criticality } from '../../types/common';
import { IncidentStatus } from '../../types/incidents';

describe('NIS2 Utils', () => {
    const createIncident = (overrides: Partial<Incident> = {}): Incident => ({
        id: 'incident-1',
        title: 'Test Incident',
        description: 'Test description',
        severity: Criticality.HIGH,
        status: 'Nouveau' as IncidentStatus,
        dateReported: '2024-01-15T10:00:00Z',
        organizationId: 'org-1',
        updatedAt: '2024-01-15T10:00:00Z',
        isSignificant: true,
        reporter: 'user-1',
        ...overrides,
    } as Incident);

    describe('getIncidentDeadlines', () => {
        beforeEach(() => {
            // Mock current time to 2024-01-15T20:00:00Z (10 hours after incident)
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-15T20:00:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return empty array for non-significant incidents', () => {
            const incident = createIncident({ isSignificant: false });
            const deadlines = getIncidentDeadlines(incident);
            expect(deadlines).toEqual([]);
        });

        it('should return 24h and 72h deadlines for significant incidents', () => {
            const incident = createIncident();
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines).toHaveLength(2);
            expect(deadlines[0].type).toBe('24h');
            expect(deadlines[1].type).toBe('72h');
        });

        it('should calculate correct deadline dates from detectedAt', () => {
            const incident = createIncident({
                detectedAt: '2024-01-15T10:00:00Z',
            });
            const deadlines = getIncidentDeadlines(incident);

            // 24h deadline: 2024-01-16T10:00:00Z
            expect(deadlines[0].deadlineDate.toISOString()).toBe('2024-01-16T10:00:00.000Z');
            // 72h deadline: 2024-01-18T10:00:00Z
            expect(deadlines[1].deadlineDate.toISOString()).toBe('2024-01-18T10:00:00.000Z');
        });

        it('should fall back to dateReported when detectedAt is not set', () => {
            const incident = createIncident({
                detectedAt: undefined,
                dateReported: '2024-01-15T10:00:00Z',
            });
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[0].deadlineDate.toISOString()).toBe('2024-01-16T10:00:00.000Z');
        });

        it('should show OK status when plenty of time remaining', () => {
            // 10 hours after incident, 14 hours remaining for 24h deadline
            const incident = createIncident();
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[0].status).toBe(DeadlineStatus.OK);
            expect(deadlines[0].remainingHours).toBe(14);
        });

        it('should show WARNING status for 24h deadline when < 4h remaining', () => {
            // Set time to 22 hours after incident (2 hours remaining)
            vi.setSystemTime(new Date('2024-01-16T08:00:00Z'));

            const incident = createIncident();
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[0].status).toBe(DeadlineStatus.WARNING);
            expect(deadlines[0].remainingHours).toBe(2);
        });

        it('should show OVERDUE status for 24h deadline when past due', () => {
            // Set time to 26 hours after incident
            vi.setSystemTime(new Date('2024-01-16T12:00:00Z'));

            const incident = createIncident();
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[0].status).toBe(DeadlineStatus.OVERDUE);
            expect(deadlines[0].remainingHours).toBeLessThan(0);
        });

        it('should show WARNING status for 72h deadline when < 12h remaining', () => {
            // Set time to 66 hours after incident (6 hours remaining for 72h)
            vi.setSystemTime(new Date('2024-01-18T04:00:00Z'));

            const incident = createIncident();
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[1].status).toBe(DeadlineStatus.WARNING);
            expect(deadlines[1].remainingHours).toBe(6);
        });

        it('should show OVERDUE status for 72h deadline when past due', () => {
            // Set time to 80 hours after incident
            vi.setSystemTime(new Date('2024-01-18T18:00:00Z'));

            const incident = createIncident();
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[1].status).toBe(DeadlineStatus.OVERDUE);
        });

        it('should mark 24h as OK when notificationStatus is Pending', () => {
            const incident = createIncident({
                notificationStatus: 'Pending',
            });
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[0].status).toBe(DeadlineStatus.OK);
        });

        it('should mark 24h as OK when notificationStatus is Reported', () => {
            const incident = createIncident({
                notificationStatus: 'Reported',
            });
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[0].status).toBe(DeadlineStatus.OK);
        });

        it('should mark 72h as OK when notificationStatus is Reported', () => {
            const incident = createIncident({
                notificationStatus: 'Reported',
            });
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[1].status).toBe(DeadlineStatus.OK);
        });

        it('should mark 24h as completed when notificationStatus is set', () => {
            const incident = createIncident({
                notificationStatus: 'Pending',
            });
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[0].isCompleted).toBe(true);
        });

        it('should mark 24h as not completed when notificationStatus is Not Required', () => {
            const incident = createIncident({
                notificationStatus: 'Not Required',
            });
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[0].isCompleted).toBe(false);
        });

        it('should mark 72h as completed only when Reported', () => {
            const incident = createIncident({
                notificationStatus: 'Pending',
            });
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[1].isCompleted).toBe(false);

            const reportedIncident = createIncident({
                notificationStatus: 'Reported',
            });
            const reportedDeadlines = getIncidentDeadlines(reportedIncident);

            expect(reportedDeadlines[1].isCompleted).toBe(true);
        });

        it('should have correct labels in French', () => {
            const incident = createIncident();
            const deadlines = getIncidentDeadlines(incident);

            expect(deadlines[0].label).toBe('Alerte Précoce (24h)');
            expect(deadlines[1].label).toBe('Notification Incident (72h)');
        });
    });

    describe('DeadlineStatus enum', () => {
        it('should have correct values', () => {
            expect(DeadlineStatus.OK).toBe('ok');
            expect(DeadlineStatus.WARNING).toBe('warning');
            expect(DeadlineStatus.OVERDUE).toBe('overdue');
        });
    });
});
