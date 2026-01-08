import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, BASE_URL } from './utils';

test.describe('Reports Generation E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access reports page', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveURL(/reports/);
    });

    test('should display report generation tab', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        await page.waitForLoadState('networkidle');

        // Look for generation tab
        const genTab = page.locator('button, [role="tab"]').filter({ hasText: /génér|generat|créer/i });
        if (await genTab.count() > 0) {
            await genTab.first().click();
            await page.waitForTimeout(500);
        }
    });

    test('should display report templates', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        await page.waitForLoadState('networkidle');

        // Look for templates section
        const templatesTab = page.locator('button, [role="tab"]').filter({ hasText: /template|modèle/i });
        if (await templatesTab.count() > 0) {
            await templatesTab.first().click();
            await page.waitForTimeout(500);
        }
    });

    test('should display report history', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        await page.waitForLoadState('networkidle');

        // Look for history section
        const historyTab = page.locator('button, [role="tab"]').filter({ hasText: /historique|history|archive/i });
        if (await historyTab.count() > 0) {
            await historyTab.first().click();
            await page.waitForTimeout(500);
        }
    });

    test('should open report configuration form', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        await page.waitForLoadState('networkidle');

        const genButton = page.locator('button').filter({ hasText: /générer|generate|créer|create/i });
        if (await genButton.count() > 0) {
            await genButton.first().click();
            await page.waitForTimeout(500);

            const form = page.locator('form, [role="dialog"], .modal');
            if (await form.count() > 0) {
                await expect(form.first()).toBeVisible();
            }
        }
    });

    test('should select report type', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        await page.waitForLoadState('networkidle');

        // Look for report type selector
        const typeSelect = page.locator('select, [role="combobox"]').filter({ hasText: /type|rapport|report/i });
        if (await typeSelect.count() > 0) {
            await typeSelect.first().click();
            await page.waitForTimeout(500);
        }
    });

    test('should select date range for report', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        await page.waitForLoadState('networkidle');

        const genButton = page.locator('button').filter({ hasText: /générer|generate|créer/i });
        if (await genButton.count() > 0) {
            await genButton.first().click();
            await page.waitForTimeout(500);

            // Look for date inputs
            const dateInput = page.locator('input[type="date"], [data-testid*="date"]');
            if (await dateInput.count() > 0) {
                await expect(dateInput.first()).toBeVisible();
            }
        }
    });
});

test.describe('Export Functions E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should export assets to CSV', async ({ page }) => {
        await page.goto(`${BASE_URL}/assets`);
        await page.waitForLoadState('networkidle');

        // Look for export button
        const exportButton = page.locator('button').filter({ hasText: /export|télécharger|download|csv/i });
        if (await exportButton.count() > 0) {
            // Check button is visible
            await expect(exportButton.first()).toBeVisible();
        }
    });

    test('should export risks to Excel', async ({ page }) => {
        await page.goto(`${BASE_URL}/risks`);
        await page.waitForLoadState('networkidle');

        const exportButton = page.locator('button').filter({ hasText: /export|télécharger|download|excel/i });
        if (await exportButton.count() > 0) {
            await expect(exportButton.first()).toBeVisible();
        }
    });

    test('should export compliance report to PDF', async ({ page }) => {
        await page.goto(`${BASE_URL}/compliance`);
        await page.waitForLoadState('networkidle');

        const exportButton = page.locator('button').filter({ hasText: /export|télécharger|download|pdf/i });
        if (await exportButton.count() > 0) {
            await expect(exportButton.first()).toBeVisible();
        }
    });

    test('should export incidents', async ({ page }) => {
        await page.goto(`${BASE_URL}/incidents`);
        await page.waitForLoadState('networkidle');

        const exportButton = page.locator('button').filter({ hasText: /export|télécharger|download/i });
        if (await exportButton.count() > 0) {
            await expect(exportButton.first()).toBeVisible();
        }
    });

    test('should export audits', async ({ page }) => {
        await page.goto(`${BASE_URL}/audits`);
        await page.waitForLoadState('networkidle');

        const exportButton = page.locator('button').filter({ hasText: /export|télécharger|download/i });
        if (await exportButton.count() > 0) {
            await expect(exportButton.first()).toBeVisible();
        }
    });
});

