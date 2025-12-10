import React from 'react';
import { SparklesCore } from '../components/ui/aceternity/Sparkles';
import { Spotlight } from '../components/ui/aceternity/Spotlight';
import { PageHeader } from '../components/ui/PageHeader';
import { Helmet } from 'react-helmet-async';
import { Sparkles } from 'lucide-react';

export const AceternityDemo: React.FC = () => {
    return (
        <div className="min-h-screen w-full bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center rounded-md">
            <Helmet>
                <title>Aceternity Demo - Sentinel GRC</title>
            </Helmet>

            {/* 
        Spotlight Effect 
        - Requires 'animate-spotlight' in tailwind.config.js
      */}
            <Spotlight
                className="-top-40 left-0 md:left-60 md:-top-20"
                fill="white"
            />

            <div className="relative z-10 w-full max-w-7xl mx-auto p-4 flex flex-col items-center justify-center">
                <PageHeader
                    title="Aceternity UI Integration"
                    subtitle="Validation des composants Premium UI sans impact sur l'existant."
                    breadcrumbs={[{ label: 'UI Demo' }]}
                    icon={<Sparkles className="h-6 w-6 text-white" />}
                />

                <div className="mt-8 text-center space-y-4">
                    <h1 className="text-4xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-opacity-50">
                        Premium Design <br /> is here.
                    </h1>
                    <p className="mt-4 font-normal text-base text-neutral-300 max-w-lg text-center mx-auto">
                        Sentinel GRC intègre désormais les composants Aceternity UI pour une expérience utilisateur futuriste et haut de gamme.
                    </p>
                </div>
            </div>

            {/* 
        Sparkles Effect 
        - Uses custom Canvas implementation (safe mode)
        - No heavy dependencies
      */}
            <div className="w-full h-40 relative mt-10">
                {/* Gradients */}
                <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 blur-sm" />
                <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4" />
                <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-[5px] w-1/4 blur-sm" />
                <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px w-1/4" />

                {/* Core Component */}
                <SparklesCore
                    background="transparent"
                    minSize={0.4}
                    maxSize={1}
                    particleDensity={1200}
                    className="w-full h-full"
                    particleColor="#FFFFFF"
                />

                {/* Radial Gradient to prevent sharp edges */}
                <div className="absolute inset-0 w-full h-full bg-slate-950 [mask-image:radial-gradient(350px_200px_at_top,transparent_20%,white)]"></div>
            </div>
        </div>
    );
};
