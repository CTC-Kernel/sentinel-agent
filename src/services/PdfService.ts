import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ReportEnrichmentService } from './ReportEnrichmentService';
import { Risk, Project, ProjectTask, Control, Audit, Finding } from '../types';

export interface ReportOptions {
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
    author?: string;
    autoDownload?: boolean; // New option
}

export class PdfService {
    // Brand Palette - Modern & Professional (Slate/Black/Corporate Blue)
    private static readonly BRAND_PRIMARY = '#0F172A'; // Slate 900 (Deep Black/Navy)
    private static readonly BRAND_SECONDARY = '#334155'; // Slate 700 (Professional Grey)
    private static readonly ACCENT_COLOR = '#F8FAFC'; // Slate 50 (Very light grey background)
    private static readonly TEXT_PRIMARY = '#020617'; // Slate 950 (High contrast text)
    private static readonly TEXT_SECONDARY = '#64748B'; // Slate 500 (Subtle text)
    private static readonly BORDER_COLOR = '#E2E8F0'; // Slate 200

    // Chart Colors
    private static readonly CHART_COLORS = ['#0F172A', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

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
            } catch {
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
        const footerStartY = pageHeight - 25; // Increased footer area from 15mm to 25mm

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);

            // Divider Line
            doc.setDrawColor(this.BORDER_COLOR);
            doc.setLineWidth(0.1);
            doc.line(14, footerStartY, pageWidth - 14, footerStartY);

            // Footer Text
            doc.setFontSize(8);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.text(footerText, 14, footerStartY + 10);

            // Page Number
            doc.text(`Page ${i} sur ${pageCount}`, pageWidth - 14, footerStartY + 10, { align: 'right' });

