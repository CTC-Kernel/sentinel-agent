export type SsoProvider = 'password' | 'google' | 'apple' | 'microsoft' | 'okta' | 'saml';

export type SsoEnforcementMode = 'monitor' | 'strict';

export interface SsoSettings {
 organizationId: string;
 allowedProviders: SsoProvider[];
 defaultProvider: SsoProvider;
 enforcementMode: SsoEnforcementMode;
 notes?: string | null;
 updatedAt?: string | null;
 updatedBy?: string | null;
}
