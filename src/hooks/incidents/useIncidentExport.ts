import { useCallback } from 'react';
import { Incident } from '../../types';
import { CsvParser } from '../../utils/csvUtils';

export const useIncidentExport = () => {
    const exportCSV = useCallback((incidents: Incident[]) => {
        const csvHeaders = ['Title', 'Description', 'Status', 'Severity', 'Category', 'Date', 'Reporter'];
        const data = incidents.map(inc => ({
            'Title': inc.title,
            'Description': inc.description || '',
            'Status': inc.status,
            'Severity': inc.severity,
            'Category': inc.category || '',
            'Date': inc.dateReported ? new Date(inc.dateReported).toLocaleDateString() : '',
            'Reporter': inc.reporter || ''
        }));
        CsvParser.downloadCSV(csvHeaders, data, `incidents_export_${new Date().toISOString().split('T')[0]}.csv`);
    }, []);

    return { exportCSV };
};
