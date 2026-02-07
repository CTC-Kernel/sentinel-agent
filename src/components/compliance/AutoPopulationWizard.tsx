/**
 * AutoPopulationWizard
 *
 * 3-step wizard for auto-populating compliance questionnaires from agent evidence.
 * Step 1: Select framework
 * Step 2: Review and approve/reject suggestions
 * Step 3: Summary and completion
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';
import {
 ChevronLeft,
 ChevronRight,
 Check,
 X,
 AlertTriangle,
 Edit,
 Shield,
 ShieldCheck,
 ShieldAlert,
 Clock,
 Bot,
 RefreshCw,
 FileText,
 TrendingUp,
 Sparkles,
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';
import { Textarea } from '../ui/textarea';
import { useStore } from '../../store';
import { AutoPopulationService } from '../../services/AutoPopulationService';
import { REGULATORY_FRAMEWORK_CODES, RegulatoryFrameworkCode } from '../../types/framework';
import {
 PopulationSession,
 PopulationSuggestion,
 FrameworkPopulationSummary,
 SuggestionStatus,
 ConfidenceLevel,
} from '../../types/autoPopulation';
import { AGENT_CHECK_DEFINITIONS } from '../../types/agentEvidence';
import { ErrorLogger } from '../../services/errorLogger';

interface AutoPopulationWizardProps {
 onComplete: (session: PopulationSession) => void;
 onCancel: () => void;
 initialFramework?: RegulatoryFrameworkCode;
}

type WizardStep = 'select_framework' | 'review_suggestions' | 'complete';

// Framework display info
const FRAMEWORK_INFO: Record<RegulatoryFrameworkCode, { name: string; description: string; icon: string }> = {
 NIS2: { name: 'NIS 2', description: 'Directive européenne sur la cybersécurité', icon: '🇪🇺' },
 DORA: { name: 'DORA', description: 'Résilience opérationnelle numérique', icon: '🏦' },
 ISO27001: { name: 'ISO 27001', description: 'Système de management de la sécurité', icon: '🔐' },
 ISO22301: { name: 'ISO 22301', description: 'Continuité d\'activité', icon: '🔄' },
 SOC2: { name: 'SOC 2', description: 'Contrôles de services', icon: '☁️' },
 RGPD: { name: 'RGPD', description: 'Protection des données personnelles', icon: '🔒' },
 AI_ACT: { name: 'AI Act', description: 'Règlement européen sur l\'IA', icon: '🤖' },
 HDS: { name: 'HDS', description: 'Hébergement de données de santé', icon: '🏥' },
 PCI_DSS: { name: 'PCI DSS', description: 'Sécurité des paiements', icon: '💳' },
 NIST_CSF: { name: 'NIST CSF', description: 'Framework de cybersécurité', icon: '🛡️' },
 SECNUMCLOUD: { name: 'SecNumCloud', description: 'Qualification cloud ANSSI', icon: '☁️' },
};

// Confidence color helper
const getConfidenceColor = (level: ConfidenceLevel): string => {
 switch (level) {
 case 'high': return 'text-success';
 case 'medium': return 'text-warning';
 case 'low': return 'text-destructive';
 }
};

const getConfidenceBgColor = (level: ConfidenceLevel): string => {
 switch (level) {
 case 'high': return 'bg-success/10';
 case 'medium': return 'bg-warning/10';
 case 'low': return 'bg-destructive/10';
 }
};

// Confidence gauge component
const ConfidenceGauge: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({
 score,
 size = 'md'
}) => {
 const sizeClasses = {
 sm: 'w-8 h-8',
 md: 'w-12 h-12',
 lg: 'w-16 h-16',
 };

 const strokeWidth = size === 'sm' ? 3 : size === 'md' ? 4 : 5;
 const radius = size === 'sm' ? 12 : size === 'md' ? 18 : 24;
 const circumference = 2 * Math.PI * radius;
 const strokeDashoffset = circumference - (score / 100) * circumference;

 const getColor = () => {
 if (score >= 80) return 'stroke-success';
 if (score >= 50) return 'stroke-warning';
 return 'stroke-destructive';
 };

 return (
 <div className={cn('relative', sizeClasses[size])}>
 <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
 <circle
  cx="24"
  cy="24"
  r={radius}
  fill="none"
  stroke="currentColor"
  strokeWidth={strokeWidth}
  className="text-muted/30"
 />
 <circle
  cx="24"
  cy="24"
  r={radius}
  fill="none"
  strokeWidth={strokeWidth}
  strokeLinecap="round"
  strokeDasharray={circumference}
  strokeDashoffset={strokeDashoffset}
  className={cn('transition-all duration-500', getColor())}
 />
 </svg>
 <span className={cn(
 'absolute inset-0 flex items-center justify-center font-bold',
 size === 'sm' ? 'text-xs' : size === 'md' ? 'text-xs' : 'text-sm',
 getColor().replace('stroke-', 'text-')
 )}>
 {score}%
 </span>
 </div>
 );
};

// Framework card for selection
interface FrameworkCardProps {
 code: RegulatoryFrameworkCode;
 summary: FrameworkPopulationSummary | null;
 isSelected: boolean;
 onSelect: () => void;
 loading?: boolean;
}

const FrameworkCard: React.FC<FrameworkCardProps> = ({
 code,
 summary,
 isSelected,
 onSelect,
 loading
}) => {
 const info = FRAMEWORK_INFO[code];

 return (
 <motion.div
 variants={slideUpVariants}
 whileHover={{ scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 >
 <Card
 className={cn(
  'p-4 cursor-pointer transition-all border-2',
  isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted',
  loading && 'opacity-60 pointer-events-none'
 )}
 onClick={onSelect}
 >
 <div className="flex items-start gap-3">
  <div className="text-2xl">{info.icon}</div>
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2">
  <span className="font-semibold">{info.name}</span>
  {summary && summary.coveragePercent > 0 && (
  <Badge status="success" className="text-xs">
   {summary.coveragePercent}% couvert
  </Badge>
  )}
  </div>
  <p className="text-sm text-muted-foreground mt-0.5">
  {info.description}
  </p>
  {summary && (
  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
  <span className="flex items-center gap-1">
   <FileText className="h-3 w-3" />
   {summary.totalRequirements} exigences
  </span>
  <span className="flex items-center gap-1">
   <Bot className="h-3 w-3" />
   {summary.agentCoveredRequirements} vérifiées
  </span>
  {summary.potentialScore > 0 && (
   <span className="flex items-center gap-1">
   <TrendingUp className="h-3 w-3" />
   Score potentiel: {summary.potentialScore}%
   </span>
  )}
  </div>
  )}
  </div>
  {isSelected && (
  <Check className="h-5 w-5 text-primary flex-shrink-0" />
  )}
 </div>
 </Card>
 </motion.div>
 );
};

// Suggestion review card
interface SuggestionCardProps {
 suggestion: PopulationSuggestion;
 onApprove: () => void;
 onReject: () => void;
 onModify: (answer: string, notes?: string) => void;
 isProcessing: boolean;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
 suggestion,
 onApprove,
 onReject,
 onModify,
 isProcessing
}) => {
 const [isEditing, setIsEditing] = useState(false);
 const [editedAnswer, setEditedAnswer] = useState(suggestion.suggestedAnswer);
 const [reviewNotes, setReviewNotes] = useState('');

 const checkNames = suggestion.sourceCheckIds.map(
 id => AGENT_CHECK_DEFINITIONS[id]?.name || id
 ).join(', ');

 const handleSaveEdit = () => {
 onModify(editedAnswer, reviewNotes || undefined);
 setIsEditing(false);
 };

 const statusConfig = {
 pending: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: 'En attente' },
 approved: { icon: Check, color: 'text-success', bg: 'bg-success/10', label: 'Approuvé' },
 rejected: { icon: X, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Rejeté' },
 modified: { icon: Edit, color: 'text-primary', bg: 'bg-primary/10', label: 'Modifié' },
 expired: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', label: 'Expiré' },
 };

 const config = statusConfig[suggestion.status];
 const StatusIcon = config.icon;

 return (
 <motion.div variants={slideUpVariants}>
 <Card className={cn(
 'p-4 border-l-4',
 suggestion.status === 'pending' && 'border-l-muted-foreground',
 suggestion.status === 'approved' && 'border-l-success',
 suggestion.status === 'rejected' && 'border-l-destructive',
 suggestion.status === 'modified' && 'border-l-primary',
 suggestion.status === 'expired' && 'border-l-warning',
 )}>
 {/* Header */}
 <div className="flex items-start justify-between gap-4 mb-3">
  <div className="flex-1 min-w-0">
  <div className="flex items-center gap-2 mb-1">
  <Badge variant="outline" className="text-xs font-mono">
  {suggestion.requirementReference}
  </Badge>
  <Badge
  status={suggestion.confidenceLevel === 'high' ? 'success' :
   suggestion.confidenceLevel === 'medium' ? 'warning' : 'error'}
  className="text-xs"
  >
  {suggestion.confidenceScore}% confiance
  </Badge>
  <div className={cn(
  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
  config.bg, config.color
  )}>
  <StatusIcon className="h-3 w-3" />
  {config.label}
  </div>
  </div>
  <p className="text-sm text-foreground">
  {suggestion.requirementText}
  </p>
  </div>
  <ConfidenceGauge score={suggestion.confidenceScore} size="sm" />
 </div>

 {/* Source checks */}
 <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
  <Shield className="h-3 w-3" />
  <span>Vérifié par: {checkNames}</span>
  <span>•</span>
  <Bot className="h-3 w-3" />
  <span>{suggestion.agentCount} agent{suggestion.agentCount > 1 ? 's' : ''}</span>
 </div>

 {/* Suggested answer */}
 <div className={cn(
  'rounded-lg p-3 mb-3',
  getConfidenceBgColor(suggestion.confidenceLevel)
 )}>
  <div className="flex items-center gap-2 mb-1">
  <Sparkles className={cn('h-4 w-4', getConfidenceColor(suggestion.confidenceLevel))} />
  <span className="text-xs font-medium text-muted-foreground">
  Réponse suggérée
  </span>
  </div>
  {isEditing ? (
  <Textarea
  value={editedAnswer}
  onChange={(e) => setEditedAnswer(e.target.value)}
  className="min-h-[100px] mt-2"
  placeholder="Modifiez la réponse suggérée..."
  />
  ) : (
  <p className="text-sm">
  {suggestion.modifiedAnswer || suggestion.suggestedAnswer}
  </p>
  )}
 </div>

 {/* Review notes input when editing */}
 {isEditing && (
  <div className="mb-3">
  <Textarea
  value={reviewNotes}
  onChange={(e) => setReviewNotes(e.target.value)}
  className="min-h-[60px]"
  placeholder="Notes de révision (optionnel)..."
  />
  </div>
 )}

 {/* Suggested status */}
 <div className="flex items-center gap-2 mb-3">
  <span className="text-xs text-muted-foreground">Statut suggéré:</span>
  <Badge
  status={
  suggestion.suggestedStatus === 'compliant' ? 'success' :
  suggestion.suggestedStatus === 'non_compliant' ? 'error' :
   suggestion.suggestedStatus === 'partially_compliant' ? 'warning' : 'neutral'
  }
  >
  {suggestion.suggestedStatus === 'compliant' && 'Conforme'}
  {suggestion.suggestedStatus === 'non_compliant' && 'Non conforme'}
  {suggestion.suggestedStatus === 'partially_compliant' && 'Partiellement conforme'}
  {suggestion.suggestedStatus === 'in_progress' && 'En cours'}
  {suggestion.suggestedStatus === 'not_started' && 'Non démarré'}
  {suggestion.suggestedStatus === 'not_applicable' && 'Non applicable'}
  </Badge>
 </div>

 {/* Actions */}
 {suggestion.status === 'pending' && (
  <div className="flex items-center gap-2 pt-3 border-t border-border/50">
  {isEditing ? (
  <>
  <Button
   variant="outline"
   size="sm"
   onClick={() => {
   setIsEditing(false);
   setEditedAnswer(suggestion.suggestedAnswer);
   setReviewNotes('');
   }}
   disabled={isProcessing}
  >
   Annuler
  </Button>
  <Button
   size="sm"
   onClick={handleSaveEdit}
   disabled={isProcessing}
   className="gap-1"
  >
   <Check className="h-4 w-4" />
   Enregistrer
  </Button>
  </>
  ) : (
  <>
  <Button
   variant="outline"
   size="sm"
   onClick={onReject}
   disabled={isProcessing}
   className="gap-1 text-destructive hover:text-destructive"
  >
   <X className="h-4 w-4" />
   Rejeter
  </Button>
  <Button
   variant="outline"
   size="sm"
   onClick={() => setIsEditing(true)}
   disabled={isProcessing}
   className="gap-1"
  >
   <Edit className="h-4 w-4" />
   Modifier
  </Button>
  <Button
   size="sm"
   onClick={onApprove}
   disabled={isProcessing}
   className="gap-1 bg-success hover:bg-success/90"
  >
   <Check className="h-4 w-4" />
   Approuver
  </Button>
  </>
  )}
  </div>
 )}

 {/* Review notes display */}
 {suggestion.reviewNotes && suggestion.status !== 'pending' && (
  <div className="mt-3 pt-3 border-t border-border/50">
  <span className="text-xs text-muted-foreground">Notes: </span>
  <span className="text-xs">{suggestion.reviewNotes}</span>
  </div>
 )}
 </Card>
 </motion.div>
 );
};

