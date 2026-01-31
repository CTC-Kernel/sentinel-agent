/**
 * ICT Provider Drawer
 * DORA Art. 28 - Story 35.1
 * Slide-over panel for creating/editing ICT Providers
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { InspectorLayout } from '../ui/InspectorLayout';
import { ICTProviderForm } from './ICTProviderForm';
import { ICTProvider, ICTProviderFormData } from '../../types/dora';
import { useICTProviders } from '../../hooks/useICTProviders';
import { ErrorLogger } from '../../services/errorLogger';

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
                toast.success(t('dora.providerCreated', { defaultValue: 'Fournisseur ICT créé. Enregistrez les incidents associés.' }));
            }
            onSuccess?.();
            onClose();
        } catch (error) {
            ErrorLogger.error(error, 'ICTProviderDrawer.saveProvider');
            toast.error(t('common.error'));
        } finally {
            setIsLoading(false);
        }
    };

    // Convert provider data to form-compatible format
    const getStringDate = (dateValue: unknown): string => {
        if (!dateValue) return '';
        if (typeof dateValue === 'string') return dateValue;
        if (typeof dateValue === 'object' && dateValue !== null && 'toDate' in dateValue) {
            return (dateValue as { toDate: () => Date }).toDate().toISOString();
        }
        return '';
    };

    const initialData: Partial<ICTProviderFormData> | undefined = provider ? {
        name: provider.name,
        category: provider.category,
        description: provider.description,
        services: (provider.services || []).map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            criticality: s.criticality,
            description: s.description,
            businessFunctions: s.businessFunctions,
            dataProcessed: s.dataProcessed
        })),
        contractInfo: {
            startDate: getStringDate(provider.contractInfo?.startDate),
            endDate: getStringDate(provider.contractInfo?.endDate),
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
            notes: provider.riskAssessment?.notes,
            lastAssessment: getStringDate(provider.riskAssessment?.lastAssessment) || new Date().toISOString()
        },
        contactName: provider.contactName,
        contactEmail: provider.contactEmail,
        contactPhone: provider.contactPhone,
        website: provider.website,
        status: provider.status
    } as Partial<ICTProviderFormData> : undefined;

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? t('dora.providers.edit') : t('dora.providers.new')}
            subtitle={t('dora.subtitle')}
            width="max-w-4xl"
            icon={isEditing ? undefined : undefined} // Add icon if available
        >
            <ICTProviderForm
                onSubmit={handleSubmit}
                onCancel={onClose}
                initialData={initialData}
                isEditing={isEditing}
                isLoading={isLoading}
            />
        </InspectorLayout>
    );
};
