import { useState, useEffect } from 'react';
import { SessionMonitor } from '../services/sessionMonitoringService';

/**
 * Hook pour accéder aux métriques de session
 * @example
 * const metrics = useSessionMetrics();
 * console.log(`Session active depuis ${metrics?.sessionDuration}ms`);
 */
export const useSessionMetrics = () => {
 const [metrics, setMetrics] = useState(SessionMonitor.getMetrics());

 useEffect(() => {
 const interval = setInterval(() => {
 setMetrics(SessionMonitor.getMetrics());
 }, 5000); // Mettre à jour toutes les 5 secondes

 return () => clearInterval(interval);
 }, []);

 return metrics;
};

/**
 * Hook pour enregistrer l'activité utilisateur
 * À utiliser dans les composants interactifs
 * @example
 * const recordActivity = useActivityRecorder();
 *
 * const handleClick = () => {
 * recordActivity();
 * // ... rest of logic
 * };
 */
export const useActivityRecorder = () => {
 return () => SessionMonitor.recordActivity();
};
