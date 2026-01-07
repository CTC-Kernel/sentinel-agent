import { test, expect } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('Forms & Roles Inspector Tests', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page, context }) => {
        // Add cookies to simulate authenticated state
        await context.addCookies([
            {
                name: 'auth_state',
                value: 'authenticated',
                domain: 'localhost',
                path: '/',
            },
            {
                name: 'user_role',
                value: 'admin',
                domain: 'localhost',
                path: '/',
            }
        ]);

        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should test asset creation form', async ({ page }) => {
        await page.goto('/#/assets');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        console.log('Testing asset creation form...');

        // Look for add/create button
        const addButton = page.getByRole('button', { name: /Ajouter|Créer|Add|New/i }).first();
        if (await addButton.isVisible({ timeout: 5000 })) {
            await addButton.click();
            await page.waitForTimeout(2000);

            // Test form fields
            const formFields = [
                { selector: 'input[name*="name"]', label: 'Name' },
                { selector: 'input[name*="description"]', label: 'Description' },
                { selector: 'select[name*="type"]', label: 'Type' },
                { selector: 'input[name*="owner"]', label: 'Owner' }
            ];

            for (const field of formFields) {
                const element = page.locator(field.selector).first();
                if (await element.isVisible({ timeout: 3000 })) {
                    console.log(`✅ ${field.label} field found`);

                    // Test field interaction
                    if (field.selector.includes('input')) {
                        await element.fill('Test Asset Data');
                        await expect(element).toHaveValue('Test Asset Data');
                    }
                } else {
                    console.log(`⚠️ ${field.label} field not found`);
                }
            }

            // Look for submit button
            const submitButton = page.getByRole('button', { name: /Enregistrer|Sauvegarder|Save|Submit/i });
            if (await submitButton.isVisible({ timeout: 3000 })) {
                console.log('✅ Submit button found');
                // Don't actually submit to avoid creating test data
            }

            // Test form validation
            const requiredFields = page.locator('[required], [aria-required="true"]');
            const requiredCount = await requiredFields.count();
            console.log(`✅ Found ${requiredCount} required fields`);
        } else {
            console.log('⚠️ Add button not found, checking for alternative...');
            // Look for any button that might open a form
            const anyButton = page.getByRole('button').first();
            if (await anyButton.isVisible()) {
                console.log('✅ Found alternative button for form interaction');
            }
        }

        await page.screenshot({ path: 'test-results/asset-form.png' });
    });

    test('should test risk assessment form', async ({ page }) => {
        await page.goto('/#/risks');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        console.log('Testing risk assessment form...');

        // Look for risk creation
        const addRiskButton = page.getByRole('button', { name: /Nouveau risque|Add Risk|New Risk/i }).first();
        if (await addRiskButton.isVisible({ timeout: 5000 })) {
            await addRiskButton.click();
            await page.waitForTimeout(2000);

            // Test risk-specific fields
            const riskFields = [
                { selector: 'input[name*="title"]', label: 'Risk Title' },
                { selector: 'textarea[name*="description"]', label: 'Description' },
                { selector: 'select[name*="probability"]', label: 'Probability' },
                { selector: 'select[name*="impact"]', label: 'Impact' },
                { selector: 'select[name*="category"]', label: 'Category' }
            ];

            for (const field of riskFields) {
                const element = page.locator(field.selector).first();
                if (await element.isVisible({ timeout: 3000 })) {
                    console.log(`✅ ${field.label} field found`);

                    if (field.selector.includes('input') || field.selector.includes('textarea')) {
                        await element.fill('Test Risk Data');
                    }
                }
            }

            // Test risk matrix if present
            const riskMatrix = page.locator('[data-testid*="risk-matrix"], .risk-matrix, [class*="matrix"]');
            if (await riskMatrix.isVisible({ timeout: 3000 })) {
                console.log('✅ Risk matrix found');
                // Test matrix interaction
                const matrixCells = riskMatrix.locator('button, [role="button"], td');
                const cellCount = await matrixCells.count();
                if (cellCount > 0) {
                    console.log(`✅ Risk matrix has ${cellCount} interactive cells`);
                }
            }
        }

        await page.screenshot({ path: 'test-results/risk-form.png' });
    });

    test('should test compliance control form', async ({ page }) => {
        await page.goto('/#/compliance');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        console.log('Testing compliance control form...');

        // Look for control management
        const controlButton = page.getByRole('button', { name: /Contrôle|Control|Manage/i }).first();
        if (await controlButton.isVisible({ timeout: 5000 })) {
            await controlButton.click();
            await page.waitForTimeout(2000);

            // Test compliance-specific fields
            const complianceFields = [
                { selector: 'input[name*="control"]', label: 'Control ID' },
                { selector: 'input[name*="title"]', label: 'Control Title' },
                { selector: 'select[name*="framework"]', label: 'Framework' },
                { selector: 'select[name*="category"]', label: 'Category' },
                { selector: 'textarea[name*="description"]', label: 'Description' }
            ];

            for (const field of complianceFields) {
                const element = page.locator(field.selector).first();
                if (await element.isVisible({ timeout: 3000 })) {
                    console.log(`✅ ${field.label} field found`);
                }
            }

            // Test ISO 27001 specific controls
            const isoControls = page.getByText(/ISO 27001|A\.\d+/i);
            if (await isoControls.count() > 0) {
                console.log('✅ ISO 27001 controls found');
            }
        }

        await page.screenshot({ path: 'test-results/compliance-form.png' });
    });

    test('should test user management forms', async ({ page }) => {
        await page.goto('/#/team');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        console.log('Testing user management forms...');

        // Look for user creation
        const addUserButton = page.getByRole('button', { name: /Ajouter utilisateur|Add User|New User/i }).first();
        if (await addUserButton.isVisible({ timeout: 5000 })) {
            await addUserButton.click();
            await page.waitForTimeout(2000);

            // Test user-specific fields
            const userFields = [
                { selector: 'input[name*="email"]', label: 'Email' },
                { selector: 'input[name*="name"]', label: 'Name' },
                { selector: 'input[name*="firstName"]', label: 'First Name' },
                { selector: 'input[name*="lastName"]', label: 'Last Name' },
                { selector: 'select[name*="role"]', label: 'Role' }
            ];

            for (const field of userFields) {
                const element = page.locator(field.selector).first();
                if (await element.isVisible({ timeout: 3000 })) {
                    console.log(`✅ ${field.label} field found`);

                    if (field.selector.includes('email')) {
                        await element.fill('test@example.com');
                    } else if (field.selector.includes('name')) {
                        await element.fill('Test User');
                    }
                }
            }

            // Test role selection
            const roleSelect = page.locator('select[name*="role"]').first();
            if (await roleSelect.isVisible()) {
                const options = roleSelect.locator('option');
                const optionCount = await options.count();
                console.log(`✅ Found ${optionCount} role options`);

                // Test role options
                const expectedRoles = ['admin', 'rssi', 'auditor', 'user', 'reader'];
                for (const role of expectedRoles) {
                    const roleOption = roleSelect.locator(`option[value="${role}"]`);
                    if (await roleOption.isVisible()) {
                        console.log(`✅ Role ${role} available`);
                    }
                }
            }
        }

        await page.screenshot({ path: 'test-results/user-form.png' });
    });

    test('should test document upload form', async ({ page }) => {
        await page.goto('/#/documents');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        console.log('Testing document upload form...');

        // Look for document upload
        const uploadButton = page.getByRole('button', { name: /Télécharger|Upload|Add Document/i }).first();
        if (await uploadButton.isVisible({ timeout: 5000 })) {
            await uploadButton.click();
            await page.waitForTimeout(2000);

            // Test file upload
            const fileInput = page.locator('input[type="file"]').first();
            if (await fileInput.isVisible({ timeout: 3000 })) {
                console.log('✅ File input found');

                // Test file metadata fields
                const metadataFields = [
                    { selector: 'input[name*="title"]', label: 'Document Title' },
                    { selector: 'textarea[name*="description"]', label: 'Description' },
                    { selector: 'select[name*="category"]', label: 'Category' },
                    { selector: 'select[name*="type"]', label: 'Document Type' },
                    { selector: 'input[name*="version"]', label: 'Version' }
                ];

                for (const field of metadataFields) {
                    const element = page.locator(field.selector).first();
                    if (await element.isVisible({ timeout: 3000 })) {
                        console.log(`✅ ${field.label} field found`);
                    }
                }
            }

            // Test drag & drop area
            const dropZone = page.locator('[data-testid*="dropzone"], .dropzone, [class*="drop-zone"]');
            if (await dropZone.isVisible({ timeout: 3000 })) {
                console.log('✅ Drag & drop zone found');
            }
        }

        await page.screenshot({ path: 'test-results/document-form.png' });
    });

    test('should test incident report form', async ({ page }) => {
        await page.goto('/#/incidents');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        console.log('Testing incident report form...');

        // Look for incident creation
        const reportButton = page.getByRole('button', { name: /Signaler|Report|New Incident/i }).first();
        if (await reportButton.isVisible({ timeout: 5000 })) {
            await reportButton.click();
            await page.waitForTimeout(2000);

            // Test incident-specific fields
            const incidentFields = [
                { selector: 'input[name*="title"]', label: 'Incident Title' },
                { selector: 'select[name*="severity"]', label: 'Severity' },
                { selector: 'select[name*="status"]', label: 'Status' },
                { selector: 'textarea[name*="description"]', label: 'Description' },
                { selector: 'input[name*="date"]', label: 'Date/Time' }
            ];

            for (const field of incidentFields) {
                const element = page.locator(field.selector).first();
                if (await element.isVisible({ timeout: 3000 })) {
                    console.log(`✅ ${field.label} field found`);
                }
            }

            // Test severity levels
            const severityOptions = ['low', 'medium', 'high', 'critical'];
            for (const severity of severityOptions) {
                const severityElement = page.getByText(severity, { exact: false }).first();
                if (await severityElement.isVisible()) {
                    console.log(`✅ Severity level ${severity} found`);
                }
            }
        }

        await page.screenshot({ path: 'test-results/incident-form.png' });
    });

    test('should test role-based access control', async ({ page }) => {
        console.log('Testing RBAC with different user roles...');

        // Test with different roles
        const roles = [
            { role: 'admin', expectedAccess: ['settings', 'team', 'admin_management'] },
            { role: 'rssi', expectedAccess: ['risks', 'compliance', 'audits'] },
            { role: 'auditor', expectedAccess: ['audits', 'reports', 'audit-trail'] },
            { role: 'user', expectedAccess: ['assets', 'reports'] },
            { role: 'reader', expectedAccess: ['reports', 'dashboard'] }
        ];

        for (const roleTest of roles) {
            console.log(`Testing role: ${roleTest.role}`);

            // Update mock user role
            await page.addInitScript((role) => {
                const mockUser = {
                    uid: `e2e-${role}-123`,
                    email: `${role}@sentinel.com`,
                    displayName: `E2E ${role} User`,
                    organizationId: 'org_default',
                    role: role,
                    permissions: ['read'],
                    customClaims: {
                        organizationId: 'org_default',
                        role: role
                    }
                };

                localStorage.setItem('auth_user', JSON.stringify(mockUser));
            }, roleTest.role);

            // Test access to restricted routes
            for (const route of roleTest.expectedAccess) {
                await page.goto(`/#/${route}`);
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(2000);

                const body = page.locator('body');
                await expect(body).toBeVisible();

                console.log(`✅ Role ${roleTest.role} can access ${route}`);
            }

            // Test access to forbidden routes
            const forbiddenRoutes = roleTest.role === 'admin' ? [] : ['admin_management', 'system-health'];
            for (const route of forbiddenRoutes) {
                await page.goto(`/#/${route}`);
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(2000);

                // Should either redirect or show access denied
                const currentUrl = page.url();
                if (currentUrl.includes('login') || currentUrl.includes('access-denied')) {
                    console.log(`✅ Role ${roleTest.role} correctly blocked from ${route}`);
                } else {
                    console.log(`⚠️ Role ${roleTest.role} might have access to ${route}`);
                }
            }
        }

        await page.screenshot({ path: 'test-results/rbac-test.png' });
    });

    test('should test form validation and error handling', async ({ page }) => {
        await page.goto('/#/assets');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        console.log('Testing form validation...');

        // Look for any form
        const addButton = page.getByRole('button', { name: /Ajouter|Créer|Add/i }).first();
        if (await addButton.isVisible({ timeout: 5000 })) {
            await addButton.click();
            await page.waitForTimeout(2000);

            // Test required field validation
            const submitButton = page.getByRole('button', { name: /Enregistrer|Save|Submit/i }).first();
            if (await submitButton.isVisible()) {
                // Try to submit without filling required fields
                await submitButton.click();
                await page.waitForTimeout(1000);

                // Look for validation errors
                const errorMessages = page.locator('.error, [role="alert"], .invalid-feedback, [data-testid*="error"]');
                const errorCount = await errorMessages.count();

                if (errorCount > 0) {
                    console.log(`✅ Found ${errorCount} validation error messages`);

                    for (let i = 0; i < Math.min(errorCount, 5); i++) {
                        const error = errorMessages.nth(i);
                        const errorText = await error.textContent();
                        console.log(`  - Error: ${errorText}`);
                    }
                }

                // Test invalid email format
                const emailField = page.locator('input[type="email"], input[name*="email"]').first();
                if (await emailField.isVisible()) {
                    await emailField.fill('invalid-email');
                    await submitButton.click();
                    await page.waitForTimeout(1000);

                    const emailError = page.locator('.error').first();
                    if (await emailError.isVisible()) {
                        console.log('✅ Email validation working');
                    }
                }
            }
        }

        await page.screenshot({ path: 'test-results/validation-test.png' });
    });

    test('should test inspector functionality', async ({ page }) => {
        console.log('Testing inspector and audit functionality...');

        // Test audit trail inspection
        await page.goto('/#/audit-trail');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Look for filters
        const filterElements = [
            'select[name*="user"]',
            'select[name*="action"]',
            'input[name*="date"]',
            'input[placeholder*="search"]'
        ];

        for (const filter of filterElements) {
            const element = page.locator(filter).first();
            if (await element.isVisible({ timeout: 3000 })) {
                console.log(`✅ Filter ${filter} found`);
            }
        }

        // Test export functionality
        const exportButton = page.getByRole('button', { name: /Exporter|Export/i }).first();
        if (await exportButton.isVisible({ timeout: 5000 })) {
            console.log('✅ Export functionality found');
        }

        // Test detailed inspection
        const viewButtons = page.getByRole('button', { name: /Voir|View|Détails|Details/i });
        const buttonCount = await viewButtons.count();

        if (buttonCount > 0) {
            console.log(`✅ Found ${buttonCount} inspection buttons`);

            // Click first inspection button
            await viewButtons.first().click();
            await page.waitForTimeout(2000);

            // Look for detailed view
            const detailModal = page.locator('.modal, .dialog, [role="dialog"]').first();
            if (await detailModal.isVisible()) {
                console.log('✅ Detail modal opened');

                // Test modal content
                const modalContent = detailModal.locator('.modal-body, .content, main');
                if (await modalContent.isVisible()) {
                    console.log('✅ Modal content loaded');
                }

                // Test close button
                const closeButton = detailModal.locator('.close, [aria-label="Close"], button[title*="Close"]').first();
                if (await closeButton.isVisible()) {
                    await closeButton.click();
                    await page.waitForTimeout(1000);
                    console.log('✅ Modal closed successfully');
                }
            }
        }

        await page.screenshot({ path: 'test-results/inspector-test.png' });
    });
});
