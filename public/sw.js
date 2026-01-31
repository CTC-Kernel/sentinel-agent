/**
 * Service Worker pour les notifications push
 */

// Écouter les événements push
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/',
            timestamp: Date.now()
        },
        actions: data.actions || [
            { action: 'open', title: 'Ouvrir' },
            { action: 'close', title: 'Fermer' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Gérer les clics sur les notifications
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    let urlToOpen = event.notification.data.url || '/';

    // Validate URL: only allow same-origin or relative paths
    if (urlToOpen.startsWith('/')) {
        // Relative path - safe
    } else {
        try {
            const parsed = new URL(urlToOpen);
            if (parsed.origin !== self.location.origin) {
                // Reject cross-origin URLs
                urlToOpen = '/';
            }
        } catch {
            // Invalid URL, fall back to root
            urlToOpen = '/';
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Si une fenêtre est déjà ouverte, la focus
                for (const client of clientList) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Sinon, ouvrir une nouvelle fenêtre
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Gérer la fermeture des notifications
self.addEventListener('notificationclose', (event) => {
    // Analytics ou logging si nécessaire
});
