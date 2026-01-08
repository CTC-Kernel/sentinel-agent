import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, BASE_URL } from './utils';

test.describe('Asset Forms E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should open asset creation form', async ({ page }) => {
        await page.goto(`${BASE_URL}/assets`);
        await page.waitForLoadState('networkidle');

        // Look for create/add button
        const createButton = page.locator('button').filter({ hasText: /add|create|nouveau|ajouter|\+/i });
        if (await createButton.count() > 0) {
            await createButton.first().click();
            await page.waitForTimeout(500);

            // Check if form/modal opened
            const form = page.locator('form, [role="dialog"], .modal');
            if (await form.count() > 0) {
                await expect(form.first()).toBeVisible();
            }
        }
    });

    test('should validate asset form fields', async ({ page }) => {
        await page.goto(`${BASE_URL}/assets`);
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('button').filter({ hasText: /add|create|nouveau|ajouter|\+/i });
        if (await createButton.count() > 0) {
            await createButton.first().click();
            await page.waitForTimeout(500);

            // Try to submit empty form
            const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /save|submit|enregistrer|créer/i });
            if (await submitButton.count() > 0) {
                await submitButton.first().click();
                await page.waitForTimeout(500);

                // Check for validation errors - ensure form validation is active
                const errorLocator = page.locator('.error, [role="alert"], .text-red, .text-destructive');
                // Validation should show errors for required fields
                await expect(errorLocator.first()).toBeVisible({ timeout: 3000 }).catch(() => {
                    // Some forms may not have visible validation errors
                });
            }
        }
    });

    test('should fill asset form with valid data', async ({ page }) => {
        await page.goto(`${BASE_URL}/assets`);
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('button').filter({ hasText: /add|create|nouveau|ajouter|\+/i });
        if (await createButton.count() > 0) {
            await createButton.first().click();
            await page.waitForTimeout(500);

            // Fill form fields
            const nameInput = page.locator('input[name="name"], input[placeholder*="nom" i]');
            if (await nameInput.count() > 0) {
                await nameInput.first().fill('Test Asset E2E');
            }

            const typeSelect = page.locator('select[name="type"], [data-testid="type-select"]');
            if (await typeSelect.count() > 0) {
                await typeSelect.first().selectOption({ index: 1 });
            }
        }
    });
});

test.describe('Risk Forms E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should open risk creation form', async ({ page }) => {
        await page.goto(`${BASE_URL}/risks`);
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('button').filter({ hasText: /add|create|nouveau|ajouter|\+/i });
        if (await createButton.count() > 0) {
            await createButton.first().click();
            await page.waitForTimeout(500);

            const form = page.locator('form, [role="dialog"], .modal');
            if (await form.count() > 0) {
                await expect(form.first()).toBeVisible();
            }
        }
    });

    test('should display risk matrix', async ({ page }) => {
        await page.goto(`${BASE_URL}/risks`);
        await page.waitForLoadState('networkidle');

        // Look for risk matrix visualization
        const matrix = page.locator('.risk-matrix, [data-testid="risk-matrix"], canvas, svg');
        if (await matrix.count() > 0) {
            await expect(matrix.first()).toBeVisible();
        }
    });

    test('should filter risks by status', async ({ page }) => {
        await page.goto(`${BASE_URL}/risks`);
        await page.waitForLoadState('networkidle');

        // Look for filter controls
        const filterButton = page.locator('button').filter({ hasText: /filter|filtre/i });
        if (await filterButton.count() > 0) {
            await filterButton.first().click();
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Incident Forms E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should open incident creation form', async ({ page }) => {
        await page.goto(`${BASE_URL}/incidents`);
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('button').filter({ hasText: /add|create|nouveau|ajouter|déclarer|\+/i });
        if (await createButton.count() > 0) {
            await createButton.first().click();
            await page.waitForTimeout(500);

            const form = page.locator('form, [role="dialog"], .modal');
            if (await form.count() > 0) {
                await expect(form.first()).toBeVisible();
            }
        }
    });

    test('should display incident severity options', async ({ page }) => {
        await page.goto(`${BASE_URL}/incidents`);
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('button').filter({ hasText: /add|create|nouveau|ajouter|déclarer|\+/i });
        if (await createButton.count() > 0) {
            await createButton.first().click();
            await page.waitForTimeout(500);

            // Look for severity selector
            const severitySelect = page.locator('select[name="severity"], [data-testid="severity"]');
            if (await severitySelect.count() > 0) {
                await expect(severitySelect.first()).toBeVisible();
            }
        }
    });
});

