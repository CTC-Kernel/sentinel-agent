import React, { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import {
    FileText, FileSpreadsheet, FileCode, MoreVertical,
    Loader2, Plus, BrainCircuit, ShieldAlert, Copy, HelpCircle, Filter
} from 'lucide-react';
import { OnboardingService } from '../services/onboardingService';
import { PageHeader } from '../components/ui/PageHeader';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { AdvancedSearch } from '../components/ui/AdvancedSearch';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { ObsidianService } from '../services/ObsidianService';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile, Framework } from '../types';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { CsvParser } from '../utils/csvUtils';

import { useRiskData } from '../hooks/risks/useRiskData';
import { useRiskActions } from '../hooks/risks/useRiskActions';
import { useRiskFilters } from '../hooks/risks/useRiskFilters';


import { RiskList } from '../components/risks/RiskList';
import { RiskGrid } from '../components/risks/RiskGrid';
import { RiskMatrix } from '../components/risks/RiskMatrix';
import { RiskDashboard } from '../components/risks/RiskDashboard';
import { CustomSelect } from '../components/ui/CustomSelect';

import { Drawer } from '../components/ui/Drawer';
import { RiskForm } from '../components/risks/RiskForm';
import { RiskInspector } from '../components/risks/RiskInspector';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { RiskTemplateModal } from '../components/risks/RiskTemplateModal';
import { aiService } from '../services/aiService';
import { PdfService } from '../services/PdfService';
import { useStore } from '../store';
import { toast } from 'sonner';
import { Risk } from '../types';
import { canEditResource } from '../utils/permissions';
import { useAuth } from '../hooks/useAuth';

