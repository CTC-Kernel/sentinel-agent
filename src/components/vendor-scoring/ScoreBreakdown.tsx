/**
 * Score Breakdown Component
 * Displays detailed vendor risk score breakdown
 * Story 37-3: Automated Vendor Scoring
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
 VendorScore,
 SectionScore,
 RiskLevel,
 getRiskLevelConfig,
 getScoreColor,
 getScoreBgColor,
 getScoreGrade,
 formatScore,
} from '../../types/vendorScoring';
import {
 Shield,
 AlertTriangle,
 CheckCircle,
 TrendingUp,
 TrendingDown,
 Minus,
 ChevronDown,
 ChevronUp,
 Info,
} from '../ui/Icons';

interface ScoreBreakdownProps {
 score: VendorScore;
 showDetails?: boolean;
 organizationAverage?: number;
 previousScore?: VendorScore;
 className?: string;
}

/**
 * Score Gauge - Apple Health style circular gauge
 */
const ScoreGauge: React.FC<{
 score: number;
 size?: 'sm' | 'md' | 'lg';
 showGrade?: boolean;
}> = ({ score, size = 'md', showGrade = true }) => {
 const sizes = {
 sm: { width: 80, stroke: 6, fontSize: 'text-lg' },
 md: { width: 120, stroke: 8, fontSize: 'text-2xl' },
 lg: { width: 160, stroke: 10, fontSize: 'text-4xl' },
 };

 const { width, stroke, fontSize } = sizes[size];
 const radius = (width - stroke) / 2;
 const circumference = 2 * Math.PI * radius;
 const progress = (score / 100) * circumference;

 const colorClass = getScoreColor(score);

 return (
 <div className="relative" style={{ width, height: width }}>
 <svg
 width={width}
 height={width}
 viewBox={`0 0 ${width} ${width}`}
 className="transform -rotate-90"
 >
 {/* Background circle */}
 <circle
 cx={width / 2}
 cy={width / 2}
 r={radius}
 fill="none"
 stroke="currentColor"
 strokeWidth={stroke}
 className="text-muted-foreground/60"
 />
 {/* Progress circle */}
 <circle
 cx={width / 2}
 cy={width / 2}
 r={radius}
 fill="none"
 stroke="currentColor"
 strokeWidth={stroke}
 strokeLinecap="round"
 strokeDasharray={circumference}
 strokeDashoffset={circumference - progress}
 className={colorClass}
 style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
 />
 </svg>
 {/* Center content */}
 <div className="absolute inset-0 flex flex-col items-center justify-center">
 <span className={`font-bold ${fontSize} ${colorClass}`}>
 {formatScore(score)}
 </span>
 {showGrade && (
 <span className="text-xs text-muted-foreground">
 {getScoreGrade(score)}
 </span>
 )}
 </div>
 </div>
 );
};

/**
 * Risk Level Badge
 */
const RiskBadge: React.FC<{ level: RiskLevel; size?: 'sm' | 'md' }> = ({
 level,
 size = 'md',
}) => {
 const { t } = useTranslation();
 const config = getRiskLevelConfig(level);

 const sizeClasses = {
 sm: 'px-2 py-0.5 text-xs',
 md: 'px-3 py-1 text-sm',
 };

 return (
 <span
 className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
 >
 {level === 'Critical' && <AlertTriangle className="w-3 h-3" />}
 {level === 'Low' && <CheckCircle className="w-3 h-3" />}
 {t(`vendorScoring.risk.${level.toLowerCase()}`, level)}
 </span>
 );
};

/**
 * Section Score Bar
 */
