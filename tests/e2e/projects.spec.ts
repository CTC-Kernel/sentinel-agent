import { test, expect } from '@playwright/test';

test.describe('Projects Module', () => {
    test.beforeEach(async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/#/projects');

        // Robust dismissal of modals using locator handlers
        await page.addLocatorHandler(page.getByRole('button', { name: /Start Tour|Commencer/i }), async (overlay) => {
            await overlay.click();
        });
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click();
        });
        // Sometimes the cookie banner locator might need to be more specific or generic depending on DOM
        // Trying to catch the cookie banner if it appears as a separate dialog or banner layer
    });

    test('should display projects list', async ({ page }) => {
        // Wait for loading to finish - "Chargement..." or "Loading..."
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible();

        // Log for debug
        console.log('Projects - URL:', page.url());

        // Check for page title
        await expect(page.getByRole('heading', { name: /Projets|Projects/i, level: 1 })).toBeVisible({ timeout: 30000 });

        // Check for primary action button (present in both list and empty state)
        await expect(page.getByRole('button', { name: /Nouveau Projet|New Project/i }).first()).toBeVisible({ timeout: 15000 });
    });

    test('should open create project drawer', async ({ page }) => {
        // Wait for loading to finish
        await expect(page.getByText(/Chargement|Loading/i)).not.toBeVisible();

        // Wait for the button to be interactive
        const createButton = page.getByRole('button', { name: /Nouveau Projet|New Project/i }).first();
        await createButton.waitFor({ state: 'visible', timeout: 30000 });
        await createButton.scrollIntoViewIfNeeded();
        await createButton.click();

        await expect(page.getByText(/Nouveau Projet|New Project/i).first()).toBeVisible();

        // Check for form
        await expect(page.getByLabel(/Nom du projet|Project Name/i)).toBeVisible();
    });
});
