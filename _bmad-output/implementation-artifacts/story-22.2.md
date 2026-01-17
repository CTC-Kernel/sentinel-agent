# Story 22.2: Score de Maturité par Domaine

Status: ready-for-dev

## Story

As a RSSI/Dirigeant,
I want to see maturity scores by ISO 27002 domain,
so that I identify weak areas.

## Acceptance Criteria

1. Scores calculés pour chacune des 4 catégories ISO 27002
2. Radar chart montrant la maturité relative par catégorie
3. Mise en évidence des domaines à faible score
4. Drill-down pour voir les contrôles individuels par domaine
5. Trend: évolution des scores dans le temps
6. Comparaison avec objectifs cibles

## Tasks / Subtasks

- [ ] Task 1: Implémenter le calcul de score par catégorie (AC: 1)
  - [ ] Agrégation par catégorie ISO 27002
  - [ ] Moyenne pondérée des effectiveness
  - [ ] Prise en compte du nombre de contrôles

- [ ] Task 2: Créer le composant MaturityRadarChart (AC: 2)
  - [ ] `src/components/controls/MaturityRadarChart.tsx`
  - [ ] 4 axes: Organizational, People, Physical, Technological
  - [ ] Zones de couleur par niveau

- [ ] Task 3: Créer le highlighting des points faibles (AC: 3)
  - [ ] Seuil configurable (ex: < 60%)
  - [ ] Alert cards pour domaines faibles
  - [ ] Recommendations basées sur les gaps

- [ ] Task 4: Créer la vue drill-down (AC: 4)
  - [ ] Click sur segment → liste des contrôles
  - [ ] Tri par effectiveness
  - [ ] Quick actions

- [ ] Task 5: Implémenter les trends et objectifs (AC: 5, 6)
  - [ ] Snapshots mensuels
  - [ ] Line chart historique
  - [ ] Target line overlay
  - [ ] Gap to target indicator

## Dev Notes

### ISO 27002:2022 Categories

```typescript
const iso27002Categories = {
  organizational: {
    code: '5',
    name: 'Contrôles organisationnels',
    icon: '🏢',
    color: '#3b82f6',
    controlCount: 37,
  },
  people: {
    code: '6',
    name: 'Contrôles liés aux personnes',
    icon: '👥',
    color: '#22c55e',
    controlCount: 8,
  },
  physical: {
    code: '7',
    name: 'Contrôles physiques',
    icon: '🏗️',
    color: '#f59e0b',
    controlCount: 14,
  },
  technological: {
    code: '8',
    name: 'Contrôles technologiques',
    icon: '💻',
    color: '#8b5cf6',
    controlCount: 34,
  },
};
```

### Maturity Score Calculation

```typescript
interface CategoryMaturity {
  category: string;
  score: number; // 0-100
  controlsTotal: number;
  controlsAssessed: number;
  controlsEffective: number; // >= 60%
  trend: 'up' | 'stable' | 'down';
  target: number;
  gap: number;
}

const calculateCategoryMaturity = (
  controls: Control[],
  category: string
): CategoryMaturity => {
  const categoryControls = controls.filter(c => c.category === category);
  const assessedControls = categoryControls.filter(c => c.effectiveness !== undefined);

  const score = assessedControls.length > 0
    ? assessedControls.reduce((sum, c) => sum + c.effectiveness!, 0) / assessedControls.length
    : 0;

  const effectiveCount = assessedControls.filter(c => c.effectiveness! >= 60).length;

  return {
    category,
    score: Math.round(score),
    controlsTotal: categoryControls.length,
    controlsAssessed: assessedControls.length,
    controlsEffective: effectiveCount,
    trend: calculateTrend(category),
    target: 75, // Configurable
    gap: Math.max(0, 75 - score),
  };
};
```

### Radar Chart Component

```tsx
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

const MaturityRadarChart = ({ maturityData }: { maturityData: CategoryMaturity[] }) => {
  const data = maturityData.map(m => ({
    category: m.category,
    score: m.score,
    target: m.target,
    fullMark: 100,
  }));

  return (
    <RadarChart width={400} height={400} data={data}>
      <PolarGrid />
      <PolarAngleAxis dataKey="category" />
      <PolarRadiusAxis domain={[0, 100]} />
      <Radar
        name="Score actuel"
        dataKey="score"
        stroke="#3b82f6"
        fill="#3b82f6"
        fillOpacity={0.5}
      />
      <Radar
        name="Objectif"
        dataKey="target"
        stroke="#22c55e"
        fill="none"
        strokeDasharray="5 5"
      />
    </RadarChart>
  );
};
```

### Weak Areas Highlighting

```tsx
const WeakAreasAlert = ({ maturityData }: { maturityData: CategoryMaturity[] }) => {
  const weakAreas = maturityData.filter(m => m.score < 60);

  if (weakAreas.length === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h4 className="font-medium text-yellow-800 flex items-center">
        <span className="mr-2">⚠️</span>
        Domaines nécessitant une attention
      </h4>
      <ul className="mt-2 space-y-1">
        {weakAreas.map(area => (
          <li key={area.category} className="text-yellow-700">
            <strong>{iso27002Categories[area.category].name}:</strong> {area.score}%
            <span className="text-sm ml-2">
              ({area.controlsAssessed}/{area.controlsTotal} évalués)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

### Trend Calculation

```typescript
const calculateTrend = (
  category: string,
  currentScore: number,
  historicalScores: { date: Timestamp; score: number }[]
): 'up' | 'stable' | 'down' => {
  if (historicalScores.length < 2) return 'stable';

  const lastMonthScore = historicalScores[historicalScores.length - 2].score;
  const diff = currentScore - lastMonthScore;

  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'stable';
};
```

### Historical Snapshots

```typescript
// Scheduled monthly snapshot
export const createMaturitySnapshot = onSchedule('0 0 1 * *', async () => {
  const tenants = await getAllTenants();

  for (const tenant of tenants) {
    const controls = await getControls(tenant.id);
    const maturityData = calculateAllCategoryMaturity(controls);

    await addDoc(
      collection(db, `tenants/${tenant.id}/maturitySnapshots`),
      {
        date: serverTimestamp(),
        data: maturityData,
      }
    );
  }
});
```

### References

- [Source: _bmad-output/planning-artifacts/epics-ebios-rm-iso27003-2026-01-16.md#Story-20.2]
- [Source: ISO 27002:2022]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
