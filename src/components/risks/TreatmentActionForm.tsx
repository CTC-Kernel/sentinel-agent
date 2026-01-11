import React, { useState } from 'react';
import { TreatmentAction, TreatmentActionStatus } from '../../types';
import { Calendar, User, X, Check } from '../ui/Icons';
import { Button } from '../ui/button';

interface TreatmentActionFormProps {
    action?: TreatmentAction; // If provided, editing mode
    users: { uid: string; displayName: string }[];
    onSave: (action: Omit<TreatmentAction, 'id' | 'createdAt'> & { id?: string }) => void;
    onCancel: () => void;
}

export const TreatmentActionForm: React.FC<TreatmentActionFormProps> = ({
    action,
    users,
    onSave,
    onCancel
}) => {
    const [title, setTitle] = useState(action?.title || '');
    const [description, setDescription] = useState(action?.description || '');
    const [ownerId, setOwnerId] = useState(action?.ownerId || '');
    const [deadline, setDeadline] = useState(action?.deadline || '');
    const [status, setStatus] = useState<TreatmentActionStatus>(action?.status || 'À faire');

    const [errors, setErrors] = useState<{ title?: string }>({});

    const validate = (): boolean => {
        const newErrors: { title?: string } = {};
        if (!title.trim()) {
            newErrors.title = 'Le titre est requis';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        onSave({
            id: action?.id,
            title: title.trim(),
            description: description.trim() || undefined,
            ownerId: ownerId || undefined,
            deadline: deadline || undefined,
            status,
            updatedAt: new Date().toISOString(),
            completedAt: status === 'Terminé' ? new Date().toISOString() : action?.completedAt
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {action ? 'Modifier l\'action' : 'Nouvelle action'}
                </h4>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    aria-label="Annuler"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Titre <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Mettre à jour la politique de sécurité"
                    className={`w-full rounded-xl border ${errors.title ? 'border-red-500' : 'border-slate-200 dark:border-white/10'} bg-white dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none placeholder:text-slate-400`}
                />
                {errors.title && (
                    <p className="text-xs text-red-500">{errors.title}</p>
                )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Description
                </label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="Décrivez l'action à réaliser..."
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none placeholder:text-slate-400 resize-none"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Owner */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Responsable
                    </label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select
                            value={ownerId}
                            onChange={(e) => setOwnerId(e.target.value)}
                            className="w-full pl-9 pr-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none appearance-none"
                        >
                            <option value="">Non assigné</option>
                            {users.map(u => (
                                <option key={u.uid} value={u.uid}>{u.displayName}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Deadline */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Échéance
                    </label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            className="w-full pl-9 pr-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                        />
                    </div>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Statut
                    </label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as TreatmentActionStatus)}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-sm p-3 font-medium transition-all focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none appearance-none"
                    >
                        <option value="À faire">À faire</option>
                        <option value="En cours">En cours</option>
                        <option value="Terminé">Terminé</option>
                    </select>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                >
                    Annuler
                </Button>
                <Button
                    type="submit"
                    variant="default"
                    size="sm"
                    className="gap-1"
                >
                    <Check className="h-4 w-4" />
                    {action ? 'Enregistrer' : 'Ajouter'}
                </Button>
            </div>
        </form>
    );
};
