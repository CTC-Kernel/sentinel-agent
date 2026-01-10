import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type TabIconComponent = React.ElementType<{ className?: string }>;

interface Tab {
    id: string;
    label: string;
    icon?: TabIconComponent;
    count?: number;
}

interface ScrollableTabsProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (id: string) => void;
    className?: string;
}

export const ScrollableTabs: React.FC<ScrollableTabsProps> = ({ tabs, activeTab, onTabChange, className = '' }) => {
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
            <AnimatePresence>
                {showLeftArrow && (
                    <motion.button
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        onClick={() => scroll('left')}
                        aria-label="Défiler vers la gauche"
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-full shadow-lg border border-slate-200/50 dark:border-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </motion.button>
                )}
            </AnimatePresence>

            <div
                ref={scrollContainerRef}
                onScroll={checkScroll}
                className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth p-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-full border border-slate-200/50 dark:border-white/5 backdrop-blur-sm"
                role="tablist"
                aria-orientation="horizontal"
            >
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`panel-${tab.id}`}
                            id={`tab-${tab.id}`}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => onTabChange(tab.id)}
                            className={`relative px-4 py-2 text-sm font-medium rounded-full transition-colors flex items-center whitespace-nowrap z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isActive
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-white dark:bg-slate-700 rounded-full shadow-sm border border-slate-200/50 dark:border-white/10 -z-10"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}

                            {tab.icon && (
                                <tab.icon
                                    aria-hidden="true"
                                    className={`h-4 w-4 mr-2 transition-colors ${isActive ? 'text-brand-500 dark:text-brand-400' : 'opacity-70 group-hover:opacity-100'
                                        }`}
                                />
                            )}
                            <span className="relative">{tab.label}</span>

                            {tab.count !== undefined && (
                                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${isActive
                                    ? 'bg-brand-50 bg-opacity-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300'
                                    : 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400'
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
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-full shadow-lg border border-slate-200/50 dark:border-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
};
