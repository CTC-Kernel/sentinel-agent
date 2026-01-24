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

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <ProfileSettings />;
            case 'activity': return <UserActivityLog />;
            case 'security': return <SecuritySettings />;
            case 'organization':
                return hasPermission(user, 'Settings', 'manage')
                    ? <OrganizationSettings />
                    : <ProfileSettings />;
            case 'system':
                return hasPermission(user, 'Settings', 'read')
                    ? <SystemSettings />
                    : <ProfileSettings />;
            case 'frameworks':
                return hasPermission(user, 'Settings', 'manage')
                    ? <FrameworkSettings />
                    : <ProfileSettings />;
            case 'partners':
                return hasPermission(user, 'Partner', 'manage')
                    ? <PartnerManagement />
                    : <ProfileSettings />;
            case 'integrations': return <IntegrationSettings />;
            case 'agents': return <AgentManagement />;
            default: return <ProfileSettings />;
        }
    };

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="flex flex-col gap-10 pb-24"
        >
            <MasterpieceBackground />
            <SEO title={t('settings.title')} />

            <PageHeader
                title={t('settings.title')}
                subtitle="Gérez vos préférences et configuration"
                icon={
                    <img
                        src="/images/support.png"
                        alt="SUPPORT"
                        className="w-full h-full object-contain"
                    />
                }
            />

            <SettingsLayout currentTab={activeTab} onTabChange={setActiveTab}>
                <SettingsErrorBoundary onReset={() => setActiveTab('profile')}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
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
