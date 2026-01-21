/**
 * ICT Provider Drawer
 * DORA Art. 28 - Story 35.1
 * Slide-over panel for creating/editing ICT Providers
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { Drawer } from '../ui/Drawer';
import { ICTProviderForm } from './ICTProviderForm';
import { ICTProviderFormData } from '../../schemas/doraSchema';
import { ICTProvider } from '../../types/dora';
import { useICTProviders } from '../../hooks/useICTProviders';

interface ICTProviderDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    provider?: ICTProvider | null;
    onSuccess?: () => void;
}

export const ICTProviderDrawer: React.FC<ICTProviderDrawerProps> = ({
    isOpen,
    onClose,
    provider,
    onSuccess
}) => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);
    const { createProvider, updateProvider } = useICTProviders();

    const isEditing = !!provider;

    const handleSubmit = async (data: ICTProviderFormData) => {
        setIsLoading(true);
        try {
            if (isEditing && provider?.id) {
                await updateProvider(provider.id, data);
                toast.success(t('dora.providers.toastUpdated'));
            } else {
                await createProvider(data);
                toast.success(t('dora.providers.toastCreated'));
            }
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error saving ICT Provider:', error);
            toast.error(t('common.error'));
        } finally {
            setIsLoading(false);
        }
    };

    const initialData: Partial<ICTProviderFormData> | undefined = provider ? {
        name: provider.name,
        category: provider.category,
        description: provider.description,
        services: provider.services,
        contractInfo: {
            startDate: typeof provider.contractInfo?.startDate === 'string'
                ? provider.contractInfo.startDate
                : '',
            endDate: typeof provider.contractInfo?.endDate === 'string'
                ? provider.contractInfo.endDate
                : '',
            exitStrategy: provider.contractInfo?.exitStrategy || '',
            auditRights: provider.contractInfo?.auditRights || false,
            contractValue: provider.contractInfo?.contractValue,
            noticePeriodDays: provider.contractInfo?.noticePeriodDays
        },
        compliance: {
            doraCompliant: provider.compliance?.doraCompliant || false,
            certifications: provider.compliance?.certifications || [],
            locationEU: provider.compliance?.locationEU ?? true,
            headquartersCountry: provider.compliance?.headquartersCountry
        },
        riskAssessment: {
            concentration: provider.riskAssessment?.concentration || 0,
            substitutability: provider.riskAssessment?.substitutability || 'medium',
            notes: provider.riskAssessment?.notes
        },
        contactName: provider.contactName,
        contactEmail: provider.contactEmail,
        contactPhone: provider.contactPhone,
        website: provider.website,
        status: provider.status
    } : undefined;

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? t('dora.providers.edit') : t('dora.providers.new')}
            subtitle={t('dora.subtitle')}
            width="max-w-3xl"
            disableScroll
        >
            <ICTProviderForm
                onSubmit={handleSubmit}
                onCancel={onClose}
                initialData={initialData}
                isEditing={isEditing}
                isLoading={isLoading}
            />
        </Drawer>
    );
};
