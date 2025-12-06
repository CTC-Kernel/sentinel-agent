import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AnimatedPage } from './AnimatedPage';

// Lazy Imports (Copied from App.tsx)
const Dashboard = React.lazy(() => import('../../views/Dashboard').then(module => ({ default: module.Dashboard })));
const Assets = React.lazy(() => import('../../views/Assets').then(module => ({ default: module.Assets })));
const Risks = React.lazy(() => import('../../views/Risks').then(module => ({ default: module.Risks })));
const Compliance = React.lazy(() => import('../../views/Compliance').then(module => ({ default: module.Compliance })));
const Audits = React.lazy(() => import('../../views/Audits').then(module => ({ default: module.Audits })));
const Team = React.lazy(() => import('../../views/Team').then(module => ({ default: module.Team })));
const Settings = React.lazy(() => import('../../views/Settings').then(module => ({ default: module.Settings })));
const Documents = React.lazy(() => import('../../views/Documents').then(module => ({ default: module.Documents })));
const Projects = React.lazy(() => import('../../views/Projects').then(module => ({ default: module.Projects })));
const Incidents = React.lazy(() => import('../../views/Incidents').then(module => ({ default: module.Incidents })));
const Suppliers = React.lazy(() => import('../../views/Suppliers').then(module => ({ default: module.Suppliers })));
const Privacy = React.lazy(() => import('../../views/Privacy').then(module => ({ default: module.Privacy })));
const Help = React.lazy(() => import('../../views/Help').then(module => ({ default: module.Help })));
const Continuity = React.lazy(() => import('../../views/Continuity').then(module => ({ default: module.Continuity })));
const VoxelView = React.lazy(() => import('../../views/VoxelView').then(module => ({ default: module.VoxelView })));
const Notifications = React.lazy(() => import('../../views/Notifications').then(module => ({ default: module.Notifications })));
const Search = React.lazy(() => import('../../views/Search').then(module => ({ default: module.Search })));
const KioskPage = React.lazy(() => import('../../components/AssetIntake/KioskPage').then(module => ({ default: module.KioskPage })));
const BackupRestore = React.lazy(() => import('../../views/BackupRestore').then(module => ({ default: module.BackupRestore })));
const AnalyticsDashboard = React.lazy(() => import('../../components/dashboard/AnalyticsDashboard').then(module => ({ default: module.AnalyticsDashboard })));
const InteractiveTimeline = React.lazy(() => import('../../components/timeline/InteractiveTimeline').then(module => ({ default: module.InteractiveTimeline })));
const AuditTrailViewer = React.lazy(() => import('../../components/audit/AuditTrailViewer').then(module => ({ default: module.AuditTrailViewer })));
const CalendarView = React.lazy(() => import('../../views/CalendarView').then(module => ({ default: module.CalendarView })));
const Pricing = React.lazy(() => import('../../views/Pricing'));
const AdminDashboard = React.lazy(() => import('../../views/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const Integrations = React.lazy(() => import('../../views/Integrations').then(module => ({ default: module.Integrations })));

import { AlertTriangle } from '../ui/Icons';

const NotFound = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="glass-panel p-12 rounded-[2.5rem] max-w-md shadow-2xl border border-white/40 dark:border-white/5">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mx-auto mb-6 text-slate-400">
                <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3 font-display tracking-tight">404</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-lg font-medium">La page que vous cherchez n'existe pas.</p>
            <a href="#/" className="px-8 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-sm hover:scale-105 transition-transform inline-block shadow-lg">Retour à l'accueil</a>
        </div>
    </div>
);

export const AnimatedRoutes: React.FC = () => {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<AnimatedPage><Dashboard /></AnimatedPage>} />
                <Route path="/analytics" element={<AnimatedPage><AnalyticsDashboard /></AnimatedPage>} />
                <Route path="/timeline" element={<AnimatedPage><InteractiveTimeline /></AnimatedPage>} />
                <Route path="/audit-trail" element={<AnimatedPage><AuditTrailViewer /></AnimatedPage>} />
                <Route path="/incidents" element={<AnimatedPage><Incidents /></AnimatedPage>} />
                <Route path="/projects" element={<AnimatedPage><Projects /></AnimatedPage>} />
                <Route path="/assets" element={<AnimatedPage><Assets /></AnimatedPage>} />
                <Route path="/risks" element={<AnimatedPage><Risks /></AnimatedPage>} />
                <Route path="/compliance" element={<AnimatedPage><Compliance /></AnimatedPage>} />
                <Route path="/documents" element={<AnimatedPage><Documents /></AnimatedPage>} />
                <Route path="/audits" element={<AnimatedPage><Audits /></AnimatedPage>} />
                <Route path="/team" element={<AnimatedPage><Team /></AnimatedPage>} />
                <Route path="/settings" element={<AnimatedPage><Settings /></AnimatedPage>} />
                <Route path="/suppliers" element={<AnimatedPage><Suppliers /></AnimatedPage>} />
                <Route path="/backup" element={<AnimatedPage><BackupRestore /></AnimatedPage>} />
                <Route path="/privacy" element={<AnimatedPage><Privacy /></AnimatedPage>} />
                <Route path="/continuity" element={<AnimatedPage><Continuity /></AnimatedPage>} />
                {/* Voxel View might have its own canvas/context needs, but wrapping in AnimatedPage usually fine */}
                <Route path="/ctc-engine" element={<AnimatedPage><VoxelView /></AnimatedPage>} />
                <Route path="/notifications" element={<AnimatedPage><Notifications /></AnimatedPage>} />
                <Route path="/search" element={<AnimatedPage><Search /></AnimatedPage>} />
                <Route path="/help" element={<AnimatedPage><Help /></AnimatedPage>} />
                <Route path="/intake" element={<AnimatedPage><KioskPage /></AnimatedPage>} />
                <Route path="/calendar" element={<AnimatedPage><CalendarView /></AnimatedPage>} />
                <Route path="/pricing" element={<AnimatedPage><Pricing /></AnimatedPage>} />
                <Route path="/admin_management" element={<AnimatedPage><AdminDashboard /></AnimatedPage>} />
                <Route path="/integrations" element={<AnimatedPage><Integrations /></AnimatedPage>} />
                <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
            </Routes>
        </AnimatePresence>
    );
};
