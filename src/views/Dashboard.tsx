import React, { useEffect, useState } from 'react';
import { SEO } from '../components/SEO';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { useDashboardData } from '../hooks/dashboard/useDashboardData';
import { useDashboardReports } from '../hooks/dashboard/useDashboardReports';
import { useDashboardStatsHistory } from '../hooks/dashboard/useDashboardStatsHistory';
import { useDashboardMetrics } from '../hooks/dashboard/useDashboardMetrics';
import { useDashboardInsights } from '../hooks/dashboard/useDashboardInsights';
import { useComplianceScore } from '../hooks/useComplianceScore';

import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { hasPermission } from '../utils/permissions';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';

// Widgets
import { DashboardHeader } from '../components/dashboard/widgets/DashboardHeader';
import { QuickActions } from '../components/dashboard/widgets/QuickActions';
import { GettingStartedWidget } from '../components/dashboard/widgets/GettingStartedWidget';
import { ApprovalsWidget } from '../components/dashboard/ApprovalsWidget';
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton';
import { motion, AnimatePresence } from 'framer-motion';

// Role-based Views
import { AdminDashboardView } from '../components/dashboard/views/AdminDashboardView';
import { DirectionDashboardView } from '../components/dashboard/views/DirectionDashboardView';
import { AuditorDashboardView } from '../components/dashboard/views/AuditorDashboardView';
import { ProjectManagerDashboardView } from '../components/dashboard/views/ProjectManagerDashboardView';
import { OperationalDashboardView } from '../components/dashboard/views/OperationalDashboardView';

import { useGettingStartedState } from '../hooks/dashboard/useGettingStartedState';

/**
 * Main Dashboard Component
 * Renders role-based dashboard views with QuickActions panel
 */
