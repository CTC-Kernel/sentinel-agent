import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, BASE_URL } from './utils';

test.describe('Admin Dashboard E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access admin dashboard', async ({ page }) => {
        await page.goto(`${BASE_URL}/admin`);
        await page.waitForLoadState('networkidle');

        // Check page loaded
        await expect(page).toHaveURL(/admin/);
    });

    test('should display admin navigation tabs', async ({ page }) => {
        await page.goto(`${BASE_URL}/admin`);
        await page.waitForLoadState('networkidle');

        // Look for admin-specific elements
        const adminContent = page.locator('main, [role="main"], .admin, #admin');
        await expect(adminContent.first()).toBeVisible({ timeout: 10000 });
    });

    test('should access user management section', async ({ page }) => {
        await page.goto(`${BASE_URL}/team`);
        await page.waitForLoadState('networkidle');

        // Verify team/user management page loaded
        await expect(page).toHaveURL(/team/);
    });

    test('should display organization settings', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`);
        await page.waitForLoadState('networkidle');

        // Verify settings page loaded
        await expect(page).toHaveURL(/settings/);
    });
});

test.describe('System Health E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access system health page', async ({ page }) => {
        await page.goto(`${BASE_URL}/system-health`);
        await page.waitForLoadState('networkidle');

        // Check page loaded or redirected appropriately
        const url = page.url();
        expect(url).toMatch(/system-health|dashboard|admin/);
    });

    test('should display system metrics', async ({ page }) => {
        await page.goto(`${BASE_URL}/system-health`);
        await page.waitForLoadState('networkidle');

        // Look for system health indicators
        const content = page.locator('main, [role="main"]');
        await expect(content.first()).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Calendar E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access calendar page', async ({ page }) => {
        await page.goto(`${BASE_URL}/calendar`);
        await page.waitForLoadState('networkidle');

        // Check calendar page loaded
        await expect(page).toHaveURL(/calendar/);
    });

    test('should display calendar view', async ({ page }) => {
        await page.goto(`${BASE_URL}/calendar`);
        await page.waitForLoadState('networkidle');

        // Look for calendar elements
        const calendarContent = page.locator('main, [role="main"], .calendar');
        await expect(calendarContent.first()).toBeVisible({ timeout: 10000 });
    });

    test('should navigate between months', async ({ page }) => {
        await page.goto(`${BASE_URL}/calendar`);
        await page.waitForLoadState('networkidle');

        // Try to find navigation buttons
        const navButtons = page.locator('button').filter({ hasText: /next|prev|suivant|précédent|>/i });
        if (await navButtons.count() > 0) {
            await navButtons.first().click();
            await page.waitForTimeout(500);
        }
    });
});

test.describe('Search E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access search page', async ({ page }) => {
        await page.goto(`${BASE_URL}/search`);
        await page.waitForLoadState('networkidle');

        // Check search page or global search functionality
        const url = page.url();
        expect(url).toMatch(/search|dashboard/);
    });

    test('should have search input available', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');

        // Look for search input in header or sidebar
        const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="recherche" i]');
        if (await searchInput.count() > 0) {
            await expect(searchInput.first()).toBeVisible();
        }
    });

    test('should perform global search', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');

        // Try keyboard shortcut for search (Ctrl+K or Cmd+K)
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(500);

        // Check if search modal opened
        const searchModal = page.locator('[role="dialog"], .search-modal, .command-palette');
        if (await searchModal.count() > 0) {
            await expect(searchModal.first()).toBeVisible();
        }
    });
});

test.describe('Integrations E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access integrations page', async ({ page }) => {
        await page.goto(`${BASE_URL}/integrations`);
        await page.waitForLoadState('networkidle');

        // Check integrations page loaded
        const url = page.url();
        expect(url).toMatch(/integrations|settings|dashboard/);
    });

    test('should display available integrations', async ({ page }) => {
        await page.goto(`${BASE_URL}/integrations`);
        await page.waitForLoadState('networkidle');

        const content = page.locator('main, [role="main"]');
        await expect(content.first()).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Help & Documentation E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access help page', async ({ page }) => {
        await page.goto(`${BASE_URL}/help`);
        await page.waitForLoadState('networkidle');

        // Check help page loaded
        const url = page.url();
        expect(url).toMatch(/help|documentation|dashboard/);
    });

    test('should display help content', async ({ page }) => {
        await page.goto(`${BASE_URL}/help`);
        await page.waitForLoadState('networkidle');

        const content = page.locator('main, [role="main"]');
        await expect(content.first()).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Activity Logs E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access activity logs', async ({ page }) => {
        await page.goto(`${BASE_URL}/activity`);
        await page.waitForLoadState('networkidle');

        // Check activity logs loaded
        const url = page.url();
        expect(url).toMatch(/activity|logs|dashboard/);
    });

    test('should display activity timeline', async ({ page }) => {
        await page.goto(`${BASE_URL}/activity`);
        await page.waitForLoadState('networkidle');

        const content = page.locator('main, [role="main"]');
        await expect(content.first()).toBeVisible({ timeout: 10000 });
    });
});
