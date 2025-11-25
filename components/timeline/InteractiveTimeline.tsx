import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timeline } from 'vis-timeline/standalone';
import { DataSet } from 'vis-data';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Risk, Project, Audit, Document, Incident } from '../../types';
import {
    Download,
    ShieldAlert,
    FileText,
    Siren,
    Activity,
    FolderKanban
} from '../ui/Icons';

interface TimelineEvent {
    id: string;
    content: string;
    start: Date;
    end?: Date;
    type: 'incident' | 'audit' | 'project' | 'risk' | 'document';
    className: string;
    title: string;
    metadata: any;
}

export const InteractiveTimeline: React.FC = () => {
    const { user } = useStore();
    const navigate = useNavigate();
    const timelineRef = useRef<HTMLDivElement>(null);
    const timelineInstance = useRef<Timeline | null>(null);

    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [filters, setFilters] = useState({
        incidents: true,
        audits: true,
        projects: true,
        risks: true,
        documents: true
    });
    const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month' | 'year'>('month');

    // Fetch all events
    useEffect(() => {
        if (!user?.organizationId) return;

        const fetchEvents = async () => {
            setLoading(true);
            const orgId = user.organizationId;
            const allEvents: TimelineEvent[] = [];

            try {
                // Fetch Incidents
                const incidentsSnap = await getDocs(
                    query(collection(db, 'incidents'), where('organizationId', '==', orgId))
                );
                incidentsSnap.forEach(doc => {
                    const data = doc.data() as Incident;
                    if (data.dateReported) {
                        allEvents.push({
                            id: `incident-${doc.id}`,
                            content: `🚨 ${data.title}`,
                            start: new Date(data.dateReported),
                            type: 'incident',
                            className: 'timeline-incident',
                            title: `Incident: ${data.title} (${data.severity})`,
                            metadata: { ...data, docId: doc.id }
                        });
                    }
                });

                // Fetch Audits
                const auditsSnap = await getDocs(
                    query(collection(db, 'audits'), where('organizationId', '==', orgId))
                );
                auditsSnap.forEach(doc => {
                    const data = doc.data() as Audit;
                    if (data.dateScheduled) {
                        allEvents.push({
                            id: `audit-${doc.id}`,
                            content: `📋 ${data.name}`,
                            start: new Date(data.dateScheduled),
                            type: 'audit',
                            className: 'timeline-audit',
                            title: `Audit: ${data.name} (${data.type})`,
                            metadata: { ...data, docId: doc.id }
                        });
                    }
                });

                // Fetch Projects
                const projectsSnap = await getDocs(
                    query(collection(db, 'projects'), where('organizationId', '==', orgId))
                );
                projectsSnap.forEach(doc => {
                    const data = doc.data() as Project;
                    const startDate = (data as any).startDate;
                    const endDate = (data as any).endDate;

                    if (startDate) {
                        allEvents.push({
                            id: `project-${doc.id}`,
                            content: `📁 ${data.name}`,
                            start: new Date(startDate),
                            end: endDate ? new Date(endDate) : undefined,
                            type: 'project',
                            className: 'timeline-project',
                            title: `Projet: ${data.name} (${data.status})`,
                            metadata: { ...data, docId: doc.id }
                        });
                    }
                });

                // Fetch Risks
                const risksSnap = await getDocs(
                    query(collection(db, 'risks'), where('organizationId', '==', orgId))
                );
                risksSnap.forEach(doc => {
                    const data = doc.data() as Risk;
                    if (data.createdAt) {
                        allEvents.push({
                            id: `risk-${doc.id}`,
                            content: `⚠️ ${data.threat}`,
                            start: new Date(data.createdAt),
                            type: 'risk',
                            className: 'timeline-risk',
                            title: `Risque: ${data.threat} (Score: ${data.score})`,
                            metadata: { ...data, docId: doc.id }
                        });
                    }
                });

                // Fetch Documents
                const docsSnap = await getDocs(
                    query(collection(db, 'documents'), where('organizationId', '==', orgId))
                );
                docsSnap.forEach(doc => {
                    const data = doc.data() as Document;
                    if ((data as any).publishedDate) {
                        allEvents.push({
                            id: `document-${doc.id}`,
                            content: `📄 ${data.title}`,
                            start: new Date((data as any).publishedDate),
                            type: 'document',
                            className: 'timeline-document',
                            title: `Document: ${data.title} (v${data.version})`,
                            metadata: { ...data, docId: doc.id }
                        });
                    }
                });

                setEvents(allEvents);
            } catch (error) {
                console.error('Error fetching timeline events:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, [user]);

    // Filter events based on selected filters
    const filteredEvents = useMemo(() => {
        return events.filter(event => filters[event.type + 's' as keyof typeof filters] !== false);
    }, [events, filters]);

    // Initialize timeline
    useEffect(() => {
        if (!timelineRef.current || filteredEvents.length === 0) return;

        const items = new DataSet(filteredEvents.map(event => ({
            id: event.id,
            content: event.content,
            start: event.start,
            end: event.end,
            className: event.className,
            title: event.title
        })));

        const options = {
            width: '100%',
            height: '500px',
            margin: { item: 20 },
            orientation: 'top',
            zoomMin: 1000 * 60 * 60 * 24, // 1 day
            zoomMax: 1000 * 60 * 60 * 24 * 365 * 2, // 2 years
            selectable: true,
            multiselect: false,
            onMove: () => false, // Disable item dragging
            locale: 'fr'
        };

        if (timelineInstance.current) {
            timelineInstance.current.destroy();
        }

        const timeline = new Timeline(timelineRef.current, items, options);

        // Handle item selection
        timeline.on('select', (properties) => {
            if (properties.items.length > 0) {
                const eventId = properties.items[0];
                const event = filteredEvents.find(e => e.id === eventId);
                if (event) {
                    handleEventClick(event);
                }
            }
        });

        timelineInstance.current = timeline;

        // Set initial zoom based on zoom level
        applyZoom(zoomLevel);

        return () => {
            if (timelineInstance.current) {
                timelineInstance.current.destroy();
            }
        };
    }, [filteredEvents]);

    const handleEventClick = (event: TimelineEvent) => {
        const routes: Record<string, string> = {
            incident: '/incidents',
            audit: '/audits',
            project: '/projects',
            risk: '/risks',
            document: '/documents'
        };

        navigate(`${routes[event.type]}?id=${event.metadata.docId}`);
    };

    const applyZoom = (level: 'day' | 'week' | 'month' | 'year') => {
        if (!timelineInstance.current) return;

        const now = new Date();
        let start: Date, end: Date;

        switch (level) {
            case 'day':
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                break;
            case 'week':
                start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
                break;
            case 'year':
                start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                end = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
                break;
        }

        timelineInstance.current.setWindow(start, end);
        setZoomLevel(level);
    };

    const handleExportPNG = async () => {
        if (!timelineRef.current) return;

        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(timelineRef.current);
            const image = canvas.toDataURL('image/png');

            const link = document.createElement('a');
            link.href = image;
            link.download = `timeline-export-${new Date().toISOString().split('T')[0]}.png`;
            link.click();
        } catch (error) {
            console.error('Error exporting timeline:', error);
            alert('Erreur lors de l\'exportation de la timeline');
        }
    };

    const toggleFilter = (type: keyof typeof filters) => {
        setFilters(prev => ({ ...prev, [type]: !prev[type] }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Timeline Interactive
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Vue chronologique de tous les événements SSI
                    </p>
                </div>

                <button
                    onClick={handleExportPNG}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:scale-105 transition-transform"
                >
                    <Download className="h-4 w-4" />
                    Exporter PNG
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={() => toggleFilter('incidents')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${filters.incidents
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                        }`}
                >
                    <Siren className="h-4 w-4" />
                    Incidents ({events.filter(e => e.type === 'incident').length})
                </button>

                <button
                    onClick={() => toggleFilter('audits')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${filters.audits
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                        }`}
                >
                    <Activity className="h-4 w-4" />
                    Audits ({events.filter(e => e.type === 'audit').length})
                </button>

                <button
                    onClick={() => toggleFilter('projects')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${filters.projects
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                        }`}
                >
                    <FolderKanban className="h-4 w-4" />
                    Projets ({events.filter(e => e.type === 'project').length})
                </button>

                <button
                    onClick={() => toggleFilter('risks')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${filters.risks
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                        }`}
                >
                    <ShieldAlert className="h-4 w-4" />
                    Risques ({events.filter(e => e.type === 'risk').length})
                </button>

                <button
                    onClick={() => toggleFilter('documents')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${filters.documents
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                        }`}
                >
                    <FileText className="h-4 w-4" />
                    Documents ({events.filter(e => e.type === 'document').length})
                </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex gap-2">
                {(['day', 'week', 'month', 'year'] as const).map((level) => (
                    <button
                        key={level}
                        onClick={() => applyZoom(level)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${zoomLevel === level
                            ? 'bg-brand-600 text-white'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                    >
                        {level === 'day' ? 'Jour' : level === 'week' ? 'Semaine' : level === 'month' ? 'Mois' : 'Année'}
                    </button>
                ))}
            </div>

            {/* Timeline */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                <div ref={timelineRef} className="timeline-container" />
            </div>

            {/* Legend */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-bold uppercase tracking-wider">
                    Légende
                </p>
                <div className="flex flex-wrap gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-red-500"></div>
                        <span className="text-slate-600 dark:text-slate-400">Incidents</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-blue-500"></div>
                        <span className="text-slate-600 dark:text-slate-400">Audits</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-purple-500"></div>
                        <span className="text-slate-600 dark:text-slate-400">Projets</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-orange-500"></div>
                        <span className="text-slate-600 dark:text-slate-400">Risques</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-green-500"></div>
                        <span className="text-slate-600 dark:text-slate-400">Documents</span>
                    </div>
                </div>
            </div>

            {/* Custom CSS for timeline */}
            <style>{`
        .timeline-incident .vis-item {
          background-color: #ef4444;
          border-color: #dc2626;
          color: white;
        }
        .timeline-audit .vis-item {
          background-color: #3b82f6;
          border-color: #2563eb;
          color: white;
        }
        .timeline-project .vis-item {
          background-color: #a855f7;
          border-color: #9333ea;
          color: white;
        }
        .timeline-risk .vis-item {
          background-color: #f97316;
          border-color: #ea580c;
          color: white;
        }
        .timeline-document .vis-item {
          background-color: #10b981;
          border-color: #059669;
          color: white;
        }
        .vis-item {
          border-radius: 8px;
          font-weight: 600;
          font-size: 12px;
        }
        .vis-item.vis-selected {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
        }
      `}</style>
        </div>
    );
};
