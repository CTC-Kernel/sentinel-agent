import React, { useState, useEffect, useCallback } from 'react';
import { PdfService } from '../services/PdfService';
import { ReportEnrichmentService } from '../services/ReportEnrichmentService';
import { ScheduledReportsService } from '../services/scheduledReportsService';
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
    Archive,
    Calendar,
    Play,
    Pause,
    Trash2,
    Plus,
    Mail,
    Clock
} from '../components/ui/Icons';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { CompliancePackService } from '../services/CompliancePackService';
import { ErrorLogger } from '../services/errorLogger';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { hasPermission } from '../utils/permissions';
import { useReportsData } from '../hooks/reports/useReportsData';
import { Button } from '../components/ui/button';
import { SEO } from '../components/SEO';
import { ConfirmModal } from '../components/ui/ConfirmModal';

import { ReportConfigurationModal, ReportConfig } from '../components/reports/ReportConfigurationModal';
import { ScheduleReportModal } from '../components/reports/ScheduleReportModal';
import {
    ScheduledReport,
    ScheduledReportFormData,
    ReportTemplateId,
    frequencyLabels
} from '../types/reports';
import { SENTINEL_PALETTE } from '../theme/chartTheme';

export const Reports: React.FC = () => {
    const { user, t, organization, addToast, activeFramework } = useStore();
    const [activeTab, setActiveTab] = useState('templates');
    const [loadingAction, setLoadingAction] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleTemplateId, setScheduleTemplateId] = useState<ReportTemplateId>('custom');
    const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
    const [loadingScheduled, setLoadingScheduled] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; reportId: string | null }>({
        isOpen: false,
        reportId: null
    });

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

    // Fetch scheduled reports
    const fetchScheduledReports = useCallback(async () => {
        if (!user?.organizationId) return;
        setLoadingScheduled(true);
        try {
            const reports = await ScheduledReportsService.getScheduledReports(user.organizationId);
            setScheduledReports(reports);
        } catch (error) {
            ErrorLogger.error('Failed to fetch scheduled reports', 'Reports.fetchScheduledReports', { metadata: { error } });
        } finally {
            setLoadingScheduled(false);
        }
    }, [user?.organizationId]);

    useEffect(() => {
        if (activeTab === 'scheduled') {
            fetchScheduledReports();
        }
    }, [activeTab, fetchScheduledReports]);

    const handleScheduleReport = async (data: ScheduledReportFormData) => {
        if (!user?.organizationId || !user?.uid) return;

        try {
            await ScheduledReportsService.createScheduledReport(
                user.organizationId,
                user.uid,
                user.displayName || user.email || 'Unknown',
                data
            );
            addToast(t('reports.toast.scheduleSuccess'), 'success');
            fetchScheduledReports();
        } catch (error) {
            ErrorLogger.error('Failed to schedule report', 'Reports.handleScheduleReport', { metadata: { error } });
            throw error;
        }
    };

    const handleToggleStatus = async (report: ScheduledReport) => {
        try {
            await ScheduledReportsService.toggleScheduledReportStatus(report.id, report.status);
            addToast(
                report.status === 'active' ? t('reports.toast.paused') : t('reports.toast.reactivated'),
                'success'
            );
            fetchScheduledReports();
        } catch (error) {
            ErrorLogger.error('Failed to toggle report status', 'Reports.handleToggleStatus', { metadata: { error } });
            addToast(t('reports.toast.updateError'), 'error');
        }
    };

    const handleDeleteReport = async () => {
        if (!deleteConfirm.reportId) return;

        try {
            await ScheduledReportsService.deleteScheduledReport(deleteConfirm.reportId);
            addToast(t('reports.toast.deleteSuccess'), 'success');
            setDeleteConfirm({ isOpen: false, reportId: null });
            fetchScheduledReports();
        } catch (error) {
            ErrorLogger.error('Failed to delete scheduled report', 'Reports.handleDeleteReport', { metadata: { error } });
            addToast(t('reports.toast.deleteError'), 'error');
        }
    };

    const openScheduleModal = (templateId: ReportTemplateId) => {
        setScheduleTemplateId(templateId);
        setShowScheduleModal(true);
    };

    const generatePDF = async (templateId: string, title: string, config?: ReportConfig) => {
        if (!hasPermission(user, 'Document', 'create')) {
            addToast(t('errors.permissionDenied', { defaultValue: 'Permission refusée' }), 'error');
            return;
        }
        if (!checkLimit('reports')) return; // reports feature check
        setLoadingAction(true);
        try {
            if (templateId === 'iso27001' || templateId === 'gdpr') {
                await CompliancePackService.generatePack({
                    organizationName: organization?.name || 'Organization',
                    risks: config?.includeRisks === false ? [] : (risks || []),
                    audits: config?.includeAudits === false ? [] : (audits || []),
                    assets: config?.includeCompliance === false ? [] : (assets || []),
                    documents: documents || [],
                    controls: config?.includeCompliance === false ? [] : (controls || []),
                    incidents: config?.includeIncidents === false ? [] : (incidents || []),
                    projects: config?.includeProjects === false ? [] : (projects || [])
                });
                addToast(t('reports.success'), 'success');
            } else if (templateId === 'custom') {
                // Generate Global Executive Report
                // 1. Calculate all metrics
                const riskMetrics = config?.includeRisks !== false ? ReportEnrichmentService.calculateMetrics(risks || []) : { total_risks: 0, critical_risks: 0, high_risks: 0, medium_risks: 0, low_risks: 0, avg_score: 0, risk_score: 0, treated_percentage: 0 };
                const complianceMetrics = config?.includeCompliance !== false ? ReportEnrichmentService.calculateComplianceMetrics(controls || []) : {
                    total_controls: 0,
                    implemented_controls: 0,
                    partial_controls: 0,
                    not_implemented_controls: 0,
                    not_applicable_controls: 0,
                    compliance_coverage: 0,
                    audit_readiness: 0,
                    planned_controls: 0,
                    not_applicable: 0,
                    not_started: 0
                };

                // Real Audit Metrics
                const auditMetricsList = config?.includeAudits !== false ? (audits || []).map(a => ({
                    total_findings: a.findingsCount || 0,
                    major_findings: 0, // Breakdown not available in list view
                    minor_findings: 0,
                    observations: 0,
                    open_findings: a.status !== 'Terminé' && a.status !== 'Validé' ? (a.findingsCount || 0) : 0, // Approximation
                    closed_findings: a.status === 'Terminé' || a.status === 'Validé' ? (a.findingsCount || 0) : 0, // Approximation
                    conformity_score: a.score || 0
                })) : [];
                const projectMetricsList = config?.includeProjects !== false ? (projects || []).map(p => ReportEnrichmentService.calculateProjectMetrics(p)) : [];

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
                            { label: t('reports.pdf.labelRisks'), value: globalMetrics.risk_health, color: SENTINEL_PALETTE.series6 },
                            { label: t('reports.pdf.labelCompliance'), value: globalMetrics.compliance_health, color: SENTINEL_PALETTE.series2 },
                            { label: t('reports.pdf.labelAudit'), value: globalMetrics.audit_health, color: SENTINEL_PALETTE.series1 },
                            { label: t('reports.pdf.labelProjects'), value: globalMetrics.project_health, color: SENTINEL_PALETTE.series5 }
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
                        PdfService.drawProgressBar(doc, 14, currentY, pageWidth - 28, 6, complianceMetrics.compliance_coverage, t('reports.pdf.globalCoverage'), SENTINEL_PALETTE.series2);
                        currentY += 15;
                        PdfService.drawProgressBar(doc, 14, currentY, pageWidth - 28, 6, complianceMetrics.audit_readiness, t('reports.pdf.auditReadiness'), SENTINEL_PALETTE.series1);
                        currentY += 20;

                    }
                );
                addToast(t('reports.success'), 'success');

            } else {
                const doc = new jsPDF();
                doc.text(title, 10, 10);
                doc.save(`${title}.pdf`);
                addToast(t('reports.success'), 'success');
            }

        } catch (error) {
            // Enhanced error logging for debugging
            if (error instanceof Error) {
                ErrorLogger.error('PDF Generation Error', 'Reports.generatePDF', {
                    metadata: {
                        message: error.message,
                        stack: error.stack
                    }
                });
            } else {
                ErrorLogger.error('Unknown PDF Generation Error', 'Reports.generatePDF', {
                    metadata: { error }
                });
            }
            // Log to console for user to provide if needed
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
            className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
        >
            <MasterpieceBackground />
            <SEO
                title={t('reports.title')}
                description={t('reports.seoDescription')}
                keywords={t('reports.keywords')}
            />

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title={t('reports.title')}
                    subtitle={t('reports.subtitle')}
                    icon={
                        <img
                            src="/images/pilotage.png"
                            alt="PILOTAGE"
                            className="w-full h-full object-contain"
                        />
                    }
                />
            </motion.div>

            <motion.div variants={slideUpVariants} className="mb-8">
                <ScrollableTabs
                    tabs={TABS}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </motion.div>

            {activeTab === 'templates' && (
                <div className="space-y-6 sm:space-y-8 lg:space-y-10">
                    {/* Compliance Section */}
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-brand-500" />
                            {t('reports.categories.compliance')}
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            <div className={`glass-premium p-4 sm:p-6 rounded-3xl border transition-all duration-300 group relative overflow-hidden ${activeFramework?.toUpperCase() === 'ISO27001' ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-border/40 hover:border-brand-500/50'}`}>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/20 dark:bg-brand-400/15 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-200 dark:group-hover:bg-brand-500/30 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-brand-100 dark:bg-brand-900 rounded-xl text-brand-600 group-hover:scale-110 transition-transform">
                                            <ShieldCheck className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('reports.templateCards.iso27001.title')}</h3>
                                            {(activeFramework?.toUpperCase() === 'ISO27001' || !activeFramework) && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success-bg text-success-text mt-1">
                                                    {t('reports.badges.recommended')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-muted-foreground mb-6 min-h-[40px]">
                                        {t('reports.templateCards.iso27001.desc')}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1 justify-center group-hover:bg-brand-600 group-hover:text-white dark:group-hover:text-white transition-colors"
                                            variant="outline"
                                            onClick={() => generatePDF('iso27001', t('reports.templateCards.iso27001.title'))}
                                        >
                                            {t('reports.templateCards.iso27001.action')}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => openScheduleModal('iso27001')}
                                            title={t('reports.scheduleThis')}
                                        >
                                            <Calendar className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className={`glass-premium p-4 sm:p-6 rounded-3xl border transition-all duration-300 group relative overflow-hidden ${activeFramework?.toUpperCase() === 'GDPR' ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-border/40 hover:border-brand-500/50'}`}>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/20 dark:bg-brand-400/15 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-200 dark:group-hover:bg-brand-500/30 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-brand-100 dark:bg-brand-900 rounded-xl text-brand-600 group-hover:scale-110 transition-transform">
                                            <Lock className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('reports.templateCards.gdpr.title')}</h3>
                                            {activeFramework?.toUpperCase() === 'GDPR' && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success-bg text-success-text mt-1">
                                                    {t('reports.badges.recommended')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-muted-foreground mb-6 min-h-[40px]">
                                        {t('reports.templateCards.gdpr.desc')}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1 justify-center group-hover:bg-brand-600 group-hover:text-white dark:group-hover:text-white transition-colors"
                                            variant="outline"
                                            onClick={() => generatePDF('gdpr', t('reports.templateCards.gdpr.title'))}
                                        >
                                            {t('reports.templateCards.gdpr.action')}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => openScheduleModal('gdpr')}
                                            title={t('reports.scheduleThis')}
                                        >
                                            <Calendar className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Executive Section */}
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <FileText className="h-6 w-6 text-violet-500" />
                            {t('reports.categories.executive')}
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 hover:border-violet-500/50 transition-all duration-300 group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/15 dark:bg-violet-400/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-violet-500/25 dark:group-hover:bg-violet-400/20 transition-colors"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-xl text-violet-600 group-hover:scale-110 transition-transform">
                                            <Settings className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('reports.templateCards.custom.title')}</h3>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-400 mt-1">
                                                {t('reports.badges.complete')}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-muted-foreground mb-6 min-h-[40px]">
                                        {t('reports.templateCards.custom.desc')}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1 justify-center group-hover:bg-violet-600 group-hover:text-white dark:group-hover:text-white transition-colors"
                                            variant="outline"
                                            onClick={() => setShowConfigModal(true)}
                                        >
                                            {t('reports.templateCards.custom.action')}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => openScheduleModal('custom')}
                                            title={t('reports.scheduleThis')}
                                        >
                                            <Calendar className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'generated' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {documents.filter(d => d.type === 'Rapport').length > 0 ? (
                        documents.filter(d => d.type === 'Rapport').map(doc => (
                            <div key={doc.id || 'unknown'} className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 hover:border-brand-400/50 transition-all duration-300 group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-muted-foreground">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${doc.status === 'Publié' ? 'bg-success-bg text-success-text' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                                        {doc.status}
                                    </span>
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-1 truncate" title={doc.title}>{doc.title}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-300 mb-4">v{doc.version} • {new Date(doc.createdAt).toLocaleDateString()}</p>
                                <Button size="sm" variant="ghost" className="w-full justify-between group-hover:bg-slate-100 dark:hover:bg-slate-800 dark:group-hover:bg-slate-800">
                                    {t('common.download')} <Archive className="h-4 w-4" />
                                </Button>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-300 glass-premium rounded-3xl border border-dashed border-border/40 shadow-sm">
                            <Archive className="h-12 w-12 opacity-20 mb-4" />
                            <p className="font-medium">{t('reports.generated.empty')}</p>
                            <Button variant="link" onClick={() => setActiveTab('templates')}>
                                {t('reports.generated.createNew')}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'scheduled' && (
                <div className="space-y-6">
                    {/* Header with Add Button */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('reports.scheduledSection.title')}</h2>
                            <p className="text-sm text-slate-500">{t('reports.scheduledSection.subtitle')}</p>
                        </div>
                        <Button onClick={() => openScheduleModal('custom')} className="gap-2">
                            <Plus className="h-4 w-4" />
                            {t('reports.scheduledSection.scheduleReport')}
                        </Button>
                    </div>

                    {loadingScheduled ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i || 'unknown'} className="glass-premium p-4 sm:p-6 rounded-2xl animate-pulse">
                                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                                </div>
                            ))}
                        </div>
                    ) : scheduledReports.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {scheduledReports.map(report => (
                                <div
                                    key={report.id || 'unknown'}
                                    className={`glass-premium p-4 sm:p-6 rounded-3xl border transition-all duration-300 ${report.status === 'active'
                                        ? 'border-success-border/50 shadow-md shadow-success/5'
                                        : 'border-border/40 opacity-60'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                            <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                                        </div>
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${report.status === 'active'
                                            ? 'bg-success-bg text-success-text'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                            }`}>
                                            {report.status === 'active' ? t('reports.status.active') : t('reports.status.paused')}
                                        </span>
                                    </div>

                                    <h3 className="font-bold text-slate-900 dark:text-white mb-2 truncate" title={report.name}>
                                        {report.name}
                                    </h3>

                                    <div className="space-y-2 text-sm text-slate-500 dark:text-slate-300 mb-4">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            <span>{t(`reports.templateLabels.${report.templateId}`)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            <span>{frequencyLabels[report.frequency]}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4" />
                                            <span className="truncate">{report.recipients.length} {t('reports.scheduledSection.recipients', { count: report.recipients.length })}</span>
                                        </div>
                                    </div>

                                    <div className="text-xs text-muted-foreground mb-4">
                                        {t('reports.scheduledSection.nextRun')}: {new Date(report.nextRunAt).toLocaleDateString('fr-FR', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => handleToggleStatus(report)}
                                        >
                                            {report.status === 'active' ? (
                                                <>
                                                    <Pause className="h-4 w-4 mr-1" />
                                                    Pause
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="h-4 w-4 mr-1" />
                                                    Activer
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20"
                                            onClick={() => setDeleteConfirm({ isOpen: true, reportId: report.id })}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 text-slate-500 dark:text-slate-300 font-medium glass-premium rounded-3xl border border-dashed border-border/40 shadow-sm">
                            <History className="h-16 w-16 mx-auto mb-6 opacity-20" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('reports.scheduledSection.emptyTitle')}</h3>
                            <p className="max-w-md mx-auto mb-6">{t('reports.scheduledSection.emptyDescription')}</p>
                            <Button onClick={() => openScheduleModal('custom')}>
                                <Plus className="h-4 w-4 mr-2" />
                                {t('reports.scheduledSection.scheduleReport')}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <ReportConfigurationModal
                isOpen={showConfigModal}
                onClose={() => setShowConfigModal(false)}
                onGenerate={(config) => generatePDF('custom', config.title, config)}
                defaultTitle={t('reports.templateCards.custom.title')}
            />

            <ScheduleReportModal
                isOpen={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                onSchedule={handleScheduleReport}
                defaultTemplateId={scheduleTemplateId}
            />

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, reportId: null })}
                onConfirm={handleDeleteReport}
                title={t('reports.deleteScheduled.title')}
                message={t('reports.deleteScheduled.message')}
            />
        </motion.div>
    );
};
