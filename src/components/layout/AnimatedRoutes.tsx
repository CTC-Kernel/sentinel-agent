import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AnimatedPage } from './AnimatedPage';
import { RoleGuard } from '../auth/RoleGuard';
import { TestRoleGuard } from '../auth/TestGuards';
import { Role } from '../../utils/permissions';
import { RouteErrorBoundary } from '../ui/RouteErrorBoundary';

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

// Voxel 3D Module (Story VOX-1.1)
const VoxelPage = React.lazy(() => import('../../pages/VoxelPage').then(module => ({ default: module.VoxelPage })));
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
const Integrations = React.lazy(() => import('../../views/Integrations').then(module => ({ default: module.Integrations })));
const ThreatRegistry = React.lazy(() => import('../../views/ThreatRegistry').then(module => ({ default: module.ThreatRegistry })));
const Vulnerabilities = React.lazy(() => import('../../views/Vulnerabilities').then(module => ({ default: module.Vulnerabilities })));
const ThreatIntelligence = React.lazy(() => import('../../views/ThreatIntelligence').then(module => ({ default: module.ThreatIntelligence })));
const Reports = React.lazy(() => import('../../views/Reports').then(module => ({ default: module.Reports })));

// Agent Fleet Management (Sprint 1)
const Agents = React.lazy(() => import('../../views/Agents'));

// Agent Groups & Policies (Sprint 9)
// Software Inventory & CIS Benchmarks (Sprint 6)

// EBIOS RM Module (detail page only - list view is now in Risks)
const EbiosAnalysisDetail = React.lazy(() => import('../../views/EbiosAnalysisDetail').then(module => ({ default: module.EbiosAnalysisDetail })));

// SMSI Program Module (ISO 27003)
const SMSIProgram = React.lazy(() => import('../../views/SMSIProgram').then(module => ({ default: module.SMSIProgramView })));

// Training Module (NIS2 Art. 21.2g)
const Training = React.lazy(() => import('../../views/Training'));

// Access Review Module (NIS2 Art. 21.2i)
const AccessReview = React.lazy(() => import('../../views/AccessReview'));

// CMDB Module (Configuration Management Database)
const CMDB = React.lazy(() => import('../../views/CMDB'));

// DORA ICT Register Module (DORA Art. 28)


// Financial Risk Quantification Module (Epic 39)

// ANSSI Homologation Module (Epic 38)
const HomologationDossierDetail = React.lazy(() => import('../homologation').then(module => ({ default: module.HomologationDossierDetail })));

// Board Governance Module (Audit Sprint)
const Governance = React.lazy(() => import('../../views/Governance').then(module => ({ default: module.Governance })));

// Regulatory Change Management Module (Audit Sprint)
const RegulatoryChanges = React.lazy(() => import('../../views/RegulatoryChanges').then(module => ({ default: module.RegulatoryChanges })));

// Compliance Calendar Module (Audit Sprint)
const ComplianceCalendarView = React.lazy(() => import('../../views/ComplianceCalendar'));

// Certification Tracking Module (Audit Sprint)
const Certifications = React.lazy(() => import('../../views/Certifications').then(module => ({ default: module.Certifications })));

// New Professional 404 Page
import { NotFound } from '../../views/NotFound';

