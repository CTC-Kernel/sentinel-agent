
export interface CalendarEvent {
    title: string;
    description: string;
    start: Date;
    end?: Date;
    location?: string;
    url?: string;
}

export const generateICS = (event: CalendarEvent) => {
    const formatDate = (date: Date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const start = formatDate(event.start);
    const end = event.end ? formatDate(event.end) : start;

    const content = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Sentinel GRC//NONSGML v1.0//EN',
        'BEGIN:VEVENT',
        `UID:${Date.now()}@sentinel-grc.com`,
        `DTSTAMP:${formatDate(new Date())}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${event.description}`,
        event.location ? `LOCATION:${event.location}` : '',
        event.url ? `URL:${event.url}` : '',
        'END:VEVENT',
        'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
