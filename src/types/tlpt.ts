export interface TlptCampaign {
    id: string;
    organizationId: string;
    name: string;
    scope: string;
    methodology: "TIBER-EU" | "Red Team" | "Purple Team" | "Other";
    provider: string; // Could be a Supplier ID in the future
    status: "Planned" | "In Progress" | "Analysis" | "Remediation" | "Closed";
    startDate: any; // Timestamp or Date
    endDate?: any; // Timestamp or Date
    budget?: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}
