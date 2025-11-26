import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, User } from 'lucide-react';
import { Project } from '../../types';
import { AIAssistButton } from '../ai/AIAssistButton';

interface ProjectFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (project: Omit<Project, 'id' | 'organizationId' | 'tasks' | 'progress' | 'createdAt'>) => void;
    existingProject?: Project;
    availableUsers?: string[]; // list of manager display names
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    existingProject,
    availableUsers = [],
}) => {
    const [formData, setFormData] = useState<Omit<Project, 'id' | 'organizationId' | 'tasks' | 'progress' | 'createdAt'>>({
        name: existingProject?.name || '',
        description: existingProject?.description || '',
        manager: existingProject?.manager || '',
        status: existingProject?.status || 'Planifié',
        dueDate: existingProject?.dueDate || '',
        relatedRiskIds: existingProject?.relatedRiskIds || [],
        relatedControlIds: existingProject?.relatedControlIds || [],
        relatedAssetIds: existingProject?.relatedAssetIds || [],
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.name?.trim()) newErrors.name = 'Le nom du projet est requis';
        if (!formData.manager?.trim()) newErrors.manager = 'Le manager est requis';
        if (!formData.dueDate) newErrors.dueDate = "La date d'échéance est requise";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSubmit(formData);
            onClose();
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/10 animate-scale-in">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-white/10 px-8 py-6 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {existingProject ? 'Modifier le projet' : 'Nouveau Projet'}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {existingProject ? 'Mettez à jour les informations du projet' : "Définissez les détails du projet"}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom *</label>
                        <input
                            required
                            className={`w-full px-4 py-3.5 rounded-2xl border ${errors.name ? 'border-red-500' : 'border-gray-200 dark:border-white/10'} bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium`}
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>
                    {/* Description */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Description *</label>
                            <AIAssistButton
                                context={{
                                    projectName: formData.name,
                                    manager: formData.manager,
                                    dueDate: formData.dueDate
                                }}
                                fieldName="description"
                                onSuggest={(val: string) => setFormData({ ...formData, description: val })}
                                prompt="Génère une description professionnelle et concise pour ce projet de sécurité (SSI/GRC). Inclus les objectifs principaux basés sur le nom du projet."
                            />
                        </div>
                        <textarea
                            required
                            className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium resize-none"
                            rows={3}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                    {/* Manager & Due Date */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <User className="h-3.5 w-3.5" /> Manager *</label>
                            {availableUsers.length > 0 ? (
                                <select
                                    required
                                    className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                                    value={formData.manager}
                                    onChange={e => setFormData({ ...formData, manager: e.target.value })}
                                >
                                    <option value="">Non assigné</option>
                                    {availableUsers.map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    required
                                    className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                    value={formData.manager}
                                    onChange={e => setFormData({ ...formData, manager: e.target.value })}
                                    placeholder="Nom du manager"
                                />
                            )}
                            {errors.manager && <p className="text-red-500 text-xs mt-1">{errors.manager}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" /> Échéance *</label>
                            <input
                                required
                                type="date"
                                className={`w-full px-4 py-3.5 rounded-2xl border ${errors.dueDate ? 'border-red-500' : 'border-gray-200 dark:border-white/10'} bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium`}
                                value={formData.dueDate}
                                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                            />
                            {errors.dueDate && <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>}
                        </div>
                    </div>
                    {/* Status */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label>
                        <select
                            className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                        >
                            <option value="Planifié">Planifié</option>
                            <option value="En cours">En cours</option>
                            <option value="Terminé">Terminé</option>
                            <option value="Suspendu">Suspendu</option>
                        </select>
                    </div>
                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button type="button" onClick={onClose} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                            Annuler
                        </button>
                        <button type="submit" className="px-8 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 hover:scale-105 transition-all font-bold text-sm shadow-lg shadow-brand-500/30">
                            {existingProject ? 'Mettre à jour' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
