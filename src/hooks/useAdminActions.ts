import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../firebase';
import { useStore } from '../store';
import { useAuth } from './useAuth';
import { hasPermission } from '../utils/permissions';
import { AuditLogService } from '../services/auditLogService';
import { ErrorLogger } from '../services/errorLogger';
import { toast } from '@/lib/toast';

export const useAdminActions = () => {
 const { user } = useAuth();
 const { t } = useStore();
 const [switchingOrg, setSwitchingOrg] = useState<string | null>(null);

 const verifySuperAdmin = useCallback(async (): Promise<boolean> => {
 try {
 const functions = getFunctions(app, 'europe-west1');
 const checkAdmin = httpsCallable(functions, 'verifySuperAdmin');
 const result = await checkAdmin();
 const data = result.data as { isSuperAdmin: boolean; claimGranted?: boolean };

 // If claim was just granted, refresh the token to pick up new claims
 if (data.claimGranted && auth.currentUser) {
 await auth.currentUser.getIdToken(true);
 }

 return data.isSuperAdmin;
 } catch (error) {
 ErrorLogger.error(error as Error, 'useAdminActions.verifySuperAdmin');
 return false;
 }
 }, []);

 const handleManage = async (orgId: string, orgName: string) => {
 // SECURITY: Null guard + local permission check for super-admin / manage organization
 // Although the backend verifies the claim, a local check prevents UI spamming/misuse
 if (!user || !hasPermission(user, 'Organization', 'manage')) {
 toast.error(t('common.accessDenied'));
 return;
 }

 setSwitchingOrg(orgId);
 try {
 const functions = getFunctions(app, 'europe-west1');
 const switchOrgFn = httpsCallable(functions, 'switchOrganization');
 await switchOrgFn({ targetOrgId: orgId });

 // Audit Log the organization switch for compliance
 await AuditLogService.log({
 organizationId: user.organizationId || 'superadmin',
 userId: user.uid,
 userName: user.displayName || '',
 userEmail: user.email || '',
 action: 'status_change', // Using status_change for role/context shift
 entityType: 'organization',
 entityId: orgId,
 entityName: orgName,
 details: `Admin switched context to organization: ${orgName}`
 });

 // Force token refresh to pick up new claims
 if (auth.currentUser) {
 await auth.currentUser.getIdToken(true);
 }

 toast.success(t('admin.toast.switchSuccess', { name: orgName }));
 // Intentional: full page reload after org switch to reinitialize all state
 window.location.href = '/';
 } catch (error) {
 ErrorLogger.error(error as Error, 'useAdminActions.handleManage');
 toast.error(t('admin.toast.switchError'));
 setSwitchingOrg(null);
 }
 };

 return {
 verifySuperAdmin,
 handleManage,
 switchingOrg
 };
};
