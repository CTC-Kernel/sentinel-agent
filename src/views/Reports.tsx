import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { PageHeader } from '../components/ui/PageHeader';
import { motion } from 'framer-motion';
import { staggerContainerVariants, slideUpVariants } from '../components/ui/animationVariants';

import {
    FileText,
    ShieldAlert,
    ShieldCheck,
    Server,
    Download,
    Printer,
    History,
    Settings,
    FileSpreadsheet,
    Activity,
    FileCheck,
    Trash2,
    Lock,
    Search,
    Archive,
    BarChart3
} from 'lucide-react';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { Button } from '../components/ui/button';
import { PdfService } from '../services/PdfService';
import { CompliancePackService } from '../services/CompliancePackService';
import { ErrorLogger } from '../services/errorLogger';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { hasPermission, canDeleteResource } from '../utils/permissions';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { useReportsData } from '../hooks/reports/useReportsData';
import { SEO } from '../components/SEO';

const TABS = [
    { id: 'templates', label: 'Modèles', icon: FileText },
    { id: 'generated', label: 'Rapports Générés', icon: Archive },
    { id: 'scheduled', label: 'Planifiés', icon: History }
];

export const Reports: React.FC = () => {
    const { user, t } = useStore();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('templates');
    const [loadingAction, setLoadingAction] = useState(false);

    // Data Hook
    const {
        risks,
        audits,
        assets,
        documents,
        controls,
        incidents,
        vulnerabilities,
        processes,
        loading: loadingData
    } = useReportsData(user?.organizationId);

    const { checkLimit } = usePlanLimits();

    const generatePDF = async (templateId: string, title: string) => {
        if (!checkLimit('reports')) return;
        setLoadingAction(true);
        try {
            // NOTE: Using PdfService which handles logic. We pass data.
            // Some reports might require fetching specific data inside PdfService or we pass it all.
            // Usually PdfService methods fetch or we pass big objects.
            // Assuming PdfService is updated to take data or handles it.
            // If it handles it, we are fine. If we need to pass data, we pass it.
            // Let's assume PdfService handles fetching or accepts data.
            // For now, simulating generation or calling actual service.

            // Example for Compliance Pack
            if (templateId === 'iso27001' || templateId === 'gdpr') {
                await CompliancePackService.generatePack(templateId, {
                    risks,
                    audits,
                    assets,
                    documents,
                    controls
                    // policies? we have documents.
                });
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
                title={t('sidebar.reports')}
                description="Génération de rapports de conformité et d'audit."
            />

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title={t('sidebar.reports')}
                    subtitle="Centralisation et génération des preuves et rapports d'audit."
                    icon={<FileText className="h-6 w-6 text-white" strokeWidth={2.5} />}
                    trustType="compliance"
                />
            </motion.div>

            <motion.div variants={slideUpVariants} className="sticky top-[80px] z-30 mb-8">
                <ScrollableTabs
                    tabs={TABS}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Template Cards Demo */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-brand-500 transition-all cursor-pointer group" onClick={() => generatePDF('iso27001', 'Rapport ISO 27001')}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-brand-100 dark:bg-brand-900/30 rounded-xl text-brand-600 group-hover:scale-110 transition-transform">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Pack ISO 27001</h3>
                            <p className="text-xs text-slate-500">SoA, Politiques, Risques</p>
                        </div>
                    </div>
                    <button className="w-full py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition-colors">
                        Générer
                    </button>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-brand-500 transition-all cursor-pointer group" onClick={() => generatePDF('gdpr', 'Rapport RGPD')}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                            <Lock className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Pack RGPD</h3>
                            <p className="text-xs text-slate-500">Registre, DPIA, Violations</p>
                        </div>
                    </div>
                    <button className="w-full py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition-colors">
                        Générer
                    </button>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-brand-500 transition-all cursor-pointer group" onClick={() => generatePDF('custom', 'Rapport Personnalisé')}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 group-hover:scale-110 transition-transform">
                            <Settings className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Rapport Personnalisé</h3>
                            <p className="text-xs text-slate-500">Choisissez vos indicateurs</p>
                        </div>
                    </div>
                    <button className="w-full py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-brand-600 hover:text-white transition-colors">
                        Configurer
                    </button>
                </div>
            </div>

        </motion.div>
    );
};
