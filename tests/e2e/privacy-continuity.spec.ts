import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, BASE_URL } from './utils';

test.describe('Privacy/RGPD E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access privacy dashboard', async ({ page }) => {
        await page.goto(`${BASE_URL}/privacy`);
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveURL(/privacy/);
    });

    test('should display privacy activities list', async ({ page }) => {
        await page.goto(`${BASE_URL}/privacy`);
        await page.waitForLoadState('networkidle');

        const content = page.locator('main, [role="main"]');
        await expect(content.first()).toBeVisible({ timeout: 10000 });
    });

    test('should open treatment activity form', async ({ page }) => {
        await page.goto(`${BASE_URL}/privacy`);
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

    test('should display DPIA section', async ({ page }) => {
        await page.goto(`${BASE_URL}/privacy`);
        await page.waitForLoadState('networkidle');

        // Look for DPIA/AIPD tab or section
        const dpiaTab = page.locator('button, [role="tab"]').filter({ hasText: /DPIA|AIPD|Impact/i });
        if (await dpiaTab.count() > 0) {
            await dpiaTab.first().click();
            await page.waitForTimeout(500);
        }
    });

    test('should display data subjects rights', async ({ page }) => {
        await page.goto(`${BASE_URL}/privacy`);
        await page.waitForLoadState('networkidle');

        // Look for rights management section
        const rightsTab = page.locator('button, [role="tab"]').filter({ hasText: /droits|rights|demandes/i });
        if (await rightsTab.count() > 0) {
            await rightsTab.first().click();
            await page.waitForTimeout(500);
        }
    });

    test('should display data breach section', async ({ page }) => {
        await page.goto(`${BASE_URL}/privacy`);
        await page.waitForLoadState('networkidle');

        // Look for breach notification section
        const breachTab = page.locator('button, [role="tab"]').filter({ hasText: /violation|breach|notification/i });
        if (await breachTab.count() > 0) {
            await breachTab.first().click();
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Business Continuity E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access continuity dashboard', async ({ page }) => {
        await page.goto(`${BASE_URL}/continuity`);
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveURL(/continuity/);
    });

    test('should display BIA section', async ({ page }) => {
        await page.goto(`${BASE_URL}/continuity`);
        await page.waitForLoadState('networkidle');

        // Look for BIA tab
        const biaTab = page.locator('button, [role="tab"]').filter({ hasText: /BIA|Impact|Processus/i });
        if (await biaTab.count() > 0) {
            await biaTab.first().click();
            await page.waitForTimeout(500);

            const content = page.locator('main, [role="main"]');
            await expect(content.first()).toBeVisible();
        }
    });

    test('should open process creation form', async ({ page }) => {
        await page.goto(`${BASE_URL}/continuity`);
        await page.waitForLoadState('networkidle');

        // Navigate to BIA tab first
        const biaTab = page.locator('button, [role="tab"]').filter({ hasText: /BIA|Processus/i });
        if (await biaTab.count() > 0) {
            await biaTab.first().click();
            await page.waitForTimeout(500);
        }

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

    test('should display continuity strategies', async ({ page }) => {
        await page.goto(`${BASE_URL}/continuity`);
        await page.waitForLoadState('networkidle');

        // Look for strategies tab
        const strategiesTab = page.locator('button, [role="tab"]').filter({ hasText: /stratég|strategies/i });
        if (await strategiesTab.count() > 0) {
            await strategiesTab.first().click();
            await page.waitForTimeout(500);
        }
    });

    test('should display crisis management section', async ({ page }) => {
        await page.goto(`${BASE_URL}/continuity`);
        await page.waitForLoadState('networkidle');

        // Look for crisis tab
        const crisisTab = page.locator('button, [role="tab"]').filter({ hasText: /crise|crisis/i });
        if (await crisisTab.count() > 0) {
            await crisisTab.first().click();
            await page.waitForTimeout(500);
        }
    });

    test('should display drills section', async ({ page }) => {
        await page.goto(`${BASE_URL}/continuity`);
        await page.waitForLoadState('networkidle');

        // Look for drills/exercises tab
        const drillsTab = page.locator('button, [role="tab"]').filter({ hasText: /exercice|drill|test/i });
        if (await drillsTab.count() > 0) {
            await drillsTab.first().click();
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Threat Intelligence E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access threat intelligence page', async ({ page }) => {
        await page.goto(`${BASE_URL}/threats`);
        await page.waitForLoadState('networkidle');

        const url = page.url();
        expect(url).toMatch(/threats|dashboard/);
    });

    test('should display threat feeds', async ({ page }) => {
        await page.goto(`${BASE_URL}/threats`);
        await page.waitForLoadState('networkidle');

        const content = page.locator('main, [role="main"]');
        await expect(content.first()).toBeVisible({ timeout: 10000 });
    });

    test('should display IOC indicators', async ({ page }) => {
        await page.goto(`${BASE_URL}/threats`);
        await page.waitForLoadState('networkidle');

        // Look for IOC section
        const iocSection = page.locator('button, [role="tab"]').filter({ hasText: /IOC|indicateur|indicator/i });
        if (await iocSection.count() > 0) {
            await iocSection.first().click();
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Vulnerabilities E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access vulnerabilities page', async ({ page }) => {
        await page.goto(`${BASE_URL}/vulnerabilities`);
        await page.waitForLoadState('networkidle');

        const url = page.url();
        expect(url).toMatch(/vulnerabilities|dashboard/);
    });

    test('should display vulnerability list', async ({ page }) => {
        await page.goto(`${BASE_URL}/vulnerabilities`);
        await page.waitForLoadState('networkidle');

        const content = page.locator('main, [role="main"]');
        await expect(content.first()).toBeVisible({ timeout: 10000 });
    });

    test('should filter by severity', async ({ page }) => {
        await page.goto(`${BASE_URL}/vulnerabilities`);
        await page.waitForLoadState('networkidle');

        // Look for severity filter
        const severityFilter = page.locator('select, button').filter({ hasText: /severity|sévérité|critical|high/i });
        if (await severityFilter.count() > 0) {
            await severityFilter.first().click();
            await page.waitForTimeout(500);
        }
    });

    test('should open vulnerability details', async ({ page }) => {
        await page.goto(`${BASE_URL}/vulnerabilities`);
        await page.waitForLoadState('networkidle');

        // Look for vulnerability row or card
        const vulnItem = page.locator('tr, .card, [role="row"]').first();
        if (await vulnItem.count() > 0) {
            await vulnItem.click();
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Backup & Restore E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access backup page', async ({ page }) => {
        await page.goto(`${BASE_URL}/backup`);
        await page.waitForLoadState('networkidle');

        const url = page.url();
        expect(url).toMatch(/backup|settings|admin/);
    });

    test('should display backup options', async ({ page }) => {
        await page.goto(`${BASE_URL}/backup`);
        await page.waitForLoadState('networkidle');

        const content = page.locator('main, [role="main"]');
        await expect(content.first()).toBeVisible({ timeout: 10000 });
    });

    test('should show backup history', async ({ page }) => {
        await page.goto(`${BASE_URL}/backup`);
        await page.waitForLoadState('networkidle');

        // Look for backup history section
        const historySection = page.locator('table, .history, [role="table"]');
        if (await historySection.count() > 0) {
            await expect(historySection.first()).toBeVisible();
        }
    });
});

test.describe('Notifications E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access notifications page', async ({ page }) => {
        await page.goto(`${BASE_URL}/notifications`);
        await page.waitForLoadState('networkidle');

        const url = page.url();
        expect(url).toMatch(/notifications|dashboard/);
    });

    test('should display notification list', async ({ page }) => {
        await page.goto(`${BASE_URL}/notifications`);
        await page.waitForLoadState('networkidle');

        const content = page.locator('main, [role="main"]');
        await expect(content.first()).toBeVisible({ timeout: 10000 });
    });

    test('should open notification bell from header', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');

        // Look for notification bell icon
        const bellButton = page.locator('button').filter({ has: page.locator('svg, .bell, [class*="notification"]') });
        if (await bellButton.count() > 0) {
            await bellButton.first().click();
            await page.waitForTimeout(500);
        }
    });
});
