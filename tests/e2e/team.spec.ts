import { test, expect } from '@playwright/test';

test.describe('Team Module', () => {
    test.beforeEach(async ({ page }) => {
        // Go to Team page
        await page.goto('/#/team');

        // Dismiss generic overlays if any
        await page.addLocatorHandler(page.getByRole('button', { name: /Start Tour|Commencer/i }), async (overlay) => {
            await overlay.click({ force: true });
        });
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
        // Click "Invite Member" button
        const inviteBtn = page.getByRole('button', { name: /Inviter|Invite/i }).first();
        await expect(inviteBtn).toBeVisible();
        await inviteBtn.click();

        // Check for Modal Title
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText(/Inviter un membre|Invite Member/i)).toBeVisible();

        // Close modal
        await page.keyboard.press('Escape');
    });
});
