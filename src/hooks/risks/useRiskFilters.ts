import { useState, useMemo, useDeferredValue } from 'react';
import { Risk } from '../../types';
import { getRiskLevel } from '../../utils/riskUtils';

export interface RiskFiltersState {
    query: string;
    status?: string | null;
    owner?: string | null;
    criticality?: string | null;
    category?: string | null;
}

export const useRiskFilters = (risks: Risk[]) => {
    const [activeFilters, setActiveFilters] = useState<RiskFiltersState>({ query: '' });
    const [frameworkFilter, setFrameworkFilter] = useState<string>('');
    const [matrixFilter, setMatrixFilter] = useState<{ p: number; i: number } | null>(null);
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

    // Defer the query to avoid UI lag on typing
    const deferredQuery = useDeferredValue(activeFilters.query);

    // Extract unique categories from risks
    const availableCategories = useMemo(() => {
        const categories = new Set(risks.map(r => r.category).filter(Boolean));
        return Array.from(categories).sort();
    }, [risks]);

    const filteredRisks = useMemo((): Risk[] => {
        return risks.filter(r => {
            if (!r) return false;

            // Text Search
            const needle = (deferredQuery || '').toLowerCase().trim();
            const threat = r.threat || '';
            const vul = r.vulnerability || '';
            const scenario = r.scenario || '';
            const matchesSearch = !needle ||
                threat.toLowerCase().includes(needle) ||
                vul.toLowerCase().includes(needle) ||
                scenario.toLowerCase().includes(needle);

            // Framework Filter
            const matchesFramework = frameworkFilter ? r.framework === frameworkFilter : true;

            // Matrix Filter
            const matchesMatrix = matrixFilter ? (Number(r.probability) === Number(matrixFilter.p) && Number(r.impact) === Number(matrixFilter.i)) : true;

            // Status Filter
            const matchesStatus = activeFilters.status ? r.status === activeFilters.status : true;

            // Category Filter
            const matchesCategory = activeFilters.category ? r.category === activeFilters.category : true;

            // Criticality Filter (based on score level)
            const matchesCriticality = activeFilters.criticality
                ? getRiskLevel(r.score).label === activeFilters.criticality
                : true;

            return matchesSearch && matchesMatrix && matchesFramework && matchesStatus && matchesCategory && matchesCriticality;
        });

    }, [risks, deferredQuery, frameworkFilter, matrixFilter, activeFilters.status, activeFilters.category, activeFilters.criticality]);

    return {
        activeFilters,
        setActiveFilters,
        frameworkFilter,
        setFrameworkFilter,
        matrixFilter,
        setMatrixFilter,
        showAdvancedSearch,
        setShowAdvancedSearch,
        filteredRisks,
        availableCategories
    };
};
