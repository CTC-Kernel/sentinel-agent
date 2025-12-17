import React, { useEffect, useState } from 'react';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ThreatTemplate } from '../types';
import { RISK_TEMPLATES } from '../data/riskTemplates';
import { useStore } from '../store';
import { Plus, Search, Trash2, ShieldAlert, BookOpen, AlertTriangle, Shield, Database, RefreshCw } from '../components/ui/Icons';
import { Modal } from '../components/ui/Modal';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { FloatingLabelSelect } from '../components/ui/FloatingLabelSelect';
import { FloatingLabelTextarea } from '../components/ui/FloatingLabelTextarea';
import { logAction } from '../services/logger';
import { sanitizeData } from '../utils/dataSanitizer';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';

export const ThreatRegistry: React.FC = () => {
    const { user, addToast } = useStore();
    const [threats, setThreats] = useState<ThreatTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedThreat, setSelectedThreat] = useState<ThreatTemplate | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState<Partial<ThreatTemplate>>({});

    useEffect(() => {
        if (!user?.organizationId) return;

        const q = query(collection(db, 'threat_library'), where('organizationId', '==', user.organizationId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ThreatTemplate));
            setThreats(items);
            setLoading(false);
        }, (err) => {
            console.error("ThreatRegistry subscription error:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.organizationId]);

    const handleSeed = async () => {
        if (!user?.organizationId) return;
        if (threats.length > 0) {
            if (!window.confirm("La bibliothèque contient déjà des menaces. Voulez-vous vraiment importer les modèles standards (doublons possibles) ?")) {
                return;
            }
        }

        try {
            setLoading(true);
            const batch = writeBatch(db);
            let count = 0;

            RISK_TEMPLATES.forEach(template => {
                const docRef = doc(collection(db, 'threat_library'));
                batch.set(docRef, sanitizeData({
                    ...template,
                    organizationId: user.organizationId,
                    source: 'Standard',
                    createdAt: new Date().toISOString()
                }));
                count++;
            });

            await batch.commit();
            addToast(`${count} menaces standard importées`, 'success');
            await logAction(user, 'CREATE', 'ThreatLibrary', `Import de ${count} menaces standard`);
        } catch (error) {
            console.error(error);
            addToast("Erreur lors de l'import", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette menace ?")) return;
        try {
            await deleteDoc(doc(db, 'threat_library', id));
            addToast("Menace supprimée", "success");
            await logAction(user!, 'DELETE', 'ThreatLibrary', `Suppression menace ${id}`);
        } catch (error) {
            console.error("Delete threat error:", error);
            addToast("Erreur lors de la suppression", "error");
        }
    };

    const handleEdit = (threat: ThreatTemplate) => {
        setSelectedThreat(threat);
        setFormData(threat);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const dataToSave = sanitizeData({
                ...formData,
                organizationId: user!.organizationId,
                source: formData.source || 'Custom',
                createdAt: formData.createdAt || new Date().toISOString()
            });

            if (isEditing && selectedThreat?.id) {
                // remove id from update payload
                const updateData = { ...dataToSave };
                delete updateData.id;
                await updateDoc(doc(db, 'threat_library', selectedThreat.id), updateData);
                addToast("Menace modifiée", "success");
                await logAction(user!, 'UPDATE', 'ThreatLibrary', `Modification menace ${selectedThreat.name}`);
            } else {
                await addDoc(collection(db, 'threat_library'), dataToSave);
                addToast("Menace créée", "success");
                await logAction(user!, 'CREATE', 'ThreatLibrary', `Création menace ${dataToSave.name}`);
            }
            setShowModal(false);
            setFormData({});
        } catch (error) {
            console.error(error);
            addToast("Erreur lors de l'enregistrement", "error");
        } finally {
            setLoading(false);
        }
    };

    const filteredThreats = threats.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.threat.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="p-6 md:p-8 max-w-[1920px] mx-auto space-y-8 pb-20 relative min-h-screen animate-fade-in"
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
                        {threats.length === 0 && (
                            <button
                                onClick={handleSeed}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl flex items-center transition-all shadow-lg shadow-purple-500/20 text-sm font-bold"
                            >
                                <Database className="h-4 w-4 mr-2" />
                                Importer Standard
                            </button>
                        )}
                        <button
                            onClick={() => { setFormData({}); setShowModal(true); setIsEditing(false); }}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl flex items-center transition-all shadow-lg shadow-brand-500/20 text-sm font-bold"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nouvelle Menace
                        </button>
                    </div>
                }
            />

            <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-white/5 p-6 backdrop-blur-xl">
                <div className="flex items-center space-x-4 mb-6 relative">
                    <Search className="h-5 w-5 text-slate-500 absolute left-4" />
                    <input
                        type="text"
                        placeholder="Rechercher une menace, un scénario..."
                        className="w-full bg-slate-50 dark:bg-slate-900/50 pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder:text-slate-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
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
                            <button onClick={handleSeed} className="mt-6 text-brand-500 hover:underline">
                                Importer les modèles standards
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredThreats.map((threat) => (
                            <motion.div variants={slideUpVariants} key={threat.id}>
                                <div
                                    onClick={() => handleEdit(threat)}
                                    className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-6 border border-slate-100 dark:border-white/5 hover:border-brand-500/30 transition-all group relative overflow-hidden cursor-pointer hover:shadow-lg"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(threat.id!); }}
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
                        ))}
                    </div>
                )}
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={isEditing ? "Modifier la menace" : "Nouvelle menace"}
                maxWidth="max-w-3xl"
            >
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <FloatingLabelInput
                                label="Titre"
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="col-span-2">
                            <FloatingLabelTextarea
                                label="Description"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                required
                            />
                        </div>
                        <div className="col-span-1">
                            <FloatingLabelSelect
                                label="Cadre / Framework"
                                value={formData.framework || ''}
                                onChange={(e) => setFormData({ ...formData, framework: e.target.value })}
                                options={['ISO27005', 'EBIOS', 'NIST', 'HDS', 'PCI-DSS', 'SOC2', 'Autre'].map(v => ({ value: v, label: v }))}
                                required
                            />
                        </div>
                        <div className="col-span-1">
                            <FloatingLabelInput
                                label="Domaine / Champ"
                                value={formData.field || ''}
                                onChange={(e) => setFormData({ ...formData, field: e.target.value })}
                                required
                            />
                        </div>
                        <div className="col-span-2">
                            <FloatingLabelInput
                                label="Menace (Cause)"
                                value={formData.threat || ''}
                                onChange={(e) => setFormData({ ...formData, threat: e.target.value })}
                                required
                            />
                        </div>
                        <div className="col-span-2">
                            <FloatingLabelInput
                                label="Vulnérabilité"
                                value={formData.vulnerability || ''}
                                onChange={(e) => setFormData({ ...formData, vulnerability: e.target.value })}
                                required
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <FloatingLabelTextarea
                                label="Scénario"
                                value={formData.scenario || ''}
                                onChange={(e) => setFormData({ ...formData, scenario: e.target.value })}
                                required
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1 space-y-4">
                            <FloatingLabelSelect
                                label="Probabilité (Ref)"
                                value={formData.probability?.toString() || ''}
                                onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) })}
                                options={['1', '2', '3', '4', '5'].map(v => ({ value: v, label: v }))}
                                required
                            />
                            <FloatingLabelSelect
                                label="Impact (Ref)"
                                value={formData.impact?.toString() || ''}
                                onChange={(e) => setFormData({ ...formData, impact: parseInt(e.target.value) })}
                                options={['1', '2', '3', '4', '5'].map(v => ({ value: v, label: v }))}
                                required
                            />
                            <FloatingLabelSelect
                                label="Stratégie par défaut"
                                value={formData.strategy || ''}
                                onChange={(e) => setFormData({ ...formData, strategy: e.target.value as ThreatTemplate['strategy'] })}
                                options={['Accepter', 'Atténuer', 'Transférer', 'Éviter'].map(v => ({ value: v, label: v }))}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2 rounded-xl flex items-center shadow-lg shadow-brand-500/20"
                        >
                            {loading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                            {isEditing ? 'Enregistrer les modifications' : 'Créer la menace'}
                        </button>
                    </div>
                </form>
            </Modal>
        </motion.div>
    );
};
