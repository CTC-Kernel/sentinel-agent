/**
 * Vendor Portal View
 * Self-service portal for vendors to complete security questionnaires
 * Story 37-2: Vendor Self-Service Portal
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorLogger } from '../../services/errorLogger';
import { VendorPortalService } from '../../services/VendorPortalService';
import {
  VendorPortalAccess,
  PortalAccessError,
  getPortalErrorMessage,
} from '../../types/vendorPortal';
import { EnhancedAssessmentResponse } from '../../types/vendorAssessment';
import { QuestionnaireTemplate } from '../../types/business';
import { getTemplateById } from '../../data/questionnaireTemplates';
import { PortalAuth } from '../../components/vendor-portal/PortalAuth';
import { PortalQuestionnaire } from '../../components/vendor-portal/PortalQuestionnaire';
import { Loader2, AlertTriangle, Building2, CheckCircle } from '../../components/ui/Icons';

type PortalState = 'loading' | 'auth' | 'questionnaire' | 'submitted' | 'error';

export const VendorPortal: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();

  const [state, setState] = useState<PortalState>('loading');
  const [error, setError] = useState<PortalAccessError | null>(null);
  const [access, setAccess] = useState<VendorPortalAccess | null>(null);
  const [assessment, setAssessment] = useState<EnhancedAssessmentResponse | null>(null);
  const [template, setTemplate] = useState<QuestionnaireTemplate | null>(null);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('invalid_token');
        setState('error');
        return;
      }

      try {
        const validation = await VendorPortalService.validatePortalToken(token);

        if (!validation.valid) {
          setError(validation.error || 'invalid_token');
          setState('error');
          return;
        }

        setAccess(validation.access!);

        // Check if email verification is required
        if (validation.error === 'verification_required') {
          setState('auth');
          return;
        }

        // Check if already submitted
        if (validation.access!.status === 'submitted') {
          setState('submitted');
        } else {
          // Load assessment and template
          await loadAssessmentData(validation.access!);
          setState('questionnaire');
        }
      } catch (err) {
        ErrorLogger.error(err, 'VendorPortal.validateToken');
        setError('invalid_token');
        setState('error');
      }
    };

    validateToken();
  }, [token]);

  // Load assessment data
  const loadAssessmentData = async (portalAccess: VendorPortalAccess) => {
    try {
      const assessmentData = await VendorPortalService.getPortalAssessment(portalAccess.id);
      if (!assessmentData) {
        throw new Error('Assessment not found');
      }
      setAssessment(assessmentData);

      // Get template
      const templateData = getTemplateById(portalAccess.templateId);
      if (templateData) {
        // Convert to QuestionnaireTemplate format
        setTemplate({
          id: templateData.metadata.id,
          organizationId: portalAccess.organizationId,
          title: templateData.metadata.title,
          description: templateData.metadata.description,
          sections: templateData.sections,
          isSystem: true,
          createdAt: '',
          updatedAt: '',
          createdBy: '',
        });
      }
    } catch (err) {
      ErrorLogger.error(err, 'VendorPortal.loadAssessmentData');
      setError('invalid_token');
      setState('error');
    }
  };

  // Handle successful authentication
  const handleAuthSuccess = useCallback(async () => {
    if (!access) return;

    try {
      await loadAssessmentData(access);
      setState('questionnaire');
    } catch (err) {
      ErrorLogger.error(err, 'VendorPortal.handleAuthSuccess');
      setError('invalid_token');
      setState('error');
    }
  }, [access]);

  // Handle questionnaire submission
  const handleSubmitSuccess = useCallback(() => {
    setState('submitted');
  }, []);

  // Render loading state
  if (state === 'loading') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-4" />
        <p className="text-slate-500 dark:text-slate-400">{t('vendorPortal.loading', 'Loading portal...')}</p>
      </div>
    );
  }

  // Render error state
  if (state === 'error') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
          {t('vendorPortal.accessError', 'Access Error')}
        </h1>
        <p className="text-slate-600 dark:text-muted-foreground mb-6">
          {error ? getPortalErrorMessage(error) : t('vendorPortal.unknownError', 'An unknown error occurred.')}
        </p>
        <p className="text-sm text-slate-500">
          {t('vendorPortal.contactOrg', 'Please contact the requesting organization for assistance.')}
        </p>
      </div>
    );
  }

  // Render auth state
  if (state === 'auth' && access) {
    return (
      <div className="max-w-md mx-auto">
        <PortalAuth
          access={access}
          onSuccess={handleAuthSuccess}
          onError={(err) => {
            setError(err);
            setState('error');
          }}
        />
      </div>
    );
  }

  // Render submitted state
  if (state === 'submitted' && access) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center max-w-lg mx-auto text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
          {t('vendorPortal.submitted', 'Questionnaire Soumis')}
        </h1>
        <p className="text-slate-600 dark:text-muted-foreground mb-6">
          {t('vendorPortal.submittedMessage', 'Merci d\'avoir complété le questionnaire de sécurité. Vos réponses ont été enregistrées.')}
        </p>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-white/10 w-full">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-slate-500" />
            <div className="text-left">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {access.organizationName}
              </p>
              <p className="text-xs text-slate-500">
                {t('vendorPortal.willReview', 'will review your submission')}
              </p>
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-300 mt-6">
          {t('vendorPortal.confirmationEmail', 'A confirmation email has been sent to your address.')}
        </p>
      </div>
    );
  }

  // Render questionnaire state
  if (state === 'questionnaire' && access && assessment && template) {
    return (
      <PortalQuestionnaire
        access={access}
        assessment={assessment}
        template={template}
        onSubmitSuccess={handleSubmitSuccess}
      />
    );
  }

  // Fallback
  return null;
};

export default VendorPortal;
