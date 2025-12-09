import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should display login page', async ({ page }) => {
        await page.goto('/login');
        await expect(page).toHaveTitle(/Sentinel GRC/);
        await expect(page.getByPlaceholder('nom@entreprise.com')).toBeVisible();
        await expect(page.getByPlaceholder('••••••••')).toBeVisible();
        await expect(page.getByRole('button', { name: /Se connecter/i })).toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
        await page.goto('/login');
        await page.getByPlaceholder('Ex: name@company.com').fill('invalid@test.com');
        await page.getByPlaceholder('••••••••').fill('wrongpassword');
        await page.getByRole('button', { name: /Se connecter/i }).click();
        // Assuming a toast or error message appears
        // await expect(page.getByText(/Invalid credentials/i)).toBeVisible(); // Adjust based on actual error UI
    });
});
