/**
 * User Test Factory
 * Creates mock UserProfile objects for testing
 */

import { UserProfile } from '../../types';

let userCounter = 0;

export interface UserFactoryOptions {
    uid?: string;
    organizationId?: string;
    email?: string;
    displayName?: string;
    role?: UserProfile['role'];
    isActive?: boolean;
}

export function createUser(options: UserFactoryOptions = {}): UserProfile {
    userCounter++;
    const uid = options.uid || `user-${userCounter}`;

    return {
        uid,
        organizationId: options.organizationId || 'org-test',
        email: options.email || `user${userCounter}@test.com`,
        displayName: options.displayName || `Test User ${userCounter}`,
        role: options.role || 'collaborator',
        isActive: options.isActive ?? true,
        photoURL: undefined,
        department: 'IT',
        jobTitle: 'Analyst',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export function createUserList(count: number, options: UserFactoryOptions = {}): UserProfile[] {
    return Array.from({ length: count }, () => createUser(options));
}

export function createAdminUser(options: UserFactoryOptions = {}): UserProfile {
    return createUser({
        ...options,
        role: 'admin',
    });
}

export function createRSSIUser(options: UserFactoryOptions = {}): UserProfile {
    return createUser({
        ...options,
        role: 'rssi',
    });
}

export function resetUserCounter(): void {
    userCounter = 0;
}
