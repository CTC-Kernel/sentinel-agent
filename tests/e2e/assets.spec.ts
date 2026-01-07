import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks, waitForOverlaysToClose } from './utils';

test.describe('Assets Module', () => {
    test.setTimeout(90000);
    test.beforeEach(async ({ page }) => {
        // Ensure localStorage is populated before hydration
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        // Enhanced debugging
        page.on('console', msg => {
            console.log(`[Browser Console ${msg.type()}]: ${msg.text()}`);
        });
        page.on('pageerror', err => {
            console.log(`[Browser Page Error]: ${err.message}`);
        });
        page.on('requestfailed', request => console.log(`[Network Error]: ${request.url()} - ${request.failure()?.errorText}`));
        page.on('response', response => {
            if (response.status() === 403) {
                console.log(`[403 Forbidden]: ${response.url()}`);
            }
        });

        await page.goto('/#/assets');

        // Robust dismissal of modals
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should display assets list', async ({ page }) => {
        // Wait for overlays to close
        await waitForOverlaysToClose(page);
        
        // Debug: Check current URL and page state
        console.log('Current URL after navigation:', page.url());
        await page.waitForTimeout(5000); // Give page more time to load
        
        // Debug: Take screenshot to see actual page state
        await page.screenshot({ path: 'debug-assets-page.png', fullPage: true });
        
        // Debug: Check if we're still on the right page
        const currentUrl = page.url();
        if (!currentUrl.includes('/assets')) {
            console.log('Redirected away from assets page, current URL:', currentUrl);
            // Try to navigate again
            await page.goto('/#/assets');
            await page.waitForTimeout(3000);
        }
        
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible({ timeout: 30000 });
        
        // Debug: Log all visible headings
        const headings = await page.locator('h1, h2, h3').allTextContents();
        console.log('Visible headings:', headings);
        
        await expect(page.getByRole('heading', { name: /Actifs|Inventory|Assets/i, level: 1 })).toBeVisible({ timeout: 30000 });
        // Check for "Nouvel Actif" button
        await expect(page.getByRole('button', { name: /Nouvel actif|New Asset|Add Asset/i }).first()).toBeVisible({ timeout: 10000 });
    });

    test('should open create asset modal', async ({ page }) => {
        // Wait for overlays to close
        await waitForOverlaysToClose(page);
        
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible({ timeout: 30000 });

        const createButton = page.getByRole('button', { name: /Nouvel actif|New Asset/i }).first();
        await createButton.click({ force: true });
        await expect(page.getByText(/Créer un nouvel actif|Create Asset|New Asset/i)).toBeVisible({ timeout: 5000 });
    });
});
