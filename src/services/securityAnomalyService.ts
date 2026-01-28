/**
 * Security Anomaly Detection Service
 *
 * AAA Enhancement: Detects security anomalies for authentication and authorization
 * - Failed login aggregation and alerts
 * - Brute force attack detection
 * - Insider threat pattern detection
 * - Account enumeration detection
 * - Privilege escalation monitoring
 *
 * @module securityAnomalyService
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';

// ============================================================================
// Types
// ============================================================================

export type SecurityAnomalyType =
  | 'brute_force'
  | 'account_enumeration'
  | 'privilege_escalation'
  | 'suspicious_activity'
  | 'mass_data_access'
  | 'off_hours_access'
  | 'failed_login_spike'
  | 'account_takeover_attempt'
  | 'lateral_movement';

export type SecurityAnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type SecurityAnomalyStatus = 'active' | 'investigating' | 'resolved' | 'false_positive';

export interface SecurityAnomaly {
  id?: string;
  /** Type of anomaly */
  type: SecurityAnomalyType;
  /** Severity level */
  severity: SecurityAnomalySeverity;
  /** Current status */
  status: SecurityAnomalyStatus;
  /** Organization context */
  organizationId: string;
  /** Affected user ID (if applicable) */
  affectedUserId?: string;
  /** Affected user email */
  affectedUserEmail?: string;
  /** Source IP address */
  sourceIp?: string;
  /** Detection message */
  message: string;
  /** Detailed description */
  description?: string;
  /** Detection timestamp */
  detectedAt: Timestamp;
  /** Resolution timestamp */
  resolvedAt?: Timestamp;
  /** Resolved by user ID */
  resolvedBy?: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Recommended actions */
  recommendedActions?: string[];
  /** Related event IDs */
  relatedEventIds?: string[];
}

export interface FailedLoginEvent {
  /** User email (attempted) */
  email: string;
  /** Source IP */
  ipAddress: string;
  /** User agent */
  userAgent?: string;
  /** Timestamp */
  timestamp: Timestamp;
  /** Failure reason */
  reason: 'invalid_password' | 'user_not_found' | 'account_disabled' | 'mfa_failed' | 'rate_limited' | 'unknown';
  /** Organization ID (if known) */
  organizationId?: string;
}

