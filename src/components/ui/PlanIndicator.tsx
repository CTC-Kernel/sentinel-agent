import React from 'react';
import { Crown, Star, Building2 } from 'lucide-react';
import { useStore } from '../../store';
import { PlanType } from '../../types';

interface PlanIndicatorProps {
    className?: string;
}

export const PlanIndicator: React.FC<PlanIndicatorProps> = ({ className = '' }) => {
    const { organization, t } = useStore();
    
    if (!organization?.subscription) {
        return null;
    }

    const plan = organization.subscription.planId;
    const status = organization.subscription.status;

    const getPlanInfo = (planType: PlanType) => {
        switch (planType) {
            case 'discovery':
                return {
                    name: t('settings.plans.discovery'),
                    icon: Star,
                    color: 'text-gray-600 dark:text-gray-400',
                    bgColor: 'bg-gray-100 dark:bg-gray-800/50',
                    borderColor: 'border-gray-200 dark:border-gray-700'
                };
            case 'professional':
                return {
                    name: t('settings.plans.professional'),
                    icon: Crown,
                    color: 'text-blue-600 dark:text-blue-400',
                    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
                    borderColor: 'border-blue-200 dark:border-blue-800'
                };
            case 'enterprise':
                return {
                    name: t('settings.plans.enterprise'),
                    icon: Building2,
                    color: 'text-purple-600 dark:text-purple-400',
                    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
                    borderColor: 'border-purple-200 dark:border-purple-800'
                };
            default:
                return {
                    name: 'Inconnu',
                    icon: Star,
                    color: 'text-gray-600 dark:text-gray-400',
                    bgColor: 'bg-gray-100 dark:bg-gray-800/50',
                    borderColor: 'border-gray-200 dark:border-gray-700'
                };
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'active':
                return {
                    text: t('common.active'),
                    color: 'text-green-600 dark:text-green-400'
                };
            case 'trialing':
                return {
                    text: 'Essai',
                    color: 'text-yellow-600 dark:text-yellow-400'
                };
            case 'past_due':
                return {
                    text: 'En retard',
                    color: 'text-red-600 dark:text-red-400'
                };
            case 'canceled':
                return {
                    text: 'Annulé',
                    color: 'text-gray-600 dark:text-gray-400'
                };
            default:
                return {
                    text: status,
                    color: 'text-gray-600 dark:text-gray-400'
                };
        }
    };

    const planInfo = getPlanInfo(plan);
    const statusInfo = getStatusInfo(status);
    const Icon = planInfo.icon;

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${planInfo.bgColor} ${planInfo.borderColor} ${className}`}>
            <Icon className={`w-4 h-4 ${planInfo.color}`} />
            <div className="flex flex-col items-start">
                <span className={`text-xs font-bold ${planInfo.color}`}>
                    {planInfo.name}
                </span>
                {status !== 'active' && (
                    <span className={`text-[10px] font-medium ${statusInfo.color}`}>
                        {statusInfo.text}
                    </span>
                )}
            </div>
        </div>
    );
};