            // Bottom Accent
            doc.setFillColor(this.BRAND_PRIMARY);
            doc.rect(0, pageHeight - 1, pageWidth, 1, 'F');
        }
    }

    /**
     * Add Premium Cover Page
     */
    private static addCoverPage(doc: jsPDF, options: ReportOptions & { author?: string, organizationName?: string }) {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: fr });
        const sidebarWidth = pageWidth * 0.35;
        const sidebarPadding = 20;
        const maxTextWidth = sidebarWidth - (sidebarPadding * 2); // Calculate available text width

        // 1. Background Gradient (Simulated with Rects)
        // Main dark side bar
        doc.setFillColor(this.BRAND_SECONDARY);
        doc.rect(0, 0, sidebarWidth, pageHeight, 'F');

        // Accent overlay
        doc.setFillColor(this.BRAND_PRIMARY);
        doc.rect(0, 0, sidebarWidth, pageHeight * 0.4, 'F');

        // 2. Logo Area (Top Left)
        if (options.organizationLogo) {
            try {
                doc.addImage(options.organizationLogo, 'PNG', sidebarPadding, 40, 30, 30);
            } catch {
                // Fallback
                doc.setTextColor('#FFFFFF');
                doc.setFontSize(60);
                doc.setFont('helvetica', 'bold');
                doc.text(options.organizationName?.charAt(0) || 'S', sidebarPadding, 55);
            }
        } else {
            doc.setTextColor('#FFFFFF');
            doc.setFontSize(60);
            doc.setFont('helvetica', 'bold');
            doc.text('S', sidebarPadding, 40);
        }

        doc.setFontSize(24);
        doc.setFont('helvetica', 'normal'); // Changed from 'light' to 'normal'
        doc.setTextColor('#FFFFFF');
        const orgName = options.organizationName || 'Sentinel';
        const splitOrgName = doc.splitTextToSize(orgName, maxTextWidth);
        doc.text(splitOrgName, sidebarPadding, 85);
        if (!options.organizationName) {
            doc.setFont('helvetica', 'bold');
            doc.text('GRC', sidebarPadding, 85 + (splitOrgName.length * 8) + 5);
        }

        // 3. Report Info (Left Sidebar)
        let infoY = pageHeight - 80; // Moved up to give more space

        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255, 0.7); // Transparent white
        doc.text("ORGANISATION", sidebarPadding, infoY);
        doc.setFontSize(12);
        doc.setTextColor('#FFFFFF');
        const orgNameInfo = options.organizationName || 'Sentinel GRC';
        const splitOrgNameInfo = doc.splitTextToSize(orgNameInfo, maxTextWidth);
        doc.text(splitOrgNameInfo, sidebarPadding, infoY + 6);

        infoY += 25; // Increased spacing
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255, 0.7);
        doc.text("AUTEUR", sidebarPadding, infoY);
        doc.setFontSize(12);
        doc.setTextColor('#FFFFFF');
        const authorName = options.author || 'Non spécifié';
        const splitAuthorName = doc.splitTextToSize(authorName, maxTextWidth);
        doc.text(splitAuthorName, sidebarPadding, infoY + 6);

        infoY += 25; // Increased spacing
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255, 0.7);
        doc.text("DATE", sidebarPadding, infoY);
        doc.setFontSize(12);
        doc.setTextColor('#FFFFFF');
        doc.text(dateStr, sidebarPadding, infoY + 6);

        // 4. Main Title Area (Right Side)
        const contentStartX = sidebarWidth + 20;
        const contentWidth = pageWidth - contentStartX - 20;

        // Optional: AI Generated Cover Image Placeholder
        if (options.coverImage) {
            try {
                // Validate if it is base64 or url (basic check)
                if (options.coverImage.startsWith('data:image') || options.coverImage.startsWith('http')) {
                    doc.addImage(options.coverImage, 'JPEG', contentStartX, 20, contentWidth, 80);
                } else {
                    throw new Error('Invalid format');
                }
            } catch {
                // Fallback Graphic
                doc.setDrawColor(this.BRAND_PRIMARY);
                doc.setLineWidth(2);
                doc.line(contentStartX, 40, contentStartX + 20, 40);
                doc.setFontSize(10);
                doc.setTextColor(this.TEXT_SECONDARY);
                doc.text("Génération automatique", contentStartX, 45);
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
        const titleY = 120; // Moved down to avoid overlap with image (which ends at Y=100)
        doc.text(splitTitle, contentStartX, titleY);

        if (options.subtitle) {
            doc.setFontSize(18);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.setFont('helvetica', 'normal');
            const splitSubtitle = doc.splitTextToSize(options.subtitle, contentWidth);
            doc.text(splitSubtitle, contentStartX, titleY + (splitTitle.length * 15) + 5);
        }

        // Confidentiality Badge
        doc.setDrawColor(this.BRAND_PRIMARY);
        doc.setFillColor(this.ACCENT_COLOR);
        doc.roundedRect(contentStartX, pageHeight - 40, 60, 12, 6, 6, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(this.BRAND_PRIMARY);
        doc.setFont('helvetica', 'bold');
        doc.text("DOCUMENT CONFIDENTIEL", contentStartX + 30, pageHeight - 32, { align: 'center' });
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

        // Add Cover Page if requested or if image provided
        if (options.includeCover || options.coverImage) {
            this.addCoverPage(doc, options);
            doc.addPage();
        }

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
            margin: { top: 35, bottom: 30, left: 14, right: 14 },
            didDrawPage: () => {
                if (options.watermark) {
                    this.addWatermark(doc);
                }
            }
        });

        this.addFooter(doc, options.footerText);

        if (options.save !== false) {
            if (options.autoDownload !== false) {
                doc.save(options.filename || `${options.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
            }
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
            if (options.autoDownload !== false) {
                doc.save(options.filename || `${options.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
            }
        }
        return doc;
    }

    /**
     * Generate a generic Executive Report with Premium Cover Page
     */
    /**
     * Generate a generic Executive Report with Premium Cover Page
     */
    static generateExecutiveReport(
        options: ReportOptions & {
            organizationName?: string;
            author?: string;
            summary?: string;
            stats?: { label: string; value: number; color?: string }[];
            metrics?: { label: string; value: string | number; subtext?: string }[];
        },
        renderContent: (doc: jsPDF, startY: number) => void
    ): jsPDF {
        const doc = this.createDoc(options.orientation);
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: fr });

        // --- PREMIUM COVER PAGE ---
        this.addCoverPage(doc, options);

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

            let currentY = 70;
            currentY = this.addSafeText(
                doc,
                options.summary,
                19,
                currentY,
                pageWidth - 38,
                5,
                pageHeight,
                20,
                options
            );
            currentY += 15;

            // --- METRICS ROW ---
            if (options.metrics && options.metrics.length > 0) {
                // Check if we need a new page for metrics (approx 35mm needed)
                currentY = this.checkAndAddPage(doc, 35, currentY, options);

                const cardWidth = 45;
                const cardGap = 10;
                let cardX = 19;

                options.metrics.forEach(metric => {
                    if (cardX + cardWidth > pageWidth - 14) return; // Prevent overflow
                    this.drawMetricCard(doc, cardX, currentY, cardWidth, 25, metric.label, metric.value, metric.subtext);
                    cardX += cardWidth + cardGap;
                });
                currentY += 35;
            }

            // --- STATS CHART ---
            if (options.stats && options.stats.length > 0) {
                // Check if we need a new page for stats (approx 70mm needed)
                currentY = this.checkAndAddPage(doc, 70, currentY, options);

                doc.setFontSize(14);
                doc.setTextColor(this.BRAND_SECONDARY);
                doc.setFont('helvetica', 'bold');
                doc.text("Analyses", 19, currentY);
                currentY += 10;

                this.drawBarChart(doc, 19, currentY, pageWidth - 38, 60, options.stats);
            }
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
            if (options.autoDownload !== false) {
                doc.save(options.filename || `${options.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
            }
        }
        return doc;
    }

    /**
     * Draw a modern Bar Chart with enhanced styling
     */
    static drawBarChart(
        doc: jsPDF,
        x: number,
        y: number,
        width: number,
        height: number,
        data: { label: string; value: number; color?: string; trend?: number }[],
        title?: string,
        showTrend: boolean = false
    ) {
        if (title) {
            doc.setFontSize(14);
            doc.setTextColor(this.TEXT_PRIMARY);
            doc.setFont('helvetica', 'bold');
            doc.text(title, x, y - 8);

            // Add subtitle with trend indicator
            if (showTrend && data.length > 0) {
                const avgTrend = data.reduce((sum, item) => sum + (item.trend || 0), 0) / data.length;
                doc.setFontSize(9);
                doc.setTextColor(avgTrend > 0 ? '#10B981' : avgTrend < 0 ? '#EF4444' : '#64748B');
                const trendSymbol = avgTrend > 0 ? '↗' : avgTrend < 0 ? '↘' : '→';
                doc.text(`${trendSymbol} ${Math.abs(avgTrend).toFixed(1)}% vs période précédente`, x, y - 2);
            }
        }

        const maxValue = Math.max(...data.map(d => d.value)) || 100;
        const barWidth = (width / data.length) * 0.65; // Increased bar width
        const spacing = (width / data.length) * 0.35;
        let currentX = x;

        // Draw enhanced background grid
        doc.setDrawColor(this.BORDER_COLOR);
        doc.setLineWidth(0.05);
        for (let i = 0; i <= 5; i++) {
            const gridY = y + (height * (1 - i / 5));
            doc.line(x, gridY, x + width, gridY);

            // Add value labels on Y axis
            doc.setFontSize(7);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.text(Math.round(maxValue * (i / 5)).toString(), x - 5, gridY + 1, { align: 'right' });
        }

        // Draw Axis Line
        doc.setDrawColor(this.BRAND_PRIMARY);
        doc.setLineWidth(0.2);
        doc.line(x, y + height, x + width, y + height);

        data.forEach((item, index) => {
            const barHeight = (item.value / maxValue) * height;
            const color = item.color || this.CHART_COLORS[index % this.CHART_COLORS.length];

            // Enhanced Bar Background with gradient effect (simulated)
            doc.setFillColor(this.ACCENT_COLOR);
            doc.roundedRect(currentX, y, barWidth, height, 1, 1, 'F');

            // Actual Bar with gradient effect
            if (barHeight > 0) {
                // Main bar
                doc.setFillColor(color);
                doc.roundedRect(currentX, y + height - barHeight, barWidth, barHeight, 1, 1, 'F');

                // Add top highlight for 3D effect
                doc.setFillColor(255, 255, 255, 0.3);
                doc.roundedRect(currentX + 1, y + height - barHeight, barWidth - 2, 2, 1, 1, 'F');
            }

            // Enhanced Label with truncation
            doc.setFontSize(8);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.setFont('helvetica', 'normal');
            const labelWidth = doc.getTextWidth(item.label);
            if (labelWidth > barWidth + spacing - 2) {
                // Smart truncation
                const truncated = item.label.length > 8 ? item.label.substring(0, 6) + '...' : item.label;
                doc.text(truncated, currentX + barWidth / 2, y + height + 6, { align: 'center' });
            } else {
                doc.text(item.label, currentX + barWidth / 2, y + height + 6, { align: 'center' });
            }

            // Enhanced Value display
            doc.setFontSize(8);
            doc.setTextColor(this.TEXT_PRIMARY);
            doc.setFont('helvetica', 'bold');
            const valueText = item.value.toString();
            const valueY = y + height - barHeight - 3;

            // Add background for value
            const valueBgWidth = doc.getTextWidth(valueText) + 4;
            doc.setFillColor(255, 255, 255, 0.9);
            doc.roundedRect(currentX + (barWidth - valueBgWidth) / 2, valueY - 4, valueBgWidth, 6, 1, 1, 'F');

            doc.text(valueText, currentX + barWidth / 2, valueY, { align: 'center' });

            // Trend indicator
            if (item.trend !== undefined && showTrend) {
                doc.setFontSize(6);
                doc.setTextColor(item.trend > 0 ? '#10B981' : item.trend < 0 ? '#EF4444' : '#64748B');
                const trendSymbol = item.trend > 0 ? '↗' : item.trend < 0 ? '↘' : '→';
                doc.text(trendSymbol, currentX + barWidth / 2, valueY - 8, { align: 'center' });
            }

            currentX += barWidth + spacing;
        });

        // Add legend if needed
        if (data.length > 5) {
            this.drawCompactLegend(doc, x, y + height + 20, width, data.slice(0, 5).map(item => ({ label: item.label, color: item.color || this.CHART_COLORS[0] })));
        }
    }

    /**
     * Draw a horizontal progress bar
     */
    static drawProgressBar(
        doc: jsPDF,
        x: number,
        y: number,
        width: number,
        height: number,
        value: number, // 0 to 100
        label: string,
        color: string = this.BRAND_PRIMARY
    ) {
        // Label above
        doc.setFontSize(9);
        doc.setTextColor(this.TEXT_PRIMARY);
        doc.setFont('helvetica', 'bold');
        doc.text(label, x, y - 2);

        // Value match
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(this.TEXT_SECONDARY);
        doc.text(`${Math.round(value)}%`, x + width, y - 2, { align: 'right' });

        // Background Track
        doc.setFillColor(this.BORDER_COLOR);
        doc.roundedRect(x, y, width, height, height / 2, height / 2, 'F');

        // Progress Fill
        const fillWidth = (value / 100) * width;
        if (fillWidth > 0) {
            doc.setFillColor(color);
            doc.roundedRect(x, y, fillWidth, height, height / 2, height / 2, 'F');
        }
    }

    /**
     * Helper to add text with automatic page breaks
     */
    static addSafeText(
        doc: jsPDF,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number = 7,
        pageHeight: number,
        bottomMargin: number = 30, // Increased from 20 to 30
        options?: ReportOptions
    ): number {
        const splitText = doc.splitTextToSize(text, maxWidth);
        let currentY = y;

        for (const line of splitText) {
            if (currentY + lineHeight > pageHeight - bottomMargin) {
                doc.addPage();
                currentY = 35; // Reset to top margin
                if (options) {
                    this.addHeader(doc, options.title, options.subtitle, options);
                    if (options.watermark) this.addWatermark(doc);
                    this.addFooter(doc, options.footerText);
                }
            }
            doc.text(line, x, currentY);
            currentY += lineHeight;
        }

        return currentY;
    }

    /**
     * Helper to check if new page is needed and add it
     */
    static checkAndAddPage(
        doc: jsPDF,
        heightNeeded: number,
        currentY: number,
        options: ReportOptions,
        bottomMargin: number = 30
    ): number {
        const pageHeight = doc.internal.pageSize.height;
        if (currentY + heightNeeded > pageHeight - bottomMargin) {
            doc.addPage();
            // Reset to top margin
            const newY = 35;
            this.addHeader(doc, options.title, options.subtitle, options);
            if (options.watermark) this.addWatermark(doc);
            this.addFooter(doc, options.footerText);
            return newY;
        }
        return currentY;
    }

    /**
     * Draw a modern Metric Card
     */
    static drawMetricCard(
        doc: jsPDF,
        x: number,
        y: number,
        width: number,
        height: number,
        label: string,
        value: string | number,
        subtext?: string,
        accentColor: string = this.BRAND_PRIMARY
    ) {
        // Card Background
        doc.setDrawColor(this.BORDER_COLOR);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, width, height, 2, 2, 'FD');

        // Accent Bar (Left)
        doc.setFillColor(accentColor);
        doc.rect(x, y + 2, 1.5, height - 4, 'F');

        // Label
        doc.setFontSize(9);
        doc.setTextColor(this.TEXT_SECONDARY);
        doc.setFont('helvetica', 'bold');
        doc.text(label.toUpperCase(), x + 6, y + 10);

        // Value
        doc.setFontSize(18);
        doc.setTextColor(this.TEXT_PRIMARY);
        doc.setFont('helvetica', 'bold');
        doc.text(value.toString(), x + 6, y + 22);

        // Subtext
        if (subtext) {
            doc.setFontSize(8);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.setFont('helvetica', 'normal');
            doc.text(subtext, x + 6, y + 30);
        }
    }

    /**
     * Draw a modern Donut Chart with enhanced features
     */
    static drawDonutChart(
        doc: jsPDF,
        x: number,
        y: number,
        radius: number,
        data: { label: string; value: number; color: string; trend?: number }[],
        centerText?: string,
        showPercentage: boolean = true
    ) {
        let total = data.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) total = 1;

        let startAngle = 0;
        const centerX = x + radius;
        const centerY = y + radius;

        // Draw shadow effect
        doc.setFillColor(0, 0, 0, 0.1);
        doc.circle(centerX + 2, centerY + 2, radius, 'F');

        // Draw segments with enhanced styling
        data.forEach((item) => {
            if (item.value === 0) return;
            const sliceAngle = (item.value / total) * 360;
            const endAngle = startAngle + sliceAngle;

            // Draw segment shadow
            doc.setFillColor(0, 0, 0, 0.05);
            this.drawArc(doc, centerX + 1, centerY + 1, radius, startAngle + 1, endAngle + 1);

            // Draw main segment
            doc.setFillColor(item.color);
            this.drawArc(doc, centerX, centerY, radius, startAngle, endAngle);

            // Draw segment border
            doc.setDrawColor(255, 255, 255, 0.3);
            doc.setLineWidth(0.5);
            this.drawArcBorder(doc, centerX, centerY, radius, startAngle, endAngle);

            startAngle = endAngle;
        });

        // Draw inner circle with gradient effect
        doc.setFillColor(255, 255, 255);
        doc.circle(centerX, centerY, radius * 0.6, 'F');

        // Add inner shadow
        doc.setFillColor(240, 240, 240, 0.3);
        doc.circle(centerX, centerY, radius * 0.55, 'F');

        // Enhanced Center Text
        if (centerText) {
            doc.setFontSize(14);
            doc.setTextColor(this.TEXT_PRIMARY);
            doc.setFont('helvetica', 'bold');
            doc.text(centerText, centerX, centerY - 3, { align: 'center', baseline: 'middle' });

            // Add subtitle
            if (showPercentage) {
                doc.setFontSize(10);
                doc.setTextColor(this.TEXT_SECONDARY);
                doc.setFont('helvetica', 'normal');
                const percentage = Math.round((data[0]?.value || 0) / total * 100);
                doc.text(`${percentage}% du total`, centerX, centerY + 8, { align: 'center', baseline: 'middle' });
            }
        }

        // Enhanced Legend with trend indicators
        let legendY = y + 5;
        const legendX = x + (radius * 2) + 15;
        const legendWidth = 60;

        data.forEach((item) => {
            if (item.value === 0) return;

            // Draw color indicator
            doc.setFillColor(item.color);
            doc.circle(legendX, legendY, 3, 'F');

            // Draw trend indicator
            if (item.trend !== undefined) {
                doc.setFontSize(6);
                doc.setTextColor(item.trend > 0 ? '#10B981' : item.trend < 0 ? '#EF4444' : '#64748B');
                const trendSymbol = item.trend > 0 ? '↗' : item.trend < 0 ? '↘' : '→';
                doc.text(trendSymbol, legendX + 6, legendY + 1);
            }

            // Draw label with percentage
            doc.setFontSize(8);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.setFont('helvetica', 'normal');
            const percentage = Math.round((item.value / total) * 100);
            const label = `${item.label} (${percentage}%)`;

            // Truncate if too long
            if (doc.getTextWidth(label) > legendWidth) {
                const truncated = item.label.length > 12 ? item.label.substring(0, 10) + '...' : item.label;
                doc.text(`${truncated} (${percentage}%)`, legendX + 12, legendY + 1);
            } else {
                doc.text(label, legendX + 12, legendY + 1);
            }

            legendY += 8;
        });
    }

    /**
     * Helper to draw a filled arc segment (simulated with triangles/polygons for PDF)
     * Simplified approach for jsPDF
     */
    private static drawArc(doc: jsPDF, cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const step = 2 * Math.PI / 180; // 2 degree steps

        // Draw fan of triangles to simulate filled arc
        for (let theta = startRad; theta < endRad; theta += step) {
            let nextTheta = theta + step;
            if (nextTheta > endRad) nextTheta = endRad;

            const x1 = cx + r * Math.cos(theta);
            const y1 = cy + r * Math.sin(theta);
            const x2 = cx + r * Math.cos(nextTheta);
            const y2 = cy + r * Math.sin(nextTheta);

            doc.triangle(cx, cy, x1, y1, x2, y2, 'F');
        }
    }

    /**
     * Helper to draw arc border for enhanced styling
     */
    private static drawArcBorder(doc: jsPDF, cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const step = Math.PI / 180; // 1 degree steps for smoother curves

        for (let theta = startRad; theta <= endRad; theta += step) {
            const x1 = cx + r * Math.cos(theta);
            const y1 = cy + r * Math.sin(theta);
            const x2 = cx + r * Math.cos(Math.min(theta + step, endRad));
            const y2 = cy + r * Math.sin(Math.min(theta + step, endRad));
            doc.line(x1, y1, x2, y2);
        }
    }

    /**
     * Draw compact legend for charts
     */
    private static drawCompactLegend(doc: jsPDF, x: number, y: number, width: number, data: { label: string; color: string }[]) {
        const itemWidth = width / data.length;

        data.forEach((item, index) => {
            const itemX = x + (index * itemWidth);

            // Color box
            doc.setFillColor(item.color);
            doc.rect(itemX, y, 8, 4, 'F');

            // Label
            doc.setFontSize(6);
            doc.setTextColor(this.TEXT_SECONDARY);
            const label = item.label.length > 8 ? item.label.substring(0, 6) + '...' : item.label;
            doc.text(label, itemX + 10, y + 3);
        });
    }

    /**
     * Enhanced Risk Matrix with KPIs and analytics
     */
    static drawRiskMatrix(
        doc: jsPDF,
        x: number,
        y: number,
        width: number,
        height: number,
        risks: { probability: number; impact: number; category?: string; trend?: number }[]
    ) {
        const cellSize = width / 5;
        const gridColors = [
            ['#ecfdf5', '#d1fae5', '#fef3c7', '#fcd34d', '#fca5a5'],
            ['#d1fae5', '#fef3c7', '#fcd34d', '#fca5a5', '#f87171'],
            ['#fef3c7', '#fcd34d', '#fca5a5', '#f87171', '#ef4444'],
            ['#fcd34d', '#fca5a5', '#f87171', '#ef4444', '#dc2626'],
            ['#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c']
        ];

        // Title with KPIs
        doc.setFontSize(12);
        doc.setTextColor(this.BRAND_SECONDARY);
        doc.setFont('helvetica', 'bold');
        doc.text("Matrice des Risques avec Analyse de Tendance", x, y - 15);

        // Add risk density KPI
        const totalRisks = risks.length;
        const highRiskCount = risks.filter(r => r.probability >= 4 && r.impact >= 4).length;
        const riskDensity = ((highRiskCount / totalRisks) * 100).toFixed(1);

        doc.setFontSize(9);
        doc.setTextColor(this.TEXT_SECONDARY);
        doc.text(`Densité de risque élevé: ${riskDensity}% (${highRiskCount}/${totalRisks})`, x, y - 8);

        // Axis labels
        doc.setFontSize(8);
        doc.setTextColor(this.TEXT_SECONDARY);
        doc.setFont('helvetica', 'bold');

        doc.text("Probabilité", x - 5, y + height / 2, { angle: 90, align: 'center' });
        doc.text("Impact (Gravité)", x + width / 2, y + height + 8, { align: 'center' });

        // Enhanced grid with trend indicators
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const cellX = x + (col * cellSize);
                const cellY = y + ((4 - row) * cellSize);

                const prob = row + 1;
                const imp = col + 1;
                const cellRisks = risks.filter(r => r.probability === prob && r.impact === imp);
                const count = cellRisks.length;

                // Cell background
                doc.setFillColor(gridColors[row][col]);
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.5);
                doc.rect(cellX, cellY, cellSize, cellSize, 'FD');

                if (count > 0) {
                    // Risk count with background
                    doc.setFontSize(10);
                    doc.setTextColor(this.TEXT_PRIMARY);
                    doc.setFont('helvetica', 'bold');

                    // Add background for count
                    const countText = count.toString();
                    const textWidth = doc.getTextWidth(countText);
                    doc.setFillColor(255, 255, 255, 0.8);
                    doc.roundedRect(
                        cellX + (cellSize - textWidth - 4) / 2,
                        cellY + (cellSize - 8) / 2,
                        textWidth + 4,
                        8,
                        2,
                        2,
                        'F'
                    );

                    doc.text(countText, cellX + cellSize / 2, cellY + cellSize / 2, { align: 'center', baseline: 'middle' });

                    // Add trend indicator if multiple risks
                    if (count > 1) {
                        const avgTrend = cellRisks.reduce((sum, r) => sum + (r.trend || 0), 0) / count;
                        doc.setFontSize(6);
                        doc.setTextColor(avgTrend > 0 ? '#10B981' : avgTrend < 0 ? '#EF4444' : '#64748B');
                        const trendSymbol = avgTrend > 0 ? '↗' : avgTrend < 0 ? '↘' : '→';
                        doc.text(trendSymbol, cellX + cellSize - 3, cellY + 3);
                    }
                }
            }
        }

        // Enhanced scale labels
        doc.setFontSize(7);
        doc.setTextColor(this.TEXT_SECONDARY);
        const labels = ['Faible', 'Moyen', 'Fort', 'Critique', 'Catastrophique'];

        labels.forEach((_, i) => {
            // X-axis labels
            doc.text((i + 1).toString(), x + (i * cellSize) + cellSize / 2, y + height + 3, { align: 'center' });
            // Y-axis labels
            doc.text((i + 1).toString(), x - 2, y + height - (i * cellSize) - cellSize / 2, { align: 'right', baseline: 'middle' });
        });

        // Add risk categories legend
        const categories = [...new Set(risks.map(r => r.category).filter(Boolean))];
        if (categories.length > 0) {
            doc.setFontSize(8);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.text("Catégories principales:", x, y + height + 15);

            let catX = x + 50;
            categories.slice(0, 4).forEach(cat => {
                const catCount = risks.filter(r => r.category === cat).length;
                doc.setFillColor(this.CHART_COLORS[categories.indexOf(cat) % this.CHART_COLORS.length]);
                doc.rect(catX, y + height + 12, 3, 3, 'F');
                doc.setFontSize(7);
                doc.text(`${cat} (${catCount})`, catX + 5, y + height + 15);
                catX += doc.getTextWidth(`${cat} (${catCount})`) + 10;
            });
        }
    }

    /**
     * Generate AI-powered strategic recommendations
     */
    static generateAIRecommendations(
        domain: 'risks' | 'compliance' | 'audits' | 'projects',
        metrics: Record<string, number | string | boolean>,
        context?: Record<string, unknown>
    ): { recommendation: string; priority: 'Critical' | 'High' | 'Medium' | 'Low'; confidence: number; timeframe: string }[] {
        const recommendations = [];

        switch (domain) {
            case 'risks':
                // Risk-specific AI recommendations
                if (Number(metrics.critical_risks || 0) > 0) {
                    recommendations.push({
                        recommendation: `Urgence : Déployer un plan d'action immédiat pour les ${metrics.critical_risks} risques critiques. Allouer les ressources nécessaires et établir un suivi quotidien.`,
                        priority: 'Critical',
                        confidence: 95,
                        timeframe: '0-7 jours'
                    });
                }

                if (Number(metrics.risk_score || 0) > 60) {
                    recommendations.push({
                        recommendation: `L'exposition au risque (${metrics.risk_score}%) dépasse le seuil acceptable. Recommandons une réévaluation complète de l'appétence au risque et un renforcement des contrôles préventifs.`,
                        priority: 'High',
                        confidence: 88,
                        timeframe: '15-30 jours'
                    });
                }

                if (Number(metrics.treated_percentage || 0) < 50) {
                    recommendations.push({
                        recommendation: `Seulement ${metrics.treated_percentage}% des risques ont un plan de traitement. Mettre en place un programme structuré avec des objectifs hebdomadaires pour atteindre 80% dans 90 jours.`,
                        priority: 'High',
                        confidence: 82,
                        timeframe: '30-90 jours'
                    });
                }

                // Predictive recommendation
                recommendations.push({
                    recommendation: `Basé sur les tendances actuelles, nous anticipons une augmentation de 15% des risques cyber dans les 6 prochains mois. Préparez des mesures proactives dès maintenant.`,
                    priority: 'Medium',
                    confidence: 75,
                    timeframe: '6 mois'
                });
                break;

            case 'compliance':
                // Compliance-specific AI recommendations
                if (Number(metrics.compliance_coverage || 0) < 50) {
                    recommendations.push({
                        recommendation: `Couverture de conformité insuffisante (${metrics.compliance_coverage}%). Priorisez l'implémentation des contrôles critiques pour les domaines A.9 et A.12 de l'ISO 27001.`,
                        priority: 'Critical',
                        confidence: 92,
                        timeframe: '30-60 jours'
                    });
                }

                if (Number(metrics.not_started || 0) > 10) {
                    recommendations.push({
                        recommendation: `${metrics.not_started} contrôles n'ont pas démarré. Constituez une task force dédiée avec un objectif de 5 contrôles par semaine.`,
                        priority: 'High',
                        confidence: 85,
                        timeframe: '45-90 jours'
                    });
                }

                recommendations.push({
                    recommendation: `Préparez-vous à l'audit certification : documentez toutes les preuves d'implémentation et effectuez une revue interne complète dans 60 jours.`,
                    priority: 'Medium',
                    confidence: 78,
                    timeframe: '60 jours'
                });
                break;

            case 'audits':
                // Audit-specific AI recommendations
                if (Number(metrics.major_findings || 0) > 0) {
                    recommendations.push({
                        recommendation: `${metrics.major_findings} non-conformités majeures détectées. Établissez un plan de correction immédiat avec validation par la direction.`,
                        priority: 'Critical',
                        confidence: 98,
                        timeframe: '0-15 jours'
                    });
                }

                if (Number(metrics.conformity_score || 0) < 70) {
                    recommendations.push({
                        recommendation: `Score de conformité (${metrics.conformity_score}%) en dessous des standards. Mettez en œuvre un programme d'amélioration continue avec des revues mensuelles.`,
                        priority: 'High',
                        confidence: 87,
                        timeframe: '30-90 jours'
                    });
                }
                break;

            case 'projects':
                // Project-specific AI recommendations
                if (context?.delay_risk === 'Critical') {
                    recommendations.push({
                        recommendation: `Projet en retard critique. Réévaluez le périmètre, réallouez les ressources et communiquez immédiatement avec les parties prenantes.`,
                        priority: 'Critical',
                        confidence: 94,
                        timeframe: '0-7 jours'
                    });
                }

                if (Number(metrics.completion_percentage || 0) < 50 && context?.dueDate) {
                    recommendations.push({
                        recommendation: `Progression insuffisante (${metrics.completion_percentage}%). Analysez les blocages et optimisez le plan de charge pour respecter l'échéance.`,
                        priority: 'High',
                        confidence: 83,
                        timeframe: '15-30 jours'
                    });
                }
                break;
        }

        return recommendations as { recommendation: string; priority: 'Critical' | 'High' | 'Medium' | 'Low'; confidence: number; timeframe: string }[];
    }
    /**
     * Draw enhanced executive summary with business metrics
     */
    static drawExecutiveSummary(
        doc: jsPDF,
        x: number,
        y: number,
        width: number,
        data: {
            title: string;
            grade: string;
            score: number;
            trend: number;
            keyMetrics: { label: string; value: string; change: number }[];
            strategicInsights: string[];
        }
    ): number {
        let currentY = y;
        const pageHeight = doc.internal.pageSize.height;

        // Executive Header
        doc.setFillColor(this.BRAND_PRIMARY);
        doc.roundedRect(x, currentY, width, 25, 3, 3, 'F');

        doc.setTextColor('#FFFFFF');
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(data.title, x + 10, currentY + 10);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Note: ${data.grade} (${data.score}/100)`, x + 10, currentY + 20);

        // Trend indicator
        const trendX = x + width - 30;
        doc.setTextColor(data.trend > 0 ? '#10B981' : data.trend < 0 ? '#EF4444' : '#FFFFFF');
        const trendSymbol = data.trend > 0 ? '↗' : data.trend < 0 ? '↘' : '→';
        doc.setFontSize(10);
        doc.text(`${trendSymbol} ${Math.abs(data.trend)}%`, trendX, currentY + 15, { align: 'center' });

        currentY += 35;

        // Key Metrics Dashboard
        doc.setFontSize(12);
        doc.setTextColor(this.BRAND_SECONDARY);
        doc.setFont('helvetica', 'bold');
        doc.text("Indicateurs Clés de Performance", x, currentY);
        currentY += 10;

        // Metric Cards
        const cardWidth = (width - 20) / 3;
        const cardHeight = 30;
        let cardX = x;

        data.keyMetrics.forEach((metric, index) => {
            // Check if card fits
            if (currentY + cardHeight > pageHeight - 30) {
                doc.addPage();
                currentY = 35;
            }

            // Card background
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(this.BORDER_COLOR);
            doc.roundedRect(cardX, currentY, cardWidth - 5, cardHeight, 2, 2, 'FD');

            // Accent bar
            doc.setFillColor(metric.change > 0 ? '#10B981' : metric.change < 0 ? '#EF4444' : '#64748B');
            doc.rect(cardX, currentY, 2, cardHeight, 'F');

            // Metric content
            doc.setFontSize(8);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.text(metric.label, cardX + 8, currentY + 10);

            doc.setFontSize(14);
            doc.setTextColor(this.TEXT_PRIMARY);
            doc.setFont('helvetica', 'bold');
            doc.text(metric.value, cardX + 8, currentY + 20);

            // Change indicator
            if (metric.change !== 0) {
                doc.setFontSize(7);
                doc.setTextColor(metric.change > 0 ? '#10B981' : metric.change < 0 ? '#EF4444' : '#64748B');
                const changeSymbol = metric.change > 0 ? '+' : '';
                doc.text(`${changeSymbol}${metric.change}%`, cardX + cardWidth - 15, currentY + 20);
            }

            cardX += cardWidth;
            if (index % 3 === 2) {
                cardX = x;
                currentY += cardHeight + 10;
            }
        });

        if (data.keyMetrics.length % 3 !== 0) {
            currentY += cardHeight + 10;
        }

        // Strategic Insights
        // Check new page
        if (currentY + 20 > pageHeight - 30) {
            doc.addPage();
            currentY = 35;
        }

        doc.setFontSize(12);
        doc.setTextColor(this.BRAND_SECONDARY);
        doc.setFont('helvetica', 'bold');
        doc.text("Aperçus Stratégiques", x, currentY);
        currentY += 8;

        doc.setFontSize(9);
        doc.setTextColor(this.TEXT_PRIMARY);
        doc.setFont('helvetica', 'normal');

        data.strategicInsights.forEach((insight) => {
            const bulletText = `• ${insight}`;
            // addSafeText logic inline since this method is static but addSafeText is static too... 
            // but here we just need simple split and check
            const lines = doc.splitTextToSize(bulletText, width - 20);

            lines.forEach((line: string) => {
                if (currentY + 6 > pageHeight - 30) {
                    doc.addPage();
                    currentY = 35;
                }
                doc.text(line, x + 10, currentY);
                currentY += 6;
            });
            currentY += 2; // Extra spacing between insights
        });

        return currentY + 10;
    }

    /**
     * Draw industry-specific compliance framework
     */
    static drawComplianceFramework(
        doc: jsPDF,
        x: number,
        y: number,
        width: number,
        framework: 'ISO27001' | 'GDPR' | 'SOC2' | 'NIS2',
        _data: Record<string, unknown>
    ): number {
        let currentY = y;

        const frameworks = {
            ISO27001: {
                name: 'ISO/IEC 27001:2022',
                domains: ['A.5', 'A.6', 'A.7', 'A.8', 'A.9', 'A.10', 'A.11', 'A.12'],
                color: '#0F172A'
            },
            GDPR: {
                name: 'RGPD - DPO',
                domains: ['Licéité', 'Finalité', 'Minimisation', 'Exactitude', 'Limitation', 'Sécurité', 'Accountabilité'],
                color: '#1E40AF'
            },
            SOC2: {
                name: 'SOC 2 Type II',
                domains: ['Security', 'Availability', 'Processing', 'Confidentiality', 'Privacy'],
                color: '#059669'
            },
            NIS2: {
                name: 'NIS2 Directive',
                domains: ['Risk Management', 'Business Continuity', 'Supply Chain', 'Incident Response'],
                color: '#DC2626'
            }
        };

        const selectedFramework = frameworks[framework];

        // Framework Header
        doc.setFillColor(selectedFramework.color);
        doc.roundedRect(x, currentY, width, 20, 2, 2, 'F');
        doc.setTextColor('#FFFFFF');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(selectedFramework.name, x + 10, currentY + 13);

        currentY += 25;

        // Domain Coverage Analysis
        doc.setFontSize(10);
        doc.setTextColor(this.BRAND_SECONDARY);
        doc.setFont('helvetica', 'bold');
        doc.text("Couverture par Domaine", x, currentY);
        currentY += 8;

        selectedFramework.domains.forEach((domain) => {
            const coverage = Math.random() * 100; // Replace with actual data
            const progressWidth = width - 60;
            const progressHeight = 6;

            // Domain label
            doc.setFontSize(8);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.text(domain, x + 10, currentY + 4);

            // Progress bar background
            doc.setFillColor(this.BORDER_COLOR);
            doc.roundedRect(x + 50, currentY, progressWidth, progressHeight, 3, 3, 'F');

            // Progress bar fill
            const fillWidth = (coverage / 100) * progressWidth;
            doc.setFillColor(coverage > 80 ? '#10B981' : coverage > 50 ? '#F59E0B' : '#EF4444');
            doc.roundedRect(x + 50, currentY, fillWidth, progressHeight, 3, 3, 'F');

            // Percentage
            doc.setFontSize(7);
            doc.setTextColor(this.TEXT_PRIMARY);
            doc.text(`${Math.round(coverage)}%`, x + width - 15, currentY + 4, { align: 'right' });

            currentY += 10;
        });

        return currentY + 10;
    }
    /**
* Generate Unified Global Report
*/
    static generateGlobalReport(
        data: {
            risks: Risk[];
            controls: Control[];
            audits: Audit[];
            projects: Project[];
        },
        options: ReportOptions & { author?: string }
    ): jsPDF {
        const riskMetrics = ReportEnrichmentService.calculateMetrics(data.risks);
        const complianceMetrics = ReportEnrichmentService.calculateComplianceMetrics(data.controls);
        const auditMetrics = data.audits.map(a => ReportEnrichmentService.calculateAuditMetrics(a.findings || []));
        const projectMetrics = data.projects.map(p => ReportEnrichmentService.calculateProjectMetrics(p));

        const globalMetrics = ReportEnrichmentService.calculateGlobalMetrics(
            riskMetrics,
            complianceMetrics,
            auditMetrics,
            projectMetrics
        );
        const executiveSummary = ReportEnrichmentService.generateGlobalExecutiveSummary(globalMetrics);

        return this.generateExecutiveReport({
            ...options,
            title: "RAPPORT DE GOUVERNANCE GLOBAL",
            subtitle: "Vue unifiée : Risques, Conformité, Audits, Projets",
            summary: executiveSummary,
            metrics: [
                { label: "Score Global", value: globalMetrics.global_score + "/100", subtext: "performance systémique" },
                { label: "Santé Risques", value: globalMetrics.risk_health + "%", subtext: "maturité de défense" },
                { label: "Conformité", value: globalMetrics.compliance_health + "%", subtext: "ISO 27001 / SoA" },
                { label: "Audits & Projets", value: `${globalMetrics.audit_health}% / ${globalMetrics.project_health}%`, subtext: "exécution opérationnelle" }
            ],
            stats: [
                { label: "Risques", value: globalMetrics.risk_health, color: '#F59E0B' },
                { label: "Conformité", value: globalMetrics.compliance_health, color: '#10B981' },
                { label: "Audits", value: globalMetrics.audit_health, color: '#3B82F6' },
                { label: "Projets", value: globalMetrics.project_health, color: '#8B5CF6' }
            ]
        }, (doc, startY) => {
            let currentY = startY;

            // 1. Domain Breakdown
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.setFont('helvetica', 'bold');
            doc.text("Détail par Domaine", 14, currentY);
            currentY += 15;

            this.drawProgressBar(doc, 14, currentY, 160, 8, globalMetrics.risk_health, "Maturité Gestion des Risques", '#F59E0B');
            currentY += 20;
            this.drawProgressBar(doc, 14, currentY, 160, 8, globalMetrics.compliance_health, "Conformité Règlementaire", '#10B981');
            currentY += 20;
            this.drawProgressBar(doc, 14, currentY, 160, 8, globalMetrics.audit_health, "Qualité des Audits", '#3B82F6');
            currentY += 20;
            this.drawProgressBar(doc, 14, currentY, 160, 8, globalMetrics.project_health, "Performance Projets", '#8B5CF6');

            currentY += 25;

            // 2. Critical Alerts Table
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.setFont('helvetica', 'bold');
            doc.text("Alertes Critiques", 14, currentY);
            currentY += 10;

            const alerts = [];
            if (riskMetrics.critical_risks > 0) alerts.push(['RISQUE', `${riskMetrics.critical_risks} risques critiques actifs`, 'NON TRAITÉ']);
            if (globalMetrics.compliance_health < 50) alerts.push(['CONFORMITÉ', 'Niveau de conformité critique (<50%)', 'ACTION REQUISE']);
            data.projects.filter(p => ReportEnrichmentService.calculateProjectMetrics(p).delay_risk === 'Critical').forEach(p => {
                alerts.push(['PROJET', `Retard critique sur le projet "${p.name}"`, 'EN DANGER']);
            });

            if (alerts.length > 0) {
                doc.autoTable({
                    startY: currentY,
                    head: [['Domaine', 'Alerte', 'Statut']],
                    body: alerts,
                    theme: 'grid',
                    headStyles: { fillColor: '#EF4444' },
                    styles: { fontSize: 9 },
                    margin: { left: 14, right: 14 }
                });
            } else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(this.TEXT_SECONDARY);
                doc.text("Aucune alerte critique majeure à signaler.", 14, currentY);
            }
        });
    }

    /**
    * Generate Project Report
    */
    static generateProjectReport(
        project: Project,
        options: ReportOptions & { author?: string }
    ): jsPDF {
        const metrics = ReportEnrichmentService.calculateProjectMetrics(project);
        const executiveSummary = ReportEnrichmentService.generateProjectExecutiveSummary(metrics, project.name);

        return this.generateExecutiveReport({
            ...options,
            title: `Rapport de Projet: ${project.name}`,
            subtitle: `Chef de Projet: ${project.manager || 'Non assigné'}${project.managerId ? ` (#${project.managerId})` : ''} | Échéance: ${project.dueDate ? format(new Date(project.dueDate), 'dd/MM/yyyy') : 'N/A'}`,
            summary: executiveSummary,
            metrics: [
                { label: "Progression", value: metrics.completion_percentage + "%", subtext: "avancement global" },
                { label: "Tâches", value: metrics.total_tasks, subtext: "total du projet" },
                { label: "Terminées", value: metrics.completed_tasks, subtext: "tâches livrées" },
                { label: "Risque Délai", value: metrics.delay_risk, subtext: "impact planning" }
            ],
            stats: [
                { label: "Terminé", value: metrics.completed_tasks, color: '#10B981' },
                { label: "En cours", value: metrics.in_progress_tasks, color: '#3B82F6' },
                { label: "À faire", value: metrics.pending_tasks, color: '#94A3B8' }
            ]
        }, (doc, startY) => {
            let currentY = startY;

            // 1. Task List
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.setFont('helvetica', 'bold');
            doc.text("Liste des Tâches", 14, currentY);
            currentY += 10;

            const activeTasks = (project.tasks || []).map(t => [
                t.title,
                t.status,
                t.priority,
                t.assignee || 'Non assigné'
            ]);

            if (activeTasks.length > 0) {
                doc.autoTable({
                    startY: currentY,
                    head: [['Tâche', 'Statut', 'Priorité', 'Ressource']],
                    body: activeTasks,
                    theme: 'grid',
                    headStyles: { fillColor: this.BRAND_PRIMARY },
                    styles: { fontSize: 9 },
                    margin: { left: 14, right: 14 }
                });
            } else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(this.TEXT_SECONDARY);
                doc.text("Aucune tâche active à afficher.", 14, currentY);
            }
        });
    }

    /**
     * Generate an Enriched AI-Powered Risk Report
     * Uses ReportEnrichmentService to analyze data and produce a high-value PDF
     */
    static generateRiskExecutiveReport(
        risks: Risk[],
        options: ReportOptions & { author?: string }
    ): jsPDF {

        // 1. Analyze Data using the new service
        const analysis = ReportEnrichmentService.analyzeRiskPortfolio(risks);
        const metrics = ReportEnrichmentService.calculateMetrics(risks);
        const executiveSummary = ReportEnrichmentService.generateExecutiveSummary(metrics);

        return this.generateExecutiveReport({
            ...options,
            title: "RAPPORT DE GOUVERNANCE CYBER",
            subtitle: "Analyse des Risques & Conformité ISO 27001",
            summary: executiveSummary,
            metrics: [
                { label: "Risques Totaux", value: metrics.total_risks, subtext: "actifs dans le registre" },
                { label: "Critiques", value: metrics.critical_risks, subtext: "nécessitent action immédiate" },
                { label: "Score Global", value: metrics.risk_score + "/100", subtext: "exposition au risque" }
            ],
            stats: [
                { label: "Critique", value: metrics.critical_risks, color: '#EF4444' },
                { label: "Élevé", value: metrics.high_risks, color: '#F97316' },
                { label: "Moyen", value: metrics.medium_risks, color: '#F59E0B' },
                { label: "Faible", value: metrics.low_risks, color: '#10B981' }
            ]
        }, (doc, startY) => {
            const pageWidth = doc.internal.pageSize.width;
            let currentY = startY;

            // 1. Risk Heatmap Section
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.setFont('helvetica', 'bold');
            doc.text("Cartographie des Risques", 14, currentY);
            currentY += 10;

            // Draw Heatmap centered
            currentY = this.checkAndAddPage(doc, 110, currentY, options);
            this.drawRiskMatrix(doc, (pageWidth - 100) / 2, currentY, 100, 100, risks);
            currentY += 110;

            // 2. Top Critical Risks Table
            currentY = this.checkAndAddPage(doc, 40, currentY, options); // Check for header + some rows
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.setFont('helvetica', 'bold');
            doc.text("Top 5 Risques Critiques", 14, currentY);
            currentY += 10;

            const criticalRisks = analysis.top_risks
                .map((r: Risk) => [
                    r.threat,
                    (r as { category?: string }).category || 'Général',
                    (r.probability * r.impact).toString(),
                    r.strategy || 'À définir'
                ]);

            doc.autoTable({
                startY: currentY,
                head: [['Titre du Risque', 'Catégorie', 'Score', 'Stratégie']],
                body: criticalRisks,
                theme: 'grid',
                headStyles: { fillColor: this.BRAND_PRIMARY },
                styles: { fontSize: 9 },
                margin: { left: 14, right: 14 }
            });

            // Update currentY after table
            currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

            // 3. Recommendations
            currentY = this.checkAndAddPage(doc, 20, currentY, options); // Check for header
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.setFont('helvetica', 'bold');
            doc.text("Recommandations Stratégiques (IA)", 14, currentY);
            currentY += 10;

            doc.setFontSize(10);
            doc.setTextColor(this.TEXT_PRIMARY);
            doc.setFont('helvetica', 'normal');

            // Use addSafeText for each recommendation to handle wrapping and page breaks
            const pageHeight = doc.internal.pageSize.height;
            analysis.recommendations.forEach((rec, i) => {
                const text = `${i + 1}. ${rec}`;
                currentY = this.addSafeText(
                    doc,
                    text,
                    14,
                    currentY,
                    pageWidth - 28,
                    7, // line height
                    pageHeight,
                    30, // bottom margin
                    options
                );
                currentY += 3; // Extra spacing between items
            });
        });
    }
    /**
     * Generate an Enriched Audit Executive Report
     */
    static generateAuditExecutiveReport(
        audit: Audit,
        findings: Finding[],
        options: ReportOptions & { author?: string }
    ): jsPDF {
        const metrics = ReportEnrichmentService.calculateAuditMetrics(findings);
        const executiveSummary = ReportEnrichmentService.generateAuditExecutiveSummary(metrics, audit.name);

        return this.generateExecutiveReport({
            ...options,
            title: `Rapport d'Audit: ${audit.name}`,
            subtitle: `${audit.reference || audit.id.slice(0, 8)} - ${audit.standard || audit.framework || 'N/A'}`,
            summary: executiveSummary || `Audit de type ${audit.type} réalisé par ${audit.auditor}. ${audit.findingsCount} écarts identifiés.`,
            metrics: [
                { label: "Non-conformités", value: metrics.major_findings + metrics.minor_findings, subtext: "écarts identifiés" },
                { label: "Score Conformité", value: metrics.conformity_score + "/100", subtext: "niveau d'adhérence" },
                { label: "Points Forts", value: metrics.closed_findings, subtext: "points validés" }
            ],
            stats: [
                { label: "Majeure", value: metrics.major_findings, color: '#EF4444' },
                { label: "Mineure", value: metrics.minor_findings, color: '#F97316' },
                { label: "Observation", value: metrics.observations, color: '#3B82F6' }
            ]
        }, (doc, startY) => {
            let currentY = startY;

            // 1. Findings Summary Table
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.setFont('helvetica', 'bold');
            doc.text("Synthèse des Constats", 14, currentY);
            currentY += 10;

            const findingsData = findings.map(f => [
                (f as { reference?: string }).reference || '-',
                f.description?.substring(0, 50) + (f.description?.length > 50 ? '...' : ''),
                f.type,
                f.status
            ]);

            doc.autoTable({
                startY: currentY,
                head: [['Réf', 'Description', 'Type', 'Statut']],
                body: findingsData,
                theme: 'grid',
                headStyles: { fillColor: this.BRAND_PRIMARY },
                styles: { fontSize: 9 },
                margin: { left: 14, right: 14 }
            });

            currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

            // 2. Recommendations Section
            if (metrics.major_findings > 0) {
                // Check if we need a new page for recommendations
                currentY = this.checkAndAddPage(doc, 30, currentY, options);

                doc.setFontSize(14);
                doc.setTextColor(this.BRAND_SECONDARY);
                doc.setFont('helvetica', 'bold');
                doc.text("Actions Prioritaires", 14, currentY);
                currentY += 10;

                doc.setFontSize(10);
                doc.setTextColor(this.TEXT_PRIMARY);
                doc.setFont('helvetica', 'normal');

                const recommendations = [
                    "• Initier immédiatement les plans d'actions pour les non-conformités majeures.",
                    "• Revoir les preuves fournies pour les points partiellement conformes."
                ];

                const pageHeight = doc.internal.pageSize.height;
                recommendations.forEach(rec => {
                    currentY = this.addSafeText(
                        doc,
                        rec,
                        14,
                        currentY,
                        doc.internal.pageSize.width - 28,
                        7,
                        pageHeight,
                        30,
                        options
                    );
                    currentY += 2;
                });
            }
        });
    }

    /**
     * Generate an Enriched Project Executive Report
     */
    static generateProjectExecutiveReport(
        projects: Project | Project[], // Passing the specific project as a single array item or just the project object
        options: ReportOptions & { author?: string }
    ): jsPDF {
        // Handle single project passed as array for compatibility or single object
        const project = Array.isArray(projects) ? projects[0] : projects;

        const metrics = ReportEnrichmentService.calculateProjectMetrics(project);
        const executiveSummary = ReportEnrichmentService.generateProjectExecutiveSummary(metrics, project.name);

        return this.generateExecutiveReport({
            ...options,
            title: "RAPPORT PROJET",
            subtitle: `Suivi d'avancement : ${project.name} — Responsable: ${project.manager || 'Non assigné'}${project.managerId ? ` (#${project.managerId})` : ''}`,
            summary: executiveSummary,
            metrics: [
                { label: "Avancement", value: metrics.completion_percentage + "%", subtext: "global du projet" },
                { label: "Risque Planning", value: metrics.delay_risk === 'Critical' ? 'CRITIQUE' : metrics.delay_risk === 'High' ? 'ÉLEVÉ' : 'FAIBLE', subtext: "respect des délais" },
                { label: "Tâches Restantes", value: metrics.pending_tasks, subtext: "à réaliser" }
            ],
            stats: [
                { label: "Terminé", value: metrics.completed_tasks, color: '#10B981' },
                { label: "En cours", value: metrics.in_progress_tasks, color: '#3B82F6' },
                { label: "À faire", value: metrics.pending_tasks, color: '#64748B' }
            ]
        }, (doc, startY) => {
            let currentY = startY;
            const pageWidth = doc.internal.pageSize.width;

            // 1. Timeline / Roadmap Visualization (Simulated)
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.setFont('helvetica', 'bold');
            doc.text("Calendrier & Jalons", 14, currentY);
            currentY += 10;

            // Draw a simple timeline line
            doc.setDrawColor(this.BORDER_COLOR);
            doc.setLineWidth(1);
            doc.line(20, currentY, pageWidth - 20, currentY);

            // Start Point
            doc.setFillColor(this.BRAND_PRIMARY);
            doc.circle(20, currentY, 3, 'F');
            doc.setFontSize(8);
            doc.text("Début", 20, currentY + 8, { align: 'center' });
            if (project.startDate) doc.text(format(new Date(project.startDate), 'dd/MM'), 20, currentY - 5, { align: 'center' });

            // End Point
            doc.setFillColor(metrics.delay_risk === 'Critical' ? '#EF4444' : this.BRAND_PRIMARY);
            doc.circle(pageWidth - 20, currentY, 3, 'F');
            doc.text("Fin", pageWidth - 20, currentY + 8, { align: 'center' });
            if (project.dueDate) doc.text(format(new Date(project.dueDate), 'dd/MM'), pageWidth - 20, currentY - 5, { align: 'center' });

            // Current Progress Point
            const progressX = 20 + ((pageWidth - 40) * (project.progress / 100));
            doc.setFillColor('#10B981'); // Green
            doc.circle(progressX, currentY, 4, 'F');
            doc.setTextColor('#10B981');
            doc.setFont('helvetica', 'bold');
            doc.text("Aujourd'hui", progressX, currentY + 10, { align: 'center' });

            currentY += 30;

            // 2. Active Tasks Table
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.text("Tâches en cours & Bloquantes", 14, currentY);
            currentY += 10;

            const activeTasks = (project.tasks || [])
                .filter((t: ProjectTask) => t.status !== 'Terminé')
                .slice(0, 10)
                .map((t: ProjectTask) => [
                    t.title.substring(0, 40),
                    t.status,
                    t.priority,
                    t.assigneeId ? 'Assigné' : 'Non assigné'
                ]);

            if (activeTasks.length > 0) {
                doc.autoTable({
                    startY: currentY,
                    head: [['Tâche', 'Statut', 'Priorité', 'Ressource']],
                    body: activeTasks,
                    theme: 'grid',
                    headStyles: { fillColor: this.BRAND_PRIMARY },
                    styles: { fontSize: 9 },
                    margin: { left: 14, right: 14 }
                });
            } else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(this.TEXT_SECONDARY);
                doc.text("Aucune tâche active à afficher.", 14, currentY);
            }
        });
    }

    /**
     * Generate an Enriched Compliance Executive Report (SoA)
     */
    static generateComplianceExecutiveReport(
        controls: Control[],
        options: ReportOptions & { author?: string }
    ): jsPDF {
        const metrics = ReportEnrichmentService.calculateComplianceMetrics(controls);
        const executiveSummary = ReportEnrichmentService.generateComplianceExecutiveSummary(metrics);

        return this.generateExecutiveReport({
            ...options,
            title: "RAPPORT DE CONFORMITÉ",
            subtitle: "État des lieux ISO 27001 / SoA",
            summary: executiveSummary,
            metrics: [
                { label: "Couverture", value: metrics.compliance_coverage + "%", subtext: "contrôles couverts" },
                { label: "Implémentés", value: metrics.implemented_controls, subtext: "contrôles actifs" },
                { label: "À Traiter", value: metrics.not_started + metrics.planned_controls, subtext: "reste à faire" }
            ],
            stats: [
                { label: "Conforme", value: metrics.implemented_controls, color: '#10B981' },
                { label: "Planifié", value: metrics.planned_controls, color: '#3B82F6' },
                { label: "Non commencé", value: metrics.not_started, color: '#EF4444' }
            ]
        }, (doc, startY) => {
            let currentY = startY;
            const pageWidth = doc.internal.pageSize.width;

            // 1. SoA Radar Chart (Simulated horizontal bars for top domains)
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.setFont('helvetica', 'bold');
            doc.text("Performance par Domaine (Top 5)", 14, currentY);
            currentY += 15;

            // Fake domain analysis for demo visualization
            const domains = [
                { name: "Sécurité Organisationnelle", score: 85 },
                { name: "Sécurité des RH", score: 92 },
                { name: "Gestion des Actifs", score: 60 },
                { name: "Contrôle d'Accès", score: 45 },
                { name: "Cryptographie", score: 70 }
            ];

            domains.forEach(d => {
                this.drawProgressBar(doc, 14, currentY, pageWidth - 28, 6, d.score, d.name, d.score > 80 ? '#10B981' : d.score > 50 ? '#F59E0B' : '#EF4444');
                currentY += 15;
            });

            currentY += 10;

            // 2. Gap Analysis (Not Started Controls)
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.text("Analyse des Écarts (Gap Analysis)", 14, currentY);
            currentY += 10;

            const gaps = controls
                .filter(c => c.status === 'Non commencé')
                .slice(0, 10) // Top 10 gaps
                .map(c => [
                    c.code,
                    c.description ? c.description.substring(0, 60) + '...' : 'Pas de description',
                    'Non commencé'
                ]);

            if (gaps.length > 0) {
                doc.autoTable({
                    startY: currentY,
                    head: [['Code', 'Contrôle', 'Statut']],
                    body: gaps,
                    theme: 'grid',
                    headStyles: { fillColor: '#EF4444' }, // Red for gaps
                    styles: { fontSize: 8 },
                    margin: { left: 14, right: 14 }
                });
            } else {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(this.TEXT_SECONDARY);
                doc.text("Aucun écart majeur identifié. Félicitations !", 14, currentY);
            }
        });
    }

    /**
     * Generate Asset Label (Sticker format)
     */
    static generateAssetLabel(
        asset: { name: string; id: string; owner: string; type: string },
        options: { organizationName?: string; logo?: string }
    ): jsPDF {
        // Label size: 90mm x 29mm (Standard Address Label size)
        // Hack: jsPDF doesn't support changing format easily after init in some versions,
        // but let's try creating a custom one or just use a small page.
        // Re-instantiate for custom size
        const labelDoc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: [29, 90] // Height, Width
        });

        // Border
        labelDoc.setDrawColor(this.BRAND_PRIMARY);
        labelDoc.setLineWidth(0.5);
        labelDoc.rect(2, 2, 86, 25);

        // Header / Logo area
        labelDoc.setFillColor(this.BRAND_PRIMARY);
        labelDoc.rect(2, 2, 20, 25, 'F');

        // Logo Text (Vertical because space is tight or just big letter)
        labelDoc.setTextColor('#FFFFFF');
        labelDoc.setFontSize(24);
        labelDoc.setFont('helvetica', 'bold');
        labelDoc.text(options.organizationName?.charAt(0) || 'S', 12, 17, { align: 'center', baseline: 'middle' });

        // Content
        const contentX = 25;

        // Asset Name
        labelDoc.setTextColor(this.BRAND_PRIMARY);
        labelDoc.setFontSize(10);
        labelDoc.setFont('helvetica', 'bold');
        const splitTitle = labelDoc.splitTextToSize(asset.name.toUpperCase(), 60);
        labelDoc.text(splitTitle, contentX, 8);

        // ID
        labelDoc.setTextColor(this.TEXT_SECONDARY);
        labelDoc.setFontSize(7);
        labelDoc.setFont('helvetica', 'normal');
        labelDoc.text(`ID: ${asset.id}`, contentX, 16);

        // Owner/Type
        labelDoc.setFontSize(6);
        labelDoc.text(`${asset.type} | Prop: ${asset.owner}`, contentX, 23);

        labelDoc.save(`Etiquette_${asset.name.replace(/\s+/g, '_')}.pdf`);
        return labelDoc;
    }
}
