import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from './Badge';

interface RoleBadgeProps {
 role: string;
 className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => {
 const { t } = useTranslation();
 switch (role) {
 case 'admin':
 return <Badge status="brand" className={className}>{t('common.settings.roles.admin')}</Badge>;
 case 'rssi':
 return <Badge status="error" className={className}>{t('common.settings.roles.rssi')}</Badge>;
 case 'auditor':
 return <Badge status="info" className={className}>{t('common.settings.roles.auditor')}</Badge>;
 case 'project_manager':
 return <Badge status="warning" className={className}>{t('common.settings.roles.project_manager')}</Badge>;
 case 'direction':
 return <Badge status="success" className={className}>{t('common.settings.roles.direction')}</Badge>;
 default:
 return <Badge status="neutral" className={className}>{t('common.settings.roles.user')}</Badge>;
 }
};
