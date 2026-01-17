# Story 21.3: Définition de l'Appétit au Risque

Status: ready-for-dev

## Story

As a Dirigeant/RSSI,
I want to define our risk appetite,
so that treatment decisions align with business tolerance.

## Acceptance Criteria

1. Section "Appétit au Risque" dans le module Contexte
2. Définition des niveaux acceptables par catégorie de risque
3. Définition des seuils d'escalade
4. Appétit utilisé pour la validation des traitements
5. Visualisation graphique de l'appétit
6. Approbation par la direction requise

## Tasks / Subtasks

- [ ] Task 1: Créer le type RiskAppetite (AC: 2, 3)
  - [ ] Interface dans `src/types/riskContext.ts`
  - [ ] Seuils: acceptable, tolerable, unacceptable
  - [ ] Par catégorie de risque

- [ ] Task 2: Créer le composant RiskAppetiteForm (AC: 1, 2, 3)
  - [ ] `src/components/riskContext/RiskAppetiteForm.tsx`
  - [ ] Sliders pour les seuils
  - [ ] Configuration par catégorie
  - [ ] Escalation rules

- [ ] Task 3: Créer la visualisation (AC: 5)
  - [ ] `src/components/riskContext/RiskAppetiteChart.tsx`
  - [ ] Zones colorées (vert/jaune/rouge)
  - [ ] Radar chart par catégorie

- [ ] Task 4: Implémenter la validation traitement (AC: 4)
  - [ ] Service de validation
  - [ ] Compare residual risk vs appetite
  - [ ] Retourne approval/warning/reject

- [ ] Task 5: Créer le workflow d'approbation (AC: 6)
  - [ ] Status: draft, pending_approval, approved
  - [ ] Approvers: direction users
  - [ ] Notification et signature

## Dev Notes

### Data Structure

```typescript
interface RiskAppetite {
  id: string;
  status: 'draft' | 'pending_approval' | 'approved';
  approvedBy?: string;
  approvedAt?: Timestamp;
  version: number;

  globalThresholds: {
    acceptable: number; // Max risk level considered acceptable (e.g., 4)
    tolerable: number; // Max risk level tolerable with monitoring (e.g., 8)
    unacceptable: number; // Above this = immediate action (e.g., 12)
  };

  categoryThresholds: Record<RiskCategory, {
    acceptable: number;
    tolerable: number;
    unacceptable: number;
  }>;

  escalationRules: EscalationRule[];

  riskToleranceStatement: string; // Board-approved statement
  lastReviewDate: Timestamp;
  nextReviewDate: Timestamp;
}

interface EscalationRule {
  id: string;
  trigger: 'exceeds_tolerable' | 'exceeds_acceptable' | 'critical_asset';
  escalateTo: string[]; // User IDs or role names
  timeframe: number; // Hours to escalate
  notificationChannels: ('email' | 'sms' | 'in_app')[];
}

type RiskCategory =
  | 'operational'
  | 'financial'
  | 'strategic'
  | 'compliance'
  | 'reputational'
  | 'security';
```

### Risk Appetite Visualization

```tsx
const RiskAppetiteChart = ({ appetite }: { appetite: RiskAppetite }) => {
  const zones = [
    { name: 'Acceptable', max: appetite.globalThresholds.acceptable, color: '#22c55e' },
    { name: 'Tolérable', max: appetite.globalThresholds.tolerable, color: '#eab308' },
    { name: 'Inacceptable', max: 16, color: '#ef4444' },
  ];

  return (
    <div className="relative h-8 rounded-full overflow-hidden">
      {zones.map((zone, i) => (
        <div
          key={zone.name}
          className="absolute h-full"
          style={{
            left: `${(zones[i - 1]?.max || 0) / 16 * 100}%`,
            width: `${(zone.max - (zones[i - 1]?.max || 0)) / 16 * 100}%`,
            backgroundColor: zone.color,
          }}
        >
          <span className="text-xs text-white px-2">{zone.name}</span>
        </div>
      ))}
    </div>
  );
};
```

### Treatment Validation

```typescript
const validateTreatmentAgainstAppetite = (
  residualRisk: number,
  category: RiskCategory,
  appetite: RiskAppetite
): AppetiteValidation => {
  const thresholds = appetite.categoryThresholds[category] || appetite.globalThresholds;

  if (residualRisk <= thresholds.acceptable) {
    return {
      status: 'approved',
      message: 'Risque résiduel dans les limites acceptables',
      requiresApproval: false,
    };
  }

  if (residualRisk <= thresholds.tolerable) {
    return {
      status: 'warning',
      message: 'Risque résiduel tolérable, surveillance requise',
      requiresApproval: true,
      approverLevel: 'rssi',
    };
  }

  return {
    status: 'rejected',
    message: 'Risque résiduel dépasse l\'appétit au risque',
    requiresApproval: true,
    approverLevel: 'direction',
    escalationRequired: true,
  };
};
```

### Approval Workflow

```typescript
const submitForApproval = async (appetiteId: string): Promise<void> => {
  // 1. Update status
  await updateRiskAppetite(appetiteId, { status: 'pending_approval' });

  // 2. Notify approvers
  const approvers = await getApprovers('direction');
  await NotificationService.sendBulk(approvers, 'risk_appetite_approval_request', {
    appetiteId,
    requestedBy: auth.currentUser?.displayName,
  });
};

const approveAppetite = async (appetiteId: string): Promise<void> => {
  await updateRiskAppetite(appetiteId, {
    status: 'approved',
    approvedBy: auth.currentUser?.uid,
    approvedAt: serverTimestamp(),
  });
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-19.3]
- [Source: ISO 27005:2022 - Clause 7.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
