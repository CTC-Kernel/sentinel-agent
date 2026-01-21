/**
 * Vendor Portal Service
 * Handles vendor self-service portal access, authentication, and questionnaire completion
 * Story 37-2: Vendor Self-Service Portal
 */

import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { sanitizeData } from '../utils/dataSanitizer';
import { ErrorLogger } from './errorLogger';
import {
  VendorPortalAccess,
  CreatePortalAccessInput,
  PortalAccessValidation,
  PortalAccessError,
  PortalActivityLog,
  PortalActivityType,
  QuestionAnswer,
  generateSecureToken,
  generateVerificationCode,
  isPortalAccessExpired,
} from '../types/vendorPortal';
import { EnhancedAssessmentResponse } from '../types/vendorAssessment';

// Collection names
const PORTAL_ACCESS_COLLECTION = 'portal_access';
const PORTAL_ACTIVITY_COLLECTION = 'portal_activity';
const ASSESSMENTS_COLLECTION = 'questionnaire_responses';

// Rate limiting constants
const MAX_ACCESS_ATTEMPTS_PER_HOUR = 10;
const VERIFICATION_CODE_EXPIRY_MINUTES = 15;

export class VendorPortalService {
  // ============================================================================
  // Portal Access Management
  // ============================================================================

  /**
   * Generate portal access for a vendor assessment
   */
  static async generatePortalAccess(input: CreatePortalAccessInput): Promise<VendorPortalAccess> {
    try {
      const token = generateSecureToken(48);
      const now = new Date().toISOString();

      const accessData: Omit<VendorPortalAccess, 'id'> = {
        assessmentId: input.assessmentId,
        organizationId: input.organizationId,
        organizationName: input.organizationName,
        templateId: input.templateId,
        supplierId: input.supplierId,
        vendorName: input.vendorName,
        vendorEmail: input.vendorEmail.toLowerCase(),
        token,
        status: 'active',
        createdAt: now,
        expiresAt: input.expiresAt,
        accessCount: 0,
        emailVerified: false,
      };

      const docRef = await addDoc(
        collection(db, PORTAL_ACCESS_COLLECTION),
        sanitizeData(accessData)
      );

      const access: VendorPortalAccess = {
        id: docRef.id,
        ...accessData,
      };

      // Log activity
      await this.logActivity({
        accessId: docRef.id,
        assessmentId: input.assessmentId,
        organizationId: input.organizationId,
        activityType: 'access_created',
        details: { vendorEmail: input.vendorEmail },
      });

      return access;
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.generatePortalAccess');
      throw error;
    }
  }

  /**
   * Validate a portal access token
   */
  static async validatePortalToken(token: string, ipAddress?: string): Promise<PortalAccessValidation> {
    try {
      // Find access by token
      const q = query(
        collection(db, PORTAL_ACCESS_COLLECTION),
        where('token', '==', token),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { valid: false, error: 'invalid_token' };
      }

      const doc = snapshot.docs[0];
      const access = { id: doc.id, ...doc.data() } as VendorPortalAccess;

      // Check rate limiting
      if (access.accessCount >= MAX_ACCESS_ATTEMPTS_PER_HOUR) {
        // Check if last access was within the hour
        if (access.lastAccessedAt) {
          const lastAccess = new Date(access.lastAccessedAt);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (lastAccess > hourAgo) {
            return { valid: false, error: 'rate_limited' };
          }
          // Reset count after an hour
          await updateDoc(doc.ref, { accessCount: 0 });
        }
      }

      // Check status
      switch (access.status) {
        case 'revoked':
          return { valid: false, error: 'access_revoked' };
        case 'expired':
          return { valid: false, error: 'expired_token' };
        case 'submitted':
          // Allow viewing but flag as submitted
          break;
        case 'active':
          // Check expiration
          if (isPortalAccessExpired(access)) {
            await this.expirePortalAccess(access.id);
            return { valid: false, error: 'expired_token' };
          }
          break;
      }

      // Update access tracking
      await updateDoc(doc.ref, sanitizeData({
        lastAccessedAt: new Date().toISOString(),
        lastAccessIp: ipAddress,
        accessCount: (access.accessCount || 0) + 1,
      }));

      // Log activity
      await this.logActivity({
        accessId: access.id,
        assessmentId: access.assessmentId,
        organizationId: access.organizationId,
        activityType: 'access_attempted',
        ipAddress,
      });

      // Check if email verification is required
      if (!access.emailVerified) {
        return { valid: true, access, error: 'verification_required' };
      }

      return { valid: true, access };
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.validatePortalToken');
      return { valid: false, error: 'invalid_token' };
    }
  }

