# Story 21.2: Définition du Contexte Réglementaire

Status: ready-for-dev

## Story

As a RSSI,
I want to document regulatory obligations,
so that I ensure compliance requirements are considered.

## Acceptance Criteria

1. Section "Contexte Réglementaire" dans le module Contexte
2. Liste des réglementations applicables (NIS2, DORA, RGPD, etc.)
3. Spécification des obligations et échéances
4. Liaison avec les frameworks activés dans le système
5. Alertes pour les échéances réglementaires
6. Mapping réglementation → exigences

## Tasks / Subtasks

- [ ] Task 1: Créer le type RegulatoryContext (AC: 2, 3)
  - [ ] Interface dans `src/types/riskContext.ts`
  - [ ] ApplicableRegulation avec obligations
  - [ ] Deadline tracking

- [ ] Task 2: Créer le composant RegulatoryContextForm (AC: 1, 2, 3)
  - [ ] `src/components/riskContext/RegulatoryContextForm.tsx`
  - [ ] Multi-select pour réglementations
  - [ ] Champs obligations par réglementation
  - [ ] Date pickers pour échéances

- [ ] Task 3: Créer la bibliothèque de réglementations (AC: 2)
  - [ ] Collection `regulatoryLibrary`
  - [ ] Réglementations EU: NIS2, DORA, RGPD, eIDAS
  - [ ] Réglementations FR: LPM, HDS, SecNumCloud

- [ ] Task 4: Implémenter la liaison frameworks (AC: 4)
  - [ ] Mapping: Regulation → Framework IDs
  - [ ] Affichage des frameworks liés
  - [ ] Quick-add framework depuis regulation

- [ ] Task 5: Créer les alertes échéances (AC: 5)
  - [ ] `RegulatoryDeadlineAlerts.tsx`
  - [ ] Liste des échéances à venir
  - [ ] Notifications configurables

## Dev Notes

### Data Structure

```typescript
interface RegulatoryContext {
  applicableRegulations: ApplicableRegulation[];
  sectorSpecificRequirements: string[];
  contractualObligations: ContractualObligation[];
  linkedFrameworkIds: string[];
}

interface ApplicableRegulation {
  id: string;
  regulationId: string; // Reference to library
  regulationName: string;
  applicabilityReason: string;
  obligations: RegulatoryObligation[];
  complianceDeadline?: Timestamp;
  currentStatus: 'not_started' | 'in_progress' | 'compliant' | 'non_compliant';
  responsibleId: string;
  notes: string;
}

interface RegulatoryObligation {
  id: string;
  title: string;
  description: string;
  article?: string; // e.g., "Article 21"
  deadline?: Timestamp;
  status: 'pending' | 'in_progress' | 'met';
  linkedControlIds: string[];
}

interface ContractualObligation {
  id: string;
  clientName: string;
  contractReference: string;
  securityRequirements: string[];
  auditRights: boolean;
  dataResidency?: string;
}
```

### Regulatory Library

```typescript
const regulatoryLibrary = [
  {
    id: 'nis2',
    name: 'NIS2 Directive',
    fullName: 'Directive (EU) 2022/2555',
    jurisdiction: 'EU',
    sector: ['essential_services', 'important_entities'],
    effectiveDate: '2024-10-17',
    keyRequirements: [
      'Risk management measures',
      'Incident reporting (24h/72h)',
      'Supply chain security',
      'Business continuity',
    ],
    linkedFrameworks: ['iso27001', 'nist_csf'],
  },
  {
    id: 'dora',
    name: 'DORA Regulation',
    fullName: 'Digital Operational Resilience Act',
    jurisdiction: 'EU',
    sector: ['financial'],
    effectiveDate: '2025-01-17',
    keyRequirements: [
      'ICT risk management',
      'ICT incident reporting',
      'Digital operational resilience testing',
      'Third-party risk management',
    ],
    linkedFrameworks: ['iso27001'],
  },
  {
    id: 'rgpd',
    name: 'RGPD',
    fullName: 'Règlement Général sur la Protection des Données',
    jurisdiction: 'EU',
    sector: ['all'],
    effectiveDate: '2018-05-25',
    keyRequirements: [
      'Data protection impact assessment',
      'Security of processing (Art. 32)',
      'Breach notification (72h)',
      'Data protection by design',
    ],
    linkedFrameworks: ['iso27001', 'iso27701'],
  },
];
```

### Framework Mapping

```typescript
const regulationToFramework: Record<string, string[]> = {
  'nis2': ['iso27001', 'nist_csf', 'cis_controls'],
  'dora': ['iso27001', 'cobit'],
  'rgpd': ['iso27001', 'iso27701', 'nist_privacy'],
  'lpm': ['iso27001', 'anssi_referentiel'],
};
```

### Deadline Alerts

```tsx
const RegulatoryDeadlines = () => {
  const { data: regulations } = useApplicableRegulations();
  const upcomingDeadlines = getUpcomingDeadlines(regulations, 90); // Next 90 days

  return (
    <div className="space-y-2">
      <h4 className="font-medium">Échéances réglementaires</h4>
      {upcomingDeadlines.map(deadline => (
        <DeadlineCard
          key={deadline.id}
          regulation={deadline.regulationName}
          obligation={deadline.obligationTitle}
          dueDate={deadline.deadline}
          daysRemaining={deadline.daysRemaining}
          status={deadline.status}
        />
      ))}
    </div>
  );
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-19.2]
- [Source: ISO 27005:2022 - Clause 7.2.2]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
