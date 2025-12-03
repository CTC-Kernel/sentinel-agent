import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReportOptions {
    title: string;
    subtitle?: string;
    orientation?: 'portrait' | 'landscape';
    filename?: string;
    headerText?: string;
    footerText?: string;
    includeCover?: boolean;
    coverImage?: string; // Base64 or URL
    watermark?: boolean;
    save?: boolean;
    organizationName?: string;
    organizationLogo?: string; // Base64 or URL
}

export class PdfService {
    // Brand Palette - Modern & Professional
    private static readonly BRAND_PRIMARY = '#4F46E5'; // Indigo 600
    private static readonly BRAND_SECONDARY = '#312E81'; // Indigo 900
    private static readonly ACCENT_COLOR = '#EEF2FF'; // Indigo 50
    private static readonly TEXT_PRIMARY = '#1E293B'; // Slate 800
    private static readonly TEXT_SECONDARY = '#64748B'; // Slate 500
    private static readonly BORDER_COLOR = '#E2E8F0'; // Slate 200

    /**
     * Initialize a new PDF document with standard settings
     */
    private static createDoc(orientation: 'portrait' | 'landscape' = 'portrait'): jsPDF {
        const doc = new jsPDF({
            orientation,
            unit: 'mm',
            format: 'a4'
        });
        doc.setFont('helvetica');
        return doc;
    }

    /**
     * Add a "Confidential" watermark to the current page
     */
    private static addWatermark(doc: jsPDF) {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        doc.saveGraphicsState();
        doc.setTextColor(240, 240, 240); // Very light gray
        doc.setFontSize(60);
        doc.setFont('helvetica', 'bold');

        // Rotate text
        doc.text('CONFIDENTIEL', pageWidth / 2, pageHeight / 2, {
            align: 'center',
            angle: 45,
            renderingMode: 'fill'
        });
        doc.restoreGraphicsState();
    }

    /**
     * Add the standard header with logo and title
     */
    private static addHeader(doc: jsPDF, title: string, subtitle?: string, options?: ReportOptions) {
        const pageWidth = doc.internal.pageSize.width;

        // Top Accent Line
        doc.setFillColor(this.BRAND_PRIMARY);
        doc.rect(0, 0, pageWidth, 2, 'F');

        // Logo Area (Left)
        if (options?.organizationLogo) {
            try {
                // Assuming base64 or valid URL that jsPDF can handle
                doc.addImage(options.organizationLogo, 'PNG', 14, 10, 10, 10);
            } catch (e) {
                // Fallback if image fails
                doc.setFillColor(this.BRAND_PRIMARY);
                doc.roundedRect(14, 10, 10, 10, 2, 2, 'F');
                doc.setTextColor('#FFFFFF');
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(options.organizationName?.charAt(0) || 'S', 16.5, 17);
            }
        } else {
            doc.setFillColor(this.BRAND_PRIMARY);
            doc.roundedRect(14, 10, 10, 10, 2, 2, 'F');
            doc.setTextColor('#FFFFFF');
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('S', 16.5, 17); // Sentinel Logo Init
        }

        // App/Org Name
        doc.setTextColor(this.BRAND_SECONDARY);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(options?.organizationName || 'Sentinel GRC', 28, 17);

        // Report Title (Right)
        doc.setFontSize(12);
        doc.setTextColor(this.TEXT_PRIMARY);
        doc.text(title, pageWidth - 14, 15, { align: 'right' });

        // Subtitle/Date (Right, below title)
        if (subtitle) {
            doc.setFontSize(9);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.setFont('helvetica', 'normal');
            doc.text(subtitle, pageWidth - 14, 20, { align: 'right' });
        }

        // Divider Line
        doc.setDrawColor(this.BORDER_COLOR);
        doc.setLineWidth(0.1);
        doc.line(14, 25, pageWidth - 14, 25);
    }

    /**
     * Add the standard footer with page numbers
     */
    private static addFooter(doc: jsPDF, footerText: string = 'Document Confidentiel - Généré par Sentinel GRC') {
        const pageCount = doc.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);

