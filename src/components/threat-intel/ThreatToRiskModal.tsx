import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2, Save, X, Box } from 'lucide-react';
import { useStore } from '../../store';
import { db } from '../../firebase';
import { addDoc, collection, updateDoc, doc } from 'firebase/firestore';
import { Button } from '../ui/button';
import { Threat, Asset } from '../../types';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { ErrorLogger } from '../../services/errorLogger';

const schema = z.object({
    assetId: z.string().min(1, "L'actif est requis"),
    scenario: z.string().min(10, "Le scénario est requis"),
    probability: z.string(), // Form returns string usually
    impact: z.string(),
    strategy: z.enum(['Accepter', 'Atténuer', 'Transférer', 'Éviter']),
});

type FormData = z.infer<typeof schema>;

interface ThreatToRiskModalProps {
    isOpen: boolean;
    onClose: () => void;
    threat: Threat | null;
}

export const ThreatToRiskModal: React.FC<ThreatToRiskModalProps> = ({ isOpen, onClose, threat }) => {
    const { user, addToast } = useStore();
    const { data: assets } = useFirestoreCollection<Asset>('assets', [], { realtime: false });

    const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            probability: '3',
            impact: '3',
            strategy: 'Atténuer'
        }
    });

    useEffect(() => {
        if (threat) {
            setValue('scenario', `Menace détectée : ${threat.title}\n\nSource : Threat Intel (${threat.source || 'Community'})`);
        }
    }, [threat, setValue]);

    const onSubmit = async (data: FormData) => {
        if (!user || !threat) return;
        try {
            const prob = parseInt(data.probability);
            const imp = parseInt(data.impact);
            const score = prob * imp;

            const docRef = await addDoc(collection(db, 'risks'), {
                organizationId: user.organizationId,
                assetId: data.assetId,
                threat: threat.title,
                scenario: data.scenario,
                vulnerability: 'Source externe (Threat Intel)',
                probability: prob,
                impact: imp,
                score: score,
                strategy: data.strategy,
                status: 'Ouvert',
                owner: user.email,
                ownerId: user.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                framework: 'ISO27005',
                relatedThreatId: threat.id
            });

            // Bidirectional linking: Mark threat as processed into a risk
            const threatRef = doc(db, 'threats', threat.id);
            await updateDoc(threatRef, {
                relatedRiskId: docRef.id,
                status: 'Processed'
            });

            addToast("Risque créé avec succès", "success");
            reset();
            onClose();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ThreatToRiskModal.onSubmit', 'CREATE_FAILED');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && threat && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-modal"
                    />
                    <div className="fixed inset-0 flex items-center justify-center z-modal p-4 pointer-events-none">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-white/20 pointer-events-auto overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                                        Mettre en Risque
                                    </h2>
                                    <p className="text-sm text-slate-500">Transformer <span className="font-bold">{threat.title}</span> en risque formel.</p>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                                    <X className="h-5 w-5 text-slate-400" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Actif concerné
                                    </label>
                                    <div className="relative">
                                        <Box className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                                        <input
                                            list="asset-list"
                                            placeholder="Rechercher un actif..."
                                            className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white pl-10 pr-4 py-2.5 outline-none border focus:ring-2 focus:ring-brand-500"
                                            {...register('assetId')}
                                        />
                                        <datalist id="asset-list">
                                            {assets.map(asset => (
                                                <option key={asset.id} value={asset.id}>{asset.name} ({asset.type})</option>
                                            ))}
                                        </datalist>
                                    </div>
                                    {errors.assetId && <p className="text-red-500 text-xs mt-1">Veuillez sélectionner un actif valide.</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scénario de Risque</label>
                                    <textarea
                                        {...register('scenario')}
                                        rows={4}
                                        className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-2.5 outline-none border focus:ring-2 focus:ring-brand-500 resize-none"
                                    />
                                    {errors.scenario && <p className="text-red-500 text-xs mt-1">{errors.scenario.message}</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Probabilité (1-5)</label>
                                        <select {...register('probability')} className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-white">
                                            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Impact (1-5)</label>
                                        <select {...register('impact')} className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-white">
                                            {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Stratégie</label>
                                    <select {...register('strategy')} className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-white">
                                        <option value="Atténuer">Atténuer</option>
                                        <option value="Accepter">Accepter</option>
                                        <option value="Transférer">Transférer</option>
                                        <option value="Éviter">Éviter</option>
                                    </select>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                                        Annuler
                                    </Button>
                                    <Button type="submit" className="bg-brand-600 hover:bg-brand-500 text-white min-w-[120px]" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Créer Risque
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
