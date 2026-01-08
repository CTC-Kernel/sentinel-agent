import { Page } from '@playwright/test';

export const BASE_URL = 'http://127.0.0.1:8080';

export async function setupMockAuth(page: Page) {
    // Add auth cookies
    await page.context().addCookies([
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
        },
        {
            name: 'bypass_auth',
            value: 'true',
            domain: 'localhost',
            path: '/',
        }
    ]);

    // Inject mock auth state directly into localStorage and window object
    await page.addInitScript(() => {
        // Set test shortcuts
        const win = window as unknown as {
            __TEST_MODE__: boolean;
            __BYPASS_AUTH__: boolean;
            __DISABLE_TOURS__: boolean;
        };
        win.__TEST_MODE__ = true;
        win.__BYPASS_AUTH__ = true;
        win.__DISABLE_TOURS__ = true;

        window.localStorage.setItem('demoMode', 'true');
        window.localStorage.setItem('tour-seen', 'true');
        window.localStorage.setItem('tours-disabled', 'true');
        window.localStorage.setItem('driver-js-disabled', 'true');

        // Disable ALL tours - comprehensive coverage for all pages
        const tourKeys = [
            'dashboard-tour-completed', 'assets-tour-completed', 'risks-tour-completed',
            'compliance-tour-completed', 'documents-tour-completed', 'reports-tour-completed',
            'settings-tour-completed', 'team-tour-completed', 'incidents-tour-completed',
            'audits-tour-completed', 'suppliers-tour-completed', 'vulnerabilities-tour-completed',
            'privacy-tour-completed', 'threat-intel-tour-completed', 'continuity-tour-completed',
            'projects-tour-completed', 'system-tour-completed', 'backup-tour-completed'
        ];
        tourKeys.forEach(key => window.localStorage.setItem(key, 'true'));

        window.localStorage.setItem('E2E_TEST_USER', JSON.stringify({
            uid: "e2e-user-123",
            email: "e2e@sentinel.com",
            displayName: "E2E Sentinel",
            organizationId: "org_default",
            role: "admin",
            onboardingCompleted: true,
            emailVerified: true
        }));

        // Also set auth_user for TestAuthGuard legacy support
        window.localStorage.setItem('auth_user', JSON.stringify({
            uid: "e2e-user-123",
            email: "e2e@sentinel.com",
            displayName: "E2E Sentinel",
            organizationId: "org_default",
            role: "admin"
        }));
    });
}

export async function waitForOverlaysToClose(page: Page) {
    // Wait for any overlays to disappear
    await page.waitForTimeout(1000);

    // Try to close tour dialogs by clicking their close button
    try {
        const closeButtons = await page.locator('dialog button:has-text("Close"), dialog button:has-text("×"), .driver-popover button').all();
        for (const btn of closeButtons) {
            if (await btn.isVisible()) {
                await btn.click({ force: true });
                await page.waitForTimeout(300);
            }
        }
    } catch {
        // Ignore errors
    }

    // Check for and close any remaining Driver.js overlays
    try {
        const driverPopovers = await page.locator('.driver-popover').all();
        for (const popover of driverPopovers) {
            if (await popover.isVisible()) {
                // Try to find and click "Suivant" or close button
                const nextBtn = popover.locator('button:has-text("Suivant"), button:has-text("Next")');
                if (await nextBtn.isVisible()) {
                    // Keep clicking next until we finish the tour
                    for (let i = 0; i < 10; i++) {
                        try {
                            await nextBtn.click({ force: true });
                            await page.waitForTimeout(300);
                        } catch {
                            break;
                        }
                    }
                }
                await popover.click({ force: true });
                await page.waitForTimeout(300);
            }
        }
    } catch {
        // Ignore errors
    }

    // Press Escape multiple times to close any dialogs
    for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
    }

    // Wait for overlays to be hidden
    try {
        await page.waitForSelector('.driver-popover', { state: 'hidden', timeout: 3000 });
    } catch {
        // Continue even if overlays don't hide
    }
}

export async function dismissTourDialog(page: Page) {
    // Specifically target tour dialogs and close them
    try {
        const tourDialog = page.locator('dialog[open], [role="dialog"]').first();
        if (await tourDialog.isVisible()) {
            const closeBtn = tourDialog.locator('button:has-text("×"), button:has-text("Close")').first();
            if (await closeBtn.isVisible()) {
                await closeBtn.click({ force: true });
                await page.waitForTimeout(500);
            } else {
                // Try pressing Escape
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
            }
        }
    } catch {
        // Ignore
    }
}

