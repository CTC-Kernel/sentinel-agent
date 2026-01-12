/**
 * CSV Utilities Tests
 * Story 13-4: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CsvParser } from '../csvUtils';

// Mock DOM elements
const mockLink = {
    setAttribute: vi.fn(),
    click: vi.fn(),
    style: { visibility: '' },
    download: '',
};

vi.stubGlobal('document', {
    createElement: vi.fn(() => mockLink),
    body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
    },
});

vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:test'),
});

vi.stubGlobal('Blob', class MockBlob {
    constructor(public content: string[], public options: { type: string }) {}
});

describe('CsvParser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLink.style.visibility = '';
    });

    describe('parseCSV', () => {
        it('should parse simple CSV content', () => {
            const csv = `name,age,city
John,30,Paris
Jane,25,Lyon`;

            const result = CsvParser.parseCSV(csv);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ name: 'John', age: '30', city: 'Paris' });
            expect(result[1]).toEqual({ name: 'Jane', age: '25', city: 'Lyon' });
        });

        it('should handle empty CSV', () => {
            const result = CsvParser.parseCSV('');
            expect(result).toEqual([]);
        });

        it('should handle CSV with only headers', () => {
            const result = CsvParser.parseCSV('name,age,city');
            expect(result).toEqual([]);
        });

        it('should handle quoted values', () => {
            const csv = `name,description
"John Doe","A ""quoted"" value"`;

            const result = CsvParser.parseCSV(csv);

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('John Doe');
        });

        it('should handle CSV with empty lines', () => {
            const csv = `name,age

John,30

Jane,25
`;

            const result = CsvParser.parseCSV(csv);
            expect(result.length).toBeGreaterThan(0);
        });

        it('should trim headers', () => {
            const csv = ` name , age , city
John,30,Paris`;

            const result = CsvParser.parseCSV(csv);

            expect(result[0]).toHaveProperty('name');
            expect(result[0]).toHaveProperty('age');
            expect(result[0]).toHaveProperty('city');
        });

        it('should handle rows with all values', () => {
            const csv = `name,age,city
John,30,Paris`;

            const result = CsvParser.parseCSV(csv);

            expect(result[0].name).toBe('John');
            expect(result[0].age).toBe('30');
            expect(result[0].city).toBe('Paris');
        });
    });

    describe('downloadCSV', () => {
        it('should create download link with correct filename', () => {
            const headers = ['Name', 'Age'];
            const rows = [['John', '30'], ['Jane', '25']];

            CsvParser.downloadCSV(headers, rows, 'test.csv');

            expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'test.csv');
            expect(mockLink.click).toHaveBeenCalled();
        });

        it('should use default filename when not provided', () => {
            CsvParser.downloadCSV(['Col1'], [['Val1']]);

            expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'export.csv');
        });

        it('should handle object rows', () => {
            const headers = ['Name', 'Age'];
            const rows = [{ name: 'John', age: 30 }];

            CsvParser.downloadCSV(headers, rows, 'objects.csv');

            expect(mockLink.click).toHaveBeenCalled();
        });

        it('should handle null and undefined values', () => {
            const headers = ['Name', 'Age'];
            const rows = [[null, undefined]];

            // Should not throw
            expect(() => CsvParser.downloadCSV(headers, rows)).not.toThrow();
        });

        it('should escape values with commas', () => {
            const headers = ['Name', 'Description'];
            const rows = [['John', 'Hello, World']];

            expect(() => CsvParser.downloadCSV(headers, rows)).not.toThrow();
        });

        it('should escape values with quotes', () => {
            const headers = ['Name', 'Quote'];
            const rows = [['John', 'He said "Hello"']];

            expect(() => CsvParser.downloadCSV(headers, rows)).not.toThrow();
        });

        it('should escape values with newlines', () => {
            const headers = ['Name', 'Note'];
            const rows = [['John', 'Line1\nLine2']];

            expect(() => CsvParser.downloadCSV(headers, rows)).not.toThrow();
        });
    });

    describe('exportToCsv', () => {
        it('should export data with specified fields', () => {
            const data = [
                { name: 'John', age: 30, city: 'Paris', extra: 'ignored' },
                { name: 'Jane', age: 25, city: 'Lyon', extra: 'also ignored' },
            ];

            CsvParser.exportToCsv(data, 'export', ['name', 'age', 'city']);

            expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'export.csv');
        });

        it('should handle missing fields gracefully', () => {
            const data = [{ name: 'John' }];

            expect(() => CsvParser.exportToCsv(data, 'partial', ['name', 'age'])).not.toThrow();
        });

        it('should handle empty data array', () => {
            CsvParser.exportToCsv([], 'empty', ['name']);

            expect(mockLink.click).toHaveBeenCalled();
        });
    });
});
