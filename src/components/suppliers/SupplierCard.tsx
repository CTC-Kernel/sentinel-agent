import React, { memo } from 'react';
import { Supplier, Criticality } from '../../types';
import { Building, Truck, ShieldAlert } from '../ui/Icons';
// Focus indicators: focus-visible:ring-2 applied globally via CSS

const getCriticalityColor = (c: Criticality) => {
    switch (c) {
        case Criticality.CRITICAL: return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
        case Criticality.HIGH: return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';
        case Criticality.MEDIUM: return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
        default: return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    }
};

const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
};

interface SupplierCardProps {
    supplier: Supplier;
    onClick: (supplier: Supplier) => void;
    onDelete?: () => void;
}

export const SupplierCard = memo(({ supplier, onClick }: SupplierCardProps) => {
    const isExpired = supplier.contractEnd && new Date(supplier.contractEnd) < new Date();

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(supplier);
        }
    };

    return (
        <div
            onClick={() => onClick(supplier)}
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="glass-panel p-6 rounded-[2.5rem] shadow-sm card-hover cursor-pointer group flex flex-col border border-white/50 dark:border-white/5 relative overflow-hidden h-full hover:border-brand-500 dark:hover:border-brand-400 transition-colors"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            <div className="relative z-10 flex flex-col h-full">

                <div className="flex justify-between items-start mb-5">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 shadow-inner group-hover:bg-brand-50 dark:group-hover:bg-brand-900/10 group-hover:text-brand-600 transition-colors">
                        {supplier.category === 'Matériel' ? <Truck className="h-6 w-6" /> : <Building className="h-6 w-6" />}
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase border shadow-sm ${getCriticalityColor(supplier.criticality || Criticality.MEDIUM)}`}>
                        {supplier.criticality}
                    </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 leading-tight">{supplier.name}</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                    <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">{supplier.category}</span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wide border ${supplier.status === 'Actif' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20' : 'bg-gray-50 text-slate-600 border-gray-200'}`}>{supplier.status}</span>
                    {supplier.isICTProvider && (
                        <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-slate-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800">DORA ICT</span>
                    )}
                </div>

                <div className="mb-6 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                    <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center font-bold uppercase tracking-wide"><ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> Sécurité</span>
                        <span className={`font-black ${getScoreColor(supplier.securityScore || 0).replace('bg-', 'text-')}`}>{supplier.securityScore || 0}/100</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-4">
                        <div className={`h-1.5 rounded-full ${getScoreColor(supplier.securityScore || 0)} transition-all duration-1000`} style={{ width: `${supplier.securityScore || 0}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Contrat</span>
                        {supplier.contractEnd ? (
                            <span className={`font-medium ${isExpired ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>{new Date(supplier.contractEnd).toLocaleDateString()}</span>
                        ) : <span className="text-slate-400">-</span>}
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center">
                        {supplier.contactName && <span className="font-medium mr-1">{supplier.contactName}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
});
