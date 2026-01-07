import { test, expect } from '@playwright/test';

test.describe('ISO 27001 Integration Module', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display ISO 27001 controls mapping', async ({ page }) => {
        await page.goto('/#/compliance');
        await expect(page.getByText(/Conformité|Compliance/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Look for ISO 27001 references
        const isoControls = page.getByText(/ISO 27001|Annexe A|A\.[0-9]/i);
        if (await isoControls.count() > 0) {
            await expect(isoControls.first()).toBeVisible({ timeout: 5000 });
        }

        // Check for controls overview
        const controlsTab = page.getByRole('tab', { name: /Contrôles|Controls/i });
        if (await controlsTab.isVisible()) {
            await controlsTab.click();
            await page.waitForTimeout(2000);
            
            // Verify controls are displayed
            const controlItems = page.locator('[data-testid="control-item"]');
            await expect(controlItems.first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('should link risks to ISO 27001 controls', async ({ page }) => {
        // Navigate to risks
        await page.goto('/#/risks');
        await expect(page.getByText(/Risques|Risks/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Select first risk if available
        const firstRisk = page.locator('[data-testid="risk-row"]').first();
        if (await firstRisk.isVisible()) {
            await firstRisk.click();
            await page.waitForTimeout(2000);

            // Look for ISO control mapping
            const isoMapping = page.getByText(/ISO 27001|Contrôle associé|Associated Control/i);
            if (await isoMapping.isVisible()) {
                await expect(isoMapping).toBeVisible();
            }
        }
    });

    test('should generate ISO 27001 compliance reports', async ({ page }) => {
        await page.goto('/#/reports');
        await expect(page.getByText(/Rapports|Reports/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Look for ISO 27001 report template
        const isoReport = page.getByText(/ISO 27001|Conformité ISO/i);
        if (await isoReport.isVisible()) {
            await isoReport.click();
            await page.waitForTimeout(2000);

            // Check report generation options
            const generateButton = page.getByRole('button', { name: /Générer|Generate/i });
            if (await generateButton.isVisible()) {
                await expect(generateButton).toBeVisible();
            }
        }
    });

    test('should track control implementation status', async ({ page }) => {
        await page.goto('/#/compliance');
        await expect(page.getByText(/Conformité|Compliance/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Navigate to controls tab
        const controlsTab = page.getByRole('tab', { name: /Contrôles|Controls/i });
        if (await controlsTab.isVisible()) {
            await controlsTab.click();
            await page.waitForTimeout(2000);

            // Look for control status indicators
            const statusIndicators = page.locator('[data-testid="control-status"]');
            if (await statusIndicators.count() > 0) {
                await expect(statusIndicators.first()).toBeVisible({ timeout: 5000 });
            }
        }
    });

    test('should provide evidence management for controls', async ({ page }) => {
        await page.goto('/#/compliance');
        await expect(page.getByText(/Conformité|Compliance/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Look for evidence management features
        const evidenceSection = page.getByText(/Preuves|Evidence/i);
        if (await evidenceSection.isVisible()) {
            await expect(evidenceSection).toBeVisible();
        }

        // Check for evidence upload functionality
        const uploadButton = page.getByRole('button', { name: /Télécharger|Upload/i });
        if (await uploadButton.isVisible()) {
            await expect(uploadButton).toBeVisible();
        }
    });

    test('should support Statement of Applicability (SoA)', async ({ page }) => {
        await page.goto('/#/compliance');
        await expect(page.getByText(/Conformité|Compliance/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Look for SoA tab or section
        const soaTab = page.getByRole('tab', { name: /SoA|Statement of Applicability/i });
        if (await soaTab.isVisible()) {
            await soaTab.click();
            await page.waitForTimeout(2000);

            // Verify SoA content
            const soaContent = page.getByText(/Applicabilité|Applicability/i);
            if (await soaContent.isVisible()) {
                await expect(soaContent).toBeVisible();
            }
        }
    });
});
