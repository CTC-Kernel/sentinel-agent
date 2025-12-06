import React from 'react';
import { CalendarDashboard } from '../components/calendar/CalendarDashboard';
import { PageHeader } from '../components/ui/PageHeader';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export const CalendarView: React.FC = () => {
    return (
        <div className="space-y-8 animate-fade-in flex flex-col lg:h-full">
            <Helmet>
                <title>Calendrier - Sentinel GRC</title>
            </Helmet>
            <PageHeader
                title="Calendrier"
                subtitle="Vue d'ensemble des échéances, audits et maintenances."
                breadcrumbs={[{ label: 'Calendrier' }]}
                icon={<CalendarIcon className="h-6 w-6 text-white" />}
            />
            <div className="flex-1 min-h-0">
                <CalendarDashboard />
            </div>
        </div>
    );
};
