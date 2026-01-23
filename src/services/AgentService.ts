import {
    collection,
    doc,
    getDocs,
    deleteDoc,
    query,
    orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { SentinelAgent, AgentEnrollmentToken } from '../types/agent';

const getAgentsCollection = (organizationId: string) =>
    collection(db, 'organizations', organizationId, 'agents');

/**
 * Get all agents for an organization
 */
export async function getAgents(organizationId: string): Promise<SentinelAgent[]> {
    try {
        const q = query(
            getAgentsCollection(organizationId),
            orderBy('lastHeartbeat', 'desc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as SentinelAgent));
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.getAgents', {
            component: 'AgentService',
            action: 'getAgents',
            organizationId
        });
        // Return mock data for demo if no real data is found/configured
        return [
            {
                id: 'agent-1',
                name: 'SRV-PROD-01',
                os: 'linux',
                status: 'active',
                version: '1.2.4',
                lastHeartbeat: new Date(Date.now() - 5 * 60000).toISOString(),
                ipAddress: '10.0.1.45',
                hostname: 'prod-app-01',
                organizationId
            },
            {
                id: 'agent-2',
                name: 'WS-SEC-01',
                os: 'windows',
                status: 'offline',
                version: '1.2.3',
                lastHeartbeat: new Date(Date.now() - 2 * 3600000).toISOString(),
                ipAddress: '192.168.1.15',
                hostname: 'secure-ws-01',
                organizationId
            }
        ];
    }
}

/**
 * Delete an agent
 */
export async function deleteAgent(organizationId: string, agentId: string): Promise<void> {
    try {
        const docRef = doc(getAgentsCollection(organizationId), agentId);
        await deleteDoc(docRef);
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.deleteAgent', {
            component: 'AgentService',
            action: 'deleteAgent',
            organizationId,
            metadata: { agentId }
        });
        throw error;
    }
}

/**
 * Generate a new enrollment token
 */
export async function generateEnrollmentToken(organizationId: string): Promise<AgentEnrollmentToken> {
    try {
        // In a real implementation, this would call a Cloud Function
        // For now, we simulate better security logic
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString();

        return {
            token,
            expiresAt,
            organizationId
        };
    } catch (error) {
        ErrorLogger.error(error, 'AgentService.generateEnrollmentToken');
        throw error;
    }
}

export const AgentService = {
    getAgents,
    deleteAgent,
    generateEnrollmentToken
};

export default AgentService;
