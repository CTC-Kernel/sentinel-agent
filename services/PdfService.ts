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
}

export class PdfService {
    private static readonly BRAND_COLOR = '#4F46E5'; // Indigo 600
    private static readonly TEXT_COLOR = '#1E293B'; // Slate 800
    private static readonly SECONDARY_TEXT_COLOR = '#64748B'; // Slate 500
    private static readonly ACCENT_COLOR = '#F8FAFC'; // Slate 50
    private static readonly BORDER_COLOR = '#E2E8F0'; // Slate 200

    /**
     * Initialize a new PDF document with standard settings
     */
    private static createDoc(orientation: 'portrait' | 'landscape' = 'portrait'): jsPDF {
        return new jsPDF({
            orientation,
            unit: 'mm',
            format: 'a4'
        });
    }

    /**
     * Add the standard header with logo and title
     */
    private static addHeader(doc: jsPDF, title: string, subtitle?: string, extraText?: string) {
        const pageWidth = doc.internal.pageSize.width;

        // Logo Placeholder (Left)
        doc.setFillColor(this.BRAND_COLOR);
        doc.rect(14, 10, 10, 10, 'F');
        doc.setTextColor('#FFFFFF');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('S', 16.5, 17); // Sentinel Logo Init

        // App Name
        doc.setTextColor(this.TEXT_COLOR);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Sentinel GRC', 28, 17);

        // Report Title (Right)
        doc.setFontSize(16);
        doc.setTextColor(this.BRAND_COLOR);
        doc.text(title, pageWidth - 14, 17, { align: 'right' });

        // Subtitle/Date (Right, below title)
        if (subtitle) {
            doc.setFontSize(9);
            doc.setTextColor(this.SECONDARY_TEXT_COLOR);
            doc.setFont('helvetica', 'normal');
            doc.text(subtitle, pageWidth - 14, 23, { align: 'right' });
        }

        // Extra Header Text (Left, below logo)
        if (extraText) {
            doc.setFontSize(9);
            doc.setTextColor(this.SECONDARY_TEXT_COLOR);
            doc.text(extraText, 14, 25);
        }

        // Divider Line
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.setLineWidth(0.5);
        doc.line(14, 28, pageWidth - 14, 28);
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
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.5);
            doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);

            // Confidentiality Notice
            doc.setFontSize(8);
            doc.setTextColor(this.SECONDARY_TEXT_COLOR);
            doc.text(footerText, 14, pageHeight - 10);

            // Page Number
            doc.text(`Page ${i} sur ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
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
    ) {
        const doc = this.createDoc(options.orientation);
        const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: fr });

        this.addHeader(doc, options.title, options.subtitle || `Généré le ${dateStr}`, options.headerText);

        doc.autoTable({
            startY: 35,
            head: [columns],
            body: data,
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 9,
                cellPadding: 3,
                textColor: this.TEXT_COLOR,
                lineColor: [226, 232, 240],
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: this.BRAND_COLOR,
                textColor: '#FFFFFF',
                fontStyle: 'bold',
                halign: 'left',
            },
            alternateRowStyles: {
                fillColor: this.ACCENT_COLOR,
            },
            columnStyles: columnStyles,
            margin: { top: 35, bottom: 20, left: 14, right: 14 },
        });

        this.addFooter(doc, options.footerText);
        doc.save(options.filename || `${options.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    }

    /**
     * Generate a complex report with custom content (callback)
     */
    static generateCustomReport(
        options: ReportOptions,
        renderContent: (doc: jsPDF, startY: number) => void
    ) {
        const doc = this.createDoc(options.orientation);
        const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: fr });

        this.addHeader(doc, options.title, options.subtitle || `Généré le ${dateStr}`, options.headerText);

        renderContent(doc, 35);

        this.addFooter(doc, options.footerText);
        doc.save(options.filename || `${options.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    }

    /**
     * Generate a generic Executive Report with Cover Page, Summary, and Content
     */
    static generateExecutiveReport(
        options: ReportOptions & {
            organizationName?: string;
            author?: string;
            summary?: string;
        },
        renderContent: (doc: jsPDF, startY: number) => void
    ) {
        const doc = this.createDoc(options.orientation);
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: fr });

        // --- COVER PAGE ---
        // Background Accent
        doc.setFillColor(this.BRAND_COLOR);
        doc.rect(0, 0, pageWidth, 8, 'F'); // Top bar

        // Logo (Large)
        doc.setFillColor(this.BRAND_COLOR);
        doc.rect(pageWidth / 2 - 15, 60, 30, 30, 'F');
        doc.setTextColor('#FFFFFF');
        doc.setFontSize(40);
        doc.setFont('helvetica', 'bold');
        doc.text('S', pageWidth / 2 - 7, 82);

        // Title
        doc.setTextColor(this.TEXT_COLOR);
        doc.setFontSize(28);
        doc.text(options.title, pageWidth / 2, 110, { align: 'center' });

        // Subtitle
        if (options.subtitle) {
            doc.setFontSize(14);
            doc.setTextColor(this.SECONDARY_TEXT_COLOR);
            doc.setFont('helvetica', 'normal');
            doc.text(options.subtitle, pageWidth / 2, 120, { align: 'center' });
        }

        // Info Box
        doc.setDrawColor(this.BORDER_COLOR);
        doc.setFillColor(this.ACCENT_COLOR);
        doc.roundedRect(pageWidth / 2 - 60, 140, 120, 50, 3, 3, 'FD');

        doc.setFontSize(11);
        doc.setTextColor(this.TEXT_COLOR);

        let infoY = 155;
        if (options.organizationName) {
            doc.setFont('helvetica', 'bold');
            doc.text("Organisation:", pageWidth / 2 - 50, infoY);
            doc.setFont('helvetica', 'normal');
            doc.text(options.organizationName, pageWidth / 2 + 50, infoY, { align: 'right' });
            infoY += 10;
        }

        if (options.author) {
            doc.setFont('helvetica', 'bold');
            doc.text("Auteur:", pageWidth / 2 - 50, infoY);
            doc.setFont('helvetica', 'normal');
            doc.text(options.author, pageWidth / 2 + 50, infoY, { align: 'right' });
            infoY += 10;
        }

        doc.setFont('helvetica', 'bold');
        doc.text("Date:", pageWidth / 2 - 50, infoY);
        doc.setFont('helvetica', 'normal');
        doc.text(dateStr, pageWidth / 2 + 50, infoY, { align: 'right' });


        // Footer on Cover
        doc.setFontSize(10);
        doc.setTextColor(this.SECONDARY_TEXT_COLOR);
        doc.text("Généré par Sentinel GRC", pageWidth / 2, pageHeight - 20, { align: 'center' });

        // --- EXECUTIVE SUMMARY PAGE (If provided) ---
        if (options.summary) {
            doc.addPage();
            this.addHeader(doc, options.title, "Synthèse Exécutive");

            doc.setFontSize(16);
            doc.setTextColor(this.BRAND_COLOR);
            doc.setFont('helvetica', 'bold');
            doc.text("Synthèse Exécutive", 14, 45);

            doc.setFontSize(11);
            doc.setTextColor(this.TEXT_COLOR);
            doc.setFont('helvetica', 'normal');

            // Split text to fit width
            const splitSummary = doc.splitTextToSize(options.summary, pageWidth - 28);
            doc.text(splitSummary, 14, 55);
        }

        // --- CONTENT PAGES ---
        doc.addPage();
        this.addHeader(doc, options.title, options.subtitle || dateStr);
        renderContent(doc, 35);

        this.addFooter(doc, options.footerText);
        doc.save(options.filename || `${options.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    }
}
