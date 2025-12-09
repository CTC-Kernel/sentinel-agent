import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
    // Use a unique email for each run or a consistent test user if properly cleaned up
    // For stability, we'll try to login with a known test user, or register if it fails/doesn't exist.
    // Ideally, in a CI environment, we'd seed this user.
    // For now, we'll try to register a new random user to ensure a fresh clean state, 
    // or use a consistent one if we can reset the DB.

    // Strategy: Register a new user for this session to guarantee fresh state.
    const timestamp = Date.now();
    const email = `test.e2e.${timestamp}@sentinel.com`;
    const password = 'Password@123';

    await page.goto('/login');

    // Toggle to Register mode
    await page.getByRole('button', { name: /Créer un nouveau compte/i }).click();

    // Fill registration form
    await page.getByPlaceholder('nom@entreprise.com').fill(email);
    await page.getByPlaceholder('••••••••').fill(password);

    // Submit
    await page.getByRole('button', { name: /Créer un compte/i }).click();

    // Wait for navigation away from login
    // We accepted /, /onboarding, or /verify-email
    await expect(page).not.toHaveURL(/login/, { timeout: 20000 });

    // Save storage state
    await page.context().storageState({ path: authFile });
});