export async function setupOverlayHandlers(page: Page) {
    // Handle common overlays that might interfere with tests

    // More aggressive overlay handling
    page.on('load', async () => {
        // Wait a bit for overlays to appear
        await page.waitForTimeout(1000);

        // Try to close any Driver.js overlays
        try {
            const driverPopovers = await page.locator('.driver-popover').all();
            for (const popover of driverPopovers) {
                if (await popover.isVisible()) {
                    await popover.click({ force: true });
                    await page.waitForTimeout(500);
                }
            }
        } catch {
            // Ignore errors
        }

        // Try to close any overlay dialogs
        try {
            const overlays = await page.locator('[role="dialog"], .modal, .overlay').all();
            for (const overlay of overlays) {
                if (await overlay.isVisible()) {
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(500);
                }
            }
        } catch {
            // Ignore errors
        }
    });

    await page.addLocatorHandler(page.getByText('Accepter et Fermer'), async (overlay) => {
        await overlay.click({ force: true });
    });

    await page.addLocatorHandler(page.locator('.driver-popover'), async (overlay) => {
        await overlay.click({ force: true });
    });

    await page.addLocatorHandler(page.locator('.driver-overlay'), async (overlay) => {
        await overlay.click({ force: true });
    });

    await page.addLocatorHandler(page.locator('#headlessui-portal-root'), async () => {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
    });

    // Capture browser console logs
    page.on('console', msg => {
        const text = msg.text();
        if (msg.type() === 'error' || text.includes('TestAuthGuard') || text.includes('BackupRestore') || text.includes('AppInner') || text.includes('useDocumentsData')) {
            console.log(`BROWSER MSG: ${msg.type()} - ${text}`);
        }
    });
}

