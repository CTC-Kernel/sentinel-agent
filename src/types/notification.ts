export interface Notification {
 id: string;
 userId?: string;
 organizationId?: string;
 type: 'info' | 'success' | 'warning' | 'error' | 'danger' | 'mention' | 'assignment' | 'review' | 'deadline';
 title: string;
 message?: string;
 link?: string;
 read: boolean;
 createdAt: string | number;
 expiresAt?: string;
 metadata?: Record<string, unknown>;
 actionPayload?: {
 type: 'navigate' | 'modal';
 destination: string;
 };

 // Toast specific properties (optional)
 duration?: number;
 persistent?: boolean;
 timestamp?: number;
 action?: {
 label: string;
 onClick: () => void;
 };
}
