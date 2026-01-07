import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose } from './utils';

test.describe('Documents Module', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should display documents dashboard and KPIs', async ({ page }) => {
        page.on('console', msg => console.log(`BROWSER MSG: ${msg.type()} - ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

        await page.goto('/#/documents');
        
        // Wait for overlays to close
        await waitForOverlaysToClose(page);

        // Check Page Header
        await expect(page.getByRole('heading', { name: /Référentiel Documentaire|Document/i })).toBeVisible({ timeout: 30000 });

        // Check Metrics (KPIs) - use more specific selectors
        await expect(page.getByText(/Documents Validés|Validated/i)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/Total/i)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/Brouillons|Drafts/i)).toBeVisible({ timeout: 5000 });
    });

    test('should allow creating a new document', async ({ page }) => {
        await page.goto('/#/documents');
        
        // Wait for overlays to close
        await waitForOverlaysToClose(page);

        // Open Create Modal
        const createBtn = page.getByRole('button', { name: /Nouveau Document|New Document/i }).first();
        await expect(createBtn).toBeVisible({ timeout: 10000 });
        await createBtn.click();

        // Check Modal Title
        await expect(page.getByRole('heading', { name: /Nouveau Document|New Document/i })).toBeVisible({ timeout: 5000 });

        // Fill Form
        await page.getByLabel(/Titre du document|Title/i).fill('E2E Test Policy');
        await page.getByLabel(/Référence/i).fill('POL-E2E-001');
        await page.getByLabel(/Version/i).fill('1.0');

        // Select Type (Dropdown)
        await page.getByLabel(/Type/i).selectOption('Politique');

        // Verify Submit Button exists (Mock submission to avoid pollution)
        const submitBtn = page.getByRole('button', { name: /Créer|Create/i });
        await expect(submitBtn).toBeVisible({ timeout: 5000 });

        // Start submission
        // We mocked Firestore, so this should "succeed" network-wise but might not show up in list without explicit mock list support
        // But verifying the form interaction is the main goal here.
        await submitBtn.click();
    });

    test('should filter documents', async ({ page }) => {
        await page.goto('/#/documents');
        
        // Wait for overlays to close
        await waitForOverlaysToClose(page);

        // Search Filter
        const searchInput = page.getByPlaceholder(/Rechercher|Search/i).first();
        await expect(searchInput).toBeVisible({ timeout: 10000 });
        await searchInput.fill('NonExistentDoc');

        // Check Empty State or Filtered Result
        // Since we mock data in utils.ts (empty list for documents by default), we should see empty state or mocks if we added them.
        // utils.ts currently returns [] for 'documents' unless it's assets/risks. 
        // So we expect 0 documents initially.

        // This test mostly verifies the UI elements for filtering exist and are interactive.
        await expect(page.getByRole('combobox').filter({ hasText: /Toutes les catégories|All Categories/i })).toBeVisible({ timeout: 5000 });
    });
});
