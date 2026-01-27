import React, { useState, useEffect } from 'react';
import { Cookie, X } from './Icons';
import { LegalModal } from './LegalModal';
import { useStore } from '../../store';
import { hybridService } from '../../services/hybridService';
import { initializeAnalytics } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';

export const CookieConsent: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [showLegalModal, setShowLegalModal] = useState(false);
    const isDemoMode = localStorage.getItem('demoMode') === 'true';

    useEffect(() => {
        if (isDemoMode) return;

        const consent = localStorage.getItem('sentinel_cookie_consent');
        if (!consent) {
            // Small delay for better UX
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [isDemoMode]);

    const { user } = useStore();

    const handleAccept = async () => {
        localStorage.setItem('sentinel_cookie_consent', 'true');
        setIsVisible(false);

        // RGPD: Initialize analytics after consent is given
        try {
            await initializeAnalytics();
        } catch (error) {
            ErrorLogger.warn('Analytics initialization after consent failed', 'CookieConsent', { metadata: { error } });
        }

        if (user) {
            try {
                // Log consent to backend for GDPR proof
                await hybridService.logConsent('cookie_policy', true);
                await hybridService.logConsent('tos', true); // Implicit acceptance
                await hybridService.logConsent('privacy_policy', true);
            } catch (error) {
                ErrorLogger.error(error, 'CookieConsent.handleAccept');
            }
        }
    };

    if (isDemoMode || !isVisible)
        return <LegalModal isOpen={showLegalModal} onClose={() => setShowLegalModal(false)} initialTab="privacy" />;

    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 z-max p-4 animate-slide-up">
                <div className="max-w-4xl mx-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-brand-50 dark:bg-brand-800 rounded-xl text-brand-600 shrink-0">
                            <Cookie className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Nous respectons votre vie privée</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                                Nous utilisons des cookies essentiels pour assurer le bon fonctionnement et la sécurité de Sentinel GRC.
                                Aucune donnée personnelle n'est vendue à des tiers.
                                <button
                                    onClick={() => setShowLegalModal(true)}
                                    className="text-brand-600 hover:underline font-bold ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-1"
                                >
                                    En savoir plus
                                </button>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={handleAccept}
                            className="flex-1 md:flex-none px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:scale-105 transition-transform shadow-lg whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                        >
                            Accepter et Fermer
                        </button>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-white/10 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                            aria-label="Fermer"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            <LegalModal
                isOpen={showLegalModal}
                onClose={() => setShowLegalModal(false)}
                initialTab="privacy"
            />
        </>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
