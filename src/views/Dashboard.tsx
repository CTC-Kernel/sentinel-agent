import React, { useEffect, useState } from 'react';
import { SEO } from '../components/SEO';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { useDashboardData } from '../hooks/dashboard/useDashboardData';
import { useDashboardReports } from '../hooks/dashboard/useDashboardReports';
import { useDashboardStatsHistory } from '../hooks/dashboard/useDashboardStatsHistory';
import { useDashboardMetrics } from '../hooks/dashboard/useDashboardMetrics';
import { useDashboardInsights } from '../hooks/dashboard/useDashboardInsights';

import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { hasPermission } from '../utils/permissions';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
// useTour hook removed

// Widgets
import { DashboardHeader } from '../components/dashboard/widgets/DashboardHeader';
import { QuickActions } from '../components/dashboard/widgets/QuickActions';
import { GettingStartedWidget } from '../components/dashboard/widgets/GettingStartedWidget';
import { ApprovalsWidget } from '../components/dashboard/ApprovalsWidget';
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';

// Role-based Views
import { AdminDashboardView } from '../components/dashboard/views/AdminDashboardView';
import { DirectionDashboardView } from '../components/dashboard/views/DirectionDashboardView';
import { AuditorDashboardView } from '../components/dashboard/views/AuditorDashboardView';
import { ProjectManagerDashboardView } from '../components/dashboard/views/ProjectManagerDashboardView';
import { OperationalDashboardView } from '../components/dashboard/views/OperationalDashboardView';

import { useGettingStartedState } from '../hooks/dashboard/useGettingStartedState';

export const Dashboard: React.FC = () => {
    // useTour removed in favor of OnboardingTrigger
    const [organizationName, setOrganizationName] = useState<string>('');
    const [organizationLogo, setOrganizationLogo] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);

    const { user, theme, addToast, t, demoMode, toggleDemoMode } = useStore();
    // Use new hook for persistence
    const [gettingStartedState, setGettingStartedState] = useGettingStartedState(user?.uid);

    // Derived state for visibility
    const showGettingStarted = gettingStartedState !== 'closed';

    const [isEditing, setIsEditing] = useState(false);

    const navigate = useNavigate();

    // Use centralized data hook
    const {
        controls,

        recentActivity,
        historyStats,
        allRisks,
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
        error: dataError
    } = useDashboardData();

    // Update local state when hook data changes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (fetchedOrgName) {
                setOrganizationName(prev => prev !== fetchedOrgName ? fetchedOrgName : prev);
            }
            if (fetchedOrgLogo) {
                setOrganizationLogo(prev => prev !== fetchedOrgLogo ? fetchedOrgLogo : prev);
            }
            if (dataError === 'permission-denied') {
                setError('permission-denied');
            }
        }, 0);

        return () => clearTimeout(timer);
    }, [fetchedOrgName, fetchedOrgLogo, dataError]);

    const { historyData, topRisks, stats, radarData, complianceScore, scoreGrade } = useDashboardMetrics({
        controls,
        allRisks,
        allAssets,
        historyStats,
        activeIncidentsCount,
        openAuditsCount,
        myProjectsLength: myProjects.length,
        userOrgId: user?.organizationId
    });

    // Personalized Risks
    const myRisksList = React.useMemo(() => {
        if (!user) return [];
        return allRisks.filter(r => r.ownerId === user.uid).sort((a, b) => b.score - a.score).slice(0, 5);
    }, [allRisks, user]);

    const projectRisks = React.useMemo(() => {
        if (!user || user.role !== 'project_manager') return [];
        const projectIds = myProjects.map(p => p.id);
        return allRisks.filter(r =>
            (r.ownerId === user.uid) ||
            (r.relatedProjectIds?.some((pid: string) => projectIds.includes(pid)))
        ).sort((a, b) => b.score - a.score).slice(0, 5);
    }, [allRisks, user, myProjects]);

    const isEmpty = React.useMemo(() => !loading && allRisks.length === 0 && allAssets.length === 0 && myProjects.length === 0, [loading, allRisks, allAssets, myProjects]);

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

    // Stats History Generation
    useDashboardStatsHistory({
        loading,
        historyStats,
        allRisksCount: allRisks.length,
        complianceScore,
        activeIncidentsCount,
        radarData
    });

    const copyRules = () => { navigator.clipboard.writeText(`rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}`); addToast(t('dashboard.rulesCopied'), "success"); };

    const { isGeneratingReport, generateICal, generateExecutiveReport: generateReport } = useDashboardReports();

    // Helper to call report generation with current data
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

    if (error === 'permission-denied') { return (<div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in p-6"> <div className="glass-premium rounded-[2rem] p-8 max-w-2xl w-full relative overflow-hidden border-l-4 border-l-red-500 shadow-xl"> <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.accessDenied')}</h2> <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">{t('dashboard.dbLocked')}</p> <Button aria-label={t('dashboard.copyRules')} onClick={copyRules} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{t('dashboard.copyRules')}</Button> </div> </div>); }

    if (loading) {
        return <DashboardSkeleton />;
    }

    return (
        <div>
            <motion.div
                variants={staggerContainerVariants}
                initial="initial"
                animate="visible"
                className="space-y-6"
                data-tour="dashboard"
            >
                <MasterpieceBackground />
                <SEO
                    title={t('dashboard.seoTitle')}
                    description={t('dashboard.seoDescription')}
                    keywords={t('dashboard.seoKeywords')}
                />

                {/* Demo Mode Banner */}
                {demoMode && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel p-4 rounded-xl border border-blue-200/50 dark:border-blue-800/50 flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/20"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Mode Démo Actif</h4>
                                <p className="text-xs text-slate-600 dark:text-slate-300">Vous explorez des données fictives. Les modifications ne seront pas sauvegardées.</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleDemoMode}
                            className="text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        >
                            Quitter le mode démo
                        </Button>
                    </motion.div>
                )}

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
                    onToggleEdit={() => setIsEditing(!isEditing)}
                    onShowGettingStarted={() => setGettingStartedState('expanded')}
                    isGettingStartedClosed={!showGettingStarted}
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
                    {(() => {
                        const role = user?.role || 'user';

                        if (hasPermission(user, 'Risk', 'manage')) {
                            return (
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
                                />
                            );
                        }

                        if (role === 'direction') {
                            return (
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
                            );
                        }

                        if (role === 'auditor') {
                            return (
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
                            );
                        }

                        if (role === 'project_manager') {
                            return (
                                <ProjectManagerDashboardView
                                    loading={loading}
                                    navigate={navigate}
                                    t={t}
                                    myActionItems={myActionItems}
                                    projectRisks={projectRisks}
                                />
                            );
                        }

                        return (
                            <OperationalDashboardView
                                loading={loading}
                                navigate={navigate}
                                t={t}
                                myActionItems={myActionItems}
                                myRisksList={myRisksList}
                            />
                        );
                    })()}
                </motion.div>
            </motion.div>

            {/* QuickActions Panel - Fixed Position Outside Main Container */}
            <QuickActions navigate={navigate} t={t} stats={stats} />
        </div>
    );
};

