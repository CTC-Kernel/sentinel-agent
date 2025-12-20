import { useMemo } from 'react';
import { getPlanLimits } from '../config/plans';
import { PlanLimits, PlanType } from '../types';
import { useStore } from '../store';

export const usePlanLimits = () => {
    const { organization } = useStore();
    const planId = (organization?.subscription?.planId || 'discovery') as PlanType;

    const limits = useMemo<PlanLimits>(() => getPlanLimits(planId), [planId]);

    const hasFeature = (feature: keyof PlanLimits['features']): boolean => {
        return limits.features[feature] ?? false;
    };

    return {
        planId,
        limits,
        hasFeature,
    };
};
