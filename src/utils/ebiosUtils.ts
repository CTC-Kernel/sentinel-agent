import { v4 as uuidv4 } from 'uuid';
import type { Asset } from '../types/assets';
import type { SupportingAsset } from '../types/ebios';

// Map global Asset type to EBIOS SupportingAsset type
export const mapAssetTypeToEbiosType = (
    assetType: Asset['type']
): SupportingAsset['type'] => {
    const mapping: Record<Asset['type'], SupportingAsset['type']> = {
        Matériel: 'hardware',
        Logiciel: 'software',
        Données: 'software', // Map data to software (closest match)
        Service: 'network', // Map service to network (external services)
        Humain: 'personnel',
    };
    return mapping[assetType] || 'organization';
};

// Convert Asset to SupportingAsset
export const mapAssetToSupportingAsset = (
    asset: Asset,
    linkedEssentialAssetIds: string[] = []
): SupportingAsset => {
    return {
        id: uuidv4(),
        name: asset.name,
        description: asset.notes || `${asset.type} - ${asset.location || 'N/A'}`,
        type: mapAssetTypeToEbiosType(asset.type),
        linkedEssentialAssetIds,
        linkedAssetId: asset.id, // Link to original asset
    };
};
