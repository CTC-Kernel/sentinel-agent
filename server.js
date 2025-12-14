import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

const isProd = process.env.NODE_ENV === 'production';

const CSP_REPORT_URI = '/csp-report';
const CSP_REPORT_TO_GROUP = 'csp-endpoint';

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://apis.google.com https://accounts.google.com https://accounts.gstatic.com https://ssl.gstatic.com https://*.gstatic.com https://www.google.com https://www.gstatic.com https://www.googleapis.com https://www.googletagmanager.com https://js.stripe.com; script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' blob: https://apis.google.com https://accounts.google.com https://accounts.gstatic.com https://ssl.gstatic.com https://*.gstatic.com https://www.google.com https://www.gstatic.com https://www.googleapis.com https://www.googletagmanager.com https://js.stripe.com; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss: data: blob: https://app.cyber-threat-consulting.com https://cyber-threat-consulting.com https://sentinel-grc-341983933264.us-west1.run.app https://aistudio.google.com https://firestore.googleapis.com https://accounts.google.com https://www.googleapis.com https://*.firebaseapp.com https://*.web.app https://*.hosted.app https://*.google-analytics.com https://*.analytics.google.com https://region1.google-analytics.com https://www.googletagmanager.com https://api.shodan.io https://haveibeenpwned.com https://safebrowsing.googleapis.com; frame-src 'self' https://cyber-threat-consulting.com https://sentinel-grc-341983933264.us-west1.run.app https://aistudio.google.com https://accounts.google.com https://accounts.gstatic.com https://*.firebaseapp.com https://*.web.app https://*.hosted.app https://www.google.com https://recaptcha.google.com https://js.stripe.com https://hooks.stripe.com; object-src 'none'; worker-src 'self' blob: https://www.google.com https://www.gstatic.com https://recaptcha.google.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; report-uri " + CSP_REPORT_URI + "; report-to " + CSP_REPORT_TO_GROUP;

// Some directives are ignored in report-only mode (notably upgrade-insecure-requests and frame-ancestors).
// Keep enforced CSP strict, but remove ignored directives from report-only to avoid console noise.
const CSP_REPORT_ONLY = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://apis.google.com https://accounts.google.com https://accounts.gstatic.com https://ssl.gstatic.com https://*.gstatic.com https://www.google.com https://www.gstatic.com https://www.googleapis.com https://www.googletagmanager.com https://js.stripe.com; script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' blob: https://apis.google.com https://accounts.google.com https://accounts.gstatic.com https://ssl.gstatic.com https://*.gstatic.com https://www.google.com https://www.gstatic.com https://www.googleapis.com https://www.googletagmanager.com https://js.stripe.com; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: wss: data: blob: https://app.cyber-threat-consulting.com https://cyber-threat-consulting.com https://sentinel-grc-341983933264.us-west1.run.app https://aistudio.google.com https://firestore.googleapis.com https://accounts.google.com https://www.googleapis.com https://*.firebaseapp.com https://*.web.app https://*.hosted.app https://*.google-analytics.com https://*.analytics.google.com https://region1.google-analytics.com https://www.googletagmanager.com https://api.shodan.io https://haveibeenpwned.com https://safebrowsing.googleapis.com; frame-src 'self' https://accounts.google.com https://accounts.gstatic.com https://*.firebaseapp.com https://*.web.app https://*.hosted.app https://www.google.com https://recaptcha.google.com https://js.stripe.com https://hooks.stripe.com; object-src 'none'; worker-src 'self' blob: https://www.google.com https://www.gstatic.com https://recaptcha.google.com; base-uri 'self'; form-action 'self'; report-uri " + CSP_REPORT_URI + "; report-to " + CSP_REPORT_TO_GROUP;

// Serve static files from the dist directory
const distPath = path.resolve(__dirname, 'dist');
if (process.env.NODE_ENV !== 'production') {
    console.log(`Serving static files from: ${distPath}`);
}

// Add security headers to allow Firebase Auth popups
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self), payment=(), usb=(), interest-cohort=()');

    if (isProd) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Reporting API (for CSP report-only visibility without console spam)
    const reportToValue = {
        group: CSP_REPORT_TO_GROUP,
        max_age: 10886400,
        endpoints: [{ url: CSP_REPORT_URI }],
        include_subdomains: true
    };
    res.setHeader('Report-To', JSON.stringify(reportToValue));
    res.setHeader('Reporting-Endpoints', `${CSP_REPORT_TO_GROUP}="${CSP_REPORT_URI}"`);

    // CSP as the single source of truth in App Hosting (Express)
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Content-Security-Policy-Report-Only', CSP_REPORT_ONLY);
    next();
});

// CSP reporting endpoint
app.post('/csp-report', express.json({ type: ['application/csp-report', 'application/json', 'application/reports+json'] }), (req, res) => {
    try {
        // Keep minimal log for debugging in production; no sensitive data should be included by browsers.
        if (process.env.NODE_ENV !== 'production') {
            console.warn('CSP Report:', JSON.stringify(req.body));
        }
    } catch {
        // ignore
    }
    res.status(204).end();
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

        // Forward only a strict allowlist of headers to upstream.
        // Never forward Host/Connection/Forwarded headers blindly.
        const headerAllowlist = new Set([
            'accept',
            'accept-language',
            'authorization',
            'content-type',
            'user-agent',
            'x-request-id',
            'x-correlation-id'
        ]);
        const forwardHeaders = {};
        for (const [key, value] of Object.entries(req.headers)) {
            if (!key) continue;
            const lower = key.toLowerCase();
            if (!headerAllowlist.has(lower)) continue;
            if (typeof value === 'undefined') continue;
            forwardHeaders[lower] = value;
        }

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
            // Force COOP for index.html to allow Auth Popups
            res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
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
