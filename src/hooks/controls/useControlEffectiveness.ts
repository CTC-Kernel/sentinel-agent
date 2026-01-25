/**
 * useControlEffectiveness Hook (ISO 27002)
 * Manages control effectiveness assessments and domain maturity calculations
 */

import { useCallback, useMemo } from 'react';
import { Timestamp, serverTimestamp } from 'firebase/firestore';
import { useStore } from '../../store';
import type { ControlEffectivenessAssessment, DomainMaturityScore } from '../../types/ebios';
import { ISO_DOMAINS } from '../../data/complianceData';
import { useFirestoreCollection } from '../useFirestore';

// ISO 27002 Domain maturity level thresholds
export const MATURITY_THRESHOLDS = {
  1: { min: 0, max: 20, label: 'Initial', description: 'Pratiques ad-hoc, non formalisées' },
  2: { min: 20, max: 40, label: 'Géré', description: 'Processus documentés mais non systématiques' },
  3: { min: 40, max: 60, label: 'Défini', description: 'Processus standardisés et systématiques' },
  4: { min: 60, max: 80, label: 'Mesuré', description: 'Mesure et amélioration continue' },
  5: { min: 80, max: 100, label: 'Optimisé', description: 'Amélioration continue et excellence' },
} as const;

export interface ControlAssessmentInput {
  controlId: string;
  controlCode: string;
  effectivenessScore: number;
  assessmentMethod: string;
  evidence?: string[];
  notes?: string;
  nextAssessmentDate?: string;
}

export interface UseControlEffectivenessReturn {
  assessments: ControlEffectivenessAssessment[];
  domainScores: DomainMaturityScore[];
  loading: boolean;
  error: string | null;

  // CRUD operations
  createAssessment: (data: ControlAssessmentInput) => Promise<ControlEffectivenessAssessment | null>;
  updateAssessment: (id: string, data: Partial<ControlAssessmentInput>) => Promise<void>;
  deleteAssessment: (id: string) => Promise<void>;

  // Query operations
  getAssessmentsByControl: (controlId: string) => ControlEffectivenessAssessment[];
  getAssessmentsByDomain: (domain: string) => ControlEffectivenessAssessment[];
  getLatestAssessment: (controlId: string) => ControlEffectivenessAssessment | undefined;

  // Metrics
  getOverallMaturity: () => { score: number; level: 1 | 2 | 3 | 4 | 5 };
  getLowEffectivenessControls: (threshold?: number) => ControlEffectivenessAssessment[];
  getAssessmentsDueForReview: () => ControlEffectivenessAssessment[];

  // Refresh
  refreshAssessments: () => Promise<void>;
}

// Extract domain from control code (e.g., "A.5.1" -> "A.5")
function extractDomain(controlCode: string): string {
  const parts = controlCode.split('.');
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  return controlCode;
}

// Calculate maturity level from effectiveness score
function calculateMaturityLevel(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 80) return 5;
  if (score >= 60) return 4;
  if (score >= 40) return 3;
  if (score >= 20) return 2;
  return 1;
}

