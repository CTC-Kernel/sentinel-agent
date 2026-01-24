/**
 * Document Template Modal
 * Story 6.4: Regulatory Document Templates
 * Allows users to create documents from pre-defined templates
 */

import React, { useState, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { DOCUMENT_TEMPLATES, getTemplatesByCategory, DocumentTemplate } from '../../data/documentTemplates';
import { X, FileText, Shield, Lock, AlertTriangle, Database, FileCheck, UserCheck, ChevronRight, Search } from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface DocumentTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (template: DocumentTemplate) => void;
}

// Icon mapping for templates
const iconMap: Record<string, React.ElementType> = {
    Shield,
    Lock,
    FileCheck,
    AlertTriangle,
    Database,
    GitBranch: ChevronRight, // Fallback
    UserCheck,
    FileText
};

export const DocumentTemplateModal: React.FC<DocumentTemplateModalProps> = ({
    isOpen,
    onClose,
    onSelect
}) => {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null);

    const templatesByCategory = useMemo(() => getTemplatesByCategory(), []);
    const categories = Object.keys(templatesByCategory);

    // Filter templates by search
    const filteredTemplates = useMemo(() => {
        let templates = selectedCategory
            ? templatesByCategory[selectedCategory]
            : DOCUMENT_TEMPLATES;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            templates = templates.filter(t =>
                t.title.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query) ||
                t.controlReference?.toLowerCase().includes(query)
            );
        }

        return templates;
    }, [selectedCategory, searchQuery, templatesByCategory]);

    const handleSelect = (template: DocumentTemplate) => {
        onSelect(template);
        onClose();
    };

    const getIcon = (iconName: string): React.FC<{ className?: string }> => {
        return (iconMap[iconName] || FileText) as React.FC<{ className?: string }>;
    };

    return (
        <Transition show={isOpen} as={React.Fragment}>
            <Dialog onClose={onClose} className="relative z-50">
                <Transition.Child
                    as={React.Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={React.Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
                                {/* Header */}
                                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                    <div>
                                        <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white">
                                            Créer depuis un modèle
                                        </Dialog.Title>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Sélectionnez un modèle de document réglementaire
                                        </p>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <X className="h-5 w-5 text-slate-500" />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="flex h-[500px]">
                                    {/* Sidebar - Categories */}
                                    <div className="w-48 border-r border-slate-200 dark:border-slate-800 p-4 space-y-2">
                                        <button
                                            onClick={() => setSelectedCategory(null)}
                                            className={cn(
                                                "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                                selectedCategory === null
                                                    ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            )}
                                        >
                                            Tous ({DOCUMENT_TEMPLATES.length})
                                        </button>
                                        {categories.map(category => (
                                            <button
                                                key={category}
                                                onClick={() => setSelectedCategory(category)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                                    selectedCategory === category
                                                        ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                )}
                                            >
                                                {category} ({templatesByCategory[category].length})
                                            </button>
                                        ))}
                                    </div>

                                    {/* Main Content */}
                                    <div className="flex-1 flex flex-col">
                                        {/* Search */}
                                        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder="Rechercher un modèle..."
                                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus-visible:ring-brand-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>

                                        {/* Templates Grid */}
                                        <div className="flex-1 overflow-y-auto p-4">
                                            {filteredTemplates.length === 0 ? (
                                                <div className="text-center py-12 text-slate-500">
                                                    Aucun modèle trouvé
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-4">
                                                    {filteredTemplates.map(template => {
                                                        const Icon = getIcon(template.icon);
                                                        return (
                                                            <button
                                                                key={template.id}
                                                                onClick={() => setPreviewTemplate(template)}
                                                                className={cn(
                                                                    "text-left p-4 rounded-xl border transition-all",
                                                                    previewTemplate?.id === template.id
                                                                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 ring-2 ring-brand-500"
                                                                        : "border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                                )}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <div className={cn(
                                                                        "w-10 h-10 rounded-lg flex items-center justify-center",
                                                                        template.type === 'Politique'
                                                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                                                            : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                                                                    )}>
                                                                        <Icon className="h-5 w-5" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="font-medium text-slate-900 dark:text-white text-sm truncate">
                                                                            {template.title}
                                                                        </h4>
                                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                                                            {template.description}
                                                                        </p>
                                                                        <div className="flex items-center gap-2 mt-2">
                                                                            <Badge status="info" size="sm">
                                                                                {template.type}
                                                                            </Badge>
                                                                            {template.controlReference && (
                                                                                <span className="text-xs text-muted-foreground font-mono">
                                                                                    {template.controlReference}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Preview Panel */}
                                    {previewTemplate && (
                                        <div className="w-80 border-l border-slate-200 dark:border-slate-800 flex flex-col">
                                            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                                                <h3 className="font-bold text-slate-900 dark:text-white">
                                                    Aperçu
                                                </h3>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-4">
                                                <h4 className="font-medium text-slate-900 dark:text-white mb-2">
                                                    {previewTemplate.title}
                                                </h4>
                                                <p className="text-sm text-slate-500 mb-4">
                                                    {previewTemplate.description}
                                                </p>
                                                <div className="space-y-2 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Type:</span>
                                                        <span className="font-medium">{previewTemplate.type}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Catégorie:</span>
                                                        <span className="font-medium">{previewTemplate.category}</span>
                                                    </div>
                                                    {previewTemplate.controlReference && (
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Référence:</span>
                                                            <span className="font-mono">{previewTemplate.controlReference}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-4 p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                                                    <p className="text-xs text-warning-700 dark:text-warning-300">
                                                        Les sections marquées [À_PERSONNALISER] doivent être adaptées à votre organisation.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                                                <Button
                                                    onClick={() => handleSelect(previewTemplate)}
                                                    className="w-full"
                                                >
                                                    <FileText className="h-4 w-4 mr-2" />
                                                    Utiliser ce modèle
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};
