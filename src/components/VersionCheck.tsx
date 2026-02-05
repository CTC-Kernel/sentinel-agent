import { useEffect } from 'react';
import { toast } from '@/lib/toast';
import { BUILD_VERSION } from '../config/version';

interface VersionInfo {
 version: string;
 timestamp: string;
}

import { ErrorLogger } from '../services/errorLogger';

export const VersionCheck = () => {
 // Use the build-time version as the source of truth
 const currentVersion = BUILD_VERSION;

 useEffect(() => {
 const checkVersion = async () => {
 try {
 // Add timestamp to avoid caching of version.json itself
 const response = await fetch(`/version.json?t=${new Date().getTime()}`);
 if (!response.ok) return;

 const data: VersionInfo = await response.json();

 if (currentVersion !== data.version) {
  // New version detected
  ErrorLogger.info(`New version detected: ${data.version}, Current: ${currentVersion}`, 'VersionCheck');

  const handleUpdate = async () => {
  // Clear Service Worker caches
  if ('caches' in window) {
  try {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  } catch (e) {
  ErrorLogger.error(e, 'VersionCheck.clearCaches');
  }
  }

  // Unregister all service workers
  if ('serviceWorker' in navigator) {
  try {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(reg => reg.unregister()));
  } catch (e) {
  ErrorLogger.error(e, 'VersionCheck.unregisterServiceWorkers');
  }
  }

  // Force reload from server
  window.location.reload();
  };

  toast.info(
  "Mise à jour disponible",
  "Une nouvelle version a été déployée. L'application va redémarrer automatiquement.",
  {
  label: "Mettre à jour maintenant",
  onClick: handleUpdate
  }
  );

  // Reload after a short delay (5s) to let the toast be visible
  setTimeout(handleUpdate, 5000);
 }
 } catch (error) {
 ErrorLogger.warn('Failed to check version', 'VersionCheck', { metadata: { error } });
 }
 };

 // Check immediately
 checkVersion();

 // Check every 5 minutes
 const interval = setInterval(checkVersion, 5 * 60 * 1000);

 // Also check on visibility change (when user comes back to tab)
 const handleVisibilityChange = () => {
 if (document.visibilityState === 'visible') {
 checkVersion();
 }
 };

 document.addEventListener('visibilitychange', handleVisibilityChange);

 return () => {
 clearInterval(interval);
 document.removeEventListener('visibilitychange', handleVisibilityChange);
 };
 }, [currentVersion]);

 return null;
};
