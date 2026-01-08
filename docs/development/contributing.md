# 🤝 Guide de Contribution

Merci de contribuer à Sentinel GRC ! Ce guide vous aidera à respecter nos standards de qualité.

## 📋 Table des matières

1. [Code de conduite](#code-de-conduite)
2. [Workflow Git](#workflow-git)
3. [Standards de code](#standards-de-code)
4. [Conventions de commits](#conventions-de-commits)
5. [Pull Requests](#pull-requests)
6. [Tests](#tests)
7. [Documentation](#documentation)

## 🤲 Code de conduite

- Soyez respectueux et professionnel
- Accueillez les nouvelles idées et perspectives
- Acceptez les critiques constructives
- Focalisez-vous sur le meilleur pour le projet

## 🔄 Workflow Git

### Branches

```
main
  ↑
  │
feature/nom-fonctionnalité
fix/nom-bug
chore/nom-tâche
docs/nom-documentation
```

### Créer une branche

```bash
# Partir de main à jour
git checkout main
git pull origin main

# Créer une branche
git checkout -b feature/my-feature

# OU
git checkout -b fix/my-bug
```

### Types de branches

- `feature/`: Nouvelles fonctionnalités
- `fix/`: Corrections de bugs
- `chore/`: Tâches de maintenance
- `docs/`: Documentation
- `test/`: Ajout de tests
- `refactor/`: Refactoring sans changement fonctionnel
- `perf/`: Améliorations de performance

## 📝 Standards de code

### TypeScript

```typescript
// ✅ BON
interface User {
  id: string;
  email: string;
  role: Role;
}

function getUser(id: string): Promise<User | null> {
  return UserService.findById(id);
}

// ❌ MAUVAIS
function getUser(id: any): any {
  return UserService.findById(id);
}
```

### Règles ESLint

```typescript
// Toujours activer le mode strict
"use strict";

// Pas de console.log en production
// console.log("debug"); // ❌

// Utiliser ErrorLogger ou logger
import { logger } from '../utils/logger';
logger.info({ userId }, 'User created');

// Pas de any
// const data: any = {}; // ❌
const data: UserData = {}; // ✅

// Nommer les constantes en UPPER_CASE
const MAX_RETRIES = 3;
const API_BASE_URL = 'https://api.example.com';
```

### Composants React

```tsx
/**
 * Composant Asset Card
 *
 * @param asset - Asset à afficher
 * @param onSelect - Callback de sélection
 */
interface AssetCardProps {
  asset: Asset;
  onSelect?: (asset: Asset) => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset, onSelect }) => {
  const handleClick = () => {
    onSelect?.(asset);
  };

  return (
    <div
      onClick={handleClick}
      className="p-4 rounded-lg border hover:shadow-lg transition-shadow"
    >
      <h3>{asset.name}</h3>
      <p>{asset.type}</p>
    </div>
  );
};

// Memoization pour les composants lourds
export const AssetCard = React.memo<AssetCardProps>(
  ({ asset, onSelect }) => {
    // ...
  },
  (prev, next) => prev.asset.id === next.asset.id
);
```

### Hooks personnalisés

```typescript
/**
 * Hook pour gérer les assets
 *
 * @param organizationId - ID de l'organisation
 * @returns Assets et fonctions CRUD
 */
export function useAssets(organizationId: string) {
  const queryClient = useQueryClient();

  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets', organizationId],
    queryFn: () => AssetService.getAssets(organizationId),
    enabled: !!organizationId,
  });

  const createAsset = useMutation({
    mutationFn: AssetService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });

  return {
    assets,
    isLoading,
    createAsset: createAsset.mutate,
  };
}
```

### Services

```typescript
/**
 * Service de gestion des assets
 */
export class AssetService {
  /**
   * Récupère tous les assets d'une organisation
   *
   * @param organizationId - ID de l'organisation
   * @returns Liste des assets
   * @throws {Error} Si l'organisation n'existe pas
   */
  static async getAssets(organizationId: string): Promise<Asset[]> {
    const q = query(
      collection(db, 'assets'),
      where('organizationId', '==', organizationId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Asset[];
  }
}
```

## 💬 Conventions de commits

Nous utilisons [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <description>

[body optionnel]

[footer optionnel]
```

### Types

- `feat`: Nouvelle fonctionnalité
- `fix`: Correction de bug
- `docs`: Documentation
- `style`: Formatage (pas de changement de code)
- `refactor`: Refactoring
- `perf`: Amélioration de performance
- `test`: Ajout de tests
- `chore`: Maintenance

### Exemples

```bash
# Feature
git commit -m "feat(assets): add CSV export functionality"

# Bug fix
git commit -m "fix(risks): correct risk score calculation for edge cases"

# Documentation
git commit -m "docs(api): add JSDoc to RiskCalculationService"

# Performance
git commit -m "perf(dashboard): memoize expensive computations in risk matrix"

# Breaking change
git commit -m "feat(auth)!: migrate to Firebase Auth v11

BREAKING CHANGE: Authentication API has changed"
```

## 🔀 Pull Requests

### Checklist avant PR

- [ ] Code respecte les standards
- [ ] Tests passent (`npm test`)
- [ ] ESLint sans erreurs (`npm run lint`)
- [ ] TypeScript compile (`npm run type-check`)
- [ ] Build fonctionne (`npm run build`)
- [ ] Documentation à jour
- [ ] Pas de `console.log`
- [ ] Pas de `any`

### Template de PR

```markdown
## 📝 Description

Brève description de vos changements.

## 🎯 Type de changement

- [ ] 🐛 Bug fix
- [ ] ✨ Nouvelle fonctionnalité
- [ ] 📚 Documentation
- [ ] 🎨 Refactoring
- [ ] ⚡ Performance

## 🧪 Tests

Décrivez les tests effectués:
- [ ] Tests unitaires
- [ ] Tests E2E
- [ ] Tests manuels

## 📸 Screenshots

Si applicable, ajoutez des screenshots.

## ✅ Checklist

- [ ] Code respecte les standards
- [ ] Tests passent
- [ ] Documentation à jour
- [ ] ESLint sans erreurs
- [ ] TypeScript compile
```

### Process de review

1. **Auto-review**: Relisez votre code avant de soumettre
2. **CI checks**: Assurez-vous que les checks passent
3. **Reviews**: Attendez au moins 1 approbation
4. **Merge**: Utilisez "Squash and merge"

## 🧪 Tests

### Tests unitaires

```typescript
import { describe, it, expect } from 'vitest';
import { RiskCalculationService } from './RiskCalculationService';

describe('RiskCalculationService', () => {
  describe('calculateScore', () => {
    it('should calculate correct risk score', () => {
      const score = RiskCalculationService.calculateScore(4, 5);
      expect(score).toBe(20);
    });

    it('should throw error for invalid probability', () => {
      expect(() => {
        RiskCalculationService.calculateScore(6, 5);
      }).toThrow('La probabilité doit être un entier entre 1 et 5');
    });
  });
});
```

### Tests E2E

```typescript
import { test, expect } from '@playwright/test';

test('should create new asset', async ({ page }) => {
  await page.goto('/assets');

  await page.click('button:has-text("Nouvel actif")');
  await page.fill('input[name="name"]', 'Test Asset');
  await page.selectOption('select[name="type"]', 'Matériel');
  await page.click('button:has-text("Créer")');

  await expect(page.locator('text=Test Asset')).toBeVisible();
});
```

### Coverage

Objectif: **80%+**

```bash
npm run test:coverage
```

## 📚 Documentation

### JSDoc

```typescript
/**
 * Calcule le score de risque selon ISO 27005
 *
 * @param probability - Probabilité d'occurrence (1-5)
 * @param impact - Impact potentiel (1-5)
 * @returns Score de risque (1-25)
 *
 * @throws {Error} Si probability ou impact invalides
 *
 * @example
 * ```typescript
 * const score = calculateRiskScore(4, 5);
 * // score = 20
 * ```
 */
export function calculateRiskScore(
  probability: number,
  impact: number
): number {
  // ...
}
```

### README

Mettez à jour le README si vous:
- Ajoutez une nouvelle fonctionnalité majeure
- Changez les dépendances
- Modifiez les scripts npm
- Changez la configuration

## 🚫 Anti-patterns à éviter

### ❌ God components

```tsx
// Mauvais: composant fait trop de choses
const AssetPage = () => {
  // 500 lignes de logique...
};

// Bon: séparation des responsabilités
const AssetPage = () => {
  return (
    <>
      <AssetHeader />
      <AssetFilters />
      <AssetList />
      <AssetInspector />
    </>
  );
};
```

### ❌ Prop drilling

```tsx
// Mauvais
<Parent user={user}>
  <Child user={user}>
    <GrandChild user={user}>
      <GreatGrandChild user={user} />
    </GrandChild>
  </Child>
</Parent>

// Bon: utiliser Context ou Zustand
const { user } = useStore();
```

### ❌ Mutations directes

```tsx
// Mauvais
state.assets.push(newAsset);

// Bon
setState(prev => ({
  ...prev,
  assets: [...prev.assets, newAsset]
}));
```

## 🎓 Ressources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Docs](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)

## 💡 Questions ?

N'hésitez pas à:
- Ouvrir une issue
- Demander sur Discord
- Contacter l'équipe: dev@sentinel-grc.com

---

**Merci de contribuer à Sentinel GRC !** 🎉
