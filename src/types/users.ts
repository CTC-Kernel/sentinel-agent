export interface SystemLog {
    id: string;
    organizationId: string;
    userId: string;
    userDisplayName?: string;
    userEmail: string;
    action: string;
    resource: string;
    resourceId?: string; // ID of the resource for deep linking
    details?: string;
    timestamp: string;
    severity?: 'info' | 'warning' | 'danger' | 'success';
    ip?: string;
    metadata?: Record<string, unknown>;
    changes?: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
}

export interface NotificationChannelPreferences {
    email: boolean;
    push: boolean;
    inApp: boolean;
}

export interface NotificationPreferences {
    risks: NotificationChannelPreferences;
    audits: NotificationChannelPreferences;
    tasks: NotificationChannelPreferences;
    system: NotificationChannelPreferences;
}

export interface UserProfile {
    uid: string;
    organizationId?: string;
    organizationName?: string;
    email: string;
    role: 'admin' | 'auditor' | 'user' | 'rssi' | 'project_manager' | 'direction';
    displayName: string;
    department?: string;
    photoURL?: string | null;
    onboardingCompleted?: boolean;
    lastLogin?: string;
    theme?: 'light' | 'dark';
    isPending?: boolean;
    createdAt?: string;
    notificationPreferences?: NotificationPreferences;

    hasGeminiKey?: boolean;
    hasShodanKey?: boolean;
    hasHibpKey?: boolean;
    hasSafeBrowsingKey?: boolean;
}

export interface CustomRole {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    permissions: Partial<Record<string, ('create' | 'read' | 'update' | 'delete' | 'manage')[]>>;
    createdAt: string;
    updatedAt: string;
}

export interface Invitation {
    id: string;
    email: string;
    role: 'admin' | 'auditor' | 'user';
    department: string;
    organizationId: string;
    organizationName: string;
    invitedBy: string;
    createdAt: string;
}

export interface NotificationRecord {
    id: string;
    organizationId: string;
    userId: string;
    type: 'warning' | 'danger' | 'info' | 'success';
    title: string;
    message: string;
    link?: string;
    read: boolean;
    createdAt: string;
    expiresAt?: string;
}

export interface Comment {
    id: string;
    organizationId: string;
    userId: string;
    userName: string;
    content: string;
    createdAt: string;
    updatedAt?: string;
    parentId?: string;
    mentions?: string[]; // User IDs mentioned
}

export interface UserGroup {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    members: string[]; // List of User UIDs
    createdAt: string;
    updatedAt: string;
}
