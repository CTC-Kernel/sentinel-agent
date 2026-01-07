import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 4,
    reporter: 'html',
    timeout: 60000,
    use: {
        baseURL: 'http://127.0.0.1:8080',
        trace: 'retain-on-failure',
        headless: true,
        actionTimeout: 30000,
        navigationTimeout: 30000,
    },
    globalSetup: './tests/e2e/global-setup.ts',
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    args: ['--no-sandbox', '--disable-setuid-sandbox'],
                },
            },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://127.0.0.1:8080',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
