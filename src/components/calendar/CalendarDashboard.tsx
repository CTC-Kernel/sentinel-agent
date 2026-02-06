import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { CreateEventDrawer } from './CreateEventDrawer';
import { generateICS, downloadICS } from '../../utils/calendarUtils';
import { Clock, ChevronLeft, ChevronRight, Plus, ShieldAlert, FileText, Briefcase, Wrench, Siren, ShieldCheck, Filter, MapPin, Download } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { useLocale } from '@/hooks/useLocale';
import { toast } from '@/lib/toast';

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

/** Static icon map - resolved once at module level, not during render */
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  audit: ShieldCheck,
  project: Briefcase,
  maintenance: Wrench,
  incident: ShieldAlert,
  drill: Siren,
};

const typeToIcon = (type: string): React.ComponentType<{ className?: string }> => {
  return iconMap[type] || FileText;
};

const EventComponent = React.memo(({ event }: EventProps<CalendarEvent>) => {
  const Icon = useMemo(() => typeToIcon(event.type), [event.type]);

  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5 overflow-hidden">
      <Icon className="h-3 w-3 flex-shrink-0 opacity-80" />
      <span className="truncate">{event.title}</span>
    </div>
  );
});

EventComponent.displayName = 'EventComponent';

const eventStyleGetter = (event: CalendarEvent) => {
  let className = 'border-none rounded-md shadow-sm font-semibold text-xs transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 focus-visible:ring-primary ';

  if (event.type === 'audit') className += 'bg-purple-600 text-primary-foreground';
  else if (event.type === 'drill') className += 'bg-orange-500 text-primary-foreground';
  else if (event.type === 'project') className += 'bg-blue-600 text-primary-foreground';
  else if (event.type === 'maintenance') className += 'bg-emerald-600 text-primary-foreground';
  else if (event.type === 'incident') className += 'bg-red-600 text-primary-foreground';
  else className += 'bg-muted text-foreground';

  return {
    className,
    style: {
      opacity: 0.95,
      display: 'block',
    }
  };
};

