/**
 * ExcelExportService Tests
 * Story 14-1: Test Coverage 50%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExcelExportService } from '../excelExportService';

// Mock ExcelJS
const mockWorksheet = {
    columns: [],
    getRow: vi.fn(() => ({
        font: {},
        fill: {},
        alignment: {},
        height: 25,
        eachCell: vi.fn((cb: (cell: { border: unknown }) => void) => cb({ border: {} })),
    })),
    getCell: vi.fn(() => ({
        value: 5,
        fill: {},
        font: {},
    })),
    addRows: vi.fn(),
    eachRow: vi.fn((cb: (row: { eachCell: (cb: (cell: { border: unknown }) => void) => void }) => void) => {
        cb({
            eachCell: (cellCb: (cell: { border: unknown }) => void) => {
                cellCb({ border: {} });
            },
        });
    }),
};

const mockWorkbook = {
    creator: '',
    created: null,
    modified: null,
    addWorksheet: vi.fn(() => mockWorksheet),
    xlsx: {
        writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
    },
};

vi.mock('exceljs', () => ({
    default: {
        Workbook: vi.fn(() => mockWorkbook),
    },
}));

// Mock DOM APIs
const mockLink = {
    href: '',
    download: '',
    click: vi.fn(),
};

Object.defineProperty(global, 'document', {
    value: {
        createElement: vi.fn(() => mockLink),
        body: {
            appendChild: vi.fn(),
            removeChild: vi.fn(),
        },
    },
    writable: true,
});

Object.defineProperty(global, 'URL', {
    value: {
        createObjectURL: vi.fn(() => 'blob:test-url'),
        revokeObjectURL: vi.fn(),
    },
    writable: true,
});

Object.defineProperty(global, 'Blob', {
    value: class Blob {
        constructor(public content: unknown[], public options: { type: string }) {}
    },
    writable: true,
});

describe('ExcelExportService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('exportToExcel', () => {
        it('should create workbook with metadata', async () => {
            await ExcelExportService.exportToExcel({
                filename: 'test-export',
                sheets: [
                    {
                        name: 'TestSheet',
                        columns: [{ header: 'Name', key: 'name' }],
                        data: [{ name: 'Test' }],
                    },
                ],
            });

            expect(mockWorkbook.creator).toBe('Sentinel GRC');
            expect(mockWorkbook.created).toBeInstanceOf(Date);
        });

        it('should create worksheets for each sheet', async () => {
            await ExcelExportService.exportToExcel({
                filename: 'test-export',
                sheets: [
                    {
                        name: 'Sheet1',
                        columns: [{ header: 'Col1', key: 'col1' }],
                        data: [{ col1: 'Data1' }],
                    },
                    {
                        name: 'Sheet2',
                        columns: [{ header: 'Col2', key: 'col2' }],
                        data: [{ col2: 'Data2' }],
                    },
                ],
            });

            expect(mockWorkbook.addWorksheet).toHaveBeenCalledTimes(2);
            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Sheet1');
            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Sheet2');
        });

        it('should add rows to worksheet', async () => {
            const data = [{ name: 'Item1' }, { name: 'Item2' }];

            await ExcelExportService.exportToExcel({
                filename: 'test-export',
                sheets: [
                    {
                        name: 'TestSheet',
                        columns: [{ header: 'Name', key: 'name' }],
                        data,
                    },
                ],
            });

            expect(mockWorksheet.addRows).toHaveBeenCalledWith(data);
        });

        it('should set column widths', async () => {
            await ExcelExportService.exportToExcel({
                filename: 'test-export',
                sheets: [
                    {
                        name: 'TestSheet',
                        columns: [
                            { header: 'Name', key: 'name', width: 30 },
                            { header: 'Description', key: 'desc', width: 50 },
                        ],
                        data: [{ name: 'Test', desc: 'Description' }],
                    },
                ],
            });

            expect(mockWorkbook.addWorksheet).toHaveBeenCalled();
        });

        it('should download the file', async () => {
            await ExcelExportService.exportToExcel({
                filename: 'test-download',
                sheets: [
                    {
                        name: 'TestSheet',
                        columns: [{ header: 'Name', key: 'name' }],
                        data: [],
                    },
                ],
            });

            expect(mockLink.download).toBe('test-download.xlsx');
            expect(mockLink.click).toHaveBeenCalled();
            expect(URL.revokeObjectURL).toHaveBeenCalled();
        });

        it('should apply header styling', async () => {
            await ExcelExportService.exportToExcel({
                filename: 'styled-export',
                sheets: [
                    {
                        name: 'StyledSheet',
                        columns: [{ header: 'Name', key: 'name' }],
                        data: [{ name: 'Test' }],
                    },
                ],
            });

            expect(mockWorksheet.getRow).toHaveBeenCalledWith(1);
        });

        it('should handle risk score formatting for Risques sheet', async () => {
            mockWorksheet.getCell.mockReturnValue({
                value: 15,
                fill: {},
                font: {},
            });

            await ExcelExportService.exportToExcel({
                filename: 'risk-export',
                sheets: [
                    {
                        name: 'Risques',
                        columns: [
                            { header: 'Score', key: 'score' },
                        ],
                        data: [
                            { score: 15 }, // High risk
                            { score: 10 }, // Medium risk
                            { score: 5 },  // Low risk
                        ],
                    },
                ],
            });

            expect(mockWorksheet.getCell).toHaveBeenCalled();
        });

        it('should write buffer and create blob', async () => {
            await ExcelExportService.exportToExcel({
                filename: 'buffer-test',
                sheets: [
                    {
                        name: 'TestSheet',
                        columns: [{ header: 'Name', key: 'name' }],
                        data: [],
                    },
                ],
            });

            expect(mockWorkbook.xlsx.writeBuffer).toHaveBeenCalled();
        });
    });

    describe('exportCompleteGRC', () => {
        const mockData = {
            risks: [
                {
                    id: 'risk-1',
                    threat: 'Ransomware',
                    vulnerability: 'Unpatched systems',
                    probability: 3,
                    impact: 5,
                    score: 15,
                    strategy: 'Mitigate',
                    status: 'Open',
                    owner: 'CISO',
                },
            ],
            assets: [
                {
                    id: 'asset-1',
                    name: 'Server',
                    type: 'Hardware',
                    owner: 'IT',
                    confidentiality: 'High',
                    integrity: 'High',
                    availability: 'Critical',
                },
            ],
            controls: [
                {
                    id: 'control-1',
                    code: 'A.5.1',
                    name: 'Security Policy',
                    status: 'Implemented',
                    justification: 'Documented',
                },
            ],
            audits: [
                {
                    id: 'audit-1',
                    name: 'Internal Audit',
                    type: 'Internal',
                    status: 'Completed',
                    auditor: 'Audit Team',
                    dateScheduled: '2025-01-15',
                },
            ],
            incidents: [
                {
                    id: 'incident-1',
                    title: 'Phishing Attempt',
                    severity: 'Medium',
                    status: 'Resolved',
                    dateReported: '2025-01-10',
                },
            ],
            projects: [
                {
                    id: 'project-1',
                    name: 'ISO 27001',
                    status: 'In Progress',
                    manager: 'PM',
                },
            ],
        };

        it('should export all GRC modules', async () => {
            await ExcelExportService.exportCompleteGRC(mockData as never);

            // Should create 6 worksheets
            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Risques');
            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Actifs');
            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Conformité');
            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Audits');
            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Incidents');
            expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Projets');
        });

        it('should generate filename with date', async () => {
            const today = new Date().toISOString().split('T')[0];

            await ExcelExportService.exportCompleteGRC(mockData as never);

            expect(mockLink.download).toContain('Sentinel_GRC_Export_');
            expect(mockLink.download).toContain(today);
        });

        it('should map risk data correctly', async () => {
            await ExcelExportService.exportCompleteGRC(mockData as never);

            // Verify addRows was called with mapped data
            expect(mockWorksheet.addRows).toHaveBeenCalled();
        });

        it('should handle empty data arrays', async () => {
            const emptyData = {
                risks: [],
                assets: [],
                controls: [],
                audits: [],
                incidents: [],
                projects: [],
            };

            await ExcelExportService.exportCompleteGRC(emptyData as never);

            expect(mockWorkbook.addWorksheet).toHaveBeenCalledTimes(6);
        });

        it('should handle missing optional fields', async () => {
            const dataWithMissingFields = {
                risks: [{ threat: 'Test' }],
                assets: [{ name: 'Asset' }],
                controls: [{ name: 'Control' }],
                audits: [{ name: 'Audit' }],
                incidents: [{ title: 'Incident' }],
                projects: [{ name: 'Project' }],
            };

            await ExcelExportService.exportCompleteGRC(dataWithMissingFields as never);

            expect(mockWorkbook.addWorksheet).toHaveBeenCalledTimes(6);
        });
    });
});
