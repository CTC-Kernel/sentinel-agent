import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://app.cyber-threat-consulting.com';

const routes = [
    '/',
    '/login',
    '/incidents',
    '/projects',
    '/assets',
    '/risks',
    '/compliance',
    '/documents',
    '/audits',
    '/team',
    '/suppliers',
    '/privacy',
    '/help',
    '/pricing',
    '/contact' // Assuming a contact page exists or will exist
];

const generateSitemap = () => {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${routes.map(route => `
    <url>
        <loc>${BASE_URL}${route}</loc>
        <changefreq>weekly</changefreq>
        <priority>${route === '/' ? '1.0' : '0.8'}</priority>
    </url>
    `).join('')}
</urlset>`;

    const publicDir = path.join(__dirname, '../public');
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);
    console.log('✅ Sitemap generated successfully!');
};

generateSitemap();