// Wrapper component to render QuickActions outside AnimatedPage
export const DashboardWithQuickActions: React.FC = () => {
    const {
        controls,
        recentActivity,
        historyStats,
        allRisks,
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
        error: dataError
    } = useDashboardData();

    const [organizationName, setOrganizationName] = useState<string>('');
    const [organizationLogo, setOrganizationLogo] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const { user, theme, addToast, t } = useStore();
    // Use persistent state hook
    const [gettingStartedState, setGettingStartedState] = useGettingStartedState(user?.uid);
    const showGettingStarted = gettingStartedState !== 'closed';

    const [isEditing, setIsEditing] = useState(false);

    const navigate = useNavigate();

    // Update local state when hook data changes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (fetchedOrgName) {
                setOrganizationName(prev => prev !== fetchedOrgName ? fetchedOrgName : prev);
            }
            if (fetchedOrgLogo) {
                setOrganizationLogo(prev => prev !== fetchedOrgLogo ? fetchedOrgLogo : prev);
            }
            if (dataError === 'permission-denied') {
                setError('permission-denied');
            }
        }, 0);

        return () => clearTimeout(timer);
    }, [fetchedOrgName, fetchedOrgLogo, dataError]);

    const { historyData, topRisks, stats, radarData, complianceScore, scoreGrade } = useDashboardMetrics({
        controls,
        allRisks,
        allAssets,
        historyStats,
        activeIncidentsCount,
        openAuditsCount,
        myProjectsLength: myProjects.length,
        userOrgId: user?.organizationId
    });

    const myRisksList = React.useMemo(() => {
        if (!user) return [];
        return allRisks.filter(r => r.ownerId === user.uid).sort((a, b) => b.score - a.score).slice(0, 5);
    }, [allRisks, user]);

    const projectRisks = React.useMemo(() => {
        if (!user || user.role !== 'project_manager') return [];
        const projectIds = myProjects.map(p => p.id);
        return allRisks.filter(r =>
            (r.ownerId === user.uid) ||
            (r.relatedProjectIds?.some((pid: string) => projectIds.includes(pid)))
        ).sort((a, b) => b.score - a.score).slice(0, 5);
    }, [allRisks, user, myProjects]);

    const isEmpty = React.useMemo(() => !loading && allRisks.length === 0 && allAssets.length === 0 && myProjects.length === 0, [loading, allRisks, allAssets, myProjects]);

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

    const copyRules = () => { navigator.clipboard.writeText(`rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}`); addToast(t('dashboard.rulesCopied'), "success"); };

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

    if (error === 'permission-denied') { return (<div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in p-6"> <div className="glass-premium rounded-[2rem] p-8 max-w-2xl w-full relative overflow-hidden border-l-4 border-l-red-500 shadow-xl"> <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.accessDenied')}</h2> <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">{t('dashboard.dbLocked')}</p> <Button aria-label={t('dashboard.copyRules')} onClick={copyRules} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{t('dashboard.copyRules')}</Button> </div> </div>); }

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
                    className="space-y-6"
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
                        onToggleEdit={() => setIsEditing(!isEditing)}
                        onShowGettingStarted={() => setGettingStartedState('expanded')}
                        isGettingStartedClosed={!showGettingStarted}
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
                        {(() => {
                            const role = user?.role || 'user';

                            if (hasPermission(user, 'Risk', 'manage')) {
                                return (
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
                                    />
                                );
                            }

                            if (role === 'direction') {
                                return (
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
                                );
                            }

                            if (role === 'auditor') {
                                return (
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
                                );
                            }

                            if (role === 'project_manager') {
                                return (
                                    <ProjectManagerDashboardView
                                        loading={loading}
                                        navigate={navigate}
                                        t={t}
                                        myActionItems={myActionItems}
                                        projectRisks={projectRisks}
                                    />
                                );
                            }

                            return (
                                <OperationalDashboardView
                                    loading={loading}
                                    navigate={navigate}
                                    t={t}
                                    myActionItems={myActionItems}
                                    myRisksList={myRisksList}
                                />
                            );
                        })()}
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
