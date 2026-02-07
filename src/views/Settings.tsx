import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { usePersistedState } from '../hooks/usePersistedState';
import { hasPermission } from '../utils/permissions';
import { PageHeader } from '../components/ui/PageHeader';
import { SettingsLayout } from '../components/settings/SettingsLayout';
import { SettingsErrorBoundary } from '../components/settings/SettingsErrorBoundary';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { UserActivityLog } from '../components/settings/UserActivityLog';
import { SecuritySettings } from '../components/settings/SecuritySettings';
import { OrganizationSettings } from '../components/settings/OrganizationSettings';
import { SystemSettings } from '../components/settings/SystemSettings';
import { FrameworkSettings } from '../components/settings/FrameworkSettings';
import { PartnerManagement } from '../components/settings/PartnerManagement';
import { IntegrationSettings } from '../components/settings/IntegrationSettings';
import { AgentManagement } from '../components/settings/AgentManagement';

import { SEO } from '../components/SEO';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { staggerContainerVariants } from '../components/ui/animationVariants';

// Valid tab identifiers
const VALID_TABS = ['profile', 'activity', 'security', 'organization', 'system', 'frameworks', 'partners', 'integrations', 'agents'];

const Settings: React.FC = () => {
 const { t, user } = useStore();
 const [searchParams, setSearchParams] = useSearchParams();
 const [activeTab, setActiveTab] = usePersistedState('settings_active_tab', 'profile');

 // Handle URL tab parameter (e.g., ?tab=agents from agent dashboard link)
 useEffect(() => {
 const tabParam = searchParams.get('tab');
 if (tabParam && VALID_TABS.includes(tabParam) && tabParam !== activeTab) {
 setActiveTab(tabParam);
 // Clear the URL parameter after applying
 searchParams.delete('tab');
 setSearchParams(searchParams, { replace: true });
 }
 }, [searchParams, activeTab, setActiveTab, setSearchParams]);

 const AccessDenied = () => (
 <div className="flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
 <div className="w-16 h-16 bg-warning-bg rounded-full flex items-center justify-center mb-4">
 <svg className="w-8 h-8 text-warning-text" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v.01M12 9v3m-7 6h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
 </div>
 <h3 className="text-lg font-bold text-foreground mb-2">
 {t('settings.accessDenied', { defaultValue: "Accès refusé" })}
 </h3>
 <p className="text-sm text-muted-foreground max-w-md">
 {t('settings.accessDeniedDesc', { defaultValue: "Vous n'avez pas les permissions nécessaires pour accéder à cette section. Contactez votre administrateur pour obtenir l'accès." })}
 </p>
 </div>
 );

 const renderContent = () => {
 switch (activeTab) {
 case 'profile': return <ProfileSettings />;
 case 'activity': return <UserActivityLog />;
 case 'security': return <SecuritySettings />;
 case 'organization':
 return hasPermission(user, 'Settings', 'manage')
  ? <OrganizationSettings />
  : <AccessDenied />;
 case 'system':
 return hasPermission(user, 'Settings', 'read')
  ? <SystemSettings />
  : <AccessDenied />;
 case 'frameworks':
 return hasPermission(user, 'Settings', 'manage')
  ? <FrameworkSettings />
  : <AccessDenied />;
 case 'partners':
 return hasPermission(user, 'Partner', 'manage')
  ? <PartnerManagement />
  : <AccessDenied />;
 case 'integrations':
 return hasPermission(user, 'Settings', 'manage')
  ? <IntegrationSettings />
  : <AccessDenied />;
 case 'agents':
 return hasPermission(user, 'Settings', 'manage')
  ? <AgentManagement />
  : <AccessDenied />;
 default: return <ProfileSettings />;
 }
 };

 return (
 <motion.div
 variants={staggerContainerVariants}
 initial="initial"
 animate="visible"
 className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
 >
 <MasterpieceBackground />
 <SEO title={t('settings.title')} />

 <PageHeader
 title={t('settings.title')}
 subtitle={t('settings.subtitle')}
 icon={
  <img alt="ADMINISTRATION"
  src="/images/administration.png"
  className="w-full h-full object-contain"
  />
 }
 />

 <SettingsLayout currentTab={activeTab} onTabChange={setActiveTab}>
 <SettingsErrorBoundary onReset={() => setActiveTab('profile')}>
  <AnimatePresence mode="wait">
  <motion.div
  key={activeTab || 'unknown'}
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -10 }}
  transition={{ duration: 0.2 }}
  >
  {renderContent()}
  </motion.div>
  </AnimatePresence>
 </SettingsErrorBoundary>
 </SettingsLayout>
 </motion.div>
 );
};

export default Settings;
