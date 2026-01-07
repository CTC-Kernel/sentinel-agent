import { Page } from '@playwright/test';

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
        (window as any).__TEST_MODE__ = true;
        (window as any).__BYPASS_AUTH__ = true;

        window.localStorage.setItem('demoMode', 'true');
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

export async function setupFirestoreMocks(page: Page) {
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

    // Intercept generic document queries if any use REST directly
    await page.route('**/documents*', async route => {
        const resourceType = route.request().resourceType();
        // Only intercept fetch/xhr requests. Scripts/styles/etc should pass through.
        if (resourceType !== 'fetch' && resourceType !== 'xhr') {
            await route.continue();
            return;
        }

        const url = route.request().url();
        const method = route.request().method();

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

            // Default empty for other collections (users, controls, etc.)
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
