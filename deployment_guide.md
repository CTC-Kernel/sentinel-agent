# Deployment Guide: Sentinel GRC V2

This guide outlines the steps to deploy the Sentinel GRC V2 application to production using Firebase App Hosting (or Firebase Hosting).

## Prerequisites
-   **Node.js**: Version 18 or higher.
-   **Firebase CLI**: Installed globally (`npm install -g firebase-tools`).
-   **Google Cloud Project**: An active Firebase project.

## Deployment Options

### Option 1: Firebase App Hosting (Recommended for Next.js/SSR)
App Hosting is the modern, serverless solution for Web frameworks.

1.  **Initialize App Hosting**:
    ```bash
    firebase apphosting:backends:create
    ```
    Follow the prompts to connect your GitHub repository.

2.  **Configuration (`apphosting.yaml`)**:
    Ensure an `apphosting.yaml` file exists in the root (if required by your specific setup, though often auto-detected).

3.  **Environment Variables**:
    Set your environment variables in the Firebase Console under App Hosting settings.
    -   `VITE_FIREBASE_API_KEY`
    -   `VITE_FIREBASE_AUTH_DOMAIN`
    -   `VITE_FIREBASE_PROJECT_ID`
    -   `VITE_FIREBASE_STORAGE_BUCKET`
    -   `VITE_FIREBASE_MESSAGING_SENDER_ID`
    -   `VITE_FIREBASE_APP_ID`

### Option 2: Firebase Hosting (Static / SPA)
Since this is a Vite application (SPA), standard Firebase Hosting is perfectly suitable and often faster.

1.  **Build the Application**:
    ```bash
    npm run build
    ```
    This creates a `dist` folder with the production assets.

2.  **Deploy**:
    ```bash
    firebase deploy --only hosting
    ```

## Post-Deployment Verification
1.  **Check 404s**: Navigating to a non-existent URL should show the custom 404 page.
2.  **Authentication**: Verify login/logout flows work.
3.  **Firestore Rules**: Ensure security rules are active (check via Firebase Console).

## Troubleshooting
-   **Build Failures**: Run `npm run type-check` locally to catch TypeScript errors before deploying.
-   **Missing Assets**: Ensure all assets are in the `public` directory or imported correctly in code.
