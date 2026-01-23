/**
 * Supplier DORA Synchronization Service
 * 
 * Service responsible for synchronizing Suppliers with ICT Providers
 * to ensure data consistency between the two modules.
 * 
 * Story: Unified Supplier-DORA Management
 * Priority: Critical - Prevents data divergence
 */

import { Supplier } from '../types/business';
import { ICTProvider, ICTCriticality, ICTServiceType } from '../types/dora';
import { SupplierService } from './SupplierService';
import { ICTProviderService } from './ICTProviderService';
import { ErrorLogger } from './errorLogger';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export class SupplierDoraSyncService {
    private static readonly SYNC_COLLECTION = 'supplier_dora_sync';
    private static readonly SYNC_FIELD = 'lastDoraSyncAt';

    /**
     * Synchronizes a supplier to ICT Provider if it's marked as ICT Provider
     * @param supplierId - The supplier ID to sync
     * @param organizationId - The organization ID (required for security)
     * @returns Promise<boolean> - True if sync was performed, false if not needed
     */
    static async syncSupplierToICTProvider(supplierId: string, organizationId?: string): Promise<boolean> {
        try {
            // If organizationId not provided, we need to get it from the supplier document directly
            // This is a security fallback - caller should always provide organizationId when known
            let supplier: Supplier | null = null;
            if (organizationId) {
                supplier = await SupplierService.getById(supplierId, organizationId);
            } else {
                // Direct fetch without org validation (legacy support - to be deprecated)
                const supplierDoc = await getDoc(doc(db, 'suppliers', supplierId));
                if (supplierDoc.exists()) {
                    supplier = supplierDoc.data() as Supplier;
                }
                ErrorLogger.warn('syncSupplierToICTProvider called without organizationId - using legacy fallback', 'SupplierDoraSyncService');
            }
            if (!supplier) {
                ErrorLogger.warn(`Supplier ${supplierId} not found for DORA sync`, 'SupplierDoraSyncService.syncSupplierToICTProvider');
                return false;
            }

            // Only sync if supplier is marked as ICT Provider
            if (!supplier.isICTProvider) {
                return false;
            }

            // Check if sync is needed (avoid unnecessary updates)
            const lastSync = await this.getLastSyncTime(supplierId);
            const supplierUpdated = new Date(supplier.updatedAt);
            if (lastSync && lastSync >= supplierUpdated) {
                return false; // Already up to date
            }

            // Map Supplier to ICT Provider
            const ictProvider = this.mapSupplierToICTProvider(supplier);
            
            // Check if ICT Provider already exists
            const existingProviders = await ICTProviderService.getAll(supplier.organizationId);
            const existingProvider = existingProviders.find(p => 
                p.name === supplier.name || this.isSameEntity(p, supplier)
            );

            if (existingProvider) {
                // Update existing provider
                await ICTProviderService.update(existingProvider.id, ictProvider, supplier.organizationId);
                await this.updateSyncTimestamp(supplierId);
                ErrorLogger.info(`Updated ICT Provider ${existingProvider.id} from Supplier ${supplierId}`, 'SupplierDoraSyncService.syncSupplierToICTProvider');
            } else {
                // Create new provider
                const newProviderId = await ICTProviderService.create(supplier.organizationId, ictProvider, 'system-sync');
                await this.updateSyncTimestamp(supplierId);
                await this.linkSupplierToICTProvider(supplierId, newProviderId);
                ErrorLogger.info(`Created ICT Provider ${newProviderId} from Supplier ${supplierId}`, 'SupplierDoraSyncService.syncSupplierToICTProvider');
            }

            return true;

        } catch (error) {
            ErrorLogger.error(error, 'SupplierDoraSyncService.syncSupplierToICTProvider', { metadata: { supplierId } });
            throw error;
        }
    }

    /**
     * Synchronizes all ICT Provider suppliers for an organization
     * @param organizationId - The organization ID
     * @returns Promise<number> - Number of suppliers synced
     */
    static async syncAllICTSuppliers(organizationId: string): Promise<number> {
        try {
            const suppliers = await SupplierService.getAll(organizationId);
            const ictSuppliers = suppliers.filter(s => s.isICTProvider);
            
            let syncCount = 0;
            for (const supplier of ictSuppliers) {
                try {
                    const synced = await this.syncSupplierToICTProvider(supplier.id);
                    if (synced) syncCount++;
                } catch (error) {
                    ErrorLogger.error(error, 'SupplierDoraSyncService.syncAllICTSuppliers', { metadata: { supplierId: supplier.id } });
                    // Continue with other suppliers even if one fails
                }
            }

            ErrorLogger.info(`Synced ${syncCount}/${ictSuppliers.length} ICT suppliers for organization ${organizationId}`, 'SupplierDoraSyncService.syncAllICTSuppliers');
            return syncCount;

        } catch (error) {
            ErrorLogger.error(error, 'SupplierDoraSyncService.syncAllICTSuppliers', { metadata: { organizationId } });
            throw error;
        }
    }

    /**
     * Maps a Supplier entity to ICT Provider format
     * @param supplier - The supplier to map
     * @returns ICTProvider - Mapped ICT Provider
     */
    private static mapSupplierToICTProvider(supplier: Supplier): Omit<ICTProvider, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> {
        // Map criticality levels
        const criticalityMap: Record<string, ICTCriticality> = {
            'Critique': 'critical',
            'Élevée': 'important', 
            'Moyenne': 'standard',
            'Faible': 'standard',
            'Critical': 'critical',
            'High': 'important',
            'Medium': 'standard',
            'Low': 'standard'
        };

        // Map service types
        const serviceTypeMap: Record<string, ICTServiceType> = {
            'SaaS': 'software',
            'Cloud': 'cloud',
            'Software': 'software',
            'Hardware': 'infrastructure',
            'Consulting': 'other',
            'Network': 'telecom',
            'Security': 'security'
        };

        const ictCriticality = criticalityMap[supplier.criticality] || 'standard';
        const serviceType = serviceTypeMap[supplier.category] || 'other';

        return {
            organizationId: supplier.organizationId,
            name: supplier.name,
            category: ictCriticality,
            description: supplier.description,
            
            // Services - Create a default service based on supplier info
            services: [{
                id: `service-${supplier.id}`,
                name: supplier.serviceCatalog?.[0] || `${supplier.category} Service`,
                type: serviceType,
                criticality: ictCriticality,
                description: supplier.description,
                businessFunctions: supplier.supportedProcessIds || [],
                dataProcessed: true // Assume data processing for ICT providers
            }],

            // Contract information
            contractInfo: {
                startDate: supplier.createdAt,
                endDate: supplier.contract?.endDate || supplier.reviewDates?.contractEnd || '',
                exitStrategy: supplier.doraContractClauses?.exitStrategy ? 'Defined' : 'To be defined',
                auditRights: supplier.doraContractClauses?.auditRights || false,
                contractValue: undefined,
                currency: undefined,
                renewalType: 'manual',
                noticePeriodDays: 90
            },

            // Risk assessment
            riskAssessment: {
                concentration: supplier.riskLevel === 'Critical' ? 80 : 
                              supplier.riskLevel === 'High' ? 60 :
                              supplier.riskLevel === 'Medium' ? 40 : 20,
                substitutability: supplier.supportsCriticalFunction ? 'low' : 'medium',
                lastAssessment: supplier.assessment?.lastAssessmentDate || new Date().toISOString(),
                assessedBy: supplier.owner,
                notes: `Auto-synced from Supplier module. Risk level: ${supplier.riskLevel}`
            },

            // Compliance information
            compliance: {
                doraCompliant: supplier.assessment?.hasIso27001 || false,
                certifications: supplier.assessment?.hasIso27001 ? ['ISO 27001'] : [],
                locationEU: true, // Default assumption, should be verified
                headquartersCountry: undefined,
                dataProcessingLocations: undefined,
                subcontractors: []
            },

            // Contact information
            contactName: supplier.contactName,
            contactEmail: supplier.contactEmail,
            contactPhone: undefined,
            website: undefined,

            // Relationships
            linkedAssetIds: supplier.relatedAssetIds,
            linkedRiskIds: supplier.relatedRiskIds,
            linkedControlIds: [], // Not available in Supplier model

            // Metadata
            status: supplier.status === 'Actif' ? 'active' : 
                   supplier.status === 'Suspendu' ? 'inactive' :
                   supplier.status === 'Terminé' ? 'terminated' : 'pending',
            
            // DORA specific
            doraRegisterId: undefined,
            lastReportDate: undefined
        };
    }

    /**
     * Checks if an ICT Provider represents the same entity as a Supplier
     * @param ictProvider - The ICT Provider
     * @param supplier - The Supplier
     * @returns boolean - True if they represent the same entity
     */
    private static isSameEntity(ictProvider: ICTProvider, supplier: Supplier): boolean {
        // Check by name similarity
        if (ictProvider.name.toLowerCase() === supplier.name.toLowerCase()) {
            return true;
        }

        // Check by email if both have contact emails
        if (ictProvider.contactEmail && supplier.contactEmail) {
            return ictProvider.contactEmail.toLowerCase() === supplier.contactEmail.toLowerCase();
        }

        return false;
    }

    /**
     * Gets the last sync timestamp for a supplier
     * @param supplierId - The supplier ID
     * @returns Promise<Date | null> - Last sync time or null
     */
    private static async getLastSyncTime(supplierId: string): Promise<Date | null> {
        try {
            const syncDoc = await getDoc(doc(db, this.SYNC_COLLECTION, supplierId));
            if (syncDoc.exists()) {
                const data = syncDoc.data();
                return data[this.SYNC_FIELD] ? new Date(data[this.SYNC_FIELD]) : null;
            }
            return null;
        } catch {
            ErrorLogger.warn(`Failed to get sync time for supplier ${supplierId}`, 'SupplierDoraSyncService.getLastSyncTime');
            return null;
        }
    }

    /**
     * Updates the sync timestamp for a supplier
     * @param supplierId - The supplier ID
     */
    private static async updateSyncTimestamp(supplierId: string): Promise<void> {
        try {
            await updateDoc(doc(db, this.SYNC_COLLECTION, supplierId), {
                [this.SYNC_FIELD]: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } catch {
            ErrorLogger.warn(`Failed to update sync timestamp for supplier ${supplierId}`, 'SupplierDoraSyncService.updateSyncTimestamp');
        }
    }

    /**
     * Links a supplier to an ICT Provider in the supplier document
     * @param supplierId - The supplier ID
     * @param ictProviderId - The ICT Provider ID
     */
    private static async linkSupplierToICTProvider(supplierId: string, ictProviderId: string): Promise<void> {
        try {
            await updateDoc(doc(db, 'suppliers', supplierId), {
                linkedICTProviderId: ictProviderId,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            ErrorLogger.error(error, 'SupplierDoraSyncService.linkSupplierToICTProvider', { metadata: { supplierId, ictProviderId } });
        }
    }

    /**
     * Removes ICT Provider status from a supplier
     * @param supplierId - The supplier ID
     * @param organizationId - The organization ID (required for security)
     */
    static async removeICTProviderStatus(supplierId: string, organizationId?: string): Promise<void> {
        try {
            // First verify the supplier exists and belongs to the organization
            let supplier: Supplier | null = null;
            if (organizationId) {
                supplier = await SupplierService.getById(supplierId, organizationId);
            } else {
                // Direct fetch without org validation (legacy support - to be deprecated)
                const supplierDoc = await getDoc(doc(db, 'suppliers', supplierId));
                if (supplierDoc.exists()) {
                    supplier = supplierDoc.data() as Supplier;
                }
                ErrorLogger.warn('removeICTProviderStatus called without organizationId - using legacy fallback', 'SupplierDoraSyncService');
            }

            if (!supplier) {
                ErrorLogger.warn(`Supplier ${supplierId} not found or access denied`, 'SupplierDoraSyncService.removeICTProviderStatus');
                return;
            }

            // Update supplier to remove ICT Provider status
            await updateDoc(doc(db, 'suppliers', supplierId), {
                isICTProvider: false,
                linkedICTProviderId: null,
                updatedAt: new Date().toISOString()
            });

            // Find and deactivate corresponding ICT Provider
            const providers = await ICTProviderService.getAll(supplier.organizationId);
            const matchingProvider = providers.find(p => this.isSameEntity(p, supplier));

            if (matchingProvider) {
                await ICTProviderService.update(matchingProvider.id, {
                    status: 'terminated'
                }, supplier.organizationId);
            }

            ErrorLogger.info(`Removed ICT Provider status from supplier ${supplierId}`, 'SupplierDoraSyncService.removeICTProviderStatus');

        } catch (error) {
            ErrorLogger.error(error, 'SupplierDoraSyncService.removeICTProviderStatus', { metadata: { supplierId } });
            throw error;
        }
    }

    /**
     * Validates synchronization status for all suppliers in an organization
     * @param organizationId - The organization ID
     * @returns Promise<object> - Sync status report
     */
    static async validateSyncStatus(organizationId: string): Promise<{
        totalSuppliers: number;
        ictSuppliers: number;
        syncedSuppliers: number;
        outOfSyncSuppliers: string[];
        orphanedICTProviders: string[];
    }> {
        try {
            const suppliers = await SupplierService.getAll(organizationId);
            const ictProviders = await ICTProviderService.getAll(organizationId);
            
            const ictSuppliers = suppliers.filter(s => s.isICTProvider);
            const outOfSyncSuppliers: string[] = [];
            const orphanedICTProviders: string[] = [];

            // Check for out-of-sync suppliers
            for (const supplier of ictSuppliers) {
                const lastSync = await this.getLastSyncTime(supplier.id);
                const supplierUpdated = new Date(supplier.updatedAt);
                
                if (!lastSync || lastSync < supplierUpdated) {
                    outOfSyncSuppliers.push(supplier.id);
                }
            }

            // Check for orphaned ICT providers (no corresponding supplier)
            for (const provider of ictProviders) {
                const matchingSupplier = suppliers.find(s => this.isSameEntity(provider, s));
                if (!matchingSupplier || !matchingSupplier.isICTProvider) {
                    orphanedICTProviders.push(provider.id);
                }
            }

            return {
                totalSuppliers: suppliers.length,
                ictSuppliers: ictSuppliers.length,
                syncedSuppliers: ictSuppliers.length - outOfSyncSuppliers.length,
                outOfSyncSuppliers,
                orphanedICTProviders
            };

        } catch (error) {
            ErrorLogger.error(error, 'SupplierDoraSyncService.validateSyncStatus', { metadata: { organizationId } });
            throw error;
        }
    }
}