export function useControlEffectiveness(): UseControlEffectivenessReturn {
  const { user } = useStore();
  const organizationId = user?.organizationId;
  const uid = user?.uid;

  const path = organizationId ? `organizations/${organizationId}/controlAssessments` : '';

  const {
    data: assessmentsRaw,
    loading,
    error: firestoreError,
    add: addAssessmentDoc,
    update: updateAssessmentDoc,
    remove: removeAssessmentDoc,
    refresh
  } = useFirestoreCollection<ControlEffectivenessAssessment>(
    path,
    undefined, // No query constraints needed for the whole subcollection
    { enabled: !!organizationId, realtime: true, logError: true }
  );

  const error = firestoreError ? firestoreError.message : null;
  const assessments = assessmentsRaw || [];

  // Calculate domain maturity scores
  const domainScores = useMemo((): DomainMaturityScore[] => {
    if (assessments.length === 0) return [];

    // Group assessments by domain
    const domainMap = new Map<string, ControlEffectivenessAssessment[]>();

    assessments.forEach(assessment => {
      const domain = extractDomain(assessment.controlId);
      if (!domainMap.has(domain)) {
        domainMap.set(domain, []);
      }
      domainMap.get(domain)!.push(assessment);
    });

    return ISO_DOMAINS.map(isoDomain => {
      const domainAssessments = domainMap.get(isoDomain.id) || [];
      const assessedCount = domainAssessments.length;
      const totalScore = domainAssessments.reduce((sum, a) => sum + a.effectivenessScore, 0);
      const averageEffectiveness = assessedCount > 0 ? Math.round(totalScore / assessedCount) : 0;

      return {
        domain: isoDomain.id,
        domainName: isoDomain.title,
        controlCount: 0,
        assessedCount,
        averageEffectiveness,
        maturityLevel: calculateMaturityLevel(averageEffectiveness)
      };
    }).filter(ds => ds.assessedCount > 0);
  }, [assessments]);

  // Create
  const createAssessment = useCallback(async (data: ControlAssessmentInput): Promise<ControlEffectivenessAssessment | null> => {
    if (!organizationId || !uid) return null;

    try {
      // NOTE: useFirestoreCollection.add uses addDoc (auto-id).

      const now = new Date().toISOString();
      // We manually construct the object to satisfy TypeScript, as addAssessmentDoc handles the DB write.
      // But notice addAssessmentDoc signature usually takes Omit<T, 'id'>.

      const assessmentData = {
        controlId: data.controlCode, // Using code as ID link
        // organizationId, // Not needed in data if in subcollection? Logic usually keeps it.
        organizationId: organizationId,
        effectivenessScore: data.effectivenessScore,
        assessmentDate: now,
        assessmentMethod: data.assessmentMethod,
        assessedBy: uid,
        evidence: data.evidence || [],
        notes: data.notes || '',
        nextAssessmentDate: data.nextAssessmentDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const newId = await addAssessmentDoc(assessmentData as unknown as ControlEffectivenessAssessment);

      if (newId) {
        return { ...assessmentData, id: newId } as unknown as ControlEffectivenessAssessment;
      }
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [addAssessmentDoc, organizationId, uid]);

  // Update
  const updateAssessment = useCallback(async (id: string, data: Partial<ControlAssessmentInput>): Promise<void> => {
    if (!updateAssessmentDoc || !uid) return;
    await updateAssessmentDoc(id, {
      ...data,
      updatedBy: uid,
      updatedAt: serverTimestamp()
    } as unknown as Partial<ControlEffectivenessAssessment>);
  }, [updateAssessmentDoc, uid]);

  // Delete
  const deleteAssessment = useCallback(async (id: string): Promise<void> => {
    if (!removeAssessmentDoc) return;
    await removeAssessmentDoc(id);
  }, [removeAssessmentDoc]);


  // Helper functions
  const getAssessmentsByControl = useCallback((controlId: string): ControlEffectivenessAssessment[] => {
    return assessments.filter(a => a.controlId === controlId);
  }, [assessments]);

  const getAssessmentsByDomain = useCallback((domain: string): ControlEffectivenessAssessment[] => {
    return assessments.filter(a => extractDomain(a.controlId) === domain);
  }, [assessments]);

  const getLatestAssessment = useCallback((controlId: string): ControlEffectivenessAssessment | undefined => {
    const controlAssessments = getAssessmentsByControl(controlId);
    if (controlAssessments.length === 0) return undefined;

    return controlAssessments.sort((a, b) =>
      new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime()
    )[0];
  }, [getAssessmentsByControl]);

  const getOverallMaturity = useCallback((): { score: number; level: 1 | 2 | 3 | 4 | 5 } => {
    if (assessments.length === 0) {
      return { score: 0, level: 1 };
    }
    const totalScore = assessments.reduce((sum, a) => sum + a.effectivenessScore, 0);
    const averageScore = Math.round(totalScore / assessments.length);
    return {
      score: averageScore,
      level: calculateMaturityLevel(averageScore)
    };
  }, [assessments]);

  const getLowEffectivenessControls = useCallback((threshold = 40): ControlEffectivenessAssessment[] => {
    return assessments.filter(a => a.effectivenessScore < threshold);
  }, [assessments]);

  const getAssessmentsDueForReview = useCallback((): ControlEffectivenessAssessment[] => {
    const now = new Date();
    return assessments.filter(a => {
      if (!a.nextAssessmentDate) return false;
      return new Date(a.nextAssessmentDate) <= now;
    });
  }, [assessments]);


  return {
    assessments,
    domainScores,
    loading,
    error,
    createAssessment,
    updateAssessment,
    deleteAssessment,
    getAssessmentsByControl,
    getAssessmentsByDomain,
    getLatestAssessment,
    getOverallMaturity,
    getLowEffectivenessControls,
    getAssessmentsDueForReview,
    refreshAssessments: refresh
  };
}

export default useControlEffectiveness;
