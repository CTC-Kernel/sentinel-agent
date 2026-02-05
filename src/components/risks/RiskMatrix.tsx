import React, { useState } from 'react';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { Risk } from '../../types';
import { motion } from 'framer-motion';
import { Info } from '../ui/Icons';
import { useLocale } from '@/hooks/useLocale';
import { RISK_THRESHOLDS } from '../../constants/complianceConfig';

interface RiskMatrixProps {
 risks: Risk[];
 matrixFilter: { p: number; i: number } | null;
 setMatrixFilter: (filter: { p: number; i: number } | null) => void;
 frameworkFilter: string;
}

export const RiskMatrix: React.FC<RiskMatrixProps> = ({ risks, matrixFilter, setMatrixFilter, frameworkFilter }) => {
 const { t } = useLocale();
 const [viewMode, setViewMode] = useState<'inherent' | 'residual'>('inherent');

 // Helper within the component to count risks per cell
 const getRisksForCell = (prob: number, impact: number) =>
 risks.filter(r => {
 const p = viewMode === 'inherent' ? Number(r.probability) : Number(r.residualProbability || r.probability);
 const i = viewMode === 'inherent' ? Number(r.impact) : Number(r.residualImpact || r.impact);
 return p === prob && i === impact && (!frameworkFilter || r.framework === frameworkFilter);
 });

 const PROBABILITY_LABELS = [
 { val: 5, label: t('risks.matrix.probability.veryHigh', { defaultValue: 'Très Élevé' }), sub: t('risks.matrix.probability.certain', { defaultValue: 'Certain' }) },
 { val: 4, label: t('risks.matrix.probability.high', { defaultValue: 'Élevé' }), sub: t('risks.matrix.probability.probable', { defaultValue: 'Probable' }) },
 { val: 3, label: t('risks.matrix.probability.medium', { defaultValue: 'Moyen' }), sub: t('risks.matrix.probability.possible', { defaultValue: 'Possible' }) },
 { val: 2, label: t('risks.matrix.probability.low', { defaultValue: 'Faible' }), sub: t('risks.matrix.probability.improbable', { defaultValue: 'Improbable' }) },
 { val: 1, label: t('risks.matrix.probability.veryLow', { defaultValue: 'Très Faible' }), sub: t('risks.matrix.probability.rare', { defaultValue: 'Rare' }) },
 ];

 const IMPACT_LABELS = [
 { val: 1, label: t('risks.matrix.impact.negligible', { defaultValue: 'Négligeable' }), sub: "" },
 { val: 2, label: t('risks.matrix.impact.minor', { defaultValue: 'Mineur' }), sub: "" },
 { val: 3, label: t('risks.matrix.impact.moderate', { defaultValue: 'Modéré' }), sub: "" },
 { val: 4, label: t('risks.matrix.impact.major', { defaultValue: 'Majeur' }), sub: "" },
 { val: 5, label: t('risks.matrix.impact.critical', { defaultValue: 'Critique' }), sub: "" },
 ];

 return (
 <div className="w-full space-y-6 sm:space-y-8">
 {/* Header & Legend */}
 <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
 <div>
  <h3 className="text-2xl font-bold text-foreground mb-2">{t('risks.matrix.title', { defaultValue: 'Matrice des Risques' })}</h3>
  <p className="text-sm text-muted-foreground max-w-lg">
  {t('risks.matrix.description', { defaultValue: "Visualisation de l'exposition aux risques selon la norme" })} {frameworkFilter || 'ISO 27005'}.
  {' '}{t('risks.matrix.clickToFilter', { defaultValue: 'Cliquez sur une case pour filtrer les risques associés.' })}
  </p>

  {/* View Mode Toggle */}
  <div className="flex items-center gap-2 mt-4 bg-muted p-1 rounded-xl w-fit">
  <button
  onClick={() => setViewMode('inherent')}
  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'inherent'
  ? 'bg-card text-primary shadow-sm'
  : 'text-muted-foreground hover:text-foreground'
  }`}
  >
  {t('risks.matrix.inherentRisk', { defaultValue: 'Risque Inhérent' })}
  </button>
  <button
  onClick={() => setViewMode('residual')}
  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'residual'
  ? 'bg-card text-primary shadow-sm'
  : 'text-muted-foreground hover:text-foreground'
  }`}
  >
  {t('risks.matrix.residualRisk', { defaultValue: 'Risque Résiduel' })}
  </button>
  </div>
 </div>

 <div className="flex flex-wrap gap-3 bg-card/50 p-3 rounded-2xl border border-border/40 shadow-sm backdrop-blur-sm">
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-3xl bg-muted/50 border border-border/40">
  <span className="w-3 h-3 rounded-full bg-success-text shadow-glow shadow-success-text/40"></span>
  <div className="flex flex-col">
  <span className="text-xs font-bold text-foreground">{t('risks.matrix.legend.low', { defaultValue: 'Faible' })}</span>
  <span className="text-[11px] text-muted-foreground">Score 1-4</span>
  </div>
  </div>
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-3xl bg-muted/50 border border-border/40">
  <span className="w-3 h-3 rounded-full bg-info-text shadow-glow shadow-info-text/40"></span>
  <div className="flex flex-col">
  <span className="text-xs font-bold text-foreground">{t('risks.matrix.legend.medium', { defaultValue: 'Moyen' })}</span>
  <span className="text-[11px] text-muted-foreground">Score 5-9</span>
  </div>
  </div>
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-3xl bg-muted/50 border border-border/40">
  <span className="w-3 h-3 rounded-full bg-warning-text shadow-glow shadow-warning-text/40"></span>
  <div className="flex flex-col">
  <span className="text-xs font-bold text-foreground">{t('risks.matrix.legend.high', { defaultValue: 'Élevé' })}</span>
  <span className="text-[11px] text-muted-foreground">Score 10-14</span>
  </div>
  </div>
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-3xl bg-muted/50 border border-border/40">
  <span className="w-3 h-3 rounded-full bg-error-text shadow-glow shadow-error-text/40"></span>
  <div className="flex flex-col">
  <span className="text-xs font-bold text-foreground">{t('risks.matrix.legend.critical', { defaultValue: 'Critique' })}</span>
  <span className="text-[11px] text-muted-foreground">Score 15-25</span>
  </div>
  </div>
 </div>
 </div>

 {/* Matrix Container */}
 <div className="relative p-8 bg-card/50 backdrop-blur-xl rounded-2xl border border-border/40 shadow-xl overflow-hidden">

 {/* Background Decoration */}
 <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 dark:bg-primary/60/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
 <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/20 dark:bg-violet-400/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

 <div className="relative z-10 overflow-x-auto pb-6 scrollbar-hide">
  <div className="min-w-[600px] md:min-w-[700px] mx-auto max-w-5xl grid grid-cols-[auto_auto_repeat(5,1fr)] gap-2 md:gap-4">

  {/* Y-Axis Label */}
  <div className="row-span-5 flex items-center justify-center -mr-4">
  <div className="-rotate-90 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground whitespace-nowrap">
  {t('risks.matrix.probabilityAxis', { defaultValue: 'Probabilité' })}
  </div>
  </div>

  {/* Row Labels & Matrix Cells */}
  {PROBABILITY_LABELS.map((probObj) => (
  <React.Fragment key={probObj.val || 'unknown'}>
  {/* Row Label */}
  <div className="flex flex-col justify-center items-end pr-4 py-2">
   <span className="text-sm font-bold text-foreground">
   {probObj.label}
   </span>
   <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
   {probObj.sub}
   </span>
  </div>

  {/* Cells for this Row */}
  {IMPACT_LABELS.map((impactObj) => {
   const cellRisks = getRisksForCell(probObj.val, impactObj.val);
   const count = cellRisks.length;
   const hasRisks = count > 0;
   const isSelected = matrixFilter?.p === probObj.val && matrixFilter?.i === impactObj.val;
   const score = probObj.val * impactObj.val;

   // Determine Cell Styling
   let cellStyle = "bg-muted/30 border-border/40"; // Default empty
   let textStyle = "text-muted-foreground/30";
   let ringColor = "";

   if (score >= RISK_THRESHOLDS.CRITICAL) {
   cellStyle = hasRisks
   ? "bg-gradient-to-br from-error-bg/80 to-error-bg/20 border-error-border/50 shadow-[inset_0_0_20px_rgba(225,29,72,0.05)]"
   : "bg-error-bg/30 dark:bg-error-bg/10 border-error-border/20";
   textStyle = hasRisks ? "text-error-text" : "text-error-text/30";
   ringColor = "ring-error-border";
   } else if (score >= RISK_THRESHOLDS.HIGH) {
   cellStyle = hasRisks
   ? "bg-gradient-to-br from-warning-bg/80 to-warning-bg/20 border-warning-border/50 shadow-[inset_0_0_20px_rgba(217,119,6,0.05)]"
   : "bg-warning-bg/30 dark:bg-warning-bg/10 border-warning-border/20";
   textStyle = hasRisks ? "text-warning-text" : "text-warning-text/30";
   ringColor = "ring-warning-border";
   } else if (score >= RISK_THRESHOLDS.MEDIUM) {
   cellStyle = hasRisks
   ? "bg-gradient-to-br from-info-bg/80 to-info-bg/20 border-info-border/50 shadow-[inset_0_0_20px_rgba(2,132,199,0.05)]"
   : "bg-info-bg/30 dark:bg-info-bg/10 border-info-border/20";
   textStyle = hasRisks ? "text-info-text" : "text-info-text/30";
   ringColor = "ring-info-border";
   } else {
   cellStyle = hasRisks
   ? "bg-gradient-to-br from-success-bg/80 to-success-bg/20 border-success-border/50 shadow-[inset_0_0_20px_rgba(5,150,105,0.05)]"
   : "bg-success-bg/30 dark:bg-success-bg/10 border-success-border/20";
   textStyle = hasRisks ? "text-success-text" : "text-success-text/30";
   ringColor = "ring-success-border";
   }

   return (
   <CustomTooltip
   key={`${probObj.val || 'unknown'}-${impactObj.val}`}
   content={
   <div className="text-center">
    <div className="font-bold">Score: {score}</div>
    <div className="text-xs opacity-80">{count} {t('risks.matrix.risksLabel', { defaultValue: 'Risque(s)' })}</div>
    <div className="text-[11px] mt-1 text-muted-foreground">{t('risks.matrix.probabilityAxis')}: {probObj.val} x {t('risks.matrix.impactAxis')}: {impactObj.val}</div>
   </div>
   }
   >
   <motion.div
   whileHover={hasRisks ? { scale: 1.05, zIndex: 10 } : {}}
   whileTap={hasRisks ? { scale: 0.95 } : {}}
   onClick={() => hasRisks && setMatrixFilter(isSelected ? null : { p: probObj.val, i: impactObj.val })}
   onKeyDown={(e: React.KeyboardEvent) => {
    if (hasRisks && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    setMatrixFilter(isSelected ? null : { p: probObj.val, i: impactObj.val });
    }
   }}
   tabIndex={hasRisks ? 0 : -1}
   role={hasRisks ? 'button' : undefined}
   aria-label={hasRisks ? `${t('risks.matrix.probabilityAxis')}: ${probObj.label}, ${t('risks.matrix.impactAxis')}: ${impactObj.label} — ${count} ${t('risks.matrix.risksLabel', { defaultValue: 'Risque(s)' })}` : undefined}
   aria-pressed={isSelected}
   className={`
    relative aspect-[1.1] rounded-2xl border transition-all duration-300 group
    flex flex-col items-center justify-center
    ${cellStyle}
    ${hasRisks ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2' : 'cursor-default opacity-80'}
    ${isSelected ? `ring-2 ${ringColor} shadow-lg scale-105 z-20` : matrixFilter && hasRisks ? 'opacity-40 grayscale-[0.5]' : ''}
   `}
   >
   {/* Score Indicator (Always visible, faint) */}
   <span className={`absolute top-2 right-3 text-[11px] font-bold opacity-0 group-hover:opacity-70 transition-opacity ${textStyle}`}>
    {score}
   </span>

   {/* Count */}
   <span className={`text-2xl lg:text-3xl font-black tracking-tight transition-all ${textStyle} ${isSelected ? 'scale-110' : ''}`}>
    {count > 0 ? count : '-'}
   </span>

   {/* Label for populated cells */}
   {hasRisks && (
    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mt-1">
    {t('risks.matrix.risksLabel', { defaultValue: 'Risques' })}
    </span>
   )}

   {!hasRisks && (
    <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:8px_8px] opacity-[0.15]" />
   )}
   </motion.div>
   </CustomTooltip>
   );
  })}
  </React.Fragment>
  ))}

  {/* X-Axis Labels */}
  <div className="col-span-2" /> {/* Spacer for Y-Axis and Row Labels */}
  {IMPACT_LABELS.map(label => (
  <div key={label.val || 'unknown'} className="flex flex-col items-center pt-4">
  <span className="text-sm font-bold text-foreground">{label.label}</span>
  <span className="text-xs font-bold text-muted-foreground mt-1">{t('risks.matrix.level', { defaultValue: 'Niveau' })} {label.val}</span>
  </div>
  ))}

  {/* X-Axis Title */}
  <div className="col-span-2" /> {/* Spacer for Y-Axis and Row Labels */}
  <div className="col-span-5 text-center mt-6">
  <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
  {t('risks.matrix.impactAxis', { defaultValue: 'Impact' })}
  </span>
  </div>

  </div>
 </div>
 </div>

 {/* Info Footer */}
 <div className="flex items-start gap-3 p-4 rounded-2xl bg-info-bg border border-info-border text-sm text-info-text">
 <Info className="h-5 w-5 shrink-0 mt-0.5" />
 <p>
  {t('risks.matrix.infoFooter', { defaultValue: "La matrice des risques permet de visualiser la répartition de vos risques selon leur criticité. La zone rouge représente les risques inacceptables nécessitant une action immédiate. La zone verte représente les risques acceptables ou sous contrôle." })}
 </p>
 </div>
 </div>
 );
};
