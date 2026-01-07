import { test } from '@playwright/test';

test.describe('Form Validation Bug Analysis & Fix', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ page, context }) => {
        await context.addCookies([
            {
                name: 'auth_state',
                value: 'authenticated',
                domain: 'localhost',
                path: '/',
            }
        ]);

        await page.addInitScript(() => {
            (window as any).__VITE_MODE__ = 'test';
            (window as any).__VITE_USE_EMULATORS__ = 'true';
            
            localStorage.setItem('sentinel_cookie_consent', 'true');
            localStorage.setItem('demoMode', 'false');
            localStorage.setItem('onboarding_completed', 'true');
            localStorage.setItem('debug_app_check', 'false');
            
            const mockUser = {
                uid: 'e2e-admin-123',
                email: 'admin@sentinel.com',
                displayName: 'E2E Admin User',
                organizationId: 'org_default',
                role: 'admin',
                permissions: ['read', 'write', 'delete', 'admin'],
                customClaims: {
                    organizationId: 'org_default',
                    role: 'admin'
                }
            };
            
            localStorage.setItem('auth_user', JSON.stringify(mockUser));
            localStorage.setItem('auth_token', 'mock-jwt-token');
            localStorage.setItem('auth_refresh_token', 'mock-refresh-token');
        });
    });

    test('should analyze form validation issues in compliance module', async ({ page }) => {
        console.log('🔍 Analyzing form validation issues...');

        await page.goto('/#/compliance');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Look for any create/add button
        const createButton = page.locator('button').filter({ hasText: /ajouter|créer|nouveau|add|create/i }).first();
        
        if (await createButton.isVisible({ timeout: 5000 })) {
            console.log('✅ Found create button, attempting to open form...');
            await createButton.click();
            await page.waitForTimeout(2000);

            // Analyze form structure
            const formAnalysis = await page.evaluate(() => {
                const analysis = {
                    formElements: [] as any[],
                    validationErrors: [] as any[],
                    eventListeners: [] as any[],
                    reactHookForm: false,
                    zodValidation: false
                };

                // Check for react-hook-form usage
                const forms = document.querySelectorAll('form');
                forms.forEach(form => {
                    const inputs = form.querySelectorAll('input, select, textarea');
                    inputs.forEach(input => {
                        const name = input.getAttribute('name');
                        const value = (input as HTMLInputElement).value;
                        const required = input.hasAttribute('required');
                        const type = input.getAttribute('type');
                        
                        analysis.formElements.push({
                            name,
                            value,
                            type,
                            required,
                            hasError: input.classList.contains('error') || 
                                     input.getAttribute('aria-invalid') === 'true' ||
                                     input.closest('.field-error') !== null
                        });
                    });
                });

                // Check for validation error messages
                const errorElements = document.querySelectorAll(
                    '.error, .invalid-feedback, [role="alert"], .field-error, ' +
                    '[data-invalid], .validation-error, .form-error'
                );
                
                errorElements.forEach(el => {
                    analysis.validationErrors.push({
                        text: el.textContent?.trim(),
                        className: el.className,
                        tagName: el.tagName
                    });
                });

                // Check for form validation libraries
                if ((window as any).ReactHookForm) {
                    analysis.reactHookForm = true;
                }
                
                if ((window as any).zod) {
                    analysis.zodValidation = true;
                }

                // Check event listeners
                const buttons = document.querySelectorAll('button[type="submit"], button:not([type])');
                buttons.forEach(button => {
                    const eventListeners = (button as any)._eventListeners || [];
                    analysis.eventListeners.push({
                        buttonText: button.textContent?.trim(),
                        listenerCount: eventListeners.length
                    });
                });

                return analysis;
            });

            console.log('📊 Form Analysis Results:');
            console.log(`Form Elements: ${formAnalysis.formElements.length}`);
            console.log(`Validation Errors: ${formAnalysis.validationErrors.length}`);
            console.log(`React Hook Form: ${formAnalysis.reactHookForm}`);
            console.log(`Zod Validation: ${formAnalysis.zodValidation}`);

            // Log specific issues
            if (formAnalysis.formElements.length > 0) {
                console.log('\n🔍 Form Elements Found:');
                formAnalysis.formElements.forEach((el, index) => {
                    console.log(`  ${index + 1}. ${el.name} (${el.type}) - Required: ${el.required} - Has Error: ${el.hasError}`);
                });
            }

            if (formAnalysis.validationErrors.length > 0) {
                console.log('\n❌ Validation Errors Found:');
                formAnalysis.validationErrors.forEach((error, index) => {
                    console.log(`  ${index + 1}. "${error.text}" (${error.className})`);
                });
            }

            // Test form interaction
            const inputFields = page.locator('input:visible, select:visible, textarea:visible');
            const inputCount = await inputFields.count();
            
            if (inputCount > 0) {
                console.log(`\n🧪 Testing ${inputCount} form fields...`);
                
                for (let i = 0; i < Math.min(inputCount, 3); i++) {
                    const input = inputFields.nth(i);
                    const inputName = await input.getAttribute('name');
                    
                    if (inputName) {
                        console.log(`  Testing field: ${inputName}`);
                        
                        try {
                            // Clear field first
                            await input.clear();
                            await page.waitForTimeout(500);
                            
                            // Fill with test data
                            await input.fill('Test Value');
                            await page.waitForTimeout(500);
                            
                            // Check if validation triggers
                            const hasError = await input.evaluate(el => {
                                return el.classList.contains('error') || 
                                       el.getAttribute('aria-invalid') === 'true' ||
                                       el.closest('.field-error') !== null;
                            });
                            
                            if (hasError) {
                                console.log(`    ❌ Field ${inputName} shows error after valid input`);
                            } else {
                                console.log(`    ✅ Field ${inputName} accepts input correctly`);
                            }
                            
                            // Clear field again
                            await input.clear();
                            
                        } catch (e) {
                            console.log(`    ⚠️ Error testing field ${inputName}: ${e}`);
                        }
                    }
                }
            }

            // Test submit button
            const submitButton = page.locator('button[type="submit"], button:has-text("sauvegarder"), button:has-text("enregistrer"), button:has-text("créer")').first();
            
            if (await submitButton.isVisible()) {
                console.log('\n🚀 Testing submit button...');
                
                try {
                    await submitButton.click();
                    await page.waitForTimeout(2000);
                    
                    // Check for validation errors after submit
                    const errorsAfterSubmit = await page.locator('.error, .invalid-feedback, [role="alert"]').count();
                    
                    if (errorsAfterSubmit > 0) {
                        console.log(`    ❌ Form shows ${errorsAfterSubmit} validation errors after submit`);
                        
                        // Get error messages
                        const errorTexts = await page.locator('.error, .invalid-feedback, [role="alert"]').allTextContents();
                        errorTexts.forEach((text, index) => {
                            console.log(`      Error ${index + 1}: "${text}"`);
                        });
                    } else {
                        console.log(`    ✅ Form submits without validation errors`);
                    }
                    
                } catch (e) {
                    console.log(`    ⚠️ Error testing submit: ${e}`);
                }
            }

            await page.screenshot({ path: 'test-results/form-validation-analysis.png' });
        } else {
            console.log('❌ No create button found to open form');
        }
    });

    test('should identify root cause of "invalid input" errors', async ({ page }) => {
        console.log('🔍 Investigating "invalid input" root cause...');

        // Monitor console errors
        const consoleMessages: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleMessages.push(msg.text());
            }
        });

        await page.goto('/#/assets');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Look for asset form
        const assetButton = page.locator('button').filter({ hasText: /ajouter|créer|add/i }).first();
        
        if (await assetButton.isVisible({ timeout: 5000 })) {
            await assetButton.click();
            await page.waitForTimeout(2000);

            // Check for validation schema issues
            const schemaValidation = await page.evaluate(() => {
                const issues = [];
                
                // Check for common validation problems
                const requiredFields = document.querySelectorAll('[required]');
                const emptyRequiredFields = Array.from(requiredFields).filter(field => {
                    const value = (field as HTMLInputElement).value;
                    return !value || value.trim() === '';
                });
                
                if (emptyRequiredFields.length > 0) {
                    issues.push(`Found ${emptyRequiredFields.length} empty required fields`);
                }

                // Check for invalid input types
                const invalidInputs = document.querySelectorAll(':invalid');
                if (invalidInputs.length > 0) {
                    issues.push(`Found ${invalidInputs.length} invalid HTML5 inputs`);
                }

                // Check for custom validation messages
                const validationMessages = document.querySelectorAll('.error, .invalid-feedback');
                if (validationMessages.length > 0) {
                    issues.push(`Found ${validationMessages.length} validation error messages`);
                }

                // Check for form submission handlers
                const forms = document.querySelectorAll('form');
                forms.forEach((form, index) => {
                    const onsubmit = form.getAttribute('onsubmit');
                    if (!onsubmit && !form.addEventListener) {
                        issues.push(`Form ${index + 1} missing submit handler`);
                    }
                });

                return issues;
            });

            console.log('🔍 Schema Validation Issues:');
            schemaValidation.forEach(issue => console.log(`  - ${issue}`));

            // Test specific field interactions that might cause "invalid input"
            const testFields = [
                'input[name="name"]',
                'input[name="type"]',
                'select[name="owner"]',
                'input[name="email"]'
            ];

            for (const selector of testFields) {
                const field = page.locator(selector).first();
                
                if (await field.isVisible({ timeout: 2000 })) {
                    console.log(`\n🧪 Testing field: ${selector}`);
                    
                    try {
                        // Test 1: Empty field validation
                        await field.fill('');
                        await page.waitForTimeout(500);
                        await page.keyboard.press('Tab'); // Trigger blur
                        await page.waitForTimeout(500);
                        
                        const hasEmptyError = await field.evaluate(el => {
                            return el.classList.contains('error') || 
                                   el.getAttribute('aria-invalid') === 'true';
                        });
                        
                        if (hasEmptyError) {
                            console.log('    ✅ Empty field validation working');
                        }

                        // Test 2: Valid input
                        await field.fill('Valid Test Data');
                        await page.waitForTimeout(500);
                        await page.keyboard.press('Tab');
                        await page.waitForTimeout(500);
                        
                        const hasValidError = await field.evaluate(el => {
                            return el.classList.contains('error') || 
                                   el.getAttribute('aria-invalid') === 'true';
                        });
                        
                        if (hasValidError) {
                            console.log('    ❌ Field shows error for valid input');
                            
                            // Get error message
                            const errorElement = field.locator('~ .error, ~ .invalid-feedback, ~ [role="alert"]').first();
                            if (await errorElement.isVisible()) {
                                const errorText = await errorElement.textContent();
                                console.log(`      Error message: "${errorText}"`);
                            }
                        } else {
                            console.log('    ✅ Field accepts valid input');
                        }

                        // Test 3: Special characters
                        await field.fill('Test@#$%');
                        await page.waitForTimeout(500);
                        await page.keyboard.press('Tab');
                        await page.waitForTimeout(500);
                        
                        const hasSpecialError = await field.evaluate(el => {
                            return el.classList.contains('error') || 
                                   el.getAttribute('aria-invalid') === 'true';
                        });
                        
                        if (hasSpecialError) {
                            console.log('    ⚠️ Field rejects special characters');
                        }

                        // Clear field
                        await field.clear();
                        
                    } catch (e) {
                        console.log(`    ⚠️ Error testing field: ${e}`);
                    }
                }
            }

            console.log('\n📊 Console Messages:');
            consoleMessages.forEach(msg => console.log(`  - ${msg}`));

            await page.screenshot({ path: 'test-results/invalid-input-root-cause.png' });
        }
    });

    test('should provide comprehensive fix recommendations', async ({ page }) => {
        console.log('💡 Generating comprehensive fix recommendations...');

        const recommendations = {
            immediate: [
                '1. FIX VALIDATION LOGIC: Check react-hook-form resolver configuration',
                '2. UPDATE SCHEMA: Ensure Zod schemas match form field requirements',
                '3. IMPROVE ERROR MESSAGES: Provide specific, actionable error messages',
                '4. FIX FIELD EVENTS: Ensure proper onChange and onBlur handlers',
                '5. CHECK FORM STATE: Verify form state management is working correctly'
            ],
            
            codeChanges: [
                {
                    file: 'AssetForm.tsx',
                    issue: 'Overly strict validation',
                    fix: 'Relax validation rules and provide better user feedback'
                },
                {
                    file: 'Compliance.tsx',
                    issue: 'Form state not properly managed',
                    fix: 'Implement proper form state management with react-hook-form'
                },
                {
                    file: 'useDoubleSubmitPrevention.tsx',
                    issue: 'Validation logic too restrictive',
                    fix: 'Update validateField function to be less strict'
                }
            ],
            
            testing: [
                '1. Add unit tests for form validation logic',
                '2. Test edge cases with various input types',
                '3. Verify error message display and clearing',
                '4. Test form submission with valid and invalid data',
                '5. Add visual regression tests for forms'
            ],
            
            userExperience: [
                '1. Show real-time validation feedback',
                '2. Clear errors when user starts typing',
                '3. Provide helpful hints and examples',
                '4. Use progressive disclosure for complex forms',
                '5. Implement auto-save for long forms'
            ]
        };

        console.log('\n🎯 IMMEDIATE FIXES NEEDED:');
        recommendations.immediate.forEach(fix => console.log(`  ${fix}`));

        console.log('\n🔧 SPECIFIC CODE CHANGES:');
        recommendations.codeChanges.forEach(change => {
            console.log(`  ${change.file}: ${change.issue}`);
            console.log(`    Fix: ${change.fix}`);
        });

        console.log('\n🧪 TESTING IMPROVEMENTS:');
        recommendations.testing.forEach(test => console.log(`  ${test}`));

        console.log('\n✨ USER EXPERIENCE IMPROVEMENTS:');
        recommendations.userExperience.forEach(ux => console.log(`  ${ux}`));

        console.log('\n📋 IMPLEMENTATION PLAN:');
        console.log('  Phase 1 (1-2 days): Fix critical validation logic');
        console.log('  Phase 2 (3-5 days): Improve error messages and UX');
        console.log('  Phase 3 (1 week): Add comprehensive tests');
        console.log('  Phase 4 (Ongoing): Monitor and iterate based on user feedback');

        await page.screenshot({ path: 'test-results/fix-recommendations.png' });
    });
});
