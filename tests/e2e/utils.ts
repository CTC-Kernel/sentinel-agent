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

        if (route.request().method() === 'GET' || route.request().method() === 'POST') {
            await route.fulfill({
                json: { documents: [] }
            });
        } else {
            await route.continue();
        }
    });

    console.log('🔧 Firestore Network Mocks Enabled');
}
