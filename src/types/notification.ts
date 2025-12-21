export interface Notification {
    id: string;
    userId: string;
    organizationId: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'danger' | 'mention' | 'assignment' | 'review' | 'deadline';
    title: string;
    message: string;
    link?: string;
    read: boolean;
    createdAt: string;
    expiresAt?: string;
    metadata?: Record<string, any>;
    actionPayload?: {
        type: 'navigate' | 'modal';
        destination: string;
    };
}
