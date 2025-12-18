import React from 'react';
import { CalendarDashboard } from '../components/calendar/CalendarDashboard';
import { PageHeader } from '../components/ui/PageHeader';
import { Calendar as CalendarIcon } from 'lucide-react';
import { SEO } from '../components/SEO';
import { motion } from 'framer-motion';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { staggerContainerVariants } from '../components/ui/animationVariants';

export const CalendarView: React.FC = () => {
    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO
                title="Calendrier"
                description="Vue d'ensemble des échéances, audits et maintenances."
                keywords="Calendrier, Planning, Echéances, Audits, Projets"
            />
            <PageHeader
                title="Calendrier"
                subtitle="Vue d'ensemble des échéances, audits et maintenances."
                breadcrumbs={[{ label: 'Calendrier' }]}
                icon={<CalendarIcon className="h-6 w-6 text-white" strokeWidth={2.5} />}
            />
            <div className="flex-1 min-h-0">
                <CalendarDashboard />
            </div>
        </motion.div>
    );
};
