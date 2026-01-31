import type { TrendType } from '../types/score.types';
import { TREND_THRESHOLD } from '../constants/complianceConfig';

/**
 * Calculate trend direction based on percent change between current and previous values.
 * Uses TREND_THRESHOLD (5%) as the significance threshold.
 */
export function calculateTrend(current: number, previous: number): TrendType {
  if (previous === 0 && current === 0) return 'stable';
  if (previous === 0) return current > 0 ? 'up' : 'stable';

  const percentChange = ((current - previous) / previous) * 100;

  if (percentChange > TREND_THRESHOLD) return 'up';
  if (percentChange < -TREND_THRESHOLD) return 'down';
  return 'stable';
}