export async function setupFirestoreMocks(page: Page) {
    // Disable tours and overlays by injecting JavaScript early
    await page.addInitScript(() => {
        // Disable Driver.js and other tour libraries
        const win = window as unknown as {
            driver: unknown;
            driverjs: unknown;
            tourDisabled: boolean;
        };
        win.driver = undefined;
        win.driverjs = undefined;
        win.tourDisabled = true;

        // Prevent tour initialization
        const originalQuerySelector = document.querySelector;
        (document as unknown as { querySelector: typeof originalQuerySelector }).querySelector = function (selector: string) {
            if (selector.includes('driver') || selector.includes('tour')) {
                return null;
            }
            return originalQuerySelector.call(this, selector);
        };
    });

    // Setup comprehensive overlay handlers
    await setupOverlayHandlers(page);

    // Intercept Firestore Aggregation Queries (Counts)
    await page.route('**/documents:runAggregationQuery*', async route => {
        const json = {
            result: {
                aggregateFields: {
                    aggregate_0: { integerValue: "0" }
                }
            }
        };
        await route.fulfill({ json });
    });

    // Intercept Firestore Listen (Snapshots)
    // Aborting the request forces the SDK to treat it as a network error (Offline mode)
    // or simply stops the infinite loading state.
    await page.route('**/Listen/channel*', async route => {
        await route.abort();
    });

    // Intercept generic document queries (REST API)
    await page.route('*firestore.googleapis.com*', async route => {
        const resourceType = route.request().resourceType();
        // Only intercept fetch/xhr requests. Scripts/styles/etc should pass through.
        if (resourceType !== 'fetch' && resourceType !== 'xhr') {
            await route.continue();
            return;
        }

        const url = route.request().url();
        const method = route.request().method();
        console.log(`[Mock] Intercepting ${method} ${url}`);

        if (method === 'GET') {
            // Check which collection is being requested
            // Firestore REST API structure: .../documents/projects/ID/databases/(default)/documents/COLLECTION

            if (url.includes('/assets')) {
                await route.fulfill({
                    json: {
                        documents: [
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/assets/mock-asset-1",
                                fields: {
                                    name: { stringValue: "Mock Server" },
                                    type: { stringValue: "server" },
                                    status: { stringValue: "active" },
                                    owner: { stringValue: "admin" },
                                    organizationId: { stringValue: "org_default" },
                                    id: { stringValue: "mock-asset-1" },
                                    description: { stringValue: "A mock asset for testing" },
                                    confidentiality: { integerValue: "3" },
                                    integrity: { integerValue: "3" },
                                    availability: { integerValue: "3" }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            }
                        ]
                    }
                });
                return;
            }

            if (url.includes('/risks')) {
                // Return empty list by default or some mocks if needed
                // For now, let's return one mock risk so lists aren't empty
                await route.fulfill({
                    json: {
                        documents: [
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/risks/mock-risk-1",
                                fields: {
                                    name: { stringValue: "Mock Risk" },
                                    threat: { stringValue: "Data Leak" },
                                    vulnerability: { stringValue: "Weak Password" },
                                    probability: { integerValue: "3" },
                                    impact: { integerValue: "4" },
                                    organizationId: { stringValue: "org_default" },
                                    id: { stringValue: "mock-risk-1" },
                                    status: { stringValue: "Ouvert" }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            }
                        ]
                    }
                });
                return;
            }

            if (url.includes('/controls')) {
                console.log('Intercepted /controls request, returning mock...');
                await route.fulfill({
                    json: {
                        documents: [
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/controls/mock-control-1",
                                fields: {
                                    id: { stringValue: "A.5.1.1" },
                                    code: { stringValue: "A.5.1.1" },
                                    name: { stringValue: "Policies for information security" },
                                    description: { stringValue: "Management direction for information security according to ISO 27001" },
                                    domain: { stringValue: "A.5" },
                                    status: { stringValue: "Non commencé" },
                                    organizationId: { stringValue: "org_default" },
                                    evidenceIds: { arrayValue: { values: [] } },
                                    implementationStatus: { stringValue: "Not Implemented" },
                                    lastReviewDate: { timestampValue: "2024-01-01T00:00:00Z" },
                                    owner: { stringValue: "admin" }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            },
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/controls/mock-control-2",
                                fields: {
                                    id: { stringValue: "A.5.1.2" },
                                    code: { stringValue: "A.5.1.2" },
                                    name: { stringValue: "Information security roles and responsibilities" },
                                    description: { stringValue: "All information security responsibilities are defined and allocated" },
                                    domain: { stringValue: "A.5" },
                                    status: { stringValue: "Implémenté" },
                                    organizationId: { stringValue: "org_default" },
                                    evidenceIds: { arrayValue: { values: [] } },
                                    implementationStatus: { stringValue: "Implemented" },
                                    lastReviewDate: { timestampValue: "2024-01-01T00:00:00Z" },
                                    owner: { stringValue: "admin" }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            },
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/controls/mock-control-3",
                                fields: {
                                    id: { stringValue: "A.6.1.1" },
                                    code: { stringValue: "A.6.1.1" },
                                    name: { stringValue: "Information security communication" },
                                    description: { stringValue: "Information security shall be communicated on a continuing basis" },
                                    domain: { stringValue: "A.6" },
                                    status: { stringValue: "En cours" },
                                    organizationId: { stringValue: "org_default" },
                                    evidenceIds: { arrayValue: { values: [] } },
                                    implementationStatus: { stringValue: "In Progress" },
                                    lastReviewDate: { timestampValue: "2024-01-01T00:00:00Z" },
                                    owner: { stringValue: "admin" }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            }
                        ]
                    }
                });
                return;
            }

            // Mock documents collection for evidence upload and document management
            if (url.includes('/documents')) {
                console.log('Intercepted /documents request, returning mock...');
                await route.fulfill({
                    json: {
                        documents: [
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/mock-doc-1",
                                fields: {
                                    id: { stringValue: "mock-doc-1" },
                                    title: { stringValue: "Politique de Sécurité" },
                                    reference: { stringValue: "POL-SEC-001" },
                                    version: { stringValue: "1.0" },
                                    type: { stringValue: "Politique" },
                                    status: { stringValue: "Validé" },
                                    organizationId: { stringValue: "org_default" },
                                    owner: { stringValue: "admin" },
                                    content: { stringValue: "Contenu de test pour la politique de sécurité" }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            },
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/mock-doc-2",
                                fields: {
                                    id: { stringValue: "mock-doc-2" },
                                    title: { stringValue: "Procédure de Backup" },
                                    reference: { stringValue: "PROC-BACK-002" },
                                    version: { stringValue: "2.1" },
                                    type: { stringValue: "Procédure" },
                                    status: { stringValue: "Brouillon" },
                                    organizationId: { stringValue: "org_default" },
                                    owner: { stringValue: "admin" },
                                    content: { stringValue: "Contenu de test pour la procédure de backup" }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            }
                        ]
                    }
                });
                return;
            }

            // Mock vulnerabilities collection
            if (url.includes('/vulnerabilities')) {
                console.log('Intercepted /vulnerabilities request, returning mock...');
                await route.fulfill({
                    json: {
                        documents: [
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/vulnerabilities/mock-vuln-1",
                                fields: {
                                    id: { stringValue: "mock-vuln-1" },
                                    cve: { stringValue: "CVE-2023-1234" },
                                    severity: { stringValue: "High" },
                                    title: { stringValue: "Critical SQL Injection Vulnerability" },
                                    description: { stringValue: "A critical SQL injection vulnerability found in the authentication module" },
                                    affectedAsset: { stringValue: "Web Server" },
                                    status: { stringValue: "Open" },
                                    organizationId: { stringValue: "org_default" },
                                    discoveredDate: { timestampValue: "2024-01-01T00:00:00Z" }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            },
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/vulnerabilities/mock-vuln-2",
                                fields: {
                                    id: { stringValue: "mock-vuln-2" },
                                    cve: { stringValue: "CVE-2023-5678" },
                                    severity: { stringValue: "Medium" },
                                    title: { stringValue: "Cross-Site Scripting (XSS)" },
                                    description: { stringValue: "Reflected XSS vulnerability in the search functionality" },
                                    affectedAsset: { stringValue: "Frontend Application" },
                                    status: { stringValue: "In Progress" },
                                    organizationId: { stringValue: "org_default" },
                                    discoveredDate: { timestampValue: "2024-01-02T00:00:00Z" }
                                },
                                createTime: "2024-01-02T00:00:00Z",
                                updateTime: "2024-01-02T00:00:00Z"
                            }
                        ]
                    }
                });
                return;
            }

            // Mock projects collection
            if (url.includes('/projects')) {
                console.log('Intercepted /projects request, returning mock...');
                await route.fulfill({
                    json: {
                        documents: [
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/projects/mock-project-1",
                                fields: {
                                    id: { stringValue: "mock-project-1" },
                                    name: { stringValue: "ISO 27001 Certification Project" },
                                    description: { stringValue: "Project to achieve ISO 27001 certification" },
                                    status: { stringValue: "Active" },
                                    organizationId: { stringValue: "org_default" },
                                    startDate: { timestampValue: "2024-01-01T00:00:00Z" },
                                    manager: { stringValue: "admin" }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            }
                        ]
                    }
                });
                return;
            }

            // Mock team collection
            if (url.includes('/team')) {
                console.log('Intercepted /team request, returning mock...');
                await route.fulfill({
                    json: {
                        documents: [
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/team/mock-user-1",
                                fields: {
                                    uid: { stringValue: "mock-user-1" },
                                    email: { stringValue: "user1@sentinel.com" },
                                    displayName: { stringValue: "John Doe" },
                                    role: { stringValue: "admin" },
                                    organizationId: { stringValue: "org_default" },
                                    status: { stringValue: "Active" }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            },
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/team/mock-user-2",
                                fields: {
                                    uid: { stringValue: "mock-user-2" },
                                    email: { stringValue: "user2@sentinel.com" },
                                    displayName: { stringValue: "Jane Smith" },
                                    role: { stringValue: "user" },
                                    organizationId: { stringValue: "org_default" },
                                    status: { stringValue: "Active" }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            }
                        ]
                    }
                });
                return;
            }

            // Mock users collection
            if (url.includes('/users')) {
                console.log('Intercepted /users request, returning mock...');
                await route.fulfill({
                    json: {
                        documents: [
                            {
                                name: "projects/sentinel-prod/databases/(default)/documents/users/e2e-user-123",
                                fields: {
                                    uid: { stringValue: "e2e-user-123" },
                                    email: { stringValue: "e2e@sentinel.com" },
                                    displayName: { stringValue: "E2E Sentinel" },
                                    organizationId: { stringValue: "org_default" },
                                    role: { stringValue: "admin" },
                                    onboardingCompleted: { booleanValue: true },
                                    emailVerified: { booleanValue: true }
                                },
                                createTime: "2024-01-01T00:00:00Z",
                                updateTime: "2024-01-01T00:00:00Z"
                            }
                        ]
                    }
                });
                return;
            }

            // Default empty for other collections (users, etc.)
            await route.fulfill({
                json: { documents: [] }
            });
        } else if (method === 'POST') {
            // Mock successful creation
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                json: {
                    name: "projects/sentinel-prod/databases/(default)/documents/mock_collection/new_id",
                    fields: {}, // Return empty fields or whatever the app expects
                    createTime: new Date().toISOString(),
                    updateTime: new Date().toISOString()
                }
            });
        } else {
            await route.continue();
        }
    });

    console.log('🔧 Firestore Network Mocks Enabled');
}
