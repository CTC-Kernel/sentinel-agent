import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

interface UseDeepLinkActionProps<T> {
    data: T[];
    loading: boolean;
    onOpen: (item: T) => void;
    onCreate: () => void;
    onCreateWithPreset?: (preset: Record<string, string>) => void;
    currentSelection: T | null;
    isCreationMode: boolean;
}

export const useDeepLinkAction = <T extends { id: string }>({
    data,
    loading,
    onOpen,
    onCreate,
    onCreateWithPreset,
    currentSelection,
    isCreationMode
}: UseDeepLinkActionProps<T>) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const deepLinkId = searchParams.get('id');
    const deepLinkAction = searchParams.get('action');
    const deepLinkAssetId = searchParams.get('createForAsset');

    useEffect(() => {
        if (loading) return;

        // 1. Open Detail (ID)
        if (deepLinkId && data.length > 0) {
            const item = data.find(i => i.id === deepLinkId);
            if (item && currentSelection?.id !== item.id) {
                onOpen(item);
            }
        }

        // 2. Open Create Mode
        else if (deepLinkAction === 'create' && !isCreationMode) {
            onCreate();
            setSearchParams(params => {
                params.delete('action');
                return params;
            }, { replace: true });
        }

        // 3. Create with Preset (e.g. for Asset)
        else if (deepLinkAssetId && !isCreationMode && onCreateWithPreset) {
            onCreateWithPreset({ assetId: deepLinkAssetId });
            setSearchParams(params => {
                params.delete('createForAsset');
                return params;
            }, { replace: true });
        }
    }, [loading, deepLinkId, deepLinkAction, deepLinkAssetId, data, isCreationMode, currentSelection]); // Ensure searchParams is stable or excluded if it causes loops

    // Cleanup ID param when closing
    useEffect(() => {
        if (loading) return;

        if (!currentSelection && deepLinkId) {
            setSearchParams(params => {
                params.delete('id');
                return params;
            }, { replace: true });
        }
    }, [currentSelection, deepLinkId, loading]);
};
