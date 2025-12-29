import React from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { usePersistedState } from '../hooks/usePersistedState';
import { hasPermission } from '../utils/permissions';
import { SettingsLayout } from '../components/settings/SettingsLayout';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { UserActivityLog } from '../components/settings/UserActivityLog';
import { SecuritySettings } from '../components/settings/SecuritySettings';
import { OrganizationSettings } from '../components/settings/OrganizationSettings';
import { IntegrationSettings } from '../components/settings/IntegrationSettings';
import { SystemSettings } from '../components/settings/SystemSettings';

import { SEO } from '../components/SEO';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { staggerContainerVariants } from '../components/ui/animationVariants';

const Settings: React.FC = () => {
    const { t, user } = useStore();
    const [activeTab, setActiveTab] = usePersistedState('settings_active_tab', 'profile');

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <ProfileSettings />;
            case 'activity': return <UserActivityLog />;
            case 'security': return <SecuritySettings />;
            case 'organization':
                return hasPermission(user, 'Settings', 'manage')
                    ? <OrganizationSettings />
                    : <ProfileSettings />;
            case 'integrations': return <IntegrationSettings />;
            case 'system':
                return hasPermission(user, 'Settings', 'read')
                    ? <SystemSettings />
                    : <ProfileSettings />;
            default: return <ProfileSettings />;
        }
    };

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO title={t('settings.title')} />



            <SettingsLayout currentTab={activeTab} onTabChange={setActiveTab}>
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
            </SettingsLayout>
        </motion.div>
    );
};

export default Settings;
