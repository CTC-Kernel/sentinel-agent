import React, { useState, useMemo } from 'react';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';
import { ShieldAlert, Plus, Trash2, CheckCircle2 as CheckCircle, Clock, Server, AlertTriangle, List, MoreVertical, FileSpreadsheet, BrainCircuit, User } from '../components/ui/Icons';
import { LayoutDashboard, Grid3X3, Columns } from 'lucide-react';
import { useStore } from '../store';
import { Vulnerability, Asset, UserProfile } from '../types';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { where } from 'firebase/firestore';
import { Box } from '../components/ui/Icons';
import { useVulnerabilities } from '../hooks/useVulnerabilities';
import { logAction } from '../services/logger';
import { CsvParser } from '../utils/csvUtils';
import { hasPermission, canDeleteResource } from '../utils/permissions';
import { Modal } from '../components/ui/Modal';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';
import { FloatingLabelSelect } from '../components/ui/FloatingLabelSelect';
import { FloatingLabelTextarea } from '../components/ui/FloatingLabelTextarea';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { Menu, Transition } from '@headlessui/react';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { VulnerabilityDashboard } from '../components/vulnerabilities/VulnerabilityDashboard';
import { VulnerabilityImportModal } from '../components/vulnerabilities/VulnerabilityImportModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';

