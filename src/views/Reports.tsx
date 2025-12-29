import React, { useState } from 'react';
import { PdfService } from '../services/PdfService';
import { ReportEnrichmentService } from '../services/ReportEnrichmentService';
import { jsPDF } from 'jspdf';
import { useStore } from '../store';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { PageHeader } from '../components/ui/PageHeader';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';

import {
    FileText,
    ShieldCheck,
    History,
    Settings,
    Lock,
    Archive
} from 'lucide-react';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { CompliancePackService } from '../services/CompliancePackService';
import { ErrorLogger } from '../services/errorLogger';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useReportsData } from '../hooks/reports/useReportsData';
import { SEO } from '../components/SEO';

export const Reports: React.FC = () => {
    const { user, t, organization } = useStore();
    const [activeTab, setActiveTab] = useState('templates');
    const [loadingAction, setLoadingAction] = useState(false);

    const TABS = [
        { id: 'templates', label: t('reports.templates'), icon: FileText },
        { id: 'generated', label: t('reports.history'), icon: Archive },
        { id: 'scheduled', label: t('reports.scheduled'), icon: History }
    ];

    // Data Hook
    const {
        risks,
        audits,
        assets,
        documents,
        controls,
        incidents,
        projects,
        loading: loadingData
    } = useReportsData(user?.organizationId);

    const { checkLimit } = usePlanLimits();

    const generatePDF = async (templateId: string, title: string) => {
        if (!checkLimit('reports')) return; // reports feature check
        setLoadingAction(true);
        try {
            if (templateId === 'iso27001' || templateId === 'gdpr') {
                await CompliancePackService.generatePack({
                    organizationName: organization?.name || 'Organization',
                    risks,
                    audits,
                    assets,
                    documents,
                    controls,
                    incidents,
                    projects
                });
            } else if (templateId === 'custom') {
                // Generate Global Executive Report
                // 1. Calculate all metrics
                const riskMetrics = ReportEnrichmentService.calculateMetrics(risks || []);
                const complianceMetrics = ReportEnrichmentService.calculateComplianceMetrics(controls || []);
                // Need audit metrics per audit? Or just global?
                // Let's create dummy audit metrics if we don't have detailed finding data
                // Or better, assume we can get basic status from audits.
                const auditMetricsList = (audits || []).map(a => ({
                    total_findings: 10, // Mocked as we don't have findings in list view
                    major_findings: 2,
                    minor_findings: 3,
                    observations: 5,
                    open_findings: 5,
                    closed_findings: 5,
                    conformity_score: a.score || 0
                }));
                const projectMetricsList = (projects || []).map(p => ReportEnrichmentService.calculateProjectMetrics(p));

                const globalMetrics = ReportEnrichmentService.calculateGlobalMetrics(
                    riskMetrics,
                    complianceMetrics,
                    auditMetricsList,
                    projectMetricsList
                );

                const globalSummary = ReportEnrichmentService.generateGlobalExecutiveSummary(globalMetrics);

                PdfService.generateExecutiveReport(
                    {
                        title: "Rapport de Gouvernance Globale",
                        subtitle: "Synthèse exécutive et indicateurs de performance",
                        filename: "Rapport_Gouvernance_Global.pdf",
                        organizationName: organization?.name || 'Sentinel GRC',
                        orientation: 'portrait',
                        summary: globalSummary,
                        metrics: [
                            { label: 'Score Global', value: `${globalMetrics.global_score}/100`, subtext: 'Indice de Gouvernance' },
                            { label: 'Risques', value: `${globalMetrics.risk_health}%`, subtext: 'Indice de Santé' },
                            { label: 'Conformité', value: `${globalMetrics.compliance_health}%`, subtext: 'Couverture ISO' }
                        ],
                        stats: [
                            { label: 'Risques', value: globalMetrics.risk_health, color: '#EF4444' },
                            { label: 'Conformité', value: globalMetrics.compliance_health, color: '#10B981' },
                            { label: 'Audit', value: globalMetrics.audit_health, color: '#3B82F6' },
                            { label: 'Projets', value: globalMetrics.project_health, color: '#F59E0B' }
                        ]
                    },
                    (doc, y) => {
                        let currentY = y;
                        const pageWidth = doc.internal.pageSize.width;

                        // 1. Risk Overview
                        doc.setFontSize(14);
                        doc.setTextColor('#334155');
                        doc.setFont('helvetica', 'bold');
                        doc.text("1. Gestion des Risques", 14, currentY);
                        currentY += 10;

                        PdfService.drawRiskMatrix(
                            doc,
                            14,
                            currentY,
                            pageWidth - 28,
                            60,
                            (risks || []).map(r => ({ probability: r.probability || 1, impact: r.impact || 1 }))
                        );
                        currentY += 70;

                        // 2. Compliance Status
                        doc.text("2. Conformité ISO 27001", 14, currentY);
                        currentY += 10;
                        PdfService.drawProgressBar(doc, 14, currentY, pageWidth - 28, 6, complianceMetrics.compliance_coverage, "Couverture Globale", '#10B981');
                        currentY += 15;
                        PdfService.drawProgressBar(doc, 14, currentY, pageWidth - 28, 6, complianceMetrics.audit_readiness, "Préparation Audit", '#3B82F6');
                        currentY += 20;

                    }
                );

            } else {
                const doc = new jsPDF();
                doc.text(title, 10, 10);
                doc.save(`${title}.pdf`);
            }

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Reports.generatePDF', 'CREATE_FAILED');
        } finally {
            setLoadingAction(false);
        }
    };

    const loading = loadingData || loadingAction;

    if (loading && !loadingAction) return <LoadingScreen />;

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO
                title={t('reports.title')}
                description="Génération de rapports de conformité et d'audit."
            />

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title={t('reports.title')}
                    subtitle={t('reports.subtitle')}
                    icon={<FileText className="h-6 w-6 text-white" strokeWidth={2.5} />}

                />
            </motion.div>

            <motion.div variants={slideUpVariants} className="sticky top-[80px] z-30 mb-8">
                <ScrollableTabs
                    tabs={TABS}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </motion.div>

            {activeTab === 'templates' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Template Cards Demo */}
                    <div
                        className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-brand-500 transition-all cursor-pointer group"
                        onClick={() => generatePDF('iso27001', 'Rapport ISO 27001')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                generatePDF('iso27001', 'Rapport ISO 27001');
                            }
                        }}
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-brand-100 dark:bg-brand-900/30 rounded-xl text-brand-600 group-hover:scale-110 transition-transform">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Pack ISO 27001</h3>
                                <p className="text-xs text-slate-500">SoA, Politiques, Risques</p>
                            </div>
                        </div>
                        <button aria-label="Générer Rapport ISO 27001" className="w-full py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                            Générer
                        </button>
                    </div>

                    <div
                        className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-brand-500 transition-all cursor-pointer group"
                        onClick={() => generatePDF('gdpr', 'Rapport RGPD')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                generatePDF('gdpr', 'Rapport RGPD');
                            }
                        }}
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                                <Lock className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Pack RGPD</h3>
                                <p className="text-xs text-slate-500">Registre, DPIA, Violations</p>
                            </div>
                        </div>
                        <button aria-label="Générer Rapport RGPD" className="w-full py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                            Générer
                        </button>
                    </div>

                    <div
                        className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-brand-500 transition-all cursor-pointer group"
                        onClick={() => generatePDF('custom', 'Rapport Personnalisé')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                generatePDF('custom', 'Rapport Personnalisé');
                            }
                        }}
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 group-hover:scale-110 transition-transform">
                                <Settings className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Rapport Personnalisé</h3>
                                <p className="text-xs text-slate-500">Choisissez vos indicateurs</p>
                            </div>
                        </div>
                        <button aria-label="Configurer Rapport Personnalisé" className="w-full py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                            Configurer
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'generated' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {documents.filter(d => d.type === 'Rapport').length > 0 ? (
                        documents.filter(d => d.type === 'Rapport').map(doc => (
                            <div key={doc.id} className="glass-panel p-6 rounded-2xl border border-white/10">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{doc.title}</h3>
                                        <p className="text-xs text-slate-500">v{doc.version}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-12 text-slate-500">
                            Aucun rapport généré pour le moment.
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'scheduled' && (
                <div className="text-center py-12 text-slate-500 font-medium bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun rapport planifié.</p>
                </div>
            )}

        </motion.div>
    );
};
