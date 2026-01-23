export type AgentStatus = 'active' | 'offline' | 'error';
export type AgentOS = 'windows' | 'linux' | 'darwin';

export interface SentinelAgent {
    id: string;
    name: string;
    os: AgentOS;
    osVersion?: string;
    status: AgentStatus;
    version: string;
    lastHeartbeat: string;
    ipAddress?: string;
    hostname?: string;
    organizationId: string;
    machineId?: string;
    complianceScore?: number | null;
    lastCheckAt?: string | null;
    enrolledAt?: string;
    cpuPercent?: number;
    memoryBytes?: number;
    config?: AgentConfig;
    configVersion?: number;
    rulesVersion?: number;
}

export interface AgentConfig {
    check_interval_secs: number;
    heartbeat_interval_secs: number;
    log_level: string;
    enabled_checks: string[];
    offline_mode_days: number;
}

export interface AgentDetails extends SentinelAgent {
    enrolledWithToken?: string;
    selfCheckResult?: Record<string, unknown>;
    resultsSummary: {
        total: number;
        pass: number;
        fail: number;
        error: number;
        not_applicable: number;
    };
    pendingCommandsCount: number;
}

export interface AgentEnrollmentToken {
    id: string;
    token?: string;
    tokenPreview?: string;
    name: string;
    expiresAt: string;
    createdAt?: string;
    maxUses: number | null;
    usedCount: number;
    status: 'active' | 'expired' | 'revoked' | 'exhausted';
    revoked?: boolean;
    lastUsedAt?: string | null;
    organizationId: string;
}

export interface AgentResult {
    id: string;
    checkId: string;
    framework: string;
    controlId: string;
    status: 'pass' | 'fail' | 'error' | 'not_applicable';
    evidence: Record<string, unknown>;
    timestamp: string;
    durationMs: number;
    createdAt?: string;
}

export interface AgentResultsSummary {
    results: AgentResult[];
    hasMore: boolean;
    lastId: string | null;
}
