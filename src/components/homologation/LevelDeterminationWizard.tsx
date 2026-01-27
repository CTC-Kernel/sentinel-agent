/**
 * LevelDeterminationWizard
 *
 * Step-by-step wizard to determine the appropriate ANSSI homologation level
 * based on system characteristics and regulatory requirements.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Info,
  AlertTriangle,
  Star,
  FileText,
  Shield,
  ShieldAlert
} from '../ui/Icons';
import type { LucideIcon } from '../ui/Icons';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';
import { RadioGroup, RadioGroupItem } from '../ui/RadioGroup';
import {
  CATEGORY_ORDER,
  CATEGORY_INFO,
  getQuestionsByCategory
} from '../../data/homologationQuestions';
import { HomologationService } from '../../services/HomologationService';
import type {
  HomologationLevel,
  LevelDeterminationQuestion,
  LevelDeterminationAnswer,
  LevelRecommendation,
  CreateHomologationDossierInput
} from '../../types/homologation';
import { LEVEL_INFO, REQUIRED_DOCUMENTS, DOCUMENT_TYPE_INFO } from '../../types/homologation';

/**
 * Type for wizard output - excludes organizationId and userId
 * which are added by the parent component
 */
type WizardDossierInput = Omit<CreateHomologationDossierInput, 'organizationId' | 'userId'>;

interface LevelDeterminationWizardProps {
  onComplete: (input: WizardDossierInput) => Promise<void>;
  onCancel: () => void;
  linkedEbiosAnalysisId?: string;
  linkedSystemId?: string;
  initialSystemScope?: string;
}

type WizardStep = 'questions' | 'recommendation' | 'override' | 'details';

const LEVEL_ICONS: Record<HomologationLevel, LucideIcon> = {
  etoile: Star,
  simple: FileText,
  standard: Shield,
  renforce: ShieldAlert
};

