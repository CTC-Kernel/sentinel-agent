import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AnimatedPage } from './AnimatedPage';
import { RoleGuard } from '../auth/RoleGuard';
import { TestRoleGuard } from '../auth/TestGuards';
import { Role } from '../../utils/permissions';

// Lazy Imports (Copied from App.tsx)
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
    const isTestMode = import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_EMULATORS === 'true';
    const RoleGuardComponent = isTestMode ? TestRoleGuard : RoleGuard;

    const allRoles: Role[] = ['admin', 'rssi', 'auditor', 'project_manager', 'direction', 'user'];

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><DashboardWithQuickActions /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/analytics" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><AnalyticsDashboard /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/timeline" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><InteractiveTimeline /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/audit-trail" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><ActivityLogs /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/incidents" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Incidents /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/projects" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Projects /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/assets" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Assets /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/risks" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Risks /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/vulnerabilities" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Vulnerabilities /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/threat-library" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><ThreatRegistry /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/threat-intelligence" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><ThreatIntelligence /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/reports" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Reports /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/compliance" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Compliance /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/documents" element={
                    <RoleGuardComponent allowedRoles={['admin', 'rssi', 'auditor', 'project_manager', 'direction', 'user']}>
                        <AnimatedPage><Documents /></AnimatedPage>
                    </RoleGuardComponent>
                } />
                <Route path="/audits" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Audits /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/team" element={
                    <RoleGuardComponent allowedRoles={['admin', 'rssi']}>
                        <AnimatedPage><Team /></AnimatedPage>
                    </RoleGuardComponent>
                } />
                <Route path="/settings" element={
                    <RoleGuardComponent allowedRoles={['admin', 'rssi']}>
                        <AnimatedPage><Settings /></AnimatedPage>
                    </RoleGuardComponent>
                } />
                <Route path="/suppliers" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Suppliers /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/privacy" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Privacy /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/continuity" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Continuity /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/ctc-engine" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><VoxelView /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/notifications" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Notifications /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/search" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Search /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/help" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Help /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/intake" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><KioskPage /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/calendar" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><CalendarView /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/pricing" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><Pricing /></AnimatedPage></RoleGuardComponent>} />
                <Route path="/system-health" element={
                    <RoleGuardComponent allowedRoles={['admin']}>
                        <AnimatedPage><SystemHealth /></AnimatedPage>
                    </RoleGuardComponent>
                } />

                {/* Restricted Routes */}
                <Route path="/backup" element={
                    <RoleGuardComponent allowedRoles={['admin', 'rssi']}>
                        <AnimatedPage><BackupRestore /></AnimatedPage>
                    </RoleGuardComponent>
                } />
                <Route path="/admin_management" element={
                    // AdminDashboard handles its own super-admin check, but we add basic role check too
                    <RoleGuardComponent allowedRoles={['admin']}>
                        <AnimatedPage><AdminDashboard /></AnimatedPage>
                    </RoleGuardComponent>
                } />
                <Route path="/integrations" element={
                    <RoleGuardComponent allowedRoles={['admin', 'rssi']}>
                        <AnimatedPage><Integrations /></AnimatedPage>
                    </RoleGuardComponent>
                } />

                <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
            </Routes>
        </AnimatePresence>
    );
};
