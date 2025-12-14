import { collection, getDocs, query, where, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Audit, Project, Asset, BcpDrill, Incident } from '../types';
import { parseISO } from 'date-fns';
import { ErrorLogger } from './errorLogger';

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    resource?: unknown;
    type: 'audit' | 'drill' | 'project' | 'maintenance' | 'incident' | 'compliance' | 'google';
    color: string;
    description?: string;
    location?: string;
    status?: string;
}

interface CreateEventData {
    type: 'audit' | 'project' | 'drill' | 'maintenance' | 'incident' | 'compliance';
    title: string;
    start: Date;
    end: Date;
    description?: string;
    linkedAssetIds?: string[];
    linkedRiskIds?: string[];
    subType?: string;
    auditor?: string;
    manager?: string;
    technician?: string;
    processId?: string;
    [key: string]: unknown;
}

export const CalendarService = {
    /**
     * Aggregates events from all modules for a specific organization.
     */
    fetchAllEvents: async (organizationId: string): Promise<CalendarEvent[]> => {
        if (!organizationId) return [];

        const events: CalendarEvent[] = [];

        try {
            // 1. Audits
            const auditsQuery = query(collection(db, 'audits'), where('organizationId', '==', organizationId));
            const auditsSnap = await getDocs(auditsQuery);
            auditsSnap.forEach(doc => {
                const data = doc.data() as Audit;
                if (data.dateScheduled) {
                    const startDate = parseISO(data.dateScheduled);
                    events.push({
                        id: doc.id,
                        title: `Audit: ${data.name}`,
                        start: startDate,
                        end: new Date(startDate.getTime() + 2 * 60 * 60 * 1000), // Default 2h
                        type: 'audit',
                        color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
                        description: `Type: ${data.type}\nScope: ${data.scope || 'N/A'}`,
                        location: 'Sur site / Distanciel',
                        status: data.status
                    });
                }
            });

            // 2. Projects
            const projectsQuery = query(collection(db, 'projects'), where('organizationId', '==', organizationId));
            const projectsSnap = await getDocs(projectsQuery);
            projectsSnap.forEach(doc => {
                const data = doc.data() as Project;
                if (data.dueDate) {
                    const dueDate = parseISO(data.dueDate);
                    events.push({
                        id: doc.id,
                        title: `Deadline: ${data.name}`,
                        start: dueDate,
                        end: dueDate,
                        allDay: true,
                        type: 'project',
                        color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
                        description: `Statut: ${data.status}\nResponsable: ${data.manager}`,
                        location: 'Gestion de projet',
                        status: data.status
                    });
                }
            });

            // 3. Assets (Maintenance)
            const assetsQuery = query(collection(db, 'assets'), where('organizationId', '==', organizationId));
            const assetsSnap = await getDocs(assetsQuery);
            assetsSnap.forEach(doc => {
                const data = doc.data() as Asset;
                if (data.nextMaintenance) {
                    const maintDate = parseISO(data.nextMaintenance);
                    events.push({
                        id: doc.id,
                        title: `Maintenance: ${data.name}`,
                        start: maintDate,
                        end: new Date(maintDate.getTime() + 1 * 60 * 60 * 1000), // Default 1h
                        type: 'maintenance',
                        color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
                        description: `Type: ${data.type}\nCriticité: ${data.confidentiality}`,
                        location: data.location || 'N/A',
                        status: 'Scheduled'
                    });
                }
            });

            // 4. BCP Drills
            const drillsQuery = query(collection(db, 'bcp_drills'), where('organizationId', '==', organizationId));
            const drillsSnap = await getDocs(drillsQuery);
            drillsSnap.forEach(doc => {
                const data = doc.data() as BcpDrill;
                if (data.date) {
                    const drillDate = parseISO(data.date);
                    events.push({
                        id: doc.id,
                        title: `Exercice BCP: ${data.type}`,
                        start: drillDate,
                        end: new Date(drillDate.getTime() + 4 * 60 * 60 * 1000), // Default 4h
                        type: 'drill',
                        color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
                        description: `Résultat: ${data.result || 'Prévu'}`,
                        location: 'Interne',
                        status: data.result ? 'Completed' : 'Planned'
                    });
                }
            });

            // 5. Incidents
            const incidentsQuery = query(collection(db, 'incidents'), where('organizationId', '==', organizationId));
            const incidentsSnap = await getDocs(incidentsQuery);
            incidentsSnap.forEach(doc => {
                const data = doc.data() as Incident;
                if (data.dateReported) {
                    const reportDate = parseISO(data.dateReported);
                    events.push({
                        id: doc.id,
                        title: `Incident: ${data.title}`,
                        start: reportDate,
                        end: new Date(reportDate.getTime() + 1 * 60 * 60 * 1000),
                        type: 'incident',
                        color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
                        description: `Sévérité: ${data.severity}\nStatut: ${data.status}`,
                        location: 'N/A',
                        status: data.status
                    });
                }
            });

        } catch (error) {
            ErrorLogger.error(error, 'CalendarService.fetchAllEvents');
        }

        return events;
    },

    /**
     * Creates an event in the appropriate Firestore collection based on type.
     */
    createEvent: async (eventData: CreateEventData, organizationId: string, userId: string) => {
        try {
            const { type, title, start, end, description, linkedAssetIds, linkedRiskIds, ...rest } = eventData;

            // Common metadata
            const meta = {
                organizationId,
                createdAt: new Date().toISOString(),
                createdBy: userId
            };

            if (type === 'audit') {
                await addDoc(collection(db, 'audits'), {
                    name: title,
                    dateScheduled: start.toISOString(),
                    type: rest.subType || 'Interne',
                    status: 'Planifié',
                    findingsCount: 0,
                    scope: description,
                    relatedAssetIds: linkedAssetIds || [],
                    relatedRiskIds: linkedRiskIds || [],
                    auditor: rest.auditor || 'Non assigné',
                    ...meta
                });
            } else if (type === 'project') {
                await addDoc(collection(db, 'projects'), {
                    name: title,
                    description: description || '',
                    dueDate: end.toISOString(),
                    status: 'Planifié',
                    progress: 0,
                    manager: rest.manager || 'Non assigné',
                    tasks: [],
                    relatedAssetIds: linkedAssetIds || [],
                    relatedRiskIds: linkedRiskIds || [],
                    ...meta
                });
            } else if (type === 'drill') {
                await addDoc(collection(db, 'bcp_drills'), {
                    type: rest.subType || 'Tabletop',
                    date: start.toISOString(),
                    result: '',
                    notes: description,
                    processId: rest.processId || 'General', // Needs to be linked to a process ideally
                    ...meta
                });
            } else if (type === 'maintenance' && linkedAssetIds && linkedAssetIds.length > 0) {
                // Create maintenance record for EACH linked asset
                const promises = linkedAssetIds.map((assetId: string) =>
                    addDoc(collection(db, 'assets', assetId, 'maintenance'), {
                        date: start.toISOString(),
                        type: rest.subType || 'Préventive',
                        description: description || title,
                        technician: rest.technician || 'Non assigné',
                        ...meta
                    })
                );
                await Promise.all(promises);
            }

            return true;
        } catch (error) {
            ErrorLogger.error(error, 'CalendarService.createEvent');
            throw error;
        }
    },

    /**
     * Updates an event's start and end dates.
     */
    updateEvent: async (event: CalendarEvent, start: Date, end: Date) => {
        try {
            const collectionName =
                event.type === 'audit' ? 'audits' :
                    event.type === 'project' ? 'projects' :
                        event.type === 'drill' ? 'bcp_drills' :
                            event.type === 'incident' ? 'incidents' :
                                null;

            if (!collectionName) return; // Maintenance and Google events not supported for direct update yet

            const docRef = doc(db, collectionName, event.id);
            const updates: Record<string, unknown> = {};

            if (event.type === 'audit') {
                updates.dateScheduled = start.toISOString();
            } else if (event.type === 'project') {
                updates.dueDate = end.toISOString();
            } else if (event.type === 'drill') {
                updates.date = start.toISOString();
            } else if (event.type === 'incident') {
                updates.dateReported = start.toISOString();
            }

            await updateDoc(docRef, updates);
            return true;
        } catch (error) {
            ErrorLogger.error(error, 'CalendarService.updateEvent');
            throw error;
        }
    },

    // --- Export Helpers ---

    google: (event: { title: string; description?: string; start: Date; end: Date; location?: string }): string => {
        const start = event.start.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const end = event.end.toISOString().replace(/-|:|\.\d\d\d/g, "");

        const url = new URL('https://calendar.google.com/calendar/render');
        url.searchParams.append('action', 'TEMPLATE');
        url.searchParams.append('text', event.title);
        url.searchParams.append('dates', `${start}/${end}`);
        if (event.description) url.searchParams.append('details', event.description);
        if (event.location) url.searchParams.append('location', event.location);

        return url.toString();
    },

    outlook: (event: { title: string; description?: string; start: Date; end: Date; location?: string }): string => {
        const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
        url.searchParams.append('subject', event.title);
        url.searchParams.append('startdt', event.start.toISOString());
        url.searchParams.append('enddt', event.end.toISOString());
        if (event.description) url.searchParams.append('body', event.description);
        if (event.location) url.searchParams.append('location', event.location);

        return url.toString();
    },

    ics: (event: { title: string; description?: string; start: Date; end: Date; location?: string; id?: string }): string => {
        const start = event.start.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const end = event.end.toISOString().replace(/-|:|\.\d\d\d/g, "");

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Sentinel GRC//EN',
            'BEGIN:VEVENT',
            `UID:${event.id || 'event'}@sentinel-grc.com`,
            `DTSTAMP:${start}`,
            `DTSTART:${start}`,
            `DTEND:${end}`,
            `SUMMARY:${event.title}`,
            event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
            event.location ? `LOCATION:${event.location}` : '',
            'END:VEVENT',
            'END:VCALENDAR'
        ].filter(Boolean).join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        return URL.createObjectURL(blob);
    },

    downloadIcs: (event: { title: string; description?: string; start: Date; end: Date; location?: string; id?: string }) => {
        const url = CalendarService.ics(event);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
