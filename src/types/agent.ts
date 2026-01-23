export type AgentStatus = 'active' | 'offline' | 'error';
export type AgentOS = 'windows' | 'linux' | 'darwin';

export interface SentinelAgent {
    id: string;
    name: string;
    os: AgentOS;
    status: AgentStatus;
    version: string;
    lastHeartbeat: string;
    ipAddress?: string;
    hostname?: string;
    organizationId: string;
}

export interface AgentEnrollmentToken {
    token: string;
    expiresAt: string;
    organizationId: string;
}
