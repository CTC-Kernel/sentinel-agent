import AsyncStorage from '@react-native-async-storage/async-storage';

export const CACHE_KEYS = {
    DASHBOARD_STATS: 'dashboard_stats',
    USER_PROFILE: 'user_profile',
    LAST_SYNC: 'last_sync',
};

export const offlineStorage = {
    async save<T>(key: string, value: T) {
        try {
            const jsonValue = JSON.stringify(value);
            await AsyncStorage.setItem(key, jsonValue);
        } catch (e) {
            console.error('Failed to save data to offline storage', e);
        }
    },

    async load<T>(key: string): Promise<T | null> {
        try {
            const jsonValue = await AsyncStorage.getItem(key);
            return jsonValue != null ? JSON.parse(jsonValue) : null;
        } catch (e) {
            console.error('Failed to load data from offline storage', e);
            return null;
        }
    },

    async remove(key: string) {
        try {
            await AsyncStorage.removeItem(key);
        } catch (e) {
            console.error('Failed to remove data from offline storage', e);
        }
    },

    async clearAll() {
        try {
            await AsyncStorage.clear();
        } catch (e) {
            console.error('Failed to clear offline storage', e);
        }
    }
};
