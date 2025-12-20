import React, { useEffect } from 'react';
import { OnboardingService } from '../../services/onboardingService';
import { useStore } from '../../store';
import { HelpCircle, Zap, X } from '../ui/Icons';

interface OnboardingBannerProps {
    onStart: () => void;
    onDismiss: () => void;
}

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({ onStart, onDismiss }) => {
    return (
        <div className="fixed bottom-6 right-6 z-modal max-w-md animate-slide-up">
            <div className="bg-gradient-to-r from-brand-600 to-purple-600 rounded-2xl shadow-2xl p-6 text-white">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl">
                            <HelpCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Première visite?</h3>
                            <p className="text-sm text-white/80">Découvrez Sentinel GRC en 2 minutes</p>
                        </div>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onStart}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white text-brand-600 rounded-xl text-sm font-bold hover:scale-105 transition-transform"
                    >
                        <Zap className="h-4 w-4" />
                        Démarrer le tour
                    </button>
                    <button
                        onClick={onDismiss}
                        className="px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-bold hover:bg-white/30 transition-colors"
                    >
                        Plus tard
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
        // Show banner after 3 seconds if onboarding not completed
        // Check both Firestore profile (user.onboardingCompleted) and localStorage (fallback)
        const isCompleted = user?.onboardingCompleted || OnboardingService.hasCompletedOnboarding();

        if (!isCompleted && !localStorage.getItem('onboarding-dismissed')) {
            const timer = setTimeout(() => setShowBanner(true), 3000);
            return () => clearTimeout(timer);
        }
    }, [user?.onboardingCompleted]);

    const handleStart = () => {
        setShowBanner(false);
        OnboardingService.startMainTour(user?.role || 'user');
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem('onboarding-dismissed', 'true');
    };

    if (!showBanner || localStorage.getItem('onboarding-dismissed')) {
        return null;
    }

    return <OnboardingBanner onStart={handleStart} onDismiss={handleDismiss} />;
};
