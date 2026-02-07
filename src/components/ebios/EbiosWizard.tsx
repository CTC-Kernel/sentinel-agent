/**
 * EBIOS Wizard Component
 * Main container for EBIOS RM analysis workflow
 *
 * Features:
 * - Workshop navigation with state machine validation
 * - Auto-save functionality (ADR-002)
 * - Progress tracking
 * - Responsive design with Apple aesthetics
 */

import React, { useCallback, useState } from 'react';
import { useLocale } from '../../hooks/useLocale';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, X } from '../ui/Icons';
import { cn } from '../../utils/cn';
import { PremiumCard } from '../ui/PremiumCard';
import { ProgressRing } from '../ui/ProgressRing';
import { MasterpieceBackground } from '../ui/MasterpieceBackground';
import { EbiosWorkshopStepper } from './EbiosWorkshopStepper';
import { EbiosAIAssistant } from './EbiosAIAssistant';
import { GenerateReportButtonCompact } from './workshops/GenerateReportButton';
import { WORKSHOP_INFO } from '../../data/ebiosLibrary';
import type { EbiosAnalysis, EbiosWorkshopNumber } from '../../types/ebios';
import { canProceedToWorkshop, isValidWorkshopTransition } from '../../types/ebios';

interface EbiosWizardProps {
 analysis: EbiosAnalysis;
 children: React.ReactNode;
 onWorkshopChange: (workshop: EbiosWorkshopNumber) => void;
 onUpdate?: (updates: Partial<EbiosAnalysis>) => void;
 onComplete?: () => void;
 onSave?: () => Promise<void>;
 isSaving?: boolean;
 hasUnsavedChanges?: boolean;
 organizationName?: string;
}

