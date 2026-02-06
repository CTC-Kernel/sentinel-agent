import React, { useState, useEffect } from 'react';
import { Cookie, X } from './Icons';
import { LegalModal } from './LegalModal';
import { useStore } from '../../store';
import { hybridService } from '../../services/hybridService';
import { initializeAnalytics } from '../../firebase';
import { initSentry } from '../../utils/sentryInit';
import { ErrorLogger } from '../../services/errorLogger';

interface CookieConsentDetails {
 essential: true;
 analytics: boolean;
 tracking: boolean;
}

/** Store granular consent details in localStorage */
const saveConsentDetails = (details: CookieConsentDetails): void => {
 localStorage.setItem('sentinel_cookie_consent_details', JSON.stringify(details));
};

export const CookieConsent: React.FC = () => {
 const [isVisible, setIsVisible] = useState(false);
 const [showLegalModal, setShowLegalModal] = useState(false);
 const [analyticsConsent, setAnalyticsConsent] = useState(false);
 const [trackingConsent, setTrackingConsent] = useState(false);
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

 const handleAcceptAll = async () => {
 localStorage.setItem('sentinel_cookie_consent', 'true');
 const details: CookieConsentDetails = { essential: true, analytics: true, tracking: true };
 saveConsentDetails(details);
 setIsVisible(false);

 // RGPD: Initialize analytics after consent is given
 try {
 await initializeAnalytics();
 } catch (error) {
 ErrorLogger.warn('Analytics initialization after consent failed', 'CookieConsent', { metadata: { error } });
 }

 // Initialize Sentry after analytics consent is granted
 try {
 initSentry();
 } catch (error) {
 ErrorLogger.warn('Sentry initialization after consent failed', 'CookieConsent', { metadata: { error } });
 }

 if (user) {
 try {
 // Log consent to backend for GDPR proof
 await hybridService.logConsent('cookie_policy', true);
 await hybridService.logConsent('privacy_policy', true);
 } catch (error) {
 ErrorLogger.error(error, 'CookieConsent.handleAcceptAll');
 }
 }
 };

 const handleAcceptSelected = async () => {
 localStorage.setItem('sentinel_cookie_consent', 'true');
 const details: CookieConsentDetails = { essential: true, analytics: analyticsConsent, tracking: trackingConsent };
 saveConsentDetails(details);
 setIsVisible(false);

 // Only initialize analytics services if the relevant consent was given
 if (analyticsConsent) {
 try {
 await initializeAnalytics();
 } catch (error) {
 ErrorLogger.warn('Analytics initialization after consent failed', 'CookieConsent', { metadata: { error } });
 }

 // Initialize Sentry only with analytics consent
 try {
 initSentry();
 } catch (error) {
 ErrorLogger.warn('Sentry initialization after consent failed', 'CookieConsent', { metadata: { error } });
 }
 }

 if (user) {
 try {
 await hybridService.logConsent('cookie_policy', true);
 await hybridService.logConsent('privacy_policy', true);
 } catch (error) {
 ErrorLogger.error(error, 'CookieConsent.handleAcceptSelected');
 }
 }
 };

 const handleRefuse = () => {
 localStorage.setItem('sentinel_cookie_consent', 'false');
 const details: CookieConsentDetails = { essential: true, analytics: false, tracking: false };
 saveConsentDetails(details);
 setIsVisible(false);
 };

 const handleClose = () => {
 // Closing the banner without accepting is treated as refusing
 handleRefuse();
 };

 if (isDemoMode || !isVisible)
 return <LegalModal isOpen={showLegalModal} onClose={() => setShowLegalModal(false)} initialTab="privacy" />;

 return (
 <>
 <div className="fixed bottom-0 left-0 right-0 z-max p-4 animate-slide-up">
 <div className="max-w-4xl mx-auto bg-card/90 backdrop-blur-xl border border-border/40 rounded-2xl shadow-2xl p-6 flex flex-col gap-5">
  <div className="flex items-start gap-4">
  <div className="p-3 bg-primary/10 dark:bg-primary rounded-3xl text-primary shrink-0">
  <Cookie className="h-6 w-6" />
  </div>
  <div>
  <h3 className="text-lg font-bold text-foreground mb-1">Nous respectons votre vie privée</h3>
  <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
  Nous utilisons des cookies essentiels pour assurer le bon fonctionnement et la sécurité de Sentinel GRC.
  Aucune donnée personnelle n'est vendue à des tiers.
  <button
   onClick={() => setShowLegalModal(true)}
   className="text-primary hover:underline font-bold ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1"
  >
   En savoir plus
  </button>
  </p>
  </div>
  </div>

  {/* Granular consent options */}
  <div className="flex flex-col gap-2 pl-16">
  <label className="flex items-center gap-3 text-sm text-foreground">
  <input
  type="checkbox"
  checked
  disabled
  className="rounded border-border text-primary focus:ring-primary cursor-not-allowed opacity-70"
  />
  <span className="font-medium">Cookies essentiels</span>
  <span className="text-xs text-muted-foreground">(toujours actifs)</span>
  </label>
  <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
  <input
  type="checkbox"
  checked={analyticsConsent}
  onChange={(e) => setAnalyticsConsent(e.target.checked)}
  className="rounded border-border text-primary focus:ring-primary"
  />
  <span className="font-medium">Cookies analytiques</span>
  <span className="text-xs text-muted-foreground">(mesure d'audience)</span>
  </label>
  <label className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
  <input
  type="checkbox"
  checked={trackingConsent}
  onChange={(e) => setTrackingConsent(e.target.checked)}
  className="rounded border-border text-primary focus:ring-primary"
  />
  <span className="font-medium">Cookies de suivi</span>
  <span className="text-xs text-muted-foreground">(amélioration de l'expérience)</span>
  </label>
  </div>

  <div className="flex items-center justify-end gap-3 w-full">
  <button
  onClick={handleRefuse}
  className="px-5 py-2.5 border border-border text-foreground font-semibold rounded-3xl hover:bg-muted dark:hover:bg-muted transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
  >
  Refuser
  </button>
  <button
  onClick={handleAcceptSelected}
  className="px-5 py-2.5 border border-primary text-primary font-semibold rounded-3xl hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  Accepter la sélection
  </button>
  <button
  onClick={handleAcceptAll}
  className="px-6 py-2.5 bg-foreground text-background font-bold rounded-3xl hover:scale-105 transition-transform shadow-lg whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 "
  >
  Accepter tout
  </button>
  <button
  onClick={handleClose}
  className="p-3 text-muted-foreground hover:bg-muted dark:hover:bg-muted rounded-3xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
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