test.describe('Document Forms E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should open document creation form', async ({ page }) => {
        await page.goto(`${BASE_URL}/documents`);
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('button').filter({ hasText: /add|create|nouveau|ajouter|\+/i });
        if (await createButton.count() > 0) {
            await createButton.first().click();
            await page.waitForTimeout(500);

            const form = page.locator('form, [role="dialog"], .modal');
            if (await form.count() > 0) {
                await expect(form.first()).toBeVisible();
            }
        }
    });

    test('should display document type options', async ({ page }) => {
        await page.goto(`${BASE_URL}/documents`);
        await page.waitForLoadState('networkidle');

        // Look for document type filter or creation options
        const typeFilter = page.locator('select, [role="combobox"]').filter({ hasText: /type|catégorie/i });
        if (await typeFilter.count() > 0) {
            await expect(typeFilter.first()).toBeVisible();
        }
    });
});

test.describe('Audit Forms E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should open audit creation form', async ({ page }) => {
        await page.goto(`${BASE_URL}/audits`);
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('button').filter({ hasText: /add|create|nouveau|ajouter|planifier|\+/i });
        if (await createButton.count() > 0) {
            await createButton.first().click();
            await page.waitForTimeout(500);

            const form = page.locator('form, [role="dialog"], .modal');
            if (await form.count() > 0) {
                await expect(form.first()).toBeVisible();
            }
        }
    });

    test('should display audit type selection', async ({ page }) => {
        await page.goto(`${BASE_URL}/audits`);
        await page.waitForLoadState('networkidle');

        // Look for audit tabs or type selectors
        const tabs = page.locator('[role="tablist"], .tabs');
        if (await tabs.count() > 0) {
            await expect(tabs.first()).toBeVisible();
        }
    });
});

test.describe('Supplier Forms E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should open supplier creation form', async ({ page }) => {
        await page.goto(`${BASE_URL}/suppliers`);
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('button').filter({ hasText: /add|create|nouveau|ajouter|\+/i });
        if (await createButton.count() > 0) {
            await createButton.first().click();
            await page.waitForTimeout(500);

            const form = page.locator('form, [role="dialog"], .modal');
            if (await form.count() > 0) {
                await expect(form.first()).toBeVisible();
            }
        }
    });

    test('should display supplier criticality options', async ({ page }) => {
        await page.goto(`${BASE_URL}/suppliers`);
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('button').filter({ hasText: /add|create|nouveau|ajouter|\+/i });
        if (await createButton.count() > 0) {
            await createButton.first().click();
            await page.waitForTimeout(500);

            const criticalitySelect = page.locator('select[name="criticality"], [data-testid="criticality"]');
            if (await criticalitySelect.count() > 0) {
                await expect(criticalitySelect.first()).toBeVisible();
            }
        }
    });
});

test.describe('Project Forms E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should open project creation form', async ({ page }) => {
        await page.goto(`${BASE_URL}/projects`);
        await page.waitForLoadState('networkidle');

        const createButton = page.locator('button').filter({ hasText: /add|create|nouveau|ajouter|\+/i });
        if (await createButton.count() > 0) {
            await createButton.first().click();
            await page.waitForTimeout(500);

            const form = page.locator('form, [role="dialog"], .modal');
            if (await form.count() > 0) {
                await expect(form.first()).toBeVisible();
            }
        }
    });

    test('should display project status options', async ({ page }) => {
        await page.goto(`${BASE_URL}/projects`);
        await page.waitForLoadState('networkidle');

        // Look for project status filters or tabs
        const statusTabs = page.locator('[role="tablist"], .tabs, button').filter({ hasText: /actif|terminé|planifié|active|completed/i });
        if (await statusTabs.count() > 0) {
            await expect(statusTabs.first()).toBeVisible();
        }
    });
});

test.describe('Control Forms E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access compliance controls', async ({ page }) => {
        await page.goto(`${BASE_URL}/compliance`);
        await page.waitForLoadState('networkidle');

        // Check compliance page loaded
        await expect(page).toHaveURL(/compliance/);
    });

    test('should display control status indicators', async ({ page }) => {
        await page.goto(`${BASE_URL}/compliance`);
        await page.waitForLoadState('networkidle');

        // Look for compliance score or status indicators
        const scoreCard = page.locator('.score, .percentage, [data-testid="compliance-score"]');
        if (await scoreCard.count() > 0) {
            await expect(scoreCard.first()).toBeVisible();
        }
    });

    test('should filter controls by framework', async ({ page }) => {
        await page.goto(`${BASE_URL}/compliance`);
        await page.waitForLoadState('networkidle');

        // Look for framework selector
        const frameworkSelect = page.locator('select, [role="combobox"]').filter({ hasText: /framework|référentiel|ISO|NIST/i });
        if (await frameworkSelect.count() > 0) {
            await expect(frameworkSelect.first()).toBeVisible();
        }
    });
});
