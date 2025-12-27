import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { OnboardingService } from '../../services/onboardingService';
import { useStore } from '../../store';
import { HelpCircle, Zap, X } from '../ui/Icons';

interface OnboardingBannerProps {
    onStart: () => void;
    onDismiss: () => void;
}

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({ onStart, onDismiss }) => {
    const { t } = useTranslation();
    return (
        <div className="fixed bottom-6 right-6 z-modal max-w-md animate-slide-up">
            <div className="bg-gradient-to-r from-brand-600 to-purple-600 rounded-2xl shadow-2xl p-6 text-white">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <HelpCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">{t('tour.banner.title')}</h3>
                            <p className="text-sm text-white/80">{t('tour.banner.desc')}</p>
                        </div>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onStart}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white text-brand-600 rounded-xl text-sm font-bold hover:scale-105 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-600"
                    >
                        <Zap className="h-4 w-4" />
                        {t('tour.banner.start')}
                    </button>
                    <button
                        onClick={onDismiss}
                        className="px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-bold hover:bg-white/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                        {t('tour.banner.dismiss')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const OnboardingTrigger: React.FC = () => {
    const { user } = useStore();
    const [showBanner, setShowBanner] = React.useState(false);

    useEffect(() => {
        // Show banner only if:
        // 1. User has completed the Setup Wizard (user.onboardingCompleted)
        // 2. User has NOT seen the Tour (localStorage)
        // 3. User has NOT dismissed the banner (localStorage)

        const isWizardCompleted = user?.onboardingCompleted;
        const hasSeenTour = OnboardingService.hasSeenTour();
        const isDismissed = localStorage.getItem('tour-dismissed');

        // Delay slighty to avoid clashing with initial load
        if (isWizardCompleted && !hasSeenTour && !isDismissed) {
            const timer = setTimeout(() => setShowBanner(true), 2000);
            return () => clearTimeout(timer);
        }
    }, [user?.onboardingCompleted]);

    const handleStart = () => {
        setShowBanner(false);
        OnboardingService.startMainTour(user?.role || 'user');
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem('tour-dismissed', 'true');
    };

    if (!showBanner) {
        return null;
    }

    return <OnboardingBanner onStart={handleStart} onDismiss={handleDismiss} />;
};
