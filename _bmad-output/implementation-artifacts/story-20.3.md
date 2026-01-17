# Story 20.3: Dashboard d'Avancement

Status: ready-for-dev

## Story

As a Dirigeant/RSSI,
I want to see program progress at a glance,
so that I know if we're on track.

## Acceptance Criteria

1. Dashboard avec: Progression globale %, Phase actuelle, Jalons à venir
2. Roue PDCA montrant la complétion par phase
3. Timeline des jalons passés et futurs
4. Drill-down possible dans chaque phase
5. KPIs: Jalons complétés, En retard, À venir
6. Comparaison avec le planning initial

## Tasks / Subtasks

- [ ] Task 1: Créer le composant SMSIDashboard (AC: 1, 4)
  - [ ] `src/components/smsi/SMSIDashboard.tsx`
  - [ ] Layout avec sections distinctes
  - [ ] Click sur phase → détails

- [ ] Task 2: Créer le composant PDCAProgressRing (AC: 2)
  - [ ] `src/components/smsi/PDCAProgressRing.tsx`
  - [ ] Anneau avec 4 segments
  - [ ] Remplissage selon progression
  - [ ] Légende interactive

- [ ] Task 3: Créer les KPI cards (AC: 5)
  - [ ] `src/components/smsi/MilestoneKPIs.tsx`
  - [ ] Cards: Complétés, En retard, À venir, Total
  - [ ] Couleurs et icônes appropriées

- [ ] Task 4: Créer la mini-timeline (AC: 3)
  - [ ] `src/components/smsi/UpcomingMilestones.tsx`
  - [ ] 5 prochains jalons
  - [ ] Countdown pour chaque

- [ ] Task 5: Implémenter la comparaison au planning (AC: 6)
  - [ ] Stocker baseline à la création
  - [ ] Calcul variance: actual vs planned
  - [ ] Indicateur: Ahead/OnTrack/Behind

## Dev Notes

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Programme SMSI: ISO 27001 Certification                     │
│ Progression globale: ████████░░ 75%                        │
├──────────────────────┬──────────────────────────────────────┤
│                      │  KPIs                                │
│    PDCA Ring         │  ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│    [   P 100%   ]    │  │ ✓  │ │ ⚠️ │ │ 📅 │ │ 📊 │        │
│    [A     D 80% ]    │  │ 12 │ │ 2  │ │ 5  │ │ 19 │        │
│    [   C 50%    ]    │  └────┘ └────┘ └────┘ └────┘        │
│                      │  Done   Late  Coming  Total          │
├──────────────────────┴──────────────────────────────────────┤
│ Prochains Jalons                                            │
│ ├─ 15/01: Politique de sécurité ──────────── 3 jours       │
│ ├─ 22/01: Analyse des risques ───────────── 10 jours       │
│ └─ 30/01: Plan de traitement ────────────── 18 jours       │
├─────────────────────────────────────────────────────────────┤
│ Tendance: 📈 En avance de 5 jours sur le planning          │
└─────────────────────────────────────────────────────────────┘
```

### PDCA Progress Ring

```tsx
const PDCAProgressRing = ({ phases }: { phases: SMSIProgram['phases'] }) => {
  const data = [
    { phase: 'Plan', progress: phases.plan.progress, color: '#3b82f6' },
    { phase: 'Do', progress: phases.do.progress, color: '#22c55e' },
    { phase: 'Check', progress: phases.check.progress, color: '#f59e0b' },
    { phase: 'Act', progress: phases.act.progress, color: '#8b5cf6' },
  ];

  return (
    <svg viewBox="0 0 100 100" className="w-48 h-48">
      {data.map((segment, i) => (
        <CircleSegment
          key={segment.phase}
          startAngle={i * 90}
          endAngle={(i + 1) * 90}
          progress={segment.progress}
          color={segment.color}
        />
      ))}
      <text x="50" y="50" textAnchor="middle" className="text-2xl font-bold">
        {calculateOverallProgress(phases)}%
      </text>
    </svg>
  );
};
```

### KPI Calculation

```typescript
interface MilestoneKPIs {
  completed: number;
  overdue: number;
  upcoming: number; // Due in next 7 days
  total: number;
  completionRate: number; // completed / (completed + overdue)
}

const calculateKPIs = (milestones: Milestone[]): MilestoneKPIs => {
  const now = new Date();
  const nextWeek = addDays(now, 7);

  return {
    completed: milestones.filter(m => m.status === 'completed').length,
    overdue: milestones.filter(m => m.status === 'overdue').length,
    upcoming: milestones.filter(m =>
      m.status === 'pending' &&
      m.dueDate.toDate() <= nextWeek
    ).length,
    total: milestones.length,
    completionRate: // ...
  };
};
```

### Variance Calculation

```typescript
interface ScheduleVariance {
  status: 'ahead' | 'on_track' | 'behind';
  daysDifference: number;
  message: string;
}

const calculateVariance = (
  actualProgress: number,
  plannedProgress: number,
  targetDate: Date
): ScheduleVariance => {
  const progressDiff = actualProgress - plannedProgress;
  const daysDiff = Math.round(progressDiff * getDaysToTarget(targetDate) / 100);

  if (daysDiff > 2) {
    return { status: 'ahead', daysDifference: daysDiff, message: `En avance de ${daysDiff} jours` };
  }
  if (daysDiff < -2) {
    return { status: 'behind', daysDifference: Math.abs(daysDiff), message: `En retard de ${Math.abs(daysDiff)} jours` };
  }
  return { status: 'on_track', daysDifference: 0, message: 'Dans les temps' };
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-18.3]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
