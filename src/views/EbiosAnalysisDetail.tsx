/**
 * EBIOS Analysis Detail View
 * Detail page with wizard for managing a specific EBIOS RM analysis
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { useAutoSave } from '../hooks/useAutoSave';
import { EbiosWizard } from '../components/ebios/EbiosWizard';
import { Workshop1Content } from '../components/ebios/workshops/Workshop1Content';
import { Workshop2Content } from '../components/ebios/workshops/Workshop2Content';
import { Workshop3Content } from '../components/ebios/workshops/Workshop3Content';
import { Workshop4Content, CreateRiskFromEbiosData } from '../components/ebios/workshops/Workshop4Content';
import { Workshop5Content } from '../components/ebios/workshops/Workshop5Content';
import { EbiosService } from '../services/ebiosService';
import { ErrorLogger } from '../services/errorLogger';
import { toast } from '@/lib/toast';
import { db } from '../firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { sanitizeData } from '../utils/dataSanitizer';
import { hasPermission } from '../utils/permissions';
import { RISK_ACCEPTANCE_THRESHOLD } from '../constants/RiskConstants';
import type {
 EbiosAnalysis,
 EbiosWorkshopNumber,
 Workshop1Data,
 Workshop2Data,
 Workshop3Data,
 Workshop4Data,
 Workshop5Data,
} from '../types/ebios';

export const EbiosAnalysisDetail: React.FC = () => {
 const { id } = useParams<{ id: string }>();
 const { t } = useStore();
 const { user } = useAuth();
 const organizationId = user?.organizationId;
 const navigate = useNavigate();

 // State
 const [analysis, setAnalysis] = useState<EbiosAnalysis | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
 const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

 // Track changes for auto-save
 type WorkshopDataType = Workshop1Data | Workshop2Data | Workshop3Data | Workshop4Data | Workshop5Data;
 const [pendingChanges, setPendingChanges] = useState<{
 workshopNumber: EbiosWorkshopNumber;
 data: Partial<WorkshopDataType>;
 } | null>(null);

 // Fetch analysis
 useEffect(() => {
 const fetchAnalysis = async () => {
 if (!organizationId || !id) return;

 try {
 setLoading(true);
 const data = await EbiosService.getAnalysis(organizationId, id);
 if (data) {
 setAnalysis(data);
 } else {
 toast.error(t('ebios.errors.notFound'));
 navigate('/ebios');
 }
 } catch (error) {
 ErrorLogger.error(error, 'EbiosAnalysisDetail.fetchAnalysis');
 toast.error(t('ebios.errors.fetchFailed'));
 navigate('/ebios');
 } finally {
 setLoading(false);
 }
 };

 fetchAnalysis();
 }, [organizationId, id, t, navigate]);

 // Auto-save functionality
 const saveChanges = useCallback(async () => {
 if (!pendingChanges || !analysis || !organizationId || !user?.uid) return;

 try {
 setSaving(true);
 await EbiosService.saveWorkshopData(
 organizationId,
 analysis.id,
 pendingChanges.workshopNumber,
 pendingChanges.data,
 user.uid
 );
 setHasUnsavedChanges(false);
 setPendingChanges(null);
 } catch (error) {
 ErrorLogger.error(error, 'EbiosAnalysisDetail.saveChanges');
 toast.error(t('ebios.errors.saveFailed'));
 } finally {
 setSaving(false);
 }
 }, [pendingChanges, analysis, organizationId, user?.uid, t]);

 // Use auto-save hook
 useAutoSave({
 data: pendingChanges,
 onSave: saveChanges,
 enabled: hasUnsavedChanges,
 debounceMs: 2000,
 });

 // Workshop change handler
 const handleWorkshopChange = useCallback(async (workshopNumber: EbiosWorkshopNumber) => {
 if (!analysis || !organizationId || !user?.uid) return;

 // Save any pending changes first
 if (hasUnsavedChanges && pendingChanges) {
 await saveChanges();
 }

 try {
 await EbiosService.navigateToWorkshop(
 organizationId,
 analysis.id,
 workshopNumber,
 user.uid
 );
 setAnalysis((prev) => prev ? { ...prev, currentWorkshop: workshopNumber } : null);
 } catch (error) {
 ErrorLogger.error(error, 'EbiosAnalysisDetail.handleWorkshopChange');
 toast.error(t('ebios.errors.workshopChangeFailed'));
 }
 }, [analysis, organizationId, user?.uid, hasUnsavedChanges, pendingChanges, saveChanges, t]);

 // Workshop data change handlers
 const handleWorkshop1DataChange = useCallback((data: Partial<Workshop1Data>) => {
 if (!analysis) return;

 const updatedWorkshop1 = {
 ...analysis.workshops[1],
 data: {
 ...analysis.workshops[1].data,
 ...data,
 scope: data.scope
 ? { ...analysis.workshops[1].data.scope, ...data.scope }
 : analysis.workshops[1].data.scope,
 },
 };

 setAnalysis((prev) => prev ? {
 ...prev,
 workshops: {
 ...prev.workshops,
 1: updatedWorkshop1,
 },
 } : null);

 setPendingChanges({
 workshopNumber: 1,
 data: updatedWorkshop1.data,
 });
 setHasUnsavedChanges(true);
 }, [analysis]);

 const handleWorkshop2DataChange = useCallback((data: Partial<Workshop2Data>) => {
 if (!analysis) return;

 const updatedWorkshop2 = {
 ...analysis.workshops[2],
 data: {
 ...analysis.workshops[2].data,
 ...data,
 },
 };

 setAnalysis((prev) => prev ? {
 ...prev,
 workshops: {
 ...prev.workshops,
 2: updatedWorkshop2,
 },
 } : null);

 setPendingChanges({
 workshopNumber: 2,
 data: updatedWorkshop2.data,
 });
 setHasUnsavedChanges(true);
 }, [analysis]);

 const handleWorkshop3DataChange = useCallback((data: Partial<Workshop3Data>) => {
 if (!analysis) return;

 const updatedWorkshop3 = {
 ...analysis.workshops[3],
 data: {
 ...analysis.workshops[3].data,
 ...data,
 },
 };

 setAnalysis((prev) => prev ? {
 ...prev,
 workshops: {
 ...prev.workshops,
 3: updatedWorkshop3,
 },
 } : null);

 setPendingChanges({
 workshopNumber: 3,
 data: updatedWorkshop3.data,
 });
 setHasUnsavedChanges(true);
 }, [analysis]);

 const handleWorkshop4DataChange = useCallback((data: Partial<Workshop4Data>) => {
 if (!analysis) return;

 const updatedWorkshop4 = {
 ...analysis.workshops[4],
 data: {
 ...analysis.workshops[4].data,
 ...data,
 },
 };

 setAnalysis((prev) => prev ? {
 ...prev,
 workshops: {
 ...prev.workshops,
 4: updatedWorkshop4,
 },
 } : null);

 setPendingChanges({
 workshopNumber: 4,
 data: updatedWorkshop4.data,
 });
 setHasUnsavedChanges(true);
 }, [analysis]);

 const handleWorkshop5DataChange = useCallback((data: Partial<Workshop5Data>) => {
 if (!analysis) return;

 const updatedWorkshop5 = {
 ...analysis.workshops[5],
 data: {
 ...analysis.workshops[5].data,
 ...data,
 },
 };

 setAnalysis((prev) => prev ? {
 ...prev,
 workshops: {
 ...prev.workshops,
 5: updatedWorkshop5,
 },
 } : null);

 setPendingChanges({
 workshopNumber: 5,
 data: updatedWorkshop5.data,
 });
 setHasUnsavedChanges(true);
 }, [analysis]);

 // Manual save handler
 const handleManualSave = useCallback(async () => {
 await saveChanges();
 toast.success(t('common.saved'));
 }, [saveChanges, t]);

 // Complete analysis handler - shows confirmation first
 const handleCompleteAnalysis = useCallback(() => {
 setShowCompleteConfirm(true);
 }, []);

 // Actual completion after confirmation
 const handleConfirmComplete = useCallback(async () => {
 if (!analysis || !organizationId || !user?.uid) return;

 setShowCompleteConfirm(false);
 try {
 await EbiosService.updateAnalysis(
 organizationId,
 analysis.id,
 { status: 'completed' },
 user.uid
 );
 toast.success(t('ebios.analysisCompleted'));
 navigate('/ebios');
 } catch (error) {
 ErrorLogger.error(error, 'EbiosAnalysisDetail.handleCompleteAnalysis');
 toast.error(t('ebios.errors.completeFailed'));
 }
 }, [analysis, organizationId, user?.uid, t, navigate]);

 // Create risk from EBIOS operational scenario (Story 18.5)
 const handleCreateRisk = useCallback(async (
 scenarioId: string,
 riskData: CreateRiskFromEbiosData
 ): Promise<string | null> => {
 if (!organizationId || !user?.uid) return null;

 // Permission check before creating risk
 if (!hasPermission(user, 'Risk', 'create')) {
 toast.error(t('errors.noCreateRiskPermission') || t('ebios.errors.noCreatePermission', { defaultValue: 'Vous n\'avez pas la permission de créer un risque' }));
 return null;
 }

 try {
 const score = riskData.probability * riskData.impact;

 const newRisk = sanitizeData({
 organizationId,
 threat: riskData.threat,
 scenario: riskData.scenario,
 vulnerability: t('ebios.identifiedViaEbios', { defaultValue: 'Identifié via l\'analyse EBIOS RM' }),
 probability: riskData.probability,
 impact: riskData.impact,
 score,
 strategy: score >= RISK_ACCEPTANCE_THRESHOLD ? 'Atténuer' : 'Accepter',
 status: 'Ouvert',
 source: 'ebios_rm',
 mitreTechniques: riskData.mitreTechniques,
 ebiosReference: riskData.ebiosReference,
 owner: user.uid,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp(),
 history: [{
 date: new Date().toISOString(),
 user: user.displayName || user.email,
 action: t('ebios.history.createdFromEbios', { defaultValue: 'Créé depuis EBIOS RM' }),
 changes: t('ebios.history.createdFromScenario', { defaultValue: 'Créé depuis le scénario opérationnel {{code}}', code: riskData.ebiosReference.scenarioCode || scenarioId }),
 previousScore: 0,
 newScore: score,
 changedBy: user.uid
 }]
 });

 const docRef = await addDoc(collection(db, 'risks'), newRisk);
 toast.success(t('ebios.riskCreatedFromScenario') || t('ebios.riskCreatedSuccess', { defaultValue: 'Risque créé depuis le scénario EBIOS' }));
 return docRef.id;
 } catch (error) {
 ErrorLogger.error(error, 'EbiosAnalysisDetail.handleCreateRisk', {
 component: 'EbiosAnalysisDetail',
 action: 'createRiskFromEbios',
 metadata: { scenarioId }
 });
 toast.error(t('ebios.errors.riskCreationFailed') || t('ebios.errors.riskCreationError', { defaultValue: 'Erreur lors de la création du risque' }));
 return null;
 }
 }, [organizationId, user, t]);

 // Render workshop content based on current workshop
 const renderWorkshopContent = useMemo(() => {
 if (!analysis) return null;

 switch (analysis.currentWorkshop) {
 case 1:
 return (
 <Workshop1Content
 data={analysis.workshops[1].data}
 onDataChange={handleWorkshop1DataChange}
 />
 );
 case 2:
 return (
 <Workshop2Content
 data={analysis.workshops[2].data}
 onDataChange={handleWorkshop2DataChange}
 />
 );
 case 3:
 return (
 <Workshop3Content
 data={analysis.workshops[3].data}
 workshop1Data={analysis.workshops[1].data}
 workshop2Data={analysis.workshops[2].data}
 onDataChange={handleWorkshop3DataChange}
 />
 );
 case 4:
 return (
 <Workshop4Content
 data={analysis.workshops[4].data}
 workshop3Data={analysis.workshops[3].data}
 onDataChange={handleWorkshop4DataChange}
 analysisId={analysis.id}
 analysisName={analysis.name}
 onCreateRisk={handleCreateRisk}
 />
 );
 case 5:
 return (
 <Workshop5Content
 data={analysis.workshops[5].data}
 workshop4Data={analysis.workshops[4].data}
 workshop3Data={analysis.workshops[3].data}
 onDataChange={handleWorkshop5DataChange}
 />
 );
 default:
 return null;
 }
 }, [
 analysis,
 handleWorkshop1DataChange,
 handleWorkshop2DataChange,
 handleWorkshop3DataChange,
 handleWorkshop4DataChange,
 handleWorkshop5DataChange,
 handleCreateRisk,
 ]);

 if (loading) {
 return (
 <div className="min-h-screen relative flex flex-col bg-muted/50">
 <div className="absolute inset-0 overflow-hidden pointer-events-none">
 <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
 <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-400/10 rounded-full blur-[100px]" />
 </div>

 {/* Skeleton Header */}
 <div className="sticky top-0 z-header h-20 border-b border-white/10 glass-premium">
 <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-muted animate-pulse" />
 <div className="space-y-2">
 <div className="w-48 h-5 rounded-md bg-muted animate-pulse" />
 <div className="w-24 h-3 rounded-md bg-muted animate-pulse" />
 </div>
 </div>
 <div className="hidden lg:flex gap-4">
 {[1, 2, 3, 4, 5].map(i => (
 <div key={i || 'unknown'} className="w-12 h-12 rounded-2xl bg-muted animate-pulse" />
 ))}
 </div>
 <div className="w-32 h-10 rounded-full bg-muted animate-pulse" />
 </div>
 </div>

 {/* Skeleton Body */}
 <main className="flex-1 max-w-7xl mx-auto px-4 w-full py-8 space-y-6 sm:space-y-8">
 <div className="w-full h-64 rounded-3xl bg-muted animate-pulse" />
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
 <div className="w-full h-80 rounded-3xl bg-muted animate-pulse" />
 <div className="w-full h-80 rounded-3xl bg-muted animate-pulse" />
 </div>
 </main>
 </div>
 );
 }

 if (!analysis) {
 return null;
 }

 return (
 <>
 <EbiosWizard
 analysis={analysis}
 onWorkshopChange={handleWorkshopChange}
 onSave={handleManualSave}
 onComplete={analysis.currentWorkshop === 5 ? handleCompleteAnalysis : undefined}
 isSaving={saving}
 hasUnsavedChanges={hasUnsavedChanges}
 >
 {renderWorkshopContent}
 </EbiosWizard>

 {/* Confirmation dialog before completing the analysis */}
 {showCompleteConfirm && (
 <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)]">
 <div className="glass-premium p-6 rounded-3xl border border-border/40 shadow-xl max-w-md w-full space-y-4">
 <h3 className="text-lg font-bold text-foreground">
 {t('ebios.confirmComplete') || t('ebios.finalizeAnalysis', { defaultValue: 'Finaliser l\'analyse' })}
 </h3>
 <p className="text-sm text-muted-foreground">
 {t('ebios.confirmCompleteMessage', { defaultValue: 'Voulez-vous finaliser cette analyse EBIOS RM ? Cette action marquera l\'analyse comme terminée.' })}
 </p>
 <div className="flex justify-end gap-3 pt-2">
 <button
 onClick={() => setShowCompleteConfirm(false)}
 className="px-4 py-2 rounded-2xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
 >
 {t('common.cancel')}
 </button>
 <button
 onClick={handleConfirmComplete}
 className="px-4 py-2 rounded-2xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
 >
 {t('ebios.complete') || t('ebios.finalize', { defaultValue: 'Finaliser' })}
 </button>
 </div>
 </div>
 </div>
 )}
 </>
 );
};

export default EbiosAnalysisDetail;
