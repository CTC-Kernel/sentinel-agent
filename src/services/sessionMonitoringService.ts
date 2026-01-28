import { ErrorLogger } from './errorLogger';
import { auth, db } from '../firebase';
import { User } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

/**
 * Service de monitoring des sessions
 * Détecte les activités suspectes et les anomalies
 *
 * SÉCURITÉ: Ce service complète Firebase Auth avec des contrôles additionnels
 * AAA Enhancement: Concurrent session management, device fingerprinting
 */

interface DeviceFingerprint {
  /** Browser fingerprint hash */
  hash: string;
  /** User agent string */
  userAgent: string;
  /** Screen resolution */
  screenResolution: string;
  /** Timezone */
  timezone: string;
  /** Language */
  language: string;
  /** Platform */
  platform: string;
  /** Hardware concurrency (CPU cores) */
  hardwareConcurrency: number;
  /** Device memory (if available) */
  deviceMemory?: number;
  /** Touch support */
  touchSupport: boolean;
}

interface ActiveSession {
  /** Session ID (unique per device/browser) */
  sessionId: string;
  /** User ID */
  userId: string;
  /** Organization ID */
  organizationId?: string;
  /** Device fingerprint */
  deviceFingerprint: DeviceFingerprint;
  /** IP address (if available) */
  ipAddress?: string;
  /** Geolocation (if available) */
  geolocation?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  /** Login timestamp */
  loginTime: Timestamp;
  /** Last activity timestamp */
  lastActivity: Timestamp;
  /** Is current session */
  isCurrent: boolean;
}

interface SessionInfo {
  userId: string;
  email: string;
  lastActivity: number;
  loginTime: number;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  activityCount: number;
  /** Device fingerprint for this session */
  deviceFingerprint?: DeviceFingerprint;
  /** Session ID for concurrent session tracking */
  sessionId?: string;
}

interface SessionAnomaly {
  type: 'concurrent_session' | 'location_change' | 'suspicious_activity' | 'idle_timeout' | 'role_change' | 'device_change' | 'impossible_travel' | 'session_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/** Configuration for concurrent session limits */
interface SessionLimitConfig {
  /** Maximum concurrent sessions per user (default: 3) */
  maxSessions: number;
  /** Action when limit exceeded: 'block_new' | 'logout_oldest' */
  limitAction: 'block_new' | 'logout_oldest';
  /** Allow same device unlimited sessions */
  allowSameDevice: boolean;
}

class SessionMonitoringService {
  private sessionKey = 'session_info';
  private anomaliesKey = 'session_anomalies';
  private idleTimeout = 15 * 60 * 1000; // 15 minutes par défaut
  private activityCheckInterval: NodeJS.Timeout | null = null;
  private lastActivityTime = Date.now();

  /** Current session ID for this browser/device */
  private currentSessionId: string | null = null;

  /** Session limit configuration */
  private sessionLimitConfig: SessionLimitConfig = {
    maxSessions: 3,
    limitAction: 'logout_oldest',
    allowSameDevice: true
  };

  // ============================================================================
  // Device Fingerprinting
  // ============================================================================

  /**
   * Generate a device fingerprint for the current browser/device
   * Uses stable browser characteristics that persist across sessions
   */
  generateDeviceFingerprint(): DeviceFingerprint {
    if (typeof window === 'undefined') {
      return this.getDefaultFingerprint();
    }

    const nav = navigator as Navigator & {
      deviceMemory?: number;
    };

    const fingerprint: DeviceFingerprint = {
      hash: '', // Will be computed
      userAgent: nav.userAgent || 'unknown',
      screenResolution: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: nav.language || 'unknown',
      platform: nav.platform || 'unknown',
      hardwareConcurrency: nav.hardwareConcurrency || 1,
      deviceMemory: nav.deviceMemory,
      touchSupport: 'ontouchstart' in window || nav.maxTouchPoints > 0
    };

    // Generate hash from fingerprint components
    fingerprint.hash = this.hashFingerprint(fingerprint);

    return fingerprint;
  }

  /**
   * Default fingerprint for server-side rendering
   */
  private getDefaultFingerprint(): DeviceFingerprint {
    return {
      hash: 'server-side',
      userAgent: 'server',
      screenResolution: '0x0x0',
      timezone: 'UTC',
      language: 'en',
      platform: 'server',
      hardwareConcurrency: 1,
      touchSupport: false
    };
  }

  /**
   * Create a hash from fingerprint components
   * Uses a simple but effective hashing algorithm
   */
  private hashFingerprint(fp: Omit<DeviceFingerprint, 'hash'>): string {
    const data = [
      fp.userAgent,
      fp.screenResolution,
      fp.timezone,
      fp.language,
      fp.platform,
      fp.hardwareConcurrency.toString(),
      fp.deviceMemory?.toString() || 'unknown',
      fp.touchSupport.toString()
    ].join('|');

    // Simple hash function (FNV-1a)
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }

