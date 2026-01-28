/**
 * ROI Calculator Component
 * Epic 39: Financial Risk Quantification
 * Story 39-3: Security ROI Calculator
 *
 * Interactive calculator for security investment ROI.
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Target,
  Info,
  BarChart3,
  PieChart
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/Badge';
import { Progress } from '../ui/progress';
import { Tooltip } from '../ui/Tooltip';
import { ROICalculatorService } from '../../services/ROICalculatorService';

// ============================================================================
// Types
// ============================================================================

interface ROICalculatorProps {
  currentALE?: number; // Current Annual Loss Expectancy from FAIR
  currency?: 'EUR' | 'USD' | 'GBP';
}

interface CalculatorInputs {
  currentALE: number;
  investmentCost: number;
  annualMaintenanceCost: number;
  expectedControlImprovement: number;
  analysisYears: number;
}

// ============================================================================
// Component
// ============================================================================

export const ROICalculator: React.FC<ROICalculatorProps> = ({
  currentALE = 100000,
  currency = 'EUR'
}) => {
  const { t } = useTranslation();

  const [inputs, setInputs] = useState<CalculatorInputs>({
    currentALE,
    investmentCost: 50000,
    annualMaintenanceCost: 10000,
    expectedControlImprovement: 20,
    analysisYears: 3
  });

  // Calculate ROI
  const results = useMemo(() => {
    return ROICalculatorService.quickEstimate(
      inputs.currentALE,
      inputs.expectedControlImprovement,
      inputs.investmentCost,
      inputs.annualMaintenanceCost,
      inputs.analysisYears
    );
  }, [inputs]);

  const rosiStatus = ROICalculatorService.getROSIStatus(results.rosi);

  // Format helpers
  const formatCurrency = (value: number) =>
    ROICalculatorService.formatCurrency(value, currency);

  const formatPayback = (months: number) =>
    ROICalculatorService.formatPayback(months);

  // Handle input change
  const handleInputChange = (field: keyof CalculatorInputs, value: number) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  // Calculate yearly breakdown
  const yearlyBreakdown = useMemo(() => {
    const breakdown = [];
    let cumulativeCost = inputs.investmentCost;
    let cumulativeReduction = 0;

    for (let year = 1; year <= inputs.analysisYears; year++) {
      cumulativeCost += inputs.annualMaintenanceCost;
      cumulativeReduction += results.estimatedReduction;
      breakdown.push({
        year,
        cost: cumulativeCost,
        reduction: cumulativeReduction,
        netPosition: cumulativeReduction - cumulativeCost
      });
    }
    return breakdown;
  }, [inputs, results]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          <Calculator className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">
            {t('roi.title', 'Calculateur ROSI')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('roi.subtitle', 'Retour sur Investissement Sécurité')}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inputs */}
        <Card className="p-6 space-y-5">
          <h4 className="font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-500" />
            {t('roi.inputs', 'Paramètres')}
          </h4>

          {/* Current ALE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="currentALE">
                {t('roi.currentALE', 'ALE Actuelle')}
              </Label>
              <Tooltip content={t('roi.aleHelp', 'Perte annuelle attendue actuelle basée sur l\'analyse FAIR')}>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </Tooltip>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
              <Input
                id="currentALE"
                type="number"
                min="0"
                step="1000"
                value={inputs.currentALE}
                onChange={(e) => handleInputChange('currentALE', Number(e.target.value))}
                className="pl-7"
              />
            </div>
          </div>

          {/* Investment Cost */}
          <div className="space-y-2">
            <Label htmlFor="investmentCost">
              {t('roi.investmentCost', 'Coût d\'investissement')}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
              <Input
                id="investmentCost"
                type="number"
                min="0"
                step="1000"
                value={inputs.investmentCost}
                onChange={(e) => handleInputChange('investmentCost', Number(e.target.value))}
                className="pl-7"
              />
            </div>
          </div>

          {/* Annual Cost */}
          <div className="space-y-2">
            <Label htmlFor="annualCost">
              {t('roi.annualCost', 'Coût annuel (maintenance)')}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
              <Input
                id="annualCost"
                type="number"
                min="0"
                step="1000"
                value={inputs.annualMaintenanceCost}
                onChange={(e) => handleInputChange('annualMaintenanceCost', Number(e.target.value))}
                className="pl-7"
              />
            </div>
          </div>

          {/* Control Improvement */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="controlImprovement">
                {t('roi.controlImprovement', 'Amélioration contrôles')}
              </Label>
              <span className="text-sm font-medium">{inputs.expectedControlImprovement}%</span>
            </div>
            <input
              id="controlImprovement"
              type="range"
              min="5"
              max="50"
              step="5"
              value={inputs.expectedControlImprovement}
              onChange={(e) => handleInputChange('expectedControlImprovement', Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Analysis Years */}
          <div className="space-y-2">
            <Label htmlFor="years">
              {t('roi.analysisYears', 'Période d\'analyse')}
            </Label>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map((year) => (
                <Button
                  key={year}
                  type="button"
                  variant={inputs.analysisYears === year ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleInputChange('analysisYears', year)}
                >
                  {year} {t('common.years', 'ans')}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {/* ROSI Score */}
          <Card className={cn('p-6', results.rosi >= 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950' : 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950')}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {results.rosi >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">{t('roi.rosiScore', 'Score ROSI')}</span>
              </div>
              <Badge className={rosiStatus.color}>{rosiStatus.label}</Badge>
            </div>

            <div className="text-4xl font-bold mb-2">
              {results.rosi >= 0 ? '+' : ''}{results.rosi.toFixed(0)}%
            </div>

            <p className="text-sm text-muted-foreground">
              {rosiStatus.recommendation}
            </p>
          </Card>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">
                  {t('roi.riskReduction', 'Réduction risque/an')}
                </span>
              </div>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(results.estimatedReduction)}
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">
                  {t('roi.payback', 'Délai retour')}
                </span>
              </div>
              <p className="text-xl font-bold">
                {formatPayback(results.paybackMonths)}
              </p>
            </Card>
          </div>

          {/* Net Position Over Time */}
          <Card className="p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              {t('roi.projectedValue', 'Valeur projetée')}
            </h4>
            <div className="space-y-3">
              {yearlyBreakdown.map((year) => (
                <div key={year.year} className="flex items-center gap-3">
                  <span className="text-sm w-16 text-muted-foreground">
                    {t('roi.year', 'An')} {year.year}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span
                        className={cn(
                          'font-medium',
                          year.netPosition >= 0 ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {year.netPosition >= 0 ? '+' : ''}
                        {formatCurrency(year.netPosition)}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(
                        100,
                        Math.max(0, ((year.reduction / (year.cost || 1)) * 100))
                      )}
                      className="h-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Summary */}
      <Card className="p-6">
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <PieChart className="h-4 w-4 text-purple-500" />
          {t('roi.summary', 'Résumé sur {{years}} ans', { years: inputs.analysisYears })}
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t('roi.totalCost', 'Coût total')}</p>
            <p className="text-lg font-semibold">
              {formatCurrency(inputs.investmentCost + (inputs.annualMaintenanceCost * inputs.analysisYears))}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('roi.totalReduction', 'Réduction totale')}</p>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(results.estimatedReduction * inputs.analysisYears)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('roi.netBenefit', 'Bénéfice net')}</p>
            <p className={cn(
              'text-lg font-semibold',
              (results.estimatedReduction * inputs.analysisYears) - (inputs.investmentCost + (inputs.annualMaintenanceCost * inputs.analysisYears)) >= 0
                ? 'text-green-600'
                : 'text-red-600'
            )}>
              {formatCurrency(
                (results.estimatedReduction * inputs.analysisYears) -
                (inputs.investmentCost + (inputs.annualMaintenanceCost * inputs.analysisYears))
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('roi.roiMultiple', 'Multiple ROI')}</p>
            <p className="text-lg font-semibold">
              {((results.estimatedReduction * inputs.analysisYears) /
                Math.max(1, inputs.investmentCost + (inputs.annualMaintenanceCost * inputs.analysisYears))).toFixed(1)}x
            </p>
          </div>
        </div>
      </Card>

      {/* Formula Explanation */}
      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">{t('roi.formula', 'Formule ROSI')}</p>
            <p className="text-muted-foreground font-mono text-xs">
              ROSI = (Réduction du Risque - Coût de l'Investissement) / Coût de l'Investissement × 100
            </p>
            <p className="text-muted-foreground mt-2">
              {t('roi.formulaNote', 'La réduction du risque est estimée sur base de l\'amélioration des contrôles. Chaque 10% d\'amélioration réduit l\'ALE d\'environ 15%.')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ROICalculator;
