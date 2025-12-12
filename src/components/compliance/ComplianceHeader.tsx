import React from 'react';
import { Framework } from '../../types';
import { LayoutGrid, Globe, Download, FileText } from 'lucide-react';

interface ComplianceHeaderProps {
    currentFramework: Framework;
    setCurrentFramework: (fw: Framework) => void;
    viewMode: 'compliance' | 'watch';
    setViewMode: (mode: 'compliance' | 'watch') => void;
    complianceFrameworks: { value: string; label: string }[];
}

export const ComplianceHeader: React.FC<ComplianceHeaderProps> = ({
    currentFramework,
    setCurrentFramework,
    viewMode,
    setViewMode,
    complianceFrameworks
}) => {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Conformité & Standards
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Pilotez votre conformité aux normes ISO, NIS2, DORA et RGPD.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all">
                        <Download className="h-5 w-5" />
                    </button>
                    <button className="p-2.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all">
                        <FileText className="h-5 w-5" />
                    </button>
                    <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10 mx-1 hidden md:block"></div>
                    <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode('compliance')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'compliance'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <LayoutGrid className="h-4 w-4" />
                            <span className="hidden sm:inline">Pilotage</span>
                        </button>
                        <button
                            onClick={() => setViewMode('watch')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'watch'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <Globe className="h-4 w-4" />
                            <span className="hidden sm:inline">Veille Reg.</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Framework Selector */}
            <div className="flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar gap-2">
                {complianceFrameworks.map(fw => (
                    <button
                        key={fw.value}
                        onClick={() => setCurrentFramework(fw.value as Framework)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${currentFramework === fw.value
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg shadow-slate-900/20'
                            : 'bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                            }`}
                    >
                        {fw.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
