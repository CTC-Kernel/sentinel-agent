import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ReportEnrichmentService } from './ReportEnrichmentService';
import { Risk, Project, ProjectTask, Control, Audit, Finding } from '../types';

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
    author?: string;
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
     * Add Premium Cover Page
     */
    private static addCoverPage(doc: jsPDF, options: ReportOptions & { author?: string, organizationName?: string }) {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const dateStr = format(new Date(), 'dd MMMM yyyy', { locale: fr });

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
            } catch {
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
            doc.save(options.filename || `${options.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
        }
        return doc;
    }

    /**
     * Draw a modern Bar Chart
     */
    static drawBarChart(
        doc: jsPDF,
        x: number,
        y: number,
        width: number,
        height: number,
        data: { label: string; value: number; color?: string }[],
        title?: string
    ) {
        if (title) {
            doc.setFontSize(12);
            doc.setTextColor(this.TEXT_PRIMARY);
            doc.setFont('helvetica', 'bold');
            doc.text(title, x, y - 5);
        }

        const maxValue = Math.max(...data.map(d => d.value)) || 100;
        const barWidth = (width / data.length) * 0.6;
        const spacing = (width / data.length) * 0.4;
        let currentX = x;

        // Draw Axis Line
        doc.setDrawColor(this.BORDER_COLOR);
        doc.setLineWidth(0.1);
        doc.line(x, y + height, x + width, y + height);

        data.forEach((item, index) => {
            const barHeight = (item.value / maxValue) * height;
            const color = item.color || this.CHART_COLORS[index % this.CHART_COLORS.length];

            // Bar Background (Optional opacity effect)
            doc.setFillColor(this.ACCENT_COLOR);
            doc.roundedRect(currentX, y, barWidth, height, 1, 1, 'F');

            // Actual Bar
            if (barHeight > 0) {
                doc.setFillColor(color);
                // Draw from bottom up
                doc.roundedRect(currentX, y + height - barHeight, barWidth, barHeight, 1, 1, 'F');
            }

            // Label
            doc.setFontSize(8);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.setFont('helvetica', 'normal');
            const labelWidth = doc.getTextWidth(item.label);
            // Truncate or Center label
            if (labelWidth > barWidth + 5) {
                doc.text(item.label.substring(0, 3) + '.', currentX + barWidth / 2, y + height + 5, { align: 'center' });
            } else {
                doc.text(item.label, currentX + barWidth / 2, y + height + 5, { align: 'center' });
            }

            // Value
            doc.setFontSize(7);
            doc.setTextColor(this.TEXT_PRIMARY);
            doc.text(item.value.toString(), currentX + barWidth / 2, y + height - barHeight - 2, { align: 'center' });

            currentX += barWidth + spacing;
        });
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
        bottomMargin: number = 20,
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
     * Draw a modern Donut Chart
     */
    static drawDonutChart(
        doc: jsPDF,
        x: number,
        y: number,
        radius: number,
        data: { label: string; value: number; color: string }[],
        centerText?: string
    ) {
        let total = data.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) total = 1;

        let startAngle = 0;
        const centerX = x + radius;
        const centerY = y + radius;

        // Draw segments
        data.forEach(item => {
            if (item.value === 0) return;
            const sliceAngle = (item.value / total) * 360;
            const endAngle = startAngle + sliceAngle;

            doc.setFillColor(item.color);
            this.drawArc(doc, centerX, centerY, radius, startAngle, endAngle);
            startAngle = endAngle;
        });

        // Draw inner circle (White) to create Donut
        doc.setFillColor(255, 255, 255);
        doc.circle(centerX, centerY, radius * 0.6, 'F');

        // Center Text
        if (centerText) {
            doc.setFontSize(12);
            doc.setTextColor(this.TEXT_PRIMARY);
            doc.setFont('helvetica', 'bold');
            doc.text(centerText, centerX, centerY + 1, { align: 'center', baseline: 'middle' });
        }

        // Legend
        let legendY = y + 5;
        const legendX = x + (radius * 2) + 10;

        data.forEach(item => {
            if (item.value === 0) return;
            doc.setFillColor(item.color);
            doc.circle(legendX, legendY, 2, 'F');

            doc.setFontSize(9);
            doc.setTextColor(this.TEXT_SECONDARY);
            doc.setFont('helvetica', 'normal');
            doc.text(`${item.label} (${Math.round((item.value / total) * 100)}%)`, legendX + 5, legendY + 1);

            legendY += 6;
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
     * Draw a 5x5 Risk Heatmap Matrix
     */
    static drawRiskMatrix(
        doc: jsPDF,
        x: number,
        y: number,
        width: number,
        height: number,
        risks: { probability: number; impact: number }[]
    ) {
        const cellSize = width / 5;
        const gridColors = [
            ['#ecfdf5', '#d1fae5', '#fef3c7', '#fcd34d', '#fca5a5'],
            ['#d1fae5', '#fef3c7', '#fcd34d', '#fca5a5', '#f87171'],
            ['#fef3c7', '#fcd34d', '#fca5a5', '#f87171', '#ef4444'],
            ['#fcd34d', '#fca5a5', '#f87171', '#ef4444', '#dc2626'],
            ['#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c']
        ];

        doc.setFontSize(8);
        doc.setTextColor(this.TEXT_SECONDARY);
        doc.setFont('helvetica', 'bold');

        doc.text("Probabilité", x - 5, y + height / 2, { angle: 90, align: 'center' });
        doc.text("Impact (Gravité)", x + width / 2, y + height + 8, { align: 'center' });

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const cellX = x + (col * cellSize);
                const cellY = y + ((4 - row) * cellSize);

                const prob = row + 1;
                const imp = col + 1;
                const count = risks.filter(r => r.probability === prob && r.impact === imp).length;

                doc.setFillColor(gridColors[row][col]);
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.5);
                doc.rect(cellX, cellY, cellSize, cellSize, 'FD');

                if (count > 0) {
                    doc.setFontSize(10);
                    doc.setTextColor(this.TEXT_PRIMARY);
                    doc.setFont('helvetica', 'bold');
                    doc.text(count.toString(), cellX + cellSize / 2, cellY + cellSize / 2, { align: 'center', baseline: 'middle' });
                }
            }
        }

        doc.setFontSize(7);
        doc.setTextColor(this.TEXT_SECONDARY);
        ['Faible', 'Moyen', 'Fort', 'Critique', 'Catastrophique'].forEach((_, i) => {
            doc.text((i + 1).toString(), x + (i * cellSize) + cellSize / 2, y + height + 3, { align: 'center' });
            doc.text((i + 1).toString(), x - 2, y + height - (i * cellSize) - cellSize / 2, { align: 'right', baseline: 'middle' });
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
            this.drawRiskMatrix(doc, (pageWidth - 100) / 2, currentY, 100, 100, risks);
            currentY += 110;

            // 2. Top Critical Risks Table
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
            doc.setFontSize(14);
            doc.setTextColor(this.BRAND_SECONDARY);
            doc.setFont('helvetica', 'bold');
            doc.text("Recommandations Stratégiques (IA)", 14, currentY);
            currentY += 10;

            doc.setFontSize(10);
            doc.setTextColor(this.TEXT_PRIMARY);
            doc.setFont('helvetica', 'normal');

            analysis.recommendations.forEach((rec, i) => {
                doc.text(`${i + 1}. ${rec}`, 14, currentY);
                currentY += 7;
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
            title: "RAPPORT D'AUDIT",
            subtitle: `${audit.reference} - ${audit.standard}`,
            summary: executiveSummary,
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
                doc.setFontSize(14);
                doc.setTextColor(this.BRAND_SECONDARY);
                doc.setFont('helvetica', 'bold');
                doc.text("Actions Prioritaires", 14, currentY);
                currentY += 10;

                doc.setFontSize(10);
                doc.setTextColor(this.TEXT_PRIMARY);
                doc.setFont('helvetica', 'normal');
                doc.text("• Initier immédiatement les plans d'actions pour les non-conformités majeures.", 14, currentY);
                currentY += 7;
                doc.text("• Revoir les preuves fournies pour les points partiellement conformes.", 14, currentY);
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
            subtitle: `Suivi d'avancement : ${project.name}`,
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
}
