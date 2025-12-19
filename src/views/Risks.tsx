import React, { useState, useRef } from 'react';
// import { useLocation } from 'react-router-dom';
import { useStore } from '../store';
// import { useRiskData } from '../hooks/risks/useRiskData';
import { useRiskData } from '../hooks/risks/useRiskData';
import { useRiskActions } from '../hooks/risks/useRiskActions';
import { useRiskFilters } from '../hooks/risks/useRiskFilters';
import { useRiskStats } from '../hooks/risks/useRiskStats';

import { RiskHeader } from '../components/risks/RiskHeader';
import { RiskStats } from '../components/risks/RiskStats';
import { RiskMatrix } from '../components/risks/RiskMatrix';
import { RiskList } from '../components/risks/RiskList';
import { RiskGrid } from '../components/risks/RiskGrid';
import { RiskInspector } from '../components/risks/RiskInspector';
import { RiskFilters } from '../components/risks/RiskFilters';
import { RiskForm } from '../components/risks/RiskForm';
import { RiskTemplateModal } from '../components/risks/RiskTemplateModal';
// import { RiskRecommendation } from '../types';
import { Drawer } from '../components/ui/Drawer';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { ShieldAlert } from 'lucide-react';
import { PdfService } from '../services/PdfService';
import { canEditResource } from '../utils/permissions';
import { Risk } from '../types';
// @ts-expect-error: Papaparse types might be missing in this environment
import Papa from 'papaparse';
import { aiService } from '../services/aiService';
import { toast } from 'sonner';