            // Divider Line
            doc.setDrawColor(this.BORDER_COLOR);
            doc.setLineWidth(0.1);
            doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);

            // Footer Text
            doc.setFontSize(8);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.text(footerText, 14, pageHeight - 10);

            // Page Number
            doc.text(`Page ${i} sur ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });

            // Bottom Accent
            doc.setFillColor(this.BRAND_PRIMARY);
            doc.rect(0, pageHeight - 1, pageWidth, 1, 'F');
        }
    }

    /**
     * Generate a standard table report
     */
    static generateTableReport(
        options: ReportOptions,
        columns: string[],
        data: (string | number)[][],
        columnStyles: Record<string, unknown> = {}
    ): jsPDF {
        const doc = this.createDoc(options.orientation);
        const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: fr });

        this.addHeader(doc, options.title, options.subtitle || `Généré le ${dateStr}`, options);

        doc.autoTable({
            startY: 35,
            head: [columns],
            body: data,
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 9,
                cellPadding: 4,
                textColor: this.TEXT_PRIMARY,
                lineColor: [226, 232, 240],
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: this.BRAND_PRIMARY,
                textColor: '#FFFFFF',
                fontStyle: 'bold',
                halign: 'left',
                cellPadding: 4,
            },
            alternateRowStyles: {
                fillColor: this.ACCENT_COLOR,
            },
            columnStyles: columnStyles,
            margin: { top: 35, bottom: 20, left: 14, right: 14 },
            didDrawPage: () => {
                if (options.watermark) {
                    this.addWatermark(doc);
                }
            }
        });

        this.addFooter(doc, options.footerText);

        if (options.save !== false) {
            doc.save(options.filename || `${options.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
        }
        return doc;
    }

    /**
     * Generate a complex report with custom content (callback)
     */
    static generateCustomReport(
        options: ReportOptions,
        renderContent: (doc: jsPDF, startY: number) => void
    ): jsPDF {
        const doc = this.createDoc(options.orientation);
        const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: fr });

        this.addHeader(doc, options.title, options.subtitle || `Généré le ${dateStr}`, options);

        renderContent(doc, 35);

        this.addFooter(doc, options.footerText);

        if (options.save !== false) {
            doc.save(options.filename || `${options.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
        }
        return doc;
    }

    /**
     * Generate a generic Executive Report with Premium Cover Page
     */
    static generateExecutiveReport(
        options: ReportOptions & {
            organizationName?: string;
            author?: string;
            summary?: string;
        },
        renderContent: (doc: jsPDF, startY: number) => void
    ): jsPDF {
        const doc = this.createDoc(options.orientation);
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: fr });

        // --- PREMIUM COVER PAGE ---

        // 1. Background Gradient (Simulated with Rects)
        // Main dark side bar
        doc.setFillColor(this.BRAND_SECONDARY);
        doc.rect(0, 0, pageWidth * 0.35, pageHeight, 'F');

        // Accent overlay
        doc.setFillColor(this.BRAND_PRIMARY);
        doc.rect(0, 0, pageWidth * 0.35, pageHeight * 0.4, 'F');

        // 2. Logo Area (Top Left)
        if (options.organizationLogo) {
            try {
                doc.addImage(options.organizationLogo, 'PNG', 20, 40, 30, 30);
            } catch (e) {
                // Fallback
                doc.setTextColor('#FFFFFF');
                doc.setFontSize(60);
                doc.setFont('helvetica', 'bold');
                doc.text(options.organizationName?.charAt(0) || 'S', 20, 55);
            }
        } else {
            doc.setTextColor('#FFFFFF');
            doc.setFontSize(60);
            doc.setFont('helvetica', 'bold');
            doc.text('S', 20, 40);
        }

        doc.setFontSize(24);
        doc.setFont('helvetica', 'light');
        doc.setTextColor('#FFFFFF');
        doc.text(options.organizationName || 'Sentinel', 20, 85);
        if (!options.organizationName) {
            doc.setFont('helvetica', 'bold');
            doc.text('GRC', 20, 95);
        }

        // 3. Report Info (Left Sidebar)
        let infoY = pageHeight - 60;

        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255, 0.7); // Transparent white
        doc.text("ORGANISATION", 20, infoY);
        doc.setFontSize(12);
        doc.setTextColor('#FFFFFF');
        doc.text(options.organizationName || 'Sentinel GRC', 20, infoY + 6);

        infoY += 20;
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255, 0.7);
        doc.text("AUTEUR", 20, infoY);
        doc.setFontSize(12);
        doc.setTextColor('#FFFFFF');
        doc.text(options.author || 'Non spécifié', 20, infoY + 6);

        infoY += 20;
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255, 0.7);
        doc.text("DATE", 20, infoY);
        doc.setFontSize(12);
        doc.setTextColor('#FFFFFF');
        doc.text(dateStr, 20, infoY + 6);

        // 4. Main Title Area (Right Side)
        const contentStartX = pageWidth * 0.35 + 20;
        const contentWidth = pageWidth - contentStartX - 20;

        // Optional: AI Generated Cover Image Placeholder
        if (options.coverImage) {
            try {
                doc.addImage(options.coverImage, 'JPEG', contentStartX, 20, contentWidth, 80);
            } catch (e) {
                console.warn('Failed to add cover image', e);
            }
        } else {
            // Decorative Graphic Element
            doc.setDrawColor(this.BRAND_PRIMARY);
            doc.setLineWidth(2);
            doc.line(contentStartX, 40, contentStartX + 20, 40);
        }

        doc.setTextColor(this.BRAND_SECONDARY);
        doc.setFontSize(42);
        doc.setFont('helvetica', 'bold');

        // Split title if too long
        const splitTitle = doc.splitTextToSize(options.title.toUpperCase(), contentWidth);
        doc.text(splitTitle, contentStartX, 100);

        if (options.subtitle) {
            doc.setFontSize(18);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.setFont('helvetica', 'normal');
            const splitSubtitle = doc.splitTextToSize(options.subtitle, contentWidth);
            doc.text(splitSubtitle, contentStartX, 100 + (splitTitle.length * 15) + 5);
        }

        // Confidentiality Badge
        doc.setDrawColor(this.BRAND_PRIMARY);
        doc.setFillColor(this.ACCENT_COLOR);
        doc.roundedRect(contentStartX, pageHeight - 40, 60, 12, 6, 6, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(this.BRAND_PRIMARY);
        doc.setFont('helvetica', 'bold');
        doc.text("DOCUMENT CONFIDENTIEL", contentStartX + 30, pageHeight - 32, { align: 'center' });

        // --- EXECUTIVE SUMMARY PAGE (If provided) ---
        if (options.summary) {
            doc.addPage();
            this.addHeader(doc, options.title, "Synthèse Exécutive");

            // Section Title
            doc.setFontSize(24);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.setFont('helvetica', 'bold');
            doc.text("Synthèse Exécutive", 14, 45);

            // Decorative underline
            doc.setDrawColor(this.BRAND_PRIMARY);
            doc.setLineWidth(1);
            doc.line(14, 50, 40, 50);

            // Summary Content
            doc.setFontSize(11);
            doc.setTextColor(this.TEXT_PRIMARY);
            doc.setFont('helvetica', 'normal');

            // Add a light background box for the summary
            doc.setFillColor(this.ACCENT_COLOR);
            doc.roundedRect(14, 60, pageWidth - 28, 100, 4, 4, 'F');

            const splitSummary = doc.splitTextToSize(options.summary, pageWidth - 38);
            doc.text(splitSummary, 19, 70);
        }

        // --- CONTENT PAGES ---
        doc.addPage();
        this.addHeader(doc, options.title, options.subtitle || dateStr, options);
        renderContent(doc, 35);

        this.addFooter(doc, options.footerText);

        if (options.watermark) {
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                this.addWatermark(doc);
            }
        }

        if (options.save !== false) {
            doc.save(options.filename || `${options.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
        }
        return doc;
    }
}