const SectionScoreBar: React.FC<{
 section: SectionScore;
 expanded?: boolean;
 onToggle?: () => void;
}> = ({ section, expanded = false, onToggle }) => {
 const { t } = useTranslation();
 const displayScore = 100 - section.score; // Invert for display
 const colorClass = getScoreColor(displayScore);
 const bgColorClass = getScoreBgColor(displayScore);

 return (
 <div className="border border-border/40 rounded-3xl overflow-hidden">
 {/* Header */}
 <button
 onClick={onToggle}
 className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
 >
 <div className="flex items-center gap-3">
 <div
 className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColorClass}`}
 >
 <span className={`font-bold ${colorClass}`}>
 {formatScore(displayScore)}
 </span>
 </div>
 <div className="text-left">
 <h4 className="font-medium text-foreground">
 {section.sectionTitle}
 </h4>
 <p className="text-xs text-muted-foreground">
 {section.answeredCount}/{section.questionCount}{' '}
 {t('vendorScoring.questionsAnswered', 'questions answered')}
 {section.criticalIssues > 0 && (
 <span className="text-red-500 ml-2">
  • {section.criticalIssues}{' '}
  {t('vendorScoring.criticalIssues', 'critical issues')}
 </span>
 )}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-3">
 {/* Weight indicator */}
 <span className="text-xs text-muted-foreground">
 {t('vendorScoring.weight', 'Weight')}: {Math.round(section.weight)}%
 </span>
 {onToggle && (
 expanded ? (
 <ChevronUp className="w-5 h-5 text-muted-foreground" />
 ) : (
 <ChevronDown className="w-5 h-5 text-muted-foreground" />
 )
 )}
 </div>
 </button>

 {/* Progress bar */}
 <div className="px-4 pb-4">
 <div className="h-2 bg-muted rounded-full overflow-hidden">
 <div
 className={`h-full transition-all duration-500 ${
 displayScore >= 80
 ? 'bg-green-500'
 : displayScore >= 60
 ? 'bg-yellow-500'
 : displayScore >= 40
 ? 'bg-orange-500'
 : 'bg-red-500'
 }`}
 style={{ width: `${displayScore}%` }}
 />
 </div>
 </div>

 {/* Expanded content - Question scores */}
 {expanded && section.questionScores.length > 0 && (
 <div className="px-4 pb-4 space-y-2 border-t border-border/40 dark:border-white/5 pt-4">
 {section.questionScores.map((qs) => {
 const qDisplayScore = 100 - qs.rawScore;
 const qColorClass = getScoreColor(qDisplayScore);

 return (
 <div
 key={qs.questionId || 'unknown'}
 className="flex items-start gap-3 text-sm"
 >
 <div
  className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${getScoreBgColor(
  qDisplayScore
  )}`}
 >
  <span className={`text-xs font-bold ${qColorClass}`}>
  {formatScore(qDisplayScore)}
  </span>
 </div>
 <div className="flex-1 min-w-0">
  <p className="text-foreground line-clamp-2">
  {qs.questionText}
  </p>
  {qs.isCritical && (
  <span className="inline-flex items-center gap-1 text-xs text-red-500 mt-1">
  <AlertTriangle className="w-3 h-3" />
  {t('vendorScoring.critical', 'Critical')}
  </span>
  )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
};

/**
 * Trend Indicator
 */
const TrendIndicator: React.FC<{
 current: number;
 previous: number;
}> = ({ current, previous }) => {
 const { t } = useTranslation();
 const diff = current - previous;
 const percentage = previous > 0 ? Math.round((Math.abs(diff) / previous) * 100) : 0;

 if (Math.abs(diff) < 3) {
 return (
 <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
 <Minus className="w-4 h-4" />
 {t('vendorScoring.stable', 'Stable')}
 </span>
 );
 }

 if (diff > 0) {
 return (
 <span className="inline-flex items-center gap-1 text-sm text-green-600">
 <TrendingUp className="w-4 h-4" />
 +{percentage}%
 </span>
 );
 }

 return (
 <span className="inline-flex items-center gap-1 text-sm text-red-600">
 <TrendingDown className="w-4 h-4" />
 -{percentage}%
 </span>
 );
};

/**
 * Main Score Breakdown Component
 */
