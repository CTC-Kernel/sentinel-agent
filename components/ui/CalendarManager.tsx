import React, { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { useStore } from '../../store';
import { Audit, Project, Asset, BcpDrill } from '../../types';
import { AddToCalendar } from './AddToCalendar';
import { Drawer } from './Drawer';

interface CalendarItem {
    id: string;
    title: string;
    date: Date;
    type: 'audit' | 'drill' | 'project' | 'maintenance';
    color: string;
    description?: string;
    location?: string;
}

export const CalendarManager: React.FC = () => {
    const { user } = useStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedEvents, setSelectedEvents] = useState<CalendarItem[]>([]);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Data Fetching
    const { data: audits } = useFirestoreCollection<Audit>('audits', [], { enabled: !!user?.organizationId });
    const { data: drills } = useFirestoreCollection<BcpDrill>('bcp_drills', [], { enabled: !!user?.organizationId });
    const { data: projects } = useFirestoreCollection<Project>('projects', [], { enabled: !!user?.organizationId });
    const { data: assets } = useFirestoreCollection<Asset>('assets', [], { enabled: !!user?.organizationId });

    // Process Events
    const events = useMemo(() => {
        const items: CalendarItem[] = [];

        audits.forEach(a => {
            if (a.dateScheduled) {
                items.push({
                    id: a.id,
                    title: `Audit: ${a.name}`,
                    date: parseISO(a.dateScheduled),
                    type: 'audit',
                    color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
                    description: `Audit ${a.type} - ${a.scope || ''}`,
                    location: 'Sur site / Distanciel'
                });
            }
        });

        drills.forEach(d => {
            if (d.date) {
                items.push({
                    id: d.id,
                    title: `Exercice BCP: ${d.type}`,
                    date: parseISO(d.date),
                    type: 'drill',
                    color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
                    description: `Résultat: ${d.result}`,
                    location: 'Interne'
                });
            }
        });

        projects.forEach(p => {
            if (p.dueDate) {
                items.push({
                    id: p.id,
                    title: `Deadline Projet: ${p.name}`,
                    date: parseISO(p.dueDate),
                    type: 'project',
                    color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
                    description: `Statut: ${p.status}`,
                    location: 'Gestion de projet'
                });
            }
        });

        assets.forEach(a => {
            if (a.nextMaintenance) {
                items.push({
                    id: a.id,
                    title: `Maintenance: ${a.name}`,
                    date: parseISO(a.nextMaintenance),
                    type: 'maintenance',
                    color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
                    description: `Type: ${a.type}`,
                    location: a.location
                });
            }
        });

        return items;
    }, [audits, drills, projects, assets]);

    // Calendar Grid Logic
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const handleDateClick = (day: Date) => {
        const dayEvents = events.filter(e => isSameDay(e.date, day));
        if (dayEvents.length > 0) {
            setSelectedDate(day);
            setSelectedEvents(dayEvents);
            setIsDrawerOpen(true);
        }
    };

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: fr })}
                    </h2>
                    <div className="flex bg-white dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 p-1">
                        <button onClick={prevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md transition-colors"><ChevronLeft className="h-5 w-5 text-slate-500" /></button>
                        <button onClick={goToToday} className="px-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md transition-colors">Aujourd'hui</button>
                        <button onClick={nextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md transition-colors"><ChevronRight className="h-5 w-5 text-slate-500" /></button>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
                {/* Weekdays */}
                <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                        <div key={day} className="py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days */}
                <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6">
                    {calendarDays.map((day) => {
                        const dayEvents = events.filter(e => isSameDay(e.date, day));
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div
                                key={day.toString()}
                                onClick={() => handleDateClick(day)}
                                className={`
                                    min-h-[100px] p-2 border-b border-r border-slate-100 dark:border-white/5 transition-colors relative group
                                    ${!isCurrentMonth ? 'bg-slate-50/50 dark:bg-black/20 text-slate-400' : 'bg-white dark:bg-transparent'}
                                    ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}
                                    hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer
                                `}
                            >
                                <div className={`text-sm font-medium mb-1 ${isToday ? 'text-brand-600 dark:text-brand-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {format(day, 'd')}
                                </div>
                                <div className="space-y-1">
                                    {dayEvents.slice(0, 3).map(event => (
                                        <div key={event.id} className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium border ${event.color}`}>
                                            {event.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <div className="text-[10px] text-slate-400 pl-1">
                                            + {dayEvents.length - 3} autres
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Event Details Drawer */}
            <Drawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                title={`Événements du ${selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: fr }) : ''}`}
                width="max-w-md"
            >
                <div className="p-6 space-y-4">
                    {selectedEvents.map(event => (
                        <div key={event.id} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                                <div className={`text-xs font-bold px-2 py-1 rounded-lg uppercase tracking-wider border ${event.color.split(' ')[0]} ${event.color.split(' ')[1]} ${event.color.split(' ')[2]}`}>
                                    {event.type}
                                </div>
                                <AddToCalendar
                                    event={{
                                        title: event.title,
                                        description: event.description,
                                        location: event.location,
                                        startTime: event.date,
                                        endTime: new Date(event.date.getTime() + 60 * 60 * 1000) // Default 1h duration
                                    }}
                                />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{event.title}</h3>
                            {event.description && <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{event.description}</p>}
                            <div className="flex items-center text-xs text-slate-400">
                                <Clock className="h-3 w-3 mr-1" />
                                {format(event.date, 'HH:mm')}
                                {event.location && (
                                    <>
                                        <span className="mx-2">•</span>
                                        <span>{event.location}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {selectedEvents.length === 0 && (
                        <div className="text-center py-10 text-slate-500">
                            Aucun événement pour ce jour.
                        </div>
                    )}
                </div>
            </Drawer>
        </div>
    );
};
