# Story 20.4: Attribution des Responsables

Status: ready-for-dev

## Story

As a PM,
I want to assign phase owners,
so that accountability is clear.

## Acceptance Criteria

1. Assignation d'un responsable par phase PDCA
2. Sélection parmi les utilisateurs de l'organisation
3. Notification au responsable lors de l'assignation
4. Nom du responsable affiché sur la carte de phase
5. Responsables peuvent voir leurs phases assignées dans leur dashboard
6. Historique des changements de responsable

## Tasks / Subtasks

- [ ] Task 1: Ajouter le champ responsable à PDCAPhase (AC: 1)
  - [ ] `PDCAPhase.responsibleId: string`
  - [ ] `PDCAPhase.responsibleAssignedAt: Timestamp`

- [ ] Task 2: Créer le composant PhaseOwnerPicker (AC: 2)
  - [ ] `src/components/smsi/PhaseOwnerPicker.tsx`
  - [ ] Dropdown avec utilisateurs
  - [ ] Avatar et nom
  - [ ] Search/filter

- [ ] Task 3: Implémenter les notifications (AC: 3)
  - [ ] Trigger sur assignation
  - [ ] Email + in-app notification
  - [ ] Template: "Vous êtes responsable de la phase X"

- [ ] Task 4: Créer la carte de phase avec responsable (AC: 4)
  - [ ] `src/components/smsi/PhaseCard.tsx`
  - [ ] Avatar responsable
  - [ ] Badge de phase
  - [ ] Quick stats

- [ ] Task 5: Créer la vue "Mes responsabilités" (AC: 5)
  - [ ] Filtrer phases par userId courant
  - [ ] Widget dans le dashboard personnel
  - [ ] Liste des jalons associés

- [ ] Task 6: Implémenter l'historique (AC: 6)
  - [ ] Sous-collection `history`
  - [ ] Log: changedAt, changedBy, previousOwner, newOwner
  - [ ] Affichage dans les détails de phase

## Dev Notes

### Data Structure Update

```typescript
interface PDCAPhase {
  status: 'not_started' | 'in_progress' | 'completed';
  responsibleId?: string;
  responsibleAssignedAt?: Timestamp;
  responsibleName?: string; // Denormalized for display
  milestones: Milestone[];
  progress: number;
  // ...
}

interface PhaseAssignmentHistory {
  id: string;
  changedAt: Timestamp;
  changedBy: string;
  previousOwnerId?: string;
  newOwnerId: string;
  reason?: string;
}
```

### User Picker Component

```tsx
const PhaseOwnerPicker = ({
  currentOwnerId,
  onSelect,
}: {
  currentOwnerId?: string;
  onSelect: (userId: string) => void;
}) => {
  const { data: users } = useOrganizationUsers();

  return (
    <Combobox value={currentOwnerId} onChange={onSelect}>
      <Combobox.Input placeholder="Rechercher un utilisateur..." />
      <Combobox.Options>
        {users.map(user => (
          <Combobox.Option key={user.id} value={user.id}>
            <Avatar src={user.avatarUrl} size="sm" />
            <span>{user.displayName}</span>
            <span className="text-gray-500">{user.email}</span>
          </Combobox.Option>
        ))}
      </Combobox.Options>
    </Combobox>
  );
};
```

### Notification Template

```typescript
const phaseAssignmentNotification = {
  type: 'smsi_phase_assignment',
  title: 'Nouvelle responsabilité SMSI',
  body: 'Vous avez été désigné(e) responsable de la phase {{phaseName}} du programme SMSI.',
  data: {
    programId: string,
    phase: 'plan' | 'do' | 'check' | 'act',
    assignedBy: string,
  },
  channels: ['email', 'in_app'],
};
```

### My Responsibilities Widget

```tsx
const MyResponsibilitiesWidget = () => {
  const { userId } = useAuth();
  const { data: phases } = useMyAssignedPhases(userId);

  return (
    <Card title="Mes Responsabilités SMSI">
      {phases.map(phase => (
        <PhaseCard
          key={phase.id}
          phase={phase}
          showMilestones
          compact
        />
      ))}
    </Card>
  );
};
```

### Assignment Flow

```typescript
const assignPhaseOwner = async (
  programId: string,
  phase: PDCAPhaseKey,
  newOwnerId: string,
  assignedBy: string
): Promise<void> => {
  const program = await getProgram(programId);
  const previousOwnerId = program.phases[phase].responsibleId;

  // Update phase
  await updateProgram(programId, {
    [`phases.${phase}.responsibleId`]: newOwnerId,
    [`phases.${phase}.responsibleAssignedAt`]: serverTimestamp(),
  });

  // Log history
  await addDoc(collection(db, `smsiPrograms/${programId}/assignmentHistory`), {
    phase,
    previousOwnerId,
    newOwnerId,
    changedBy: assignedBy,
    changedAt: serverTimestamp(),
  });

  // Send notification
  await NotificationService.send(newOwnerId, 'smsi_phase_assignment', {
    programId,
    phase,
    assignedBy,
  });
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-18.4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