export const DashboardWithQuickActions: React.FC = () => {
    const {
        controls,
        recentActivity,
        historyStats,
        allRisks,
        myRisks,
        allAssets,
        allSuppliers,
        myProjects,
        myAudits,
        myDocs,
        publishedDocs,
        pendingReviews,
        myIncidents,
        activeIncidents,
        activeIncidentsCount,
        openAuditsCount,
        organizationName: fetchedOrgName,
        organizationLogo: fetchedOrgLogo,
        loading,
        error: dataError,
        aggregatedStats
    } = useDashboardData();

    const [organizationName, setOrganizationName] = useState<string>('');
    const [organizationLogo, setOrganizationLogo] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const { user, theme, t } = useStore();
    // Use persistent state hook
    const [gettingStartedState, setGettingStartedState] = useGettingStartedState(user?.uid);
    const showGettingStarted = gettingStartedState !== 'closed';

    const [isEditing, setIsEditing] = useState(false);
    const [isAddWidgetModalOpen, setIsAddWidgetModalOpen] = useState(false);

    const navigate = useNavigate();

    // Update local state when hook data changes
    useEffect(() => {
        if (fetchedOrgName) setOrganizationName(fetchedOrgName);
        if (fetchedOrgLogo) setOrganizationLogo(fetchedOrgLogo);
        if (dataError === 'permission-denied') setError('permission-denied');
    }, [fetchedOrgName, fetchedOrgLogo, dataError]);



    // Fetch unified compliance score
    const { score: scoreData } = useComplianceScore(user?.organizationId, { realtime: true });

    const { historyData, topRisks, stats, radarData, complianceScore, scoreGrade } = useDashboardMetrics({
        controls,
        allRisks,
        allAssets,
        historyStats,
        activeIncidentsCount,
        openAuditsCount,
        myProjectsLength: myProjects.length,
        userOrgId: user?.organizationId,
        aggregatedStats, // Passed from useDashboardData
        externalComplianceScore: scoreData?.global // Use unified source of truth
    });

    // Personalized Risks - Directly from hook (optimized query)
    const myRisksList = myRisks;

    const projectRisks = React.useMemo(() => {
        if (!user || !hasPermission(user, 'Project', 'manage')) return [];
        const projectIds = myProjects.map(p => p.id);
        return allRisks.filter(r =>
            (r.ownerId === user.uid) ||
            (r.relatedProjectIds?.some((pid: string) => projectIds.includes(pid)))
        ).sort((a, b) => b.score - a.score).slice(0, 5);
    }, [allRisks, user, myProjects]);

    const isEmpty = React.useMemo(() => !loading && allRisks.length === 0 && allAssets.length === 0 && myProjects.length === 0, [loading, allRisks, allAssets, myProjects]);

    // Calcul de la prochaine échéance
    const nextDeadline = React.useMemo(() => {
        const now = new Date();
        const deadlines: { title: string; date: Date; type: 'audit' | 'project' | 'control' | 'task'; link?: string }[] = [];

        // Ajouter les audits planifiés
        myAudits?.forEach(audit => {
            if (audit.dateScheduled && audit.status !== 'Terminé' && audit.status !== 'Validé') {
                const auditDate = new Date(audit.dateScheduled);
                if (auditDate >= now) {
                    deadlines.push({
                        title: audit.name,
                        date: auditDate,
                        type: 'audit',
                        link: `/audits?id=${audit.id}`
                    });
                }
            }
        });

        // Ajouter les projets avec deadline
        myProjects?.forEach(project => {
            if (project.dueDate && project.status !== 'Terminé') {
                const projectDate = new Date(project.dueDate);
                if (projectDate >= now) {
                    deadlines.push({
                        title: project.name,
                        date: projectDate,
                        type: 'project',
                        link: `/projects?id=${project.id}`
                    });
                }
            }
        });

        // Trier par date et retourner la plus proche
        deadlines.sort((a, b) => a.date.getTime() - b.date.getTime());
        return deadlines[0] || null;
    }, [myAudits, myProjects]);

    const { insight, healthIssues, myActionItems } = useDashboardInsights({
        controls,
        myDocs,
        myAudits,
        allSuppliers,
        stats,
        allRisks,
        myIncidents,
        publishedDocs,
        myProjects,
        activeIncidentsCount,
        complianceScore
    });

    useDashboardStatsHistory({
        loading,
        historyStats,
        allRisksCount: allRisks.length,
        complianceScore,
        activeIncidentsCount,
        radarData
    });

    const { isGeneratingReport, generateICal, generateExecutiveReport: generateReport } = useDashboardReports();

    const generateExecutiveReport = () => {
        generateReport({
            organizationName,
            complianceScore,
            activeIncidentsCount,
            openAuditsCount,
            allRisks,
            topRisks,
            financialRisk: stats.financialRisk,
            radarData,
            organizationLogo
        });
    };

    if (error === 'permission-denied') { return (<div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in p-6"> <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-xl p-8 max-w-2xl w-full relative overflow-hidden border-l-4 border-l-destructive shadow-xl"> <h2 className="text-2xl font-bold text-foreground mb-2">{t('dashboard.accessDenied')}</h2> <p className="text-muted-foreground text-sm mb-6">{t('dashboard.dbLocked')}</p> </div> </div>); }

    if (loading) {
        return <DashboardSkeleton />;
    }

    return (
        <>
            <div>
                <motion.div
                    variants={staggerContainerVariants}
                    initial="initial"
                    animate="visible"
                    className="flex flex-col gap-6 sm:gap-8 lg:gap-10"
                    data-tour="dashboard"
                >
                    <MasterpieceBackground />
                    <SEO
                        title={t('dashboard.seoTitle')}
                        description={t('dashboard.seoDescription')}
                        keywords={t('dashboard.seoKeywords')}
                    />

                    <DashboardHeader
                        user={user}
                        organizationName={organizationName}
                        scoreGrade={scoreGrade}
                        loading={loading}
                        isEmpty={isEmpty}
                        navigate={navigate}
                        t={t}
                        insight={insight}
                        generateICal={generateICal}
                        generateExecutiveReport={generateExecutiveReport}
                        isGeneratingReport={isGeneratingReport}
                        isEditing={isEditing}
                        onToggleEdit={() => {
                            if (!isEditing) {
                                setIsAddWidgetModalOpen(true);
                            }
                            setIsEditing(!isEditing);
                        }}
                        onShowGettingStarted={() => setGettingStartedState('expanded')}
                        isGettingStartedClosed={!showGettingStarted}
                        activeIncidentsCount={activeIncidentsCount}
                        nextDeadline={nextDeadline}
                    />

                    {showGettingStarted && (
                        <motion.div variants={slideUpVariants}>
                            <GettingStartedWidget onClose={() => setGettingStartedState('closed')} />
                        </motion.div>
                    )}

                    {pendingReviews && pendingReviews.length > 0 && (
                        <motion.div variants={slideUpVariants}>
                            <ApprovalsWidget documents={pendingReviews} />
                        </motion.div>
                    )}

                    <motion.div variants={slideUpVariants}>
                        <AnimatePresence mode="wait">
                        {(() => {
                            const role = user?.role || 'user';

                            if (hasPermission(user, 'Risk', 'manage')) {
                                return (
                                    <motion.div key="admin-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                                        <AdminDashboardView
                                            stats={stats}
                                            isEditing={isEditing}
                                            loading={loading}
                                            navigate={navigate}
                                            t={t}
                                            theme={theme}
                                            myActionItems={myActionItems}
                                            historyData={historyData}
                                            healthIssues={healthIssues}
                                            topRisks={topRisks}
                                            recentActivity={recentActivity}
                                            radarData={radarData}
                                            incidents={activeIncidents}
                                            complianceScore={complianceScore}
                                            suppliers={allSuppliers}
                                            isAddWidgetModalOpen={isAddWidgetModalOpen}
                                            setIsAddWidgetModalOpen={setIsAddWidgetModalOpen}
                                        />
                                    </motion.div>
                                );
                            }

                            if (role === 'direction') {
                                return (
                                    <motion.div key="direction-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                                        <DirectionDashboardView
                                            stats={stats}
                                            loading={loading}
                                            navigate={navigate}
                                            t={t}
                                            theme={theme}
                                            historyData={historyData}
                                            healthIssues={healthIssues}
                                            topRisks={topRisks}
                                            incidents={activeIncidents}
                                        />
                                    </motion.div>
                                );
                            }

                            if (role === 'auditor') {
                                return (
                                    <motion.div key="auditor-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                                        <AuditorDashboardView
                                            loading={loading}
                                            navigate={navigate}
                                            t={t}
                                            theme={theme}
                                            myActionItems={myActionItems}
                                            historyData={historyData}
                                            recentActivity={recentActivity}
                                            healthIssues={healthIssues}
                                        />
                                    </motion.div>
                                );
                            }

                            if (role === 'project_manager') {
                                return (
                                    <motion.div key="pm-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                                        <ProjectManagerDashboardView
                                            loading={loading}
                                            navigate={navigate}
                                            t={t}
                                            myActionItems={myActionItems}
                                            projectRisks={projectRisks}
                                        />
                                    </motion.div>
                                );
                            }

                            return (
                                <motion.div key="operational-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                                    <OperationalDashboardView
                                        loading={loading}
                                        navigate={navigate}
                                        t={t}
                                        myActionItems={myActionItems}
                                        myRisksList={myRisksList}
                                    />
                                </motion.div>
                            );
                        })()}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            </div>
            <QuickActions
                navigate={navigate}
                t={t}
                stats={stats}
            />
        </>
    );
};

// Backwards compatibility alias
export const Dashboard = DashboardWithQuickActions;