export const EbiosWizard: React.FC<EbiosWizardProps> = ({
 analysis,
 children,
 onWorkshopChange,
 onUpdate,
 onComplete,
 onSave,
 isSaving = false,
 hasUnsavedChanges = false,
 organizationName,
}) => {
 const { t, locale } = useLocale();
 const navigate = useNavigate();
 const [showExitConfirm, setShowExitConfirm] = useState(false);

 const currentWorkshop = analysis.currentWorkshop;
 const workshopInfo = WORKSHOP_INFO[currentWorkshop];

 const canGoBack = currentWorkshop > 1;
 const canGoForward = currentWorkshop < 5 && canProceedToWorkshop(analysis.workshops, (currentWorkshop + 1) as EbiosWorkshopNumber);
 const isLastWorkshop = currentWorkshop === 5;

 const handlePrevious = useCallback(() => {
 if (canGoBack) {
 const prevWorkshop = (currentWorkshop - 1) as EbiosWorkshopNumber;
 if (isValidWorkshopTransition(currentWorkshop, prevWorkshop)) {
 onWorkshopChange(prevWorkshop);
 }
 }
 }, [canGoBack, currentWorkshop, onWorkshopChange]);

 const handleNext = useCallback(() => {
 if (canGoForward) {
 const nextWorkshop = (currentWorkshop + 1) as EbiosWorkshopNumber;
 if (isValidWorkshopTransition(currentWorkshop, nextWorkshop)) {
 onWorkshopChange(nextWorkshop);
 }
 }
 }, [canGoForward, currentWorkshop, onWorkshopChange]);

 const handleWorkshopSelect = useCallback((workshop: EbiosWorkshopNumber) => {
 if (canProceedToWorkshop(analysis.workshops, workshop)) {
 onWorkshopChange(workshop);
 }
 }, [analysis.workshops, onWorkshopChange]);

 const handleExit = useCallback(() => {
 if (hasUnsavedChanges) {
 setShowExitConfirm(true);
 } else {
 navigate(-1);
 }
 }, [hasUnsavedChanges, navigate]);

 const confirmExit = useCallback(async () => {
 if (onSave && hasUnsavedChanges) {
 await onSave();
 }
 navigate(-1);
 }, [hasUnsavedChanges, navigate, onSave]);

 return (
 <div className="min-h-screen relative flex flex-col bg-muted/50">
 <MasterpieceBackground />
 {/* Header */}
 <header className="sticky top-0 z-header glass-premium border-b border-border/40 shadow-sm backdrop-blur-xl">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
 <div className="flex items-center justify-between h-20">
 {/* Left: Back Button & Title */}
 <div className="flex items-center gap-5">
 <button
 onClick={handleExit}
 className="p-2.5 -ml-2 rounded-3xl text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-muted dark:hover:bg-muted transition-colors"
 title={t('common.exit')}
 >
 <X className="w-5 h-5" />
 </button>
 <div className="flex flex-col">
 <div className="flex items-center gap-2">
  <h1 className="font-bold text-foreground truncate max-w-[200px] sm:max-w-xs text-lg">
  {analysis.name}
  </h1>
 </div>
 <p className="text-xs font-medium text-muted-foreground">
  {t('ebios.ebiosRmAnalysis', { defaultValue: 'EBIOS RM Analysis' })}
 </p>
 </div>
 </div>

 {/* Center: Compact Stepper (Desktop) */}
 <div className="hidden lg:block flex-1 max-w-2xl px-8">
 <EbiosWorkshopStepper
 workshops={analysis.workshops}
 currentWorkshop={currentWorkshop}
 onWorkshopSelect={handleWorkshopSelect}
 compact
 />
 </div>

 {/* Right: Progress & Save */}
 <div className="flex items-center gap-4">
 {/* Save Status */}
 <div className="flex items-center">
 {isSaving ? (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-xs font-medium text-blue-600 dark:text-blue-400">
  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  <span className="hidden sm:inline">{t('common.saving')}...</span>
  </div>
 ) : hasUnsavedChanges ? (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-xs font-medium text-amber-600 dark:text-amber-400">
  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
  <span className="hidden sm:inline">{t('common.unsavedChanges')}</span>
  </div>
 ) : (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground">
  {t('common.saved')}
  </div>
 )}
 </div>

 <div className="h-8 w-px bg-muted mx-2 hidden sm:block" />

 {/* Progress Ring */}
 <div className="flex items-center gap-3">
 <ProgressRing
  progress={analysis.completionPercentage}
  size={48}
  strokeWidth={4}
  showLabel={true}
  className="scale-90"
 />
 </div>
 </div>
 </div>
 </div>
 </header>

 {/* Main Content */}
 <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

 {/* Full Stepper (Mobile/Tablet) */}
 <div className="lg:hidden mb-8">
 <PremiumCard glass className="p-4 rounded-3xl border-border/40">
 <EbiosWorkshopStepper
 workshops={analysis.workshops}
 currentWorkshop={currentWorkshop}
 onWorkshopSelect={handleWorkshopSelect}
 />
 </PremiumCard>
 </div>

 {/* Workshop Header & Description */}
 <div className="mb-8 animate-fade-in-up">
 <PremiumCard glass className="relative overflow-hidden group rounded-4xl border-border/40">
 <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 dark:bg-blue-400/15 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

 <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-6">
 <div>
 <div className="flex items-center gap-3 mb-2">
  <span className="px-2.5 py-0.5 rounded-md bg-blue-500 dark:bg-blue-600 text-white text-xs font-bold uppercase tracking-wider">
  {t('ebios.workshop')} {currentWorkshop}
  </span>
  <h2 className="text-2xl font-bold text-foreground">
  {workshopInfo.name[locale]}
  </h2>
 </div>
 <p className="text-muted-foreground max-w-3xl text-lg leading-relaxed">
  {workshopInfo.description[locale]}
 </p>

 <div className="flex flex-wrap gap-2 mt-4">
  {workshopInfo.objectives[locale].map((objective, index) => (
  <div
  key={index || 'unknown'}
  className="flex items-center gap-2 px-3 py-1.5 rounded-3xl bg-muted/50 border border-border/40 text-sm text-muted-foreground"
  >
  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
  {objective}
  </div>
  ))}
 </div>
 </div>

 {/* Actions per workshop */}
 {currentWorkshop === 1 && (
 <div className="flex-shrink-0">
  <GenerateReportButtonCompact
  analysis={analysis}
  workshopNumber={1}
  organizationName={organizationName}
  />
 </div>
 )}
 </div>
 </PremiumCard>
 </div>

 {/* AI Assistant */}
 <div className="mb-6 animate-fade-in-up delay-75">
 <EbiosAIAssistant
 analysis={analysis}
 currentWorkshop={currentWorkshop}
 onUpdate={onUpdate}
 />
 </div>

 {/* Workshop Content */}
 <div className="space-y-6 animate-fade-in-up delay-100">
 {children}
 </div>

 {/* Navigation Footer */}
 <div className="mt-12 pt-6 border-t border-border/40 pb-20">
 <div className="flex items-center justify-between">
 <button
 onClick={handlePrevious}
 disabled={!canGoBack}
 className={cn(
 "group flex items-center gap-3 px-6 py-3 rounded-2xl font-medium transition-all duration-300",
 canGoBack
  ? "bg-card text-foreground hover:bg-muted/50 border border-border/40 shadow-sm hover:translate-x-1"
  : "opacity-70 cursor-not-allowed text-muted-foreground"
 )}
 >
 <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
 <div>
 <span className="text-xs text-muted-foreground block uppercase tracking-wider font-semibold text-left">{t('common.previous')}</span>
 <span className="hidden sm:block">{currentWorkshop > 1 ? WORKSHOP_INFO[(currentWorkshop - 1) as EbiosWorkshopNumber].shortName[locale] : t('ebios.previousWorkshop')}</span>
 </div>
 </button>

 <div className="flex items-center gap-4">
 {onSave && (
 <button
  onClick={onSave}
  disabled={isSaving || !hasUnsavedChanges}
  className={cn(
  "px-6 py-3 rounded-2xl font-medium transition-all duration-300 border",
  hasUnsavedChanges && !isSaving
  ? "bg-card text-foreground border-border/40 hover:bg-muted/50 shadow-sm"
  : "bg-transparent border-transparent text-muted-foreground cursor-not-allowed"
  )}
 >
  {t('common.save')}
 </button>
 )}

 {isLastWorkshop ? (
 <button
  onClick={onComplete}
  disabled={!onComplete}
  className={cn(
  "flex items-center gap-3 px-8 py-3 rounded-2xl font-bold transition-all duration-300",
  "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
  )}
 >
  <Check className="w-5 h-5" />
  {t('ebios.completeAnalysis')}
 </button>
 ) : (
 <button
  onClick={handleNext}
  disabled={!canGoForward}
  className={cn(
  "group flex items-center gap-3 px-8 py-3 rounded-2xl font-bold transition-all duration-300",
  canGoForward
  ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
  : "bg-muted text-muted-foreground cursor-not-allowed"
  )}
 >
  <div className="text-right">
  <span className="text-xs opacity-80 block uppercase tracking-wider font-medium text-white">{t('common.next')}</span>
  <span className="hidden sm:block">{currentWorkshop < 5 ? WORKSHOP_INFO[(currentWorkshop + 1) as EbiosWorkshopNumber].shortName[locale] : t('ebios.nextWorkshop')}</span>
  </div>
  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
 </button>
 )}
 </div>
 </div>
 </div>
 </main>

 {/* Exit Confirmation Modal */}
 {showExitConfirm && (
 <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] animate-fade-in">
 <PremiumCard glass className="max-w-md w-full p-6 shadow-2xl border-border/40 rounded-3xl">
 <div className="flex items-center gap-3 mb-4 text-amber-500">
 <div className="p-2 bg-amber-50 rounded-lg">
 <div className="w-6 h-6 rounded-full border-2 border-amber-500 flex items-center justify-center">?</div>
 </div>
 <h3 className="text-xl font-bold text-foreground">
 {t('ebios.unsavedChangesTitle')}
 </h3>
 </div>

 <p className="text-muted-foreground mb-8 leading-relaxed">
 {t('ebios.unsavedChangesMessage')}
 </p>

 <div className="flex justify-end gap-3">
 <button
 onClick={() => setShowExitConfirm(false)}
 className="px-5 py-2.5 rounded-3xl font-medium text-muted-foreground hover:bg-muted transition-colors"
 >
 {t('common.cancel')}
 </button>
 <button
 onClick={() => navigate(-1)}
 className="px-5 py-2.5 rounded-3xl font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 transition-colors"
 >
 {t('common.discardChanges')}
 </button>
 <button
 onClick={confirmExit}
 className="px-6 py-2.5 rounded-3xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5"
 >
 {t('common.saveAndExit')}
 </button>
 </div>
 </PremiumCard>
 </div>
 )}
 </div>
 );
};

export default EbiosWizard;
