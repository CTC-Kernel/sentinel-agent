import { differenceInHours, addHours } from 'date-fns';
import { Incident } from '../types';

export enum DeadlineStatus {
    OK = 'ok',
    WARNING = 'warning', // < 4h remaining
    OVERDUE = 'overdue'
}

export interface DeadlineInfo {
    type: '24h' | '72h' | '1mo';
    label: string;
    deadlineDate: Date;
    remainingHours: number;
    status: DeadlineStatus;
    isCompleted: boolean;
}

export const getIncidentDeadlines = (incident: Incident): DeadlineInfo[] => {
    if (!incident.isSignificant) return [];

    const startDate = incident.detectedAt ? new Date(incident.detectedAt) : new Date(incident.dateReported);
    const now = new Date();

    // 24h Early Warning
    const earlyWarningDeadline = addHours(startDate, 24);
    const earlyWarningDiff = differenceInHours(earlyWarningDeadline, now);
    const earlyWarningStatus =
        incident.notificationStatus === 'Pending' || incident.notificationStatus === 'Reported'
            ? DeadlineStatus.OK // Assume done if status advanced (logic can be refined)
            : earlyWarningDiff < 0 ? DeadlineStatus.OVERDUE : earlyWarningDiff < 4 ? DeadlineStatus.WARNING : DeadlineStatus.OK;

    // 72h Full Notification
    const fullNotificationDeadline = addHours(startDate, 72);
    const fullDiff = differenceInHours(fullNotificationDeadline, now);
    const fullStatus =
        incident.notificationStatus === 'Reported'
            ? DeadlineStatus.OK
            : fullDiff < 0 ? DeadlineStatus.OVERDUE : fullDiff < 12 ? DeadlineStatus.WARNING : DeadlineStatus.OK;

    return [
        {
            type: '24h',
            label: 'Alerte Précoce (24h)',
            deadlineDate: earlyWarningDeadline,
            remainingHours: earlyWarningDiff,
            status: earlyWarningStatus,
            isCompleted: incident.notificationStatus !== 'Not Required' && incident.notificationStatus !== undefined
        },
        {
            type: '72h',
            label: 'Notification Incident (72h)',
            deadlineDate: fullNotificationDeadline,
            remainingHours: fullDiff,
            status: fullStatus,
            isCompleted: incident.notificationStatus === 'Reported'
        }
    ];
};
