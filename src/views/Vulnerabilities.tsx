import React, { useState, useMemo } from 'react';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { ShieldAlert, Search, Filter, Plus, Trash2, CheckCircle2 as CheckCircle, Clock, AlertOctagon, Server, AlertTriangle } from '../components/ui/Icons';
import { useStore } from '../store';
import { Vulnerability, Asset } from '../types';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { where, addDoc, collection, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { sanitizeData } from '../utils/dataSanitizer';
import { logAction } from '../services/logger';
import { ErrorLogger } from '../services/errorLogger';
import { Modal } from '../components/ui/Modal';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { FloatingLabelSelect } from '../components/ui/FloatingLabelSelect';
import { FloatingLabelTextarea } from '../components/ui/FloatingLabelTextarea';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';

export const Vulnerabilities: React.FC = () => {
    const { user, addToast } = useStore();
    const [viewMode] = useState<'list' | 'kanban'>('list');
    const [isCreating, setIsCreating] = useState(false);
    const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
    const [formData, setFormData] = useState<Partial<Vulnerability>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'Open' | 'In Progress' | 'Resolved' | 'All'>('Open');

    // Data Fetching
    const { data: vulnerabilities, loading: vulnLoading, refresh } = useFirestoreCollection<Vulnerability>(
        'vulnerabilities',
        [where('organizationId', '==', user?.organizationId)],
        { realtime: true }
    );

    const { data: assets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)]
    );

    // Derived State and KPIs
    const stats = useMemo(() => {
        const total = vulnerabilities.length;
        const critical = vulnerabilities.filter(v => v.severity === 'Critical' && v.status !== 'Resolved').length;
        const high = vulnerabilities.filter(v => v.severity === 'High' && v.status !== 'Resolved').length;
        const resolved = vulnerabilities.filter(v => v.status === 'Resolved').length;
        const remediationRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

        return { total, critical, high, resolved, remediationRate };
    }, [vulnerabilities]);

    const filteredVulns = useMemo(() => {
        return vulnerabilities.filter(v => {
            const matchesSearch = v.cveId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.assetName?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesTab = activeTab === 'All' ? true :
                activeTab === 'Resolved' ? v.status === 'Resolved' :
                    activeTab === 'In Progress' ? v.status === 'In Progress' :
                        v.status !== 'Resolved'; // Open usually means Not Resolved

            return matchesSearch && matchesTab;
        }).sort((a, b) => {
            const severityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
            return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
        });
    }, [vulnerabilities, searchTerm, activeTab]);

    const handleCreate = () => {
        setFormData({
            status: 'Open',
            severity: 'Medium',
            source: 'Manual',
            detectedAt: new Date().toISOString().split('T')[0]
        });
        setSelectedVuln(null);
        setIsCreating(true);
    };

    const handleEdit = (vuln: Vulnerability) => {
        setFormData(vuln);
        setSelectedVuln(vuln);
        setIsCreating(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.organizationId) return;

        try {
            const asset = assets.find(a => a.id === formData.assetId);
            const dataToSave = sanitizeData({
                ...formData,
                assetName: asset?.name || formData.assetName,
                organizationId: user.organizationId,
                updatedAt: new Date().toISOString()
            });

            if (selectedVuln?.id) {
                await updateDoc(doc(db, 'vulnerabilities', selectedVuln.id), dataToSave);
                logAction(user, 'UPDATE', 'Vulnerabilities', `Updated Vulnerability ${formData.cveId}`);
                addToast("Vulnérabilité mise à jour", "success");
            } else {
                await addDoc(collection(db, 'vulnerabilities'), {
                    ...dataToSave,
                    createdAt: new Date().toISOString()
                });
                logAction(user, 'CREATE', 'Vulnerabilities', `Created Vulnerability ${formData.cveId}`);
                addToast("Vulnérabilité créée", "success");
            }
            setIsCreating(false);
            refresh();
        } catch (error) {
            ErrorLogger.error(error, 'Vulnerabilities.handleSave');
            addToast("Erreur lors de l'enregistrement", "error");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer cette vulnérabilité ?")) return;
        try {
            await deleteDoc(doc(db, 'vulnerabilities', id));
            logAction(user, 'DELETE', 'Vulnerabilities', `Deleted Vulnerability ID: ${id}`);
            addToast("Supprimé avec succès", "success");
            refresh();
        } catch (error) {
            addToast("Erreur lors de la suppression", "error");
        }
    };

    const handleCreateRisk = async (vuln: Vulnerability) => {
        if (!user?.organizationId) return;
        try {
            await addDoc(collection(db, 'risks'), {
                organizationId: user.organizationId,
                assetId: vuln.assetId || '',
                threat: `Exploitation de ${vuln.cveId}`,
                vulnerability: vuln.description,
                probability: 3,
                impact: vuln.severity === 'Critical' ? 5 : vuln.severity === 'High' ? 4 : 3,
                score: (vuln.severity === 'Critical' ? 5 : 3) * 3,
                status: 'Ouvert',
                strategy: 'Atténuer',
                owner: user.email,
                createdAt: new Date().toISOString()
            });
            logAction(user, 'CREATE_RISK', 'Vulnerabilities', `Created Risk for Vuln ${vuln.cveId}`);
            addToast("Risque associé créé", "success");
        } catch (e) {
            addToast("Erreur création risque", "error");
        }
    };

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-8 pb-20">
            <MasterpieceBackground />
            <SEO title="Gestion des Vulnérabilités" description="Suivi et remédiation des vulnérabilités techniques." />

            <PageHeader
                title="Vulnérabilités"
                subtitle="Centre de gestion des vulnérabilités et remédiation"
                icon={<ShieldAlert className="h-6 w-6 text-white" />}
                breadcrumbs={[{ label: 'Gouvernance' }, { label: 'Vulnérabilités' }]}
                actions={
                    <button
                        onClick={handleCreate}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl flex items-center shadow-lg shadow-brand-500/20 text-sm font-bold transition-all"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvelle Vulnérabilité
                    </button>
                }
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Vulnérabilités Totales', value: stats.total, icon: ShieldAlert, color: 'text-blue-500' },
                    { label: 'Critiques', value: stats.critical, icon: AlertOctagon, color: 'text-red-500' },
                    { label: 'Élevées', value: stats.high, icon: AlertTriangle, color: 'text-orange-500' },
                    { label: 'Taux de Résolution', value: `${stats.remediationRate}%`, icon: CheckCircle, color: 'text-emerald-500' },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        variants={slideUpVariants}
                        className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 backdrop-blur-sm"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
                            {i === 3 && <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: stats.remediationRate + '%' }}></div></div>}
                        </div>
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.label}</div>
                    </motion.div>
                ))}
            </div>

            {/* Main Content */}
            <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-xl overflow-hidden min-h-[600px]">
                {/* Controls */}
                <div className="p-6 border-b border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl">
                        {['Open', 'In Progress', 'Resolved', 'All'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                {tab === 'All' ? 'Tout' : tab === 'Open' ? 'Ouvertes' : tab === 'In Progress' ? 'En Cours' : 'Résolues'}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Rechercher CVE, Actif..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                </div>

                {/* List View */}
                {viewMode === 'list' && (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-white/5 text-left">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Sévérité</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">CVE & Titre</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Actif Affecté</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Score</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Statut</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {vulnLoading ? (
                                    <tr><td colSpan={6} className="p-10 text-center"><LoadingScreen /></td></tr>
                                ) : filteredVulns.length === 0 ? (
                                    <tr><td colSpan={6} className="p-10"><EmptyState icon={ShieldAlert} title="Aucune vulnérabilité" description="Tout semble sécurisé pour le moment." /></td></tr>
                                ) : filteredVulns.map((vuln) => (
                                    <tr key={vuln.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <Badge
                                                status={vuln.severity === 'Critical' ? 'error' : vuln.severity === 'High' ? 'warning' : vuln.severity === 'Medium' ? 'info' : 'neutral'}
                                                variant="soft"
                                            >
                                                {vuln.severity}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900 dark:text-white">{vuln.cveId}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-[200px]" title={vuln.title || vuln.description}>{vuln.title || vuln.description}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <Server className="h-3 w-3 opacity-50" />
                                                {vuln.assetName || 'Non assigné'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-code font-bold text-slate-700 dark:text-slate-300">
                                            {vuln.score || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${vuln.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600' :
                                                vuln.status === 'In Progress' ? 'bg-blue-50 text-blue-600' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                {vuln.status === 'Resolved' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                                                {vuln.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleCreateRisk(vuln)} className="p-2 hover:bg-orange-50 text-orange-500 rounded-lg" title="Créer un risque">
                                                    <AlertTriangle className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => handleEdit(vuln)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 rounded-lg">
                                                    <Filter className="h-4 w-4" /> {/* Edit icon proxy */}
                                                </button>
                                                <button onClick={() => handleDelete(vuln.id!)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title={selectedVuln ? `Modifier ${selectedVuln.cveId}` : "Nouvelle Vulnérabilité"} maxWidth="max-w-2xl">
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <FloatingLabelInput label="CVE ID (ex: CVE-2024-1234)" value={formData.cveId || ''} onChange={(e) => setFormData({ ...formData, cveId: e.target.value })} required />
                        <FloatingLabelSelect label="Sévérité" value={formData.severity || 'Medium'} onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })} options={['Low', 'Medium', 'High', 'Critical'].map(v => ({ label: v, value: v }))} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FloatingLabelInput label="Titre" value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                        <FloatingLabelInput type="number" label="Score CVSS" value={formData.score?.toString() || ''} onChange={(e) => setFormData({ ...formData, score: parseFloat(e.target.value) })} />
                    </div>

                    <FloatingLabelSelect
                        label="Actif Concerné"
                        value={formData.assetId || ''}
                        onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
                        options={assets.map(a => ({ label: a.name, value: a.id }))}
                    />

                    <FloatingLabelSelect label="Statut" value={formData.status || 'Open'} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })} options={['Open', 'In Progress', 'Resolved', 'False Positive'].map(v => ({ label: v, value: v }))} />

                    <FloatingLabelTextarea label="Description" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required rows={3} />
                    <FloatingLabelTextarea label="Plan de Remédiation" value={formData.remediationPlan || ''} onChange={(e) => setFormData({ ...formData, remediationPlan: e.target.value })} rows={3} />

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                        <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium">Annuler</button>
                        <button type="submit" className="bg-brand-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:bg-brand-700 transition-all">Enregistrer</button>
                    </div>
                </form>
            </Modal>
        </motion.div>
    );
};
