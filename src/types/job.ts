
export interface ScannerJob {
 id: string;
 scannerId: 'nessus' | 'qualys' | 'openvas';
 status: 'scheduled' | 'running' | 'completed' | 'failed';
 target: string;
 frequency: 'once' | 'daily' | 'weekly' | 'monthly';
 lastRun?: string;
 nextRun?: string;
 createdAt: string;
 resultsCount?: number;
 duration?: string;
}

export interface ScannerJobCreate {
 scannerId: 'nessus' | 'qualys' | 'openvas';
 target: string;
 frequency: 'once' | 'daily' | 'weekly' | 'monthly';
 scheduledDate?: string; // ISO string
}
