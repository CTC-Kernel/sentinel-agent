import { ErrorLogger } from './errorLogger';
import { auth } from '../firebase';
import { User } from 'firebase/auth';

/**
 * Service de monitoring des sessions
 * Détecte les activités suspectes et les anomalies
 *
 * SÉCURITÉ: Ce service complète Firebase Auth avec des contrôles additionnels
 */

interface SessionInfo {
  userId: string;
  email: string;
  lastActivity: number;
  loginTime: number;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  activityCount: number;
}

interface SessionAnomaly {
  type: 'concurrent_session' | 'location_change' | 'suspicious_activity' | 'idle_timeout' | 'role_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

class SessionMonitoringService {
  private sessionKey = 'session_info';
  private anomaliesKey = 'session_anomalies';
  private idleTimeout = 15 * 60 * 1000; // 15 minutes par défaut
  private activityCheckInterval: NodeJS.Timeout | null = null;
  private lastActivityTime = Date.now();

  /**
   * Initialise le monitoring de session
   * @param user Utilisateur Firebase
   */
  initSession(user: User | null): void {
    if (!user) {
      this.clearSession();
      return;
    }

    const existingSession = this.getSessionInfo();

    const sessionInfo: SessionInfo = {
      userId: user.uid,
      email: user.email || '',
      lastActivity: Date.now(),
      loginTime: existingSession?.userId === user.uid ? existingSession.loginTime : Date.now(),
      userAgent: navigator.userAgent,
      activityCount: existingSession?.userId === user.uid ? existingSession.activityCount + 1 : 1
    };

    // Détecter les anomalies
    if (existingSession && existingSession.userId !== user.uid) {
      this.reportAnomaly({
        type: 'concurrent_session',
        severity: 'high',
        message: 'Session concurrente détectée: changement d\'utilisateur sans déconnexion',
        timestamp: Date.now(),
        metadata: {
          previousUser: existingSession.userId,
          newUser: user.uid
        }
      });
    }

    this.saveSessionInfo(sessionInfo);
    this.startActivityMonitoring();

    ErrorLogger.info('Session initialisée', 'SessionMonitoring', {
      metadata: {
        userId: user.uid,
        email: user.email
      }
    });
  }

  /**
   * Enregistre une activité utilisateur
   */
  recordActivity(): void {
    this.lastActivityTime = Date.now();
    const session = this.getSessionInfo();

    if (session) {
      session.lastActivity = Date.now();
      session.activityCount += 1;
      this.saveSessionInfo(session);
    }
  }

  /**
   * Démarre le monitoring d'activité
   */
  private startActivityMonitoring(): void {
    // Nettoyer l'intervalle existant
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
    }

    // Vérifier l'activité toutes les minutes
    this.activityCheckInterval = setInterval(() => {
      this.checkIdleTimeout();
    }, 60 * 1000); // 1 minute

