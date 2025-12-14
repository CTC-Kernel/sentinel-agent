import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

const isProd = process.env.NODE_ENV === 'production';

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com https://js.stripe.com https://www.google.com https://www.gstatic.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss: data: blob: https://app.cyber-threat-consulting.com https://*.google-analytics.com https://*.analytics.google.com https://region1.google-analytics.com https://www.googletagmanager.com https://api.shodan.io https://haveibeenpwned.com https://safebrowsing.googleapis.com; frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://js.stripe.com https://hooks.stripe.com https://www.google.com https://recaptcha.google.com; object-src 'none'; worker-src 'self' blob:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";

// Serve static files from the dist directory
const distPath = path.resolve(__dirname, 'dist');
if (process.env.NODE_ENV !== 'production') {
    console.log(`Serving static files from: ${distPath}`);
}

// Add security headers to allow Firebase Auth popups
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');

    // Baseline security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self), payment=(), usb=(), interest-cohort=()');

    if (isProd) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // CSP as the single source of truth in App Hosting (Express)
    res.setHeader('Content-Security-Policy', CSP);
    next();
});

// Reverse proxy for /api/* to Cloud Functions base (useful in App Hosting where firebase.json rewrites may not apply)
app.use('/api', async (req, res) => {
    const baseUrl = process.env.VITE_OVH_API_BASE_URL;

    if (!baseUrl) {
        res.status(502).json({ error: 'Missing VITE_OVH_API_BASE_URL server env' });
        return;
    }

    const targetUrl = new URL(baseUrl);

    // Preserve the incoming path after /api
    const incoming = new URL(req.originalUrl, `http://${req.headers.host || 'localhost'}`);
    const restPath = incoming.pathname.replace(/^\/api/, '');
    targetUrl.pathname = `${targetUrl.pathname.replace(/\/$/, '')}${restPath}`;
    targetUrl.search = incoming.search;

    try {
        const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise((resolve) => {
            let data = '';
            req.setEncoding('utf8');
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => resolve(data));
        });

        const forwardHeaders = { ...req.headers };
        delete forwardHeaders.host;

        const response = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: forwardHeaders,
            body: body ? String(body) : undefined,
            redirect: 'manual'
        });

        res.status(response.status);

        response.headers.forEach((value, key) => {
            if (key.toLowerCase() === 'transfer-encoding') return;
            res.setHeader(key, value);
        });

        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
    } catch (e) {
        res.status(502).json({ error: 'API proxy failed' });
    }
});

app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
        const base = path.basename(filePath);

        if (base === 'index.html') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return;
        }

        if (base === 'sw.js') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return;
        }

        // Long cache for hashed build assets
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));

// Handle client-side routing by returning index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`Server is running on port ${PORT}`);
    }
});
