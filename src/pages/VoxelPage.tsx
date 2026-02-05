/**
 * VoxelPage - Entry point for the 3D Voxel visualization module
 *
 * This page provides a lazy-loaded container for the VoxelViewer component,
 * which renders the React Three Fiber canvas for 3D GRC data visualization.
 *
 * @see Story VOX-1.1: R3F Canvas Integration
 */

import React, { Suspense } from 'react';
import { useStore } from '@/store';
import { SEO } from '@/components/SEO';
import { PageHeader } from '@/components/ui/PageHeader';
import { VoxelSkeleton } from '@/components/voxel/fallback/VoxelSkeleton';

// Lazy-load VoxelViewer to reduce initial bundle size
const VoxelViewer = React.lazy(() =>
 import('@/components/voxel/VoxelViewer').then(m => ({ default: m.VoxelViewer }))
);

export const VoxelPage: React.FC = () => {
 const { t } = useStore();

 return (
 <div className="flex flex-col h-full min-h-[calc(100vh-48px)]">
 <SEO
 title={t('voxel.title')}
 description={t('voxel.description')}
 keywords="3D, Visualization, GRC, Cybersecurity, Risk Management"
 />

 <PageHeader
 title={t('voxel.title')}
 subtitle={t('voxel.subtitle')}
 breadcrumbs={[
 { label: t('common.pilotage') },
 { label: t('voxel.title') }
 ]}
 />

 <div className="flex-1 relative">
 <Suspense fallback={<VoxelSkeleton />}>
 <VoxelViewer />
 </Suspense>
 </div>
 </div>
 );
};

export default VoxelPage;
