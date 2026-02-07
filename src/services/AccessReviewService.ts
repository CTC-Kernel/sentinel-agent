/**
 * Access Review Service
 *
 * Service for managing access review campaigns and dormant accounts.
 * Part of NIS2 Article 21.2(i) compliance.
 *
 * @module services/AccessReviewService
 */

import {
 collection,
 doc,
 getDocs,
 getDoc,
 addDoc,
 updateDoc,
 query,
 where,
 orderBy,
 onSnapshot,
 writeBatch,
 serverTimestamp,
 Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import type {
 AccessReviewCampaign,
 AccessReview,
 DormantAccount,
 AccessReviewStats,
 CampaignFormData,
 ReviewSubmission,
 CampaignStatus,
 ReviewStatus,
 DormantStatus,
} from '../types/accessReview';
import type { UserProfile } from '../types';

const CAMPAIGNS_COLLECTION = 'access_review_campaigns';
const REVIEWS_COLLECTION = 'access_reviews';
const DORMANT_COLLECTION = 'dormant_accounts';

export class AccessReviewService {
 // ============== CAMPAIGNS ==============

 /**
 * Get all campaigns for an organization
 */
 static async getCampaigns(organizationId: string): Promise<AccessReviewCampaign[]> {
 try {
 const q = query(
 collection(db, CAMPAIGNS_COLLECTION),
 where('organizationId', '==', organizationId),
 orderBy('createdAt', 'desc')
 );

 const snapshot = await getDocs(q);
 return snapshot.docs.map((doc) => ({
 id: doc.id,
 ...doc.data(),
 })) as AccessReviewCampaign[];
 } catch (error) {
 ErrorLogger.error(error, 'AccessReviewService.getCampaigns');
 throw error;
 }
 }

 /**
 * Subscribe to campaigns for real-time updates
 */
 static subscribeToCampaigns(
 organizationId: string,
 callback: (campaigns: AccessReviewCampaign[]) => void
 ): () => void {
 const q = query(
 collection(db, CAMPAIGNS_COLLECTION),
 where('organizationId', '==', organizationId),
 orderBy('createdAt', 'desc')
 );

 const unsubscribe = onSnapshot(
 q,
 (snapshot) => {
 const campaigns = snapshot.docs.map((doc) => ({
 id: doc.id,
 ...doc.data(),
 })) as AccessReviewCampaign[];
 callback(campaigns);
 },
 (error) => {
 ErrorLogger.error(error, 'AccessReviewService.subscribeToCampaigns');
 }
 );
 return unsubscribe;
 }

 /**
 * Create a new campaign
 */
 static async createCampaign(
 data: CampaignFormData,
 user: UserProfile
 ): Promise<string> {
 try {
 if (!user.organizationId) throw new Error('Organization ID required');

 const campaignData: Omit<AccessReviewCampaign, 'id'> = {
 ...data,
 organizationId: user.organizationId,
 status: 'draft',
 totalReviews: 0,
 completedReviews: 0,
 approvedCount: 0,
 revokedCount: 0,
 escalatedCount: 0,
 createdAt: serverTimestamp() as unknown as Timestamp,
 createdBy: user.uid,
 updatedAt: serverTimestamp() as unknown as Timestamp,
 updatedBy: user.uid,
 };

 const docRef = await addDoc(collection(db, CAMPAIGNS_COLLECTION), sanitizeData(campaignData));
 return docRef.id;
 } catch (error) {
 ErrorLogger.error(error, 'AccessReviewService.createCampaign');
 throw error;
 }
 }

 /**
 * Update campaign status
 */
 static async updateCampaignStatus(
 campaignId: string,
 status: CampaignStatus,
 user: UserProfile
 ): Promise<void> {
 try {
 const updateData: Record<string, unknown> = {
 status,
 updatedAt: serverTimestamp(),
 updatedBy: user.uid,
 };

 if (status === 'completed') {
 updateData.completedAt = serverTimestamp();
 }

 await updateDoc(doc(db, CAMPAIGNS_COLLECTION, campaignId), sanitizeData(updateData));
 } catch (error) {
 ErrorLogger.error(error, 'AccessReviewService.updateCampaignStatus');
 throw error;
 }
 }

 /**
 * Launch a campaign (create reviews for all users in scope)
 */
 static async launchCampaign(
 campaignId: string,
 users: UserProfile[],
 user: UserProfile
 ): Promise<number> {
 try {
 const BATCH_LIMIT = 450;
 let batch = writeBatch(db);
 let batchCount = 0;
 const campaignRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
 const campaign = (await getDoc(campaignRef)).data() as AccessReviewCampaign;

  if (!campaign) throw new Error('Campaign not found');

 let reviewCount = 0;

 for (const reviewedUser of users) {
 // Skip if user is their own manager
 if (reviewedUser.uid === user.uid) continue;

  const reviewData: Omit<AccessReview, 'id'> = {
 organizationId: campaign.organizationId,
 campaignId,
 userId: reviewedUser.uid,
 userName: reviewedUser.displayName || reviewedUser.email,
 userEmail: reviewedUser.email,
  userRole: reviewedUser.role || 'user',
 userDepartment: reviewedUser.department,
 reviewerId: user.uid,
 reviewerName: user.displayName || user.email,
 reviewerEmail: user.email,
 permissions: [], // Would be populated from actual permissions system
  status: 'pending',
 deadline: campaign.endDate,
 remindersSent: 0,
 createdAt: serverTimestamp() as unknown as Timestamp,
 updatedAt: serverTimestamp() as unknown as Timestamp,
 };

 const reviewRef = doc(collection(db, REVIEWS_COLLECTION));
 batch.set(reviewRef, sanitizeData(reviewData));
 reviewCount++;
 batchCount++;

 if (batchCount >= BATCH_LIMIT) {
  await batch.commit();
  batch = writeBatch(db);
  batchCount = 0;
 }
 }

 // Update campaign status and count
 batch.update(campaignRef, sanitizeData({
  status: 'active',
 totalReviews: reviewCount,
 updatedAt: serverTimestamp(),
 updatedBy: user.uid,
 }));

 await batch.commit();
 return reviewCount;
 } catch (error) {
 ErrorLogger.error(error, 'AccessReviewService.launchCampaign');
 throw error;
 }
 }

 // ============== REVIEWS ==============

 /**
 * Get reviews for a campaign
 */
 static async getReviewsByCampaign(campaignId: string): Promise<AccessReview[]> {
 try {
 const q = query(
 collection(db, REVIEWS_COLLECTION),
 where('campaignId', '==', campaignId),
 orderBy('userName', 'asc')
 );

 const snapshot = await getDocs(q);
 return snapshot.docs.map((doc) => ({
 id: doc.id,
 ...doc.data(),
 })) as AccessReview[];
 } catch (error) {
 ErrorLogger.error(error, 'AccessReviewService.getReviewsByCampaign');
 throw error;
 }
 }

 /**
 * Get reviews for a specific reviewer (manager)
 */
 static async getReviewsForReviewer(
 organizationId: string,
 reviewerId: string
 ): Promise<AccessReview[]> {
 try {
 const q = query(
 collection(db, REVIEWS_COLLECTION),
 where('organizationId', '==', organizationId),
 where('reviewerId', '==', reviewerId),
 where('status', '==', 'pending'),
 orderBy('deadline', 'asc')
 );

 const snapshot = await getDocs(q);
 return snapshot.docs.map((doc) => ({
 id: doc.id,
 ...doc.data(),
 })) as AccessReview[];
 } catch (error) {
 ErrorLogger.error(error, 'AccessReviewService.getReviewsForReviewer');
 throw error;
 }
 }

 /**
 * Submit a review decision
 */
 static async submitReview(
 submission: ReviewSubmission,
 user: UserProfile
 ): Promise<void> {
 try {
 const reviewRef = doc(db, REVIEWS_COLLECTION, submission.reviewId);
 const review = (await getDoc(reviewRef)).data() as AccessReview;

 if (!review) throw new Error('Review not found');

 // Determine new status based on decision
 let newStatus: ReviewStatus;
 switch (submission.decision) {
 case 'keep':
 newStatus = 'approved';
 break;
 case 'revoke':
 newStatus = 'revoked';
 break;
 case 'escalate':
 newStatus = 'escalated';
 break;
 default:
 throw new Error('Invalid decision');
 }

 // Update review
 await updateDoc(reviewRef, sanitizeData({
 status: newStatus,
 decision: submission.decision,
 justification: submission.justification,
 reviewedAt: serverTimestamp(),
 updatedAt: serverTimestamp(),
 }));

 // Update campaign counts
 const campaignRef = doc(db, CAMPAIGNS_COLLECTION, review.campaignId);
 const campaign = (await getDoc(campaignRef)).data() as AccessReviewCampaign;

 if (campaign) {
 const updates: Record<string, unknown> = {
 completedReviews: campaign.completedReviews + 1,
 updatedAt: serverTimestamp(),
 updatedBy: user.uid,
 };

 if (submission.decision === 'keep') {
 updates.approvedCount = campaign.approvedCount + 1;
 } else if (submission.decision === 'revoke') {
 updates.revokedCount = campaign.revokedCount + 1;
 } else if (submission.decision === 'escalate') {
 updates.escalatedCount = campaign.escalatedCount + 1;
 }

 // Check if campaign is complete
 if (campaign.completedReviews + 1 >= campaign.totalReviews) {
 updates.status = 'completed';
 updates.completedAt = serverTimestamp();
 }

      try {
 await updateDoc(campaignRef, sanitizeData(updates));
      } catch (error) {
        ErrorLogger.handleErrorWithToast(error, 'Erreur lors de la mise à jour de la campagne de revue');
        throw error;
      }
 }
 } catch (error) {
 ErrorLogger.error(error, 'AccessReviewService.submitReview');
 throw error;
 }
 }

 // ============== DORMANT ACCOUNTS ==============

 /**
 * Get dormant accounts for an organization
 */
 static async getDormantAccounts(organizationId: string): Promise<DormantAccount[]> {
 try {
 const q = query(
 collection(db, DORMANT_COLLECTION),
 where('organizationId', '==', organizationId),
 orderBy('daysSinceLastLogin', 'desc')
 );

 const snapshot = await getDocs(q);
 return snapshot.docs.map((doc) => ({
 id: doc.id,
 ...doc.data(),
 })) as DormantAccount[];
 } catch (error) {
 ErrorLogger.error(error, 'AccessReviewService.getDormantAccounts');
 throw error;
 }
 }

 /**
 * Subscribe to dormant accounts
 */
 static subscribeToDormantAccounts(
 organizationId: string,
 callback: (accounts: DormantAccount[]) => void
 ): () => void {
 const q = query(
 collection(db, DORMANT_COLLECTION),
 where('organizationId', '==', organizationId),
 orderBy('daysSinceLastLogin', 'desc')
 );

 const unsubscribe = onSnapshot(
 q,
 (snapshot) => {
 const accounts = snapshot.docs.map((doc) => ({
 id: doc.id,
 ...doc.data(),
 })) as DormantAccount[];
 callback(accounts);
 },
 (error) => {
 ErrorLogger.error(error, 'AccessReviewService.subscribeToDormantAccounts');
 }
 );
 return unsubscribe;
 }

 /**
 * Update dormant account status
 */
 static async updateDormantStatus(
 accountId: string,
 status: DormantStatus,
 reason: string,
 user: UserProfile
 ): Promise<void> {
 try {
 await updateDoc(doc(db, DORMANT_COLLECTION, accountId), sanitizeData({
 status,
 statusReason: reason,
 statusChangedAt: serverTimestamp(),
 statusChangedBy: user.uid,
 }));
 } catch (error) {
 ErrorLogger.error(error, 'AccessReviewService.updateDormantStatus');
 throw error;
 }
 }

 // ============== STATS ==============

 /**
 * Calculate access review statistics
 */
 static calculateStats(
 campaigns: AccessReviewCampaign[],
 reviews: AccessReview[],
 dormantAccounts: DormantAccount[]
 ): AccessReviewStats {
 const now = new Date();
 const activeCampaigns = campaigns.filter((c) => c.status === 'active');
 const pendingReviews = reviews.filter((r) => r.status === 'pending');
 const overdueReviews = pendingReviews.filter(
 (r) => r.deadline.toDate() < now
 );

 const completedCampaigns = campaigns.filter((c) => c.status === 'completed');
 const lastCompleted = completedCampaigns[0];

 let daysSinceLastCampaign = 999;
 if (lastCompleted?.completedAt) {
 daysSinceLastCampaign = Math.ceil(
 (now.getTime() - lastCompleted.completedAt.toDate().getTime()) /
 (1000 * 60 * 60 * 24)
 );
 }

 const totalCompleted = completedCampaigns.reduce(
 (sum, c) => sum + c.completedReviews,
 0
 );
 const totalReviews = completedCampaigns.reduce(
 (sum, c) => sum + c.totalReviews,
 0
 );
 const totalRevoked = completedCampaigns.reduce(
 (sum, c) => sum + c.revokedCount,
 0
 );

 const activeDormant = dormantAccounts.filter(
 (d) => d.status === 'detected' || d.status === 'contacted'
 );

 return {
 activeCampaigns: activeCampaigns.length,
 pendingReviews: pendingReviews.length,
 overdueReviews: overdueReviews.length,
 dormantAccounts: activeDormant.length,
 lastCampaignDate: lastCompleted?.completedAt,
 daysSinceLastCampaign,
 completionRate: totalReviews > 0 ? (totalCompleted / totalReviews) * 100 : 0,
 revocationRate: totalCompleted > 0 ? (totalRevoked / totalCompleted) * 100 : 0,
 };
 }

 // ============== CLOUD FUNCTIONS ==============

 /**
 * Trigger dormant account detection via Cloud Function
 * Returns statistics about detected dormant accounts
 */
 static async detectDormantAccounts(): Promise<{
 total: number;
 criticalCount: number;
 accounts: DormantAccount[];
 }> {
 try {
 const detectFn = httpsCallable<
 Record<string, never>,
 {
 success: boolean;
 total: number;
 criticalCount: number;
 accounts: DormantAccount[];
 }
 >(functions, 'detectDormantAccountsCallable');

 const result = await detectFn({});
 return {
 total: result.data.total,
 criticalCount: result.data.criticalCount,
 accounts: result.data.accounts,
 };
 } catch (error) {
 ErrorLogger.error(error, 'AccessReviewService.detectDormantAccounts');
 throw error;
 }
 }
}
