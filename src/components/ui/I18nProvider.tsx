import React, { useEffect, useState } from 'react';
import i18n from '../../i18n';

interface I18nProviderProps {
  children: React.ReactNode;
}

/**
 * I18nProvider - Ensures i18next is initialized before rendering children
 * Prevents translation access before i18next is ready
 */
export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if i18next is already initialized
    if (i18n.isInitialized) {
      setTimeout(() => setIsReady(true), 0);
      return;
    }

    // Wait for i18next to initialize
    const handleInitialized = () => {
      setIsReady(true);
    };

    // Listen for initialization
    i18n.on('initialized', handleInitialized);

    // Cleanup
    return () => {
      i18n.off('initialized', handleInitialized);
    };
  }, []);

  // Show loading state while i18next initializes
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
};
