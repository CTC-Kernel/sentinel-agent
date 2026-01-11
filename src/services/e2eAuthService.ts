import { User } from 'firebase/auth';
import { UserProfile, Organization } from '../types';
import { SecureStorage } from './secureStorage';
import { ErrorLogger } from './errorLogger';

/**
 * E2E Authentication Service
 * Extracted from AuthContext to simplify the main authentication flow
 */
export class E2EAuthService {
  private static readonly E2E_USER_KEY = 'E2E_TEST_USER';

  static isE2EMode(): boolean {
    const plain = localStorage.getItem(this.E2E_USER_KEY);
    ErrorLogger.debug(`E2E Check: Dev=${import.meta.env.DEV}, HasUser=${plain !== null}`, 'E2EAuthService.isE2EMode');
    return import.meta.env.DEV && (plain !== null || SecureStorage.getSecureItem(this.E2E_USER_KEY) !== null);
  }

  static getE2EUser(): UserProfile | null {
    if (!this.isE2EMode()) return null;

    // Check plain storage first (used by Playwright)
    const plain = localStorage.getItem(this.E2E_USER_KEY);
    if (plain) {
      try {
        return JSON.parse(plain) as UserProfile;
      } catch {
        ErrorLogger.warn('Failed to parse plain E2E user', 'E2EAuthService.getE2EUser');
      }
    }

    try {
      const e2eUser = SecureStorage.getSecureItem<UserProfile>(this.E2E_USER_KEY);
      return e2eUser;
    } catch (error) {
      ErrorLogger.error(error, 'E2EAuthService.getE2EUser');
      return null;
    }
  }

  static createMockFirebaseUser(user: UserProfile): User {
    return {
      ...user,
      getIdToken: async () => "mock-token",
      getIdTokenResult: async () => ({
        claims: { organizationId: user.organizationId || 'org_default' }
      }),
      reload: async () => { },
      toJSON: () => user
    } as unknown as User;
  }

  static createMockOrganization(user: UserProfile): Organization | null {
    if (!user.organizationId) return null;

    return {
      id: user.organizationId,
      name: 'Sentinel Demo Org',
      siret: '00000000000000',
      subscriptionPlan: 'enterprise',
      members: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slug: 'sentinel-demo',
      ownerId: user.uid,
      subscription: {
        status: 'active',
        planId: 'enterprise',
        currentPeriodEnd: new Date(2099, 11, 31).toISOString(),
        stripeCustomerId: 'cus_demo',
        cancelAtPeriodEnd: false
      }
    } as Organization;
  }

  static validateE2EUser(firebaseUser: User): boolean {
    const e2eUser = this.getE2EUser();
    return e2eUser !== null && firebaseUser.uid === e2eUser.uid;
  }

  static cleanup(): void {
    if (this.isE2EMode()) {
      SecureStorage.removeSecureItem(this.E2E_USER_KEY);
    }
  }
}
