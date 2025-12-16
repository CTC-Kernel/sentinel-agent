
export const EmailTemplateService = {
  /**
   * Generates a premium HTML email template with Sentinel GRC branding.
   */
  generateHtml: (options: {
    title: string;
    content: string;
    actionLabel?: string;
    actionUrl?: string;
    footerText?: string;
  }): string => {
    const { title, content, actionLabel, actionUrl, footerText } = options;
    const year = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f1f5f9;
      padding-bottom: 40px;
    }
    
    .main {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 600px;
      border-spacing: 0;
      font-family: 'Inter', sans-serif;
      color: #334155;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    .header {
      padding: 32px 40px;
      text-align: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    }
    
    .logo-text {
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      text-decoration: none;
    }
    
    .logo-accent {
      color: #3b82f6;
    }
    
    .body {
      padding: 40px;
    }
    
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 24px 0;
      line-height: 1.3;
      letter-spacing: -0.5px;
    }
    
    .content {
      font-size: 16px;
      line-height: 1.6;
      color: #475569;
    }
    
    .content p {
      margin: 0 0 16px 0;
    }
    
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background-color: #2563eb;
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      border-radius: 8px;
      transition: background-color 0.2s;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
    }
    
    .btn:hover {
      background-color: #1d4ed8;
    }
    
    .footer {
      padding: 32px;
      text-align: center;
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    
    .footer-text {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0;
    }
    
    .divider {
      height: 1px;
      background-color: #e2e8f0;
      margin: 32px 0;
      border: none;
    }
    
    /* Utility classes for content */
    .highlight-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin: 24px 0;
    }
    
    .alert-box {
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      border-left: 4px solid;
    }
    
    .alert-danger {
      background-color: #fef2f2;
      border-color: #ef4444;
      color: #991b1b;
    }
    
    .alert-warning {
      background-color: #fffbeb;
      border-color: #f59e0b;
      color: #92400e;
    }
    
    .alert-info {
      background-color: #eff6ff;
      border-color: #3b82f6;
      color: #1e40af;
    }
    
    .alert-success {
      background-color: #f0fdf4;
      border-color: #22c55e;
      color: #166534;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    .data-table td {
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
    }
    
    .data-table td:first-child {
      color: #64748b;
      width: 40%;
    }
    
    .data-table td:last-child {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }

    @media only screen and (max-width: 600px) {
      .main { width: 100% !important; border-radius: 0 !important; }
      .body { padding: 24px !important; }
      .header { padding: 24px !important; }
      .btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body>
  <center class="wrapper">
    <table class="main" width="100%">
      <!-- Header -->
      <tr>
        <td class="header">
          <a href="https://app.cyber-threat-consulting.com" class="logo-text">
            Sentinel <span class="logo-accent">GRC</span>
          </a>
        </td>
      </tr>
      
      <!-- Body -->
      <tr>
        <td class="body">
          <h1 class="title">${title}</h1>
          
          <div class="content">
            ${content}
          </div>
          
          ${actionLabel && actionUrl ? `
          <div class="btn-container">
            <a href="${actionUrl}" class="btn">${actionLabel}</a>
          </div>
          ` : ''}
        </td>
      </tr>
      
      <!-- Footer -->
      <tr>
        <td class="footer">
          <p class="footer-text">
            &copy; ${year} Cyber Threat Consulting. Sentinel GRC.<br>
            Tous droits réservés.
          </p>
          <p class="footer-text" style="margin-top: 12px;">
            ${footerText || 'Ce message vous a été envoyé automatiquement dans le cadre de votre conformité ISO 27001.'}
          </p>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>
        `;
  }
};
