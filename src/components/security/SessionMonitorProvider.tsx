/**
 * Provider React pour le monitoring automatique des sessions
 * À intégrer dans App.tsx après AuthContext
 *
 * Fonctionnalités:
 * - Initialisation automatique du monitoring de session
 * - Configuration du timeout selon le rôle utilisateur
 * - Affichage d'une bannière d'alerte en cas d'anomalie critique
 * - Nettoyage automatique au logout
 */

import React, { useEffect, useState } from 'react';
import { SessionMonitor } from '../../services/sessionMonitoringService';
import { useStore } from '../../store';
import { X } from '../ui/Icons';

interface SessionMonitorProviderProps {
  children: React.ReactNode;
  // Configuration du timeout par rôle (en millisecondes)
  timeoutConfig?: {
    admin?: number;
    rssi?: number;
    auditor?: number;
    project_manager?: number;
    direction?: number;
    user?: number;
  };
  // Afficher la bannière d'alerte en cas d'anomalie
  showAnomalyBanner?: boolean;
}

export const SessionMonitorProvider: React.FC<SessionMonitorProviderProps> = ({
  children,
  timeoutConfig = {
    admin: 15 * 60 * 1000,        // 15 minutes
    rssi: 30 * 60 * 1000,          // 30 minutes
    auditor: 60 * 60 * 1000,       // 1 heure
    project_manager: 60 * 60 * 1000, // 1 heure
    direction: 60 * 60 * 1000,     // 1 heure
    user: 60 * 60 * 1000           // 1 heure
  },
  showAnomalyBanner = true
}) => {
  const user = useStore(state => state.user);
  const [criticalAnomaliesCount, setCriticalAnomaliesCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Initialiser le monitoring de session
  useEffect(() => {
    if (user) {
      // Initialiser le monitoring
      SessionMonitor.initSession(user as never);

      // Configurer le timeout selon le rôle
      const role = user.role as keyof typeof timeoutConfig;
      const timeout = timeoutConfig[role] || timeoutConfig.user || 60 * 60 * 1000;
      SessionMonitor.setIdleTimeout(timeout);

      // Nettoyer les anciennes anomalies au login
      SessionMonitor.cleanupOldAnomalies();
    } else {
      // Nettoyer au logout
      SessionMonitor.clearSession();
    }

    return () => {
      // Cleanup lors du démontage
      if (!user) {
        SessionMonitor.clearSession();
      }
    };
  }, [user, timeoutConfig]);

  // Vérifier les anomalies périodiquement
  useEffect(() => {
    if (!showAnomalyBanner) return;

    const checkAnomalies = () => {
      const count = SessionMonitor.getCriticalAnomaliesCount();
      setCriticalAnomaliesCount(count);
    };

    // Vérification initiale
    checkAnomalies();

    // Vérifier toutes les 30 secondes
    const interval = setInterval(checkAnomalies, 30000);

    return () => clearInterval(interval);
  }, [showAnomalyBanner]);

  // Afficher la bannière d'alerte si nécessaire
  const showBanner = showAnomalyBanner && criticalAnomaliesCount > 0 && !bannerDismissed;

  return (
    <>
      {showBanner && (
        <SecurityAnomalyBanner
          count={criticalAnomaliesCount}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
      {children}
    </>
  );
};

/**
 * Bannière d'alerte pour les anomalies de sécurité
 */
interface SecurityAnomalyBannerProps {
  count: number;
  onDismiss: () => void;
}

const SecurityAnomalyBanner: React.FC<SecurityAnomalyBannerProps> = ({ count, onDismiss }) => {
  const [showDetails, setShowDetails] = useState(false);
  const anomalies = SessionMonitor.getAnomalies().filter(a => a.severity === 'critical');

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold">
                {count} anomalie{count > 1 ? 's' : ''} de sécurité critique{count > 1 ? 's' : ''} détectée{count > 1 ? 's' : ''}
              </p>
              <p className="text-sm opacity-90">
                Votre session présente une activité suspecte. Veuillez contacter votre administrateur.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-1 bg-red-700 hover:bg-red-800 rounded text-sm font-medium"
            >
              {showDetails ? 'Masquer' : 'Détails'}
            </button>
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-red-700 rounded"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {showDetails && (
          <div className="mt-3 pt-3 border-t border-red-500">
            <h4 className="font-semibold mb-2">Détails des anomalies:</h4>
            <ul className="space-y-2 text-sm">
              {anomalies.map((anomaly, index) => (
                <li key={index} className="bg-red-700/50 rounded px-3 py-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">{anomaly.type.replace(/_/g, ' ')}</span>
                      <p className="opacity-90">{anomaly.message}</p>
                    </div>
                    <span className="text-xs opacity-75">
                      {new Date(anomaly.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};




