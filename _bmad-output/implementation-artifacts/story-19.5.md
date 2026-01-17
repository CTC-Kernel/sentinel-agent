# Story 19.5: Génération de la Synthèse EBIOS RM

Status: ready-for-dev

## Story

As a RSSI,
I want to generate a complete EBIOS RM summary,
so that I have the final deliverable.

## Acceptance Criteria

1. Bouton "Générer synthèse" disponible après complétion des 5 ateliers
2. Rapport complet incluant:
   - Résumé exécutif
   - Atelier 1: Périmètre et socle
   - Atelier 2: Analyse SR/OV
   - Atelier 3: Scénarios stratégiques
   - Atelier 4: Scénarios opérationnels
   - Atelier 5: Plan de traitement
   - Résumé du registre de risques
3. Format conforme aux attentes ANSSI
4. Sections personnalisables (inclusion/exclusion)
5. Génération de version intermédiaire possible
6. Historique des versions générées

## Tasks / Subtasks

- [ ] Task 1: Créer le template de rapport complet (AC: 2, 3)
  - [ ] `src/templates/ebios-full-report.template.md`
  - [ ] Sections pour chaque atelier
  - [ ] Variables pour injection des données
  - [ ] Styling conforme ANSSI

- [ ] Task 2: Créer le service de génération (AC: 1, 5)
  - [ ] `src/services/ebiosReportService.ts`
  - [ ] `generateFullReport(analysisId, options)`
  - [ ] Support génération partielle
  - [ ] Aggregation de toutes les données

- [ ] Task 3: Créer le composant ReportGenerator (AC: 1, 4)
  - [ ] `src/components/ebios/shared/ReportGenerator.tsx`
  - [ ] Modal avec options de sections
  - [ ] Checkboxes pour inclusion/exclusion
  - [ ] Preview avant génération

- [ ] Task 4: Implémenter le stockage des versions (AC: 6)
  - [ ] Collection `ebiosAnalyses/{id}/reports`
  - [ ] Versioning: v1, v2, v3...
  - [ ] Metadata: generatedAt, generatedBy, sections

- [ ] Task 5: Créer le composant ReportHistory (AC: 6)
  - [ ] Liste des versions générées
  - [ ] Téléchargement de chaque version
  - [ ] Comparaison entre versions (future)

## Dev Notes

### Report Template Structure

```markdown
# Synthèse EBIOS RM
## {{analysisName}}

**Organisation:** {{organizationName}}
**Date:** {{generatedAt}}
**Version:** {{version}}

---

## 1. Résumé Exécutif

### Périmètre
{{scope.summary}}

### Principaux Risques Identifiés
{{#each topRisks}}
- **{{name}}** (Niveau: {{riskLevel}})
{{/each}}

### Actions Prioritaires
{{#each priorityActions}}
1. {{description}} - Échéance: {{deadline}}
{{/each}}

---

## 2. Atelier 1: Cadrage et Socle de Sécurité

### 2.1 Missions Essentielles
{{#each missions}}
| Mission | Description | Criticité |
|---------|-------------|-----------|
| {{name}} | {{description}} | {{criticality}}/4 |
{{/each}}

### 2.2 Biens Supports
[...]

### 2.3 Événements Redoutés
[...]

### 2.4 Socle de Sécurité
Score global: **{{baselineScore}}%**
[...]

---

## 3. Atelier 2: Sources de Risque
[...]

## 4. Atelier 3: Scénarios Stratégiques
[...]

## 5. Atelier 4: Scénarios Opérationnels
[...]

## 6. Atelier 5: Plan de Traitement
[...]

---

## 7. Annexes

### A. Matrice de Risques
### B. Correspondance MITRE ATT&CK
### C. Mapping ISO 27002
```

### Report Options

```typescript
interface ReportOptions {
  sections: {
    executiveSummary: boolean;
    workshop1: boolean;
    workshop2: boolean;
    workshop3: boolean;
    workshop4: boolean;
    workshop5: boolean;
    riskRegister: boolean;
    annexes: boolean;
  };
  includeEcosystemDiagram: boolean;
  includeRiskMatrix: boolean;
  includeMitreMapping: boolean;
  format: 'pdf' | 'markdown' | 'docx';
}
```

### Version Management

```typescript
interface ReportVersion {
  id: string;
  version: string; // "v1", "v2", etc.
  generatedAt: Timestamp;
  generatedBy: string;
  options: ReportOptions;
  storageUrl: string;
  fileSize: number;
}
```

### Generation Service

```typescript
const generateFullReport = async (
  analysisId: string,
  options: ReportOptions
): Promise<ReportVersion> => {
  // 1. Load all workshop data
  const analysis = await getAnalysis(analysisId);
  const workshops = await loadAllWorkshops(analysisId);

  // 2. Compile report data
  const reportData = compileReportData(analysis, workshops, options);

  // 3. Render template
  const markdown = renderTemplate('ebios-full-report', reportData);

  // 4. Convert to PDF
  const pdf = await PdfService.generateFromMarkdown(markdown);

  // 5. Upload to Storage
  const url = await uploadReport(analysisId, pdf);

  // 6. Save version
  const version = await saveReportVersion(analysisId, options, url);

  return version;
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-17.5]
- [Source: src/services/pdfService.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