export const Risks: React.FC = () => {
    // Hooks
    const { user } = useAuth(); // Prefer useAuth for user object
    const { demoMode } = useStore();
    const { risks, loading, assets, controls, projects, audits, suppliers, usersList, rawProcesses, refreshRisks } = useRiskData();

    // Permission check
    const canEdit = canEditResource(user as UserProfile, 'Risk');

    const {
        createRisk, updateRisk, deleteRisk, bulkDeleteRisks,
        exportCSV, isGeneratingReport, setIsGeneratingReport, submitting, isExportingCSV
    } = useRiskActions(refreshRisks);

    const {
        activeFilters, setActiveFilters,
        filteredRisks,
        showAdvancedSearch, setShowAdvancedSearch,
        frameworkFilter, setFrameworkFilter,
        matrixFilter, setMatrixFilter
    } = useRiskFilters(risks);



    // Local UI State
    const [creationMode, setCreationMode] = useState(false);
    const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
    const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
    const [confirmData, setConfirmData] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [viewMode, setViewMode] = useState<'matrix' | 'list' | 'grid' | 'kanban'>('grid'); // Fixed type to match PremiumPageControl
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [isImporting, setIsImporting] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

    // URL Params for Deep Linking
    const [searchParams] = useSearchParams();
    const deepLinkRiskId = searchParams.get('id');

    // Deep Linking Effect
    React.useEffect(() => {
        if (!loading && deepLinkRiskId && risks.length > 0) {
            const risk = risks.find(r => r.id === deepLinkRiskId);
            if (risk) {
                setSelectedRisk(risk);
            }
        }
    }, [loading, deepLinkRiskId, risks]);


    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helper functions
    const handleEdit = (risk: Risk) => {
        setEditingRisk(risk);
        setCreationMode(true);
    };

    const handleDelete = (risk: Pick<Risk, 'id'>) => {
        setConfirmData({
            isOpen: true,
            title: "Supprimer le risque ?",
            message: "Cette action est irréversible.",
            onConfirm: () => deleteRisk(risk.id)
        });
    };

    const handleExportExecutive = async () => {
        setIsGeneratingReport(true);
        try {
            await PdfService.generateRiskExecutiveReport(filteredRisks, {
                title: 'Rapport Exécutif des Risques',
                subtitle: `Généré par ${user?.displayName || 'Utilisateur'} le ${new Date().toLocaleDateString()} `,
                filename: `risques_exec_${new Date().toISOString().split('T')[0]}.pdf`,
                organizationName: user?.organizationName || 'Sentinel GRC',
                author: user?.displayName || 'Sentinel User'
            });
            toast.success("Rapport généré avec succès");
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de la génération du rapport");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleExportPDF = async () => {
        // Re-using executive report for now as it's the main PDF export
        handleExportExecutive();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsImporting(true);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                if (!text) return;

                const data = CsvParser.parseCSV(text);

                let importedCount = 0;
                for (const rawRow of data) {
                    // Normalize keys to lowercase for robust matching
                    // Normalize keys to lowercase for robust matching
                    const row: Record<string, string> = {};
                    Object.keys(rawRow).forEach(key => {
                        row[key.toLowerCase().trim()] = rawRow[key];
                    });

                    // Check for mandatory fields (Menace/Threat)
                    const threat = row.menace || row.threat || row.titre || row.title;

                    if (threat) {
                        const probInput = row.probability || row.probabilite || row.likelihood || '1';
                        const impactInput = row.impact || row.gravite || row.severity || '1';

                        const prob = Math.min(Math.max(parseInt(probInput), 1), 5) as 1 | 2 | 3 | 4 | 5;
                        const impact = Math.min(Math.max(parseInt(impactInput), 1), 5) as 1 | 2 | 3 | 4 | 5;

                        await createRisk({
                            threat: threat,
                            vulnerability: row.vulnerability || row.vulnerabilite || row.cause || '',
                            probability: prob,
                            impact: impact,
                            strategy: (row.strategy || row.strategie || 'Atténuer') as Risk['strategy'],
                            status: (row.status || row.statut || 'Ouvert') as Risk['status'],
                            framework: (row.framework || row.reference || 'ISO27001') as Framework
                        });
                        importedCount++;
                    }
                }
                setIsImporting(false);
                refreshRisks();
                if (fileInputRef.current) fileInputRef.current.value = '';
                toast.success(`${importedCount} risques importés avec succès`);
            } catch (error) {
                console.error("Import Error", error);
                setIsImporting(false);
                toast.error("Erreur lors de l'importation");
            }
        };
        reader.readAsText(file);
    };

    const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFileUpload(e);
    };


    // Role Logic
    const role = user?.role || 'user';
    let risksTitle = 'Gestion des Risques';
    let risksSubtitle = "Analyse et traitement des risques selon ISO 27005.";
    if (role === 'admin' || role === 'rssi') {
        risksTitle = 'Registre des Risques & Exposition';
        risksSubtitle = "Pilotez l'identification, l'évaluation et le traitement des risques critiques.";
    } else if (role === 'direction') {
        risksTitle = 'Vue Exécutive des Risques';
        risksSubtitle = "Surveillez les risques majeurs et l'avancement des plans de traitement.";
    }


    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-6">
            <MasterpieceBackground />
            <PageHeader
                title={risksTitle}
                subtitle={risksSubtitle}
                icon={<ShieldAlert className="h-6 w-6 text-white" strokeWidth={2.5} />}
                breadcrumbs={[{ label: 'Risques' }]}
                trustType="integrity"
            />

            {/* Dashboard & Charts */}
            <div data-tour="risks-stats">
                <RiskDashboard
                    risks={filteredRisks}
                    onFilterChange={(filter) => {
                        if (!filter) {
                            // Reset filters logic if needed, or just clear search
                            setActiveFilters(prev => ({ ...prev, query: '' }));
                            setFrameworkFilter('');
                        } else if (filter.type === 'level') {
                            // This logic might need to be adapted to how useRiskFilters works
                            // For now, simpler to just log or ignore if useRiskFilters doesn't support direct property set
                            // But let's try to map it:
                            // Assuming search query or we need to add explicit filters to useRiskFilters

                        }
                    }}
                />
            </div>

            <motion.div variants={slideUpVariants}>
                <PremiumPageControl
                    searchQuery={activeFilters.query}
                    onSearchChange={(q) => setActiveFilters(prev => ({ ...prev, query: q }))}
                    searchPlaceholder="Rechercher une menace, une vulnérabilité..."
                    viewMode={viewMode}
                    onViewModeChange={(mode) => setViewMode(mode)}
                    actions={
                        <>
                            {/* Framework Filter */}
                            <div className="hidden md:block w-48">
                                <CustomSelect
                                    value={frameworkFilter}
                                    onChange={(val) => setFrameworkFilter(val as string)}
                                    options={[
                                        { value: '', label: 'Tous les référentiels' },
                                        { value: 'ISO 27001', label: 'ISO 27001' },
                                        { value: 'ISO 27005', label: 'ISO 27005' },
                                        { value: 'EBIOS', label: 'EBIOS RM' },
                                        { value: 'NIST', label: 'NIST' }
                                    ]}
                                    placeholder="Référentiel"
                                />
                            </div>

                            <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-2 hidden md:block" />

                            <button
                                onClick={() => OnboardingService.startRisksTour()}
                                className="p-2.5 rounded-xl bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:border-white/10 dark:hover:bg-white/10 transition-all shadow-sm"
                                title="Lancer le tour guidé"
                            >
                                <HelpCircle className="h-5 w-5" />
                            </button>

                            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                            <button
                                data-tour="risks-filters"
                                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                                className={`p-2.5 rounded-xl transition-all border shadow-sm ${showAdvancedSearch
                                    ? 'bg-brand-50 text-brand-600 border-brand-100 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-900/30'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:border-white/10 dark:hover:bg-white/10'
                                    }`}
                                title="Filtres avancés"
                            >
                                <Filter className="h-5 w-5" />
                            </button>

                            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                            {/* Actions Menu */}
                            <Menu as="div" className="relative inline-block text-left">
                                <Menu.Button className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                                    <MoreVertical className="h-5 w-5" />
                                </Menu.Button>
                                <Transition
                                    as={React.Fragment}
                                    enter="transition ease-out duration-100"
                                    enterFrom="transform opacity-0 scale-95"
                                    enterTo="transform opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="transform opacity-100 scale-100"
                                    leaveTo="transform opacity-0 scale-95"
                                >
                                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                        <div className="p-1">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Rapports & Exports
                                            </div>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button onClick={handleExportPDF} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        <FileText className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-brand-500'}`} /> RTP (PDF)
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button onClick={handleExportExecutive} disabled={isGeneratingReport} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-brand-500'}`} />} Rapport Exécutif
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button onClick={() => exportCSV(filteredRisks)} disabled={isExportingCSV} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        {isExportingCSV ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-emerald-500'}`} />} Export CSV
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button onClick={() => ObsidianService.exportRisksToObsidian(filteredRisks)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        <FileCode className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-emerald-500'}`} /> Obsidian
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </div>
                                        {canEdit && (
                                            <div className="p-1">
                                                <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Données</div>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            onClick={() => fileInputRef.current?.click()}
                                                            disabled={isImporting}
                                                            className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-emerald-500'}`} />} Import CSV
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button onClick={() => setIsTemplateModalOpen(true)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                            <Copy className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-blue-500'}`} /> Templates
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            </div>
                                        )}
                                    </Menu.Items>
                                </Transition>
                            </Menu>

                            {/* Main CTA Actions */}
                            {canEdit && (
                                <>
                                    <CustomTooltip content="Lancer l'analyse IA">
                                        <button
                                            onClick={async () => {
                                                setIsAnalyzing(true);
                                                try {
                                                    const prompt = `Analyse cette liste de ${filteredRisks.length} risques. Donne-moi 3 insights clés sur les menaces principales et une recommandation stratégique. Format court.`;
                                                    const analysis = await aiService.chatWithAI(prompt);
                                                    toast.info("Analyse IA terminée", { description: analysis, duration: 10000 });
                                                } catch (e) {
                                                    console.error(e);
                                                    toast.error("Erreur lors de l'analyse IA");
                                                } finally {
                                                    setIsAnalyzing(false);
                                                }
                                            }}
                                            disabled={isAnalyzing}
                                            className="hidden lg:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-indigo-500/20 font-bold text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
                                            <span className="hidden xl:inline">{isAnalyzing ? 'Analyse...' : 'Analyse IA'}</span>
                                        </button>
                                    </CustomTooltip>
                                    <CustomTooltip content="Créer un nouveau risque">
                                        <button
                                            data-tour="risks-create"
                                            onClick={() => { setEditingRisk(null); setCreationMode(true); }}
                                            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                                        >
                                            <Plus className="h-4 w-4" />
                                            <span className="hidden sm:inline">Nouveau Risque</span>
                                        </button>
                                    </CustomTooltip>
                                </>
                            )}
                        </>
                    }
                />
            </motion.div>

            {/* Hidden Input for Import */}
            <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={onFileInputChange} />

            {/* Advanced Search Panel Placeholder */}
            <AnimatePresence>
                {showAdvancedSearch && (
                    <AdvancedSearch
                        onSearch={(filters) => {
                            // Map generic filters to risk specific filters if needed
                            setActiveFilters(prev => ({
                                ...prev,
                                query: filters.query,
                                // Add other mappings if useRiskFilters supports them
                            }));
                            setShowAdvancedSearch(false);
                            // Optional: Add toast for unsupported filters if necessary
                            if (filters.status || filters.owner || filters.criticality) {
                                // toast.info("Filtres avancés appliqués sur la recherche textuelle");
                            }
                        }}
                        onClose={() => setShowAdvancedSearch(false)}
                    />
                )}
            </AnimatePresence>

            {/* Main Content */}
            <motion.div variants={slideUpVariants} className={viewMode === 'list' ? "glass-panel p-6 rounded-2xl border border-glass-border" : ""}>
                {matrixFilter && (
                    <div className="bg-brand-50 dark:bg-brand-900/20 p-4 rounded-2xl border border-brand-100 dark:border-brand-900/30 flex justify-between items-center mb-6">
                        <span className="text-sm font-bold text-brand-900 dark:text-brand-100">
                            Filtre Matrice : Probabilité {matrixFilter.p} × Impact {matrixFilter.i}
                        </span>
                        <button onClick={() => setMatrixFilter(null)} className="text-xs text-red-500 font-bold hover:underline">Réinitialiser</button>
                    </div>
                )}

                {viewMode === 'matrix' && (
                    <RiskMatrix
                        risks={filteredRisks}
                        matrixFilter={matrixFilter}
                        setMatrixFilter={(filter) => {
                            setMatrixFilter(filter);
                            if (filter) setViewMode('list');
                        }}
                        frameworkFilter={frameworkFilter}
                    />
                )}
                {viewMode === 'list' && (
                    <RiskList
                        risks={filteredRisks}
                        loading={loading}
                        onEdit={handleEdit}
                        onDelete={(id) => handleDelete({ id })}
                        onSelect={setSelectedRisk}
                        canEdit={canEdit}
                        onBulkDelete={bulkDeleteRisks}
                        assets={assets}
                    />
                )}
                {viewMode === 'grid' && (
                    <RiskGrid
                        risks={filteredRisks}
                        loading={loading}
                        assets={assets}
                        onSelect={setSelectedRisk}
                        emptyStateIcon={ShieldAlert}
                        emptyStateTitle="Aucun risque identifié"
                        emptyStateDescription="Commencez par ajouter un risque pour visualiser votre exposition."
                        emptyStateActionLabel={canEdit ? "Créer un risque" : undefined}
                        onEmptyStateAction={canEdit ? () => setCreationMode(true) : undefined}
                    />
                )}
            </motion.div>

            <RiskInspector
                isOpen={!!selectedRisk}
                onClose={() => setSelectedRisk(null)}
                risk={selectedRisk}
                assets={assets}
                controls={controls}
                projects={projects}
                audits={audits}
                suppliers={suppliers}
                usersList={usersList}
                processes={rawProcesses}
                canEdit={canEdit}
                demoMode={demoMode}
                onUpdate={updateRisk}
                onDelete={(id) => handleDelete({ id: id } as Risk)} // Wrapper to match signature if needed
                onDuplicate={(r) => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { id, history, ...rest } = r;
                    createRisk({
                        ...rest,
                        threat: `${r.threat} (Copie)`,
                        probability: r.probability as 1 | 2 | 3 | 4 | 5,
                        impact: r.impact as 1 | 2 | 3 | 4 | 5
                    } as Risk);
                }}
            />

            <Drawer
                isOpen={creationMode}
                onClose={() => setCreationMode(false)}
                title="Nouveau Risque"
                width="max-w-4xl"
            >
                <div className="p-6">
                    <RiskForm
                        initialData={editingRisk || undefined}
                        onSubmit={async (data) => {
                            if (editingRisk) {
                                await updateRisk(editingRisk.id, {
                                    ...data,
                                    probability: data.probability as 1 | 2 | 3 | 4 | 5,
                                    impact: data.impact as 1 | 2 | 3 | 4 | 5,
                                    residualProbability: data.residualProbability as 1 | 2 | 3 | 4 | 5 | undefined,
                                    residualImpact: data.residualImpact as 1 | 2 | 3 | 4 | 5 | undefined,
                                    aiAnalysis: data.aiAnalysis || undefined
                                });
                            } else {
                                await createRisk(data as Risk);
                            }
                            setCreationMode(false);
                            setEditingRisk(null);
                        }}
                        onCancel={() => { setCreationMode(false); setEditingRisk(null); }}
                        assets={assets}
                        usersList={usersList}
                        processes={rawProcesses}
                        suppliers={suppliers}
                        controls={controls}
                        isLoading={submitting}
                    />
                </div>
            </Drawer>

            <RiskTemplateModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onSelectTemplate={async (template, ownerId) => {
                    const promises = template.risks.map(risk => createRisk({
                        threat: risk.threat,
                        vulnerability: risk.vulnerability,
                        probability: risk.probability as 1 | 2 | 3 | 4 | 5,
                        impact: risk.impact as 1 | 2 | 3 | 4 | 5,
                        strategy: risk.strategy as 'Accepter' | 'Transférer' | 'Atténuer' | 'Éviter',
                        status: 'Ouvert',
                        framework: 'ISO27001', // Default or map correctly if possible
                        owner: ownerId,
                        // You can map other fields if they exist in RiskTemplate's risk objects
                    }));

                    try {
                        await Promise.all(promises);
                        toast.success(`${template.risks.length} risques créés depuis le modèle`);
                    } catch (error) {
                        console.error('Template import error', error);
                        toast.error("Erreur lors de l'import depuis le modèle");
                    }
                    setIsTemplateModalOpen(false);
                }}
                users={usersList}
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

        </motion.div>
    );
};
