import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Command, Clock, TrendingUp, FileText, Users, Shield, Database } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';

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
        navigate(filteredResults[selectedIndex].url);
        setIsOpen(false);
        setQuery('');
      }
    }
  };

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'page': return 'text-blue-500';
      case 'project': return 'text-green-500';
      case 'risk': return 'text-red-500';
      case 'asset': return 'text-purple-500';
      case 'user': return 'text-orange-500';
      case 'document': return 'text-indigo-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <motion.button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors w-64"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Search className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Rechercher...</span>
          <kbd className="ml-auto hidden sm:flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-400">
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
            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl shadow-slate-200/25 dark:shadow-slate-900/25 z-50 overflow-hidden"
          >
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Rechercher des pages, projets, risques..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="mt-4 space-y-1 max-h-96 overflow-y-auto">
                {filteredResults.length > 0 ? (
                  filteredResults.map((result, index) => (
                    <motion.button
                      key={result.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => {
                        navigate(result.url);
                        setIsOpen(false);
                        setQuery('');
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left",
                        index === selectedIndex && "bg-slate-50 dark:bg-slate-800"
                      )}
                    >
                      <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg", getTypeColor(result.type))}>
                        {result.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 dark:text-white truncate">
                          {result.title}
                        </div>
                        {result.category && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {result.category}
                          </div>
                        )}
                      </div>
                    </motion.button>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    Aucun résultat trouvé pour "{query}"
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
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