  /**
   * Send email verification code
   */
  static async sendVerificationCode(accessId: string): Promise<string> {
    try {
      const docRef = doc(db, PORTAL_ACCESS_COLLECTION, accessId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Portal access not found');
      }

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

      // Store hashed code (in production, use proper hashing)
      // For simplicity, storing plain for now - in production use bcrypt
      await updateDoc(docRef, sanitizeData({
        verificationCodeHash: code, // Should be hashed in production
        verificationCodeExpiresAt: expiresAt,
      }));

      // In production, send email here via Cloud Function
      // For now, return code for testing
      return code;
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.sendVerificationCode');
      throw error;
    }
  }

  /**
   * Verify email code
   */
  static async verifyEmailCode(accessId: string, code: string): Promise<boolean> {
    try {
      const docRef = doc(db, PORTAL_ACCESS_COLLECTION, accessId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return false;
      }

      const access = docSnap.data() as VendorPortalAccess;

      // Check if code matches and hasn't expired
      if (!access.verificationCodeHash || !access.verificationCodeExpiresAt) {
        return false;
      }

      if (new Date(access.verificationCodeExpiresAt) < new Date()) {
        return false;
      }

      // In production, compare hashed values
      if (access.verificationCodeHash !== code) {
        return false;
      }

      // Mark as verified
      await updateDoc(docRef, sanitizeData({
        emailVerified: true,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
      }));

      // Log activity
      await this.logActivity({
        accessId,
        assessmentId: access.assessmentId,
        organizationId: access.organizationId,
        activityType: 'email_verified',
      });

      return true;
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.verifyEmailCode');
      return false;
    }
  }

