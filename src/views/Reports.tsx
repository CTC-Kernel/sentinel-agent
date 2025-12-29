import React, { useState } from 'react';
import { Link } from 'react-router-dom'; // Navigation: available for future enhancements
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
        loading: loadingData
    } = useReportsData(user?.organizationId);

    const { checkLimit } = usePlanLimits();
    // Wait usePlanLimits doesn't return organization. useStore does.
    // I need to use user.organizationId or fetch organization info.
    // The previous code used useStore but didn't destructure organization.

    // Let's get organization from useStore() directly in component if usePlanLimits doesn't return it.
    // However, Reports.tsx uses useStore already.

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
                    incidents
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