    return hash.toString(16).padStart(8, '0');
  }

  /**
   * Compare two fingerprints to determine if they're from the same device
   * Returns a similarity score (0-1)
   */
  compareFingerprints(fp1: DeviceFingerprint, fp2: DeviceFingerprint): number {
    if (fp1.hash === fp2.hash) return 1;

    let matches = 0;
    let total = 0;

    // Critical fields (higher weight)
    if (fp1.screenResolution === fp2.screenResolution) matches += 2;
    total += 2;

    if (fp1.timezone === fp2.timezone) matches += 2;
    total += 2;

    if (fp1.platform === fp2.platform) matches += 2;
    total += 2;

    // Standard fields
    if (fp1.language === fp2.language) matches += 1;
    total += 1;

    if (fp1.hardwareConcurrency === fp2.hardwareConcurrency) matches += 1;
    total += 1;

    if (fp1.touchSupport === fp2.touchSupport) matches += 1;
    total += 1;

    if (fp1.deviceMemory === fp2.deviceMemory) matches += 1;
    total += 1;

    return matches / total;
  }

  // ============================================================================
  // Concurrent Session Management
  // ============================================================================

  /**
   * Configure session limits
   */
  configureSessionLimits(config: Partial<SessionLimitConfig>): void {
    this.sessionLimitConfig = { ...this.sessionLimitConfig, ...config };
    ErrorLogger.info('Session limits configured', 'SessionMonitoring', {
      metadata: config
    });
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Register current session in Firestore for concurrent session tracking
   */
  async registerSession(
    userId: string,
    organizationId?: string,
    ipAddress?: string,
    geolocation?: ActiveSession['geolocation']
  ): Promise<{ allowed: boolean; sessionId?: string; reason?: string }> {
    try {
      const fingerprint = this.generateDeviceFingerprint();
      const sessionId = this.generateSessionId();

      // Check existing sessions for this user
      const sessionsRef = collection(db, 'active_sessions');
      const userSessionsQuery = query(
        sessionsRef,
        where('userId', '==', userId),
        orderBy('loginTime', 'desc')
      );

      const snapshot = await getDocs(userSessionsQuery);
      const existingSessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (ActiveSession & { id: string })[];

      // Check if same device already has a session
      const sameDeviceSession = existingSessions.find(
        s => this.compareFingerprints(s.deviceFingerprint, fingerprint) > 0.8
      );

      if (sameDeviceSession && this.sessionLimitConfig.allowSameDevice) {
        // Update existing session for same device
        await setDoc(doc(sessionsRef, sameDeviceSession.id), {
          ...sameDeviceSession,
          lastActivity: serverTimestamp(),
          isCurrent: true
        });

        this.currentSessionId = sameDeviceSession.id;
        return { allowed: true, sessionId: sameDeviceSession.id };
      }

      // Check session limit
      if (existingSessions.length >= this.sessionLimitConfig.maxSessions) {
        if (this.sessionLimitConfig.limitAction === 'block_new') {
          this.reportAnomaly({
            type: 'session_limit_exceeded',
            severity: 'high',
            message: `Limite de sessions atteinte (${this.sessionLimitConfig.maxSessions}). Nouvelle session bloquée.`,
            timestamp: Date.now(),
            metadata: {
              userId,
              existingSessions: existingSessions.length,
              maxSessions: this.sessionLimitConfig.maxSessions
            }
          });

          return {
            allowed: false,
            reason: `Vous avez atteint la limite de ${this.sessionLimitConfig.maxSessions} sessions simultanées. Veuillez vous déconnecter d'un autre appareil.`
          };
        }

        // Logout oldest session
        const oldestSession = existingSessions[existingSessions.length - 1];
        await deleteDoc(doc(sessionsRef, oldestSession.id));

        this.reportAnomaly({
          type: 'session_limit_exceeded',
          severity: 'medium',
          message: `Limite de sessions atteinte. Session la plus ancienne déconnectée.`,
          timestamp: Date.now(),
          metadata: {
            userId,
            loggedOutSessionId: oldestSession.id,
            loggedOutDevice: oldestSession.deviceFingerprint.platform
          }
        });
      }

      // Detect impossible travel
      if (geolocation && existingSessions.length > 0) {
        const lastSession = existingSessions[0];
        if (lastSession.geolocation?.latitude && lastSession.geolocation?.longitude &&
          geolocation.latitude && geolocation.longitude) {
          const impossibleTravel = this.detectImpossibleTravel(
            lastSession.geolocation as { latitude: number; longitude: number },
            geolocation as { latitude: number; longitude: number },
            lastSession.lastActivity.toDate()
          );

          if (impossibleTravel) {
            this.reportAnomaly({
              type: 'impossible_travel',
              severity: 'critical',
              message: 'Connexion détectée depuis une localisation impossible à atteindre',
              timestamp: Date.now(),
              metadata: {
                previousLocation: lastSession.geolocation,
                newLocation: geolocation,
                timeDifferenceMinutes: impossibleTravel.timeDifferenceMinutes,
                distanceKm: impossibleTravel.distanceKm
              }
            });
          }
        }
      }

      // Create new session
      const newSession: ActiveSession = {
        sessionId,
        userId,
        organizationId,
        deviceFingerprint: fingerprint,
        ipAddress,
        geolocation,
        loginTime: serverTimestamp() as Timestamp,
        lastActivity: serverTimestamp() as Timestamp,
        isCurrent: true
      };

      await setDoc(doc(sessionsRef, sessionId), newSession);
      this.currentSessionId = sessionId;

      ErrorLogger.info('Session registered', 'SessionMonitoring', {
        metadata: {
          sessionId,
          userId,
          deviceHash: fingerprint.hash
        }
      });

      return { allowed: true, sessionId };
    } catch (error) {
      ErrorLogger.error(error, 'SessionMonitoring.registerSession');
      // Fail open - allow session if registration fails
      return { allowed: true, sessionId: this.generateSessionId() };
    }
  }

  /**
   * Unregister current session (on logout)
   */
  async unregisterSession(): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      const sessionsRef = collection(db, 'active_sessions');
      await deleteDoc(doc(sessionsRef, this.currentSessionId));

      ErrorLogger.info('Session unregistered', 'SessionMonitoring', {
        metadata: { sessionId: this.currentSessionId }
      });

      this.currentSessionId = null;
    } catch (error) {
      ErrorLogger.error(error, 'SessionMonitoring.unregisterSession');
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      const sessionsRef = collection(db, 'active_sessions');
      const sessionDoc = doc(sessionsRef, this.currentSessionId);

      await setDoc(sessionDoc, {
        lastActivity: serverTimestamp()
      }, { merge: true });
    } catch {
      // Silent fail - don't interrupt user experience
      ErrorLogger.warn('Failed to update session activity', 'SessionMonitoring');
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<ActiveSession[]> {
    try {
      const sessionsRef = collection(db, 'active_sessions');
      const userSessionsQuery = query(
        sessionsRef,
        where('userId', '==', userId),
        orderBy('lastActivity', 'desc')
      );

      const snapshot = await getDocs(userSessionsQuery);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        sessionId: doc.id,
        isCurrent: doc.id === this.currentSessionId
      })) as ActiveSession[];
    } catch (error) {
      ErrorLogger.error(error, 'SessionMonitoring.getUserSessions');
      return [];
    }
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(sessionId: string): Promise<boolean> {
    try {
      const sessionsRef = collection(db, 'active_sessions');
      await deleteDoc(doc(sessionsRef, sessionId));

      ErrorLogger.info('Session terminated', 'SessionMonitoring', {
        metadata: { terminatedSessionId: sessionId }
      });

      return true;
    } catch (error) {
      ErrorLogger.error(error, 'SessionMonitoring.terminateSession');
      return false;
    }
  }

  /**
   * Terminate all other sessions for a user (keep current)
   */
  async terminateOtherSessions(userId: string): Promise<number> {
    try {
      const sessions = await this.getUserSessions(userId);
      let terminated = 0;

      for (const session of sessions) {
        if (session.sessionId !== this.currentSessionId) {
          await this.terminateSession(session.sessionId);
          terminated++;
        }
      }

      ErrorLogger.info('Other sessions terminated', 'SessionMonitoring', {
        metadata: { userId, terminatedCount: terminated }
      });

      return terminated;
    } catch (error) {
      ErrorLogger.error(error, 'SessionMonitoring.terminateOtherSessions');
      return 0;
    }
  }

  // ============================================================================
  // Impossible Travel Detection
  // ============================================================================

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Detect impossible travel (location change faster than physically possible)
   */
  private detectImpossibleTravel(
    previousLocation: { latitude: number; longitude: number },
    newLocation: { latitude: number; longitude: number },
    previousTime: Date
  ): { distanceKm: number; timeDifferenceMinutes: number } | null {
    const distance = this.calculateDistance(
      previousLocation.latitude, previousLocation.longitude,
      newLocation.latitude, newLocation.longitude
    );

    const timeDifferenceMinutes = (Date.now() - previousTime.getTime()) / (1000 * 60);

    // Max reasonable travel speed: 1000 km/h (fast jet)
    // For practical purposes, use 800 km/h (commercial jet)
    const maxSpeedKmh = 800;
    const maxPossibleDistance = (maxSpeedKmh / 60) * timeDifferenceMinutes;

    // If distance is greater than physically possible, flag as impossible travel
    // Add 10% buffer for VPN/proxy edge cases
    if (distance > maxPossibleDistance * 1.1 && distance > 100) {
      return {
        distanceKm: Math.round(distance),
        timeDifferenceMinutes: Math.round(timeDifferenceMinutes)
      };
    }

    return null;
  }

  /**
   * Initialise le monitoring de session
   * @param user Utilisateur Firebase
   * @param organizationId Organization ID for session registration
   */
  initSession(user: User | null, organizationId?: string): void {
    if (!user) {
      this.clearSession();
      return;
    }

    const existingSession = this.getSessionInfo();
    const fingerprint = this.generateDeviceFingerprint();

    const sessionInfo: SessionInfo = {
      userId: user.uid,
      email: user.email || '',
      lastActivity: Date.now(),
      loginTime: existingSession?.userId === user.uid ? existingSession.loginTime : Date.now(),
      userAgent: navigator.userAgent,
      activityCount: existingSession?.userId === user.uid ? existingSession.activityCount + 1 : 1,
      deviceFingerprint: fingerprint,
      sessionId: this.currentSessionId || undefined
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

    // Detect device change for same user
    if (existingSession && existingSession.userId === user.uid &&
      existingSession.deviceFingerprint) {
      const similarity = this.compareFingerprints(
        existingSession.deviceFingerprint,
        fingerprint
      );

      if (similarity < 0.5) {
        this.reportAnomaly({
          type: 'device_change',
          severity: 'medium',
          message: 'Changement d\'appareil détecté pour la session active',
          timestamp: Date.now(),
          metadata: {
            previousDeviceHash: existingSession.deviceFingerprint.hash,
            newDeviceHash: fingerprint.hash,
            similarity: Math.round(similarity * 100)
          }
        });
      }
    }

    this.saveSessionInfo(sessionInfo);
    this.startActivityMonitoring();

    // Register session in Firestore for concurrent session tracking
    this.registerSession(user.uid, organizationId).then(result => {
      if (!result.allowed) {
        ErrorLogger.warn('Session registration blocked', 'SessionMonitoring', {
          metadata: { reason: result.reason }
        });
        // Optionally force logout
        // this.forceLogout(result.reason || 'Session limit exceeded');
      } else if (result.sessionId) {
        sessionInfo.sessionId = result.sessionId;
        this.saveSessionInfo(sessionInfo);
      }
    }).catch(error => {
      ErrorLogger.error(error, 'SessionMonitoring.initSession.registerSession');
    });

    ErrorLogger.info('Session initialisée', 'SessionMonitoring', {
      metadata: {
        userId: user.uid,
        email: user.email,
        deviceHash: fingerprint.hash
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

      // Update Firestore session (debounced - only every 5 minutes)
      if (session.activityCount % 50 === 0) {
        this.updateSessionActivity().catch(() => {
          // Silent fail
        });
      }
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
      ErrorLogger.error(new Error('ANOMALIE CRITIQUE DE SESSION'), 'SessionMonitoring.recordAnomaly', {
        metadata: { anomaly }
      });
    }
  }

  /**
   * Nettoie la session
   */
  clearSession(): void {
    if (typeof window === 'undefined') return;

    // Unregister from Firestore
    this.unregisterSession().catch(() => {
      // Silent fail
    });

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
 *     SessionMonitor.initSession(user, organizationId);
 *   }
 * }, [user, organizationId]);
 */
export const useSessionMonitoring = (user: User | null, organizationId?: string) => {
  if (user) {
    SessionMonitor.initSession(user, organizationId);
  }

  return {
    monitor: SessionMonitor,
    recordActivity: () => SessionMonitor.recordActivity(),
    getMetrics: () => SessionMonitor.getMetrics(),
    getAnomalies: () => SessionMonitor.getAnomalies(),
    // New AAA methods
    getUserSessions: (userId: string) => SessionMonitor.getUserSessions(userId),
    terminateSession: (sessionId: string) => SessionMonitor.terminateSession(sessionId),
    terminateOtherSessions: (userId: string) => SessionMonitor.terminateOtherSessions(userId),
    configureSessionLimits: (config: Partial<SessionLimitConfig>) =>
      SessionMonitor.configureSessionLimits(config),
    generateDeviceFingerprint: () => SessionMonitor.generateDeviceFingerprint()
  };
};

// Export types
export type {
  SessionInfo,
  SessionAnomaly,
  SessionLimitConfig,
  DeviceFingerprint,
  ActiveSession
};
