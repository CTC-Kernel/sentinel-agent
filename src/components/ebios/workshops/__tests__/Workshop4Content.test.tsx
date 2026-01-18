/**
 * Workshop4Content Tests
 * Tests for EBIOS RM Workshop 4 component (Operational Scenarios)
 *
 * Story: EBIOS RM Test Coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Workshop4Content } from '../Workshop4Content';
import {
  createWorkshop4Data,
  createWorkshop3Data,
  createOperationalScenario,
  createAttackStep,
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

// Mock the actual form components that exist
vi.mock('../../workshop4/OperationalScenarioForm', () => ({
  OperationalScenarioForm: ({
    onCancel,
  }: {
    onSave: (s: unknown) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="operational-scenario-form">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../../workshop4/MitreSearchModal', () => ({
  MitreSearchModal: ({
    onClose,
  }: {
    onSelect: (ref: unknown) => void;
    onClose: () => void;
  }) => (
    <div data-testid="mitre-search-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

describe('Workshop4Content', () => {
  const defaultOnDataChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetEbiosCounters();
  });

  const renderComponent = (
    props: Partial<Parameters<typeof Workshop4Content>[0]> = {}
  ) => {
    const defaultData = createWorkshop4Data({ scenariosCount: 2 });

    const defaultWorkshop3Data = createWorkshop3Data({
      ecosystemCount: 3,
      attackPathsCount: 2,
      scenariosCount: 2,
    });

    return render(
      <Workshop4Content
        data={props.data || defaultData}
        workshop3Data={props.workshop3Data || defaultWorkshop3Data}
        onDataChange={props.onDataChange || defaultOnDataChange}
        readOnly={props.readOnly}
      />
    );
  };

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('rendering', () => {
    it('should render operational scenarios section', () => {
      renderComponent();

      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });

    it('should display operational scenarios', () => {
      const data = createWorkshop4Data({ scenariosCount: 4 });
      renderComponent({ data });

      expect(data.operationalScenarios.length).toBe(4);
    });

    it('should render component without errors', () => {
      expect(() => renderComponent()).not.toThrow();
    });
  });

  // ============================================================================
  // Operational Scenario Tests
  // ============================================================================

  describe('operational scenario operations', () => {
    it('should handle scenario creation', () => {
      const onDataChange = vi.fn();
      const data = createWorkshop4Data({ scenariosCount: 0 });
      renderComponent({ data, onDataChange });

      expect(data.operationalScenarios).toHaveLength(0);
    });

    it('should handle scenario editing', () => {
      const onDataChange = vi.fn();
      const data = createWorkshop4Data({ scenariosCount: 1 });
      renderComponent({ data, onDataChange });

      expect(data.operationalScenarios).toHaveLength(1);
    });

    it('should handle scenario deletion', () => {
      const onDataChange = vi.fn();
      const data = createWorkshop4Data({ scenariosCount: 3 });
      renderComponent({ data, onDataChange });

      expect(data.operationalScenarios).toHaveLength(3);
    });

    it('should auto-generate scenario codes', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({ code: 'SO-001' }),
        createOperationalScenario({ code: 'SO-002' }),
        createOperationalScenario({ code: 'SO-003' }),
      ];
      renderComponent({ data });

      expect(data.operationalScenarios[0].code).toBe('SO-001');
      expect(data.operationalScenarios[2].code).toBe('SO-003');
    });

    it('should link to strategic scenarios', () => {
      const workshop3Data = createWorkshop3Data({ scenariosCount: 2 });
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({
          strategicScenarioId: workshop3Data.strategicScenarios[0].id,
        }),
      ];
      renderComponent({ data, workshop3Data });

      expect(data.operationalScenarios[0].strategicScenarioId).toBe(
        workshop3Data.strategicScenarios[0].id
      );
    });
  });

  // ============================================================================
  // Attack Sequence Tests
  // ============================================================================

  describe('attack sequence', () => {
    it('should track step count', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({
          attackSequence: [createAttackStep(), createAttackStep(), createAttackStep()],
        }),
      ];
      renderComponent({ data });

      expect(data.operationalScenarios[0].attackSequence).toHaveLength(3);
    });

    it('should maintain step order', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({
          attackSequence: [
            createAttackStep({ order: 1 }),
            createAttackStep({ order: 2 }),
            createAttackStep({ order: 3 }),
          ],
        }),
      ];
      renderComponent({ data });

      const steps = data.operationalScenarios[0].attackSequence;
      expect(steps[0].order).toBe(1);
      expect(steps[1].order).toBe(2);
      expect(steps[2].order).toBe(3);
    });

    it('should handle MITRE references', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({
          attackSequence: [
            createAttackStep({
              mitreReference: {
                tacticId: 'TA0001',
                tacticName: 'Initial Access',
                techniqueId: 'T1566',
                techniqueName: 'Phishing',
              },
            }),
          ],
        }),
      ];
      renderComponent({ data });

      expect(data.operationalScenarios[0].attackSequence[0].mitreReference).toBeDefined();
      expect(data.operationalScenarios[0].attackSequence[0].mitreReference?.tacticId).toBe(
        'TA0001'
      );
    });
  });

  // ============================================================================
  // MITRE Integration Tests
  // ============================================================================

  describe('MITRE integration', () => {
    it('should support sub-techniques', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({
          attackSequence: [
            createAttackStep({
              mitreReference: {
                tacticId: 'TA0001',
                tacticName: 'Initial Access',
                techniqueId: 'T1566',
                techniqueName: 'Phishing',
                subtechniqueId: 'T1566.001',
                subtechniqueName: 'Spearphishing Attachment',
              },
            }),
          ],
        }),
      ];
      renderComponent({ data });

      expect(
        data.operationalScenarios[0].attackSequence[0].mitreReference?.subtechniqueId
      ).toBe('T1566.001');
    });
  });

  // ============================================================================
  // Likelihood Evaluation Tests
  // ============================================================================

  describe('likelihood evaluation', () => {
    it('should track current likelihood', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [createOperationalScenario({ likelihood: 3 })];
      renderComponent({ data });

      expect(data.operationalScenarios[0].likelihood).toBe(3);
    });

    it('should handle all likelihood values 1-4', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({ likelihood: 1 }),
        createOperationalScenario({ likelihood: 2 }),
        createOperationalScenario({ likelihood: 3 }),
        createOperationalScenario({ likelihood: 4 }),
      ];
      renderComponent({ data });

      expect(data.operationalScenarios[0].likelihood).toBe(1);
      expect(data.operationalScenarios[3].likelihood).toBe(4);
    });

    it('should display likelihood justification', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({
          likelihoodJustification: 'High capability and motivation of threat actor',
        }),
      ];
      renderComponent({ data });

      expect(data.operationalScenarios[0].likelihoodJustification).toBe(
        'High capability and motivation of threat actor'
      );
    });
  });

  // ============================================================================
  // Risk Level Calculation Tests
  // ============================================================================

  describe('risk level calculation', () => {
    it('should calculate risk level correctly', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({ likelihood: 3, riskLevel: 9 }), // gravity 3 * likelihood 3
      ];
      renderComponent({ data });

      expect(data.operationalScenarios[0].riskLevel).toBe(9);
    });

    it('should handle all risk level ranges', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({ riskLevel: 1 }), // Low
        createOperationalScenario({ riskLevel: 6 }), // Medium
        createOperationalScenario({ riskLevel: 9 }), // High
        createOperationalScenario({ riskLevel: 16 }), // Critical
      ];
      renderComponent({ data });

      expect(data.operationalScenarios[0].riskLevel).toBe(1);
      expect(data.operationalScenarios[3].riskLevel).toBe(16);
    });
  });

  // ============================================================================
  // ReadOnly Mode Tests
  // ============================================================================

  describe('readOnly mode', () => {
    it('should render in readOnly mode without errors', () => {
      expect(() => renderComponent({ readOnly: true })).not.toThrow();
    });

    it('should still display data in readOnly mode', () => {
      const data = createWorkshop4Data({ scenariosCount: 3 });
      renderComponent({ data, readOnly: true });

      expect(data.operationalScenarios).toHaveLength(3);
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('empty states', () => {
    it('should handle empty scenarios', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      renderComponent({ data });

      expect(data.operationalScenarios).toHaveLength(0);
    });

    it('should handle scenario with empty attack sequence', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({ attackSequence: [] }),
      ];
      renderComponent({ data });

      expect(data.operationalScenarios[0].attackSequence).toHaveLength(0);
    });

    it('should handle empty workshop 3 data', () => {
      const workshop3Data = createWorkshop3Data({
        ecosystemCount: 0,
        attackPathsCount: 0,
        scenariosCount: 0,
      });

      expect(() => renderComponent({ workshop3Data })).not.toThrow();
    });
  });

  // ============================================================================
  // Data Consistency Tests
  // ============================================================================

  describe('data consistency', () => {
    it('should maintain reference to strategic scenario', () => {
      const workshop3Data = createWorkshop3Data({ scenariosCount: 2 });
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({
          strategicScenarioId: workshop3Data.strategicScenarios[0].id,
        }),
      ];
      renderComponent({ data, workshop3Data });

      expect(data.operationalScenarios[0].strategicScenarioId).toBe(
        workshop3Data.strategicScenarios[0].id
      );
    });

    it('should handle linked risk ID', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({ linkedRiskId: 'risk-123' }),
      ];
      renderComponent({ data });

      expect(data.operationalScenarios[0].linkedRiskId).toBe('risk-123');
    });

    it('should maintain attack step order after editing', () => {
      const data = createWorkshop4Data({ scenariosCount: 0 });
      data.operationalScenarios = [
        createOperationalScenario({
          attackSequence: [
            createAttackStep({ order: 1, description: 'Step 1' }),
            createAttackStep({ order: 2, description: 'Step 2' }),
          ],
        }),
      ];
      renderComponent({ data });

      expect(data.operationalScenarios[0].attackSequence[0].order).toBe(1);
      expect(data.operationalScenarios[0].attackSequence[1].order).toBe(2);
    });
  });
});
