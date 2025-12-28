import React, { useState } from 'react';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { ThreatTemplate } from '../types';
import { useStore } from '../store';
import { useThreats } from '../hooks/useThreats';
import { Plus, Search, Trash2, ShieldAlert, BookOpen, AlertTriangle, Shield, Database, RefreshCw } from '../components/ui/Icons';
import { Modal } from '../components/ui/Modal';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { FloatingLabelSelect } from '../components/ui/FloatingLabelSelect';
import { FloatingLabelTextarea } from '../components/ui/FloatingLabelTextarea';
import { logAction } from '../services/logger';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { ConfirmModal } from '../components/ui/ConfirmModal';

import { hasPermission } from '../utils/permissions';

import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const threatSchema = z.object({
    name: z.string().min(1, 'Le titre est requis'),
    description: z.string().min(1, 'La description est requise'),
    framework: z.string().min(1, 'Le cadre est requis'),
    field: z.string().min(1, 'Le domaine est requis'),
    threat: z.string().min(1, 'La menace est requise'),
    vulnerability: z.string().min(1, 'La vulnérabilité est requise'),
    scenario: z.string().min(1, 'Le scénario est requis'),
    probability: z.number().min(1).max(5),
    impact: z.number().min(1).max(5),
    strategy: z.enum(['Accepter', 'Atténuer', 'Transférer', 'Éviter'] as const)
});

type ThreatFormData = z.infer<typeof threatSchema>;

