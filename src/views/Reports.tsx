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
import { Button } from '../components/ui/button';
import { SEO } from '../components/SEO';

export const Reports: React.FC = () => {
    const { user, t, organization, addToast } = useStore();
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
            console.log('🔄 Generating PDF:', { templateId, title, risksCount: risks?.length, controlsCount: controls?.length });

            if (templateId === 'iso27001' || templateId === 'gdpr') {
                console.log('📦 Generating compliance pack...');
                await CompliancePackService.generatePack({
                    organizationName: organization?.name || 'Organization',
                    risks: risks || [],
                    audits: audits || [],
                    assets: assets || [],
                    documents: documents || [],
                    controls: controls || [],
                    incidents: incidents || [],
                    projects: projects || []
                });
                console.log('✅ Compliance pack generated successfully');
                addToast(t('reports.success'), 'success');
            } else if (templateId === 'custom') {
                console.log('📊 Generating custom executive report...');
                // Generate Global Executive Report
                // 1. Calculate all metrics
                const riskMetrics = ReportEnrichmentService.calculateMetrics(risks || []);
                const complianceMetrics = ReportEnrichmentService.calculateComplianceMetrics(controls || []);
                // Need audit metrics per audit? Or just global?
                // Let's create dummy audit metrics if we don't have detailed finding data
                // Or better, assume we can get basic status from audits.
                // Real Audit Metrics
                const auditMetricsList = (audits || []).map(a => ({
                    total_findings: a.findingsCount || 0,
                    major_findings: 0, // Breakdown not available in list view
                    minor_findings: 0,
                    observations: 0,
                    open_findings: a.status !== 'Terminé' && a.status !== 'Validé' ? (a.findingsCount || 0) : 0, // Approximation
                    closed_findings: a.status === 'Terminé' || a.status === 'Validé' ? (a.findingsCount || 0) : 0, // Approximation
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
                        title: t('reports.pdf.title'),
                        subtitle: t('reports.pdf.subtitle'),
                        filename: t('reports.pdf.filename'),
                        organizationName: organization?.name || 'Sentinel GRC',
                        orientation: 'portrait',
                        summary: globalSummary,
                        metrics: [
                            { label: t('reports.pdf.globalScore'), value: `${globalMetrics.global_score}/100`, subtext: t('reports.pdf.governanceIndex') },
                            { label: t('reports.pdf.labelRisks'), value: `${globalMetrics.risk_health}%`, subtext: t('reports.pdf.riskHealth') },
                            { label: t('reports.pdf.isoCoverage'), value: `${globalMetrics.compliance_health}%`, subtext: t('reports.pdf.isoCoverage') }
                        ],
                        stats: [
                            { label: t('reports.pdf.labelRisks'), value: globalMetrics.risk_health, color: '#EF4444' },
                            { label: t('reports.pdf.labelCompliance'), value: globalMetrics.compliance_health, color: '#10B981' },
                            { label: t('reports.pdf.labelAudit'), value: globalMetrics.audit_health, color: '#3B82F6' },
                            { label: t('reports.pdf.labelProjects'), value: globalMetrics.project_health, color: '#F59E0B' }
                        ]
                    },
                    (doc, y) => {
                        let currentY = y;
                        const pageWidth = doc.internal.pageSize.width;

                        // 1. Risk Overview
                        doc.setFontSize(14);
                        doc.setTextColor('#334155');
                        doc.setFont('helvetica', 'bold');
                        doc.text(t('reports.pdf.riskManagement'), 14, currentY);
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
                        doc.text(t('reports.pdf.complianceStatus'), 14, currentY);
                        currentY += 10;
                        PdfService.drawProgressBar(doc, 14, currentY, pageWidth - 28, 6, complianceMetrics.compliance_coverage, t('reports.pdf.globalCoverage'), '#10B981');
                        currentY += 15;
                        PdfService.drawProgressBar(doc, 14, currentY, pageWidth - 28, 6, complianceMetrics.audit_readiness, t('reports.pdf.auditReadiness'), '#3B82F6');
                        currentY += 20;

                    }
                );
                console.log('✅ Custom report generated successfully');
                addToast(t('reports.success'), 'success');

            } else {
                const doc = new jsPDF();
                doc.text(title, 10, 10);
                doc.save(`${title}.pdf`);
                console.log('✅ Simple PDF generated successfully');
                addToast(t('reports.success'), 'success');
            }

        } catch (error) {
            console.error('❌ PDF Generation Error:', error);
            console.error('Error details:', {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : 'No stack available',
                fullError: typeof error === 'object' ? JSON.stringify(error) : error,
                templateId,
                title
            });
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
                <div className="space-y-8">
                    {/* Compliance Section */}
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-brand-500" />
                            {t('reports.categories.compliance')}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div
                                className="glass-premium p-6 rounded-2xl border border-white/10 hover:border-brand-500 transition-all cursor-pointer group relative overflow-hidden"
                                onClick={() => generatePDF('iso27001', t('reports.templateCards.iso27001.title'))}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        generatePDF('iso27001', t('reports.templateCards.iso27001.title'));
                                    }
                                }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-500/20 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-brand-100 dark:bg-brand-900/30 rounded-xl text-brand-600 group-hover:scale-110 transition-transform">
                                            <ShieldCheck className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('reports.templateCards.iso27001.title')}</h3>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 mt-1">
                                                Recommandé
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 min-h-[40px]">
                                        {t('reports.templateCards.iso27001.desc')}
                                    </p>
                                    <Button
                                        className="w-full justify-center group-hover:bg-brand-600 group-hover:text-white dark:group-hover:text-white transition-colors"
                                        variant="outline"
                                    >
                                        {t('reports.templateCards.iso27001.action')}
                                    </Button>
                                </div>
                            </div>

                            <div
                                className="glass-premium p-6 rounded-2xl border border-white/10 hover:border-blue-500 transition-all cursor-pointer group relative overflow-hidden"
                                onClick={() => generatePDF('gdpr', t('reports.templateCards.gdpr.title'))}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        generatePDF('gdpr', t('reports.templateCards.gdpr.title'));
                                    }
                                }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                                            <Lock className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('reports.templateCards.gdpr.title')}</h3>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 min-h-[40px]">
                                        {t('reports.templateCards.gdpr.desc')}
                                    </p>
                                    <Button
                                        className="w-full justify-center group-hover:bg-blue-600 group-hover:text-white dark:group-hover:text-white transition-colors"
                                        variant="outline"
                                    >
                                        {t('reports.templateCards.gdpr.action')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Executive Section */}
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <FileText className="h-6 w-6 text-purple-500" />
                            {t('reports.categories.executive')}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div
                                className="glass-premium p-6 rounded-2xl border border-white/10 hover:border-purple-500 transition-all cursor-pointer group relative overflow-hidden"
                                onClick={() => generatePDF('custom', t('reports.templateCards.custom.title'))}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        generatePDF('custom', t('reports.templateCards.custom.title'));
                                    }
                                }}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 group-hover:scale-110 transition-transform">
                                            <Settings className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('reports.templateCards.custom.title')}</h3>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 mt-1">
                                                Complet
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 min-h-[40px]">
                                        {t('reports.templateCards.custom.desc')}
                                    </p>
                                    <Button
                                        className="w-full justify-center group-hover:bg-purple-600 group-hover:text-white dark:group-hover:text-white transition-colors"
                                        variant="outline"
                                    >
                                        {t('reports.templateCards.custom.action')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'generated' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {documents.filter(d => d.type === 'Rapport').length > 0 ? (
                        documents.filter(d => d.type === 'Rapport').map(doc => (
                            <div key={doc.id} className="glass-premium p-6 rounded-2xl border border-white/50 dark:border-white/5 hover:border-brand-500/50 transition-all group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${doc.status === 'Publié' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600'}`}>
                                        {doc.status}
                                    </span>
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-1 truncate" title={doc.title}>{doc.title}</h3>
                                <p className="text-xs text-slate-500 mb-4">v{doc.version} • {new Date(doc.createdAt).toLocaleDateString()}</p>
                                <Button size="sm" variant="ghost" className="w-full justify-between group-hover:bg-slate-100 dark:group-hover:bg-slate-800">
                                    Télécharger <Archive className="h-4 w-4" />
                                </Button>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500 glass-panel rounded-3xl border-dashed">
                            <Archive className="h-12 w-12 opacity-20 mb-4" />
                            <p className="font-medium">Aucun rapport généré pour le moment.</p>
                            <Button variant="link" onClick={() => setActiveTab('templates')}>
                                Créer un nouveau rapport
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'scheduled' && (
                <div className="text-center py-16 text-slate-500 font-medium glass-panel rounded-3xl border-dashed">
                    <History className="h-16 w-16 mx-auto mb-6 opacity-20" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Aucun rapport planifié</h3>
                    <p className="max-w-md mx-auto mb-6">Automatisez la génération de vos rapports pour recevoir des mises à jour régulières directement dans votre boîte mail.</p>
                    <Button variant="outline" disabled>
                        Planifier un rapport (Bientôt)
                    </Button>
                </div>
            )}

        </motion.div>
    );
};
