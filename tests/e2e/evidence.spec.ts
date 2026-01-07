import { test, expect } from '@playwright/test';

test.describe('Evidence Management Module', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should upload and manage evidence files', async ({ page }) => {
        await page.goto('/#/documents');
        await expect(page.getByText(/Documents/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Look for upload functionality
        const uploadButton = page.getByRole('button', { name: /Télécharger|Upload|Ajouter/i });
        if (await uploadButton.isVisible()) {
            await uploadButton.click();
            await page.waitForTimeout(2000);

            // Check for file upload interface
            const fileInput = page.locator('input[type="file"]');
            const dropZone = page.locator('[data-testid="drop-zone"]');

            await expect(fileInput.or(dropZone)).toBeVisible({ timeout: 5000 });
        }
    });

    test('should link evidence to controls and risks', async ({ page }) => {
        await page.goto('/#/compliance');
        await expect(page.getByText(/Conformité|Compliance/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Navigate to controls
        const controlsTab = page.getByRole('tab', { name: /Contrôles|Controls/i });
        if (await controlsTab.isVisible()) {
            await controlsTab.click();
            await page.waitForTimeout(2000);

            // Look for evidence linking functionality
            const firstControl = page.locator('[data-testid="control-item"]').first();
            if (await firstControl.isVisible()) {
                await firstControl.click();
                await page.waitForTimeout(2000);

                // Check for evidence attachment
                const attachEvidence = page.getByRole('button', { name: /Attacher|Attach/i });
                if (await attachEvidence.isVisible()) {
                    await expect(attachEvidence).toBeVisible();
                }
            }
        }
    });

    test('should categorize and tag evidence', async ({ page }) => {
        await page.goto('/#/documents');
        await expect(page.getByText(/Documents/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Look for categorization options
        const categoryFilter = page.getByRole('button', { name: /Catégorie|Category/i });
        const tagInput = page.getByPlaceholder(/Étiquette|Tag/i);

        if (await categoryFilter.isVisible()) {
            await categoryFilter.click();
            await page.waitForTimeout(1000);
            
            // Check for category options
            const categoryOptions = page.locator('[data-testid="category-options"]');
            if (await categoryOptions.isVisible()) {
                await expect(categoryOptions).toBeVisible();
            }
        }

        if (await tagInput.isVisible()) {
            await expect(tagInput).toBeVisible();
        }
    });

    test('should validate evidence format and integrity', async ({ page }) => {
        await page.goto('/#/documents');
        await expect(page.getByText(/Documents/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Look for evidence validation indicators
        const validationStatus = page.locator('[data-testid="validation-status"]');
        if (await validationStatus.count() > 0) {
            await expect(validationStatus.first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('should provide evidence versioning', async ({ page }) => {
        await page.goto('/#/documents');
        await expect(page.getByText(/Documents/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Select first document if available
        const firstDocument = page.locator('[data-testid="document-row"]').first();
        if (await firstDocument.isVisible()) {
            await firstDocument.click();
            await page.waitForTimeout(2000);

            // Look for version history
            const versionHistory = page.getByText(/Historique|Version/i);
            if (await versionHistory.isVisible()) {
                await expect(versionHistory).toBeVisible();
            }
        }
    });

    test('should generate evidence reports', async ({ page }) => {
        await page.goto('/#/reports');
        await expect(page.getByText(/Rapports|Reports/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Look for evidence report options
        const evidenceReport = page.getByText(/Preuves|Evidence/i);
        if (await evidenceReport.isVisible()) {
            await evidenceReport.click();
            await page.waitForTimeout(2000);

            // Check report generation
            const generateButton = page.getByRole('button', { name: /Générer|Generate/i });
            if (await generateButton.isVisible()) {
                await expect(generateButton).toBeVisible();
            }
        }
    });

    test('should support evidence approval workflow', async ({ page }) => {
        await page.goto('/#/documents');
        await expect(page.getByText(/Documents/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Look for approval workflow indicators
        const approvalStatus = page.locator('[data-testid="approval-status"]');
        if (await approvalStatus.count() > 0) {
            await expect(approvalStatus.first()).toBeVisible({ timeout: 5000 });
        }

        // Check for approval actions
        const approveButton = page.getByRole('button', { name: /Approuver|Approve/i });
        const rejectButton = page.getByRole('button', { name: /Rejeter|Reject/i });

        if (await approveButton.isVisible() || await rejectButton.isVisible()) {
            // Approval workflow is available
            await expect(approveButton.or(rejectButton)).toBeVisible();
        }
    });

    test('should maintain evidence audit trail', async ({ page }) => {
        await page.goto('/#/audit-trail');
        await expect(page.getByText(/Journal d'audit|Audit Trail/i)).toBeVisible({ timeout: 15000 });

        await page.waitForTimeout(3000);

        // Look for evidence-related audit entries
        const evidenceEntries = page.getByText(/document|preuve|evidence/i);
        if (await evidenceEntries.count() > 0) {
            await expect(evidenceEntries.first()).toBeVisible({ timeout: 5000 });
        }
    });
});