export const AnimatedRoutes: React.FC = () => {
 const location = useLocation();
 const isTestMode = !import.meta.env.PROD && (
 import.meta.env.MODE === 'test' ||
 import.meta.env.VITE_USE_EMULATORS === 'true'
 );
 const RoleGuardComponent = isTestMode ? TestRoleGuard : RoleGuard;

 const allRoles: Role[] = ['super_admin', 'admin', 'rssi', 'auditor', 'project_manager', 'direction', 'user', 'certifier'];

 return (
 <AnimatePresence mode="popLayout">
 <Routes location={location} key={location.pathname || 'unknown'}>
 <Route path="/" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><DashboardWithQuickActions /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/analytics" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><AnalyticsDashboard /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/timeline" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><InteractiveTimeline /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/audit-trail" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><ActivityLogs /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/incidents" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Incidents /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/projects" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Projects /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/assets" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Assets /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/risks" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Risks /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/vulnerabilities" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Vulnerabilities /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/agents" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Agents /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/agent-policies" element={<Navigate to="/agents" replace />} />

 <Route path="/threat-library" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><ThreatRegistry /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/threat-intelligence" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><ThreatIntelligence /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/reports" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Reports /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/compliance" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Compliance /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/ebios" element={<Navigate to="/risks?tab=ebios" replace />} />
 <Route path="/ebios/:id" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><EbiosAnalysisDetail /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/smsi" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><SMSIProgram /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/risk-context" element={<Navigate to="/risks?tab=context" replace />} />
 <Route path="/control-effectiveness" element={<Navigate to="/compliance?tab=efficiency" replace />} />
 <Route path="/documents" element={
  <RoleGuardComponent allowedRoles={['admin', 'rssi', 'auditor', 'project_manager', 'direction', 'user']}>
  <AnimatedPage><RouteErrorBoundary><Documents /></RouteErrorBoundary></AnimatedPage>
  </RoleGuardComponent>
 } />
 <Route path="/audits" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Audits /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/training" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Training /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/access-review" element={<RoleGuardComponent allowedRoles={['admin', 'rssi']}><AnimatedPage><RouteErrorBoundary><AccessReview /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/team" element={
  <RoleGuardComponent allowedRoles={['admin', 'rssi']}>
  <AnimatedPage><RouteErrorBoundary><Team /></RouteErrorBoundary></AnimatedPage>
  </RoleGuardComponent>
 } />
 <Route path="/settings" element={
  <RoleGuardComponent allowedRoles={['admin', 'rssi', 'user', 'project_manager', 'direction', 'auditor']}>
  <AnimatedPage><RouteErrorBoundary><Settings /></RouteErrorBoundary></AnimatedPage>
  </RoleGuardComponent>
 } />
 <Route path="/suppliers" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Suppliers /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
        <Route path="/cmdb" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><CMDB /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/vendor-concentration" element={<Navigate to="/suppliers?tab=concentration" replace />} />
 <Route path="/dora/providers" element={<Navigate to="/suppliers?tab=dora" replace />} />
 <Route path="/financial-risk" element={<Navigate to="/risks?tab=financial" replace />} />
 <Route path="/homologation" element={<Navigate to="/compliance?tab=homologation" replace />} />
 <Route path="/homologation/:dossierId" element={<RoleGuardComponent allowedRoles={['admin', 'rssi']}><AnimatedPage><RouteErrorBoundary><HomologationDossierDetail /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/governance" element={<RoleGuardComponent allowedRoles={['admin', 'rssi', 'direction']}><AnimatedPage><RouteErrorBoundary><Governance /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/regulatory-changes" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><RegulatoryChanges /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/compliance-calendar" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><ComplianceCalendarView /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/certifications" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Certifications /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/privacy" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Privacy /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/continuity" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Continuity /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/ctc-engine" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage className="!p-0 !pb-0 !min-h-0 !h-full !max-w-none"><RouteErrorBoundary><VoxelView /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/voxel" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><VoxelPage /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/notifications" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Notifications /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/search" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Search /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/help" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Help /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/intake" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><KioskPage /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/calendar" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><CalendarView /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/pricing" element={<RoleGuardComponent allowedRoles={allRoles}><AnimatedPage><RouteErrorBoundary><Pricing /></RouteErrorBoundary></AnimatedPage></RoleGuardComponent>} />
 <Route path="/system-health" element={
  <RoleGuardComponent allowedRoles={['admin']}>
  <AnimatedPage><RouteErrorBoundary><SystemHealth /></RouteErrorBoundary></AnimatedPage>
  </RoleGuardComponent>
 } />

 {/* Restricted Routes */}
 <Route path="/backup" element={
  <RoleGuardComponent allowedRoles={['admin', 'rssi']}>
  <AnimatedPage><RouteErrorBoundary><BackupRestore /></RouteErrorBoundary></AnimatedPage>
  </RoleGuardComponent>
 } />
 {/* /admin_management route is defined in App.tsx with StrictSuperAdminGuard */}
 <Route path="/integrations" element={
  <RoleGuardComponent allowedRoles={['admin', 'rssi']}>
  <AnimatedPage><RouteErrorBoundary><Integrations /></RouteErrorBoundary></AnimatedPage>
  </RoleGuardComponent>
 } />

 <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
 </Routes>
 </AnimatePresence>
 );
};
