import { CalendarEvent } from './calendarService';
import { ErrorLogger } from './errorLogger';

const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

interface GoogleCalendarEventResource {
    id: string;
    summary?: string;
    description?: string;
    location?: string;
    status?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
}

interface CreateGoogleEventInput {
    title: string;
    description?: string;
    location?: string;
    start: Date;
    end: Date;
}

export const GoogleCalendarService = {
    /**
     * List events from the user's primary calendar.
     */
    listEvents: async (accessToken: string, timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> => {
        try {
            const params = new URLSearchParams({
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                singleEvents: 'true',
                orderBy: 'startTime',
            });

            const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events?${params}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Google Calendar API error: ${response.statusText}`);
            }

            const data = await response.json();

            return data.items.map((item: GoogleCalendarEventResource) => ({
                id: item.id,
                title: item.summary || 'Sans titre',
                start: new Date(item.start.dateTime || item.start.date || ''),
                end: new Date(item.end.dateTime || item.end.date || ''),
                allDay: !item.start.dateTime,
                type: 'google', // Special type for styling
                color: 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-white/10 dark:text-slate-300', // Neutral styling
                description: item.description,
                location: item.location,
                status: item.status,
                resource: { googleEvent: item } // Store original data
            }));

        } catch (error) {
            ErrorLogger.error(error, 'GoogleCalendarService.listEvents');
            return [];
        }
    },

    /**
     * Create a new event in the user's primary calendar.
     */
    createEvent: async (accessToken: string, event: CreateGoogleEventInput) => {
        try {
            const googleEvent = {
                summary: event.title,
                description: event.description,
                location: event.location,
                start: {
                    dateTime: event.start.toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
                end: {
                    dateTime: event.end.toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
            };

            const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(googleEvent),
            });

            if (!response.ok) {
                throw new Error(`Google Calendar API error: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            ErrorLogger.error(error, 'GoogleCalendarService.createEvent');
            throw error;
        }
    }
};
