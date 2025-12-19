import React from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '../ui/Modal';
import { BusinessProcess, BcpDrill } from '../../types';
import { Loader2 } from 'lucide-react';

interface DrillModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<BcpDrill>) => Promise<void>;
    processes: BusinessProcess[];
}

export const DrillModal: React.FC<DrillModalProps> = ({ isOpen, onClose, onSubmit, processes }) => {
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Partial<BcpDrill>>();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Enregistrer un Exercice">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Processus Testé</label>
                    <select {...register('processId', { required: 'Requis' })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white sm:text-sm p-3">
                        <option value="">Sélectionner un processus...</option>
                        {processes.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    {errors.processId && <span className="text-red-500 text-xs">Requis</span>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Type d'Exercice</label>
                    <select {...register('type', { required: 'Requis' })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white sm:text-sm p-3">
                        <option value="Tabletop">Tabletop (Sur table)</option>
                        <option value="Simulation">Simulation Technique</option>
                        <option value="Full Scale">Grandeur Nature</option>
                        <option value="Call Tree">Arbre d'Appel</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date de l'Exercice</label>
                    <input type="date" {...register('date', { required: 'Requis' })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white sm:text-sm p-3" />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Résultat</label>
                    <select {...register('result', { required: 'Requis' })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white sm:text-sm p-3">
                        <option value="Succès">Succès</option>
                        <option value="Partiel">Partiel</option>
                        <option value="Échec">Échec</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes / Observations</label>
                    <textarea {...register('notes')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white sm:text-sm p-3" rows={3} placeholder="Observations, leçons apprises..." />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">Annuler</button>
                    <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50">
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Enregistrer
                    </button>
                </div>
            </form>
        </Modal>
    );
};
