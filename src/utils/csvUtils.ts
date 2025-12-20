export class CsvParser {
    /**
     * Convert an array of objects to a CSV blob
     * @param headers Array of header labels
     * @param rows Array of objects or arrays matching the headers
     * @param filename Name of the file to download
     */
    static downloadCSV(headers: string[], rows: any[], filename: string = 'export.csv') {
        const csvContent = [
            headers.join(','),
            ...rows.map(row => {
                if (Array.isArray(row)) {
                    return row.map(cell => this.escapeCSV(cell)).join(',');
                }
                return Object.values(row).map(cell => this.escapeCSV(cell)).join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    /**
     * Escape cell content for CSV format
     */
    private static escapeCSV(str: any): string {
        if (str === null || str === undefined) return '';
        const stringValue = String(str);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }

    /**
     * Parse a CSV string into an array of objects
     * @param content CSV string content
     * @returns Array of objects with keys from the header row
     */
    static parseCSV(content: string): any[] {
        const lines = content.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            const obj: any = {};
            // This simple split doesn't handle commas inside quotes perfectly, 
            // but for a basic utility it might be enough or we could enhance it.
            // A more robust regex split:
            const currentline = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');

            headers.forEach((header, index) => {
                let val = currentline[index] ? currentline[index].trim() : '';
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.substring(1, val.length - 1).replace(/""/g, '"');
                }
                obj[header] = val;
            });
            result.push(obj);
        }
        return result;
    }
    /**
     * Export an array of objects to CSV with specific fields
     * @param data Array of data objects
     * @param filename Filename (without extension)
     * @param fields Array of field keys to export
     */
    static exportToCsv(data: any[], filename: string, fields: string[]) {
        const headers = fields;
        const rows = data.map(item => {
            const row: any[] = [];
            fields.forEach(field => {
                // Handle nested properties if needed, currently flat
                row.push(item[field] !== undefined ? item[field] : '');
            });
            return row;
        });

        this.downloadCSV(headers, rows, `${filename}.csv`);
    }
}
