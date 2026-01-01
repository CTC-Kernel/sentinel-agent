import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
    setup.setTimeout(90000);
    const dir = path.dirname(authFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Mock User Data
    const mockUser = {
        uid: "e2e-user-123",
        email: "e2e@sentinel.com",
        displayName: "E2E Sentinel",
        emailVerified: true,
        photoURL: null,
        organizationId: "org_default",
        role: "admin",
        onboardingCompleted: true
    };

    // Go to home page
    await page.goto('/', { timeout: 60000 });

    // Inject into localStorage
    await page.evaluate((user) => {
        localStorage.setItem('E2E_TEST_USER', JSON.stringify(user));
        localStorage.setItem('demoMode', 'true'); // Enable Demo Mode for E2E
        localStorage.setItem('language', 'fr'); // Force French for tests
        localStorage.setItem('onboarding_completed', 'true');
        localStorage.setItem('onboarding_dismissed', 'true');
        localStorage.setItem('sentinel_cookie_consent', 'true'); // Dismiss cookie banner for deterministic UI
        localStorage.setItem('tour-dismissed', 'true'); // Prevent onboarding banner overlay
        localStorage.setItem('tour-seen', 'true');
    }, mockUser);

    // Reload to trigger AuthContext
    await page.reload({ timeout: 60000 });

    // Wait for redirect to Dashboard (HashRouter)
    // We expect to be at root /#/
    await page.waitForURL(/.*#\/$/, { timeout: 60000 });

    // Verify Sidebar is visible (Authenticated state)
    await expect(page.locator('aside')).toBeVisible({ timeout: 30000 });

    // Setup state
    await page.context().storageState({ path: authFile });
});