export const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({
 score,
 showDetails = true,
 organizationAverage,
 previousScore,
 className = '',
}) => {
 const { t } = useTranslation();
 const [expandedSection, setExpandedSection] = React.useState<string | null>(null);

 return (
 <div className={`space-y-6 ${className}`}>
 {/* Header with overall score */}
 <div className="flex items-start gap-6">
 <ScoreGauge score={score.displayScore} size="lg" />

 <div className="flex-1 space-y-3">
 <div>
 <h3 className="text-lg font-semibold text-foreground">
 {t('vendorScoring.overallScore', 'Overall Security Score')}
 </h3>
 <div className="flex items-center gap-3 mt-1">
 <RiskBadge level={score.inherentRisk} />
 {score.residualRisk !== score.inherentRisk && (
 <>
  <span className="text-muted-foreground">→</span>
  <RiskBadge level={score.residualRisk} size="sm" />
  <span className="text-xs text-muted-foreground">
  ({t('vendorScoring.afterMitigation', 'after mitigation')})
  </span>
 </>
 )}
 </div>
 </div>

 {/* Stats row */}
 <div className="flex items-center gap-6 text-sm">
 {previousScore && (
 <div>
 <span className="text-muted-foreground mr-2">
  {t('vendorScoring.trend', 'Trend')}:
 </span>
 <TrendIndicator
  current={score.displayScore}
  previous={previousScore.displayScore}
 />
 </div>
 )}

 {organizationAverage !== undefined && (
 <div className="flex items-center gap-2">
 <span className="text-muted-foreground">
  {t('vendorScoring.vsAverage', 'vs Avg')}:
 </span>
 <span
  className={`font-medium ${
  score.displayScore >= organizationAverage
  ? 'text-green-600'
  : 'text-red-600'
  }`}
 >
  {score.displayScore >= organizationAverage ? '+' : ''}
  {score.displayScore - organizationAverage}
 </span>
 </div>
 )}

 {score.criticalIssuesCount > 0 && (
 <div className="flex items-center gap-1 text-red-600">
 <AlertTriangle className="w-4 h-4" />
 <span>
  {score.criticalIssuesCount}{' '}
  {t('vendorScoring.criticalIssues', 'critical issues')}
 </span>
 </div>
 )}
 </div>

 {/* Completion info */}
 <div className="text-sm text-muted-foreground">
 {score.answeredQuestions}/{score.totalQuestions}{' '}
 {t('vendorScoring.questionsAnswered', 'questions answered')} •{' '}
 {t('vendorScoring.calculatedAt', 'Calculated')}{' '}
 {new Date(score.calculatedAt).toLocaleDateString()}
 </div>
 </div>
 </div>

 {/* Mitigating factors */}
 {score.mitigatingFactors && score.mitigatingFactors.length > 0 && (
 <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 dark:border-green-800 rounded-3xl p-4">
 <h4 className="font-medium text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
 <Shield className="w-4 h-4" />
 {t('vendorScoring.mitigatingFactors', 'Mitigating Factors')}
 </h4>
 <div className="flex flex-wrap gap-2">
 {score.mitigatingFactors.map((factor, idx) => (
 <span
 key={idx || 'unknown'}
 className="inline-flex items-center gap-1 px-2 py-1 bg-card rounded-lg text-sm text-green-700 dark:text-green-400"
 >
 <CheckCircle className="w-3 h-3" />
 {factor.name}
 <span className="text-xs text-green-500">
  (-{factor.riskReduction}%)
 </span>
 </span>
 ))}
 </div>
 </div>
 )}

 {/* Section breakdown */}
 {showDetails && score.sectionScores.length > 0 && (
 <div className="space-y-3">
 <h4 className="font-medium text-foreground flex items-center gap-2">
 {t('vendorScoring.sectionBreakdown', 'Section Breakdown')}
 <Info className="w-4 h-4 text-muted-foreground" />
 </h4>

 <div className="space-y-3">
 {score.sectionScores.map((section) => (
 <SectionScoreBar
 key={section.sectionId || 'unknown'}
 section={section}
 expanded={expandedSection === section.sectionId}
 onToggle={() =>
  setExpandedSection(
  expandedSection === section.sectionId ? null : section.sectionId
  )
 }
 />
 ))}
 </div>
 </div>
 )}
 </div>
 );
};

export default ScoreBreakdown;
