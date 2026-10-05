import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Content-Security-Policy of the built application. Everything is served by
 * the Sentinel origin: scripts, styles, the embedded Inter font and the
 * `/api/*` gateway. No inline script is allowed; the theme is applied before
 * the first paint by `public/theme-init.js` for that reason.
 *
 * `frame-ancestors` and reporting are ignored in a `<meta>` policy: the
 * server must send them as headers (see README).
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/**
 * Adds the policy to the production build only: the development server
 * injects an inline React refresh preamble that a strict policy would block.
 */
function contentSecurityPolicy(): Plugin {
  const anchor = '<meta charset="UTF-8" />';
  return {
    name: "sentinel-content-security-policy",
    apply: "build",
    transformIndexHtml(html) {
      if (!html.includes(anchor)) throw new Error("index.html: charset meta not found, cannot add the Content-Security-Policy");
      return html.replace(anchor, `${anchor}\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`);
    },
  };
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  server: { port: 4173 },
});
