import React from 'react';
import { Badge } from './Badge';

interface RoleBadgeProps {
    role: string;
    className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => {
    switch (role) {
        case 'admin':
            return <Badge status="brand" className={className}>Admin</Badge>;
        case 'rssi':
            return <Badge status="error" className={className}>RSSI</Badge>;
        case 'auditor':
            return <Badge status="info" className={className}>Auditeur</Badge>;
        case 'project_manager':
            return <Badge status="warning" className={className}>Chef Projet</Badge>;
        case 'direction':
            return <Badge status="success" className={className}>Direction</Badge>;
        default:
            return <Badge status="neutral" className={className}>Utilisateur</Badge>;
    }
};
