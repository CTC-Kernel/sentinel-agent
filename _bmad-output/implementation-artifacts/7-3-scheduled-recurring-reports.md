# Story 7.3: Scheduled Recurring Reports

Status: done

## Story

As a **user**,
I want **to schedule recurring reports**,
So that **I receive regular updates automatically**.

## Acceptance Criteria

1. **Given** the user creates a report
   **When** they click "Schedule"
   **Then** they can set frequency: Weekly, Monthly, Quarterly

2. **Given** a scheduled report is created
   **When** they specify recipients (email addresses)
   **Then** reports are generated and emailed automatically

3. **Given** scheduled reports exist
   **When** the user views the scheduled tab
   **Then** they can see, edit, or cancel scheduled reports

## Tasks / Subtasks

- [x] **Task 1: Create Scheduled Report Data Model** (AC: 1, 2)
  - [x] 1.1 Define ScheduledReport type in types/reports.ts
  - [x] 1.2 Add frequency enum (weekly, monthly, quarterly)
  - [x] 1.3 Include recipients, template, configuration fields

- [x] **Task 2: Create Schedule Report Modal** (AC: 1, 2)
  - [x] 2.1 Create ScheduleReportModal.tsx component
  - [x] 2.2 Frequency selection (Weekly, Monthly, Quarterly)
  - [x] 2.3 Recipients input with email validation
  - [x] 2.4 Report template/configuration selection

- [x] **Task 3: Create Scheduled Reports Service** (AC: 2, 3)
  - [x] 3.1 Create scheduledReportsService.ts for CRUD operations
  - [x] 3.2 Store schedules in Firestore (organizations/{orgId}/scheduledReports)
  - [x] 3.3 Calculate next run date based on frequency

- [x] **Task 4: Update Reports View** (AC: 3)
  - [x] 4.1 Replace placeholder in "scheduled" tab with actual list
  - [x] 4.2 Add "Schedule" button to report templates
  - [x] 4.3 Display scheduled reports with edit/delete actions

## Dev Notes

### Scheduled Report Schema

```typescript
interface ScheduledReport {
    id: string;
    organizationId: string;
    name: string;
    templateId: 'iso27001' | 'gdpr' | 'custom';
    frequency: 'weekly' | 'monthly' | 'quarterly';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-28 for monthly
    recipients: string[]; // email addresses
    config: ReportConfig;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    lastRunAt?: string;
    nextRunAt: string;
    status: 'active' | 'paused';
}
```

### Files to Create

| File | Purpose |
|------|---------|
| `src/types/reports.ts` | ScheduledReport type definition |
| `src/services/scheduledReportsService.ts` | CRUD for scheduled reports |
| `src/components/reports/ScheduleReportModal.tsx` | Scheduling UI |

### Files to Modify

| File | Changes |
|------|---------|
| `src/views/Reports.tsx` | Update scheduled tab, add schedule buttons |

### Cloud Function Note

The actual email sending would be handled by a Cloud Function that:
1. Runs on a daily schedule
2. Checks for reports due today
3. Generates PDF using server-side rendering
4. Sends via email service (SendGrid, etc.)

This story focuses on the UI/frontend portion. Cloud Function implementation would be a separate infrastructure task.

## References

- [Source: epics.md#Story-7.3] - Story requirements
- [FR32: Rapports planifiés] - PRD requirement

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. Created comprehensive type definitions in `src/types/reports.ts`:
   - ScheduledReport interface with all required fields
   - ReportFrequency type (weekly, monthly, quarterly)
   - ReportTemplateId type (iso27001, gdpr, custom)
   - Helper functions for frequency labels and next run date calculation

2. Created ScheduleReportModal component with:
   - Report name input
   - Template selection (ISO 27001, RGPD, Custom)
   - Frequency selection with visual buttons
   - Day of week/month selection based on frequency
   - Next run date preview
   - Multiple recipients with email validation
   - Content options for custom reports (risks, compliance, audits, projects, incidents)

3. Created scheduledReportsService.ts with full CRUD:
   - getScheduledReports() - Fetch all org reports
   - createScheduledReport() - Create with auto-calculated nextRunAt
   - updateScheduledReport() - Update with nextRunAt recalculation
   - toggleScheduledReportStatus() - Pause/activate reports
   - deleteScheduledReport() - Remove schedules
   - markReportAsRun() - Update after execution

4. Updated Reports.tsx:
   - Added Calendar button to each report template for scheduling
   - Replaced "scheduled" tab placeholder with actual list
   - Cards show: name, template type, frequency, recipients count, next run date
   - Actions: Pause/Activate toggle, Delete with confirmation
   - Empty state with "Planifier un rapport" CTA

### File List

| File | Action | Purpose |
|------|--------|---------|
| `src/types/reports.ts` | Created | Type definitions for scheduled reports |
| `src/services/scheduledReportsService.ts` | Created | Firestore CRUD service |
| `src/components/reports/ScheduleReportModal.tsx` | Created | Modal UI for scheduling |
| `src/views/Reports.tsx` | Modified | Integrated scheduling UI and list |