export const LevelDeterminationWizard: React.FC<LevelDeterminationWizardProps> = ({
  onComplete,
  onCancel,
  linkedEbiosAnalysisId,
  linkedSystemId,
  initialSystemScope
}) => {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('questions');
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, LevelDeterminationAnswer>>(new Map());
  const [recommendation, setRecommendation] = useState<LevelRecommendation | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<HomologationLevel | null>(null);
  const [overrideJustification, setOverrideJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dossier details
  const [dossierName, setDossierName] = useState('');
  const [dossierDescription, setDossierDescription] = useState('');
  const [systemScope, setSystemScope] = useState(initialSystemScope || '');

  // Current category and its questions
  const currentCategory = CATEGORY_ORDER[currentCategoryIndex];
  const categoryQuestions = useMemo(
    () => getQuestionsByCategory(currentCategory),
    [currentCategory]
  );
  const categoryInfo = CATEGORY_INFO[currentCategory];

  // Progress calculation
  const progress = useMemo(() => {
    const totalCategories = CATEGORY_ORDER.length;
    const baseProgress = (currentCategoryIndex / totalCategories) * 100;

    if (currentStep === 'recommendation') return 80;
    if (currentStep === 'override') return 90;
    if (currentStep === 'details') return 95;

    // Within questions, add progress for answered questions in current category
    const answeredInCategory = categoryQuestions.filter((q) => answers.has(q.id)).length;
    const categoryProgress =
      categoryQuestions.length > 0 ? (answeredInCategory / categoryQuestions.length) * 20 : 0;

    return Math.min(baseProgress + categoryProgress, 75);
  }, [currentStep, currentCategoryIndex, categoryQuestions, answers]);

  // Check if current category is complete
  const isCategoryComplete = useMemo(() => {
    const requiredQuestions = categoryQuestions.filter((q) => q.required);
    return requiredQuestions.every((q) => answers.has(q.id));
  }, [categoryQuestions, answers]);

  // Set an answer
  const handleSetAnswer = useCallback(
    (questionId: string, value: string | string[]) => {
      const processedAnswer = HomologationService.processAnswer(questionId, value);
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(questionId, processedAnswer);
        return next;
      });
    },
    []
  );

  // Navigate between categories
  const handleNextCategory = useCallback(() => {
    if (currentCategoryIndex < CATEGORY_ORDER.length - 1) {
      setCurrentCategoryIndex((prev) => prev + 1);
    } else {
      // Calculate recommendation
      const answersArray = Array.from(answers.values());
      const result = HomologationService.calculateLevelRecommendation(answersArray);
      setRecommendation(result);
      setSelectedLevel(result.recommendedLevel);
      setCurrentStep('recommendation');
    }
  }, [currentCategoryIndex, answers]);

  const handlePrevCategory = useCallback(() => {
    if (currentCategoryIndex > 0) {
      setCurrentCategoryIndex((prev) => prev - 1);
    }
  }, [currentCategoryIndex]);

  // Handle level selection
  const handleSelectLevel = useCallback((level: HomologationLevel) => {
    setSelectedLevel(level);
    setOverrideJustification('');
  }, []);

  // Handle confirmation
  const handleConfirmLevel = useCallback(() => {
    if (!recommendation || !selectedLevel) return;

    if (selectedLevel !== recommendation.recommendedLevel) {
      setCurrentStep('override');
    } else {
      setCurrentStep('details');
    }
  }, [recommendation, selectedLevel]);

  // Handle override confirmation
  const handleConfirmOverride = useCallback(() => {
    if (!selectedLevel) return;

    const validationError = HomologationService.validateLevelOverride(
      recommendation?.recommendedLevel || selectedLevel,
      selectedLevel,
      overrideJustification
    );

    if (validationError) {
      // Show error - could add toast here
      alert(validationError);
      return;
    }

    setCurrentStep('details');
  }, [recommendation, selectedLevel, overrideJustification]);

  // Handle final submission
  const handleSubmit = useCallback(async () => {
    if (!recommendation || !selectedLevel || !dossierName.trim() || !systemScope.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const isOverridden = selectedLevel !== recommendation.recommendedLevel;

      const input: WizardDossierInput = {
        name: dossierName.trim(),
        description: dossierDescription.trim() || undefined,
        systemScope: systemScope.trim(),
        level: selectedLevel,
        levelJustification: isOverridden
          ? overrideJustification
          : recommendation.justification,
        levelOverridden: isOverridden,
        originalRecommendation: isOverridden ? recommendation.recommendedLevel : undefined,
        determinationAnswers: Array.from(answers.values()),
        recommendationScore: recommendation.score,
        responsibleId: '', // Will be set by the parent
        linkedEbiosAnalysisId,
        linkedSystemId
      };

      await onComplete(input);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    recommendation,
    selectedLevel,
    dossierName,
    dossierDescription,
    systemScope,
    overrideJustification,
    answers,
    linkedEbiosAnalysisId,
    linkedSystemId,
    onComplete
  ]);

  // Render question
  const renderQuestion = (question: LevelDeterminationQuestion) => {
    const answer = answers.get(question.id);
    const questionText = isEnglish && question.questionEn ? question.questionEn : question.question;
    const helpText = isEnglish && question.helpTextEn ? question.helpTextEn : question.helpText;

    return (
      <Card key={question.id} className="p-4 mb-4">
        <div className="flex items-start gap-2 mb-3">
          <span className="font-medium text-foreground">{questionText}</span>
          {helpText && (
            <Tooltip content={helpText}>
              <Info className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0" />
            </Tooltip>
          )}
          {question.required && (
            <Badge variant="outline" className="text-xs ml-auto">
              {t('common.required', 'Requis')}
            </Badge>
          )}
        </div>

        {question.answerType === 'single' ? (
          <RadioGroup
            value={
              answer
                ? Array.isArray(answer.value)
                  ? answer.value[0]
                  : answer.value
                : ''
            }
            onValueChange={(value) => handleSetAnswer(question.id, value)}
          >
            <div className="space-y-2">
              {question.options.map((option) => {
                const optionLabel =
                  isEnglish && option.labelEn ? option.labelEn : option.label;
                return (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} />
                    <Label
                      htmlFor={`${question.id}-${option.value}`}
                      className="cursor-pointer flex items-center gap-2"
                    >
                      {optionLabel}
                      {option.escalatesTo && (
                        <Badge variant="soft" className="text-xs">
                          Min: {LEVEL_INFO[option.escalatesTo].label}
                        </Badge>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        ) : (
          <div className="space-y-2">
            {question.options.map((option) => {
              const optionLabel = isEnglish && option.labelEn ? option.labelEn : option.label;
              const selectedValues = answer
                ? Array.isArray(answer.value)
                  ? answer.value
                  : [answer.value]
                : [];
              const isChecked = selectedValues.includes(option.value);

              return (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${option.value}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      let newValues: string[];
                      if (checked) {
                        // Special case: if 'none' is selected, clear others
                        if (option.value === 'none') {
                          newValues = ['none'];
                        } else {
                          // Remove 'none' if selecting something else
                          newValues = [
                            ...selectedValues.filter((v) => v !== 'none'),
                            option.value
                          ];
                        }
                      } else {
                        newValues = selectedValues.filter((v) => v !== option.value);
                      }
                      handleSetAnswer(question.id, newValues);
                    }}
                  />
                  <Label
                    htmlFor={`${question.id}-${option.value}`}
                    className="cursor-pointer flex items-center gap-2"
                  >
                    {optionLabel}
                    {option.escalatesTo && (
                      <Badge variant="soft" className="text-xs">
                        Min: {LEVEL_INFO[option.escalatesTo].label}
                      </Badge>
                    )}
                  </Label>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  };

  // Render level card
  const renderLevelCard = (level: HomologationLevel) => {
    const info = LEVEL_INFO[level];
    const Icon = LEVEL_ICONS[level];
    const isSelected = selectedLevel === level;
    const isRecommended = recommendation?.recommendedLevel === level;
    const docs = REQUIRED_DOCUMENTS[level];

    return (
      <Card
        key={level}
        className={cn(
          'p-4 cursor-pointer transition-all border-2',
          isSelected ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted',
          isRecommended && !isSelected && 'ring-2 ring-offset-2 ring-primary/30'
        )}
        onClick={() => handleSelectLevel(level)}
      >
        <div className="flex items-start gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${info.color}20`, color: info.color }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{info.label}</span>
              {isRecommended && (
                <Badge variant="default" className="text-xs">
                  {t('homologation.recommended', 'Recommandé')}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isEnglish ? info.descriptionEn : info.description}
            </p>
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                {docs.length} {t('homologation.documentsRequired', 'documents requis')}
              </span>
            </div>
          </div>
          {isSelected && (
            <Check className="h-5 w-5 text-primary flex-shrink-0" />
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {currentStep === 'questions' && (
              <>
                {t('homologation.step', 'Étape')} {currentCategoryIndex + 1}/{CATEGORY_ORDER.length}:{' '}
                {isEnglish ? categoryInfo.labelEn : categoryInfo.label}
              </>
            )}
            {currentStep === 'recommendation' && t('homologation.levelRecommendation', 'Recommandation de niveau')}
            {currentStep === 'override' && t('homologation.levelOverride', 'Justification du niveau')}
            {currentStep === 'details' && t('homologation.dossierDetails', 'Détails du dossier')}
          </span>
          <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {currentStep === 'questions' && (
          <motion.div
            key={`category-${currentCategory}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-4">
              <p className="text-muted-foreground">
                {isEnglish ? categoryInfo.descriptionEn : categoryInfo.description}
              </p>
            </div>

            <div className="space-y-4">
              {categoryQuestions.map(renderQuestion)}
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={currentCategoryIndex > 0 ? handlePrevCategory : onCancel}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                {currentCategoryIndex > 0
                  ? t('common.previous', 'Précédent')
                  : t('common.cancel', 'Annuler')}
              </Button>
              <Button onClick={handleNextCategory} disabled={!isCategoryComplete}>
                {currentCategoryIndex < CATEGORY_ORDER.length - 1
                  ? t('common.next', 'Suivant')
                  : t('homologation.seeRecommendation', 'Voir la recommandation')}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {currentStep === 'recommendation' && recommendation && (
          <motion.div
            key="recommendation"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Score */}
            <Card className="p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{t('homologation.evaluationScore', 'Score d\'évaluation')}</span>
                <span className="text-2xl font-bold">{recommendation.score}/100</span>
              </div>
              <Progress value={recommendation.score} className="h-2 mb-3" />
              <p className="text-sm text-muted-foreground">{recommendation.justification}</p>
              {recommendation.keyFactors.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('homologation.keyFactors', 'Facteurs clés')}:
                  </span>
                  <ul className="mt-1 space-y-1">
                    {recommendation.keyFactors.map((factor, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            {/* Level selection */}
            <div className="mb-4">
              <h3 className="font-medium mb-3">
                {t('homologation.selectLevel', 'Sélectionnez le niveau d\'homologation')}
              </h3>
              <div className="grid gap-3">
                {(['etoile', 'simple', 'standard', 'renforce'] as HomologationLevel[]).map(
                  renderLevelCard
                )}
              </div>
            </div>

            {/* Warning if selecting lower level */}
            {selectedLevel &&
              recommendation.recommendedLevel &&
              selectedLevel !== recommendation.recommendedLevel && (
                <Card className="p-4 mb-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        {t('homologation.levelOverrideWarning', 'Modification du niveau recommandé')}
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {t(
                          'homologation.justificationRequired',
                          'Une justification sera requise pour expliquer ce choix.'
                        )}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep('questions');
                  setCurrentCategoryIndex(CATEGORY_ORDER.length - 1);
                }}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                {t('common.previous', 'Précédent')}
              </Button>
              <Button onClick={handleConfirmLevel} disabled={!selectedLevel}>
                {t('common.continue', 'Continuer')}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {currentStep === 'override' && selectedLevel && (
          <motion.div
            key="override"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6 mb-6">
              <h3 className="font-medium mb-4">
                {t('homologation.justifyOverride', 'Justifiez la modification du niveau')}
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t('homologation.recommendedLevel', 'Niveau recommandé')}:
                  </span>
                  <Badge variant="outline">
                    {recommendation ? LEVEL_INFO[recommendation.recommendedLevel].label : '-'}
                  </Badge>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t('homologation.selectedLevel', 'Niveau sélectionné')}:
                  </span>
                  <Badge variant="default">{LEVEL_INFO[selectedLevel].label}</Badge>
                </div>
              </div>
              <Textarea
                value={overrideJustification}
                onChange={(e) => setOverrideJustification(e.target.value)}
                placeholder={t(
                  'homologation.justificationPlaceholder',
                  'Expliquez les raisons de cette modification (minimum 20 caractères)...'
                )}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {overrideJustification.length}/20 {t('common.characters', 'caractères')} minimum
              </p>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('recommendation')}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                {t('common.previous', 'Précédent')}
              </Button>
              <Button
                onClick={handleConfirmOverride}
                disabled={overrideJustification.trim().length < 20}
              >
                {t('common.continue', 'Continuer')}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {currentStep === 'details' && selectedLevel && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-6 mb-6">
              <h3 className="font-medium mb-4">
                {t('homologation.dossierInformation', 'Informations du dossier')}
              </h3>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="dossierName">
                    {t('homologation.dossierName', 'Nom du dossier')} *
                  </Label>
                  <Input
                    id="dossierName"
                    value={dossierName}
                    onChange={(e) => setDossierName(e.target.value)}
                    placeholder={t('homologation.dossierNamePlaceholder', 'Ex: Homologation SI RH 2026')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="systemScope">
                    {t('homologation.systemScope', 'Système / Périmètre')} *
                  </Label>
                  <Input
                    id="systemScope"
                    value={systemScope}
                    onChange={(e) => setSystemScope(e.target.value)}
                    placeholder={t(
                      'homologation.systemScopePlaceholder',
                      'Ex: Système d\'information des ressources humaines'
                    )}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="dossierDescription">
                    {t('homologation.dossierDescription', 'Description')}
                  </Label>
                  <Textarea
                    id="dossierDescription"
                    value={dossierDescription}
                    onChange={(e) => setDossierDescription(e.target.value)}
                    placeholder={t('homologation.descriptionPlaceholder', 'Description optionnelle...')}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
            </Card>

            {/* Documents preview */}
            <Card className="p-6 mb-6">
              <h3 className="font-medium mb-3">
                {t('homologation.requiredDocuments', 'Documents requis')} ({REQUIRED_DOCUMENTS[selectedLevel].length})
              </h3>
              <div className="space-y-2">
                {REQUIRED_DOCUMENTS[selectedLevel].map((docType) => {
                  const docInfo = DOCUMENT_TYPE_INFO[docType];
                  return (
                    <div key={docType} className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{isEnglish ? docInfo.labelEn : docInfo.label}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentStep(
                    selectedLevel !== recommendation?.recommendedLevel ? 'override' : 'recommendation'
                  )
                }
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                {t('common.previous', 'Précédent')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!dossierName.trim() || !systemScope.trim() || isSubmitting}
              >
                {isSubmitting
                  ? t('common.creating', 'Création...')
                  : t('homologation.createDossier', 'Créer le dossier')}
                <Check className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LevelDeterminationWizard;
