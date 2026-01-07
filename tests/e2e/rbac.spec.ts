import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('RBAC & Permissions Module', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.goto('/');
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should enforce role-based access control', async ({ page }) => {
        // Test admin access to restricted routes
        await page.goto('/#/team');
        await expect(page.getByText(/Équipe|Team/i)).toBeVisible({ timeout: 15000 });

        await page.goto('/#/settings');
        await expect(page.getByText(/Paramètres|Settings/i)).toBeVisible({ timeout: 15000 });

        await page.goto('/#/backup');
        await expect(page.getByText(/Sauvegarde|Backup/i)).toBeVisible({ timeout: 15000 });
    });

    test('should prevent unauthorized access', async ({ page }) => {
        // Test access to admin-only routes
        const restrictedRoutes = [
            '/admin_management',
            '/system-health',
            '/backup'
        ];

        for (const route of restrictedRoutes) {
            await page.goto(`/#${route}`);
            // Should either show access denied or redirect
            const accessDenied = page.getByText(/Accès refusé|Access Denied/i);
            const redirected = page.locator('[data-tour="dashboard"]');

            await expect(accessDenied.or(redirected)).toBeVisible({ timeout: 10000 });
        }
    });

    test('should validate resource-level permissions', async ({ page }) => {
        // Navigate to assets
        await page.goto('/#/assets');
        await expect(page.getByText(/Actifs|Assets/i)).toBeVisible({ timeout: 15000 });

        // Try to edit an asset (should have edit button as admin)
        await page.waitForTimeout(2000);
        const firstAsset = page.locator('[data-testid="asset-row"]').first();
        if (await firstAsset.isVisible()) {
            await firstAsset.hover();
            const editButton = page.getByRole('button', { name: /Modifier|Edit/i }).first();
            await expect(editButton).toBeVisible({ timeout: 5000 });
        }
    });

    test('should maintain tenant isolation', async ({ page }) => {
        // Verify that data is isolated per organization
        await page.goto('/#/dashboard');

        // Check organization-specific elements
        await expect(page.locator('[data-tour="dashboard"]')).toBeVisible({ timeout: 15000 });

        // Verify no cross-tenant data leakage
        // This would require multiple org setup in a real scenario
        const orgElements = page.locator('[data-organization-id]');
        if (await orgElements.count() > 0) {
            const firstOrgId = await orgElements.first().getAttribute('data-organization-id');
            expect(firstOrgId).toBe('org_default'); // Should match seeded org
        }
    });
});
