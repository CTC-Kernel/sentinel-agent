import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AnimatedPage } from './AnimatedPage';
import { RoleGuard } from '../auth/RoleGuard';

// Lazy Imports (Copied from App.tsx)
const Dashboard = React.lazy(() => import('../../views/Dashboard').then(module => ({ default: module.Dashboard })));
const DashboardWithQuickActions = React.lazy(() => import('../../views/Dashboard').then(module => ({ default: module.DashboardWithQuickActions })));
const Assets = React.lazy(() => import('../../views/Assets'));
const Risks = React.lazy(() => import('../../views/Risks').then(module => ({ default: module.Risks })));
const Compliance = React.lazy(() => import('../../views/Compliance').then(module => ({ default: module.Compliance })));
const Audits = React.lazy(() => import('../../views/Audits').then(module => ({ default: module.Audits })));
const Team = React.lazy(() => import('../../views/Team'));
const Settings = React.lazy(() => import('../../views/Settings'));
const Documents = React.lazy(() => import('../../views/Documents').then(module => ({ default: module.Documents })));
const Projects = React.lazy(() => import('../../views/Projects').then(module => ({ default: module.Projects })));
const Incidents = React.lazy(() => import('../../views/Incidents').then(module => ({ default: module.Incidents })));
const Suppliers = React.lazy(() => import('../../views/Suppliers').then(module => ({ default: module.Suppliers })));
const Privacy = React.lazy(() => import('../../views/Privacy').then(module => ({ default: module.Privacy })));
const Help = React.lazy(() => import('../../views/Help').then(module => ({ default: module.Help })));
const Continuity = React.lazy(() => import('../../views/Continuity'));
const VoxelView = React.lazy(() => import('../../views/VoxelView').then(module => ({ default: module.VoxelView })));
const Notifications = React.lazy(() => import('../../views/Notifications').then(module => ({ default: module.Notifications })));
const Search = React.lazy(() => import('../../views/Search').then(module => ({ default: module.Search })));
const KioskPage = React.lazy(() => import('../../components/AssetIntake/KioskPage').then(module => ({ default: module.KioskPage })));
const BackupRestore = React.lazy(() => import('../../views/BackupRestore').then(module => ({ default: module.BackupRestore })));
const AnalyticsDashboard = React.lazy(() => import('../../components/dashboard/AnalyticsDashboard').then(module => ({ default: module.AnalyticsDashboard })));
const InteractiveTimeline = React.lazy(() => import('../../components/timeline/InteractiveTimeline').then(module => ({ default: module.InteractiveTimeline })));
const ActivityLogs = React.lazy(() => import('../../views/ActivityLogs').then(module => ({ default: module.ActivityLogs })));

const CalendarView = React.lazy(() => import('../../views/CalendarView').then(module => ({ default: module.CalendarView })));
const Pricing = React.lazy(() => import('../../views/Pricing'));
const SystemHealth = React.lazy(() => import('../../views/SystemHealth').then(module => ({ default: module.SystemHealth })));
const AdminDashboard = React.lazy(() => import('../../views/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const Integrations = React.lazy(() => import('../../views/Integrations').then(module => ({ default: module.Integrations })));
const ThreatRegistry = React.lazy(() => import('../../views/ThreatRegistry').then(module => ({ default: module.ThreatRegistry })));
const Vulnerabilities = React.lazy(() => import('../../views/Vulnerabilities').then(module => ({ default: module.Vulnerabilities })));
const ThreatIntelligence = React.lazy(() => import('../../views/ThreatIntelligence').then(module => ({ default: module.ThreatIntelligence })));
const Reports = React.lazy(() => import('../../views/Reports').then(module => ({ default: module.Reports })));

// New Professional 404 Page
import { NotFound } from '../../views/NotFound';

export const AnimatedRoutes: React.FC = () => {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<AnimatedPage><DashboardWithQuickActions /></AnimatedPage>} />
                <Route path="/analytics" element={<AnimatedPage><AnalyticsDashboard /></AnimatedPage>} />
                <Route path="/timeline" element={<AnimatedPage><InteractiveTimeline /></AnimatedPage>} />
                <Route path="/audit-trail" element={<AnimatedPage><ActivityLogs /></AnimatedPage>} />
                <Route path="/incidents" element={<AnimatedPage><Incidents /></AnimatedPage>} />
                <Route path="/projects" element={<AnimatedPage><Projects /></AnimatedPage>} />
                <Route path="/assets" element={<AnimatedPage><Assets /></AnimatedPage>} />
                <Route path="/risks" element={<AnimatedPage><Risks /></AnimatedPage>} />
                <Route path="/vulnerabilities" element={<AnimatedPage><Vulnerabilities /></AnimatedPage>} />
                <Route path="/threat-library" element={<AnimatedPage><ThreatRegistry /></AnimatedPage>} />
                <Route path="/threat-intelligence" element={<AnimatedPage><ThreatIntelligence /></AnimatedPage>} />
                <Route path="/reports" element={<AnimatedPage><Reports /></AnimatedPage>} />
                <Route path="/compliance" element={<AnimatedPage><Compliance /></AnimatedPage>} />
                <Route path="/documents" element={<AnimatedPage><Documents /></AnimatedPage>} />
                <Route path="/audits" element={<AnimatedPage><Audits /></AnimatedPage>} />
                <Route path="/team" element={
                    <RoleGuard allowedRoles={['admin', 'rssi']}>
                        <AnimatedPage><Team /></AnimatedPage>
                    </RoleGuard>
                } />
                <Route path="/settings" element={
                    <RoleGuard allowedRoles={['admin', 'rssi']}>
                        <AnimatedPage><Settings /></AnimatedPage>
                    </RoleGuard>
                } />
                <Route path="/suppliers" element={<AnimatedPage><Suppliers /></AnimatedPage>} />
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
                <Route path="/system-health" element={
                    <RoleGuard allowedRoles={['admin']}>
                        <AnimatedPage><SystemHealth /></AnimatedPage>
                    </RoleGuard>
                } />

                {/* Restricted Routes */}
                <Route path="/backup" element={
                    <RoleGuard allowedRoles={['admin', 'rssi']}>
                        <AnimatedPage><BackupRestore /></AnimatedPage>
                    </RoleGuard>
                } />
                <Route path="/admin_management" element={
                    // AdminDashboard handles its own super-admin check, but we add basic role check too
                    <RoleGuard allowedRoles={['admin']}>
                        <AnimatedPage><AdminDashboard /></AnimatedPage>
                    </RoleGuard>
                } />
                <Route path="/integrations" element={
                    <RoleGuard allowedRoles={['admin', 'rssi']}>
                        <AnimatedPage><Integrations /></AnimatedPage>
                    </RoleGuard>
                } />

                <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
            </Routes>
        </AnimatePresence>
    );
};
