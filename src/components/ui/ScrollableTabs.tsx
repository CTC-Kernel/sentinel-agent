import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { Spinner } from './Spinner';

type TabIconComponent = React.ElementType<{ className?: string }>;

interface Tab {
 id: string;
 label: string;
 icon?: TabIconComponent;
 count?: number;
 isLoading?: boolean;
}

interface ScrollableTabsProps {
 tabs: Tab[];
 activeTab: string;
 onTabChange: (id: string) => void;
 className?: string;
 isChanging?: boolean;
 ariaLabel?: string;
}

export const ScrollableTabs: React.FC<ScrollableTabsProps> = ({
 tabs,
 activeTab,
 onTabChange,
 className = '',
 isChanging = false,
 ariaLabel
}) => {
 const scrollContainerRef = useRef<HTMLDivElement>(null);
 const [showLeftArrow, setShowLeftArrow] = useState(false);
 const [showRightArrow, setShowRightArrow] = useState(false);

 const checkScroll = () => {
 if (scrollContainerRef.current) {
 const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
 setShowLeftArrow(scrollLeft > 0);
 setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
 }
 };

 useEffect(() => {
 checkScroll();
 window.addEventListener('resize', checkScroll);
 return () => window.removeEventListener('resize', checkScroll);
 }, [tabs]);

 const scroll = (direction: 'left' | 'right') => {
 if (scrollContainerRef.current) {
 const scrollAmount = 200;
 scrollContainerRef.current.scrollBy({
 left: direction === 'left' ? -scrollAmount : scrollAmount,
 behavior: 'smooth'
 });
 }
 };

 return (
 <div className={`relative group ${className}`}>
 {/* Global Progress Bar */}
 <AnimatePresence>
 {isChanging && (
  <motion.div
  initial={{ scaleX: 0, opacity: 0 }}
  animate={{ scaleX: 1, opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.5, ease: "easeInOut" }}
  className="absolute -top-1 left-0 right-0 h-0.5 bg-primary origin-left z-30 rounded-full shadow-glow"
  />
 )}
 </AnimatePresence>

 <AnimatePresence>
 {showLeftArrow && (
  <motion.button
  initial={{ opacity: 0, x: -10 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -10 }}
  onClick={() => scroll('left')}
  aria-label="Défiler vers la gauche"
  className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-card/80 backdrop-blur-md rounded-full shadow-lg border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
  >
  <ChevronLeft className="h-4 w-4" />
  </motion.button>
 )}
 </AnimatePresence>

 <div
 ref={scrollContainerRef}
 onScroll={checkScroll}
 className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth p-1.5 bg-muted/50 rounded-full border border-border/40 backdrop-blur-sm"
 role="tablist"
 aria-orientation="horizontal"
 aria-label={ariaLabel}
 >
 {tabs.map((tab) => {
  const isActive = activeTab === tab.id;
  const isLoading = tab.isLoading;

  return (
  <button
  key={tab.id || 'unknown'}
  role="tab"
  aria-selected={isActive}
  aria-controls={`panel-${tab.id}`}
  id={`tab-${tab.id}`}
  tabIndex={isActive ? 0 : -1}
  onClick={() => onTabChange(tab.id)}
  disabled={isLoading}
  className={`relative px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center whitespace-nowrap z-decorator focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive
  ? 'text-foreground'
  : 'text-muted-foreground hover:text-foreground'
  } ${isLoading ? 'cursor-wait opacity-80' : ''}`}
  >
  {isActive && (
  <motion.div
   layoutId="activeTab"
   className="absolute inset-0 bg-card rounded-full shadow-sm border border-border/40 -z-10"
   transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
  />
  )}

  {isLoading ? (
  <Spinner className="h-3 w-3 mr-2 text-primary" size="sm" />
  ) : tab.icon && (
  <tab.icon
   aria-hidden="true"
   className={`h-4 w-4 mr-2 transition-colors ${isActive ? 'text-primary dark:text-primary' : 'opacity-70 group-hover:opacity-70'
   }`}
  />
  )}
  <span className="relative">{tab.label}</span>

  {tab.count !== undefined && !isLoading && (
  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold transition-colors ${isActive
   ? 'bg-primary text-primary-foreground'
   : 'bg-muted text-muted-foreground'
   }`}>
   {tab.count}
  </span>
  )}
  </button>
  );
 })}
 </div>

 <AnimatePresence>
 {showRightArrow && (
  <motion.button
  initial={{ opacity: 0, x: 10 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: 10 }}
  onClick={() => scroll('right')}
  aria-label="Défiler vers la droite"
  className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-card/80 backdrop-blur-md rounded-full shadow-lg border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
  >
  <ChevronRight className="h-4 w-4" />
  </motion.button>
 )}
 </AnimatePresence>
 </div>
 );
};
