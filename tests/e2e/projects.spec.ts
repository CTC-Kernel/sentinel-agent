import { test, expect } from '@playwright/test';

test.describe('Project Management Flow', () => {

    test('should manage Projects and Tasks', async ({ page }) => {
        await page.goto('/projects');

        // Create Project
        await page.getByRole('button', { name: /Nouveau Projet/i }).click();
        const timestamp = Date.now();
        const projectName = `Compliance Project ${timestamp}`;

        await page.getByLabel('Nom du projet').fill(projectName);
        await page.getByRole('button', { name: /Créer/i }).click();

        await expect(page.getByText(projectName)).toBeVisible();

        // Open Project
        await page.getByText(projectName).click();

        // Add Task (Kanban)
        await page.getByRole('button', { name: /Nouvelle Tâche/i }).click();
        const taskName = "Implement ISO Control";
        await page.getByLabel('Titre').fill(taskName);
        await page.getByRole('button', { name: /Ajouter/i }).click();

        await expect(page.getByText(taskName)).toBeVisible();
    });
});
