import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, Clock, TrendingUp, FileText, Users, Shield, Database } from './Icons';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../hooks/utils/useDebounce';

interface SearchResult {
 id: string;
 title: string;
 type: 'page' | 'project' | 'risk' | 'asset' | 'user' | 'document';
 url: string;
 description?: string;
 icon: React.ReactNode;
 category?: string;
}

const mockResults: SearchResult[] = [
 { id: '1', title: 'Tableau de Bord', type: 'page', url: '/', icon: <TrendingUp className="w-4 h-4" />, category: 'Navigation' },
 { id: '2', title: 'Projets', type: 'page', url: '/projects', icon: <FileText className="w-4 h-4" />, category: 'Navigation' },
 { id: '3', title: 'Risques', type: 'page', url: '/risks', icon: <Shield className="w-4 h-4" />, category: 'Navigation' },
 { id: '4', title: 'Actifs', type: 'page', url: '/assets', icon: <Database className="w-4 h-4" />, category: 'Navigation' },
 { id: '5', title: 'Équipe', type: 'page', url: '/team', icon: <Users className="w-4 h-4" />, category: 'Navigation' },
];

export const UniversalSearch: React.FC<{ className?: string }> = ({ className = '' }) => {
 const [isOpen, setIsOpen] = useState(false);
 const [query, setQuery] = useState('');
 const [selectedIndex, setSelectedIndex] = useState(0);
 const navigate = useNavigate();
 const inputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault();
 setIsOpen(true);
 inputRef.current?.focus();
 }
 if (e.key === 'Escape') {
 setIsOpen(false);
 }
 };

 document.addEventListener('keydown', handleKeyDown);
 return () => document.removeEventListener('keydown', handleKeyDown);
 }, []);

 const debouncedQuery = useDebounce(query, 300);

 const filteredResults = useMemo(() => {
 if (debouncedQuery.length > 0) {
 return mockResults.filter(result =>
 result.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
 result.category?.toLowerCase().includes(debouncedQuery.toLowerCase())
 );
 } else {
 return mockResults.slice(0, 5);
 }
 }, [debouncedQuery]);

 // Track previous results to reset index when they change
 const [prevFilteredResults, setPrevFilteredResults] = useState(filteredResults);
 if (filteredResults !== prevFilteredResults) {
 setPrevFilteredResults(filteredResults);
 setSelectedIndex(0);
 }

 // Note: useEffect removed as state update happens during render

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'ArrowDown') {
 e.preventDefault();
 setSelectedIndex(prev => (prev + 1) % filteredResults.length);
 } else if (e.key === 'ArrowUp') {
 e.preventDefault();
 setSelectedIndex(prev => (prev - 1 + filteredResults.length) % filteredResults.length);
 } else if (e.key === 'Enter') {
 e.preventDefault();
 if (filteredResults[selectedIndex]) {
 navigate(/* sanitize */ filteredResults[selectedIndex].url);
 setIsOpen(false);
 setQuery('');
 }
 }
 };

 const getTypeColor = (type: SearchResult['type']) => {
 switch (type) {
 case 'page': return 'text-primary';
 case 'project': return 'text-success-500';
 case 'risk': return 'text-error-500';
 case 'asset': return 'text-violet-500';
 case 'user': return 'text-warning-500';
 case 'document': return 'text-info-500';
 default: return 'text-muted-foreground';
 }
 };

 return (
 <div className={cn("relative", className)}>
 <div className="relative">
 <motion.button
 onClick={() => setIsOpen(true)}
 className="flex items-center gap-2 px-3 py-2 bg-card border border-border/40 rounded-lg hover:bg-muted/50 transition-colors w-64"
 whileHover={{ scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 >
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
 <span className="text-sm text-muted-foreground">Rechercher...</span>
 <kbd className="ml-auto hidden sm:flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs text-muted-foreground">
 <Command className="w-3 h-3" />
 K
 </kbd>
 </motion.button>
 </div>

 <AnimatePresence>
 {isOpen && (
 <motion.div
 initial={{ opacity: 0, y: -10, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: -10, scale: 0.95 }}
 transition={{ duration: 0.2 }}
 className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/40 rounded-3xl shadow-2xl shadow-slate-200/25 dark:shadow-slate-900/25 z-dropdown overflow-hidden"
 >
 <div className="p-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
 <input
  ref={inputRef}
  type="text"
  aria-label="Rechercher des pages, projets, risques"
  value={query}
  onChange={(e) => setQuery(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="Rechercher des pages, projets, risques..."
  className="w-full pl-10 pr-4 py-2 bg-muted border border-border/40 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent"
 />
 </div>

 <div className="mt-4 space-y-1 max-h-96 overflow-y-auto">
 {filteredResults.length > 0 ? (
  filteredResults.map((result, index) => (
  <motion.button
  key={result.id || 'unknown'}
  initial={{ opacity: 0, x: -10 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ delay: index * 0.05 }}
  onClick={() => {
  navigate(/* sanitize */ result.url);
  setIsOpen(false);
  setQuery('');
  }}
  className={cn(
  "w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left",
  index === selectedIndex && "bg-muted"
  )}
  >
  <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg", getTypeColor(result.type))}>
  {result.icon}
  </div>
  <div className="flex-1 min-w-0">
  <div className="font-medium text-foreground truncate">
  {result.title}
  </div>
  {result.category && (
  <div className="text-xs text-muted-foreground">
  {result.category}
  </div>
  )}
  </div>
  </motion.button>
  ))
 ) : (
  <div className="text-center py-8 text-muted-foreground">
  Aucun résultat trouvé pour "{query}"
  </div>
 )}
 </div>

 <div className="mt-4 pt-4 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
 <Clock className="w-3 h-3" />
 <span>Utilisez ↑↓ pour naviguer, Entrée pour sélectionner</span>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
};
