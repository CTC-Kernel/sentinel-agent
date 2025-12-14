import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
            setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1); // -1 for tolerance
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
            {showLeftArrow && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-md border border-slate-200 dark:border-white/10 text-slate-600 hover:text-slate-900 dark:hover:text-white transition-all opacity-0 group-hover:opacity-100"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
            )}

            <div
                ref={scrollContainerRef}
                onScroll={checkScroll}
                className="flex gap-8 overflow-x-auto no-scrollbar scroll-smooth px-1"
            >
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`py-4 text-sm font-bold flex items-center border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.id
                            ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                            : 'border-transparent text-slate-600 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        {tab.icon && (
                            <tab.icon
                                className={`h-4 w-4 mr-2.5 ${activeTab === tab.id ? 'text-brand-500' : 'opacity-70'
                                    }`}
                            />
                        )}
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab.id
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {showRightArrow && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-md border border-slate-200 dark:border-white/10 text-slate-600 hover:text-slate-900 dark:hover:text-white transition-all opacity-0 group-hover:opacity-100"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            )}
        </div>
    );
};
