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
    const { addToast } = useStore();
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
                discovery: `Cette fonctionnalité "${featureName}" nécessite le plan Professional (199€/mois).`,
                professional: '',
                enterprise: ''
            },
            enterprise: {
                discovery: `Cette fonctionnalité "${featureName}" nécessite le plan Enterprise (499€/mois).`,
                professional: `Cette fonctionnalité "${featureName}" nécessite le plan Enterprise (499€/mois).`,
                enterprise: ''
            }
        };

        const upgradeMessage = upgradeMessages[planRequired][planId] || '';

        return {
            canExport,
            requiresUpgrade,
            featureName,
            upgradeMessage,
            planRequired
        };
    }, [hasFeature, planId]);

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
                    onSuccess?.(`Export ${limitCheck.featureName} réussi`);
                }).catch(onError);
            } else {
                onSuccess?.(`Export ${limitCheck.featureName} réussi`);
            }
            return true;
        } catch (error) {
            onError?.(error);
            return false;
        }
    }, [addToast]);

    const createUpgradeToast = useCallback((limitCheck: ExportLimitCheck) => {
        addToast(
            `${limitCheck.upgradeMessage} Les rapports générés avec le plan Discovery incluent un filigrane et des fonctionnalités limitées.`,
            'info'
        );
    }, [addToast]);

    return {
        checkExportLimit,
        handleExportWithLimitCheck,
        createUpgradeToast,
        currentPlan: planId
    };
};