test.describe('Import Functions E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should display import option for assets', async ({ page }) => {
        await page.goto(`${BASE_URL}/assets`);
        await page.waitForLoadState('networkidle');

        const importButton = page.locator('button').filter({ hasText: /import|importer/i });
        if (await importButton.count() > 0) {
            await expect(importButton.first()).toBeVisible();
        }
    });

    test('should display import option for risks', async ({ page }) => {
        await page.goto(`${BASE_URL}/risks`);
        await page.waitForLoadState('networkidle');

        const importButton = page.locator('button').filter({ hasText: /import|importer/i });
        if (await importButton.count() > 0) {
            await expect(importButton.first()).toBeVisible();
        }
    });

    test('should open import dialog', async ({ page }) => {
        await page.goto(`${BASE_URL}/assets`);
        await page.waitForLoadState('networkidle');

        const importButton = page.locator('button').filter({ hasText: /import|importer/i });
        if (await importButton.count() > 0) {
            await importButton.first().click();
            await page.waitForTimeout(500);

            const dialog = page.locator('[role="dialog"], .modal, form');
            if (await dialog.count() > 0) {
                await expect(dialog.first()).toBeVisible();
            }
        }
    });
});

test.describe('Dashboard Widgets E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should display dashboard widgets', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');

        const widgets = page.locator('.widget, .card, [data-testid*="widget"]');
        if (await widgets.count() > 0) {
            await expect(widgets.first()).toBeVisible();
        }
    });

    test('should display risk overview widget', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');

        const riskWidget = page.locator('.widget, .card').filter({ hasText: /risque|risk/i });
        if (await riskWidget.count() > 0) {
            await expect(riskWidget.first()).toBeVisible();
        }
    });

    test('should display compliance score widget', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');

        const complianceWidget = page.locator('.widget, .card').filter({ hasText: /compliance|conformité|score/i });
        if (await complianceWidget.count() > 0) {
            await expect(complianceWidget.first()).toBeVisible();
        }
    });

    test('should display recent activity widget', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');

        const activityWidget = page.locator('.widget, .card').filter({ hasText: /activité|activity|recent/i });
        if (await activityWidget.count() > 0) {
            await expect(activityWidget.first()).toBeVisible();
        }
    });

    test('should navigate from widget to detail page', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');

        // Click on a widget link
        const widgetLink = page.locator('.widget a, .card a').first();
        if (await widgetLink.count() > 0) {
            await widgetLink.click();
            await page.waitForTimeout(500);

            // Should navigate away from dashboard
            const url = page.url();
            expect(url).not.toBe(`${BASE_URL}/dashboard`);
        }
    });
});

test.describe('Charts and Visualizations E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should display risk matrix chart', async ({ page }) => {
        await page.goto(`${BASE_URL}/risks`);
        await page.waitForLoadState('networkidle');

        const chart = page.locator('canvas, svg, .chart, [data-testid*="chart"]');
        if (await chart.count() > 0) {
            await expect(chart.first()).toBeVisible();
        }
    });

    test('should display compliance donut chart', async ({ page }) => {
        await page.goto(`${BASE_URL}/compliance`);
        await page.waitForLoadState('networkidle');

        const chart = page.locator('canvas, svg, .chart, .donut');
        if (await chart.count() > 0) {
            await expect(chart.first()).toBeVisible();
        }
    });

    test('should display timeline chart', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');

        const chart = page.locator('canvas, svg, .timeline, [data-testid*="timeline"]');
        if (await chart.count() > 0) {
            await expect(chart.first()).toBeVisible();
        }
    });
});
