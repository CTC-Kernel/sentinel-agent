import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Save, Trash2, Server, Shield, Clock } from 'lucide-react';
import { Asset } from '../../types';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/EmptyState';

interface Strategy {
    id: string;
    organizationId: string;
    title: string;
    description: string;
    type: 'Active-Active' | 'Active-Passive' | 'Cold Standby' | 'Cloud DR';
    rto: string;
    rpo: string;
    linkedAssets: string[];
}

interface ContinuityStrategiesProps {
    assets: Asset[];
}

export const ContinuityStrategies: React.FC<ContinuityStrategiesProps> = ({ assets }) => {
    const { user, addToast } = useStore();
    const [isEditing, setIsEditing] = useState(false);
    const [newStrategy, setNewStrategy] = useState<Partial<Strategy>>({});

    const { data: strategies, refresh } = useFirestoreCollection<Strategy>('bcp_strategies');

    const handleSave = async () => {
        if (!newStrategy.title || !newStrategy.type) return;

        try {
            await addDoc(collection(db, 'bcp_strategies'), {
                ...newStrategy,
                organizationId: user?.organizationId,
                createdAt: new Date().toISOString(),
                linkedAssets: newStrategy.linkedAssets || []
            });
            addToast('Stratégie ajoutée', 'success');
            setIsEditing(false);
            setNewStrategy({});
            refresh();
        } catch (error) {
            console.error(error);
            addToast('Erreur lors de la sauvegarde', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cette stratégie ?')) return;
        try {
            await deleteDoc(doc(db, 'bcp_strategies', id));
            refresh();
            addToast('Stratégie supprimée', 'success');
        } catch {
            addToast('Erreur suppression', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Stratégies de Continuité</h2>
                    <p className="text-sm text-slate-500">Définissez vos stratégies de reprise (PCA/PRA) pour vos actifs critiques.</p>
                </div>
                <Button onClick={() => setIsEditing(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Nouvelle Stratégie
                </Button>
            </div>

            {isEditing && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6 rounded-2xl border border-brand-500/30">
                    <h3 className="font-bold mb-4">Nouvelle Stratégie</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input
                            placeholder="Titre (ex: Réplication S3 Cross-Region)"
                            className="input-field"
                            value={newStrategy.title || ''}
                            onChange={e => setNewStrategy({ ...newStrategy, title: e.target.value })}
                        />
                        <select
                            className="input-field"
                            value={newStrategy.type || ''}
                            onChange={e => setNewStrategy({ ...newStrategy, type: e.target.value as 'Active-Active' | 'Active-Passive' | 'Cold Standby' | 'Cloud DR' })}
                        >
                            <option value="">Sélectionner un type...</option>
                            <option value="Active-Active">Active-Active (Haute Dispo)</option>
                            <option value="Active-Passive">Active-Passive (Failover)</option>
                            <option value="Cold Standby">Cold Standby (Redémarrage manuel)</option>
                            <option value="Cloud DR">Cloud Disaster Recovery</option>
                        </select>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Clock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                <input placeholder="RTO (ex: 4h)" className="input-field pl-10" value={newStrategy.rto || ''} onChange={e => setNewStrategy({ ...newStrategy, rto: e.target.value })} />
                            </div>
                            <div className="flex-1 relative">
                                <DatabaseIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                <input placeholder="RPO (ex: 15min)" className="input-field pl-10" value={newStrategy.rpo || ''} onChange={e => setNewStrategy({ ...newStrategy, rpo: e.target.value })} />
                            </div>
                        </div>
                        <select
                            multiple
                            className="input-field h-24"
                            onChange={e => {
                                const selected = Array.from(e.target.selectedOptions, option => option.value);
                                setNewStrategy({ ...newStrategy, linkedAssets: selected });
                            }}
                        >
                            {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setIsEditing(false)}>Annuler</Button>
                        <Button onClick={handleSave} className="bg-brand-600 text-white"><Save className="w-4 h-4 mr-2" /> Enregistrer</Button>
                    </div>
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {strategies.map(strategy => (
                    <div key={strategy.id} className="glass-panel p-6 rounded-2xl relative group hover:border-brand-500/30 transition-all">
                        <button onClick={() => handleDelete(strategy.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                                <Shield className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">{strategy.title}</h3>
                                <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500">{strategy.type}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                            <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg text-center">
                                <span className="block text-xs text-slate-500 uppercase font-bold">RTO Cible</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{strategy.rto}</span>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-lg text-center">
                                <span className="block text-xs text-slate-500 uppercase font-bold">RPO Cible</span>
                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{strategy.rpo}</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Actifs Couverts</p>
                            <div className="flex flex-wrap gap-2">
                                {strategy.linkedAssets?.map(assetId => {
                                    const asset = assets.find(a => a.id === assetId);
                                    return asset ? (
                                        <span key={assetId} className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md border border-emerald-100">
                                            <Server className="w-3 h-3" /> {asset.name}
                                        </span>
                                    ) : null;
                                })}
                                {(!strategy.linkedAssets || strategy.linkedAssets.length === 0) && <span className="text-xs text-slate-400 italic">Aucun actif lié</span>}
                            </div>
                        </div>
                    </div>
                ))}

                {strategies.length === 0 && !isEditing && (
                    <div className="col-span-full">
                        <EmptyState
                            icon={Shield}
                            title="Aucune stratégie définie"
                            description="Commencez par définir vos stratégies de continuité pour protéger vos actifs critiques."
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

// Simple Icon component for the form
const DatabaseIcon = (props: any) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s 9-1.34 9-3V5"></path></svg>
);
