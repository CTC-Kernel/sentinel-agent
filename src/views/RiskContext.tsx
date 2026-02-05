/**
 * Risk Context View (ISO 27005)
 * Main view for managing organizational risk context
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/ui/PageHeader';
import { RiskContextManager } from '../components/risks/context/RiskContextManager';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';

export const RiskContextView: React.FC = () => {
 const { t } = useTranslation();

 return (
 <div className="min-h-screen">
 <MasterpieceBackground />
 <SEO
 title={t('riskContext.title')}
 description={t('riskContext.subtitle')}
 keywords={t('riskContext.keywords')}
 />
 <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
 <PageHeader
 title={t('riskContext.title')}
 subtitle={t('riskContext.subtitle')}
 icon={
 <img
 src="/images/gouvernance.png"
 alt="Context"
 className="w-full h-full object-contain"
 />
 }
 />
 <RiskContextManager />
 </div>
 </div>
 );
};

export default RiskContextView;