const CustomToolbar = (toolbar: ToolbarProps<CalendarEvent>, { view, setView, setDate, dateFnsLocale, handleExport, isExporting, setIsCreateModalOpen, setSelectedDate }: any) => {
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
      <span className="capitalize font-black text-lg md:text-2xl text-foreground font-display tracking-tight drop-shadow-sm text-center md:text-left">
        {format(date, view === 'day' ? 'd MMMM yyyy' : 'MMMM yyyy', { locale: dateFnsLocale })}
      </span>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row items-center justify-between mb-6 gap-4 animate-fade-in">
      <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
        <div className="flex bg-card/80 backdrop-blur-md rounded-2xl border border-border/40 p-1 shadow-sm w-full md:w-auto justify-between md:justify-start">
          <button aria-label="Mois précédent" onClick={goToBack} className="p-2.5 md:p-3 hover:bg-muted dark:hover:bg-muted rounded-3xl transition-colors text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ChevronLeft className="h-5 w-5" /></button>
          <button aria-label="Aller à aujourd'hui" onClick={goToCurrent} className="px-4 md:px-5 py-2.5 text-xs md:text-sm font-bold text-foreground dark:text-white hover:bg-muted dark:hover:bg-muted rounded-3xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">Aujourd'hui</button>
          <button aria-label="Mois suivant" onClick={goToNext} className="p-2.5 md:p-3 hover:bg-muted dark:hover:bg-muted rounded-3xl transition-colors text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ChevronRight className="h-5 w-5" /></button>
        </div>
        {label()}
      </div>

      <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
        <div className="flex items-center gap-1 bg-card/80 backdrop-blur-md rounded-2xl p-1 border border-border/40 shadow-sm w-full md:w-auto overflow-x-auto no-scrollbar justify-center">
          {[
            { v: Views.MONTH, l: 'Mois' },
            { v: Views.WEEK, l: 'Semaine' },
            { v: Views.DAY, l: 'Jour' }
          ].map(opt => (
            <button
              key={opt.v || 'unknown'}
              aria-label={`Vue ${opt.l}`}
              aria-pressed={view === opt.v}
              onClick={() => { setView(opt.v); toolbar.onView(opt.v as View); }}
              className={`px-4 md:px-5 py-2 rounded-3xl text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${view === opt.v ? 'bg-foreground text-background shadow-lg' : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-muted/50'}`}
            >
              {opt.l}
            </button>
          ))}
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-card/80 backdrop-blur-md border border-border/40 text-muted-foreground p-3 rounded-2xl hover:bg-muted/50 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed"
            title="Exporter le calendrier"
            aria-label="Exporter le calendrier"
          >
            {isExporting ? (
              <div className="h-5 w-5 border-2 border-border/40 border-t-slate-600 rounded-full animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={() => {
              setSelectedDate(new Date());
              setIsCreateModalOpen(true);
            }}
            className="w-full md:w-auto flex-1 flex items-center justify-center px-6 py-3 bg-primary hover:bg-primary text-primary-foreground rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 transition-all hover:scale-105 active:scale-95 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus className="h-5 w-5 mr-2" />
            <span className="md:hidden">Ajouter</span>
            <span className="hidden md:inline">Nouvel Événement</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const CalendarDashboard: React.FC = () => {
  const { user, t } = useStore();
  const { dateFnsLocale } = useLocale();
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
      toast.success(t('calendar.eventUpdated') || 'Événement mis à jour');
    } catch {
      toast.error(t('calendar.eventUpdateFailed') || "Impossible de mettre à jour l'événement");
    }
  };

  const onEventDrop: withDragAndDropProps['onEventDrop'] = async (data) => {
    const { event, start, end } = data;
    const calendarEvent = event as CalendarEvent;
    try {
      await CalendarService.updateEvent(calendarEvent, new Date(start), new Date(end));
      setEvents(prev => prev.map(e => e.id === calendarEvent.id ? { ...e, start: new Date(start), end: new Date(end) } : e));
      toast.success(t('calendar.eventMoved') || 'Événement déplacé');
    } catch {
      toast.error(t('calendar.eventMoveFailed') || "Impossible de déplacer l'événement");
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
      toast.success(t('calendar.exported') || 'Calendrier exporté');
    } catch (error) {
      ErrorLogger.error(error, "CalendarExport");
      toast.error(t('calendar.exportFailed') || "Erreur lors de l'export");
    } finally {
      setIsExporting(false);
    }
  }, [organizationId, t]);

  return (
    <div className="flex flex-col space-y-6 md:h-full">
      {/* Filters - Scrollable on mobile */}
      <div className="relative z-20 flex flex-nowrap md:flex-wrap items-center gap-3 p-1 overflow-x-auto no-scrollbar mask-gradient-right pb-4 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground shrink-0">
          <Filter className="h-4 w-4" />
        </div>
        {Object.keys(filters).map(key => (
          <button
            key={key || 'unknown'}
            aria-label={`Filtrer par ${key}`}
            aria-pressed={filters[key as keyof typeof filters]}
            onClick={() => setFilters(prev => ({ ...prev, [key]: !prev[key as keyof typeof filters] }))}
            className={`
              px-4 py-2 rounded-3xl text-xs font-bold uppercase tracking-wider transition-all duration-300 border flex items-center gap-2 shadow-sm shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
              ${filters[key as keyof typeof filters]
                ? key === 'audit' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20 shadow-purple-500/10'
                  : key === 'project' ? 'bg-blue-100 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-500/20 shadow-blue-500/10'
                    : key === 'maintenance' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20 shadow-emerald-500/10'
                      : key === 'incident' ? 'bg-red-100 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 dark:bg-red-50 dark:text-red-300 dark:border-red-500/20 shadow-red-500/10'
                        : key === 'drill' ? 'bg-orange-100 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20 shadow-orange-500/10'
                          : 'bg-muted text-foreground border-border/40 '
                : 'bg-transparent text-muted-foreground border-border/40 dark:border-white/5 grayscale opacity-60 hover:opacity-70 hover:grayscale-0'
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
      <div className="flex-1 relative overflow-hidden glass-premium p-4 md:p-8 h-[85vh] min-h-[600px] group isolation-auto rounded-3xl border border-border/40">
        {/* Subtle premium background effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 dark:bg-primary/60/15 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/20 dark:bg-indigo-400/15 rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>

        <div className="relative z-decorator h-full">
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
              toolbar: (props) => CustomToolbar(props, { view, setView, setDate, dateFnsLocale, handleExport, isExporting, setIsCreateModalOpen, setSelectedDate }),
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
          <div className="p-8 space-y-6 sm:space-y-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider border shadow-sm ${selectedEvent.type === 'audit' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20' :
                  selectedEvent.type === 'project' ? 'bg-blue-50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-500/20' :
                    selectedEvent.type === 'maintenance' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20' :
                      selectedEvent.type === 'incident' ? 'bg-red-50 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 dark:bg-red-50 dark:text-red-300 dark:border-red-500/20' :
                        'bg-muted text-foreground border-border/40 '
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

              <h3 className="text-2xl font-black text-foreground font-display leading-tight">{selectedEvent.title}</h3>
            </div>

            <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground bg-muted/50 dark:bg-white/5 p-4 rounded-3xl border border-border/40 dark:border-white/5">
              <Clock className="h-5 w-5 text-indigo-500" />
              <div className="flex flex-col">
                <span className="text-foreground font-bold">{format(selectedEvent.start, 'd MMMM yyyy', { locale: dateFnsLocale })}</span>
                <span className="opacity-70">{format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')}</span>
              </div>
            </div>

            {selectedEvent.description && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  <FileText className="h-4 w-4" /> Description
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed pl-6">
                  {selectedEvent.description}
                </p>
              </div>
            )}

            {selectedEvent.location && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  <MapPin className="h-4 w-4" /> Lieu
                </div>
                <p className="text-sm text-muted-foreground pl-6 font-medium">
                  {selectedEvent.location}
                </p>
              </div>
            )}

            {selectedEvent.status && (
              <div className="pt-4 border-t border-border/40 dark:border-white/5">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-muted dark:bg-white/10 text-muted-foreground">
                  <div className={`w-2 h-2 rounded-full ${selectedEvent.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'}`} />
                  {selectedEvent.status}
                </span>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <CreateEventDrawer
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onEventCreated={loadEvents}
        initialDate={selectedDate}
      />
    </div>
  );
};

// Headless UI handles FocusTrap and keyboard navigation