export const Risks: React.FC = () => {
    const { user, demoMode } = useStore();
    // const location = useLocation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 1. Data Hook
    const {
        risks, assets, controls, rawProcesses, suppliers, audits, projects, usersList,
        loading: dataLoading, refreshRisks
    } = useRiskData();

    // 2. Actions Hook
    const {
        createRisk, updateRisk, deleteRisk, bulkDeleteRisks, exportCSV,
        submitting, isGeneratingReport, setIsGeneratingReport, isExportingCSV
    } = useRiskActions(refreshRisks);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // 3. Filters Hook
    const {
        activeFilters, setActiveFilters,
        frameworkFilter, setFrameworkFilter,
        matrixFilter, setMatrixFilter,
        showAdvancedSearch, setShowAdvancedSearch,
        filteredRisks
    } = useRiskFilters(risks);

    // 4. Stats Hook
    const stats = useRiskStats(filteredRisks);

    // 5. Local UI State
    const [viewMode, setViewMode] = useState<'matrix' | 'list' | 'cards'>('cards');
    const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
    const [creationMode, setCreationMode] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);

    // Role Logic
    const role = user?.role || 'user';

    // Permission Logic
    const canEdit = canEditResource(user, 'Risk');

    // Titles
    let risksTitle = 'Gestion des Risques';
    let risksSubtitle = "Analyse et traitement des risques selon ISO 27005.";
    if (role === 'admin' || role === 'rssi') {
        risksTitle = 'Registre des Risques & Exposition';
        risksSubtitle = "Pilotez l'identification, l'évaluation et le traitement des risques critiques.";
    } else if (role === 'direction') {
        risksTitle = 'Vue Exécutive des Risques';
        risksSubtitle = "Surveillez les risques majeurs et l'avancement des plans de traitement.";
    }

    // Handlers
    const handleExportRTP = async () => {
        setIsGeneratingReport(true);
        try {
            PdfService.generateRiskExecutiveReport(filteredRisks, {
                title: 'Plan de Traitement des Risques',
                subtitle: 'Plan de traitement',
                author: user?.displayName
            });
        } catch (e) {
            console.error(e);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleExportExecutive = async () => {
        setIsGeneratingReport(true);
        try {
            PdfService.generateRiskExecutiveReport(filteredRisks, {
                title: 'Rapport Exécutif des Risques',
                subtitle: `Généré par ${user?.displayName || 'Utilisateur'} le ${new Date().toLocaleDateString()}`,
                filename: `risques_exec_${new Date().toISOString().split('T')[0]}.pdf`,
                organizationName: user?.organizationName || 'Sentinel GRC',
                author: user?.displayName
            });
        } catch (e) {
            console.error(e);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleExportPDF = async () => {
        handleExportExecutive();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setImporting(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results: { data: Record<string, string>[] }) => {
                const data = results.data;
                for (const row of data) {
                    if (row.Menace || row.Threat) {
                        await createRisk({
                            threat: row.Menace || row.Threat,
                            vulnerability: row.Vulnerability || row.Vulnérabilite || '',
                            probability: (parseInt(row.Probability || row.Probabilite || '1') as 1 | 2 | 3 | 4 | 5),
                            impact: (parseInt(row.Impact || '1') as 1 | 2 | 3 | 4 | 5),
                            strategy: (row.Strategy || row.Strategie || 'Atténuer') as Risk['strategy'],
                            status: (row.Status || row.Statut || 'Ouvert') as Risk['status']
                        });
                    }
                }
                setImporting(false);
                refreshRisks();
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
            error: (err: unknown) => {
                console.error("Import Error", err);
                setImporting(false);
            }
        });
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-500">
            <SEO title={risksTitle} description={risksSubtitle} />
            <MasterpieceBackground />

            <div className="relative z-10 p-6 md:p-8 space-y-8 max-w-[1920px] mx-auto">
                <RiskHeader
                    risksTitle={risksTitle}
                    risksSubtitle={risksSubtitle}
                    canEdit={canEdit}
                    isGeneratingReport={isGeneratingReport}
                    isExportingCSV={isExportingCSV}
                    importing={importing}
                    filteredRisks={filteredRisks}
                    onExportRTP={handleExportRTP}
                    onExportExecutiveReport={handleExportExecutive}
                    onExportPDF={handleExportPDF}
                    onExportCSV={() => exportCSV(filteredRisks)}
                    onImportCSV={() => fileInputRef.current?.click()}
                    onTemplateModalOpen={() => setIsTemplateModalOpen(true)}
                    onAIAnalysis={async () => {
                        setIsAnalyzing(true);
                        try {
                            // Example AI Analysis: Analyse de la distribution des risques
                            const prompt = `Analyse cette liste de ${filteredRisks.length} risques. Donne-moi 3 insights clés sur les menaces principales et une recommandation stratégique. Format court.`;
                            const analysis = await aiService.chatWithAI(prompt, {
                                riskCount: filteredRisks.length,
                                highRisks: filteredRisks.filter(r => (r.probability * r.impact) >= 12).length
                            });
                            // Display result in a nice modal or toast (for now toast/alert)
                            // Ideally detailed modal, but 'Concrete Solution' -> Toast is quick wins.
                            // Better: open a "AI Insights" modal with the result.
                            toast.info("Analyse IA terminée", { description: analysis, duration: 10000 });
                        } catch (e) {
                            console.error(e);
                            toast.error("Erreur lors de l'analyse IA");
                        } finally {
                            setIsAnalyzing(false);
                        }
                    }}
                    isAnalyzing={isAnalyzing}
                    onNewRisk={() => setCreationMode(true)}
                    fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
                />

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileUpload}
                />

                <RiskStats stats={stats} risks={risks} />

                <RiskFilters
                    query={activeFilters.query}
                    onQueryChange={(q) => setActiveFilters(prev => ({ ...prev, query: q }))}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    frameworkFilter={frameworkFilter}
                    onFrameworkFilterChange={setFrameworkFilter}
                    showAdvancedSearch={showAdvancedSearch}
                    onToggleAdvancedSearch={() => setShowAdvancedSearch(!showAdvancedSearch)}
                    totalRisks={risks.length}
                    filteredCount={filteredRisks.length}
                />

                {matrixFilter && (
                    <div className="bg-brand-50 dark:bg-brand-900/20 p-4 rounded-2xl border border-brand-100 dark:border-brand-900/30 flex justify-between items-center mb-6">
                        <span className="text-sm font-bold text-brand-900 dark:text-brand-100">
                            Filtre Matrice : Probabilité {matrixFilter.p} × Impact {matrixFilter.i}
                        </span>
                        <button onClick={() => setMatrixFilter(null)} className="text-xs text-red-500 font-bold hover:underline">Réinitialiser</button>
                    </div>
                )}

                {viewMode === 'matrix' ? (
                    <RiskMatrix
                        risks={filteredRisks}
                        matrixFilter={matrixFilter}
                        setMatrixFilter={setMatrixFilter}
                        frameworkFilter={frameworkFilter}
                    />
                ) : viewMode === 'list' ? (
                    <RiskList
                        risks={filteredRisks}
                        loading={dataLoading}
                        canEdit={canEdit}
                        assets={assets}
                        onEdit={(r) => setSelectedRisk(r)}
                        onDelete={deleteRisk}
                        onBulkDelete={bulkDeleteRisks}
                        onSelect={(r) => setSelectedRisk(r)}
                    />
                ) : (
                    <RiskGrid
                        risks={filteredRisks}
                        loading={dataLoading}
                        assets={assets}
                        onSelect={(r) => setSelectedRisk(r)}
                        emptyStateIcon={ShieldAlert}
                        emptyStateTitle="Aucun risque"
                        emptyStateDescription="Aucun risque trouvé."
                    />
                )}
            </div>

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
                onDelete={deleteRisk}
                onDuplicate={(r) => createRisk({ ...r, threat: `${r.threat} (Copie)` } as Risk)}
            />

            <Drawer
                isOpen={creationMode}
                onClose={() => setCreationMode(false)}
                title="Nouveau Risque"
                width="max-w-4xl"
            >
                <div className="p-6">
                    <RiskForm
                        onSubmit={async (data) => {
                            const success = await createRisk(data as Risk);
                            if (success) setCreationMode(false);
                        }}
                        onCancel={() => setCreationMode(false)}
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
                onSelectTemplate={async () => {
                    // Adapter logic for template
                    setIsTemplateModalOpen(false);
                }}
                users={usersList}
            />
        </div>
    );
};
