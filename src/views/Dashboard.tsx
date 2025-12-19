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
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';

// Widgets
import { DashboardHeader } from '../components/dashboard/widgets/DashboardHeader';
import { QuickActions } from '../components/dashboard/widgets/QuickActions';
import { GettingStartedWidget } from '../components/dashboard/widgets/GettingStartedWidget';
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton';
import { motion } from 'framer-motion';

// Role-based Views
import { AdminDashboardView } from '../components/dashboard/views/AdminDashboardView';
import { DirectionDashboardView } from '../components/dashboard/views/DirectionDashboardView';
import { AuditorDashboardView } from '../components/dashboard/views/AuditorDashboardView';
import { ProjectManagerDashboardView } from '../components/dashboard/views/ProjectManagerDashboardView';
import { OperationalDashboardView } from '../components/dashboard/views/OperationalDashboardView';




export const Dashboard: React.FC = () => {
    const [organizationName, setOrganizationName] = useState<string>('');
    const [organizationLogo, setOrganizationLogo] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);

    const [showGettingStarted, setShowGettingStarted] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const { user, theme, addToast, t } = useStore();
    const navigate = useNavigate();

    // Role Definitions
    // const role = user?.role || 'user';
    // const isAdmin = ['admin', 'rssi'].includes(role);
    // const isDirection = role === 'direction';
    // const isAuditor = role === 'auditor';
    // const isPM = role === 'project_manager';

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
        myIncidents,
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



    if (error === 'permission-denied') { return (<div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in p-6"> <div className="glass-panel rounded-[2rem] p-8 max-w-2xl w-full relative overflow-hidden border-l-4 border-l-red-500 shadow-xl"> <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.accessDenied')}</h2> <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">{t('dashboard.dbLocked')}</p> <button onClick={copyRules} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm">{t('dashboard.copyRules')}</button> </div> </div>); }

    if (loading) {
        return <DashboardSkeleton />;
    }

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
            data-tour="dashboard"
        >
            <MasterpieceBackground />
            <SEO
                title="Tableau de bord de Gouvernance"
                description="Vue d'overview de votre posture de sécurité et conformité."
                keywords="Pilotage SSI, Tableau de bord CISO, KPI Cyber, Conformité, Risques, Gouvernance"
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
            />

            {showGettingStarted && (
                <motion.div variants={slideUpVariants}>
                    <GettingStartedWidget onClose={() => setShowGettingStarted(false)} />
                </motion.div>
            )}

            <motion.div variants={slideUpVariants}>
                <QuickActions navigate={navigate} t={t} stats={stats} />
            </motion.div>

            {/* Role-based Widget Visibility */}
            <motion.div variants={slideUpVariants}>
                {(() => {
                    const role = user?.role || 'user';

                    if (['admin', 'rssi'].includes(role)) {
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
    );
};
