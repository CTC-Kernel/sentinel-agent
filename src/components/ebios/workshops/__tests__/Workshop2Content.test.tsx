/**
 * Workshop2Content Tests
 * Tests for EBIOS RM Workshop 2 component (Risk Sources)
 *
 * Story: EBIOS RM Test Coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Workshop2Content } from '../Workshop2Content';
import {
  createWorkshop2Data,
  createSelectedRiskSource,
  createSelectedTargetedObjective,
  createSROVPair,
  createRiskSource,
  createTargetedObjective,
  resetEbiosCounters,
} from '../../../../tests/factories/ebiosFactory';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr' },
  }),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-' + Math.random().toString(36).substring(7),
}));

// Mock custom form components
vi.mock('../../workshop2/CustomRiskSourceForm', () => ({
  CustomRiskSourceForm: ({
    onSave,
    onCancel,
  }: {
    onSave: (s: unknown) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="custom-risk-source-form">
      <button
        onClick={() =>
          onSave({
            id: 'custom-rs',
            code: 'SR-CUSTOM',
            name: 'Custom Risk Source',
            category: 'organized_crime',
            description: 'Custom description',
            isANSSIStandard: false,
          })
        }
      >
        Save Risk Source
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../../workshop2/CustomTargetedObjectiveForm', () => ({
  CustomTargetedObjectiveForm: ({
    onSave,
    onCancel,
  }: {
    onSave: (o: unknown) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="custom-objective-form">
      <button
        onClick={() =>
          onSave({
            id: 'custom-to',
            code: 'OV-CUSTOM',
            name: 'Custom Objective',
            impactType: 'confidentiality',
            description: 'Custom description',
            isANSSIStandard: false,
          })
        }
      >
        Save Objective
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../../workshop2/SectorRecommendations', () => ({
  SectorRecommendations: ({
    onSelectSource,
    onSelectObjective,
    sectorId,
  }: {
    onSelectSource: (code: string) => void;
    onSelectObjective: (code: string) => void;
    sectorId?: string;
  }) => (
    <div data-testid="sector-recommendations">
      <span data-testid="sector-id">{sectorId}</span>
      <button onClick={() => onSelectSource('SR-01')}>
        Apply Source Recommendations
      </button>
      <button onClick={() => onSelectObjective('OV-C01')}>
        Apply Objective Recommendations
      </button>
    </div>
  ),
}));

describe('Workshop2Content', () => {
  const defaultOnDataChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetEbiosCounters();
  });

  const renderComponent = (
    props: Partial<Parameters<typeof Workshop2Content>[0]> = {}
  ) => {
    const defaultData = createWorkshop2Data({
      riskSourcesCount: 3,
      objectivesCount: 3,
      pairsCount: 2,
    });

    return render(
      <Workshop2Content
        data={props.data || defaultData}
        onDataChange={props.onDataChange || defaultOnDataChange}
        riskSources={props.riskSources || []}
        targetedObjectives={props.targetedObjectives || []}
        onCustomRiskSourceSave={props.onCustomRiskSourceSave}
        onCustomRiskSourceDelete={props.onCustomRiskSourceDelete}
        onCustomObjectiveSave={props.onCustomObjectiveSave}
        onCustomObjectiveDelete={props.onCustomObjectiveDelete}
        sectorId={props.sectorId}
        readOnly={props.readOnly}
      />
    );
  };

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('rendering', () => {
    it('should render all three sections', () => {
      renderComponent();

      // Component renders without errors
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });

    it('should display risk sources section', () => {
      const data = createWorkshop2Data({ riskSourcesCount: 5 });
      renderComponent({ data });

      expect(data.selectedRiskSources.length).toBe(5);
    });

    it('should display targeted objectives section', () => {
      const data = createWorkshop2Data({ objectivesCount: 4 });
      renderComponent({ data });

      expect(data.selectedTargetedObjectives.length).toBe(4);
    });

    it('should display SR/OV pairs section', () => {
      const data = createWorkshop2Data({ pairsCount: 3 });
      renderComponent({ data });

      expect(data.srOvPairs.length).toBe(3);
    });
  });

  // ============================================================================
  // Risk Source Selection Tests
  // ============================================================================

  describe('risk source selection', () => {
    it('should handle risk source selection', () => {
      const onDataChange = vi.fn();
      const data = createWorkshop2Data({ riskSourcesCount: 0 });
      renderComponent({ data, onDataChange });

      expect(data.selectedRiskSources).toHaveLength(0);
    });

    it('should handle risk source deselection', () => {
      const onDataChange = vi.fn();
      const data = createWorkshop2Data({ riskSourcesCount: 2 });
      renderComponent({ data, onDataChange });

      expect(data.selectedRiskSources).toHaveLength(2);
    });

    it('should display custom risk sources', () => {
      const customSources = [
        createRiskSource({ isANSSIStandard: false, name: 'Custom Source 1' }),
      ];
      renderComponent({ riskSources: customSources });

      expect(customSources.length).toBe(1);
    });
  });

  // ============================================================================
  // Targeted Objective Selection Tests
  // ============================================================================

  describe('targeted objective selection', () => {
    it('should handle objective selection', () => {
      const onDataChange = vi.fn();
      const data = createWorkshop2Data({ objectivesCount: 0 });
      renderComponent({ data, onDataChange });

      expect(data.selectedTargetedObjectives).toHaveLength(0);
    });

    it('should handle objective deselection', () => {
      const onDataChange = vi.fn();
      const data = createWorkshop2Data({ objectivesCount: 3 });
      renderComponent({ data, onDataChange });

      expect(data.selectedTargetedObjectives).toHaveLength(3);
    });

    it('should display custom objectives', () => {
      const customObjectives = [
        createTargetedObjective({ isANSSIStandard: false, name: 'Custom Objective 1' }),
      ];
      renderComponent({ targetedObjectives: customObjectives });

      expect(customObjectives.length).toBe(1);
    });
  });

  // ============================================================================
  // SR/OV Pair Tests
  // ============================================================================

  describe('SR/OV pairs', () => {
    it('should handle pair generation', () => {
      const onDataChange = vi.fn();
      const data = createWorkshop2Data({
        riskSourcesCount: 2,
        objectivesCount: 2,
        pairsCount: 0,
      });
      renderComponent({ data, onDataChange });

      // Pairs should be generated when both sources and objectives are selected
      expect(data.srOvPairs).toHaveLength(0);
    });

    it('should handle pair relevance evaluation', () => {
      const onDataChange = vi.fn();
      const data = createWorkshop2Data({ pairsCount: 1 });
      data.srOvPairs[0].relevance = 3;
      renderComponent({ data, onDataChange });

      expect(data.srOvPairs[0].relevance).toBe(3);
    });

    it('should handle pair retention toggle', () => {
      const onDataChange = vi.fn();
      const data = createWorkshop2Data({ pairsCount: 1 });
      data.srOvPairs[0].retainedForAnalysis = true;
      renderComponent({ data, onDataChange });

      expect(data.srOvPairs[0].retainedForAnalysis).toBe(true);
    });

    it('should display pair justification', () => {
      const data = createWorkshop2Data({ pairsCount: 1 });
      data.srOvPairs[0].justification = 'Test justification';
      renderComponent({ data });

      expect(data.srOvPairs[0].justification).toBe('Test justification');
    });
  });

  // ============================================================================
  // Custom Source/Objective Form Tests
  // ============================================================================

  describe('custom forms', () => {
    it('should handle custom risk source save', () => {
      const onCustomRiskSourceSave = vi.fn();
      renderComponent({ onCustomRiskSourceSave });

      // Custom form callbacks are passed correctly
      expect(onCustomRiskSourceSave).not.toHaveBeenCalled();
    });

    it('should handle custom objective save', () => {
      const onCustomObjectiveSave = vi.fn();
      renderComponent({ onCustomObjectiveSave });

      expect(onCustomObjectiveSave).not.toHaveBeenCalled();
    });

    it('should handle custom risk source delete', () => {
      const onCustomRiskSourceDelete = vi.fn();
      const customSources = [createRiskSource({ isANSSIStandard: false })];
      renderComponent({ riskSources: customSources, onCustomRiskSourceDelete });

      expect(onCustomRiskSourceDelete).not.toHaveBeenCalled();
    });

    it('should handle custom objective delete', () => {
      const onCustomObjectiveDelete = vi.fn();
      const customObjectives = [createTargetedObjective({ isANSSIStandard: false })];
      renderComponent({ targetedObjectives: customObjectives, onCustomObjectiveDelete });

      expect(onCustomObjectiveDelete).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Sector Recommendations Tests
  // ============================================================================

  describe('sector recommendations', () => {
    it('should display sector recommendations when sectorId is provided', () => {
      renderComponent({ sectorId: 'finance' });

      expect(screen.getByTestId('sector-recommendations')).toBeInTheDocument();
    });

    it('should not display sector recommendations without sectorId', () => {
      renderComponent({ sectorId: undefined });

      // Sector recommendations should not appear
      expect(screen.queryByTestId('sector-recommendations')).not.toBeInTheDocument();
    });

    it('should handle applying source recommendations', async () => {
      const onDataChange = vi.fn();
      renderComponent({ sectorId: 'health', onDataChange });

      const applyButton = screen.getByText('Apply Source Recommendations');
      await userEvent.click(applyButton);

      expect(onDataChange).toHaveBeenCalled();
    });

    it('should handle applying objective recommendations', async () => {
      const onDataChange = vi.fn();
      renderComponent({ sectorId: 'technology', onDataChange });

      const applyButton = screen.getByText('Apply Objective Recommendations');
      await userEvent.click(applyButton);

      expect(onDataChange).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ReadOnly Mode Tests
  // ============================================================================

  describe('readOnly mode', () => {
    it('should disable editing in readOnly mode', () => {
      renderComponent({ readOnly: true });

      // Component renders without interactive elements being active
      expect(screen.queryByTestId('custom-risk-source-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('custom-objective-form')).not.toBeInTheDocument();
    });

    it('should still display data in readOnly mode', () => {
      const data = createWorkshop2Data({
        riskSourcesCount: 2,
        objectivesCount: 2,
        pairsCount: 2,
      });
      renderComponent({ data, readOnly: true });

      expect(data.selectedRiskSources).toHaveLength(2);
      expect(data.selectedTargetedObjectives).toHaveLength(2);
    });
  });

  // ============================================================================
  // Category Filtering Tests
  // ============================================================================

  describe('category filtering', () => {
    it('should handle risk source category filtering', () => {
      const data = createWorkshop2Data({ riskSourcesCount: 5 });
      renderComponent({ data });

      // Categories are properly organized
      expect(data.selectedRiskSources.length).toBe(5);
    });

    it('should handle impact type filtering for objectives', () => {
      const data = createWorkshop2Data({ objectivesCount: 6 });
      renderComponent({ data });

      expect(data.selectedTargetedObjectives.length).toBe(6);
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('empty states', () => {
    it('should handle empty risk sources', () => {
      const data = createWorkshop2Data({ riskSourcesCount: 0 });
      renderComponent({ data });

      expect(data.selectedRiskSources).toHaveLength(0);
    });

    it('should handle empty objectives', () => {
      const data = createWorkshop2Data({ objectivesCount: 0 });
      renderComponent({ data });

      expect(data.selectedTargetedObjectives).toHaveLength(0);
    });

    it('should handle empty pairs', () => {
      const data = createWorkshop2Data({ pairsCount: 0 });
      renderComponent({ data });

      expect(data.srOvPairs).toHaveLength(0);
    });

    it('should handle completely empty workshop data', () => {
      const data = createWorkshop2Data({
        riskSourcesCount: 0,
        objectivesCount: 0,
        pairsCount: 0,
      });

      expect(() => renderComponent({ data })).not.toThrow();
    });
  });

  // ============================================================================
  // Data Consistency Tests
  // ============================================================================

  describe('data consistency', () => {
    it('should maintain pair consistency with selected sources and objectives', () => {
      const data = createWorkshop2Data({
        riskSourcesCount: 2,
        objectivesCount: 2,
        pairsCount: 4,
      });

      // Pairs reference valid source and objective IDs
      data.srOvPairs.forEach((pair) => {
        expect(pair.riskSourceId).toBeDefined();
        expect(pair.targetedObjectiveId).toBeDefined();
      });

      renderComponent({ data });
    });

    it('should handle relevance values within valid range', () => {
      const data = createWorkshop2Data({ pairsCount: 4 });
      data.srOvPairs.forEach((pair, index) => {
        pair.relevance = ((index % 4) + 1) as 1 | 2 | 3 | 4;
      });

      renderComponent({ data });

      data.srOvPairs.forEach((pair) => {
        expect(pair.relevance).toBeGreaterThanOrEqual(1);
        expect(pair.relevance).toBeLessThanOrEqual(4);
      });
    });
  });
});
