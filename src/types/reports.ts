/**
 * Report Types
 * Story 7.3: Scheduled Recurring Reports
 */

import { ReportConfig } from '../components/reports/ReportConfigurationModal';

export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly';
export type ReportTemplateId = 'iso27001' | 'gdpr' | 'custom';
export type ScheduledReportStatus = 'active' | 'paused';

export interface ScheduledReport {
    id: string;
    organizationId: string;
    name: string;
    templateId: ReportTemplateId;
    frequency: ReportFrequency;
    dayOfWeek?: number; // 0-6 for weekly (0 = Sunday)
    dayOfMonth?: number; // 1-28 for monthly/quarterly
    recipients: string[]; // email addresses
    config: ReportConfig;
    createdBy: string;
    createdByName: string;
    createdAt: string;
    updatedAt: string;
    lastRunAt?: string;
    nextRunAt: string;
    status: ScheduledReportStatus;
}

export interface ScheduledReportFormData {
    name: string;
    templateId: ReportTemplateId;
    frequency: ReportFrequency;
    dayOfWeek?: number;
    dayOfMonth?: number;
    recipients: string[];
    config: ReportConfig;
}

// Helper to get human-readable frequency label
export const frequencyLabels: Record<ReportFrequency, string> = {
    weekly: 'Hebdomadaire',
    monthly: 'Mensuel',
    quarterly: 'Trimestriel'
};

// Helper to get day of week labels
export const dayOfWeekLabels: Record<number, string> = {
    0: 'Dimanche',
    1: 'Lundi',
    2: 'Mardi',
    3: 'Mercredi',
    4: 'Jeudi',
    5: 'Vendredi',
    6: 'Samedi'
};

// Helper to calculate next run date
export function calculateNextRunDate(
    frequency: ReportFrequency,
    dayOfWeek?: number,
    dayOfMonth?: number,
    fromDate: Date = new Date()
): Date {
    const now = new Date(fromDate);
    const result = new Date(now);

    switch (frequency) {
        case 'weekly': {
            const targetDay = dayOfWeek ?? 1; // Default Monday
            const currentDay = now.getDay();
            let daysUntilTarget = targetDay - currentDay;
            if (daysUntilTarget <= 0) daysUntilTarget += 7;
            result.setDate(now.getDate() + daysUntilTarget);
            break;
        }
        case 'monthly': {
            const targetDayOfMonth = dayOfMonth ?? 1;
            result.setMonth(now.getMonth() + 1);
            result.setDate(Math.min(targetDayOfMonth, 28));
            break;
        }
        case 'quarterly': {
            const targetDayOfMonth = dayOfMonth ?? 1;
            const currentQuarter = Math.floor(now.getMonth() / 3);
            const nextQuarterStart = (currentQuarter + 1) * 3;
            result.setMonth(nextQuarterStart);
            result.setDate(Math.min(targetDayOfMonth, 28));
            break;
        }
    }

    // Set time to 9 AM
    result.setHours(9, 0, 0, 0);
    return result;
}
