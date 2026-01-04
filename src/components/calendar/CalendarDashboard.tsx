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
import { generateICS, downloadICS } from '../../utils/calendarUtils';
import { Clock, ChevronLeft, ChevronRight, Plus, ShieldAlert, FileText, Briefcase, Wrench, Siren, ShieldCheck, Filter, MapPin, Download } from 'lucide-react';
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
    const [isExporting, setIsExporting] = useState(false);

    // Mobile specific: Switch to Day view by default on small screens
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setView(Views.DAY);
            } else {
                setView(Views.MONTH);
            }
        };

        // Initial check
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const organizationId = user?.organizationId;

    const loadEvents = useCallback(async () => {
        if (organizationId) {
            try {
                // 1. Fetch Internal Events
                const internalEvents = await CalendarService.fetchAllEvents(organizationId);

                // 2. Fetch Google Events (if connected)
                let googleEvents: CalendarEvent[] = [];
                const googleToken = sessionStorage.getItem('google_access_token');
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
    }, [organizationId, filters.google]);

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
        } catch {
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
        } catch {
            toast.error("Impossible de déplacer l'événement");
        }
    };

    const handleExport = useCallback(async () => {
        if (!organizationId) return;
        setIsExporting(true);
        try {
            const allEvents = await CalendarService.fetchAllEvents(organizationId);
            const mappedEvents = allEvents.map(e => ({
                title: e.title,
                description: e.description,
                startTime: e.start,
                endTime: e.end,
                location: e.location
            }));
            const icsContent = generateICS(mappedEvents);
            downloadICS('sentinel_calendar_export.ics', icsContent);
            toast.success('Calendrier exporté');
        } catch (error) {
            ErrorLogger.error(error, "CalendarExport");
            toast.error("Erreur lors de l'export");
        } finally {
            setIsExporting(false);
        }
    }, [organizationId]);

    const eventStyleGetter = (event: CalendarEvent) => {
        let className = 'border-none rounded-md shadow-sm font-semibold text-xs transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 ';

        if (event.type === 'audit') className += 'bg-purple-600 text-white';
        else if (event.type === 'drill') className += 'bg-orange-500 text-white';
        else if (event.type === 'project') className += 'bg-blue-600 text-white';
        else if (event.type === 'maintenance') className += 'bg-emerald-600 text-white';
        else if (event.type === 'incident') className += 'bg-red-600 text-white';
        else className += 'bg-slate-600 text-white';

        return {
            className,
            style: {
                opacity: 0.95,
                display: 'block',
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
                                typeToIcon(event.type) || FileText;

        return (
            <div className="flex items-center gap-1.5 px-1 py-0.5 overflow-hidden">
                <Icon className="h-3 w-3 flex-shrink-0 opacity-80" />
                <span className="truncate">{event.title}</span>
            </div>
        );
    };

    const typeToIcon = (type: string) => {
        switch (type) {
            case 'audit': return ShieldCheck;
            case 'project': return Briefcase;
            case 'maintenance': return Wrench;
            case 'incident': return ShieldAlert;
            case 'drill': return Siren;
            default: return FileText;
        }
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
                <span className="capitalize font-black text-lg md:text-2xl text-slate-900 dark:text-white font-display tracking-tight drop-shadow-sm text-center md:text-left">
                    {format(date, view === 'day' ? 'd MMMM yyyy' : 'MMMM yyyy', { locale: fr })}
                </span>
            );
        };

        return (
            <div className="flex flex-col xl:flex-row items-center justify-between mb-6 gap-4 animate-fade-in">
                <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                    <div className="flex bg-white/80 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-white/10 p-1 shadow-sm w-full md:w-auto justify-between md:justify-start">
                        <button aria-label="Mois précédent" onClick={goToBack} className="p-2 md:p-2.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-600 dark:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><ChevronLeft className="h-5 w-5" /></button>
                        <button aria-label="Aller à aujourd'hui" onClick={goToCurrent} className="px-3 md:px-5 text-xs md:text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Aujourd'hui</button>
                        <button aria-label="Mois suivant" onClick={goToNext} className="p-2 md:p-2.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-600 dark:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><ChevronRight className="h-5 w-5" /></button>
                    </div>
                    {label()}
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                    <div className="flex items-center gap-1 bg-white/80 dark:bg-white/5 backdrop-blur-md rounded-2xl p-1 border border-slate-200/60 dark:border-white/10 shadow-sm w-full md:w-auto overflow-x-auto no-scrollbar justify-center">
                        {[
                            { v: Views.MONTH, l: 'Mois' },
                            { v: Views.WEEK, l: 'Semaine' },
                            { v: Views.DAY, l: 'Jour' }
                        ].map(opt => (
                            <button
                                key={opt.v}
                                aria-label={`Vue ${opt.l}`}
                                aria-pressed={view === opt.v}
                                onClick={() => { setView(opt.v); toolbar.onView(opt.v); }}
                                className={`px-4 md:px-5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${view === opt.v ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' : 'text-slate-600 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'}`}
                            >
                                {opt.l}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="bg-white/80 dark:bg-white/5 backdrop-blur-md border border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-slate-300 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Exporter le calendrier"
                            aria-label="Exporter le calendrier"
                        >
                            {isExporting ? (
                                <div className="h-5 w-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                            ) : (
                                <Download className="h-5 w-5" />
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setSelectedDate(new Date());
                                setIsCreateModalOpen(true);
                            }}
                            className="w-full md:w-auto flex-1 flex items-center justify-center px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-brand-500/25 transition-all hover:scale-105 active:scale-95 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            <span className="md:hidden">Ajouter</span>
                            <span className="hidden md:inline">Nouvel Événement</span>
                        </button>
                    </div>
                </div>
            </div >
        );
    };

    return (
        <div className="flex flex-col space-y-6 md:h-full">
            {/* Filters - Scrollable on mobile */}
            <div className="relative z-20 flex flex-nowrap md:flex-wrap items-center gap-3 p-1 overflow-x-auto no-scrollbar mask-gradient-right pb-4 shrink-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 shrink-0">
                    <Filter className="h-4 w-4" />
                </div>
                {Object.keys(filters).map(key => (
                    <button
                        key={key}
                        aria-label={`Filtrer par ${key}`}
                        aria-pressed={filters[key as keyof typeof filters]}
                        onClick={() => setFilters(prev => ({ ...prev, [key]: !prev[key as keyof typeof filters] }))}
                        className={`
                            px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 border flex items-center gap-2 shadow-sm shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                            ${filters[key as keyof typeof filters]
                                ? key === 'audit' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20 shadow-purple-500/10'
                                    : key === 'project' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20 shadow-blue-500/10'
                                        : key === 'maintenance' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20 shadow-emerald-500/10'
                                            : key === 'incident' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20 shadow-red-500/10'
                                                : key === 'drill' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20 shadow-orange-500/10'
                                                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                : 'bg-transparent text-slate-500 border-slate-200 dark:text-slate-600 dark:border-white/5 grayscale opacity-60 hover:opacity-100 hover:grayscale-0'
                            }
                        `}
                    >
                        {filters[key as keyof typeof filters] && (
                            <span className="mr-0.5">
                                {key === 'audit' ? <ShieldCheck className="h-3.5 w-3.5" /> :
                                    key === 'project' ? <Briefcase className="h-3.5 w-3.5" /> :
                                        key === 'maintenance' ? <Wrench className="h-3.5 w-3.5" /> :
                                            key === 'incident' ? <ShieldAlert className="h-3.5 w-3.5" /> :
                                                key === 'drill' ? <Siren className="h-3.5 w-3.5" /> :
                                                    null}
                            </span>
                        )}
                        {key === 'google' ? 'Google' : key}
                    </button>
                ))}
            </div>

            {/* Calendar */}
            <div className="flex-1 relative overflow-hidden glass-panel p-4 md:p-8 h-[85vh] min-h-[600px] group isolation-auto">
                {/* Subtle premium background effects */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/5 dark:bg-brand-400/5 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 dark:bg-indigo-400/5 rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>

                <div className="relative z-10 h-full">
                    <DnDCalendar
                        localizer={localizer}
                        events={filteredEvents}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: '100%', fontFamily: 'inherit' }}
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
                        className="premium-calendar"
                    />
                </div>
            </div>

            <Drawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title="Détails"
                width="max-w-6xl"
            >
                {selectedEvent && (
                    <div className="p-8 space-y-8">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider border shadow-sm ${selectedEvent.type === 'audit' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20' :
                                    selectedEvent.type === 'project' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20' :
                                        selectedEvent.type === 'maintenance' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20' :
                                            selectedEvent.type === 'incident' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20' :
                                                'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                    }`}>
                                    {selectedEvent.type}
                                </span>
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

                            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-display leading-tight">{selectedEvent.title}</h3>
                        </div>

                        <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                            <Clock className="h-5 w-5 text-indigo-500" />
                            <div className="flex flex-col">
                                <span className="text-slate-900 dark:text-white font-bold">{format(selectedEvent.start, 'd MMMM yyyy', { locale: fr })}</span>
                                <span className="opacity-70">{format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')}</span>
                            </div>
                        </div>

                        {selectedEvent.description && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    <FileText className="h-4 w-4" /> Description
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed pl-6">
                                    {selectedEvent.description}
                                </p>
                            </div>
                        )}

                        {selectedEvent.location && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    <MapPin className="h-4 w-4" /> Lieu
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 pl-6 font-medium">
                                    {selectedEvent.location}
                                </p>
                            </div>
                        )}

                        {selectedEvent.status && (
                            <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                    <div className={`w-2 h-2 rounded-full ${selectedEvent.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'}`} />
                                    {selectedEvent.status}
                                </span>
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

// Headless UI handles FocusTrap and keyboard navigation
