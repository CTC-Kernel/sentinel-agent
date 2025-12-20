import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { motion } from 'framer-motion';

import { useAudits } from '../hooks/audits/useAudits';
import { AuditsList } from '../components/audits/AuditsList';
import { Drawer } from '../components/ui/Drawer';
import { AuditForm } from '../components/audits/AuditForm';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useStore } from '../store';
import { AuditInspector } from '@/components/audits/AuditInspector';
import { Audit } from '../types';
import { AuditFormData } from '../schemas/auditSchema';
import { PageHeader } from '../components/ui/PageHeader';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { Calendar as CalendarIcon, Download, BrainCircuit, Plus, LayoutDashboard, List, ClipboardCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { AuditDashboard } from '../components/audits/AuditDashboard';
import { AuditCalendar } from '../components/audits/AuditCalendar';
import { FindingsList } from '../components/audits/FindingsList';

import { CustomSelect } from '../components/ui/CustomSelect';

export const Audits: React.FC = () => {
    const {
        audits, loading, canEdit, canDelete, controls, documents, assets, risks, usersList, projects,
        handleDeleteAudit, handleGeneratePlan, handleCreateAudit, handleUpdateAudit,
        refreshAudits, handleExportCSV, handleExportCalendar
    } = useAudits();

    const { user } = useStore();

    // Local UI State
    const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'calendar' | 'findings'>('list');
    const [creationMode, setCreationMode] = useState(false);
    const [editingAudit, setEditingAudit] = useState<Audit | null>(null);
    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    // URL Params for Deep Linking
    const [searchParams] = useSearchParams();
    const deepLinkAuditId = searchParams.get('id');

    // Deep Linking Effect
    React.useEffect(() => {
        if (!loading && deepLinkAuditId && audits.length > 0) {
            const audit = audits.find(a => a.id === deepLinkAuditId);
            if (audit) {
                setSelectedAudit(audit);
            }
        }
    }, [loading, deepLinkAuditId, audits]);

    const tabs = [
        { id: 'overview', label: "Tableau de Bord", icon: LayoutDashboard },
        { id: 'list', label: "Liste des Audits", icon: List },
        { id: 'calendar', label: "Calendrier", icon: CalendarIcon },
        { id: 'findings', label: "Constats", icon: ClipboardCheck },
    ];

    // Filter Logic
    const filteredAudits = useMemo(() => {
        return audits.filter(audit => {
            const matchesSearch =
                audit.name.toLowerCase().includes(filter.toLowerCase()) ||
                audit.auditor?.toLowerCase().includes(filter.toLowerCase()) ||
                audit.type?.toLowerCase().includes(filter.toLowerCase());
            const matchesStatus = statusFilter ? audit.status === statusFilter : true;
            const matchesType = typeFilter ? audit.type === typeFilter : true;

            return matchesSearch && matchesStatus && matchesType;
        });
    }, [audits, filter, statusFilter, typeFilter]);

    // Handle "View" or "Edit" Logic
    const handleEdit = (audit: Audit) => {
        setEditingAudit(audit);
        setCreationMode(true);
    };

    const handleDelete = (audit: Audit) => {
        setConfirmData({
            isOpen: true,
            title: "Supprimer l'audit ?",
            message: "Cette action est irréversible et supprimera tous les constats associés.",
            onConfirm: () => handleDeleteAudit(audit.id, audit.name)
        });
    };

    const handleOpen = (audit: Audit) => {
        setSelectedAudit(audit);
    };

    const onFormSubmit = async (data: AuditFormData) => {
        if (editingAudit) {
            await handleUpdateAudit(editingAudit.id, data);
        } else {
            await handleCreateAudit(data);
        }
        setCreationMode(false);
        setEditingAudit(null);
    };

    // Role-based Title
    const role = user?.role || 'user';
    let auditsTitle = "Programme d'Audit";
    let auditsSubtitle = "Planification, exécution et suivi des audits internes et externes.";
    if (role === 'admin' || role === 'rssi') { auditsTitle = "Programme d'Audit & Conformité"; auditsSubtitle = "Orchestrez les audits ISO 27001, le suivi des écarts et les plans d'actions associés."; }
    else if (role === 'direction') { auditsTitle = 'Vue Exécutive des Audits'; auditsSubtitle = "Suivez l'état des audits, les non-conformités et les risques associés pour la direction."; }

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-6">
            <MasterpieceBackground />
            <SEO title="Audits & Conformité" description="Gestion des audits de sécurité" />

            <PageHeader
                title={auditsTitle}
                subtitle={auditsSubtitle}
            />

            <div className="mb-6">
                <ScrollableTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as 'overview' | 'list' | 'calendar' | 'findings')}
                />
            </div>

            <PremiumPageControl
                searchQuery={filter}
                onSearchChange={setFilter}
                searchPlaceholder="Rechercher un audit..."
                actions={
                    <div className="flex gap-2 items-center">
                        <div className="hidden md:block w-40">
                            <CustomSelect
                                value={statusFilter}
                                onChange={(val) => setStatusFilter(val as string)}
                                options={[
                                    { value: '', label: 'Tous les statuts' },
                                    { value: 'Planifié', label: 'Planifié' },
                                    { value: 'En cours', label: 'En cours' },
                                    { value: 'Terminé', label: 'Terminé' },
                                    { value: 'Validé', label: 'Validé' }
                                ]}
                                placeholder="Statut"
                            />
                        </div>
                        <div className="hidden md:block w-40 mr-2">
                            <CustomSelect
                                value={typeFilter}
                                onChange={(val) => setTypeFilter(val as string)}
                                options={[
                                    { value: '', label: 'Tous les types' },
                                    { value: 'Interne', label: 'Interne' },
                                    { value: 'Externe', label: 'Externe' },
                                    { value: 'Certification', label: 'Certification' }
                                ]}
                                placeholder="Type"
                            />
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-2 hidden md:block" />
                        <Button
                            variant="ghost"
                            onClick={handleExportCalendar}
                            title="Exporter Calendrier"
                            className="p-2 h-10 w-10 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                        >
                            <CalendarIcon className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleExportCSV}
                            title="Exporter CSV"
                            className="p-2 h-10 w-10 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                        >
                            <Download className="w-5 h-5" />
                        </Button>
                        {canEdit && (
                            <>
                                <Button
                                    onClick={handleGeneratePlan}
                                    variant="outline"
                                    className="gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 font-medium"
                                >
                                    <BrainCircuit className="w-4 h-4" />
                                    <span className="hidden sm:inline">Assistant IA</span>
                                </Button>
                                <Button
                                    onClick={() => { setEditingAudit(null); setCreationMode(true); }}
                                    className="gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-medium shadow-sm hover:shadow-md transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Nouvel Audit</span>
                                </Button>
                            </>
                        )}
                    </div>
                }
            />

            {
                activeTab === 'overview' && (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible">
                        <AuditDashboard
                            audits={filteredAudits}
                            findings={filteredAudits.flatMap(a => a.findings || [])}
                            onFilterChange={(f) => {
                                if (f?.type === 'status') {
                                    setFilter(f.value);
                                    setActiveTab('list');
                                }
                            }}
                        />
                    </motion.div>
                )
            }

            {
                activeTab === 'list' && (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible" className="space-y-6">
                        <div className="glass-panel overflow-hidden rounded-2xl border border-white/20 dark:border-white/5">
                            <AuditsList
                                audits={filteredAudits}
                                isLoading={loading}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onOpen={handleOpen}
                                canEdit={canEdit}
                                canDelete={canDelete}
                            />
                        </div>
                    </motion.div>
                )
            }

            {
                activeTab === 'calendar' && (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible">
                        <AuditCalendar
                            audits={filteredAudits}
                            onAuditClick={handleOpen}
                        />
                    </motion.div>
                )
            }

            {
                activeTab === 'findings' && (
                    <motion.div variants={slideUpVariants} initial="initial" animate="visible">
                        <FindingsList audits={filteredAudits} />
                    </motion.div>
                )
            }

            {/* Creation/Edit Drawer */}
            <Drawer
                isOpen={creationMode}
                onClose={() => { setCreationMode(false); setEditingAudit(null); }}
                title={editingAudit ? "Modifier l'audit" : "Nouvel Audit"}
            >
                <AuditForm
                    initialData={editingAudit || undefined}
                    onSubmit={onFormSubmit}
                    onCancel={() => { setCreationMode(false); setEditingAudit(null); }}
                    isLoading={loading}
                    assets={assets}
                    risks={risks}
                    controls={controls}
                    projects={projects}
                    usersList={usersList}
                />
            </Drawer>

            {/* Inspection Drawer */}
            <Drawer
                isOpen={!!selectedAudit}
                onClose={() => setSelectedAudit(null)}
                title={selectedAudit?.name || "Détails de l'audit"}
                width="max-w-6xl"
            >
                {selectedAudit && (
                    <AuditInspector
                        audit={selectedAudit}
                        onClose={() => setSelectedAudit(null)}
                        controls={controls}
                        documents={documents}
                        refreshAudits={refreshAudits}
                        canEdit={canEdit}
                        onDelete={(id, name) => {
                            setSelectedAudit(null);
                            handleDelete({ id, name } as Audit);
                        }}
                    />
                )}
            </Drawer>

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />
        </motion.div >
    );
};
