import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test('verify routing basics', async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER CHROME: ${msg.text()}`));
    await setupMockAuth(page);
    await setupFirestoreMocks(page);

    await page.goto('/#/documents-test');
    await expect(page.getByText('Test Route Verification')).toBeVisible({ timeout: 5000 });
});
