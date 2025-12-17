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
import { Helmet } from 'react-helmet-async';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';

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
        <div className="w-full max-w-[1920px] mx-auto space-y-8 animate-fade-in pb-10 relative min-h-screen pt-4 sm:pt-8 px-4 md:px-8 overflow-x-hidden">
            <MasterpieceBackground />
            <Helmet>
                <title>{t('settings.title')} | Sentinel GRC</title>
            </Helmet>

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
        </div>
    );
};

export default Settings;
