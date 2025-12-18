import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { SettingsLayout } from '../components/settings/SettingsLayout';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { SecuritySettings } from '../components/settings/SecuritySettings';
import { OrganizationSettings } from '../components/settings/OrganizationSettings';
import { IntegrationSettings } from '../components/settings/IntegrationSettings';
import { SystemSettings } from '../components/settings/SystemSettings';
import { PageHeader } from '../components/ui/PageHeader';
import { SEO } from '../components/SEO';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { staggerContainerVariants } from '../components/ui/animationVariants';

const Settings: React.FC = () => {
    const { t } = useStore();
    const [activeTab, setActiveTab] = useState('profile');

    const renderContent = () => {
        switch (activeTab) {
            case 'profile': return <ProfileSettings />;
            case 'security': return <SecuritySettings />;
            case 'organization': return <OrganizationSettings />;
            case 'integrations': return <IntegrationSettings />;
            case 'system': return <SystemSettings />;
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

            <PageHeader
                title={t('settings.title')}
            />

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