  /**
   * Expire portal access
   */
  static async expirePortalAccess(accessId: string): Promise<void> {
    try {
      const docRef = doc(db, PORTAL_ACCESS_COLLECTION, accessId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return;

      const access = docSnap.data() as VendorPortalAccess;

      await updateDoc(docRef, sanitizeData({
        status: 'expired',
      }));

      // Log activity
      await this.logActivity({
        accessId,
        assessmentId: access.assessmentId,
        organizationId: access.organizationId,
        activityType: 'access_expired',
      });
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.expirePortalAccess');
      throw error;
    }
  }

  /**
   * Revoke portal access
   */
  static async revokePortalAccess(accessId: string, reason?: string): Promise<void> {
    try {
      const docRef = doc(db, PORTAL_ACCESS_COLLECTION, accessId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return;

      const access = docSnap.data() as VendorPortalAccess;

      await updateDoc(docRef, sanitizeData({
        status: 'revoked',
      }));

      // Log activity
      await this.logActivity({
        accessId,
        assessmentId: access.assessmentId,
        organizationId: access.organizationId,
        activityType: 'access_revoked',
        details: { reason },
      });
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.revokePortalAccess');
      throw error;
    }
  }

  /**
   * Get portal access by assessment ID
   */
  static async getPortalAccessByAssessment(assessmentId: string): Promise<VendorPortalAccess | null> {
    try {
      const q = query(
        collection(db, PORTAL_ACCESS_COLLECTION),
        where('assessmentId', '==', assessmentId),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as VendorPortalAccess;
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.getPortalAccessByAssessment');
      throw error;
    }
  }

  // ============================================================================
  // Questionnaire Management
  // ============================================================================

  /**
   * Get assessment for portal (scoped to specific access)
   */
  static async getPortalAssessment(accessId: string): Promise<EnhancedAssessmentResponse | null> {
    try {
      const accessDocRef = doc(db, PORTAL_ACCESS_COLLECTION, accessId);
      const accessSnap = await getDoc(accessDocRef);

      if (!accessSnap.exists()) return null;

      const access = accessSnap.data() as VendorPortalAccess;

      // Get the assessment
      const assessmentDocRef = doc(db, ASSESSMENTS_COLLECTION, access.assessmentId);
      const assessmentSnap = await getDoc(assessmentDocRef);

      if (!assessmentSnap.exists()) return null;

      // Log questionnaire view
      await this.logActivity({
        accessId,
        assessmentId: access.assessmentId,
        organizationId: access.organizationId,
        activityType: 'questionnaire_viewed',
      });

      return { id: assessmentSnap.id, ...assessmentSnap.data() } as EnhancedAssessmentResponse;
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.getPortalAssessment');
      throw error;
    }
  }

  /**
   * Save answer from portal
   */
  static async savePortalAnswer(
    accessId: string,
    questionId: string,
    answer: QuestionAnswer
  ): Promise<void> {
    try {
      // Verify access is valid and active
      const accessDocRef = doc(db, PORTAL_ACCESS_COLLECTION, accessId);
      const accessSnap = await getDoc(accessDocRef);

      if (!accessSnap.exists()) {
        throw new Error('Portal access not found');
      }

      const access = accessSnap.data() as VendorPortalAccess;

      if (access.status !== 'active') {
        throw new Error('Portal access is not active');
      }

      if (isPortalAccessExpired(access)) {
        throw new Error('Portal access has expired');
      }

      // Update assessment answers
      const assessmentDocRef = doc(db, ASSESSMENTS_COLLECTION, access.assessmentId);
      const assessmentSnap = await getDoc(assessmentDocRef);

      if (!assessmentSnap.exists()) {
        throw new Error('Assessment not found');
      }

      const assessment = assessmentSnap.data() as EnhancedAssessmentResponse;
      const answers = assessment.answers || {};

      answers[questionId] = {
        value: answer.value,
        comment: answer.comment,
        evidenceUrl: answer.evidenceUrl,
      };

      // Calculate completion percentage
      const totalQuestions = Object.keys(answers).length;

      await updateDoc(assessmentDocRef, sanitizeData({
        answers,
        status: assessment.status === 'Draft' ? 'In Progress' : assessment.status,
        completionPercentage: totalQuestions, // Will be recalculated properly
        updatedAt: serverTimestamp(),
      }));

      // Log activity
      await this.logActivity({
        accessId,
        assessmentId: access.assessmentId,
        organizationId: access.organizationId,
        activityType: 'answer_saved',
        details: { questionId },
      });
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.savePortalAnswer');
      throw error;
    }
  }

  /**
   * Submit questionnaire from portal
   */
  static async submitPortalQuestionnaire(accessId: string): Promise<void> {
    try {
      // Verify access
      const accessDocRef = doc(db, PORTAL_ACCESS_COLLECTION, accessId);
      const accessSnap = await getDoc(accessDocRef);

      if (!accessSnap.exists()) {
        throw new Error('Portal access not found');
      }

      const access = accessSnap.data() as VendorPortalAccess;

      if (access.status !== 'active') {
        throw new Error('Portal access is not active');
      }

      const now = new Date().toISOString();

      // Update assessment status
      const assessmentDocRef = doc(db, ASSESSMENTS_COLLECTION, access.assessmentId);
      await updateDoc(assessmentDocRef, sanitizeData({
        status: 'Submitted',
        submittedDate: now,
        updatedAt: serverTimestamp(),
      }));

      // Update portal access status
      await updateDoc(accessDocRef, sanitizeData({
        status: 'submitted',
        submittedAt: now,
      }));

      // Log activity
      await this.logActivity({
        accessId,
        assessmentId: access.assessmentId,
        organizationId: access.organizationId,
        activityType: 'questionnaire_submitted',
      });

      // Calculate and save score automatically
      try {
        const { VendorScoringService } = await import('./VendorScoringService');
        await VendorScoringService.calculateAndSaveScore(access.assessmentId);
      } catch (scoringError) {
        // Log but don't fail the submission
        ErrorLogger.warn('Scoring calculation failed', 'VendorPortalService.submitPortalQuestionnaire');
      }

      // TODO: Send notification to RSSI
      // TODO: Send confirmation email to vendor
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.submitPortalQuestionnaire');
      throw error;
    }
  }

  // ============================================================================
  // Activity Logging
  // ============================================================================

  /**
   * Log portal activity
   */
  private static async logActivity(params: {
    accessId: string;
    assessmentId: string;
    organizationId: string;
    activityType: PortalActivityType;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const log: Omit<PortalActivityLog, 'id'> = {
        accessId: params.accessId,
        assessmentId: params.assessmentId,
        organizationId: params.organizationId,
        activityType: params.activityType,
        timestamp: new Date().toISOString(),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: params.details,
      };

      await addDoc(collection(db, PORTAL_ACTIVITY_COLLECTION), sanitizeData(log));
    } catch (error) {
      // Don't throw for logging failures
      ErrorLogger.warn('Failed to log portal activity', 'VendorPortalService.logActivity');
    }
  }

  /**
   * Get activity log for an access
   */
  static async getActivityLog(accessId: string): Promise<PortalActivityLog[]> {
    try {
      const q = query(
        collection(db, PORTAL_ACTIVITY_COLLECTION),
        where('accessId', '==', accessId)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PortalActivityLog));
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.getActivityLog');
      throw error;
    }
  }

  // ============================================================================
  // Portal URL Generation
  // ============================================================================

  /**
   * Generate portal URL for vendor access
   */
  static getPortalUrl(token: string): string {
    // In production, use environment variable for base URL
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : 'https://app.sentinel-grc.com';
    return `${baseUrl}/vendor-portal/${token}`;
  }

  /**
   * Check and expire all outdated portal accesses
   * Called by scheduled Cloud Function
   */
  static async expireOutdatedAccesses(): Promise<number> {
    try {
      const now = new Date().toISOString();

      const q = query(
        collection(db, PORTAL_ACCESS_COLLECTION),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);
      let expiredCount = 0;

      for (const docSnap of snapshot.docs) {
        const access = docSnap.data() as VendorPortalAccess;
        if (new Date(access.expiresAt) < new Date(now)) {
          await this.expirePortalAccess(docSnap.id);
          expiredCount++;
        }
      }

      return expiredCount;
    } catch (error) {
      ErrorLogger.error(error, 'VendorPortalService.expireOutdatedAccesses');
      throw error;
    }
  }
}
