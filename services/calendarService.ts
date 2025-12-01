
export interface CalendarEvent {
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
}

export const CalendarService = {
    google: (event: CalendarEvent): string => {
        const start = event.startTime.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const end = event.endTime.toISOString().replace(/-|:|\.\d\d\d/g, "");

        const url = new URL('https://calendar.google.com/calendar/render');
        url.searchParams.append('action', 'TEMPLATE');
        url.searchParams.append('text', event.title);
        url.searchParams.append('dates', `${start}/${end}`);
        if (event.description) url.searchParams.append('details', event.description);
        if (event.location) url.searchParams.append('location', event.location);

        return url.toString();
    },

    outlook: (event: CalendarEvent): string => {
        const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
        url.searchParams.append('subject', event.title);
        url.searchParams.append('startdt', event.startTime.toISOString());
        url.searchParams.append('enddt', event.endTime.toISOString());
        if (event.description) url.searchParams.append('body', event.description);
        if (event.location) url.searchParams.append('location', event.location);

        return url.toString();
    },

    ics: (event: CalendarEvent): string => {
        const start = event.startTime.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const end = event.endTime.toISOString().replace(/-|:|\.\d\d\d/g, "");

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Sentinel GRC//EN',
            'BEGIN:VEVENT',
            `UID:${Date.now()}@sentinel-grc.com`,
            `DTSTAMP:${start}`,
            `DTSTART:${start}`,
            `DTEND:${end}`,
            `SUMMARY:${event.title}`,
            event.description ? `DESCRIPTION:${event.description}` : '',
            event.location ? `LOCATION:${event.location}` : '',
            'END:VEVENT',
            'END:VCALENDAR'
        ].filter(Boolean).join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        return URL.createObjectURL(blob);
    },

    downloadIcs: (event: CalendarEvent) => {
        const url = CalendarService.ics(event);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
