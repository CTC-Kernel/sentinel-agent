/**
 * Score Service - Frontend service for compliance score operations
 * Implements ADR-003: Score de Conformité Global (Apple Health Style)
 */

import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { COMPLIANCE_WEIGHTS, TREND_THRESHOLD } from '../constants/complianceConfig';
import type {
  GlobalComplianceScore as ComplianceScore,
  GlobalScoreHistory as ScoreHistory,
  ScoreBreakdown,
  TrendType,
} from '../types/score.types';

/**
 * Service for fetching and subscribing to compliance scores
 * Scores are cached in Firestore and updated by Cloud Functions
 */
export class ScoreService {
  /**
   * Get the current compliance score for an organization
   * Fetches from: organizations/{organizationId}/complianceScores/current
   *
   * @param organizationId - The organization ID
   * @returns The current compliance score or null if not calculated yet
   */
  static async getComplianceScore(organizationId: string): Promise<ComplianceScore | null> {
    try {
      const scoreRef = doc(db, 'organizations', organizationId, 'complianceScores', 'current');
      const scoreSnap = await getDoc(scoreRef);

      if (!scoreSnap.exists()) {
        return null;
      }

      const data = scoreSnap.data();
      return {
        global: data.global ?? 0,
        byFramework: data.byFramework ?? {
          iso27001: 0,
          nis2: 0,
          dora: 0,
          rgpd: 0,
        },
        trend: data.trend ?? 'stable',
        lastCalculated: data.lastCalculated?.toDate?.() ?? data.lastCalculated ?? new Date().toISOString(),
        breakdown: data.breakdown ?? {
          risks: { score: 0, weight: COMPLIANCE_WEIGHTS.risks },
          controls: { score: 0, weight: COMPLIANCE_WEIGHTS.controls },
          documents: { score: 0, weight: COMPLIANCE_WEIGHTS.documents },
          audits: { score: 0, weight: COMPLIANCE_WEIGHTS.audits },
          training: { score: 0, weight: COMPLIANCE_WEIGHTS.training },
        },
        calculationDetails: data.calculationDetails,
      } as ComplianceScore;
    } catch (error) {
      ErrorLogger.error(error, 'ScoreService.getComplianceScore', {
        component: 'ScoreService',
        action: 'getComplianceScore',
        organizationId,
      });
      throw error;
    }
  }

  /**
   * Get historical compliance scores for trend charting
   * Fetches from: organizations/{organizationId}/complianceScores/history/*
   *
   * @param organizationId - The organization ID
   * @param days - Number of days of history to fetch (default: 30)
   * @returns Array of historical score entries, sorted by date ascending
   */
  static async getScoreHistory(organizationId: string, days: number = 30): Promise<ScoreHistory[]> {
    try {
      const historyRef = collection(db, 'organizations', organizationId, 'complianceScores', 'current', 'history');
      const historyQuery = query(
        historyRef,
        orderBy('date', 'desc'),
        limit(days)
      );

      const historySnap = await getDocs(historyQuery);
      const history: ScoreHistory[] = [];

      if (historySnap && typeof historySnap.forEach === 'function') {
        historySnap.forEach((docSnap) => {
          const data = docSnap.data();
          history.push({
            date: docSnap.id, // Document ID is the date (YYYY-MM-DD)
            global: data.global ?? 0,
            byFramework: data.byFramework,
            breakdown: data.breakdown,
          });
        });
      }

      // Sort ascending by date for charting
      return history.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      ErrorLogger.error(error, 'ScoreService.getScoreHistory', {
        component: 'ScoreService',
        action: 'getScoreHistory',
        organizationId,
        metadata: { days },
      });
      // Return empty array on error to prevent UI crash
      return [];
    }
  }

  /**
   * Subscribe to real-time score updates
   * Uses Firestore onSnapshot for live dashboard updates
   *
   * @param organizationId - The organization ID
   * @param callback - Function called with updated score data
   * @returns Unsubscribe function to stop listening
   */
  static subscribeToScore(
    organizationId: string,
    callback: (score: ComplianceScore | null, error?: Error) => void
  ): Unsubscribe {
    const scoreRef = doc(db, 'organizations', organizationId, 'complianceScores', 'current');

    return onSnapshot(
      scoreRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null);
          return;
        }

        const data = snapshot.data();
        const score: ComplianceScore = {
          global: data.global ?? 0,
          byFramework: data.byFramework ?? {
            iso27001: 0,
            nis2: 0,
            dora: 0,
            rgpd: 0,
          },
          trend: data.trend ?? 'stable',
          lastCalculated: data.lastCalculated?.toDate?.() ?? data.lastCalculated ?? new Date().toISOString(),
          breakdown: data.breakdown ?? {
            risks: { score: 0, weight: COMPLIANCE_WEIGHTS.risks },
            controls: { score: 0, weight: COMPLIANCE_WEIGHTS.controls },
            documents: { score: 0, weight: COMPLIANCE_WEIGHTS.documents },
            audits: { score: 0, weight: COMPLIANCE_WEIGHTS.audits },
            training: { score: 0, weight: COMPLIANCE_WEIGHTS.training },
          },
          calculationDetails: data.calculationDetails,
        };

        callback(score);
      },
      (error) => {
        ErrorLogger.error(error, 'ScoreService.subscribeToScore', {
          component: 'ScoreService',
          action: 'subscribeToScore',
          organizationId,
        });
        callback(null, error);
      }
    );
  }

  /**
   * Calculate trend from history data
   * Up if current > 30-day avg + 5%, Down if < avg - 5%, else Stable
   *
   * @param currentScore - Current global score
   * @param history - Historical scores
   * @returns Trend direction
   */
  static calculateTrend(currentScore: number, history: ScoreHistory[]): TrendType {
    if (history.length === 0) {
      return 'stable';
    }

    const sum = history.reduce((acc, h) => acc + h.global, 0);
    const avg = sum / history.length;
    const diff = currentScore - avg;

    if (diff > TREND_THRESHOLD) return 'up';
    if (diff < -TREND_THRESHOLD) return 'down';
    return 'stable';
  }

  /**
   * Calculate global score from breakdown
   * Uses weighted average: controls 35%, risks 25%, audits 20%, docs 10%, training 10%
   *
   * @param breakdown - Score breakdown by category
   * @returns Global score (0-100)
   */
  static calculateGlobalScore(breakdown: ScoreBreakdown): number {
    const trainingComponent = breakdown.training
      ? breakdown.training.score * breakdown.training.weight
      : 0;

    const global =
      breakdown.controls.score * breakdown.controls.weight +
      breakdown.risks.score * breakdown.risks.weight +
      breakdown.audits.score * breakdown.audits.weight +
      breakdown.documents.score * breakdown.documents.weight +
      trainingComponent;

    // Ensure score is within 0-100 range
    return Math.max(0, Math.min(100, Math.round(global * 100) / 100));
  }
}
