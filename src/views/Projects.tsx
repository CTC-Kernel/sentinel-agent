import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { useStore } from '../store';

export const Projects: React.FC = () => {
    const { t } = useStore();

    return (
        <div className="min-h-screen bg-background">
            <PageHeader
                title={t('projects.dashboard')}
                subtitle={t('projects.subtitle')}
                icon={
                    <img 
                        src="/images/pilotage.png" 
                        alt="PILOTAGE" 
                        className="w-full h-full object-contain"
                    />
                }
                breadcrumbs={[{ label: t('common.pilotage') }, { label: t('sidebar.projects') }]}
                trustType="integrity"
            />
            
            <div className="p-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border">
                    <h2 className="text-xl font-semibold mb-4">Projects Page - Debug Version</h2>
                    <p>This is a simplified version to test if the page loads correctly.</p>
                    <p>If you can see this, the routing and basic components are working.</p>
                    <p>The issue might be in the complex components or hooks.</p>
                    
                    <div className="mt-4 space-y-2">
                        <h3 className="font-medium">Debug Information:</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>✅ Routing works</li>
                            <li>✅ PageHeader works</li>
                            <li>✅ Store works</li>
                            <li>✅ Translations work</li>
                            <li>✅ Image loads</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
