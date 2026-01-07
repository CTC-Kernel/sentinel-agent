import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('Team Module', () => {
    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);

        // Go to Team page
        await page.goto('/#/team');

        // Dismiss generic overlays if any

        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });

        // Wait for page to be ready
        await expect(page.getByRole('heading', { name: /Équipe|Team/i })).toBeVisible({ timeout: 30000 });
    });

    test('should display team list', async ({ page }) => {
        // Check for specific columns or elements in the team list
        await expect(page.getByText(/Nom|Name/i)).toBeVisible();
        await expect(page.getByText(/Rôle|Role/i)).toBeVisible();

        // Check that we have at least one user (the current mock user)
        // Adjust based on your mock data "E2E Sentinel"
        await expect(page.getByText(/E2E Sentinel/i).first()).toBeVisible();
    });

    test('should open invite user modal', async ({ page }) => {
        // Wait for the invite button to be visible
        const inviteBtn = page.getByRole('button', { name: /Inviter|Invite/i }).first();
        await expect(inviteBtn).toBeVisible({ timeout: 30000 });

        // Click the invite button
        await inviteBtn.click({ timeout: 10000 });

        // Wait for the dialog to be visible with a longer timeout
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 30000 });

        // Check for the invite title in the dialog
        await expect(
            dialog.getByText(/Inviter un membre|Invite Member/i)
        ).toBeVisible({ timeout: 10000 });

        // Close modal
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden({ timeout: 10000 });
    });
});
