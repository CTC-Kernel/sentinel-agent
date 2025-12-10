
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
    // Listen to browser logs
    page.on('console', msg => console.log(`BROWSER LOG: ${msg.type()}: ${msg.text()} `));

    // Enable App Check Debugging
    await page.addInitScript(() => {
        localStorage.setItem('debug_app_check', 'true');
    });

    // Use a unique email for each run
    const timestamp = Date.now();
    const email = `test.e2e.${timestamp} @sentinel.com`;
    const password = 'Password@123';

    await page.goto('/login');

    // Toggle to Register mode
    await page.getByRole('button', { name: /Créer un nouveau compte/i }).click();

    // Fill registration form
    await page.getByPlaceholder('nom@entreprise.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(password);

    // Submit
    await page.getByRole('button', { name: /Créer un compte/i }).click();

    try {
        // Wait for navigation away from login
        // We accepted /, /onboarding, or /verify-email
        await expect(page).not.toHaveURL(/login/, { timeout: 20000 });
    } catch (e) {
        // Check for error message on UI
        // Use a better selector if possible
        const errorMsg = await page.locator('div.bg-red-50').textContent().catch(() => 'No Error UI Found');
        console.log("Auth failed. UI Error Container Text:", errorMsg);

        // Check if we are still on login
        console.log("Current URL:", page.url());
        throw e;
    }

    // Save storage state
    await page.context().storageState({ path: authFile });
});

