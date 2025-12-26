import { useState, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { SearchFilters } from '../components/ui/AdvancedSearch';

export interface SearchResult {
    id: string;
    type: 'asset' | 'risk' | 'control' | 'document' | 'project';
    title: string;
    subtitle: string;
    status?: string;
    date?: string;
    score?: number;
}

export const useGlobalSearch = () => {
    const { user } = useStore();
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    const performSearch = useCallback(async (text: string, filters: SearchFilters, activeTypeFilter: string) => {
        if (!user?.organizationId) return;
        setLoading(true);

        try {
            const searchResults: SearchResult[] = [];
            const searchTerm = (filters.query || text).toLowerCase();

            // Helper to check if item matches
            const matches = (itemText: string) => itemText?.toLowerCase().includes(searchTerm);

            // Helper to check date range
            const matchesDateRange = (dateStr: string) => {
                if (!filters.dateFrom && !filters.dateTo) return true;
                const itemDate = new Date(dateStr);
                if (filters.dateFrom && itemDate < new Date(filters.dateFrom)) return false;
                if (filters.dateTo && itemDate > new Date(filters.dateTo)) return false;
                return true;
            };

            // 1. Assets
            if (activeTypeFilter === 'all' || activeTypeFilter === 'asset' || filters.type === 'asset' || filters.type === 'all') {
                const assetsSnap = await getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId)));
                assetsSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.name) || matches(data.type)) {
                        // Apply advanced filters
                        if (filters.status && data.status !== filters.status) return;
                        if (filters.owner && !data.owner?.toLowerCase().includes(filters.owner.toLowerCase())) return;
                        if (filters.criticality && data.criticality !== filters.criticality) return;
                        if (!matchesDateRange(data.updatedAt)) return;

                        searchResults.push({
                            id: doc.id,
                            type: 'asset',
                            title: data.name,
                            subtitle: `${data.type} • ${data.criticality}`,
                            status: data.status,
                            date: data.updatedAt
                        });
                    }
                });
            }

            // 2. Risks
            if (activeTypeFilter === 'all' || activeTypeFilter === 'risk' || filters.type === 'risk' || filters.type === 'all') {
                const risksSnap = await getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId)));
                risksSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.threat) || matches(data.scenario)) {
                        if (filters.status && data.status !== filters.status) return;
                        if (filters.owner && !data.owner?.toLowerCase().includes(filters.owner.toLowerCase())) return;
                        if (!matchesDateRange(data.updatedAt)) return;

                        searchResults.push({
                            id: doc.id,
                            type: 'risk',
                            title: data.threat,
                            subtitle: `Impact: ${data.impact} • Probabilité: ${data.probability}`,
                            score: data.score,
                            date: data.updatedAt
                        });
                    }
                });
            }

            // 3. Documents
            if (activeTypeFilter === 'all' || activeTypeFilter === 'document' || filters.type === 'document' || filters.type === 'all') {
                const docsSnap = await getDocs(query(collection(db, 'documents'), where('organizationId', '==', user.organizationId)));
                docsSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.title) || matches(data.reference)) {
                        if (filters.status && data.status !== filters.status) return;
                        if (filters.owner && !data.owner?.toLowerCase().includes(filters.owner.toLowerCase())) return;
                        if (!matchesDateRange(data.updatedAt)) return;

                        searchResults.push({
                            id: doc.id,
                            type: 'document',
                            title: data.title,
                            subtitle: `Ref: ${data.reference} • v${data.version}`,
                            status: data.status,
                            date: data.updatedAt
                        });
                    }
                });
            }

            // 4. Projects
            if (activeTypeFilter === 'all' || activeTypeFilter === 'project' || filters.type === 'project' || filters.type === 'all') {
                const projSnap = await getDocs(query(collection(db, 'projects'), where('organizationId', '==', user.organizationId)));
                projSnap.forEach(doc => {
                    const data = doc.data();
                    if (matches(data.name) || matches(data.description)) {
                        if (filters.status && data.status !== filters.status) return;
                        if (filters.owner && !data.manager?.toLowerCase().includes(filters.owner.toLowerCase())) return;
                        if (!matchesDateRange(data.dueDate)) return;

                        searchResults.push({
                            id: doc.id,
                            type: 'project',
                            title: data.name,
                            subtitle: `Manager: ${data.manager || 'N/A'}`,
                            status: data.status,
                            date: data.dueDate
                        });
                    }
                });
            }

            setResults(searchResults);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useGlobalSearch.performSearch', 'FETCH_FAILED');
        } finally {
            setLoading(false);
        }
    }, [user]);

    return {
        results,
        loading,
        performSearch,
        setResults
    };
};
