/**
 * Zustand Store for Mobile Agent State
 *
 * Manages device enrollment, compliance state, and check results.
 */

import { create } from 'zustand';
import {
    isDeviceEnrolled,
    enrollDevice,
    sendHeartbeatAndCheck,
    getEnrolledAgent,
    MobileAgent,
} from '../services/mobileAgentService';
import {
    MobileCheckResult,
    getDeviceInfo,
    DeviceInfo,
} from '../services/mobileComplianceChecks';

interface AgentState {
    // State
    isLoading: boolean;
    isRefreshing: boolean;
    isRunningChecks: boolean;
    enrolled: boolean;
    agent: MobileAgent | null;
    deviceInfo: DeviceInfo | null;
    checkResults: MobileCheckResult[];
    complianceScore: number | null;
    error: string | null;

    // Actions
    loadData: () => Promise<void>;
    enrollDevice: () => Promise<{ success: boolean; error?: string }>;
    runChecks: () => Promise<{ success: boolean; error?: string }>;
    refresh: () => Promise<void>;
    clearError: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
    // Initial state
    isLoading: true,
    isRefreshing: false,
    isRunningChecks: false,
    enrolled: false,
    agent: null,
    deviceInfo: null,
    checkResults: [],
    complianceScore: null,
    error: null,

    // Load all data
    loadData: async () => {
        try {
            set({ isLoading: true, error: null });

            const [isEnrolled, agentData, device] = await Promise.all([
                isDeviceEnrolled(),
                getEnrolledAgent(),
                getDeviceInfo(),
            ]);

            set({
                enrolled: isEnrolled,
                agent: agentData,
                deviceInfo: device,
                complianceScore: agentData?.complianceScore ?? null,
            });
        } catch (error) {
            console.error('Error loading data:', error);
            set({ error: 'Impossible de charger les données' });
        } finally {
            set({ isLoading: false, isRefreshing: false });
        }
    },

    // Enroll device
    enrollDevice: async () => {
        try {
            set({ isLoading: true, error: null });

            const result = await enrollDevice();

            if (result.success) {
                await get().loadData();
                // Run initial compliance check after enrollment
                await get().runChecks();
                return { success: true };
            } else {
                const errorMsg = result.error || "Impossible d'enregistrer l'appareil";
                set({ error: errorMsg });
                return { success: false, error: errorMsg };
            }
        } catch {
            const errorMsg = 'Une erreur est survenue';
            set({ error: errorMsg });
            return { success: false, error: errorMsg };
        } finally {
            set({ isLoading: false });
        }
    },

    // Run compliance checks
    runChecks: async () => {
        try {
            set({ isRunningChecks: true, error: null });

            const result = await sendHeartbeatAndCheck(true);

            if (result.success) {
                set({
                    checkResults: result.checkResults || [],
                    complianceScore: result.complianceScore ?? null,
                });
                // Refresh agent data
                await get().loadData();
                return { success: true };
            } else {
                const errorMsg = result.error || "Impossible d'exécuter les vérifications";
                set({ error: errorMsg });
                return { success: false, error: errorMsg };
            }
        } catch {
            const errorMsg = 'Une erreur est survenue';
            set({ error: errorMsg });
            return { success: false, error: errorMsg };
        } finally {
            set({ isRunningChecks: false });
        }
    },

    // Refresh data
    refresh: async () => {
        set({ isRefreshing: true });
        await get().loadData();
    },

    // Clear error
    clearError: () => {
        set({ error: null });
    },
}));
