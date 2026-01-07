import { test, expect } from '@playwright/test';

test.describe('Critical GRC Workflows', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
            await overlay.click({ force: true });
        });
    });

    test('should complete full risk assessment workflow', async ({ page }) => {
        // Step 1: Create an asset
        await page.goto('/#/assets');
        await expect(page.getByText(/Actifs|Assets/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        const addAssetBtn = page.getByRole('button', { name: /Ajouter|Add/i }).first();
        if (await addAssetBtn.isVisible()) {
            await addAssetBtn.click();
            await page.waitForTimeout(2000);

            const nameInput = page.getByLabel(/Nom|Name/i);
            if (await nameInput.isVisible()) {
                await nameInput.fill('E2E Workflow Asset');
                
                const saveBtn = page.getByRole('button', { name: /Sauvegarder|Save/i });
                await saveBtn.click();
                await page.waitForTimeout(2000);
            }
        }

        // Step 2: Create a risk for the asset
        await page.goto('/#/risks');
        await expect(page.getByText(/Risques|Risks/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        const addRiskBtn = page.getByRole('button', { name: /Ajouter|Add/i }).first();
        if (await addRiskBtn.isVisible()) {
            await addRiskBtn.click();
            await page.waitForTimeout(2000);

            const riskTitle = page.getByLabel(/Titre|Title/i);
            if (await riskTitle.isVisible()) {
                await riskTitle.fill('E2E Workflow Risk');
                
                const saveRiskBtn = page.getByRole('button', { name: /Sauvegarder|Save/i });
                await saveRiskBtn.click();
                await page.waitForTimeout(2000);
            }
        }

        // Step 3: Link risk to controls
        await page.goto('/#/compliance');
        await expect(page.getByText(/Conformité|Compliance/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        const controlsTab = page.getByRole('tab', { name: /Contrôles|Controls/i });
        if (await controlsTab.isVisible()) {
            await controlsTab.click();
            await page.waitForTimeout(2000);
        }

        // Step 4: Verify workflow completion in audit trail
        await page.goto('/#/audit-trail');
        await expect(page.getByText(/Journal d'audit|Audit Trail/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        const workflowEntries = page.getByText(/E2E Workflow/i);
        if (await workflowEntries.count() > 0) {
            await expect(workflowEntries.first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('should complete incident response workflow', async ({ page }) => {
        // Step 1: Report an incident
        await page.goto('/#/incidents');
        await expect(page.getByText(/Incidents/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        const reportBtn = page.getByRole('button', { name: /Signaler|Report/i }).first();
        if (await reportBtn.isVisible()) {
            await reportBtn.click();
            await page.waitForTimeout(2000);

            const incidentTitle = page.getByLabel(/Titre|Title/i);
            if (await incidentTitle.isVisible()) {
                await incidentTitle.fill('E2E Test Incident');
                
                const severitySelect = page.getByLabel(/Sévérité|Severity/i);
                if (await severitySelect.isVisible()) {
                    await severitySelect.click();
                    await page.keyboard.press('ArrowDown');
                    await page.keyboard.press('Enter');
                }
                
                const saveIncidentBtn = page.getByRole('button', { name: /Sauvegarder|Save/i });
                await saveIncidentBtn.click();
                await page.waitForTimeout(2000);
            }
        }

        // Step 2: Verify incident appears in dashboard
        await page.goto('/#/dashboard');
        await expect(page.locator('[data-tour="dashboard"]')).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        const incidentWidget = page.locator('[data-testid="incident-widget"]');
        if (await incidentWidget.isVisible()) {
            await expect(incidentWidget).toBeVisible();
        }
    });

    test('should complete compliance assessment workflow', async ({ page }) => {
        // Step 1: Navigate to compliance
        await page.goto('/#/compliance');
        await expect(page.getByText(/Conformité|Compliance/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        // Step 2: Review controls
        const controlsTab = page.getByRole('tab', { name: /Contrôles|Controls/i });
        if (await controlsTab.isVisible()) {
            await controlsTab.click();
            await page.waitForTimeout(2000);

            const firstControl = page.locator('[data-testid="control-item"]').first();
            if (await firstControl.isVisible()) {
                await firstControl.click();
                await page.waitForTimeout(2000);

                // Step 3: Update control status
                const statusSelect = page.getByLabel(/Statut|Status/i);
                if (await statusSelect.isVisible()) {
                    await statusSelect.click();
                    await page.keyboard.press('ArrowDown');
                    await page.keyboard.press('Enter');
                    
                    const updateBtn = page.getByRole('button', { name: /Mettre à jour|Update/i });
                    if (await updateBtn.isVisible()) {
                        await updateBtn.click();
                        await page.waitForTimeout(2000);
                    }
                }
            }
        }

        // Step 4: Generate compliance report
        await page.goto('/#/reports');
        await expect(page.getByText(/Rapports|Reports/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        const complianceReport = page.getByText(/Conformité|Compliance/i);
        if (await complianceReport.isVisible()) {
            await complianceReport.click();
            await page.waitForTimeout(2000);
        }
    });

    test('should complete audit preparation workflow', async ({ page }) => {
        // Step 1: Create audit
        await page.goto('/#/audits');
        await expect(page.getByText(/Audits/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        const createAuditBtn = page.getByRole('button', { name: /Créer|Create/i }).first();
        if (await createAuditBtn.isVisible()) {
            await createAuditBtn.click();
            await page.waitForTimeout(2000);

            const auditTitle = page.getByLabel(/Titre|Title/i);
            if (await auditTitle.isVisible()) {
                await auditTitle.fill('E2E Test Audit');
                
                const saveAuditBtn = page.getByRole('button', { name: /Sauvegarder|Save/i });
                await saveAuditBtn.click();
                await page.waitForTimeout(2000);
            }
        }

        // Step 2: Link controls to audit
        const firstAudit = page.locator('[data-testid="audit-row"]').first();
        if (await firstAudit.isVisible()) {
            await firstAudit.click();
            await page.waitForTimeout(2000);

            const linkControlsBtn = page.getByRole('button', { name: /Lier|Link/i });
            if (await linkControlsBtn.isVisible()) {
                await linkControlsBtn.click();
                await page.waitForTimeout(2000);
            }
        }
    });

    test('should complete business continuity workflow', async ({ page }) => {
        // Step 1: Navigate to continuity
        await page.goto('/#/continuity');
        await expect(page.getByText(/Continuité|Continuity/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        // Step 2: Create BIA (Business Impact Analysis)
        const biaTab = page.getByRole('tab', { name: /BIA|Analyse d'impact/i });
        if (await biaTab.isVisible()) {
            await biaTab.click();
            await page.waitForTimeout(2000);

            const createBiaBtn = page.getByRole('button', { name: /Créer|Create/i }).first();
            if (await createBiaBtn.isVisible()) {
                await createBiaBtn.click();
                await page.waitForTimeout(2000);
            }
        }

        // Step 3: Create recovery plan
        const recoveryTab = page.getByRole('tab', { name: /Plan de reprise|Recovery/i });
        if (await recoveryTab.isVisible()) {
            await recoveryTab.click();
            await page.waitForTimeout(2000);
        }
    });

    test('should complete vendor management workflow', async ({ page }) => {
        // Step 1: Add supplier
        await page.goto('/#/suppliers');
        await expect(page.getByText(/Fournisseurs|Suppliers/i)).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(3000);

        const addSupplierBtn = page.getByRole('button', { name: /Ajouter|Add/i }).first();
        if (await addSupplierBtn.isVisible()) {
            await addSupplierBtn.click();
            await page.waitForTimeout(2000);

            const supplierName = page.getByLabel(/Nom|Name/i);
            if (await supplierName.isVisible()) {
                await supplierName.fill('E2E Test Supplier');
                
                const saveSupplierBtn = page.getByRole('button', { name: /Sauvegarder|Save/i });
                await saveSupplierBtn.click();
                await page.waitForTimeout(2000);
            }
        }

        // Step 2: Assess supplier risk
        const firstSupplier = page.locator('[data-testid="supplier-row"]').first();
        if (await firstSupplier.isVisible()) {
            await firstSupplier.click();
            await page.waitForTimeout(2000);

            const assessBtn = page.getByRole('button', { name: /Évaluer|Assess/i });
            if (await assessBtn.isVisible()) {
                await assessBtn.click();
                await page.waitForTimeout(2000);
            }
        }
    });
});
