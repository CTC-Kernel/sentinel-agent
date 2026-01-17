# Story 22.1: Évaluation de l'Efficacité des Contrôles

Status: ready-for-dev

## Story

As a RSSI,
I want to evaluate control effectiveness,
so that I know if my security measures work.

## Acceptance Criteria

1. Évaluation de chaque contrôle: 0-100% d'efficacité
2. Documentation: Date d'évaluation, Méthode, Preuves
3. Efficacité alimente le calcul de risque résiduel
4. Historique des évaluations conservé
5. Alertes pour contrôles non évalués depuis X mois
6. Bulk evaluation possible pour plusieurs contrôles

## Tasks / Subtasks

- [ ] Task 1: Étendre le type Control (AC: 1, 2)
  - [ ] Ajouter champs: effectiveness, assessments[]
  - [ ] Type Assessment avec méthode et preuves

- [ ] Task 2: Créer le composant ControlEffectivenessForm (AC: 1, 2)
  - [ ] `src/components/controls/ControlEffectivenessForm.tsx`
  - [ ] Slider 0-100%
  - [ ] Select pour méthode d'évaluation
  - [ ] Upload de preuves

- [ ] Task 3: Implémenter le lien avec risque résiduel (AC: 3)
  - [ ] `useControlEffectiveness(controlId)`
  - [ ] Recalcul automatique des risques liés
  - [ ] Notification si changement significatif

- [ ] Task 4: Créer l'historique des évaluations (AC: 4)
  - [ ] Sous-collection `assessments`
  - [ ] Timeline des évaluations
  - [ ] Trend chart

- [ ] Task 5: Créer les alertes et bulk (AC: 5, 6)
  - [ ] Cloud Function: stale assessments
  - [ ] Multi-select et bulk update form
  - [ ] Dashboard des évaluations en retard

## Dev Notes

### Data Structure

```typescript
interface Control {
  // ... existing fields
  effectiveness?: number; // 0-100
  lastAssessmentDate?: Timestamp;
  lastAssessmentBy?: string;
  assessmentStatus: 'not_assessed' | 'current' | 'stale';
}

interface ControlAssessment {
  id: string;
  controlId: string;
  assessmentDate: Timestamp;
  assessedBy: string;
  effectiveness: number; // 0-100
  method: AssessmentMethod;
  evidenceIds: string[];
  notes: string;
  previousEffectiveness?: number;
  changeJustification?: string;
}

type AssessmentMethod =
  | 'self_assessment'
  | 'internal_audit'
  | 'external_audit'
  | 'penetration_test'
  | 'vulnerability_scan'
  | 'review_of_evidence'
  | 'interview'
  | 'observation';
```

### Effectiveness Scale

```typescript
const effectivenessScale = [
  { range: [0, 20], label: 'Non efficace', color: '#ef4444', description: 'Contrôle absent ou non fonctionnel' },
  { range: [21, 40], label: 'Peu efficace', color: '#f97316', description: 'Contrôle partiel ou inefficace' },
  { range: [41, 60], label: 'Modérément efficace', color: '#eab308', description: 'Contrôle basique fonctionnel' },
  { range: [61, 80], label: 'Efficace', color: '#84cc16', description: 'Contrôle robuste avec améliorations possibles' },
  { range: [81, 100], label: 'Très efficace', color: '#22c55e', description: 'Contrôle optimisé et éprouvé' },
];
```

### Assessment Methods

| Method | Description | Confidence Level |
|--------|-------------|------------------|
| self_assessment | Auto-évaluation par le responsable | Low |
| review_of_evidence | Revue documentaire | Medium |
| interview | Entretiens avec les opérationnels | Medium |
| observation | Observation directe | Medium-High |
| internal_audit | Audit interne formel | High |
| vulnerability_scan | Scan de vulnérabilités | High |
| penetration_test | Test d'intrusion | Very High |
| external_audit | Audit externe/certification | Very High |

### Effectiveness Form

```tsx
const ControlEffectivenessForm = ({
  control,
  onSave,
}: {
  control: Control;
  onSave: (assessment: ControlAssessment) => void;
}) => (
  <form onSubmit={handleSubmit}>
    <div className="space-y-4">
      <div>
        <label>Efficacité (%)</label>
        <Slider
          min={0}
          max={100}
          step={5}
          value={effectiveness}
          onChange={setEffectiveness}
        />
        <EffectivenessLabel value={effectiveness} />
      </div>

      <div>
        <label>Méthode d'évaluation</label>
        <Select options={assessmentMethodOptions} value={method} onChange={setMethod} />
      </div>

      <div>
        <label>Preuves</label>
        <EvidenceUploader onUpload={handleEvidenceUpload} />
        <EvidenceList evidences={selectedEvidences} />
      </div>

      <div>
        <label>Notes</label>
        <Textarea value={notes} onChange={setNotes} />
      </div>

      <Button type="submit">Enregistrer l'évaluation</Button>
    </div>
  </form>
);
```

### Stale Assessment Detection

```typescript
// Cloud Function
export const detectStaleAssessments = onSchedule('every 24 hours', async () => {
  const staleThreshold = 6; // months
  const cutoffDate = subMonths(new Date(), staleThreshold);

  const staleControls = await db
    .collectionGroup('controls')
    .where('lastAssessmentDate', '<', cutoffDate)
    .get();

  for (const control of staleControls.docs) {
    await updateDoc(control.ref, { assessmentStatus: 'stale' });

    const responsibleId = control.data().responsibleId;
    if (responsibleId) {
      await NotificationService.send(responsibleId, 'control_assessment_stale', {
        controlId: control.id,
        controlName: control.data().name,
        lastAssessmentDate: control.data().lastAssessmentDate,
      });
    }
  }
});
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-20.1]
- [Source: ISO 27002:2022 - Control effectiveness]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
