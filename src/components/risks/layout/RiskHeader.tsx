
import React from 'react';
import { PageHeader } from '../../ui/PageHeader';
import { useStore } from '../../../store';
import { MasterpieceBackground } from '../../ui/MasterpieceBackground';

interface RiskHeaderProps {
 role: string;
}

export const RiskHeader: React.FC<RiskHeaderProps> = ({ role }) => {
 const { t } = useStore();

 let risksTitle = t('risks.title');
 let risksSubtitle = t('risks.subtitle');
 if (role === 'admin' || role === 'rssi') {
 risksTitle = t('risks.title_admin');
 risksSubtitle = t('risks.subtitle_admin');
 } else if (role === 'direction') {
 risksTitle = t('risks.title_exec');
 risksSubtitle = t('risks.subtitle_exec');
 }

 return (
 <>
 <MasterpieceBackground />
 <PageHeader
 title={risksTitle}
 subtitle={risksSubtitle}
 icon={<img src="/images/pilotage.png" alt="PILOTAGE" className="w-full h-full object-contain" />}
 trustType="integrity"
 />
 </>
 );
};
