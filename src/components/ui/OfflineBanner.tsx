import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from './Icons';
import { useLocale } from '../../hooks/useLocale';

export const OfflineBanner: React.FC = () => {
 const [isOnline, setIsOnline] = useState(navigator.onLine);
 const { t } = useLocale();

 useEffect(() => {
 const handleOnline = () => setIsOnline(true);
 const handleOffline = () => setIsOnline(false);

 window.addEventListener('online', handleOnline);
 window.addEventListener('offline', handleOffline);

 return () => {
 window.removeEventListener('online', handleOnline);
 window.removeEventListener('offline', handleOffline);
 };
 }, []);

 return (
 <AnimatePresence>
 {!isOnline && (
 <motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  className="bg-red-500 text-white overflow-hidden absolute top-0 left-0 right-0 z-sticky text-center"
 >
  <div className="py-1 px-4 text-xs font-bold flex items-center justify-center gap-2">
  <WifiOff className="h-3 w-3" />
  <span>{t('ui.offlineBanner.message', { defaultValue: 'Vous êtes hors ligne. Vérifiez votre connexion internet.' })}</span>
  </div>
 </motion.div>
 )}
 </AnimatePresence>
 );
};
