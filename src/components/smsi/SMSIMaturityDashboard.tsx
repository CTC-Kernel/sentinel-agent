/**
 * SMSI Maturity Dashboard Component
 * Displays maturity assessment, recommendations, and certification readiness
 *
 * Story 20.7-20.9: SMSI reports, maturity, and continuous improvement
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import {
  BarChart3,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileCheck,
  Lightbulb,
  ChevronRight,
  Download,
  RefreshCw,
} from '../ui/Icons';
import { Button } from '../ui/button';
import type { SMSIProgram, Milestone, PDCAPhase } from '../../types/ebios';
import {
  SMSIService,
  type MaturityAssessment,
  type CertificationReadiness,
  type SMSIRecommendation,
  MATURITY_LEVELS,
} from '../../services/SMSIService';

interface SMSIMaturityDashboardProps {
  program: SMSIProgram;
  milestones: Milestone[];
  onDownloadCertificationReport?: () => void;
}

export const SMSIMaturityDashboard: React.FC<SMSIMaturityDashboardProps> = ({
  program,
  milestones,
  onDownloadCertificationReport,
}) => {
  const { t } = useTranslation();
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  // Calculate maturity and readiness
  const maturity = useMemo(
    () => SMSIService.calculateMaturityAssessment(program, milestones),
    [program, milestones]
  );

  const readiness = useMemo(
    () => SMSIService.assessCertificationReadiness(program, milestones, maturity),
    [program, milestones, maturity]
  );

  // Handle certification report download
  const handleDownloadReport = () => {
    if (onDownloadCertificationReport) {
      onDownloadCertificationReport();
    } else {
      SMSIService.downloadCertificationReport(program, milestones, {
        includeRecommendations: true,
      });
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const levelColors: Record<string, string> = {
    red: 'text-red-500 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    orange: 'text-orange-500 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
    yellow: 'text-yellow-500 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    blue: 'text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    green: 'text-green-500 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
  };

  return (
    <div className="space-y-6">
      {/* Overall Maturity Score */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('smsi.maturity.title', 'Maturité SMSI')}
              </h3>
              <p className="text-sm text-slate-500">
                {t('smsi.maturity.subtitle', 'Évaluation de la maturité ISO 27001')}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadReport}
            className="gap-1.5"
          >
            <Download className="w-4 h-4" />
            {t('smsi.maturity.downloadReport', 'Rapport')}
          </Button>
        </div>

        {/* Main Score Display */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score Gauge */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-700">
            <div className="relative w-32 h-32">
              {/* Background circle */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-slate-200 dark:text-slate-700"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(maturity.overall.score / 100) * 351.86} 351.86`}
                  className={cn(
                    maturity.overall.level.color === 'green' ? 'text-green-500' :
                    maturity.overall.level.color === 'blue' ? 'text-blue-500' :
                    maturity.overall.level.color === 'yellow' ? 'text-yellow-500' :
                    maturity.overall.level.color === 'orange' ? 'text-orange-500' :
                    'text-red-500'
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {maturity.overall.score}%
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  {getTrendIcon(maturity.overall.trend)}
                </span>
              </div>
            </div>
            <div className={cn(
              "mt-4 px-4 py-2 rounded-full border font-bold text-sm",
              levelColors[maturity.overall.level.color]
            )}>
              {maturity.overall.level.label}
            </div>
            <p className="mt-2 text-xs text-slate-500 text-center max-w-[200px]">
              {maturity.overall.level.description}
            </p>
          </div>

          {/* Phase Scores */}
          <div className="lg:col-span-2">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
              {t('smsi.maturity.phases', 'Scores par Phase PDCA')}
            </h4>
            <div className="space-y-4">
              {(['plan', 'do', 'check', 'act'] as PDCAPhase[]).map((phase) => {
                const phaseData = maturity.phases[phase];
                const phaseLabels: Record<PDCAPhase, string> = {
                  plan: 'Plan - Planifier',
                  do: 'Do - Déployer',
                  check: 'Check - Contrôler',
                  act: 'Act - Améliorer',
                };
                const phaseColors: Record<PDCAPhase, string> = {
                  plan: 'bg-blue-500',
                  do: 'bg-green-500',
                  check: 'bg-purple-500',
                  act: 'bg-orange-500',
                };

                return (
                  <div key={phase} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", phaseColors[phase])} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {phaseLabels[phase]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{phaseData.completedMilestones}/{phaseData.totalMilestones} jalons</span>
                        {phaseData.overdueMilestones > 0 && (
                          <Badge status="error" size="sm">
                            {phaseData.overdueMilestones} en retard
                          </Badge>
                        )}
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {phaseData.score}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${phaseData.score}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={cn("h-full rounded-full", phaseColors[phase])}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Certification Readiness */}
      <GlassCard className={cn(
        "p-6 border-2",
        readiness.ready
          ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
          : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl",
              readiness.ready
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
            )}>
              {readiness.ready ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('smsi.certification.title', 'État de préparation à la certification')}
              </h3>
              <p className="text-sm text-slate-500">
                Score: <span className="font-bold">{readiness.score}%</span>
              </p>
            </div>
          </div>
          <Badge
            status={readiness.ready ? 'success' : 'warning'}
            className="text-sm"
          >
            {readiness.ready
              ? t('smsi.certification.ready', 'Prêt')
              : t('smsi.certification.notReady', 'Actions requises')}
          </Badge>
        </div>

        {/* Blockers & Warnings */}
        {readiness.blockers.length > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-red-100/80 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <h4 className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400 mb-2">
              <XCircle className="w-4 h-4" />
              Points bloquants
            </h4>
            <ul className="space-y-1">
              {readiness.blockers.map((blocker, i) => (
                <li key={i} className="text-sm text-red-600 dark:text-red-400">• {blocker}</li>
              ))}
            </ul>
          </div>
        )}

        {readiness.warnings.length > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-amber-100/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <h4 className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
              <AlertTriangle className="w-4 h-4" />
              Points d'attention
            </h4>
            <ul className="space-y-1">
              {readiness.warnings.map((warning, i) => (
                <li key={i} className="text-sm text-amber-600 dark:text-amber-400">• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Checklist toggle */}
        <button
          onClick={() => setShowChecklist(!showChecklist)}
          className="flex items-center justify-between w-full p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors group"
        >
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Checklist de certification
            </span>
            <Badge variant="outline" size="sm">
              {readiness.checklist.filter(c => c.status === 'passed').length}/{readiness.checklist.length}
            </Badge>
          </div>
          <ChevronRight className={cn(
            "w-5 h-5 text-slate-400 transition-transform",
            showChecklist && "rotate-90"
          )} />
        </button>

        {showChecklist && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 space-y-2"
          >
            {readiness.checklist.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border",
                  item.status === 'passed' && "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800",
                  item.status === 'warning' && "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800",
                  item.status === 'failed' && "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800",
                  item.status === 'not_applicable' && "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                )}
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.item}</span>
                <div className="flex items-center gap-2">
                  {item.details && (
                    <span className="text-xs text-slate-500 max-w-[200px] truncate">{item.details}</span>
                  )}
                  {item.status === 'passed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {item.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                  {item.status === 'failed' && <XCircle className="w-5 h-5 text-red-500" />}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </GlassCard>

      {/* Recommendations */}
      {maturity.recommendations.length > 0 && (
        <GlassCard className="p-6">
          <button
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="flex items-center justify-between w-full group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                <Lightbulb className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('smsi.recommendations.title', 'Recommandations d\'amélioration')}
                </h3>
                <p className="text-sm text-slate-500">
                  {maturity.recommendations.length} recommandation(s) disponible(s)
                </p>
              </div>
            </div>
            <ChevronRight className={cn(
              "w-6 h-6 text-slate-400 transition-transform",
              showRecommendations && "rotate-90"
            )} />
          </button>

          {showRecommendations && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-6 space-y-3"
            >
              {maturity.recommendations.map((rec) => (
                <RecommendationCard key={rec.id} recommendation={rec} />
              ))}
            </motion.div>
          )}
        </GlassCard>
      )}

      {/* Dimension Scores */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-500" />
          {t('smsi.dimensions.title', 'Dimensions de la sécurité')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DimensionCard
            title="Gouvernance"
            score={maturity.dimensions.governance}
            icon={<Shield className="w-5 h-5" />}
            color="blue"
          />
          <DimensionCard
            title="Gestion des risques"
            score={maturity.dimensions.riskManagement}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="orange"
          />
          <DimensionCard
            title="Protection des actifs"
            score={maturity.dimensions.assetProtection}
            icon={<FileCheck className="w-5 h-5" />}
            color="green"
          />
          <DimensionCard
            title="Amélioration continue"
            score={maturity.dimensions.continuousImprovement}
            icon={<RefreshCw className="w-5 h-5" />}
            color="purple"
          />
        </div>
      </GlassCard>

      {/* Maturity Levels Legend */}
      <GlassCard className="p-4">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
          {t('smsi.maturity.legend', 'Échelle de maturité')}
        </h4>
        <div className="flex flex-wrap gap-2">
          {MATURITY_LEVELS.map((level) => (
            <div
              key={level.level}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium",
                levelColors[level.color]
              )}
            >
              <span className="font-bold">{level.level}</span>
              <span>{level.label}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};

/**
 * Dimension score card
 */
interface DimensionCardProps {
  title: string;
  score: number;
  icon: React.ReactNode;
  color: 'blue' | 'orange' | 'green' | 'purple';
}

const DimensionCard: React.FC<DimensionCardProps> = ({ title, score, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  };

  const barColors = {
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className={cn("p-4 rounded-xl border", colorClasses[color])}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-bold truncate">{title}</span>
      </div>
      <div className="text-2xl font-bold mb-2">{score}%</div>
      <div className="w-full h-2 bg-white/50 dark:bg-slate-800/50 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColors[color])}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Recommendation card
 */
interface RecommendationCardProps {
  recommendation: SMSIRecommendation;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation }) => {
  const priorityStyles = {
    critical: 'border-l-red-500 bg-red-50/50 dark:bg-red-900/10',
    high: 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-900/10',
    medium: 'border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10',
    low: 'border-l-green-500 bg-green-50/50 dark:bg-green-900/10',
  };

  const priorityBadges = {
    critical: 'error',
    high: 'warning',
    medium: 'info',
    low: 'success',
  } as const;

  const categoryLabels: Record<string, string> = {
    governance: 'Gouvernance',
    risk: 'Risques',
    operations: 'Opérations',
    improvement: 'Amélioration',
    documentation: 'Documentation',
  };

  return (
    <div className={cn(
      "p-4 rounded-xl border border-l-4",
      priorityStyles[recommendation.priority]
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge status={priorityBadges[recommendation.priority]} size="sm">
              {recommendation.priority.toUpperCase()}
            </Badge>
            <Badge variant="outline" size="sm">
              {categoryLabels[recommendation.category]}
            </Badge>
            <Badge variant="outline" size="sm">
              Phase {recommendation.targetPhase.toUpperCase()}
            </Badge>
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white">
            {recommendation.title}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {recommendation.description}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>Effort: {recommendation.estimatedEffort}</div>
          <div>Impact: {recommendation.impact}</div>
        </div>
      </div>
    </div>
  );
};

export default SMSIMaturityDashboard;