export const ThreatRegistry: React.FC = () => {
    const { user } = useStore();
    const canEdit = hasPermission(user, 'Threat', 'manage');
    const { threats, loading, addThreat, updateThreat, deleteThreat, seedStandardThreats } = useThreats();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedThreat, setSelectedThreat] = useState<ThreatTemplate | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Modal State
    const [showModal, setShowModal] = useState(false);

    const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ThreatFormData>({
        resolver: zodResolver(threatSchema),
        defaultValues: {
            probability: 3,
            impact: 3,
            strategy: 'Atténuer'
        }
    });

    // Confirm Modal State
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const handleSeed = React.useCallback(async () => {
        const proceedWithSeed = async () => {
            try {
                const count = await seedStandardThreats();
                if (count) {
                    await logAction(user!, 'CREATE', 'ThreatLibrary', `Import de ${count} menaces standard`);
                }
                setConfirmData(prev => ({ ...prev, isOpen: false }));
            } catch {
                // Error already handled in hook
            }
        };

        if (threats.length > 0) {
            setConfirmData({
                isOpen: true,
                title: "Importer la bibliothèque standard ?",
                message: "La bibliothèque contient déjà des menaces. Voulez-vous vraiment importer les modèles standards (doublons possibles) ?",
                onConfirm: proceedWithSeed
            });
        } else {
            proceedWithSeed();
        }
    }, [threats.length, seedStandardThreats, user]);

    const handleDelete = React.useCallback(async (id: string) => {
        setConfirmData({
            isOpen: true,
            title: "Supprimer cette menace ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                try {
                    await deleteThreat(id);
                    await logAction(user!, 'DELETE', 'ThreatLibrary', `Suppression menace ${id}`);
                    setConfirmData(prev => ({ ...prev, isOpen: false }));
                } catch {
                    // Error handled in hook
                }
            }
        });
    }, [deleteThreat, user]);

    const handleEdit = React.useCallback((threat: ThreatTemplate) => {
        setSelectedThreat(threat);
        reset({
            name: threat.name,
            description: threat.description,
            framework: threat.framework,
            field: threat.field,
            threat: threat.threat,
            vulnerability: threat.vulnerability,
            scenario: threat.scenario,
            probability: threat.probability,
            impact: threat.impact,
            strategy: threat.strategy
        });
        setIsEditing(true);
        setShowModal(true);
    }, [reset]);

    const onSubmit: SubmitHandler<ThreatFormData> = async (data) => {
        try {
            if (isEditing && selectedThreat?.id) {
                await updateThreat(selectedThreat.id, data);
                await logAction(user!, 'UPDATE', 'ThreatLibrary', `Modification menace ${selectedThreat.name}`);
            } else {
                await addThreat(data);
                await logAction(user!, 'CREATE', 'ThreatLibrary', `Création menace ${data.name}`);
            }
            setShowModal(false);
            reset();
        } catch {
            // Error already handled in hook
        }
    };

    const handleConfirmClose = React.useCallback(() => setConfirmData(prev => ({ ...prev, isOpen: false })), []);
    const handleModalClose = React.useCallback(() => { setShowModal(false); reset(); }, [reset]);
    const handleNewThreat = React.useCallback(() => { reset(); setShowModal(true); setIsEditing(false); }, [reset]);
    const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value), []);

    const filteredThreats = threats.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.threat.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO title="Bibliothèque de Menaces" description="Référentiel des menaces et vulnérabilités (ISO 27005)" />

            <PageHeader
                title="Bibliothèque de Menaces"
                subtitle="Référentiel des menaces et vulnérabilités (ISO 27005)."
                icon={<ShieldAlert className="h-6 w-6 text-white" strokeWidth={2.5} />}
                breadcrumbs={[{ label: 'Menaces' }]}
                actions={
                    <div className="flex gap-3">
                        {threats.length === 0 && canEdit && (
                            <button
                                aria-label="Importer Standard"
                                onClick={handleSeed}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl flex items-center transition-all shadow-lg shadow-purple-500/20 text-sm font-bold"
                            >
                                <Database className="h-4 w-4 mr-2" />
                                Importer Standard
                            </button>
                        )}
                        {canEdit && (
                            <button
                                aria-label="Nouvelle Menace"
                                onClick={handleNewThreat}
                                className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl flex items-center transition-all shadow-lg shadow-brand-500/20 text-sm font-bold"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Nouvelle Menace
                            </button>
                        )}
                    </div>
                }
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={handleConfirmClose}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-white/5 p-6 backdrop-blur-xl">
                <div className="flex items-center space-x-4 mb-6 relative">
                    <Search className="h-5 w-5 text-slate-500 absolute left-4" />
                    <input value={searchTerm}
                        aria-label="Rechercher une menace"
                        type="text"
                        placeholder="Rechercher une menace, un scénario..."
                        className="w-full bg-slate-50 dark:bg-slate-900/50 pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-500"
                        onChange={handleSearchChange}
                    />
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                    </div>
                ) : filteredThreats.length === 0 ? (
                    <div className="text-center py-20">
                        <ShieldAlert className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">Aucune menace trouvée</h3>
                        <p className="text-slate-600 mt-2">Commencez par importer la bibliothèque standard ou créez votre première menace.</p>
                        {threats.length === 0 && (
                            <button aria-label="Importer les modèles standards" onClick={handleSeed} className="mt-6 text-brand-500 hover:underline">
                                Importer les modèles standards
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredThreats.map((threat) => (
                            <ThreatRegistryCard
                                key={threat.id}
                                threat={threat}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>

            <Modal
                isOpen={showModal}
                onClose={handleModalClose}
                title={isEditing ? "Modifier la menace" : "Nouvelle menace"}
                maxWidth="max-w-3xl"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <FloatingLabelInput
                                label="Titre"
                                {...register('name')}
                                error={errors.name?.message}
                            />
                        </div>
                        <div className="col-span-2">
                            <FloatingLabelTextarea
                                label="Description"
                                {...register('description')}
                                error={errors.description?.message}
                            />
                        </div>
                        <div className="col-span-1">
                            <FloatingLabelSelect
                                label="Cadre / Framework"
                                {...register('framework')}
                                error={errors.framework?.message}
                                options={['ISO27005', 'EBIOS', 'NIST', 'HDS', 'PCI-DSS', 'SOC2', 'Autre'].map(v => ({ value: v, label: v }))}
                            />
                        </div>
                        <div className="col-span-1">
                            <FloatingLabelInput
                                label="Domaine / Champ"
                                {...register('field')}
                                error={errors.field?.message}
                            />
                        </div>
                        <div className="col-span-2">
                            <FloatingLabelInput
                                label="Menace (Cause)"
                                {...register('threat')}
                                error={errors.threat?.message}
                            />
                        </div>
                        <div className="col-span-2">
                            <FloatingLabelInput
                                label="Vulnérabilité"
                                {...register('vulnerability')}
                                error={errors.vulnerability?.message}
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <FloatingLabelTextarea
                                label="Scénario"
                                {...register('scenario')}
                                error={errors.scenario?.message}
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1 space-y-4">
                            <FloatingLabelSelect
                                label="Probabilité (Ref)"
                                {...register('probability', { valueAsNumber: true })}
                                error={errors.probability?.message}
                                options={['1', '2', '3', '4', '5'].map(v => ({ value: v, label: v }))}
                            />
                            <FloatingLabelSelect
                                label="Impact (Ref)"
                                {...register('impact', { valueAsNumber: true })}
                                error={errors.impact?.message}
                                options={['1', '2', '3', '4', '5'].map(v => ({ value: v, label: v }))}
                            />
                            <FloatingLabelSelect
                                label="Stratégie par défaut"
                                {...register('strategy')}
                                error={errors.strategy?.message}
                                options={['Accepter', 'Atténuer', 'Transférer', 'Éviter'].map(v => ({ value: v, label: v }))}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            aria-label="Annuler"
                            onClick={handleModalClose}
                            className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            aria-label="Sauvegarder"
                            disabled={isSubmitting}
                            className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2 rounded-xl flex items-center shadow-lg shadow-brand-500/20 disabled:opacity-50"
                        >
                            {isSubmitting && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                            {isEditing ? 'Enregistrer les modifications' : 'Créer la menace'}
                        </button>
                    </div>
                </form>
            </Modal>
        </motion.div>
    );
};

const ThreatRegistryCard = React.memo(({
    threat,
    onEdit,
    onDelete
}: {
    threat: ThreatTemplate,
    onEdit: (t: ThreatTemplate) => void,
    onDelete: (id: string) => void
}) => {
    return (
        <motion.div variants={slideUpVariants}>
            <div
                onClick={() => onEdit(threat)}
                className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-6 border border-slate-100 dark:border-white/5 hover:border-brand-500/30 transition-all group relative overflow-hidden cursor-pointer hover:shadow-lg"
            >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(threat.id!); }}
                        aria-label="Supprimer la menace"
                        className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${threat.source === 'Standard' ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10' : 'bg-purple-50 text-purple-500 dark:bg-purple-500/10'}`}>
                        <Shield className="h-6 w-6" />
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 border border-slate-200 dark:border-white/10 px-2 py-1 rounded-full">
                        {threat.framework}
                    </span>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{threat.name}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4 h-10">{threat.description}</p>

                <div className="space-y-3">
                    <div className="flex items-center text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-black/20 p-2 rounded-lg">
                        <AlertTriangle className="h-3 w-3 mr-2 text-orange-500" />
                        <span className="truncate flex-1" title={threat.threat}>{threat.threat}</span>
                    </div>
                    <div className="flex items-center text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-black/20 p-2 rounded-lg">
                        <BookOpen className="h-3 w-3 mr-2 text-indigo-500" />
                        <span className="truncate flex-1" title={threat.vulnerability}>{threat.vulnerability}</span>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex justify-between items-center text-xs text-slate-500">
                    <span>{threat.field}</span>
                    <span className="flex items-center">
                        Score Ref: <span className="font-bold text-brand-500 ml-1">{threat.probability * threat.impact}</span>
                    </span>
                </div>
            </div>
        </motion.div>
    );
});
