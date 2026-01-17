# Story 18.5: Création Automatique dans le Registre de Risques

Status: done

> Note: Cette story était déjà implémentée dans Workshop4Content.tsx avec handleCreateRiskFromScenario() et CreateRiskFromEbiosData

## Story

As a RSSI,
I want operational scenarios to create risks in my registry,
so that EBIOS feeds into my GRC system.

## Acceptance Criteria

1. Bouton "Créer risque dans le registre" sur chaque scénario opérationnel
2. Risque créé avec: Titre, Description, Impact, Probabilité
3. Risque lié au scénario EBIOS source
4. Risque apparaît dans la liste avec badge "Source: EBIOS RM"
5. Mise à jour bidirectionnelle (optionnel)
6. Création en batch possible pour plusieurs scénarios

## Tasks / Subtasks

- [ ] Task 1: Créer le service d'intégration (AC: 2, 3)
  - [ ] `src/services/ebiosRiskIntegrationService.ts`
  - [ ] `createRiskFromScenario(operationalScenarioId)`
  - [ ] Mapping des champs EBIOS → Risk

- [ ] Task 2: Ajouter le bouton de création (AC: 1)
  - [ ] Bouton dans ScenarioCard et ScenarioDetails
  - [ ] État: Créer / Déjà créé (lié)
  - [ ] Confirmation avant création

- [ ] Task 3: Implémenter le mapping (AC: 2)
  - [ ] Titre ← Nom du scénario
  - [ ] Description ← Narrative + techniques MITRE
  - [ ] Impact ← Gravité stratégique
  - [ ] Probability ← Vraisemblance opérationnelle

- [ ] Task 4: Ajouter la référence EBIOS (AC: 3, 4)
  - [ ] `Risk.ebiosReference: { analysisId, scenarioId, type: 'operational' }`
  - [ ] Badge "EBIOS RM" dans RiskList
  - [ ] Lien cliquable vers le scénario

- [ ] Task 5: Implémenter la création batch (AC: 6)
  - [ ] Multi-select dans la liste des scénarios
  - [ ] Action "Créer risques sélectionnés"
  - [ ] Progress indicator

## Dev Notes

### Risk Mapping

```typescript
interface RiskFromEbios {
  title: string;
  description: string;
  category: 'operational' | 'strategic';
  inherentImpact: 1 | 2 | 3 | 4 | 5;
  inherentProbability: 1 | 2 | 3 | 4 | 5;
  ebiosReference: EbiosReference;
  source: 'ebios_rm';
  createdAt: Timestamp;
}

interface EbiosReference {
  analysisId: string;
  analysisName: string;
  scenarioId: string;
  scenarioCode: string;
  scenarioType: 'strategic' | 'operational';
}
```

### Mapping Logic

```typescript
const createRiskFromScenario = async (
  operationalScenario: OperationalScenario,
  strategicScenario: StrategicScenario,
  analysis: EbiosAnalysis
): Promise<Risk> => {
  // Map 1-4 EBIOS scale to 1-5 risk scale
  const mapScale = (value: number): number => Math.min(5, value + 1);

  const risk: RiskFromEbios = {
    title: `[EBIOS] ${operationalScenario.name}`,
    description: buildDescription(operationalScenario, strategicScenario),
    category: 'operational',
    inherentImpact: mapScale(strategicScenario.gravity),
    inherentProbability: mapScale(operationalScenario.likelihood),
    ebiosReference: {
      analysisId: analysis.id,
      analysisName: analysis.name,
      scenarioId: operationalScenario.id,
      scenarioCode: operationalScenario.code,
      scenarioType: 'operational',
    },
    source: 'ebios_rm',
    createdAt: serverTimestamp(),
  };

  return RiskService.create(risk);
};

const buildDescription = (op: OperationalScenario, st: StrategicScenario): string => {
  const mitreRefs = op.attackSteps
    .filter(s => s.mitreReference)
    .map(s => s.mitreReference)
    .join(', ');

  return `
**Scénario stratégique:** ${st.name}
**Narrative:** ${st.narrative}

**Modes opératoires:**
${op.description}

**Techniques MITRE ATT&CK:** ${mitreRefs || 'Non spécifiées'}

---
*Risque généré automatiquement depuis l'analyse EBIOS RM*
  `.trim();
};
```

### EBIOS Badge Component

```tsx
const EbiosBadge = ({ reference }: { reference: EbiosReference }) => (
  <Link to={`/ebios/${reference.analysisId}/workshop4/${reference.scenarioId}`}>
    <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-800 text-xs">
      <span className="mr-1">📊</span>
      EBIOS RM - {reference.scenarioCode}
    </span>
  </Link>
);
```

### Batch Creation

```typescript
const createRisksBatch = async (
  scenarioIds: string[],
  analysisId: string
): Promise<{ created: number; failed: string[] }> => {
  const results = await Promise.allSettled(
    scenarioIds.map(id => createRiskFromScenario(id))
  );

  return {
    created: results.filter(r => r.status === 'fulfilled').length,
    failed: results
      .filter(r => r.status === 'rejected')
      .map((r, i) => scenarioIds[i]),
  };
};
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-16.5]
- [Source: src/services/riskService.ts]
- [Source: src/types/risk.ts]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
