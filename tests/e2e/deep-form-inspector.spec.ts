import { test } from '@playwright/test';
import { setupMockAuth, setupFirestoreMocks } from './utils';

test.describe('Deep Form Inspector Tests', () => {
    test.setTimeout(90000);

    test.beforeEach(async ({ page }) => {
        await setupMockAuth(page);
        await setupFirestoreMocks(page);
    });

    test('should discover all form elements systematically', async ({ page }) => {
        const pages = [
            { path: '/#/', name: 'Dashboard' },
            { path: '/#/assets', name: 'Assets' },
            { path: '/#/risks', name: 'Risks' },
            { path: '/#/compliance', name: 'Compliance' },
            { path: '/#/audits', name: 'Audits' },
            { path: '/#/team', name: 'Team' },
            { path: '/#/documents', name: 'Documents' },
            { path: '/#/incidents', name: 'Incidents' },
            { path: '/#/reports', name: 'Reports' },
            { path: '/#/settings', name: 'Settings' }
        ];

        for (const pageInfo of pages) {
            console.log(`\n=== Inspecting ${pageInfo.name} ===`);

            await page.goto(pageInfo.path);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(3000);

            // Discover all interactive elements
            const allButtons = await page.locator('button').count();
            const allInputs = await page.locator('input').count();
            const allSelects = await page.locator('select').count();
            const allTextareas = await page.locator('textarea').count();
            const allForms = await page.locator('form').count();

            console.log(`📊 ${pageInfo.name} elements:`);
            console.log(`  - Buttons: ${allButtons}`);
            console.log(`  - Inputs: ${allInputs}`);
            console.log(`  - Selects: ${allSelects}`);
            console.log(`  - Textareas: ${allTextareas}`);
            console.log(`  - Forms: ${allForms}`);

            // Find all buttons with potential form actions
            const buttons = page.locator('button');
            const buttonCount = await buttons.count();

            for (let i = 0; i < Math.min(buttonCount, 10); i++) {
                const button = buttons.nth(i);
                const isVisible = await button.isVisible();

                if (isVisible) {
                    try {
                        const buttonText = await button.textContent();
                        if (buttonText) {
                            const text = buttonText.trim();
                            if (text.length > 0 && text.length < 50) {
                                console.log(`  📋 Button: "${text}"`);

                                // Look for form-related buttons
                                if (/ajouter|créer|nouveau|add|create|new/i.test(text)) {
                                    console.log(`    ✅ Form creation button found`);

                                    try {
                                        await button.click();
                                        await page.waitForTimeout(2000);

                                        // Now inspect the form that opened
                                        await inspectFormElements(page);

                                        // Go back
                                        await page.goBack();
                                        await page.waitForTimeout(2000);
                                    } catch (e: any) {
                                        console.log(`    ⚠️ Could not click button: ${e.message}`);
                                    }
                                }
                            }
                        }
                    } catch (e: any) {
                        console.log(`    ⚠️ Could not get button text: ${e.message}`);
                    }
                }
            }

            // Look for modal triggers
            const modalTriggers = page.locator('[data-bs-toggle="modal"], [data-toggle="modal"], [onclick*="modal"]');
            const modalCount = await modalTriggers.count();
            if (modalCount > 0) {
                console.log(`  🪟 Found ${modalCount} modal triggers`);
            }

            await page.screenshot({ path: `test-results/inspect-${pageInfo.name.toLowerCase()}.png` });
        }
    });

    async function inspectFormElements(page: any) {
        console.log(`    🔍 Inspecting form elements...`);

        // Find all form inputs
        const inputs = page.locator('input:visible');
        const inputCount = await inputs.count();

        if (inputCount > 0) {
            console.log(`      📝 Found ${inputCount} visible inputs:`);

            for (let i = 0; i < Math.min(inputCount, 10); i++) {
                const input = inputs.nth(i);
                const inputType = await input.getAttribute('type');
                const inputName = await input.getAttribute('name');
                const inputPlaceholder = await input.getAttribute('placeholder');
                const inputId = await input.getAttribute('id');

                console.log(`        - Type: ${inputType || 'text'}, Name: ${inputName || 'N/A'}, ID: ${inputId || 'N/A'}`);

                if (inputPlaceholder) {
                    console.log(`          Placeholder: "${inputPlaceholder}"`);
                }
            }
        }

        // Find all select elements
        const selects = page.locator('select:visible');
        const selectCount = await selects.count();

        if (selectCount > 0) {
            console.log(`      📋 Found ${selectCount} visible selects:`);

            for (let i = 0; i < Math.min(selectCount, 5); i++) {
                const select = selects.nth(i);
                const selectName = await select.getAttribute('name');
                const selectId = await select.getAttribute('id');

                console.log(`        - Name: ${selectName || 'N/A'}, ID: ${selectId || 'N/A'}`);

                // Count options
                const options = select.locator('option');
                const optionCount = await options.count();
                console.log(`          Options: ${optionCount}`);
            }
        }

        // Find all textareas
        const textareas = page.locator('textarea:visible');
        const textareaCount = await textareas.count();

        if (textareaCount > 0) {
            console.log(`      📄 Found ${textareaCount} visible textareas:`);

            for (let i = 0; i < textareaCount; i++) {
                const textarea = textareas.nth(i);
                const textareaName = await textarea.getAttribute('name');
                const textareaPlaceholder = await textarea.getAttribute('placeholder');

                console.log(`        - Name: ${textareaName || 'N/A'}`);
                if (textareaPlaceholder) {
                    console.log(`          Placeholder: "${textareaPlaceholder}"`);
                }
            }
        }

        // Look for required fields
        const requiredFields = page.locator('[required]:visible, [aria-required="true"]:visible');
        const requiredCount = await requiredFields.count();
        if (requiredCount > 0) {
            console.log(`      ⚠️ Found ${requiredCount} required fields`);
        }

        // Look for validation elements
        const validationElements = page.locator('.error, .invalid-feedback, [role="alert"], .validation-message');
        const validationCount = await validationElements.count();
        if (validationCount > 0) {
            console.log(`      🚨 Found ${validationCount} validation elements`);
        }

        // Look for submit buttons
        const submitButtons = page.locator('button[type="submit"]:visible, input[type="submit"]:visible');
        const submitCount = await submitButtons.count();
        if (submitCount > 0) {
            console.log(`      ✅ Found ${submitCount} submit buttons`);
        }

        // Look for cancel buttons
        const cancelButtons = page.locator('button:visible, input[type="button"]:visible').filter({ hasText: /annuler|cancel|fermer|close/i });
        const cancelCount = await cancelButtons.count();
        if (cancelCount > 0) {
            console.log(`      ❌ Found ${cancelCount} cancel/close buttons`);
        }
    }

    test('should test form interactions and validation', async ({ page }) => {
        console.log('\n=== Testing Form Interactions ===');

        await page.goto('/#/assets');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Try to find and interact with any form
        const buttons = page.locator('button:visible');
        const buttonCount = await buttons.count();

        for (let i = 0; i < Math.min(buttonCount, 5); i++) {
            const button = buttons.nth(i);
            const buttonText = await button.textContent();

            if (buttonText && /ajouter|créer|nouveau|add|create|new/i.test(buttonText)) {
                console.log(`🎯 Testing form with button: "${buttonText}"`);

                try {
                    await button.click();
                    await page.waitForTimeout(2000);

                    // Test form field interactions
                    await testFormFieldInteractions(page);

                    // Try to close any modal
                    const closeButton = page.locator('.close, [aria-label="Close"], button[title*="Close"], button:has-text("Annuler"), button:has-text("Cancel")').first();
                    if (await closeButton.isVisible()) {
                        await closeButton.click();
                        await page.waitForTimeout(1000);
                    }

                    break;
                } catch (e: any) {
                    console.log(`⚠️ Error testing form: ${e.message}`);
                }
            }
        }
    });

    async function testFormFieldInteractions(page: string | any) {
        console.log('  🧪 Testing field interactions...');

        // Test text inputs
        const textInputs = page.locator('input[type="text"]:visible, input:not([type]):visible');
        const textInputCount = await textInputs.count();

        for (let i = 0; i < Math.min(textInputCount, 3); i++) {
            const input = textInputs.nth(i);
            const inputName = await input.getAttribute('name') || await input.getAttribute('id') || `input-${i}`;

            try {
                await input.fill('Test Value');
                const value = await input.inputValue();
                console.log(`    ✅ Text input ${inputName}: "${value}"`);

                // Clear it
                await input.clear();
            } catch (e: any) {
                console.log(`    ⚠️ Could not interact with input ${inputName}: ${e.message}`);
            }
        }

        // Test selects
        const selects = page.locator('select:visible');
        const selectCount = await selects.count();

        for (let i = 0; i < Math.min(selectCount, 2); i++) {
            const select = selects.nth(i);
            const selectName = await select.getAttribute('name') || await select.getAttribute('id') || `select-${i}`;

            try {
                const options = select.locator('option');
                const optionCount = await options.count();

                if (optionCount > 1) {
                    // Select second option (skip first if it's placeholder)
                    const secondOption = options.nth(1);
                    await select.selectOption(await secondOption.getAttribute('value'));
                    console.log(`    ✅ Select ${selectName}: selected option`);
                }
            } catch (e) {
                console.log(`    ⚠️ Could not interact with select ${selectName}`);
            }
        }

        // Test textareas
        const textareas = page.locator('textarea:visible');
        const textareaCount = await textareas.count();

        for (let i = 0; i < textareaCount; i++) {
            const textarea = textareas.nth(i);
            const textareaName = await textarea.getAttribute('name') || await textarea.getAttribute('id') || `textarea-${i}`;

            try {
                await textarea.fill('Test textarea content');
                const value = await textarea.inputValue();
                console.log(`    ✅ Textarea ${textareaName}: "${value.substring(0, 30)}..."`);

                await textarea.clear();
            } catch (e) {
                console.log(`    ⚠️ Could not interact with textarea ${textareaName}`);
            }
        }

        // Test checkboxes
        const checkboxes = page.locator('input[type="checkbox"]:visible');
        const checkboxCount = await checkboxes.count();

        for (let i = 0; i < Math.min(checkboxCount, 3); i++) {
            const checkbox = checkboxes.nth(i);
            const checkboxName = await checkbox.getAttribute('name') || await checkbox.getAttribute('id') || `checkbox-${i}`;

            try {
                await checkbox.check();
                const isChecked = await checkbox.isChecked();
                console.log(`    ✅ Checkbox ${checkboxName}: ${isChecked}`);

                await checkbox.uncheck();
            } catch (e) {
                console.log(`    ⚠️ Could not interact with checkbox ${checkboxName}`);
            }
        }

        // Test radio buttons
        const radios = page.locator('input[type="radio"]:visible');
        const radioCount = await radios.count();

        if (radioCount > 0) {
            try {
                await radios.first().check();
                console.log(`    ✅ Radio button selected`);
            } catch (e) {
                console.log(`    ⚠️ Could not interact with radio buttons`);
            }
        }
    }

    test('should inspect role-based UI elements', async ({ page }) => {
        console.log('\n=== Testing Role-Based UI ===');

        const roles = ['admin', 'rssi', 'auditor', 'user', 'reader'];

        for (const role of roles) {
            console.log(`\n👤 Testing UI for role: ${role}`);

            // Update role
            await page.addInitScript((r) => {
                const mockUser = {
                    uid: `e2e-${r}-123`,
                    email: `${r}@sentinel.com`,
                    displayName: `E2E ${r}`,
                    organizationId: 'org_default',
                    role: r,
                    permissions: ['read'],
                    customClaims: {
                        organizationId: 'org_default',
                        role: r
                    }
                };

                localStorage.setItem('auth_user', JSON.stringify(mockUser));
            }, role);

            await page.goto('/#/');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            // Count visible navigation elements
            const navButtons = page.locator('nav button, nav a, aside button, aside a');
            const navCount = await navButtons.count();
            console.log(`  🧭 Navigation elements: ${navCount}`);

            // Count action buttons
            const actionButtons = page.locator('main button, main a[role="button"]');
            const actionCount = await actionButtons.count();
            console.log(`  🎯 Action buttons: ${actionCount}`);

            // Check for admin-specific elements
            if (role === 'admin') {
                const adminElements = page.locator('[data-testid*="admin"], [class*="admin"], [id*="admin"]');
                const adminCount = await adminElements.count();
                console.log(`  👑 Admin elements: ${adminCount}`);
            }

            await page.screenshot({ path: `test-results/ui-role-${role}.png` });
        }
    });

    test('should test accessibility and form structure', async ({ page }) => {
        console.log('\n=== Testing Accessibility ===');

        await page.goto('/#/assets');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Check for proper form labels
        const inputs = page.locator('input:visible, select:visible, textarea:visible');
        const inputCount = await inputs.count();

        let labeledInputs = 0;
        let unlabeledInputs = 0;

        for (let i = 0; i < Math.min(inputCount, 10); i++) {
            const input = inputs.nth(i);
            const inputId = await input.getAttribute('id');
            const inputAriaLabel = await input.getAttribute('aria-label');
            const inputAriaLabelledBy = await input.getAttribute('aria-labelledby');

            if (inputId) {
                const label = page.locator(`label[for="${inputId}"]`);
                if (await label.isVisible()) {
                    labeledInputs++;
                } else {
                    unlabeledInputs++;
                }
            } else if (inputAriaLabel || inputAriaLabelledBy) {
                labeledInputs++;
            } else {
                unlabeledInputs++;
            }
        }

        console.log(`🏷️ Form labels: ${labeledInputs} labeled, ${unlabeledInputs} unlabeled`);

        // Check for ARIA attributes
        const ariaElements = page.locator('[role], [aria-label], [aria-labelledby], [aria-describedby]');
        const ariaCount = await ariaElements.count();
        console.log(`♿ ARIA elements: ${ariaCount}`);

        // Check for proper heading structure
        const headings = page.locator('h1, h2, h3, h4, h5, h6');
        const headingCount = await headings.count();
        console.log(`📰 Headings: ${headingCount}`);

        // Check for alt text on images
        const images = page.locator('img');
        const imageCount = await images.count();
        let imagesWithAlt = 0;

        for (let i = 0; i < imageCount; i++) {
            const img = images.nth(i);
            const alt = await img.getAttribute('alt');
            if (alt) {
                imagesWithAlt++;
            }
        }

        console.log(`🖼️ Images: ${imageCount} total, ${imagesWithAlt} with alt text`);

        await page.screenshot({ path: 'test-results/accessibility-test.png' });
    });
});
