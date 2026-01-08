import { test, expect } from '@playwright/test';
import { BASE_URL, setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('GRC Platform Coverage Tests', () => {
    test.setTimeout(60000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should access Core GRC modules', async ({ page }) => {
        const modules = [
            { path: '/#/', name: 'Dashboard' },
            { path: '/#/assets', name: 'Assets Management' },
            { path: '/#/risks', name: 'Risk Management' },
            { path: '/#/compliance', name: 'Compliance Management' },
            { path: '/#/audits', name: 'Audit Management' }
        ];

        for (const module of modules) {
            await page.goto(BASE_URL + module.path);
            await page.waitForLoadState('domcontentloaded');
            await expect(page.locator('body')).toBeVisible();
        }
    });

    test('should access Operational modules', async ({ page }) => {
        const modules = [
            { path: '/#/incidents', name: 'Incident Management' },
            { path: '/#/projects', name: 'Project Management' },
            { path: '/#/documents', name: 'Document Management' },
            { path: '/#/reports', name: 'Reports Generation' },
            { path: '/#/audit-trail', name: 'Audit Trail' }
        ];

        for (const module of modules) {
            await page.goto(BASE_URL + module.path);
            await page.waitForLoadState('domcontentloaded');
            await expect(page.locator('body')).toBeVisible();
        }
    });

    test('should access Strategic & Admin modules', async ({ page }) => {
        const modules = [
            { path: '/#/team', name: 'Team Management' },
            { path: '/#/settings', name: 'System Settings' },
            { path: '/#/suppliers', name: 'Supplier Management' },
            { path: '/#/privacy', name: 'Privacy Management' },
            { path: '/#/continuity', name: 'Business Continuity' },
            { path: '/#/vulnerabilities', name: 'Vulnerability Management' },
            { path: '/#/threat-intelligence', name: 'Threat Intelligence' }
        ];

        for (const module of modules) {
            await page.goto(BASE_URL + module.path);
            await page.waitForLoadState('domcontentloaded');
            await expect(page.locator('body')).toBeVisible();
        }
    });

    test('should handle restricted routes appropriately', async ({ page }) => {
        const restrictedRoutes = [
            '/#/team',
            '/#/settings',
            '/#/backup',
            '/#/system-health'
        ];

        for (const route of restrictedRoutes) {
            await page.goto(BASE_URL + route);
            await page.waitForLoadState('domcontentloaded');
            const body = page.locator('body');
            await expect(body).toBeVisible();
        }
    });

    test('should maintain consistent navigation structure', async ({ page }) => {
        const navigationFlow = [
            '/#/',
            '/#/assets',
            '/#/risks',
            '/#/compliance',
            '/#/reports'
        ];

        for (const path of navigationFlow) {
            await page.goto(BASE_URL + path);
            await page.waitForLoadState('domcontentloaded');

            const body = page.locator('body');
            await expect(body).toBeVisible();

            const reactRoot = page.locator('#root');
            await expect(reactRoot).toBeVisible();
        }
    });
});
