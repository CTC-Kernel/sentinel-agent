
export const EmailTemplateService = {
    /**
     * Generates a premium HTML email template with Sentinel GRC branding.
     */
    generateHtml: (options: {
        title: string;
        content: string; // Can contain HTML like <p> tags
        actionLabel?: string;
        actionUrl?: string;
        footerText?: string;
    }): string => {
        const { title, content, actionLabel, actionUrl, footerText } = options;

        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .header { background-color: #4F46E5; padding: 32px; text-align: center; }
    .logo { width: 48px; height: 48px; background-color: rgba(255, 255, 255, 0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 24px; }
    .content { padding: 40px 32px; color: #334155; line-height: 1.6; }
    .title { margin: 0 0 24px; font-size: 24px; font-weight: 700; color: #1E293B; }
    .text { margin-bottom: 24px; font-size: 16px; color: #475569; }
    .button-container { text-align: center; margin-top: 32px; margin-bottom: 32px; }
    .button { display: inline-block; background-color: #4F46E5; color: #ffffff; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 9999px; transition: background-color 0.2s; }
    .button:hover { background-color: #4338ca; }
    .footer { text-align: center; padding-top: 32px; color: #94a3b8; font-size: 12px; }
    .divider { height: 1px; background-color: #E2E8F0; margin: 32px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">S</div>
      </div>
      <div class="content">
        <h1 class="title">${title}</h1>
        <div class="text">
          ${content}
        </div>
        
        ${actionLabel && actionUrl ? `
        <div class="button-container">
          <a href="${actionUrl}" class="button">${actionLabel}</a>
        </div>
        ` : ''}

        <div class="divider"></div>
        
        <p style="margin: 0; font-size: 14px; color: #64748B;">
          Cordialement,<br>
          <strong>L'équipe Sentinel GRC</strong>
        </p>
      </div>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Sentinel GRC. Tous droits réservés.</p>
      <p>${footerText || 'Ce message vous a été envoyé automatiquement.'}</p>
    </div>
  </div>
</body>
</html>
    `;
    }
};
