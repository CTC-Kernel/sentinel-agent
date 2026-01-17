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
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { GlassCard } from '../ui/GlassCard';
import { ProgressRing } from '../ui/ProgressRing';
import { EbiosWorkshopStepper } from './EbiosWorkshopStepper';
import { GenerateReportButtonCompact } from './workshops/GenerateReportButton';
import { WORKSHOP_INFO } from '../../data/ebiosLibrary';
import type { EbiosAnalysis, EbiosWorkshopNumber } from '../../types/ebios';
import { canProceedToWorkshop, isValidWorkshopTransition } from '../../types/ebios';

interface EbiosWizardProps {
  analysis: EbiosAnalysis;
  children: React.ReactNode;
  onWorkshopChange: (workshop: EbiosWorkshopNumber) => void;
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
  onComplete,
  onSave,
  isSaving = false,
  hasUnsavedChanges = false,
  organizationName,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Back Button & Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleExit}
                className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-none">
                  {analysis.name}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  EBIOS RM
                </p>
              </div>
            </div>

            {/* Center: Compact Stepper (Desktop) */}
            <div className="hidden lg:block">
              <EbiosWorkshopStepper
                workshops={analysis.workshops}
                currentWorkshop={currentWorkshop}
                onWorkshopSelect={handleWorkshopSelect}
                compact
              />
            </div>

            {/* Right: Progress & Save */}
            <div className="flex items-center gap-3">
              {/* Save Indicator */}
              {isSaving && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="hidden sm:inline">{t('common.saving')}</span>
                </div>
              )}
              {hasUnsavedChanges && !isSaving && (
                <div className="flex items-center gap-1.5 text-sm text-amber-500">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="hidden sm:inline">{t('common.unsavedChanges')}</span>
                </div>
              )}

              {/* Progress Ring */}
              <ProgressRing
                progress={analysis.completionPercentage}
                size={44}
                strokeWidth={4}
                showLabel={false}
                className="hidden sm:block"
              />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 sm:hidden">
                {analysis.completionPercentage}%
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Workshop Header Card */}
        <GlassCard className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500 text-white font-bold">
                  {currentWorkshop}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {workshopInfo.name[locale]}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('ebios.workshop')} {currentWorkshop} / 5
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg">
              {workshopInfo.description[locale]}
            </p>
          </div>

          {/* Workshop Objectives */}
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {t('ebios.objectives')}
            </p>
            <div className="flex flex-wrap gap-2">
              {workshopInfo.objectives[locale].map((objective, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  {objective}
                </span>
              ))}
            </div>
          </div>

          {/* Workshop Report Generation - Story 15.6 */}
          {currentWorkshop === 1 && (
            <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
              <GenerateReportButtonCompact
                analysis={analysis}
                workshopNumber={1}
                organizationName={organizationName}
              />
            </div>
          )}
        </GlassCard>

        {/* Full Stepper (Mobile/Tablet) */}
        <div className="lg:hidden mb-6">
          <GlassCard>
            <EbiosWorkshopStepper
              workshops={analysis.workshops}
              currentWorkshop={currentWorkshop}
              onWorkshopSelect={handleWorkshopSelect}
            />
          </GlassCard>
        </div>

        {/* Workshop Content */}
        <div className="space-y-6">
          {children}
        </div>

        {/* Navigation Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={!canGoBack}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200",
                canGoBack
                  ? "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  : "text-gray-400 dark:text-gray-600 cursor-not-allowed"
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{t('ebios.previousWorkshop')}</span>
              <span className="sm:hidden">{t('common.previous')}</span>
            </button>

            <div className="flex items-center gap-3">
              {onSave && (
                <button
                  onClick={onSave}
                  disabled={isSaving || !hasUnsavedChanges}
                  className={cn(
                    "px-5 py-2.5 rounded-xl font-medium transition-all duration-200",
                    hasUnsavedChanges && !isSaving
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                      : "bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 cursor-not-allowed"
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
                    "flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-200",
                    "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/25"
                  )}
                >
                  <Check className="w-4 h-4" />
                  {t('ebios.completeAnalysis')}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!canGoForward}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-200",
                    canGoForward
                      ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                  )}
                >
                  <span className="hidden sm:inline">{t('ebios.nextWorkshop')}</span>
                  <span className="sm:hidden">{t('common.next')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <GlassCard className="max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('ebios.unsavedChangesTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('ebios.unsavedChangesMessage')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="px-4 py-2 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 rounded-xl font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                {t('common.discardChanges')}
              </button>
              <button
                onClick={confirmExit}
                className="px-4 py-2 rounded-xl font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                {t('common.saveAndExit')}
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default EbiosWizard;