export const Vulnerabilities: React.FC = () => {
    const { user, organization, addToast } = useStore();

    // View State synced with PremiumPageControl
    const [viewMode, setViewMode] = useState<'matrix' | 'list' | 'kanban'>('list');

    const [isCreating, setIsCreating] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
    const [formData, setFormData] = useState<Partial<Vulnerability>>({});

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');

    // ... (keep intermediate code manually if needed, or target more precisely)
    // Actually, I'll split into two replace calls again to be safe and precise.

    // Filters
    const [filterSeverity, setFilterSeverity] = useState<string>('All');
    // ...
    const { vulnerabilities, loading: vulnLoading, addVulnerability, updateVulnerability, deleteVulnerability, createRiskFromVuln, importVulnerabilities } = useVulnerabilities();

    const { data: assets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)]
    );

    const { data: usersData } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)]
    );

    const canCreate = hasPermission(user, 'Vulnerability', 'create', organization?.ownerId);
    const canManage = hasPermission(user, 'Vulnerability', 'manage', organization?.ownerId);

    // Derived State and KPIs
    const filteredVulns = useMemo(() => {
        return vulnerabilities.filter(v => {
            const matchesSearch = v.cveId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.assetName?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesSeverity = filterSeverity === 'All' ? true : v.severity === filterSeverity;

            return matchesSearch && matchesSeverity;
        }).sort((a: Vulnerability, b: Vulnerability) => {
            const severityWeight: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
            return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
        });
    }, [vulnerabilities, searchTerm, filterSeverity]);

    const handleExportCSV = () => {
        CsvParser.exportToCsv(
            filteredVulns as unknown as Record<string, unknown>[],
            `vulnerabilities_export_${new Date().toISOString().slice(0, 10)}`,
            ["cveId", "title", "severity", "status", "assetName", "score", "createdAt"]
        );
        logAction(user, 'EXPORT', 'Vulnerabilities', `Exported ${filteredVulns.length} vulnerabilities`);
    };

    const handleDelete = async (id: string, ownerId?: string) => {
        if (!canDeleteResource(user, 'Vulnerability', ownerId, organization?.ownerId)) {
            addToast("Permission refusée", "error");
            return;
        }

        setConfirmData({
            isOpen: true,
            title: "Supprimer la vulnérabilité ?",
            message: "Cette action est irréversible.",
            onConfirm: async () => {
                try {
                    await deleteVulnerability(id);
                    setConfirmData(prev => ({ ...prev, isOpen: false }));
                } catch {
                    //
                }
            }
        });
    };

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
        if (!canManage && !canCreate) {
            addToast("Permission refusée", "error");
            return;
        }
        try {
            const asset = assets.find(a => a.id === formData.assetId);
            const dataToSave = {
                ...formData,
                assetName: asset?.name || formData.assetName,
            };

            if (selectedVuln?.id) {
                await updateVulnerability(selectedVuln.id, dataToSave);
            } else {
                await addVulnerability(dataToSave);
            }
            setIsCreating(false);
        } catch {
            // ErrorLogger handled in hook
        }
    };

    const handleCreateRisk = async (vuln: Vulnerability) => {
        try {
            await createRiskFromVuln(vuln);
        } catch {
            // ErrorLogger handled in hook
        }
    };

    const handleImport = async (vulns: Partial<Vulnerability>[]) => {
        if (!canManage) return;
        try {
            await importVulnerabilities(vulns);
        } catch {
            // ErrorLogger handled in hook
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
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            {/* Premium Control */}
            <PremiumPageControl
                searchQuery={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Rechercher CVE, Actif..."
                viewMode={viewMode}
                onViewModeChange={(mode) => setViewMode(mode as 'matrix' | 'list' | 'kanban')}
                actions={
                    <div className="flex items-center gap-2">
                        <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors text-sm font-medium">
                                <span className="hidden sm:inline">Sévérité:</span> <span className="font-bold">{filterSeverity === 'All' ? 'Toutes' : filterSeverity}</span>
                            </Menu.Button>
                            <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                    <div className="p-1">
                                        {['All', 'Critical', 'High', 'Medium', 'Low'].map((s) => (
                                            <Menu.Item key={s}>
                                                {({ active }) => (
                                                    <button
                                                        onClick={() => setFilterSeverity(s)}
                                                        className={`${active ? 'bg-brand-500 text-white hover:bg-brand-600' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`}
                                                        aria-label={`Filter by severity ${s}`}
                                                    >
                                                        {s === 'All' ? 'Toutes' : s}
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        ))}
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>

                        {canCreate && (
                            <CustomTooltip content="Déclarer une vulnérabilité">
                                <button onClick={handleCreate} className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20" aria-label="Create new vulnerability">
                                    <Plus className="h-4 w-4 mr-2" /> <span className="hidden sm:inline">Nouvelle Vulnérabilité</span>
                                </button>
                            </CustomTooltip>
                        )}


                        <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm" aria-label="More options">
                                <MoreVertical className="h-5 w-5" />
                            </Menu.Button>
                            <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                    <div className="flex gap-2">
                                        {['2d', 'matrix', 'kanban'].map((mode) => (
                                            <button
                                                key={mode}
                                                onClick={() => setViewMode(mode as any)}
                                                className={`p-2 rounded-lg transition-colors ${viewMode === mode ? 'bg-white dark:bg-white/10 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'}`}
                                                aria-label={`Switch to ${mode} view`}
                                            >
                                                {mode === '2d' && <LayoutDashboard className="h-5 w-5" />}
                                                {mode === 'matrix' && <Grid3X3 className="h-5 w-5" />}
                                                {mode === 'kanban' && <Columns className="h-5 w-5" />}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
                                        {['Critical', 'High', 'Medium', 'Low'].map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => setFilterSeverity(s)}
                                                className={`${filterSeverity === s ? 'bg-white dark:bg-white/10 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'} px-3 py-1.5 text-xs font-semibold rounded-lg transition-all`}
                                                aria-label={`Filter by severity ${s}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-1">

                                        {canManage && (
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button onClick={() => setIsImportModalOpen(true)} className={`${active ? 'bg-brand-500 text-white hover:bg-brand-600' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`} aria-label="Import scanner results">
                                                        <BrainCircuit className="mr-2 h-4 w-4" /> Import Scanner
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        )}
                                        <Menu.Item>
                                            {({ active }) => (
                                                <button onClick={handleExportCSV} className={`${active ? 'bg-brand-500 text-white hover:bg-brand-600' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`} aria-label="Export to CSV">
                                                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Export CSV
                                                </button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    </div>
                }
            />

            {/* DASHBOARD TAB */}
            {
                viewMode === 'matrix' && (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible">
                        <VulnerabilityDashboard vulnerabilities={filteredVulns} />
                    </motion.div>
                )
            }

            {/* LIST TAB */}
            {
                viewMode === 'list' && (
                    <motion.div variants={slideUpVariants} className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-xl overflow-hidden min-h-[600px]">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-left">
                                    <tr>
                                        <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Sévérité</th>
                                        <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">CVE & Titre</th>
                                        <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Actif Affecté</th>
                                        <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Assigné à</th>
                                        <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Score</th>
                                        <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                                        <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
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
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                                {vuln.assignee ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">
                                                            {vuln.assignee.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="truncate max-w-[100px]">{vuln.assignee}</span>
                                                    </div>
                                                ) : '-'}
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
                                                    <button onClick={() => handleCreateRisk(vuln)} className="p-2 hover:bg-orange-50 text-orange-500 rounded-lg" title="Créer un risque" aria-label="Create risk for vulnerability">
                                                        <AlertTriangle className="h-4 w-4" />
                                                    </button>
                                                    {canManage && (
                                                        <button onClick={() => handleEdit(vuln)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 rounded-lg" aria-label="Edit vulnerability">
                                                            <List className="h-4 w-4" /> {/* Edit icon proxy if needed, referencing previous edit icon used commonly */}
                                                        </button>
                                                    )}
                                                    {canManage && (
                                                        <button onClick={() => handleDelete(vuln.id!, vuln.organizationId)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg" aria-label="Delete vulnerability">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )
            }

            {/* KANBAN TAB */}
            {
                viewMode === 'kanban' && (
                    <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-300px)] min-h-[500px] overflow-x-auto pb-4">
                        {['Open', 'In Progress', 'Resolved'].map((status) => {
                            const columnVulns = filteredVulns.filter(v =>
                                status === 'Open' ? (v.status !== 'In Progress' && v.status !== 'Resolved') : v.status === status
                            );

                            return (
                                <div key={status} className="flex flex-col glass-panel rounded-2xl p-4 border border-white/20 h-full">
                                    <h4 className="text-sm font-bold uppercase text-slate-600 dark:text-slate-400 mb-4 flex justify-between tracking-wider px-1">
                                        {status === 'Open' ? 'Ouvert' : status === 'In Progress' ? 'En Cours' : 'Résolu'}
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-xs shadow-sm border border-slate-200 dark:border-white/5">
                                            {columnVulns.length}
                                        </span>
                                    </h4>
                                    <div className="space-y-4 overflow-y-auto pr-2 flex-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                                        {columnVulns.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                                                <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-3">
                                                    <CheckCircle className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                                                </div>
                                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Aucune vulnérabilité</p>
                                            </div>
                                        ) : (
                                            columnVulns.map(v => (
                                                <div key={v.id} onClick={() => canManage && handleEdit(v)} role="button" tabIndex={0} aria-label={`Edit vulnerability ${v.cveId}`} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && canManage && handleEdit(v)} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all group ${canManage ? 'cursor-pointer' : 'cursor-default'}`}>
                                                    <div className="flex justify-between items-start mb-2">
                                                        <Badge status={v.severity === 'Critical' ? 'error' : v.severity === 'High' ? 'warning' : 'info'} variant="soft" size="sm">{v.severity}</Badge>
                                                        <span className="text-xs text-slate-400 font-mono">{v.cveId}</span>
                                                    </div>
                                                    <h5 className="font-bold text-slate-900 dark:text-white text-sm mb-1 line-clamp-2">{v.title}</h5>
                                                    <div className="flex items-center text-xs text-slate-500 mb-3">
                                                        <Server className="h-3 w-3 mr-1" /> {v.assetName || 'N/A'}
                                                    </div>
                                                    {v.assignee && (
                                                        <div className="flex items-center text-xs text-slate-500 mb-3">
                                                            <User className="h-3 w-3 mr-1" /> {v.assignee}
                                                        </div>
                                                    )}
                                                    {v.score && (
                                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                                                            <span className="text-xs font-bold text-slate-400">CVSS</span>
                                                            <span className={`text-xs font-bold ${v.score >= 7 ? 'text-red-500' : 'text-slate-600'}`}>{v.score}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </motion.div>
                )
            }

            {/* Modal */}
            <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title={selectedVuln ? `Modifier ${selectedVuln.cveId}` : "Nouvelle Vulnérabilité"} maxWidth="max-w-2xl">
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <FloatingLabelInput label="CVE ID (ex: CVE-2024-1234)" value={formData.cveId || ''} onChange={(e) => setFormData({ ...formData, cveId: e.target.value })} required />
                        <FloatingLabelSelect label="Sévérité" value={formData.severity || 'Medium'} onChange={(e) => setFormData({ ...formData, severity: e.target.value as Vulnerability['severity'] })} options={['Low', 'Medium', 'High', 'Critical'].map(v => ({ label: v, value: v }))} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FloatingLabelInput label="Titre" value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                        <FloatingLabelInput type="number" label="Score CVSS" value={formData.score?.toString() || ''} onChange={(e) => setFormData({ ...formData, score: parseFloat(e.target.value) })} />
                    </div>

                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Actif Concerné
                        </label>
                        <div className="relative">
                            <Box className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                            <input
                                list="asset-list-vuln"
                                placeholder="Rechercher un actif..."
                                className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white pl-10 pr-4 py-2.5 outline-none border focus:ring-2 focus:ring-brand-500"
                                value={assets.find(a => a.id === formData.assetId)?.name || formData.assetId || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const found = assets.find(a => a.name === val);
                                    setFormData({ ...formData, assetId: found ? found.id : val, assetName: val });
                                }}
                            />
                            <datalist id="asset-list-vuln">
                                {assets.map(asset => (
                                    <option key={asset.id} value={asset.name}>{asset.type}</option>
                                ))}
                            </datalist>
                        </div>
                    </div>

                    <FloatingLabelSelect
                        label="Assigné à"
                        value={formData.assignee || ''}
                        onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                        options={[{ label: 'Non assigné', value: '' }, ...usersData.map(u => ({ label: u.displayName || u.email, value: u.email }))]}
                    />

                    <FloatingLabelSelect label="Statut" value={formData.status || 'Open'} onChange={(e) => setFormData({ ...formData, status: e.target.value as Vulnerability['status'] })} options={['Open', 'In Progress', 'Resolved', 'False Positive'].map(v => ({ label: v, value: v }))} />

                    <FloatingLabelTextarea label="Description" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required rows={3} />
                    <FloatingLabelTextarea label="Plan de Remédiation" value={formData.remediationPlan || ''} onChange={(e) => setFormData({ ...formData, remediationPlan: e.target.value })} rows={3} />

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                        <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium transition-colors" aria-label="Cancel">Annuler</button>
                        <button type="submit" className="bg-brand-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:bg-brand-700 transition-all hover:scale-[1.02]" aria-label="Save vulnerability">Enregistrer</button>
                    </div>
                </form>
            </Modal>
            {/* Import Modal */}
            <VulnerabilityImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImport={handleImport}
            />
        </motion.div >
    );
};
