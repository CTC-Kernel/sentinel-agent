
import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('Compliance Module', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        await page.goto('/#/compliance');

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should allow uploading evidence from control inspector', async ({ page }) => {
        // 1. Wait for Compliance page
        await expect(page.getByText(/Conformité|Compliance/i).first()).toBeVisible({ timeout: 45000 });
        // Optional: Ensure loading is gone, but prioritize content
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible({ timeout: 10000 });

        // Debug: Log all network requests to verify mocks
        page.on('request', request => console.log('>>', request.method(), request.url()));
        page.on('console', msg => console.log('BROWSER MSG:', msg.type(), msg.text()));

        page.on('request', request => console.log('>>', request.method(), request.url()));

        // 2. Open a Control
        // First expand the domain. Use test-id if available or more specific text.
        // First expand the domain. Use robust test-id.
        const domainHeader = page.getByTestId('domain-header-A.5');
        await expect(domainHeader).toBeVisible();
        console.log('Domain header visible, dispatching click...');
        await domainHeader.dispatchEvent('click');

        // Wait for animation
        await page.waitForTimeout(2000);
        console.log('Clicked domain header, waiting for controls...');

        // Then click the first control row
        const firstControl = page.getByTestId(/control-row-.+/).first();
        await expect(firstControl).toBeVisible();
        await firstControl.click();

        // 3. Verify Inspector opens
        // 3. Verify Inspector opens by checking for the "Détails" tab
        await expect(page.getByRole('tab', { name: /Détails|Details/i })).toBeVisible();

        // 4. Switch to "Preuves" (Evidence) tab
        const evidenceTab = page.getByRole('tab', { name: /Preuves|Evidence/i });
        await evidenceTab.click();

        // 5. Click "Ajouter une preuve" (Upload button)
        const addEvidenceBtn = page.getByRole('button', { name: /Ajouter une preuve|Add Evidence/i });
        await addEvidenceBtn.click();

        // 6. Verify Upload Wizard opens
        await expect(page.getByText(/Assistant d'upload|Upload Wizard/i).first()).toBeVisible();

        // 7. Upload a dummy file
        // We need a dummy file. We can create one on the fly or use a known one.
        // Playwright allows buffer uploads or file paths.
        await page.setInputFiles('input[type="file"]', {
            name: 'test-evidence.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('This is a test evidence file.')
        });

        // 8. Submit (if there is a Next/Submit flow)
        // Usually wizards have "Suivant" or "Terminer".
        // Let's assume we need to click "Importer" or similar.
        const submitBtn = page.getByRole('button', { name: /Importer|Import/i }).first();
        if (await submitBtn.isVisible()) {
            await submitBtn.click();
        }

        // 9. Assert Success Toast
        await expect(page.getByText(/Succès|Success/i)).toBeVisible();
    });
});
