import { useCallback } from 'react';
import { useStore } from '../store';
import { usePlanLimits } from './usePlanLimits';

export interface ExportLimitCheck {
    canExport: boolean;
    requiresUpgrade: boolean;
    featureName: string;
    upgradeMessage: string;
    planRequired: 'professional' | 'enterprise';
}

export const useExportLimits = () => {
    const { addToast, t } = useStore();
    const { hasFeature, planId } = usePlanLimits();

    const checkExportLimit = useCallback((
        feature: keyof ReturnType<typeof usePlanLimits>['hasFeature'],
        featureName: string,
        planRequired: 'professional' | 'enterprise' = 'professional'
    ): ExportLimitCheck => {
        const canExport = hasFeature(feature);
        const requiresUpgrade = !canExport;

        const upgradeMessages = {
            professional: {
                discovery: t('export.upgrade.professional', { defaultValue: 'Cette fonctionnalité "{{feature}}" nécessite le plan Professional (199\u20AC/mois).', feature: featureName }),
                professional: '',
                enterprise: ''
            },
            enterprise: {
                discovery: t('export.upgrade.enterprise', { defaultValue: 'Cette fonctionnalité "{{feature}}" nécessite le plan Enterprise (499\u20AC/mois).', feature: featureName }),
                professional: t('export.upgrade.enterpriseFromPro', { defaultValue: 'Cette fonctionnalité "{{feature}}" nécessite le plan Enterprise (499\u20AC/mois).', feature: featureName }),
                enterprise: ''
            }
        };

        const messages = upgradeMessages[planRequired];
        const upgradeMessage = messages ? (messages[planId] || '') : '';

        return {
            canExport,
            requiresUpgrade,
            featureName,
            upgradeMessage,
            planRequired
        };
    }, [hasFeature, planId, t]);

    const handleExportWithLimitCheck = useCallback((
        exportFunction: () => Promise<void> | void,
        limitCheck: ExportLimitCheck,
        onSuccess?: (message: string) => void,
        onError?: (error: unknown) => void
    ) => {
        if (limitCheck.requiresUpgrade) {
            addToast(limitCheck.upgradeMessage, 'info');
            // Optionally redirect to pricing page
            // window.location.href = '/pricing';
            return false;
        }

        try {
            const result = exportFunction();
            if (result instanceof Promise) {
                result.then(() => {
                    onSuccess?.(t('export.toast.exportSuccess', { defaultValue: "Export {{feature}} réussi", feature: limitCheck.featureName }));
                }).catch(onError);
            } else {
                onSuccess?.(t('export.toast.exportSuccess', { defaultValue: "Export {{feature}} réussi", feature: limitCheck.featureName }));
            }
            return true;
        } catch (error) {
            onError?.(error);
            return false;
        }
    }, [addToast, t]);

    const createUpgradeToast = useCallback((limitCheck: ExportLimitCheck) => {
        addToast(
            t('export.toast.discoveryLimitations', { defaultValue: "{{message}} Les rapports générés avec le plan Discovery incluent un filigrane et des fonctionnalités limitées.", message: limitCheck.upgradeMessage }),
            'info'
        );
    }, [addToast, t]);

    return {
        checkExportLimit,
        handleExportWithLimitCheck,
        createUpgradeToast,
        currentPlan: planId
    };
};
