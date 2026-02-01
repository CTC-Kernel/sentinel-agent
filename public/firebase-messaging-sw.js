// NOTE: The compat CDN (gstatic.com/firebasejs) only publishes up to the 10.x line.
// Even though package.json uses firebase ^12.x (modular SDK), the service worker
// must use the compat bundle which tops out at 10.14.1. Do NOT bump to 12.x here.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
// These values must match the Firebase project config (see .env VITE_FIREBASE_* vars).
firebase.initializeApp({
    apiKey: "***REDACTED***",
    authDomain: "sentinel-grc-a8701.firebaseapp.com",
    projectId: "sentinel-grc-a8701",
    storageBucket: "sentinel-grc-a8701.firebasestorage.app",
    messagingSenderId: "728667422032",
    appId: "1:728667422032:web:f7bb344574e49320a1c055",
    measurementId: "G-2MLLGDZ6GP"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    // console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    var urlToOpen = event.notification.data?.url || '/';

    // Validate URL: only allow same-origin or relative paths
    if (urlToOpen.startsWith('/')) {
        // Relative path - safe
    } else {
        try {
            var parsed = new URL(urlToOpen);
            if (parsed.origin !== self.location.origin) {
                // Reject cross-origin URLs
                urlToOpen = '/';
            }
        } catch (e) {
            // Invalid URL, fall back to root
            urlToOpen = '/';
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
