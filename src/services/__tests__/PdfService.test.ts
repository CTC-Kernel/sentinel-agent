
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfService } from '../PdfService';

vi.mock('../store', () => ({
    useStore: {
        getState: () => ({
            user: {
                uid: 'test-user',
                organizationId: 'org-123',
                role: 'admin'
            }
        })
    }
}));

// Mock jsPDF
vi.mock('jspdf', () => {
    const mockJsPDF = vi.fn().mockImplementation(() => ({
        save: vi.fn(),
        text: vi.fn(),
        rect: vi.fn(),
        roundedRect: vi.fn(),
        setFont: vi.fn(),
        setFontSize: vi.fn(),
        setTextColor: vi.fn(),
        setDrawColor: vi.fn(),
        setLineWidth: vi.fn(),
        setFillColor: vi.fn(),
        addImage: vi.fn(),
        line: vi.fn(),
        addPage: vi.fn(),
        setPage: vi.fn(),
        getNumberOfPages: vi.fn(() => 1),
        internal: {
            pageSize: { width: 210, height: 297 }
        },
        autoTable: vi.fn(),
        splitTextToSize: vi.fn((text) => [text]), // Simple mock
        getTextWidth: vi.fn(() => 10),
        savePoints: vi.fn(),
        restorePoints: vi.fn(),
        saveGraphicsState: vi.fn(),
        restoreGraphicsState: vi.fn(),
        setGState: vi.fn(),
    }));

    const mockConstructor = mockJsPDF as unknown as { prototype: unknown; API: unknown };
    mockConstructor.prototype = {
        autoTable: vi.fn()
    };
    mockConstructor.API = {
        autoTable: vi.fn()
    };

    return {
        jsPDF: mockJsPDF
    };
});

describe('PdfService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should generate a table report and call save', () => {
        const options = {
            title: 'Test Report',
            filename: 'test.pdf'
        };
        const columns = ['Col A', 'Col B'];
        const data = [['Val 1', 'Val 2']];

        const doc = PdfService.generateTableReport(options, columns, data);

        expect(doc.save).toHaveBeenCalledWith('test.pdf');
        expect(doc.autoTable).toHaveBeenCalled();
    });

    it('should generate an executive report without crashing', () => {
        const options = {
            title: 'Executive Report',
            organizationName: 'Test Org',
            summary: 'Executive Summary Text',
            stats: [{ label: 'Stat 1', value: 10 }],
            metrics: [{ label: 'Metric 1', value: '100%' }]
        };

        const doc = PdfService.generateExecutiveReport(options, (doc, y) => {
            doc.text('Custom Content', 10, y);
        });

        // Verify key structure calls
        expect(doc.text).toHaveBeenCalledWith(expect.stringContaining('Executive Report'), expect.any(Number), expect.any(Number), expect.any(Object));
        expect(doc.text).toHaveBeenCalledWith('Custom Content', 10, expect.any(Number));
        expect(doc.save).toHaveBeenCalled();
    });

    it('should handle missing logo gracefully', () => {
        const options = {
            title: 'No Logo Report',
        };

        // Should not throw
        expect(() => {
            PdfService.generateTableReport(options, [], []);
        }).not.toThrow();
    });
});
