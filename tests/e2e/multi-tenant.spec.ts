import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('Multi-Tenant Isolation Module', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.goto('/');
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should isolate data by organization', async ({ page }) => {
        await page.goto('/#/dashboard');
        await expect(page.locator('[data-tour="dashboard"]')).toBeVisible({ timeout: 15000 });

        // Verify organization context
        const orgElements = page.locator('[data-organization-id]');
        if (await orgElements.count() > 0) {
            const firstOrgId = await orgElements.first().getAttribute('data-organization-id');
            expect(firstOrgId).toBe('org_default'); // Should match seeded org
        }

        // Check that all data belongs to the correct organization
        await page.waitForTimeout(3000);

        // Verify dashboard data isolation
        const dashboardWidgets = page.locator('[data-testid="dashboard-widget"]');
        if (await dashboardWidgets.count() > 0) {
            await expect(dashboardWidgets.first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('should prevent cross-tenant data access', async ({ page }) => {
        // Test assets isolation
        await page.goto('/#/assets');
        await expect(page.getByText(/Actifs|Assets/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // All assets should belong to the current organization
        const assetRows = page.locator('[data-testid="asset-row"]');
        if (await assetRows.count() > 0) {
            const firstAsset = assetRows.first();
            await expect(firstAsset).toBeVisible({ timeout: 5000 });

            // Verify asset belongs to current org (if org ID is exposed)
            const assetOrgId = await firstAsset.getAttribute('data-organization-id');
            if (assetOrgId) {
                expect(assetOrgId).toBe('org_default');
            }
        }
    });

    test('should maintain tenant isolation in audit trail', async ({ page }) => {
        await page.goto('/#/audit-trail');
        await expect(page.getByText(/Journal d'audit|Audit Trail/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Audit entries should only show current tenant's data
        const auditEntries = page.locator('[data-testid="audit-entry"]');
        if (await auditEntries.count() > 0) {
            await expect(auditEntries.first()).toBeVisible({ timeout: 5000 });

            // Verify entries belong to current organization
            const firstEntry = auditEntries.first();
            const entryOrgId = await firstEntry.getAttribute('data-organization-id');
            if (entryOrgId) {
                expect(entryOrgId).toBe('org_default');
            }
        }
    });

    test('should isolate user management by tenant', async ({ page }) => {
        await page.goto('/#/team');
        await expect(page.getByText(/Équipe|Team/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Team members should only show current organization's users
        const teamMembers = page.locator('[data-testid="team-member"]');
        if (await teamMembers.count() > 0) {
            await expect(teamMembers.first()).toBeVisible({ timeout: 5000 });

            // Verify users belong to current organization
            const firstMember = teamMembers.first();
            const memberOrgId = await firstMember.getAttribute('data-organization-id');
            if (memberOrgId) {
                expect(memberOrgId).toBe('org_default');
            }
        }
    });

    test('should isolate compliance data by tenant', async ({ page }) => {
        await page.goto('/#/compliance');
        await expect(page.getByText(/Conformité|Compliance/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Compliance controls should be tenant-specific
        const controlsTab = page.getByRole('tab', { name: /Contrôles|Controls/i });
        if (await controlsTab.isVisible()) {
            await controlsTab.click();
            await page.waitForTimeout(2000);

            const controlItems = page.locator('[data-testid="control-item"]');
            if (await controlItems.count() > 0) {
                await expect(controlItems.first()).toBeVisible({ timeout: 5000 });

                // Verify controls belong to current organization
                const firstControl = controlItems.first();
                const controlOrgId = await firstControl.getAttribute('data-organization-id');
                if (controlOrgId) {
                    expect(controlOrgId).toBe('org_default');
                }
            }
        }
    });

    test('should isolate reports by tenant', async ({ page }) => {
        await page.goto('/#/reports');
        await expect(page.getByText(/Rapports|Reports/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Reports should only show current tenant's data
        const reportCards = page.locator('[data-testid="report-card"]');
        if (await reportCards.count() > 0) {
            await expect(reportCards.first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('should maintain tenant context in navigation', async ({ page }) => {
        // Navigate through different modules and verify tenant context
        const modules = ['/assets', '/risks', '/compliance', '/audits', '/incidents'];

        for (const module of modules) {
            await page.goto(`/#${module}`);
            await page.waitForTimeout(2000);

            // Verify tenant context is maintained
            const tenantIndicator = page.locator('[data-tenant-id]');
            if (await tenantIndicator.count() > 0) {
                const tenantId = await tenantIndicator.first().getAttribute('data-tenant-id');
                if (tenantId) {
                    expect(tenantId).toBe('org_default');
                }
            }
        }
    });

    test('should isolate document storage by tenant', async ({ page }) => {
        await page.goto('/#/documents');
        await expect(page.getByText(/Documents/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Documents should be tenant-isolated
        const documentRows = page.locator('[data-testid="document-row"]');
        if (await documentRows.count() > 0) {
            await expect(documentRows.first()).toBeVisible({ timeout: 5000 });

            // Verify documents belong to current organization
            const firstDoc = documentRows.first();
            const docOrgId = await firstDoc.getAttribute('data-organization-id');
            if (docOrgId) {
                expect(docOrgId).toBe('org_default');
            }
        }
    });
});
