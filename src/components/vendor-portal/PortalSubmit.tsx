/**
 * Portal Submit Component
 * Submission confirmation modal for vendor portal
 * Story 37-2: Vendor Self-Service Portal
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VendorPortalService } from '../../services/VendorPortalService';
import { QuestionnaireProgress } from '../../types/vendorPortal';
import { ErrorLogger } from '../../services/errorLogger';
import { Button } from '../ui/button';
import {
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Send,
  FileCheck,
  Clock,
} from '../ui/Icons';

interface PortalSubmitProps {
  accessId: string;
  progress: QuestionnaireProgress;
  onClose: () => void;
  onSuccess: () => void;
}

export const PortalSubmit: React.FC<PortalSubmitProps> = ({
  accessId,
  progress,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await VendorPortalService.submitPortalQuestionnaire(accessId);
      onSuccess();
    } catch (err) {
      ErrorLogger.error(err, 'PortalSubmit.handleSubmit');
      setError(t('vendorPortal.submitError', 'Failed to submit questionnaire. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const incompleteSections = progress.sectionProgress.filter((s) => !s.isComplete);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 dark:bg-green-900/30 flex items-center justify-center">
              <Send className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {t('vendorPortal.submitTitle', 'Submit Questionnaire')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Summary */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 mb-6">
            <h3 className="font-medium text-slate-900 dark:text-white mb-3">
              {t('vendorPortal.completionSummary', 'Completion Summary')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-green-500" />
                <span className="text-sm text-slate-600 dark:text-muted-foreground">
                  {progress.answeredQuestions}/{progress.totalQuestions}{' '}
                  {t('vendorPortal.questionsAnswered', 'questions answered')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-brand-500" />
                <span className="text-sm text-slate-600 dark:text-muted-foreground">
                  {progress.completionPercentage}% {t('vendorPortal.complete', 'complete')}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progress.completionPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Warning if incomplete sections */}
          {incompleteSections.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 dark:border-amber-800 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    {t('vendorPortal.incompleteSections', 'Some required questions are incomplete')}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 dark:text-amber-400 mt-1">
                    {t('vendorPortal.incompleteWarning', 'You can still submit, but missing required answers may affect the assessment.')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Text */}
          <p className="text-slate-600 dark:text-muted-foreground mb-4">
            {t(
              'vendorPortal.submitConfirmation',
              'Once submitted, you will not be able to modify your responses. The requesting organization will be notified of your submission.'
            )}
          </p>

          {/* What happens next */}
          <div className="space-y-2 mb-6">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-muted-foreground">
              {t('vendorPortal.whatHappensNext', 'What happens next:')}
            </p>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {t('vendorPortal.nextStep1', 'Your responses will be locked and submitted')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {t('vendorPortal.nextStep2', 'You will receive a confirmation email')}
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                {t('vendorPortal.nextStep3', 'The organization will review your assessment')}
              </li>
            </ul>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('vendorPortal.submitting', 'Submitting...')}
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {t('vendorPortal.confirmSubmit', 'Submit Questionnaire')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PortalSubmit;