export interface SecurityConfig {
  /** Number of failed logins before alert (default: 5) */
  failedLoginThreshold: number;
  /** Time window for failed login aggregation in minutes (default: 15) */
  failedLoginWindowMinutes: number;
  /** Number of unique IPs attempting same account before alert (default: 3) */
  accountEnumerationThreshold: number;
  /** Off-hours start (24h format, default: 22) */
  offHoursStart: number;
  /** Off-hours end (24h format, default: 6) */
  offHoursEnd: number;
  /** Mass data access threshold (records per minute, default: 100) */
  massDataAccessThreshold: number;
  /** Enable email notifications */
  enableEmailNotifications: boolean;
  /** Admin email for notifications */
  adminEmail?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: SecurityConfig = {
  failedLoginThreshold: 5,
  failedLoginWindowMinutes: 15,
  accountEnumerationThreshold: 3,
  offHoursStart: 22,
  offHoursEnd: 6,
  massDataAccessThreshold: 100,
  enableEmailNotifications: true
};

// ============================================================================
// Security Anomaly Detection Service
// ============================================================================

class SecurityAnomalyDetectionService {
  private config: SecurityConfig = DEFAULT_CONFIG;

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Configure the security anomaly detection service
   */
  configure(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
    ErrorLogger.info('Security anomaly detection configured', 'SecurityAnomalyService', {
      metadata: config
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  // ============================================================================
  // Failed Login Detection
  // ============================================================================

  /**
   * Log a failed login attempt and check for anomalies
   */
  async logFailedLogin(event: Omit<FailedLoginEvent, 'timestamp'>): Promise<SecurityAnomaly | null> {
    try {
      const failedLoginRef = collection(db, 'security_failed_logins');

      // Store the failed login event
      await addDoc(failedLoginRef, {
        ...event,
        timestamp: serverTimestamp()
      });

      // Check for brute force attack on this account
      const bruteForceAnomaly = await this.checkBruteForce(event.email, event.organizationId);
      if (bruteForceAnomaly) {
        return bruteForceAnomaly;
      }

      // Check for account enumeration (multiple IPs trying same account)
      const enumerationAnomaly = await this.checkAccountEnumeration(event.email, event.organizationId);
      if (enumerationAnomaly) {
        return enumerationAnomaly;
      }

      // Check for distributed attack (same IP, multiple accounts)
      const distributedAnomaly = await this.checkDistributedAttack(event.ipAddress, event.organizationId);
      if (distributedAnomaly) {
        return distributedAnomaly;
      }

      return null;
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.logFailedLogin');
      return null;
    }
  }

  /**
   * Check for brute force attack pattern
   * Multiple failed logins for same account from same IP
   */
  private async checkBruteForce(
    email: string,
    organizationId?: string
  ): Promise<SecurityAnomaly | null> {
    try {
      const windowStart = new Date(
        Date.now() - this.config.failedLoginWindowMinutes * 60 * 1000
      );

      const failedLoginRef = collection(db, 'security_failed_logins');
      const q = query(
        failedLoginRef,
        where('email', '==', email),
        where('timestamp', '>=', Timestamp.fromDate(windowStart)),
        orderBy('timestamp', 'desc'),
        limit(20)
      );

      const snapshot = await getDocs(q);
      const failedAttempts = snapshot.docs.length;

      if (failedAttempts >= this.config.failedLoginThreshold) {
        // Group by IP to detect brute force
        const ipCounts: Record<string, number> = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          ipCounts[data.ipAddress] = (ipCounts[data.ipAddress] || 0) + 1;
        });

        // Find the IP with most attempts
        const maxIp = Object.entries(ipCounts).reduce(
          (max, [ip, count]) => count > max.count ? { ip, count } : max,
          { ip: '', count: 0 }
        );

        if (maxIp.count >= this.config.failedLoginThreshold) {
          const anomaly = await this.createAnomaly({
            type: 'brute_force',
            severity: 'critical',
            status: 'active',
            organizationId: organizationId || 'unknown',
            affectedUserEmail: email,
            sourceIp: maxIp.ip,
            message: `Attaque par force brute détectée: ${maxIp.count} tentatives échouées pour ${email}`,
            description: `Une attaque par force brute a été détectée sur le compte ${email}. ${maxIp.count} tentatives de connexion échouées ont été enregistrées depuis l'IP ${maxIp.ip} au cours des ${this.config.failedLoginWindowMinutes} dernières minutes.`,
            metadata: {
              failedAttempts: maxIp.count,
              windowMinutes: this.config.failedLoginWindowMinutes,
              ipAddress: maxIp.ip,
              allIps: Object.keys(ipCounts)
            },
            recommendedActions: [
              'Bloquer temporairement l\'IP source',
              'Vérifier si le compte est compromis',
              'Contacter l\'utilisateur pour vérification',
              'Activer MFA si non activé'
            ],
            relatedEventIds: snapshot.docs.map(d => d.id)
          });

          return anomaly;
        }
      }

      return null;
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.checkBruteForce');
      return null;
    }
  }

  /**
   * Check for account enumeration attack
   * Multiple different IPs trying the same account
   */
  private async checkAccountEnumeration(
    email: string,
    organizationId?: string
  ): Promise<SecurityAnomaly | null> {
    try {
      const windowStart = new Date(
        Date.now() - this.config.failedLoginWindowMinutes * 60 * 1000
      );

      const failedLoginRef = collection(db, 'security_failed_logins');
      const q = query(
        failedLoginRef,
        where('email', '==', email),
        where('timestamp', '>=', Timestamp.fromDate(windowStart)),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);

      // Get unique IPs
      const uniqueIps = new Set<string>();
      snapshot.docs.forEach(doc => {
        uniqueIps.add(doc.data().ipAddress);
      });

      if (uniqueIps.size >= this.config.accountEnumerationThreshold) {
        const anomaly = await this.createAnomaly({
          type: 'account_enumeration',
          severity: 'high',
          status: 'active',
          organizationId: organizationId || 'unknown',
          affectedUserEmail: email,
          message: `Tentative d'énumération de compte: ${uniqueIps.size} IPs différentes pour ${email}`,
          description: `Le compte ${email} a reçu des tentatives de connexion depuis ${uniqueIps.size} adresses IP différentes en ${this.config.failedLoginWindowMinutes} minutes. Cela peut indiquer une attaque coordonnée ou un botnet.`,
          metadata: {
            uniqueIpCount: uniqueIps.size,
            ips: Array.from(uniqueIps),
            totalAttempts: snapshot.docs.length
          },
          recommendedActions: [
            'Activer CAPTCHA pour ce compte',
            'Surveiller le compte pour activité suspecte',
            'Envisager le blocage temporaire du compte',
            'Analyser les logs pour patterns similaires'
          ]
        });

        return anomaly;
      }

      return null;
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.checkAccountEnumeration');
      return null;
    }
  }

  /**
   * Check for distributed attack
   * Same IP trying multiple accounts (credential stuffing)
   */
  private async checkDistributedAttack(
    ipAddress: string,
    organizationId?: string
  ): Promise<SecurityAnomaly | null> {
    try {
      const windowStart = new Date(
        Date.now() - this.config.failedLoginWindowMinutes * 60 * 1000
      );

      const failedLoginRef = collection(db, 'security_failed_logins');
      const q = query(
        failedLoginRef,
        where('ipAddress', '==', ipAddress),
        where('timestamp', '>=', Timestamp.fromDate(windowStart)),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);

      // Get unique emails targeted
      const targetedEmails = new Set<string>();
      snapshot.docs.forEach(doc => {
        targetedEmails.add(doc.data().email);
      });

      // Alert if more than 3 different accounts targeted from same IP
      if (targetedEmails.size >= 3) {
        const anomaly = await this.createAnomaly({
          type: 'account_takeover_attempt',
          severity: 'critical',
          status: 'active',
          organizationId: organizationId || 'unknown',
          sourceIp: ipAddress,
          message: `Credential stuffing détecté: ${targetedEmails.size} comptes ciblés depuis ${ipAddress}`,
          description: `L'adresse IP ${ipAddress} a tenté de se connecter à ${targetedEmails.size} comptes différents en ${this.config.failedLoginWindowMinutes} minutes. Cela indique une attaque de type credential stuffing.`,
          metadata: {
            targetedAccountCount: targetedEmails.size,
            totalAttempts: snapshot.docs.length,
            targetedEmails: Array.from(targetedEmails).slice(0, 10) // Limit for privacy
          },
          recommendedActions: [
            'Bloquer immédiatement l\'IP source',
            'Vérifier les comptes ciblés',
            'Forcer le changement de mot de passe pour les comptes affectés',
            'Analyser l\'origine de l\'IP (VPN, Tor, datacenter)'
          ]
        });

        return anomaly;
      }

      return null;
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.checkDistributedAttack');
      return null;
    }
  }

  // ============================================================================
  // Insider Threat Detection
  // ============================================================================

  /**
   * Log data access and check for mass data access
   */
  async logDataAccess(
    userId: string,
    userEmail: string,
    organizationId: string,
    entityType: string,
    accessCount: number,
    ipAddress?: string
  ): Promise<SecurityAnomaly | null> {
    try {
      // Check for mass data access (data exfiltration pattern)
      if (accessCount >= this.config.massDataAccessThreshold) {
        return await this.createAnomaly({
          type: 'mass_data_access',
          severity: 'high',
          status: 'active',
          organizationId,
          affectedUserId: userId,
          affectedUserEmail: userEmail,
          sourceIp: ipAddress,
          message: `Accès de masse détecté: ${accessCount} ${entityType} accédés par ${userEmail}`,
          description: `L'utilisateur ${userEmail} a accédé à ${accessCount} enregistrements de type ${entityType} en une seule requête. Cela peut indiquer une tentative d'exfiltration de données.`,
          metadata: {
            entityType,
            accessCount,
            threshold: this.config.massDataAccessThreshold
          },
          recommendedActions: [
            'Vérifier avec l\'utilisateur la légitimité de l\'accès',
            'Examiner les exports récents de cet utilisateur',
            'Vérifier les permissions d\'accès',
            'Activer une surveillance renforcée'
          ]
        });
      }

      return null;
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.logDataAccess');
      return null;
    }
  }

  /**
   * Check for off-hours access
   */
  async checkOffHoursAccess(
    userId: string,
    userEmail: string,
    organizationId: string,
    ipAddress?: string,
    timezone: string = 'Europe/Paris'
  ): Promise<SecurityAnomaly | null> {
    try {
      const now = new Date();
      const hour = parseInt(
        new Intl.DateTimeFormat('fr-FR', {
          hour: 'numeric',
          hour12: false,
          timeZone: timezone
        }).format(now)
      );

      const isOffHours =
        hour >= this.config.offHoursStart ||
        hour < this.config.offHoursEnd;

      if (isOffHours) {
        return await this.createAnomaly({
          type: 'off_hours_access',
          severity: 'medium',
          status: 'active',
          organizationId,
          affectedUserId: userId,
          affectedUserEmail: userEmail,
          sourceIp: ipAddress,
          message: `Accès hors heures de bureau détecté: ${userEmail} à ${hour}h`,
          description: `L'utilisateur ${userEmail} s'est connecté à ${hour}:00 (heure locale), en dehors des heures normales de travail (${this.config.offHoursEnd}h-${this.config.offHoursStart}h).`,
          metadata: {
            accessHour: hour,
            timezone,
            offHoursRange: `${this.config.offHoursStart}h-${this.config.offHoursEnd}h`
          },
          recommendedActions: [
            'Vérifier si l\'accès est attendu (astreinte, voyage)',
            'Confirmer l\'identité de l\'utilisateur',
            'Surveiller les actions de la session'
          ]
        });
      }

      return null;
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.checkOffHoursAccess');
      return null;
    }
  }

  /**
   * Detect privilege escalation attempts
   */
  async detectPrivilegeEscalation(
    userId: string,
    userEmail: string,
    organizationId: string,
    attemptedAction: string,
    requiredRole: string,
    actualRole: string
  ): Promise<SecurityAnomaly | null> {
    try {
      return await this.createAnomaly({
        type: 'privilege_escalation',
        severity: 'critical',
        status: 'active',
        organizationId,
        affectedUserId: userId,
        affectedUserEmail: userEmail,
        message: `Tentative d'escalade de privilèges: ${userEmail} (${actualRole}) a tenté ${attemptedAction}`,
        description: `L'utilisateur ${userEmail} avec le rôle "${actualRole}" a tenté d'effectuer l'action "${attemptedAction}" qui nécessite le rôle "${requiredRole}".`,
        metadata: {
          attemptedAction,
          requiredRole,
          actualRole
        },
        recommendedActions: [
          'Investiguer la raison de la tentative',
          'Vérifier si les permissions sont correctement configurées',
          'Examiner l\'historique des actions de l\'utilisateur',
          'Envisager une suspension temporaire si récurrent'
        ]
      });
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.detectPrivilegeEscalation');
      return null;
    }
  }

  // ============================================================================
  // Anomaly Management
  // ============================================================================

  /**
   * Create and store a security anomaly
   */
  private async createAnomaly(
    anomaly: Omit<SecurityAnomaly, 'id' | 'detectedAt'>
  ): Promise<SecurityAnomaly> {
    try {
      const anomalyRef = collection(db, 'security_anomalies');

      const fullAnomaly = {
        ...anomaly,
        detectedAt: serverTimestamp()
      };

      const docRef = await addDoc(anomalyRef, fullAnomaly);

      ErrorLogger.warn(`Security anomaly detected: ${anomaly.type}`, 'SecurityAnomalyService', {
        metadata: {
          type: anomaly.type,
          severity: anomaly.severity,
          message: anomaly.message
        }
      });

      // TODO: Send notification if critical
      if (anomaly.severity === 'critical' && this.config.enableEmailNotifications) {
        // Implement email notification
        // await this.sendAnomalyNotification(anomaly);
      }

      return {
        id: docRef.id,
        ...fullAnomaly,
        detectedAt: Timestamp.now()
      } as SecurityAnomaly;
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.createAnomaly');
      throw error;
    }
  }

  /**
   * Get anomalies for an organization
   */
  async getAnomalies(
    organizationId: string,
    filters?: {
      type?: SecurityAnomalyType;
      severity?: SecurityAnomalySeverity;
      status?: SecurityAnomalyStatus;
      limit?: number;
    }
  ): Promise<SecurityAnomaly[]> {
    try {
      const anomalyRef = collection(db, 'security_anomalies');

      let q = query(
        anomalyRef,
        where('organizationId', '==', organizationId),
        orderBy('detectedAt', 'desc'),
        limit(filters?.limit || 100)
      );

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      const snapshot = await getDocs(q);

      let anomalies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SecurityAnomaly[];

      // Client-side filtering for type and severity (Firestore limitation)
      if (filters?.type) {
        anomalies = anomalies.filter(a => a.type === filters.type);
      }
      if (filters?.severity) {
        anomalies = anomalies.filter(a => a.severity === filters.severity);
      }

      return anomalies;
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.getAnomalies');
      return [];
    }
  }

  /**
   * Update anomaly status
   */
  async updateAnomalyStatus(
    anomalyId: string,
    status: SecurityAnomalyStatus,
    resolvedBy?: string
  ): Promise<boolean> {
    try {
      const { setDoc } = await import('firebase/firestore');
      const anomalyRef = doc(db, 'security_anomalies', anomalyId);

      const updateData: Record<string, unknown> = {
        status
      };

      if (status === 'resolved' || status === 'false_positive') {
        updateData.resolvedAt = serverTimestamp();
        if (resolvedBy) {
          updateData.resolvedBy = resolvedBy;
        }
      }

      await setDoc(anomalyRef, updateData, { merge: true });

      ErrorLogger.info(`Anomaly ${anomalyId} updated to ${status}`, 'SecurityAnomalyService');

      return true;
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.updateAnomalyStatus');
      return false;
    }
  }

  /**
   * Get anomaly statistics for dashboard
   */
  async getStatistics(organizationId: string): Promise<{
    total: number;
    byType: Record<SecurityAnomalyType, number>;
    bySeverity: Record<SecurityAnomalySeverity, number>;
    activeCount: number;
    resolvedLast24h: number;
  }> {
    try {
      const anomalies = await this.getAnomalies(organizationId, { limit: 1000 });

      const stats = {
        total: anomalies.length,
        byType: {} as Record<SecurityAnomalyType, number>,
        bySeverity: {} as Record<SecurityAnomalySeverity, number>,
        activeCount: 0,
        resolvedLast24h: 0
      };

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      anomalies.forEach(anomaly => {
        // By type
        stats.byType[anomaly.type] = (stats.byType[anomaly.type] || 0) + 1;

        // By severity
        stats.bySeverity[anomaly.severity] = (stats.bySeverity[anomaly.severity] || 0) + 1;

        // Active count
        if (anomaly.status === 'active' || anomaly.status === 'investigating') {
          stats.activeCount++;
        }

        // Resolved last 24h
        if (anomaly.resolvedAt && anomaly.resolvedAt.toMillis() > oneDayAgo) {
          stats.resolvedLast24h++;
        }
      });

      return stats;
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.getStatistics');
      return {
        total: 0,
        byType: {} as Record<SecurityAnomalyType, number>,
        bySeverity: {} as Record<SecurityAnomalySeverity, number>,
        activeCount: 0,
        resolvedLast24h: 0
      };
    }
  }

  /**
   * Cleanup old failed login records (older than 30 days)
   */
  async cleanupOldRecords(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const failedLoginRef = collection(db, 'security_failed_logins');
      const q = query(
        failedLoginRef,
        where('timestamp', '<', Timestamp.fromDate(thirtyDaysAgo)),
        limit(500)
      );

      const snapshot = await getDocs(q);
      let deleted = 0;

      for (const docSnapshot of snapshot.docs) {
        await deleteDoc(docSnapshot.ref);
        deleted++;
      }

      if (deleted > 0) {
        ErrorLogger.info(`Cleaned up ${deleted} old failed login records`, 'SecurityAnomalyService');
      }

      return deleted;
    } catch (error) {
      ErrorLogger.error(error, 'SecurityAnomalyService.cleanupOldRecords');
      return 0;
    }
  }
}

// Export singleton
export const SecurityAnomalyService = new SecurityAnomalyDetectionService();

