import React, { useState, useEffect } from 'react';

import { Search as SearchIcon, Filter, ArrowRight, ShieldCheck, AlertTriangle, FileText, FolderKanban } from '../components/ui/Icons';
import { motion } from 'framer-motion';
import { staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';

import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdvancedSearch, SearchFilters } from '../components/ui/AdvancedSearch';
import { useGlobalSearch, SearchResult } from '../hooks/useGlobalSearch';
import { useStore } from '../store';
import { RISK_THRESHOLDS } from '../constants/complianceConfig';

export const Search: React.FC = () => {
 const { t } = useStore();
 const [searchParams] = useSearchParams();
 const [queryText, setQueryText] = useState(searchParams.get('q') || '');
 const [activeFilter, setActiveFilter] = useState<string>('all');
 const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
 const [advancedFilters, setAdvancedFilters] = useState<SearchFilters>({ query: '', type: 'all' });
 const navigate = useNavigate();
 const { results, loading, performSearch, setResults } = useGlobalSearch();

 useEffect(() => {
 const delayDebounceFn = setTimeout(() => {
 if (queryText.length > 1 || advancedFilters.status || advancedFilters.owner || advancedFilters.dateFrom) {
 performSearch(queryText, advancedFilters, activeFilter);
 } else {
 setResults([]);
 }
 }, 500);

 return () => clearTimeout(delayDebounceFn);
 }, [queryText, activeFilter, advancedFilters, performSearch, setResults]);

 const getIcon = (type: string) => {
 switch (type) {
 case 'asset': return <ShieldCheck className="h-5 w-5 text-blue-500" />;
 case 'risk': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
 case 'document': return <FileText className="h-5 w-5 text-purple-500" />;
 case 'project': return <FolderKanban className="h-5 w-5 text-emerald-500" />;
 default: return <SearchIcon className="h-5 w-5 text-muted-foreground" />;
 }
 };

 const handleNavigate = (item: SearchResult) => {
 const routes: Record<string, string> = {
 asset: '/assets', risk: '/risks', document: '/documents',
 project: '/projects', incident: '/incidents', supplier: '/suppliers', audit: '/audits'
 };
 const route = routes[item.type] || '/';
 navigate(`${route}?id=${item.id}`);
 };

 const handleAdvancedSearch = (filters: SearchFilters) => {
 setAdvancedFilters(filters);
 setQueryText(filters.query);
 setShowAdvancedSearch(false);
 };

 const clearAdvancedFilters = () => {
 setAdvancedFilters({ query: '', type: 'all' });
 setQueryText('');
 };

 const hasActiveFilters = advancedFilters.status || advancedFilters.owner || advancedFilters.dateFrom || advancedFilters.dateTo || advancedFilters.criticality;

 return (
 <motion.div
 variants={staggerContainerVariants}
 initial="initial"
 animate="visible"
 className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
 >
 <MasterpieceBackground />
 <SEO title={t('search.title', { defaultValue: 'Advanced Search' })} description={t('search.seoDescription', { defaultValue: 'Search across all your assets, risks, documents and projects' })} />
 {showAdvancedSearch && (
 <AdvancedSearch
  onSearch={handleAdvancedSearch}
  onClose={() => setShowAdvancedSearch(false)}
 />
 )}

 <PageHeader
 title={t('search.title', { defaultValue: 'Advanced Search' })}
 subtitle={t('search.subtitle', { defaultValue: 'Search across all your assets, risks, documents and projects.' })}
 icon={<SearchIcon className="h-6 w-6 text-white" strokeWidth={2.5} />}
 />

 <div className="glass-premium p-2 rounded-2xl flex items-center space-x-4 shadow-lg ring-1 ring-black/5 dark:ring-white/10 bg-card/80 backdrop-blur-xl sticky top-4 z-30 border border-border/40">
 <div className="p-3 bg-muted rounded-xl">
  <SearchIcon className="h-6 w-6 text-muted-foreground" />
 </div>
 <input value={queryText}
  aria-label={t('search.search', { defaultValue: 'Search' })}
  type="text"
  placeholder={t('search.placeholder', { defaultValue: 'Search for something...' })}
  className="flex-1 bg-transparent border-none focus:ring-0 text-lg dark:text-white py-3 font-medium placeholder-gray-400"
  onChange={e => setQueryText(e.target.value)}
 />
 {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-4"></div>}
 <button
  aria-label={t('search.filters', { defaultValue: 'Filters' })}
  onClick={() => setShowAdvancedSearch(true)}
  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-sm shadow-lg transition-all hover:scale-105 flex items-center gap-2"
 >
  <Filter className="h-4 w-4" />
  {t('search.filters', { defaultValue: 'Filters' })}
 </button>
 </div>

 {hasActiveFilters && (
 <div className="flex flex-wrap gap-2 items-center">
  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('search.activeFilters', { defaultValue: 'Active filters' })}:</span>
  {advancedFilters.status && (
  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold">
  {t('search.status', { defaultValue: 'Status' })}: {advancedFilters.status}
  </span>
  )}
  {advancedFilters.owner && (
  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold">
  {t('search.owner', { defaultValue: 'Owner' })}: {advancedFilters.owner}
  </span>
  )}
  {advancedFilters.criticality && (
  <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg text-xs font-bold">
  {t('search.criticality', { defaultValue: 'Criticality' })}: {advancedFilters.criticality}
  </span>
  )}
  {(advancedFilters.dateFrom || advancedFilters.dateTo) && (
  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-bold">
  {t('search.period', { defaultValue: 'Period' })}: {advancedFilters.dateFrom || '...'} → {advancedFilters.dateTo || '...'}
  </span>
  )}
  <button
  aria-label={t('search.clearFilters', { defaultValue: 'Clear filters' })}
  onClick={clearAdvancedFilters}
  className="px-3 py-1 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted transition-colors"
  >
  {t('search.clear', { defaultValue: 'Clear' })}
  </button>
 </div>
 )}

 <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
 {[
  { id: 'all', label: t('search.all', { defaultValue: 'All' }) },
  { id: 'asset', label: t('search.assets', { defaultValue: 'Assets' }) },
  { id: 'risk', label: t('search.risks', { defaultValue: 'Risks' }) },
  { id: 'document', label: t('search.documents', { defaultValue: 'Documents' }) },
  { id: 'project', label: t('search.projects', { defaultValue: 'Projects' }) }
 ].map(filter => (
  <button
  aria-label={filter.label}
  key={filter.id || 'unknown'}
  onClick={() => setActiveFilter(filter.id)}
  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeFilter === filter.id
  ? 'bg-foreground text-background shadow-md'
  : 'bg-card text-muted-foreground hover:bg-muted/50'
  }`}
  >
  {filter.label}
  </button>
 ))}
 </div>

 <div className="space-y-4">
 {queryText.length > 1 && results.length === 0 && !loading ? (
  <div className="space-y-6">
  <EmptyState
  icon={SearchIcon}
  title={t('search.noResults', { defaultValue: 'No results' })}
  description={t('search.noResultsDescription', { query: queryText, defaultValue: 'No items match "{{query}}"' })}
  />
  <div className="glass-premium p-6 rounded-3xl border border-border/40 space-y-4">
  <p className="text-sm font-bold text-foreground">
  {t('search.tryDifferentTerms', { defaultValue: 'Try different terms, or browse sections directly:' })}
  </p>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
  <button
   onClick={() => navigate('/risks')}
   className="flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-white/60 hover:bg-muted/50/60 hover:border-primary/30 dark:hover:border-primary transition-all group text-left"
  >
   <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 group-hover:scale-110 transition-transform">
   <AlertTriangle className="h-5 w-5 text-orange-500" />
   </div>
   <div>
   <span className="text-sm font-bold text-foreground">{t('search.browseRisks', { defaultValue: 'Browse risks' })}</span>
   <p className="text-xs text-muted-foreground">{t('search.riskRegister', { defaultValue: 'Risk register' })}</p>
   </div>
   <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
  </button>
  <button
   onClick={() => navigate('/assets')}
   className="flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-white/60 hover:bg-muted/50/60 hover:border-primary/30 dark:hover:border-primary transition-all group text-left"
  >
   <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 group-hover:scale-110 transition-transform">
   <ShieldCheck className="h-5 w-5 text-blue-500" />
   </div>
   <div>
   <span className="text-sm font-bold text-foreground">{t('search.viewAssets', { defaultValue: 'View assets' })}</span>
   <p className="text-xs text-muted-foreground">{t('search.assetInventory', { defaultValue: 'Asset inventory' })}</p>
   </div>
   <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
  </button>
  <button
   onClick={() => navigate('/compliance')}
   className="flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-white/60 hover:bg-muted/50/60 hover:border-primary/30 dark:hover:border-primary transition-all group text-left"
  >
   <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 group-hover:scale-110 transition-transform">
   <FileText className="h-5 w-5 text-emerald-500" />
   </div>
   <div>
   <span className="text-sm font-bold text-foreground">{t('search.viewControls', { defaultValue: 'View controls' })}</span>
   <p className="text-xs text-muted-foreground">{t('search.complianceFramework', { defaultValue: 'Compliance framework' })}</p>
   </div>
   <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
  </button>
  </div>
  </div>
  </div>
 ) : (
  results.map((result) => (
  <div
  role="button"
  tabIndex={0}
  key={`${result.type || 'unknown'}-${result.id}`}
  onClick={() => handleNavigate(result)}
  onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
   e.preventDefault();
   handleNavigate(result);
  }
  }}
  className="glass-premium p-4 rounded-2xl hover:bg-muted/50 dark:hover:bg-white/5 cursor-pointer transition-all group border border-border/40 hover:border-primary/30 dark:hover:border-primary shadow-sm"
  >
  <div className="flex items-center justify-between">
  <div className="flex items-center gap-4">
   <div className="p-3 bg-muted rounded-xl group-hover:scale-110 transition-transform duration-300">
   {getIcon(result.type)}
   </div>
   <div>
   <h3 className="font-bold text-foreground text-lg">{result.title}</h3>
   <p className="text-sm text-muted-foreground font-medium">{result.subtitle}</p>
   </div>
  </div>
  <div className="flex items-center gap-4">
   {result.status && (
   <span className="px-3 py-1 rounded-lg text-xs font-bold bg-muted text-muted-foreground uppercase tracking-wider">
   {result.status}
   </span>
   )}
   {result.score !== undefined && (
   <span className={`px-3 py-1 rounded-lg text-xs font-bold ${result.score >= RISK_THRESHOLDS.HIGH ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : result.score >= RISK_THRESHOLDS.MEDIUM ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
   Score: {result.score}
   </span>
   )}
   <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
  </div>
  </div>
  </div>
  ))
 )}
 </div>
 </motion.div>
 );
};
