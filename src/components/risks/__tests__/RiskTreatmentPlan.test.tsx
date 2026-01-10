import { render, screen, fireEvent } from '@testing-library/react';
import { RiskTreatmentPlan } from '../RiskTreatmentPlan';
import { Risk, Control } from '../../../types';
import { describe, it, expect, vi } from 'vitest';

const mockRisk: Risk = {
    id: 'risk-1',
    organizationId: 'org-1',
    assetId: 'asset-1',
    threat: 'Phishing',
    vulnerability: 'No MFA',
    probability: 3,
    impact: 3,
    score: 9,
    strategy: 'Atténuer',
    status: 'Ouvert',
    owner: 'User 1',
    mitigationControlIds: ['ctrl-1'],
    treatment: {
        strategy: 'Atténuer',
        status: 'Planifié',
        description: 'Implement MFA',
        measures: ['Measure 1', 'Measure 2']
    }
};

const mockControls: Control[] = [
    { id: 'ctrl-1', code: 'C1', name: 'MFA', status: 'Implémenté', organizationId: 'org-1' },
    { id: 'ctrl-2', code: 'C2', name: 'Firewall', status: 'Non commencé', organizationId: 'org-1' }
];

const mockUsers = [{ uid: 'user-1', displayName: 'User 1' }];

describe('RiskTreatmentPlan', () => {
    it('renders AI suggested measures', () => {
        render(
            <RiskTreatmentPlan
                risk={mockRisk}
                onUpdate={() => { }}
                onRiskUpdate={() => { }}
                users={mockUsers}
                controls={mockControls}
            />
        );

        expect(screen.getByText('Mesures suggérées (IA)')).toBeInTheDocument();
        expect(screen.getByText('Measure 1')).toBeInTheDocument();
        expect(screen.getByText('Measure 2')).toBeInTheDocument();
    });

    it('renders linked controls', () => {
        render(
            <RiskTreatmentPlan
                risk={mockRisk}
                onUpdate={() => { }}
                onRiskUpdate={() => { }}
                users={mockUsers}
                controls={mockControls}
            />
        );

        expect(screen.getByText('Contrôles liés')).toBeInTheDocument();
        expect(screen.getByText('C1 - MFA')).toBeInTheDocument();
    });

    it('calls onRiskUpdate when detaching a control', () => {
        const onRiskUpdate = vi.fn();
        render(
            <RiskTreatmentPlan
                risk={mockRisk}
                onUpdate={() => { }}
                onRiskUpdate={onRiskUpdate}
                users={mockUsers}
                controls={mockControls}
            />
        );

        const detachButton = screen.getByText('Détacher');
        fireEvent.click(detachButton);

        expect(onRiskUpdate).toHaveBeenCalledWith({ mitigationControlIds: [] });
    });

    it('calls onRiskUpdate when adding a control', () => {
        const onRiskUpdate = vi.fn();
        render(
            <RiskTreatmentPlan
                risk={mockRisk}
                onUpdate={() => { }}
                onRiskUpdate={onRiskUpdate}
                users={mockUsers}
                controls={mockControls}
            />
        );

        const select = screen.getByRole('combobox', { name: /lier un nouveau contrôle/i });
        fireEvent.change(select, { target: { value: 'ctrl-2' } });

        expect(onRiskUpdate).toHaveBeenCalledWith({ mitigationControlIds: ['ctrl-1', 'ctrl-2'] });
    });

    it('calls onUpdate when removing a measure', () => {
        const onUpdate = vi.fn();
        render(
            <RiskTreatmentPlan
                risk={mockRisk}
                onUpdate={onUpdate}
                onRiskUpdate={() => { }}
                users={mockUsers}
                controls={mockControls}
            />
        );

        // Find the "X" button for the first measure (Measure 1)
        // Since there are multiple "X" icons (User icon, Close icon), we need to be specific.
        // In the component, the remove button has no aria-label, but it contains an X icon.
        // Let's rely on the button structure or add aria-labels in the component if needed, 
        // but for now let's try to find it by proximity to the text.

        // Actually the code uses <X> icon inside a button. 
        // Let's click the first button within the measures section.
        const measureElement = screen.getByText('Measure 1').closest('div');
        const removeButton = measureElement?.querySelector('button');

        if (removeButton) {
            fireEvent.click(removeButton);
            expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
                measures: ['Measure 2']
            }));
        } else {
            throw new Error('Remove button not found');
        }
    });
});
