/**
 * Story 27.4 - eDiscovery Search Component
 *
 * Advanced search interface for legal/compliance teams.
 * Supports boolean operators, date ranges, saved queries, and bulk exports.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Calendar,
  User,
  FileText,
  Save,
  Trash2,
  Play,
  Download,
  ChevronDown,
  ChevronUp,
  X,
  History,
  Star,
  Loader2,
  AlertCircle,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { useStore } from '@/store';
import { useAuth } from '@/hooks/useAuth';
import {
  EDiscoveryService,
  EDiscoveryQuery,
  SavedSearch,
  SearchResults,
  SearchResultEntry,
  BooleanOperator,
} from '@/services/eDiscoveryService';
import { VaultAuditService, DocumentAction } from '@/services/vaultAuditService';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EDiscoverySearchProps {
  /** Default document ID to filter by */
  defaultDocumentId?: string;
  /** Callback when search is executed */
  onSearchExecuted?: (results: SearchResults) => void;
  /** Callback when a result entry is clicked */
  onResultClick?: (entry: SearchResultEntry) => void;
  /** Custom class name */
  className?: string;
}

export const EDiscoverySearch: React.FC<EDiscoverySearchProps> = ({
  defaultDocumentId,
  onSearchExecuted,
  // onResultClick,
  className = '',
}) => {
  const { user } = useAuth();
  const { organization: currentOrganization } = useStore();

  // Query state
  const [keywords, setKeywords] = useState('');
  const [booleanOperator, setBooleanOperator] = useState<BooleanOperator>('AND');
  const [selectedActions, setSelectedActions] = useState<DocumentAction[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });
  const [userFilter, setUserFilter] = useState('');
  const [documentIds, setDocumentIds] = useState<string>(defaultDocumentId || '');

  // Results state
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saved searches state
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [searchIsPublic, setSearchIsPublic] = useState(false);

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const loadSavedSearches = useCallback(async () => {
    if (!user?.uid || !currentOrganization?.id) return;
    try {
      const searches = await EDiscoveryService.loadSearchQueries(
        currentOrganization.id,
        user.uid
      );
      setSavedSearches(searches);
    } catch (err) {
      console.error('Failed to load saved searches:', err);
    }
  }, [user?.uid, currentOrganization?.id]);

  // Load saved searches
  useEffect(() => {
    loadSavedSearches();
  }, [loadSavedSearches]);

  // Build query from current state
  const buildQuery = useCallback((): EDiscoveryQuery => {
    const query: EDiscoveryQuery = {
      name: 'Search',
      booleanOperator,
    };

    if (keywords.trim()) {
      query.keywords = keywords.split(/\s+/).filter(k => k.length > 0);
    }

    if (selectedActions.length > 0) {
      query.actions = selectedActions;
    }

    if (dateRange.start || dateRange.end) {
      query.dateRange = {
        startDate: dateRange.start,
        endDate: dateRange.end,
      };
    }

    if (userFilter.trim()) {
      query.userIds = [userFilter.trim()];
    }

    if (documentIds.trim()) {
      query.documentIds = documentIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
    }

    return query;
  }, [keywords, selectedActions, dateRange, userFilter, documentIds, booleanOperator]);

  // Execute search
  const executeSearch = async () => {
    if (!currentOrganization?.id) return;

    const query = buildQuery();
    const validation = EDiscoveryService.validateQuery(query);

    if (!validation.valid) {
      setError(validation.errors.join('. '));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const searchResults = await EDiscoveryService.executeSearch(
        currentOrganization.id,
        query
      );

      setResults(searchResults);
      onSearchExecuted?.(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  // Apply saved search
  const applySavedSearch = async (savedSearch: SavedSearch) => {
    const query = savedSearch.query;

    // Apply query to UI state
    setKeywords(query.keywords?.join(' ') || '');
    setBooleanOperator(query.booleanOperator || 'AND');
    setSelectedActions(query.actions || []);
    setDateRange({
      start: query.dateRange?.startDate || '',
      end: query.dateRange?.endDate || '',
    });
    setUserFilter(query.userIds?.[0] || '');
    setDocumentIds(query.documentIds?.join(', ') || '');

    setShowSavedSearches(false);

    // Record search execution
    await EDiscoveryService.recordSearchExecution(savedSearch.id);

    // Execute the search
    try {
      setLoading(true);
      setError(null);

      const searchResults = await EDiscoveryService.executeSearch(
        currentOrganization?.id || '',
        query
      );

      setResults(searchResults);
      onSearchExecuted?.(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  // Save current search
  const saveCurrentSearch = async () => {
    if (!searchName.trim() || !currentOrganization?.id || !user?.uid) return;

    try {
      setSavingSearch(true);
      const query = buildQuery();
      query.name = searchName;

      await EDiscoveryService.saveSearchQuery(
        currentOrganization.id,
        user.uid,
        searchName,
        query,
        {
          description: searchDescription,
          isPublic: searchIsPublic,
        }
      );

      await loadSavedSearches();
      setSaveDialogOpen(false);
      setSearchName('');
      setSearchDescription('');
      setSearchIsPublic(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSavingSearch(false);
    }
  };

  // Delete saved search
  const deleteSavedSearch = async (searchId: string) => {
    try {
      await EDiscoveryService.deleteSearchQuery(searchId);
      await loadSavedSearches();
    } catch (err) {
      console.error('Failed to delete saved search:', err);
    }
  };

  // Export results
  const exportResults = async (format: 'csv' | 'json') => {
    if (!results) return;

    try {
      setExporting(true);
      const exportResult = await EDiscoveryService.exportSearchResults(results, format);
      EDiscoveryService.downloadExport(exportResult, `ediscovery-${Date.now()}.${format}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  // Clear search
  const clearSearch = () => {
    setKeywords('');
    setSelectedActions([]);
    setDateRange({ start: '', end: '' });
    setUserFilter('');
    setDocumentIds(defaultDocumentId || '');
    setResults(null);
    setError(null);
  };

  // Toggle result expansion
  const toggleResultExpand = (id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // All available actions for filter
  const allActions = VaultAuditService.getAllActions();

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Search className="h-5 w-5 text-brand-600" />
          Recherche eDiscovery
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSavedSearches(!showSavedSearches)}
            className="text-slate-500 hover:text-brand-600"
          >
            <History className="h-4 w-4 mr-1" />
            Recherches sauvegardees
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
            className="text-slate-500 hover:text-brand-600"
            disabled={!keywords && selectedActions.length === 0 && !dateRange.start && !dateRange.end}
          >
            <Save className="h-4 w-4 mr-1" />
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* Saved Searches Panel */}
      {showSavedSearches && savedSearches.length > 0 && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Recherches sauvegardees ({savedSearches.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {savedSearches.map(search => (
              <div
                key={search.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-300 transition-colors"
              >
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => applySavedSearch(search)}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white truncate">
                      {search.name}
                    </span>
                    {search.isPublic && (
                      <Star className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                  {search.description && (
                    <p className="text-xs text-slate-500 truncate">{search.description}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    Utilisee {search.runCount} fois
                    {search.lastRunAt && ` - Derniere: ${formatDistanceToNow(search.lastRunAt, { addSuffix: true, locale: fr })}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => applySavedSearch(search)}
                    className="text-brand-600 hover:text-brand-700"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  {search.createdBy === user?.uid && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSavedSearch(search.id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Form */}
      <div className="p-4 space-y-4">
        {/* Keyword Search */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Mots-cles
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeSearch()}
                placeholder="Rechercher dans les details..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
            <select
              value={booleanOperator}
              onChange={(e) => setBooleanOperator(e.target.value as BooleanOperator)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value="AND">ET</option>
              <option value="OR">OU</option>
              <option value="NOT">SAUF</option>
            </select>
          </div>
        </div>

        {/* Action Type Filter */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Type d'action
          </label>
          <div className="flex flex-wrap gap-2">
            {allActions.map(({ value, label }) => {
              const colors = VaultAuditService.getActionColorClass(value);
              const isSelected = selectedActions.includes(value);
              return (
                <button
                  key={value}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedActions(prev => prev.filter(a => a !== value));
                    } else {
                      setSelectedActions(prev => [...prev, value]);
                    }
                  }}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${isSelected
                    ? `${colors.bg} ${colors.text} ${colors.border}`
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-brand-300'
                    }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1"
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Filtres avances
        </button>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Date debut
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Date fin
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* User Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <User className="h-3 w-3 inline mr-1" />
                ID Utilisateur
              </label>
              <input
                type="text"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="ID de l'utilisateur"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            {/* Document IDs Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <FileText className="h-3 w-3 inline mr-1" />
                IDs Documents (separes par virgule)
              </label>
              <input
                type="text"
                value={documentIds}
                onChange={(e) => setDocumentIds(e.target.value)}
                placeholder="doc1, doc2, doc3"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <Button
            variant="ghost"
            onClick={clearSearch}
            className="text-slate-500 hover:text-red-600"
          >
            <X className="h-4 w-4 mr-1" />
            Effacer
          </Button>
          <Button
            onClick={executeSearch}
            disabled={loading}
            className="bg-brand-600 hover:bg-brand-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Rechercher
          </Button>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          {/* Results Header */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium text-slate-900 dark:text-white">{results.totalCount}</span> resultats
              en <span className="font-medium">{results.searchTime}ms</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportResults('csv')}
                disabled={exporting || results.entries.length === 0}
                className="text-slate-500 hover:text-brand-600"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportResults('json')}
                disabled={exporting || results.entries.length === 0}
                className="text-slate-500 hover:text-brand-600"
              >
                JSON
              </Button>
            </div>
          </div>

          {/* Results List */}
          {results.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">Aucun resultat trouve</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {results.entries.map(entry => {
                const colors = VaultAuditService.getActionColorClass(entry.action);
                const isExpanded = expandedResults.has(entry.id);

                return (
                  <div
                    key={entry.id}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
                            {VaultAuditService.getActionLabel(entry.action)}
                          </span>
                          <span className="text-sm text-slate-600 dark:text-slate-400 truncate">
                            {entry.userEmail}
                          </span>
                          {entry.documentName && (
                            <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                              {entry.documentName}
                            </span>
                          )}
                        </div>

                        {/* Highlights */}
                        {entry.highlights && entry.highlights.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {entry.highlights.map((highlight, idx) => (
                              <p key={idx} className="text-xs text-slate-600 dark:text-slate-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded">
                                {highlight}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Expandable Details */}
                        <button
                          onClick={() => toggleResultExpand(entry.id)}
                          className="mt-2 text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          Details
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
                            <pre className="whitespace-pre-wrap text-slate-600 dark:text-slate-400 font-mono">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          {entry.timestamp ? format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'N/A'}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {entry.documentId.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Save Search Dialog */}
      {saveDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Sauvegarder la recherche
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nom *
                </label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="Ma recherche"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={searchDescription}
                  onChange={(e) => setSearchDescription(e.target.value)}
                  placeholder="Description optionnelle..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={searchIsPublic}
                  onChange={(e) => setSearchIsPublic(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Partager avec l'équipe
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="ghost"
                onClick={() => setSaveDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={saveCurrentSearch}
                disabled={!searchName.trim() || savingSearch}
                className="bg-brand-600 hover:bg-brand-700 text-white"
              >
                {savingSearch ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Sauvegarder
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EDiscoverySearch;
