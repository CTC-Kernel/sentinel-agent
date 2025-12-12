import React, { useState } from 'react';
import { X, Search, Check } from 'lucide-react';

interface Item {
    id: string;
    label: string;
    subLabel?: string;
    icon?: any;
}

interface ItemSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: Item[];
    onSelect: (id: string) => void;
    searchPlaceholder?: string;
    selectedIds?: string[]; // IDs already linked/selected to disable or hide them
}

export const ItemSelectorModal: React.FC<ItemSelectorModalProps> = ({
    isOpen,
    onClose,
    title,
    items,
    onSelect,
    searchPlaceholder = "Rechercher...",
    selectedIds = []
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    const filteredItems: Item[] = items.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subLabel?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Body */}
                <div className="overflow-y-auto p-2 flex-1">
                    {filteredItems.length > 0 ? (
                        <div className="space-y-1">
                            {filteredItems.map(item => {
                                const isSelected = selectedIds.includes(item.id);
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            if (!isSelected) {
                                                onSelect(item.id);
                                                onClose();
                                            }
                                        }}
                                        disabled={isSelected}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${isSelected
                                            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-white/5'
                                            : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-[0.99]'
                                            }`}
                                    >
                                        {item.icon && (
                                            <div className="p-2 bg-slate-100 dark:bg-white/10 rounded-lg text-slate-500">
                                                <item.icon className="w-4 h-4" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                {item.label}
                                            </p>
                                            {item.subLabel && (
                                                <p className="text-xs text-slate-500 truncate">
                                                    {item.subLabel}
                                                </p>
                                            )}
                                        </div>
                                        {isSelected && <Check className="w-4 h-4 text-green-500" />}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            <p className="text-sm">Aucun résultat trouvé.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
