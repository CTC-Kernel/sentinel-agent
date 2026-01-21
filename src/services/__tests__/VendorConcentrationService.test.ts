/**
 * VendorConcentrationService Tests
 * Story 37-4: Vendor Concentration Dashboard
 *
 * Tests for concentration metrics calculation, SPOF detection,
 * and recommendation generation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateHHI,
  getHHILevel,
  getDependencyLevel,
  isSPOF,
  getImpactLevel,
  getUrgencyLevel,
  getDependencyLevelColor,
  getDependencyLevelBgColor,
  getPriorityColor,
  formatPercentage,
  getTrendIndicator,
  getCategoryLabel,
  CATEGORY_LABELS,
} from '../../types/vendorConcentration';

// ============================================================================
// HHI Calculation Tests
// ============================================================================

describe('VendorConcentrationService - HHI Calculation', () => {
  describe('calculateHHI', () => {
    it('should calculate HHI for equal market shares', () => {
      // 4 vendors with 25% each: 4 * 25^2 = 2500
      const hhi = calculateHHI([25, 25, 25, 25]);
      expect(hhi).toBe(2500);
    });

    it('should calculate HHI for monopoly (100%)', () => {
      // Single vendor with 100%: 100^2 = 10000
      const hhi = calculateHHI([100]);
      expect(hhi).toBe(10000);
    });

    it('should calculate HHI for competitive market', () => {
      // 10 vendors with 10% each: 10 * 10^2 = 1000
      const hhi = calculateHHI([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
      expect(hhi).toBe(1000);
    });

    it('should calculate HHI for concentrated market', () => {
      // 1 vendor with 60%, 2 with 20%: 60^2 + 20^2 + 20^2 = 3600 + 400 + 400 = 4400
      const hhi = calculateHHI([60, 20, 20]);
      expect(hhi).toBe(4400);
    });

    it('should handle empty array', () => {
      const hhi = calculateHHI([]);
      expect(hhi).toBe(0);
    });

    it('should handle single small share', () => {
      const hhi = calculateHHI([5]);
      expect(hhi).toBe(25);
    });
  });

  describe('getHHILevel', () => {
    it('should return low for HHI < 1500', () => {
      expect(getHHILevel(0)).toBe('low');
      expect(getHHILevel(500)).toBe('low');
      expect(getHHILevel(1000)).toBe('low');
      expect(getHHILevel(1499)).toBe('low');
    });

    it('should return moderate for HHI 1500-2499', () => {
      expect(getHHILevel(1500)).toBe('moderate');
      expect(getHHILevel(2000)).toBe('moderate');
      expect(getHHILevel(2499)).toBe('moderate');
    });

    it('should return high for HHI >= 2500', () => {
      expect(getHHILevel(2500)).toBe('high');
      expect(getHHILevel(5000)).toBe('high');
      expect(getHHILevel(10000)).toBe('high');
    });
  });
});

// ============================================================================
// Dependency Level Tests
// ============================================================================

describe('VendorConcentrationService - Dependency Level', () => {
  describe('getDependencyLevel', () => {
    it('should return critical for high critical services count', () => {
      expect(getDependencyLevel(10, 3, 0)).toBe('critical');
      expect(getDependencyLevel(5, 5, 0)).toBe('critical');
    });

    it('should return critical for high category share', () => {
      expect(getDependencyLevel(5, 0, 50)).toBe('critical');
      expect(getDependencyLevel(3, 1, 60)).toBe('critical');
    });

    it('should return high for moderate critical services', () => {
      expect(getDependencyLevel(5, 2, 0)).toBe('high');
      expect(getDependencyLevel(5, 2, 25)).toBe('high');
    });

    it('should return high for moderate category share', () => {
      expect(getDependencyLevel(5, 0, 30)).toBe('high');
      expect(getDependencyLevel(3, 1, 35)).toBe('high');
    });

    it('should return medium for one critical service', () => {
      expect(getDependencyLevel(3, 1, 0)).toBe('medium');
      expect(getDependencyLevel(5, 1, 10)).toBe('medium');
    });

    it('should return medium for low category share', () => {
      expect(getDependencyLevel(3, 0, 15)).toBe('medium');
      expect(getDependencyLevel(5, 0, 20)).toBe('medium');
    });

    it('should return low for minimal dependencies', () => {
      expect(getDependencyLevel(2, 0, 0)).toBe('low');
      expect(getDependencyLevel(3, 0, 10)).toBe('low');
    });
  });
});

// ============================================================================
// SPOF Detection Tests
// ============================================================================

describe('VendorConcentrationService - SPOF Detection', () => {
  describe('isSPOF', () => {
    it('should return true for single vendor in category', () => {
      expect(isSPOF(1, 100, 0)).toBe(true);
      expect(isSPOF(1, 50, 2)).toBe(true);
    });

    it('should return true for vendor with >= 80% market share', () => {
      expect(isSPOF(5, 80, 0)).toBe(true);
      expect(isSPOF(3, 90, 1)).toBe(true);
    });

    it('should return true for vendor with >= 5 critical services', () => {
      expect(isSPOF(10, 20, 5)).toBe(true);
      expect(isSPOF(5, 30, 7)).toBe(true);
    });

    it('should return false for diversified portfolio', () => {
      expect(isSPOF(5, 30, 2)).toBe(false);
      expect(isSPOF(3, 50, 3)).toBe(false);
    });

    it('should return false for multiple vendors with moderate share', () => {
      expect(isSPOF(4, 25, 1)).toBe(false);
      expect(isSPOF(2, 50, 2)).toBe(false);
    });
  });
});

// ============================================================================
// Impact Level Tests
// ============================================================================

describe('VendorConcentrationService - Impact Level', () => {
  describe('getImpactLevel', () => {
    it('should return critical for high critical count', () => {
      expect(getImpactLevel(5, 10)).toBe('critical');
      expect(getImpactLevel(6, 10)).toBe('critical');
    });

    it('should return critical for high critical ratio', () => {
      expect(getImpactLevel(3, 5)).toBe('critical'); // 60%
      expect(getImpactLevel(5, 8)).toBe('critical'); // 62.5%
    });

    it('should return high for moderate critical count', () => {
      expect(getImpactLevel(3, 10)).toBe('high');
      expect(getImpactLevel(4, 15)).toBe('high');
    });

    it('should return high for moderate critical ratio', () => {
      expect(getImpactLevel(3, 8)).toBe('high'); // 37.5%
    });

    it('should return medium for low critical count', () => {
      expect(getImpactLevel(1, 10)).toBe('medium');
      expect(getImpactLevel(2, 20)).toBe('medium');
    });

    it('should return medium for low critical ratio', () => {
      expect(getImpactLevel(1, 8)).toBe('medium'); // 12.5%
    });

    it('should return low for no critical services', () => {
      expect(getImpactLevel(0, 10)).toBe('low');
      expect(getImpactLevel(0, 0)).toBe('low');
    });
  });
});

// ============================================================================
// Urgency Level Tests
// ============================================================================

describe('VendorConcentrationService - Urgency Level', () => {
  describe('getUrgencyLevel', () => {
    it('should return immediate for critical impact', () => {
      expect(getUrgencyLevel('critical')).toBe('immediate');
    });

    it('should return short-term for high impact', () => {
      expect(getUrgencyLevel('high')).toBe('short-term');
    });

    it('should return long-term for medium impact', () => {
      expect(getUrgencyLevel('medium')).toBe('long-term');
    });

    it('should return long-term for low impact', () => {
      expect(getUrgencyLevel('low')).toBe('long-term');
    });
  });
});

// ============================================================================
// Color Utility Tests
// ============================================================================

describe('VendorConcentrationService - Color Utilities', () => {
  describe('getDependencyLevelColor', () => {
    it('should return correct colors for each level', () => {
      expect(getDependencyLevelColor('low')).toContain('green');
      expect(getDependencyLevelColor('medium')).toContain('yellow');
      expect(getDependencyLevelColor('high')).toContain('orange');
      expect(getDependencyLevelColor('critical')).toContain('red');
    });
  });

  describe('getDependencyLevelBgColor', () => {
    it('should return background colors for each level', () => {
      expect(getDependencyLevelBgColor('low')).toContain('green');
      expect(getDependencyLevelBgColor('medium')).toContain('yellow');
      expect(getDependencyLevelBgColor('high')).toContain('orange');
      expect(getDependencyLevelBgColor('critical')).toContain('red');
    });

    it('should include dark mode classes', () => {
      expect(getDependencyLevelBgColor('low')).toContain('dark:');
      expect(getDependencyLevelBgColor('critical')).toContain('dark:');
    });
  });

  describe('getPriorityColor', () => {
    it('should return correct colors for priorities', () => {
      expect(getPriorityColor('high')).toContain('red');
      expect(getPriorityColor('medium')).toContain('yellow');
      expect(getPriorityColor('low')).toContain('green');
    });
  });
});

// ============================================================================
// Formatting Tests
// ============================================================================

describe('VendorConcentrationService - Formatting', () => {
  describe('formatPercentage', () => {
    it('should format whole numbers', () => {
      expect(formatPercentage(50)).toBe('50%');
      expect(formatPercentage(100)).toBe('100%');
      expect(formatPercentage(0)).toBe('0%');
    });

    it('should round decimal values', () => {
      expect(formatPercentage(33.33)).toBe('33%');
      expect(formatPercentage(66.67)).toBe('67%');
      expect(formatPercentage(99.5)).toBe('100%');
    });
  });
});

// ============================================================================
// Trend Indicator Tests
// ============================================================================

describe('VendorConcentrationService - Trend Indicators', () => {
  describe('getTrendIndicator', () => {
    it('should return green/up for improving trends', () => {
      const result = getTrendIndicator('improving');
      expect(result.color).toContain('green');
      expect(result.icon).toBe('up');
    });

    it('should return red/down for worsening trends', () => {
      const result = getTrendIndicator('worsening');
      expect(result.color).toContain('red');
      expect(result.icon).toBe('down');
    });

    it('should return slate/right for stable trends', () => {
      const result = getTrendIndicator('stable');
      expect(result.color).toContain('slate');
      expect(result.icon).toBe('right');
    });
  });
});

// ============================================================================
// Category Label Tests
// ============================================================================

describe('VendorConcentrationService - Category Labels', () => {
  describe('getCategoryLabel', () => {
    it('should return mapped labels for known categories', () => {
      expect(getCategoryLabel('cloud')).toBe('Cloud & Infrastructure');
      expect(getCategoryLabel('security')).toBe('Cybersecurity');
      expect(getCategoryLabel('software')).toBe('Software & SaaS');
      expect(getCategoryLabel('network')).toBe('Network & Telecom');
    });

    it('should handle case insensitivity', () => {
      expect(getCategoryLabel('CLOUD')).toBe('Cloud & Infrastructure');
      expect(getCategoryLabel('Cloud')).toBe('Cloud & Infrastructure');
    });

    it('should return original for unknown categories', () => {
      expect(getCategoryLabel('unknown')).toBe('unknown');
      expect(getCategoryLabel('CustomCategory')).toBe('CustomCategory');
    });
  });

  describe('CATEGORY_LABELS', () => {
    it('should have all expected categories', () => {
      expect(CATEGORY_LABELS).toHaveProperty('cloud');
      expect(CATEGORY_LABELS).toHaveProperty('security');
      expect(CATEGORY_LABELS).toHaveProperty('software');
      expect(CATEGORY_LABELS).toHaveProperty('network');
      expect(CATEGORY_LABELS).toHaveProperty('data');
      expect(CATEGORY_LABELS).toHaveProperty('payment');
      expect(CATEGORY_LABELS).toHaveProperty('hr');
      expect(CATEGORY_LABELS).toHaveProperty('legal');
      expect(CATEGORY_LABELS).toHaveProperty('marketing');
      expect(CATEGORY_LABELS).toHaveProperty('support');
      expect(CATEGORY_LABELS).toHaveProperty('other');
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('VendorConcentrationService - Edge Cases', () => {
  it('should handle boundary values for HHI levels', () => {
    expect(getHHILevel(1499)).toBe('low');
    expect(getHHILevel(1500)).toBe('moderate');
    expect(getHHILevel(2499)).toBe('moderate');
    expect(getHHILevel(2500)).toBe('high');
  });

  it('should handle zero services correctly', () => {
    expect(getImpactLevel(0, 0)).toBe('low');
    expect(getDependencyLevel(0, 0, 0)).toBe('low');
  });

  it('should handle extreme percentage values', () => {
    expect(formatPercentage(0)).toBe('0%');
    expect(formatPercentage(100)).toBe('100%');
    expect(formatPercentage(-5)).toBe('-5%');
    expect(formatPercentage(150)).toBe('150%');
  });

  it('should handle SPOF edge cases', () => {
    // Exactly at threshold
    expect(isSPOF(2, 80, 4)).toBe(true); // 80% share
    expect(isSPOF(2, 79, 4)).toBe(false); // Just below
    expect(isSPOF(2, 50, 5)).toBe(true); // 5 critical services
    expect(isSPOF(2, 50, 4)).toBe(false); // Just below
  });

  it('should handle dependency level thresholds', () => {
    // Critical thresholds
    expect(getDependencyLevel(5, 3, 0)).toBe('critical'); // 3 critical services
    expect(getDependencyLevel(5, 2, 0)).toBe('high'); // 2 critical services
    expect(getDependencyLevel(5, 0, 50)).toBe('critical'); // 50% share
    expect(getDependencyLevel(5, 0, 49)).toBe('high'); // Just below
  });
});

// ============================================================================
// Integration Scenarios
// ============================================================================

describe('VendorConcentrationService - Integration Scenarios', () => {
  it('should correctly identify a concentrated market scenario', () => {
    // Scenario: 3 vendors - one dominant (70%), two small (15% each)
    const hhi = calculateHHI([70, 15, 15]);
    expect(hhi).toBe(5350); // 70^2 + 15^2 + 15^2
    expect(getHHILevel(hhi)).toBe('high');
  });

  it('should correctly identify a competitive market scenario', () => {
    // Scenario: 5 vendors with relatively equal shares
    // 25^2 + 20^2 + 20^2 + 20^2 + 15^2 = 625 + 400 + 400 + 400 + 225 = 2050
    const hhi = calculateHHI([25, 20, 20, 20, 15]);
    expect(hhi).toBe(2050);
    expect(getHHILevel(hhi)).toBe('moderate');
  });

  it('should handle complete dependency chain', () => {
    // Vendor with high dependency
    const criticalServices = 4;
    const totalServices = 10;
    const categoryShare = 40;

    const dependencyLevel = getDependencyLevel(totalServices, criticalServices, categoryShare);
    const impactLevel = getImpactLevel(criticalServices, totalServices);
    const urgency = getUrgencyLevel(impactLevel);
    const isSinglePoint = isSPOF(3, categoryShare, criticalServices);

    expect(dependencyLevel).toBe('critical');
    expect(impactLevel).toBe('high');
    expect(urgency).toBe('short-term');
    expect(isSinglePoint).toBe(false);
  });

  it('should identify clear SPOF scenario', () => {
    // Single vendor in category with critical services
    const vendorCount = 1;
    const marketShare = 100;
    const criticalServices = 5;

    expect(isSPOF(vendorCount, marketShare, criticalServices)).toBe(true);
    expect(getImpactLevel(criticalServices, 8)).toBe('critical');
    expect(getUrgencyLevel('critical')).toBe('immediate');
  });
});
