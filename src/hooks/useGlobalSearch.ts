import { useState, useCallback, useRef, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
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

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 300;

export const useGlobalSearch = () => {
    const { user } = useStore();
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    // Refs for debouncing
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    // FIXED: Track mounted state to prevent state updates after unmount
    const isMountedRef = useRef(true);

    // FIXED: Cleanup on unmount to prevent memory leaks
    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
            // Cancel any pending debounced search
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            // Abort any in-flight requests
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    /**
     * Debounced search function - waits for user to stop typing
     */
    const performSearch = useCallback(async (text: string, filters: SearchFilters, activeTypeFilter: string) => {
        if (!user?.organizationId) return;

        // Cancel any pending debounced search
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Cancel any in-flight requests
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new abort controller for this search
        abortControllerRef.current = new AbortController();

        // Debounce the search
        debounceTimerRef.current = setTimeout(async () => {
            // FIXED: Check mounted before state update
            if (!isMountedRef.current) return;
            setLoading(true);

            try {
                const searchTerm = (filters.query || text).toLowerCase();

                // Helper to check if item matches search term
                const matches = (itemText: string) => itemText?.toLowerCase().includes(searchTerm);

                // Helper to check date range
                const matchesDateRange = (dateStr: string) => {
                    if (!filters.dateFrom && !filters.dateTo) return true;
                    const itemDate = new Date(dateStr);
                    if (filters.dateFrom && itemDate < new Date(filters.dateFrom)) return false;
                    if (filters.dateTo && itemDate > new Date(filters.dateTo)) return false;
                    return true;
                };

                // Determine which collections to search
                const searchAssets = activeTypeFilter === 'all' || activeTypeFilter === 'asset' || filters.type === 'asset' || filters.type === 'all';
                const searchRisks = activeTypeFilter === 'all' || activeTypeFilter === 'risk' || filters.type === 'risk' || filters.type === 'all';
                const searchDocs = activeTypeFilter === 'all' || activeTypeFilter === 'document' || filters.type === 'document' || filters.type === 'all';
                const searchProjects = activeTypeFilter === 'all' || activeTypeFilter === 'project' || filters.type === 'project' || filters.type === 'all';

                // Build parallel queries
                const queries: Promise<{ type: string; docs: SearchResult[] }>[] = [];

                if (searchAssets) {
                    queries.push(
                        getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId), limit(50)))
                            .then(snapshot => {
                                const docs: SearchResult[] = [];
                                snapshot.forEach(doc => {
                                    const data = doc.data();
                                    if (matches(data.name) || matches(data.type)) {
                                        if (filters.status && data.status !== filters.status) return;
                                        if (filters.owner && !data.owner?.toLowerCase().includes(filters.owner.toLowerCase())) return;
                                        if (filters.criticality && data.criticality !== filters.criticality) return;
                                        if (!matchesDateRange(data.updatedAt)) return;

                                        docs.push({
                                            id: doc.id,
                                            type: 'asset',
                                            title: data.name,
                                            subtitle: `${data.type} • ${data.criticality}`,
                                            status: data.status,
                                            date: data.updatedAt
                                        });
                                    }
                                });
                                return { type: 'assets', docs };
                            })
                            .catch(e => {
                                ErrorLogger.error(e, 'useGlobalSearch.fetchAssets');
                                return { type: 'assets', docs: [] };
                            })
                    );
                }

                if (searchRisks) {
                    queries.push(
                        getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId), limit(50)))
                            .then(snapshot => {
                                const docs: SearchResult[] = [];
                                snapshot.forEach(doc => {
                                    const data = doc.data();
                                    if (matches(data.threat) || matches(data.scenario)) {
                                        if (filters.status && data.status !== filters.status) return;
                                        if (filters.owner && !data.owner?.toLowerCase().includes(filters.owner.toLowerCase())) return;
                                        if (!matchesDateRange(data.updatedAt)) return;

                                        docs.push({
                                            id: doc.id,
                                            type: 'risk',
                                            title: data.threat,
                                            subtitle: `Impact: ${data.impact} • Probabilité: ${data.probability}`,
                                            score: data.score,
                                            date: data.updatedAt
                                        });
                                    }
                                });
                                return { type: 'risks', docs };
                            })
                            .catch(e => {
                                ErrorLogger.error(e, 'useGlobalSearch.fetchRisks');
                                return { type: 'risks', docs: [] };
                            })
                    );
                }

                if (searchDocs) {
                    queries.push(
                        getDocs(query(collection(db, 'documents'), where('organizationId', '==', user.organizationId), limit(50)))
                            .then(snapshot => {
                                const docs: SearchResult[] = [];
                                snapshot.forEach(doc => {
                                    const data = doc.data();
                                    if (matches(data.title) || matches(data.reference)) {
                                        if (filters.status && data.status !== filters.status) return;
                                        if (filters.owner && !data.owner?.toLowerCase().includes(filters.owner.toLowerCase())) return;
                                        if (!matchesDateRange(data.updatedAt)) return;

                                        docs.push({
                                            id: doc.id,
                                            type: 'document',
                                            title: data.title,
                                            subtitle: `Ref: ${data.reference} • v${data.version}`,
                                            status: data.status,
                                            date: data.updatedAt
                                        });
                                    }
                                });
                                return { type: 'documents', docs };
                            })
                            .catch(e => {
                                ErrorLogger.error(e, 'useGlobalSearch.fetchDocuments');
                                return { type: 'documents', docs: [] };
                            })
                    );
                }

                if (searchProjects) {
                    queries.push(
                        getDocs(query(collection(db, 'projects'), where('organizationId', '==', user.organizationId), limit(50)))
                            .then(snapshot => {
                                const docs: SearchResult[] = [];
                                snapshot.forEach(doc => {
                                    const data = doc.data();
                                    if (matches(data.name) || matches(data.description)) {
                                        if (filters.status && data.status !== filters.status) return;
                                        if (filters.owner && !data.manager?.toLowerCase().includes(filters.owner.toLowerCase())) return;
                                        if (!matchesDateRange(data.dueDate)) return;

                                        docs.push({
                                            id: doc.id,
                                            type: 'project',
                                            title: data.name,
                                            subtitle: `Manager: ${data.manager || 'N/A'}`,
                                            status: data.status,
                                            date: data.dueDate
                                        });
                                    }
                                });
                                return { type: 'projects', docs };
                            })
                            .catch(e => {
                                ErrorLogger.error(e, 'useGlobalSearch.fetchProjects');
                                return { type: 'projects', docs: [] };
                            })
                    );
                }

                // Execute all queries in parallel for better performance
                const results = await Promise.all(queries);

                // Combine all results
                const searchResults: SearchResult[] = results.flatMap(r => r.docs);

                // FIXED: Only update state if still mounted
                if (isMountedRef.current) {
                    setResults(searchResults);
                }
            } catch (error) {
                // Don't log abort errors
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }
                ErrorLogger.handleErrorWithToast(error, 'useGlobalSearch.performSearch', 'FETCH_FAILED');
            } finally {
                // FIXED: Only update state if still mounted
                if (isMountedRef.current) {
                    setLoading(false);
                }
            }
        }, DEBOUNCE_DELAY);
    }, [user]);

    /**
     * Cancel any pending search (useful for cleanup)
     */
    const cancelSearch = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setLoading(false);
    }, []);

    /**
     * Clear results
     */
    const clearResults = useCallback(() => {
        setResults([]);
    }, []);

    return {
        results,
        loading,
        performSearch,
        cancelSearch,
        clearResults,
        setResults
    };
};
