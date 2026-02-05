import React from 'react';
import { useTranslation } from 'react-i18next';

import { CalendarDashboard } from '../components/calendar/CalendarDashboard';
import { PageHeader } from '../components/ui/PageHeader';
import { SEO } from '../components/SEO';
import { motion } from 'framer-motion';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { staggerContainerVariants } from '../components/ui/animationVariants';

export const CalendarView: React.FC = () => {
 const { t } = useTranslation();

 return (
 <motion.div
 variants={staggerContainerVariants}
 initial="initial"
 animate="visible"
 className="flex flex-col gap-8"
 >
 <MasterpieceBackground />
 <SEO
 title={t('calendar.title')}
 description={t('calendar.subtitle')}
 keywords={t('calendar.keywords')}
 />
 <PageHeader
 title={t('calendar.title')}
 subtitle={t('calendar.subtitle')}
 icon={
  <img
  src="/images/pilotage.png"
  alt="PILOTAGE"
  className="w-full h-full object-contain"
  />
 }
 />
 <div className="flex-1 min-h-0">
 <CalendarDashboard />
 </div>
 </motion.div>
 );
};