    // Écouter les événements d'activité
    if (typeof window !== 'undefined') {
      ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
        window.addEventListener(event, () => this.recordActivity(), { passive: true });
      });
    }
  }

  /**
   * Vérifie le timeout d'inactivité
   */
  private checkIdleTimeout(): void {
    const session = this.getSessionInfo();
    if (!session) return;

    const idleTime = Date.now() - this.lastActivityTime;

    if (idleTime > this.idleTimeout) {
      this.reportAnomaly({
        type: 'idle_timeout',
        severity: 'medium',
        message: `Session inactive depuis ${Math.round(idleTime / 60000)} minutes`,
        timestamp: Date.now(),
        metadata: {
          idleTimeMinutes: Math.round(idleTime / 60000)
        }
      });

      // Déconnecter l'utilisateur
      this.forceLogout('Session expirée pour inactivité');
    }
  }

  /**
   * Configure le timeout d'inactivité
   * @param timeoutMs Timeout en millisecondes
   */
  setIdleTimeout(timeoutMs: number): void {
    this.idleTimeout = timeoutMs;
    ErrorLogger.info(`Idle timeout configuré: ${timeoutMs / 60000} minutes`, 'SessionMonitoring');
  }

  /**
   * Détecte les changements de localisation suspects
   * @param newLocation Nouvelle localisation
   */
  checkLocationChange(newLocation: string): void {
    const session = this.getSessionInfo();
    if (!session || !session.location) {
      // Première localisation, on l'enregistre
      if (session) {
        session.location = newLocation;
        this.saveSessionInfo(session);
      }
      return;
    }

    // Vérifier si la localisation a changé de manière suspecte
    if (session.location !== newLocation) {
      const timeSinceLogin = Date.now() - session.loginTime;
      const timeMinutes = timeSinceLogin / 60000;

      // Alerte si changement de pays en moins de 30 minutes (impossible physiquement)
      if (timeMinutes < 30) {
        this.reportAnomaly({
          type: 'location_change',
          severity: 'critical',
          message: 'Changement de localisation suspect détecté',
          timestamp: Date.now(),
          metadata: {
            previousLocation: session.location,
            newLocation,
            timeMinutes: Math.round(timeMinutes)
          }
        });

        // Optionnel: forcer la déconnexion
        // this.forceLogout('Activité suspecte détectée');
      } else {
        // Mettre à jour la localisation
        session.location = newLocation;
        this.saveSessionInfo(session);
      }
    }
  }

  /**
   * Détecte un changement de rôle/permissions
   * @param newRole Nouveau rôle
   */
  onRoleChange(newRole: string): void {
    this.reportAnomaly({
      type: 'role_change',
      severity: 'high',
      message: `Changement de rôle détecté: ${newRole}`,
      timestamp: Date.now(),
      metadata: {
        newRole
      }
    });

    // Forcer un rafraîchissement de session
    ErrorLogger.info('Rechargement de la session après changement de rôle', 'SessionMonitoring');
  }

  /**
   * Vérifie l'intégrité de la session
   * @returns true si la session est valide
   */
  validateSession(): boolean {
    const session = this.getSessionInfo();
    if (!session) return false;

    const currentUser = auth.currentUser;
    if (!currentUser) return false;

    // Vérifier que l'utilisateur correspond
    if (session.userId !== currentUser.uid) {
      this.reportAnomaly({
        type: 'suspicious_activity',
        severity: 'critical',
        message: 'Incohérence entre session locale et Firebase Auth',
        timestamp: Date.now(),
        metadata: {
          localUserId: session.userId,
          authUserId: currentUser.uid
        }
      });
      return false;
    }

    // Vérifier que la session n'est pas trop ancienne (24h max)
    const sessionAge = Date.now() - session.loginTime;
    if (sessionAge > 24 * 60 * 60 * 1000) {
      this.reportAnomaly({
        type: 'idle_timeout',
        severity: 'medium',
        message: 'Session trop ancienne (>24h)',
        timestamp: Date.now(),
        metadata: {
          sessionAgeHours: Math.round(sessionAge / (60 * 60 * 1000))
        }
      });
      return false;
    }

    return true;
  }

  /**
   * Force la déconnexion de l'utilisateur
   * @param reason Raison de la déconnexion
   */
  async forceLogout(reason: string): Promise<void> {
    ErrorLogger.warn(`Déconnexion forcée: ${reason}`, 'SessionMonitoring');

    try {
      await auth.signOut();
      this.clearSession();

      // Afficher un message à l'utilisateur
      if (typeof window !== 'undefined') {
        window.location.href = '/#/login?reason=' + encodeURIComponent(reason);
      }
    } catch (error) {
      ErrorLogger.error(error, 'SessionMonitoring.forceLogout');
    }
  }

  /**
   * Obtient les anomalies de session
   * @returns Liste des anomalies
   */
  getAnomalies(): SessionAnomaly[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(this.anomaliesKey);
      if (!stored) return [];
      return JSON.parse(stored) as SessionAnomaly[];
    } catch (error) {
      ErrorLogger.error(error, 'SessionMonitoring.getAnomalies');
      return [];
    }
  }

  /**
   * Obtient le nombre d'anomalies critiques
   * @returns Nombre d'anomalies critiques non résolues
   */
  getCriticalAnomaliesCount(): number {
    const anomalies = this.getAnomalies();
    return anomalies.filter(a => a.severity === 'critical').length;
  }

  /**
   * Nettoie les anciennes anomalies (>7 jours)
   */
  cleanupOldAnomalies(): void {
    const anomalies = this.getAnomalies();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const recent = anomalies.filter(a => a.timestamp > sevenDaysAgo);

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.anomaliesKey, JSON.stringify(recent));
    }
  }

  /**
   * Obtient les informations de session
   * @returns Informations de session ou null
   */
  private getSessionInfo(): SessionInfo | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(this.sessionKey);
      if (!stored) return null;
      return JSON.parse(stored) as SessionInfo;
    } catch (error) {
      ErrorLogger.error(error, 'SessionMonitoring.getSessionInfo');
      return null;
    }
  }

  /**
   * Sauvegarde les informations de session
   * @param info Informations de session
   */
  private saveSessionInfo(info: SessionInfo): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(info));
    } catch (error) {
      ErrorLogger.error(error, 'SessionMonitoring.saveSessionInfo');
    }
  }

  /**
   * Rapporte une anomalie
   * @param anomaly Anomalie détectée
   */
  private reportAnomaly(anomaly: SessionAnomaly): void {
    ErrorLogger.warn(`Anomalie de session: ${anomaly.message}`, 'SessionMonitoring', {
      metadata: {
        type: anomaly.type,
        severity: anomaly.severity,
        ...anomaly.metadata
      }
    });

    // Sauvegarder l'anomalie
    const anomalies = this.getAnomalies();
    anomalies.push(anomaly);

    // Limiter à 100 anomalies max
    if (anomalies.length > 100) {
      anomalies.shift();
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.anomaliesKey, JSON.stringify(anomalies));
    }

    // Si anomalie critique, envoyer une notification
    if (anomaly.severity === 'critical') {
      // TODO: Envoyer une notification push ou email
      console.error('⚠️ ANOMALIE CRITIQUE DE SESSION:', anomaly);
    }
  }

  /**
   * Nettoie la session
   */
  clearSession(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(this.sessionKey);

    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }

    ErrorLogger.info('Session nettoyée', 'SessionMonitoring');
  }

  /**
   * Obtient les métriques de session
   * @returns Métriques de session
   */
  getMetrics(): {
    sessionDuration: number;
    activityCount: number;
    lastActivity: number;
    idleTime: number;
  } | null {
    const session = this.getSessionInfo();
    if (!session) return null;

    return {
      sessionDuration: Date.now() - session.loginTime,
      activityCount: session.activityCount,
      lastActivity: session.lastActivity,
      idleTime: Date.now() - this.lastActivityTime
    };
  }
}

// Export singleton
export const SessionMonitor = new SessionMonitoringService();

/**
 * Hook React pour le monitoring de session
 * @example
 * useEffect(() => {
 *   if (user) {
 *     SessionMonitor.initSession(user);
 *   }
 * }, [user]);
 */
export const useSessionMonitoring = (user: User | null) => {
  if (user) {
    SessionMonitor.initSession(user);
  }

  return {
    monitor: SessionMonitor,
    recordActivity: () => SessionMonitor.recordActivity(),
    getMetrics: () => SessionMonitor.getMetrics(),
    getAnomalies: () => SessionMonitor.getAnomalies()
  };
};
