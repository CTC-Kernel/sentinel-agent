# Story 20.5: Alertes et Rapports Automatiques

Status: ready-for-dev

## Story

As a PM/Dirigeant,
I want automatic alerts and reports,
so that I stay informed without manual effort.

## Acceptance Criteria

1. Alertes automatiques pour jalons approchant (7j, 3j, 1j)
2. Escalade pour jalons en retard
3. Rapport d'avancement hebdomadaire généré automatiquement
4. Rapports envoyables par email aux parties prenantes
5. Configuration des destinataires et fréquence
6. Dashboard des alertes actives

## Tasks / Subtasks

- [ ] Task 1: Créer la Cloud Function de rappels (AC: 1, 2)
  - [ ] `functions/src/scheduled/smsiAlerts.ts`
  - [ ] Scheduler: toutes les heures
  - [ ] Détection jalons J-7, J-3, J-1
  - [ ] Escalade si retard > 1 jour

- [ ] Task 2: Créer le template de rapport hebdomadaire (AC: 3)
  - [ ] `src/templates/smsi-weekly-report.template.md`
  - [ ] Sections: Résumé, Jalons, Risques, Actions
  - [ ] Génération PDF

- [ ] Task 3: Créer la fonction d'envoi automatique (AC: 3, 4)
  - [ ] Scheduler: chaque lundi 8h
  - [ ] Génération du rapport
  - [ ] Envoi aux destinataires configurés

- [ ] Task 4: Créer la configuration des alertes (AC: 5)
  - [ ] `src/components/smsi/AlertConfiguration.tsx`
  - [ ] Settings: recipients, frequency, channels
  - [ ] Toggle par type d'alerte

- [ ] Task 5: Créer le dashboard des alertes (AC: 6)
  - [ ] `src/components/smsi/AlertsDashboard.tsx`
  - [ ] Liste des alertes actives
  - [ ] Dismiss/Snooze options

## Dev Notes

### Alert Types

```typescript
type SMSIAlertType =
  | 'milestone_reminder_7d'
  | 'milestone_reminder_3d'
  | 'milestone_reminder_1d'
  | 'milestone_overdue'
  | 'milestone_overdue_escalation'
  | 'weekly_report'
  | 'phase_completion'
  | 'program_at_risk';

interface SMSIAlert {
  id: string;
  type: SMSIAlertType;
  programId: string;
  milestoneId?: string;
  phaseId?: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  recipientIds: string[];
  sentAt: Timestamp;
  acknowledgedAt?: Timestamp;
  acknowledgedBy?: string;
}
```

### Scheduled Function

```typescript
// functions/src/scheduled/smsiAlerts.ts
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const processSMSIAlerts = onSchedule('every 1 hours', async () => {
  const tenants = await getAllTenants();

  for (const tenant of tenants) {
    const program = await getActiveProgram(tenant.id);
    if (!program) continue;

    // 1. Check milestone reminders
    await checkMilestoneReminders(program);

    // 2. Check overdue milestones
    await checkOverdueMilestones(program);

    // 3. Escalate if needed
    await processEscalations(program);
  }
});

const checkMilestoneReminders = async (program: SMSIProgram) => {
  const milestones = getAllMilestones(program);
  const now = new Date();

  for (const milestone of milestones) {
    if (milestone.status === 'completed') continue;

    const daysUntilDue = differenceInDays(milestone.dueDate.toDate(), now);

    if (daysUntilDue === 7) {
      await sendAlert('milestone_reminder_7d', milestone);
    } else if (daysUntilDue === 3) {
      await sendAlert('milestone_reminder_3d', milestone);
    } else if (daysUntilDue === 1) {
      await sendAlert('milestone_reminder_1d', milestone);
    }
  }
};
```

### Weekly Report Template

```markdown
# Rapport SMSI Hebdomadaire

**Programme:** {{programName}}
**Période:** {{startDate}} - {{endDate}}
**Généré le:** {{generatedAt}}

---

## Résumé Exécutif

- **Progression globale:** {{progress}}%
- **Phase actuelle:** {{currentPhase}}
- **Jalons complétés cette semaine:** {{completedThisWeek}}
- **Jalons en retard:** {{overdueCount}}

## Jalons

### Complétés cette semaine
{{#each completedMilestones}}
- ✅ {{name}} ({{completedAt}})
{{/each}}

### À venir
{{#each upcomingMilestones}}
- 📅 {{name}} - Échéance: {{dueDate}}
{{/each}}

### En retard
{{#each overdueMilestones}}
- ⚠️ {{name}} - Retard: {{daysOverdue}} jours
{{/each}}

## Actions Requises

{{#each actions}}
1. {{description}} - Responsable: {{responsible}}
{{/each}}
```

### Alert Configuration

```typescript
interface AlertConfiguration {
  programId: string;
  enabled: boolean;
  milestoneReminders: {
    enabled: boolean;
    daysBeforeNotify: number[]; // [7, 3, 1]
    recipients: string[];
  };
  overdueAlerts: {
    enabled: boolean;
    escalateAfterDays: number;
    escalationRecipients: string[];
  };
  weeklyReport: {
    enabled: boolean;
    dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 1 = Monday
    time: string; // "08:00"
    recipients: string[];
  };
}
```

### Escalation Flow

```
Day 0: Milestone due
Day 1: Overdue alert to responsible
Day 3: Escalation to phase owner
Day 7: Escalation to program owner
Day 14: Escalation to management
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-18.5]
- [Source: src/services/notificationService.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
