import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PROJECT_TEMPLATES } from '../../utils/projectTemplates';
import { ProjectTemplate } from '../../types';
import { X, Zap, Calendar } from '../ui/Icons';

interface TemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: ProjectTemplate, projectName: string, startDate: Date, manager: string) => void;
    managers: string[];
}

export const TemplateModal: React.FC<TemplateModalProps> = ({ isOpen, onClose, onSelectTemplate, managers }) => {
    const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
    const [projectName, setProjectName] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [manager, setManager] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedTemplate && projectName && manager) {
            onSelectTemplate(selectedTemplate, projectName, new Date(startDate), manager);
            onClose();
            // Reset
            setSelectedTemplate(null);
            setProjectName('');
            setStartDate(new Date().toISOString().split('T')[0]);
            setManager('');
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-200 dark:border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Créer depuis un Template
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Démarrez rapidement avec un projet pré-configuré
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
                    {!selectedTemplate ? (
                        /* Template Selection */
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {PROJECT_TEMPLATES.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => setSelectedTemplate(template)}
                                        className="text-left p-6 rounded-xl border-2 border-slate-200 dark:border-white/10 hover:border-brand-500 dark:hover:border-brand-500 transition-all hover:shadow-lg group"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="text-4xl">{template.icon}</div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                                    {template.name}
                                                </h3>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                                    {template.description}
                                                </p>
                                                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {template.estimatedDuration} jours
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Zap className="h-3 w-3" />
                                                        {template.defaultTasks.length} tâches
                                                    </span>
                                                </div>
                                                <div className="mt-3">
                                                    <span className="px-2 py-1 bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 rounded-lg text-xs font-bold">
                                                        {template.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Template Configuration */
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="bg-brand-50 dark:bg-brand-900/10 p-4 rounded-xl border border-brand-200 dark:border-brand-800">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{selectedTemplate.icon}</span>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{selectedTemplate.name}</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">{selectedTemplate.description}</p>
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-3 text-xs">
                                    <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded-lg font-bold">
                                        {selectedTemplate.defaultTasks.length} tâches
                                    </span>
                                    <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded-lg font-bold">
                                        {selectedTemplate.defaultMilestones.length} jalons
                                    </span>
                                    <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded-lg font-bold">
                                        ~{selectedTemplate.estimatedDuration} jours
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Nom du Projet *
                                </label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="Ex: Certification ISO 27001 2025"
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Date de Début *
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Chef de Projet *
                                </label>
                                <select
                                    value={manager}
                                    onChange={(e) => setManager(e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                    required
                                >
                                    <option value="">Sélectionner...</option>
                                    {managers.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Ce qui sera créé:
                                </h4>
                                <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                    <li>✓ {selectedTemplate.defaultTasks.length} tâches pré-configurées</li>
                                    <li>✓ {selectedTemplate.defaultMilestones.length} jalons avec dates calculées</li>
                                    <li>✓ Date de fin estimée: {new Date(new Date(startDate).getTime() + selectedTemplate.estimatedDuration * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}</li>
                                </ul>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSelectedTemplate(null)}
                                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Retour
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20"
                                >
                                    Créer le Projet
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