// Main wizard component
export const AutoPopulationWizard: React.FC<AutoPopulationWizardProps> = ({
 onComplete,
 onCancel,
 initialFramework
}) => {
 const { user } = useStore();

 // Wizard state
 const [currentStep, setCurrentStep] = useState<WizardStep>('select_framework');
 const [selectedFramework, setSelectedFramework] = useState<RegulatoryFrameworkCode | null>(
 initialFramework || null
 );
 const [session, setSession] = useState<PopulationSession | null>(null);
 const [suggestions, setSuggestions] = useState<PopulationSuggestion[]>([]);
 const [isProcessing, setIsProcessing] = useState(false);
 const [error, setError] = useState<string | null>(null);

 // Framework summaries
 const [frameworkSummaries, setFrameworkSummaries] = useState<
 Map<RegulatoryFrameworkCode, FrameworkPopulationSummary>
 >(new Map());
 const [loadingSummaries, setLoadingSummaries] = useState(true);

 // Filter state for suggestions
 const [filterStatus, setFilterStatus] = useState<SuggestionStatus | 'all'>('all');
 const [filterConfidence, setFilterConfidence] = useState<ConfidenceLevel | 'all'>('all');

 // Load framework summaries
 useEffect(() => {
 const organizationId = user?.organizationId;
 if (!organizationId) return;

 setLoadingSummaries(true);

 const loadSummaries = async () => {
 const summaries = new Map<RegulatoryFrameworkCode, FrameworkPopulationSummary>();

 for (const code of REGULATORY_FRAMEWORK_CODES) {
 try {
  const summary = await AutoPopulationService.getFrameworkPopulationSummary(
  organizationId,
  code
  );
  summaries.set(code, summary);
 } catch {
  // Framework might not have data
 }
 }

 setFrameworkSummaries(summaries);
 setLoadingSummaries(false);
 };

 loadSummaries();
 }, [user?.organizationId]);

 // Subscribe to session suggestions
 useEffect(() => {
 if (!user?.organizationId || !session) return;

 const unsubscribe = AutoPopulationService.subscribeToSessionSuggestions(
 user.organizationId,
 session.id,
 setSuggestions,
 (err) => setError(err.message)
 );

 return unsubscribe;
 }, [user?.organizationId, session]);

 // Progress calculation
 const progress = useMemo(() => {
 if (currentStep === 'select_framework') return 10;
 if (currentStep === 'review_suggestions') {
 const reviewed = suggestions.filter(s => s.status !== 'pending').length;
 const total = suggestions.length;
 return 30 + (total > 0 ? (reviewed / total) * 60 : 0);
 }
 return 100;
 }, [currentStep, suggestions]);

 // Filtered suggestions
 const filteredSuggestions = useMemo(() => {
 return suggestions.filter(s => {
 if (filterStatus !== 'all' && s.status !== filterStatus) return false;
 if (filterConfidence !== 'all' && s.confidenceLevel !== filterConfidence) return false;
 return true;
 });
 }, [suggestions, filterStatus, filterConfidence]);

 // Stats for current session
 const sessionStats = useMemo(() => {
 const pending = suggestions.filter(s => s.status === 'pending').length;
 const approved = suggestions.filter(s => s.status === 'approved').length;
 const rejected = suggestions.filter(s => s.status === 'rejected').length;
 const modified = suggestions.filter(s => s.status === 'modified').length;
 const total = suggestions.length;

 return { pending, approved, rejected, modified, total };
 }, [suggestions]);

 // Create session and move to review
 const handleStartPopulation = useCallback(async () => {
 if (!user?.organizationId || !selectedFramework) return;

 setIsProcessing(true);
 setError(null);

 try {
 const newSession = await AutoPopulationService.createPopulationSession(
 user.organizationId,
 selectedFramework,
 user.uid,
 0 // Initial score
 );

 setSession(newSession);
 setCurrentStep('review_suggestions');
 } catch (err) {
   ErrorLogger.handleErrorWithToast(err, 'AutoPopulationWizard');
 setError((err as Error).message);
 } finally {
 setIsProcessing(false);
 }
 }, [user?.organizationId, user?.uid, selectedFramework]);

 // Handle suggestion actions
 const handleApproveSuggestion = useCallback(async (suggestionId: string) => {
 if (!user?.organizationId) return;

 setIsProcessing(true);
 try {
 await AutoPopulationService.updateSuggestionStatus(
 user.organizationId,
 suggestionId,
 'approved',
 user.uid
 );
 } catch (err) {
   ErrorLogger.handleErrorWithToast(err, 'AutoPopulationWizard');
 setError((err as Error).message);
 } finally {
 setIsProcessing(false);
 }
 }, [user?.organizationId, user?.uid]);

 const handleRejectSuggestion = useCallback(async (suggestionId: string) => {
 if (!user?.organizationId) return;

 setIsProcessing(true);
 try {
 await AutoPopulationService.updateSuggestionStatus(
 user.organizationId,
 suggestionId,
 'rejected',
 user.uid
 );
 } catch (err) {
   ErrorLogger.handleErrorWithToast(err, 'AutoPopulationWizard');
 setError((err as Error).message);
 } finally {
 setIsProcessing(false);
 }
 }, [user?.organizationId, user?.uid]);

 const handleModifySuggestion = useCallback(async (
 suggestionId: string,
 modifiedAnswer: string,
 reviewNotes?: string
 ) => {
 if (!user?.organizationId) return;

 setIsProcessing(true);
 try {
 await AutoPopulationService.updateSuggestionStatus(
 user.organizationId,
 suggestionId,
 'modified',
 user.uid,
 { modifiedAnswer, reviewNotes }
 );
 } catch (err) {
   ErrorLogger.handleErrorWithToast(err, 'AutoPopulationWizard');
 setError((err as Error).message);
 } finally {
 setIsProcessing(false);
 }
 }, [user?.organizationId, user?.uid]);

 // Bulk actions
 const handleApproveAll = useCallback(async () => {
 if (!user?.organizationId) return;

 const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
 setIsProcessing(true);

 try {
 for (const suggestion of pendingSuggestions) {
 await AutoPopulationService.updateSuggestionStatus(
  user.organizationId,
  suggestion.id,
  'approved',
  user.uid
 );
 }
 } catch (err) {
   ErrorLogger.handleErrorWithToast(err, 'AutoPopulationWizard');
 setError((err as Error).message);
 } finally {
 setIsProcessing(false);
 }
 }, [user?.organizationId, user?.uid, suggestions]);

 // Complete session
 const handleComplete = useCallback(async () => {
 if (!user?.organizationId || !session) return;

 setIsProcessing(true);
 try {
 // Calculate final score based on approved suggestions
 const approved = suggestions.filter(s => s.status === 'approved' || s.status === 'modified');
 const totalScore = approved.reduce((sum, s) => sum + s.suggestedScore, 0);
 const finalScore = Math.min(100, Math.round(totalScore / suggestions.length * 100));

 await AutoPopulationService.completeSession(
 user.organizationId,
 session.id,
 user.uid,
 finalScore
 );

 setCurrentStep('complete');
 } catch (err) {
   ErrorLogger.handleErrorWithToast(err, 'AutoPopulationWizard');
 setError((err as Error).message);
 } finally {
 setIsProcessing(false);
 }
 }, [user?.organizationId, user?.uid, session, suggestions]);

 // Render step content
 const renderStepContent = () => {
 switch (currentStep) {
 case 'select_framework':
 return (
  <motion.div
  key="select_framework"
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  transition={{ duration: 0.2 }}
  >
  <div className="mb-6">
  <h3 className="text-lg font-semibold mb-2">
  Sélectionnez un référentiel
  </h3>
  <p className="text-sm text-muted-foreground">
  Choisissez le référentiel de conformité à pré-remplir avec les preuves agent.
  </p>
  </div>

  <motion.div
  variants={staggerContainerVariants}
  initial="initial"
  animate="visible"
  className="grid gap-3"
  >
  {REGULATORY_FRAMEWORK_CODES.map(code => (
  <FrameworkCard
   key={code || 'unknown'}
   code={code}
   summary={frameworkSummaries.get(code) || null}
   isSelected={selectedFramework === code}
   onSelect={() => setSelectedFramework(code)}
   loading={loadingSummaries}
  />
  ))}
  </motion.div>
  </motion.div>
 );

 case 'review_suggestions':
 return (
  <motion.div
  key="review_suggestions"
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  transition={{ duration: 0.2 }}
  >
  {/* Stats bar */}
  <div className="flex items-center gap-4 mb-6 p-4 glass-premium rounded-3xl border border-border/40">
  <div className="flex-1">
  <div className="flex items-center gap-4 text-sm">
   <span className="flex items-center gap-1">
   <Clock className="h-4 w-4 text-muted-foreground" />
   <span className="font-medium">{sessionStats.pending}</span>
   <span className="text-muted-foreground">en attente</span>
   </span>
   <span className="flex items-center gap-1">
   <ShieldCheck className="h-4 w-4 text-success" />
   <span className="font-medium">{sessionStats.approved}</span>
   <span className="text-muted-foreground">approuvés</span>
   </span>
   <span className="flex items-center gap-1">
   <ShieldAlert className="h-4 w-4 text-destructive" />
   <span className="font-medium">{sessionStats.rejected}</span>
   <span className="text-muted-foreground">rejetés</span>
   </span>
   <span className="flex items-center gap-1">
   <Edit className="h-4 w-4 text-primary" />
   <span className="font-medium">{sessionStats.modified}</span>
   <span className="text-muted-foreground">modifiés</span>
   </span>
  </div>
  </div>
  {sessionStats.pending > 0 && (
  <Button
   variant="outline"
   size="sm"
   onClick={handleApproveAll}
   disabled={isProcessing}
   className="gap-1"
  >
   <Check className="h-4 w-4" />
   Tout approuver
  </Button>
  )}
  </div>

  {/* Filters */}
  <div className="flex items-center gap-4 mb-4">
  <div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">Statut:</span>
  <div className="flex gap-1">
   {(['all', 'pending', 'approved', 'rejected', 'modified'] as const).map(status => (
   <Button
   key={status || 'unknown'}
   variant={filterStatus === status ? 'default' : 'ghost'}
   size="sm"
   onClick={() => setFilterStatus(status)}
   className="h-7 px-2 text-xs"
   >
   {status === 'all' ? 'Tous' :
   status === 'pending' ? 'En attente' :
    status === 'approved' ? 'Approuvés' :
    status === 'rejected' ? 'Rejetés' : 'Modifiés'}
   </Button>
   ))}
  </div>
  </div>
  <div className="flex items-center gap-2">
  <span className="text-sm text-muted-foreground">Confiance:</span>
  <div className="flex gap-1">
   {(['all', 'high', 'medium', 'low'] as const).map(level => (
   <Button
   key={level || 'unknown'}
   variant={filterConfidence === level ? 'default' : 'ghost'}
   size="sm"
   onClick={() => setFilterConfidence(level)}
   className="h-7 px-2 text-xs"
   >
   {level === 'all' ? 'Toutes' :
   level === 'high' ? 'Haute' :
    level === 'medium' ? 'Moyenne' : 'Basse'}
   </Button>
   ))}
  </div>
  </div>
  </div>

  {/* Suggestions list */}
  {filteredSuggestions.length === 0 ? (
  <Card className="p-8 text-center">
  <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
  <h4 className="font-medium mb-2">Aucune suggestion</h4>
  <p className="text-sm text-muted-foreground">
   {suggestions.length === 0
   ? 'Aucune preuve agent disponible pour ce référentiel.'
   : 'Aucune suggestion ne correspond aux filtres sélectionnés.'}
  </p>
  </Card>
  ) : (
  <motion.div
  variants={staggerContainerVariants}
  initial="initial"
  animate="visible"
  className="space-y-4"
  >
  {filteredSuggestions.map(suggestion => (
   <SuggestionCard
   key={suggestion.id || 'unknown'}
   suggestion={suggestion}
   onApprove={() => handleApproveSuggestion(suggestion.id)}
   onReject={() => handleRejectSuggestion(suggestion.id)}
   onModify={(answer, notes) =>
   handleModifySuggestion(suggestion.id, answer, notes)
   }
   isProcessing={isProcessing}
   />
  ))}
  </motion.div>
  )}
  </motion.div>
 );

 case 'complete':
 return (
  <motion.div
  key="complete"
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.3 }}
  className="text-center py-8"
  >
  <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
  <ShieldCheck className="h-10 w-10 text-success" />
  </div>

  <h3 className="text-xl font-semibold mb-2">
  Auto-population terminée
  </h3>
  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
  {sessionStats.approved + sessionStats.modified} suggestions ont été appliquées
  au référentiel {selectedFramework && FRAMEWORK_INFO[selectedFramework].name}.
  </p>

  {/* Summary stats */}
  <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
  <Card className="p-4">
  <div className="text-2xl font-bold text-success">
   {sessionStats.approved}
  </div>
  <div className="text-xs text-muted-foreground">Approuvées</div>
  </Card>
  <Card className="p-4">
  <div className="text-2xl font-bold text-primary">
   {sessionStats.modified}
  </div>
  <div className="text-xs text-muted-foreground">Modifiées</div>
  </Card>
  <Card className="p-4">
  <div className="text-2xl font-bold text-destructive">
   {sessionStats.rejected}
  </div>
  <div className="text-xs text-muted-foreground">Rejetées</div>
  </Card>
  </div>

  {session && (
  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
  <TrendingUp className="h-4 w-4" />
  <span>
   Score de conformité amélioré de {session.scoreImprovement || 0} points
  </span>
  </div>
  )}

  <Button
  onClick={() => session && onComplete(session)}
  className="gap-2"
  >
  <Check className="h-4 w-4" />
  Terminer
  </Button>
  </motion.div>
 );
 }
 };

 return (
 <div className="max-w-3xl mx-auto">
 {/* Progress */}
 <div className="mb-6">
 <div className="flex items-center justify-between mb-2">
  <span className="text-sm font-medium">
  {currentStep === 'select_framework' && 'Étape 1/3: Sélection du référentiel'}
  {currentStep === 'review_suggestions' && 'Étape 2/3: Révision des suggestions'}
  {currentStep === 'complete' && 'Étape 3/3: Terminé'}
  </span>
  <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
 </div>
 <Progress value={progress} className="h-2" />
 </div>

 {/* Error display */}
 {error && (
 <Card className="p-4 mb-6 border-destructive bg-destructive/5">
  <div className="flex items-start gap-2">
  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
  <div>
  <p className="font-medium text-destructive">Erreur</p>
  <p className="text-sm text-muted-foreground">{error}</p>
  </div>
  <Button
  variant="ghost"
  size="sm"
  onClick={() => setError(null)}
  className="ml-auto"
  >
  <X className="h-4 w-4" />
  </Button>
  </div>
 </Card>
 )}

 {/* Content */}
 <AnimatePresence mode="popLayout">
 {renderStepContent()}
 </AnimatePresence>

 {/* Navigation */}
 {currentStep !== 'complete' && (
 <div className="flex justify-between mt-8 pt-6 border-t border-border/50">
  <Button
  variant="outline"
  onClick={currentStep === 'select_framework' ? onCancel : () => setCurrentStep('select_framework')}
  disabled={isProcessing}
  >
  <ChevronLeft className="h-4 w-4 mr-2" />
  {currentStep === 'select_framework' ? 'Annuler' : 'Retour'}
  </Button>

  {currentStep === 'select_framework' && (
  <Button
  onClick={handleStartPopulation}
  disabled={!selectedFramework || isProcessing}
  className="gap-2"
  >
  {isProcessing ? (
  <>
   <RefreshCw className="h-4 w-4 animate-spin" />
   Génération...
  </>
  ) : (
  <>
   Démarrer la population
   <ChevronRight className="h-4 w-4" />
  </>
  )}
  </Button>
  )}

  {currentStep === 'review_suggestions' && (
  <Tooltip
  content={sessionStats.pending > 0 ? `${sessionStats.pending} suggestions en attente` : undefined}
  position="top"
  >
  <Button
  onClick={handleComplete}
  disabled={isProcessing}
  className="gap-2"
  >
  {isProcessing ? (
   <>
   <RefreshCw className="h-4 w-4 animate-spin" />
   Finalisation...
   </>
  ) : (
   <>
   Terminer
   <Check className="h-4 w-4" />
   </>
  )}
  </Button>
  </Tooltip>
  )}
 </div>
 )}
 </div>
 );
};

export default AutoPopulationWizard;
