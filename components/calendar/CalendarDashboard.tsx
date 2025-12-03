import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views, View, ToolbarProps, EventProps } from 'react-big-calendar';
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { useStore } from '../../store';
import { CalendarService, CalendarEvent } from '../../services/calendarService';
import { GoogleCalendarService } from '../../services/googleCalendarService';
import { AddToCalendar } from '../ui/AddToCalendar';
import { Drawer } from '../ui/Drawer';
import { CreateEventModal } from './CreateEventModal';
import { Clock, ChevronLeft, ChevronRight, Plus, ShieldAlert, FileText, Briefcase, Wrench, Siren, ShieldCheck } from 'lucide-react';
import { ErrorLogger } from '../../services/errorLogger';
import { toast } from 'sonner';

const locales = {
    'fr': fr,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

const messages = {
    allDay: 'Journée',
    previous: 'Précédent',
    next: 'Suivant',
    today: "Aujourd'hui",
    month: 'Mois',
    week: 'Semaine',
    day: 'Jour',
    agenda: 'Agenda',
    date: 'Date',
    time: 'Heure',
    event: 'Événement',
    noEventsInRange: 'Aucun événement dans cette période.',
    showMore: (total: number) => `+ ${total} autres`,
};

export const CalendarDashboard: React.FC = () => {
    const { user } = useStore();
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [view, setView] = useState<View>(Views.MONTH);
    const [date, setDate] = useState(new Date());
    const [filters, setFilters] = useState({
        audit: true,
        project: true,
        maintenance: true,
        incident: true,
        drill: true,
        google: true
    });

    const loadEvents = useCallback(async () => {
        if (user?.organizationId) {
            try {
                // 1. Fetch Internal Events
                const internalEvents = await CalendarService.fetchAllEvents(user.organizationId);

                // 2. Fetch Google Events (if connected)
                let googleEvents: CalendarEvent[] = [];
                const googleToken = localStorage.getItem('google_access_token');
                if (googleToken && filters.google) {
                    // Fetch for current view range (approximate)
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

                    googleEvents = await GoogleCalendarService.listEvents(googleToken, start, end);
                }

                setEvents([...internalEvents, ...googleEvents]);
            } catch (error) {
                ErrorLogger.error(error, "CalendarDashboard.loadEvents");
            }
        }
    }, [user?.organizationId, filters.google]);

    // Fetch events
    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const filteredEvents = React.useMemo(() => {
        return events.filter(e => filters[e.type as keyof typeof filters]);
    }, [events, filters]);

    const handleSelectEvent = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setIsDrawerOpen(true);
    };

    const onEventResize: withDragAndDropProps['onEventResize'] = async (data) => {
        const { event, start, end } = data;
        const calendarEvent = event as CalendarEvent;
        try {
            await CalendarService.updateEvent(calendarEvent, new Date(start), new Date(end));
            setEvents(prev => prev.map(e => e.id === calendarEvent.id ? { ...e, start: new Date(start), end: new Date(end) } : e));
            toast.success('Événement mis à jour');
        } catch (error) {
            toast.error("Impossible de mettre à jour l'événement");
        }
    };

    const onEventDrop: withDragAndDropProps['onEventDrop'] = async (data) => {
        const { event, start, end } = data;
        const calendarEvent = event as CalendarEvent;
        try {
            await CalendarService.updateEvent(calendarEvent, new Date(start), new Date(end));
            setEvents(prev => prev.map(e => e.id === calendarEvent.id ? { ...e, start: new Date(start), end: new Date(end) } : e));
            toast.success('Événement déplacé');
        } catch (error) {
            toast.error("Impossible de déplacer l'événement");
        }
    };

    const eventStyleGetter = (event: CalendarEvent) => {
        let backgroundColor = '#3b82f6'; // blue-500 default
        let borderColor = '#2563eb';

        if (event.type === 'audit') { backgroundColor = '#9333ea'; borderColor = '#7e22ce'; } // purple
        if (event.type === 'drill') { backgroundColor = '#f97316'; borderColor = '#ea580c'; } // orange
        if (event.type === 'project') { backgroundColor = '#3b82f6'; borderColor = '#2563eb'; } // blue
        if (event.type === 'maintenance') { backgroundColor = '#10b981'; borderColor = '#059669'; } // emerald
        if (event.type === 'incident') { backgroundColor = '#ef4444'; borderColor = '#dc2626'; } // red

        return {
            style: {
                backgroundColor,
                borderColor,
                borderRadius: '6px',
                opacity: 0.9,
                color: 'white',
                border: '0px',
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
            }
        };
    };

    const EventComponent = ({ event }: EventProps<CalendarEvent>) => {
        const Icon =
            event.type === 'audit' ? ShieldCheck :
                event.type === 'drill' ? Siren :
                    event.type === 'project' ? Briefcase :
                        event.type === 'maintenance' ? Wrench :
                            event.type === 'incident' ? ShieldAlert :
                                FileText;

        return (
            <div className="flex items-center gap-1.5 px-1 py-0.5 overflow-hidden">
                <Icon className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{event.title}</span>
            </div>
        );
    };

    const CustomToolbar = (toolbar: ToolbarProps<CalendarEvent>) => {
        const goToBack = () => {
            toolbar.onNavigate('PREV');
            setDate(toolbar.date);
        };

        const goToNext = () => {
            toolbar.onNavigate('NEXT');
            setDate(toolbar.date);
        };

        const goToCurrent = () => {
            toolbar.onNavigate('TODAY');
            setDate(new Date());
        };

        const label = () => {
            const date = toolbar.date;
            return (
                <span className="capitalize font-bold text-xl text-slate-900 dark:text-white font-display tracking-tight">
                    {format(date, view === 'day' ? 'd MMMM yyyy' : 'MMMM yyyy', { locale: fr })}
                </span>
            );
        };

        return (
            <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 p-1 shadow-sm">
                        <button onClick={goToBack} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"><ChevronLeft className="h-5 w-5 text-slate-500" /></button>
                        <button onClick={goToCurrent} className="px-4 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">Aujourd'hui</button>
                        <button onClick={goToNext} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"><ChevronRight className="h-5 w-5 text-slate-500" /></button>
                    </div>
                    {label()}
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            setSelectedDate(new Date());
                            setIsCreateModalOpen(true);
                        }}
                        className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvel Événement
                    </button>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 rounded-xl p-1">
                        <button
                            onClick={() => { setView(Views.MONTH); toolbar.onView('month'); }}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === Views.MONTH ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Mois
                        </button>
                        <button
                            onClick={() => { setView(Views.WEEK); toolbar.onView('week'); }}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === Views.WEEK ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Semaine
                        </button>
                        <button
                            onClick={() => { setView(Views.DAY); toolbar.onView('day'); }}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === Views.DAY ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Jour
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {Object.keys(filters).map(key => (
                    <button
                        key={key}
                        onClick={() => setFilters(prev => ({ ...prev, [key]: !prev[key as keyof typeof filters] }))}
                        className={`
                            px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border flex items-center gap-2
                            ${filters[key as keyof typeof filters]
                                ? key === 'audit' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800'
                                    : key === 'project' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-slate-900/30 dark:text-blue-300 dark:border-blue-800'
                                        : key === 'maintenance' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                                            : key === 'incident' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                                                : key === 'drill' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
                                                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/20'
                                : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-white/5 dark:text-slate-500 dark:border-white/10'
                            }
                        `}
                    >
                        {filters[key as keyof typeof filters] && (
                            key === 'audit' ? <ShieldCheck className="h-3 w-3" /> :
                                key === 'project' ? <Briefcase className="h-3 w-3" /> :
                                    key === 'maintenance' ? <Wrench className="h-3 w-3" /> :
                                        key === 'incident' ? <ShieldAlert className="h-3 w-3" /> :
                                            key === 'drill' ? <Siren className="h-3 w-3" /> :
                                                null
                        )}
                        {key}
                    </button>
                ))}
            </div>

            {/* Calendar */}
            <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden p-6 h-full">
                <DnDCalendar
                    localizer={localizer}
                    events={filteredEvents}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    messages={messages}
                    culture='fr'
                    onSelectEvent={handleSelectEvent}
                    onEventDrop={onEventDrop}
                    onEventResize={onEventResize}
                    resizable
                    eventPropGetter={eventStyleGetter}
                    components={{
                        toolbar: CustomToolbar,
                        event: EventComponent
                    }}
                    view={view}
                    onView={setView}
                    date={date}
                    onNavigate={setDate}
                    popup
                    selectable
                    onSelectSlot={(slotInfo) => {
                        setSelectedDate(slotInfo.start);
                        setIsCreateModalOpen(true);
                    }}
                />
            </div>

            {/* Event Details Drawer */}
            <Drawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title="Détails de l'événement"
                width="max-w-md"
            >
                {selectedEvent && (
                    <div className="p-6 space-y-6">
                        <div className="flex items-start justify-between">
                            <div className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider border ${selectedEvent.color}`}>
                                {selectedEvent.type}
                            </div>
                            <AddToCalendar
                                event={{
                                    title: selectedEvent.title,
                                    description: selectedEvent.description,
                                    location: selectedEvent.location,
                                    start: selectedEvent.start,
                                    end: selectedEvent.end
                                }}
                            />
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{selectedEvent.title}</h3>
                            <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                                <Clock className="h-4 w-4 mr-2" />
                                {format(selectedEvent.start, 'd MMMM yyyy à HH:mm', { locale: fr })}
                                {' - '}
                                {format(selectedEvent.end, 'HH:mm')}
                            </div>
                        </div>

                        {selectedEvent.description && (
                            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-white/5">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Description</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                    {selectedEvent.description}
                                </p>
                            </div>
                        )}

                        {selectedEvent.location && (
                            <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                <span className="font-bold mr-2">Lieu:</span>
                                {selectedEvent.location}
                            </div>
                        )}

                        {selectedEvent.status && (
                            <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                <span className="font-bold mr-2">Statut:</span>
                                <span className="capitalize">{selectedEvent.status}</span>
                            </div>
                        )}
                    </div>
                )}
            </Drawer>

            <CreateEventModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onEventCreated={loadEvents}
                initialDate={selectedDate}
            />
        </div>
    );
};
