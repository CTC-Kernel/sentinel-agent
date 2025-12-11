import { Audit, ProjectTask } from '../types';

interface CalendarEvent {
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    url?: string;
}

export const generateICS = (events: CalendarEvent[]): string => {
    // Basic ICS Header
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Sentinel GRC//Calendar//FR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];

    events.forEach(event => {
        const start = formatDateToICS(event.startTime);
        const end = formatDateToICS(event.endTime);
        const now = formatDateToICS(new Date());

        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`UID:${crypto.randomUUID()}@sentinel-grc.com`);
        icsContent.push(`DTSTAMP:${now}`);
        icsContent.push(`DTSTART:${start}`);
        icsContent.push(`DTEND:${end}`);
        icsContent.push(`SUMMARY:${escapeICS(event.title)}`);

        if (event.description) {
            icsContent.push(`DESCRIPTION:${escapeICS(event.description)}`);
        }

        if (event.location) {
            icsContent.push(`LOCATION:${escapeICS(event.location)}`);
        }

        if (event.url) {
            icsContent.push(`URL:${event.url}`);
        }

        icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    return icsContent.join('\r\n');
};

export const downloadICS = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Helper to format date as YYYYMMDDTHHmmSSZ
const formatDateToICS = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

// Helper to escape special characters
const escapeICS = (str: string): string => {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
};

// Transformer functions
export const mapAuditsToEvents = (audits: Audit[]): CalendarEvent[] => {
    return audits.map(audit => {
        const startDate = new Date(audit.dateScheduled);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour duration
        return {
            title: `Audit: ${audit.name}`,
            description: `Audit details: ${audit.scope || 'No scope defined'}`,
            startTime: startDate,
            endTime: endDate,
            location: 'Sentinel GRC',
        };
    });
};

export const mapTasksToEvents = (tasks: ProjectTask[]): CalendarEvent[] => {
    return tasks
        .filter(t => t.startDate && t.dueDate)
        .map(task => {
            return {
                title: `Tâche: ${task.title}`,
                description: task.description || '',
                startTime: new Date(task.startDate!),
                endTime: new Date(task.dueDate!),
                location: 'Sentinel GRC',
            };
        });
};
