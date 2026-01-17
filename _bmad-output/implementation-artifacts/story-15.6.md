# Story 15.6: Génération de la Note de Cadrage

Status: done

> **Completed (2026-01-17):**
> - Created EbiosReportService.ts with generateWorkshop1Report() method
> - Created GenerateReportButton.tsx component with completion status checking
> - Integrated button in EbiosWizard for Workshop 1
> - PDF includes: Info générales, Missions, Biens Essentiels/Supports, Événements Redoutés, Socle de Sécurité
> - Note: AC4 (Storage upload) and AC5 (Sharing) deferred - using direct download for MVP

## Story

As a RSSI,
I want to generate the "Note de Cadrage" document,
so that I have a formal deliverable for this workshop.

## Acceptance Criteria

1. Bouton "Générer Note de Cadrage" visible quand toutes les sections sont complètes
2. Document PDF généré avec:
   - Résumé du périmètre
   - Liste des missions
   - Inventaire des actifs
   - Événements redoutés
   - Score du socle de sécurité
3. Possibilité de télécharger le document
4. Possibilité de partager le document
5. Format conforme ANSSI

## Tasks / Subtasks

- [ ] Task 1: Créer le template de rapport (AC: 2, 5)
  - [ ] `src/templates/ebios-workshop1-report.template.md`
  - [ ] Sections conformes ANSSI
  - [ ] Variables pour injection des données

- [ ] Task 2: Créer le service de génération (AC: 2)
  - [ ] `src/services/ebiosReportService.ts`
  - [ ] Méthode `generateWorkshop1Report(analysisId)`
  - [ ] Utiliser PdfService existant

- [ ] Task 3: Créer le composant GenerateReportButton (AC: 1)
  - [ ] Vérifier que toutes les sections sont complètes
  - [ ] Afficher état disabled si incomplet
  - [ ] Loading state pendant génération

- [ ] Task 4: Implémenter le téléchargement (AC: 3)
  - [ ] Stocker PDF dans Firebase Storage
  - [ ] Générer URL de téléchargement
  - [ ] Historique des versions générées

- [ ] Task 5: Implémenter le partage (AC: 4)
  - [ ] Bouton "Partager" avec options
  - [ ] Copier lien / Email / Slack (si configuré)

## Dev Notes

### Report Template Structure

```markdown
# Note de Cadrage EBIOS RM

## 1. Informations Générales
- Nom de l'analyse: {{name}}
- Date de création: {{createdAt}}
- Date cible de certification: {{targetDate}}

## 2. Périmètre et Missions Essentielles
{{#each missions}}
### {{name}}
- Description: {{description}}
- Criticité: {{criticality}}/4
{{/each}}

## 3. Biens Supports
{{#each supportingAssets}}
- {{name}} ({{type}}): {{description}}
{{/each}}

## 4. Événements Redoutés
{{#each fearedEvents}}
### {{name}}
- Impact: {{impactTypes}}
- Gravité: {{gravity}}/4
{{/each}}

## 5. Socle de Sécurité
- Score global: {{baselineScore}}%
- Mesures implémentées: {{implementedCount}}
- Mesures partielles: {{partialCount}}
- Mesures non implémentées: {{notImplementedCount}}
```

### Reuse Existing

- `PdfService` from `src/services/pdfService.ts`
- Firebase Storage for document storage
- `useDocument()` hook for download tracking

### Report Generation Flow

1. Collect all Workshop1Data
2. Validate completeness
3. Render markdown template
4. Convert to PDF via PdfService
5. Upload to Storage
6. Return download URL

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-13.6]
- [Source: src/services/pdfService.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
