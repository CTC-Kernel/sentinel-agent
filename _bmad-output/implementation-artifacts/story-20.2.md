# Story 20.2: Définition des Jalons

Status: ready-for-dev

## Story

As a PM,
I want to define milestones for each phase,
so that I track concrete deliverables.

## Acceptance Criteria

1. Ajout de jalons par phase PDCA
2. Champs: Nom, Description, Date d'échéance, Phase
3. Liaison possible: Analyses EBIOS, Risques, Contrôles, Documents
4. Affichage sur une timeline
5. Mise en évidence des jalons en retard (rouge)
6. Notifications pour les jalons approchant

## Tasks / Subtasks

- [ ] Task 1: Créer le type Milestone (AC: 2, 3)
  - [ ] Interface dans `src/types/smsi.ts`
  - [ ] Champs: name, description, dueDate, phase
  - [ ] LinkedItems: ebiosAnalyses, risks, controls, documents

- [ ] Task 2: Créer le composant MilestoneForm (AC: 1, 2, 3)
  - [ ] `src/components/smsi/MilestoneForm.tsx`
  - [ ] Select pour phase PDCA
  - [ ] Multi-select pour éléments liés
  - [ ] Date picker avec validation future

- [ ] Task 3: Créer le composant MilestoneTimeline (AC: 4)
  - [ ] `src/components/smsi/MilestoneTimeline.tsx`
  - [ ] Timeline horizontale ou verticale
  - [ ] Grouping par phase
  - [ ] Indicateurs visuels de status

- [ ] Task 4: Implémenter la détection des retards (AC: 5)
  - [ ] Calcul: isOverdue = dueDate < now && status !== 'completed'
  - [ ] Style: border rouge, badge "En retard"
  - [ ] Tri: retards en premier

- [ ] Task 5: Créer les notifications (AC: 6)
  - [ ] Cloud Function schedulée
  - [ ] Alertes: 7j, 3j, 1j avant échéance
  - [ ] Notification au responsable de phase

## Dev Notes

### Data Structure

```typescript
interface Milestone {
  id: string;
  name: string;
  description: string;
  phase: 'plan' | 'do' | 'check' | 'act';
  dueDate: Timestamp;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  completedAt?: Timestamp;
  linkedItems: {
    ebiosAnalyses: string[];
    risks: string[];
    controls: string[];
    documents: string[];
    projects: string[];
  };
  responsibleId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Timeline Component

```tsx
const MilestoneTimeline = ({ milestones }: { milestones: Milestone[] }) => {
  const sortedByDate = [...milestones].sort((a, b) =>
    a.dueDate.toMillis() - b.dueDate.toMillis()
  );

  return (
    <div className="relative">
      {/* Timeline axis */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      {sortedByDate.map((milestone, index) => (
        <div key={milestone.id} className="relative pl-10 pb-8">
          {/* Dot */}
          <div className={`
            absolute left-2.5 w-3 h-3 rounded-full
            ${milestone.status === 'completed' ? 'bg-green-500' :
              milestone.status === 'overdue' ? 'bg-red-500' :
              'bg-gray-400'}
          `} />

          {/* Content */}
          <MilestoneCard milestone={milestone} />
        </div>
      ))}
    </div>
  );
};
```

### Overdue Detection

```typescript
const updateMilestoneStatus = (milestone: Milestone): Milestone => {
  if (milestone.status === 'completed') return milestone;

  const now = Timestamp.now();
  if (milestone.dueDate.toMillis() < now.toMillis()) {
    return { ...milestone, status: 'overdue' };
  }

  return milestone;
};
```

### Notification Cloud Function

```typescript
// functions/src/scheduled/milestoneReminders.ts
export const sendMilestoneReminders = onSchedule('every 1 hours', async () => {
  const now = new Date();
  const reminders = [
    { days: 7, template: 'milestone_reminder_7d' },
    { days: 3, template: 'milestone_reminder_3d' },
    { days: 1, template: 'milestone_reminder_1d' },
  ];

  for (const { days, template } of reminders) {
    const targetDate = addDays(now, days);
    const milestones = await getMilestonesForDate(targetDate);

    for (const milestone of milestones) {
      await sendNotification(milestone.responsibleId, template, {
        milestoneName: milestone.name,
        dueDate: milestone.dueDate,
        daysRemaining: days,
      });
    }
  }
});
```

### Linked Items Display

```tsx
const LinkedItemsChips = ({ linkedItems }) => (
  <div className="flex flex-wrap gap-1 mt-2">
    {linkedItems.ebiosAnalyses.map(id => (
      <Chip key={id} icon="📊" label="EBIOS" size="sm" />
    ))}
    {linkedItems.risks.map(id => (
      <Chip key={id} icon="⚠️" label="Risque" size="sm" />
    ))}
    {linkedItems.controls.map(id => (
      <Chip key={id} icon="🛡️" label="Contrôle" size="sm" />
    ))}
    {linkedItems.documents.map(id => (
      <Chip key={id} icon="📄" label="Document" size="sm" />
    ))}
  </div>
);
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-18.2]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
