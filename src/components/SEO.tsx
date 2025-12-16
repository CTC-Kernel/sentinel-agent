import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title: string;
    description?: string;
    keywords?: string;
    name?: string;
    type?: string;
    image?: string;
    url?: string;
    structuredData?: Record<string, unknown>;
}

export const SEO: React.FC<SEOProps> = ({
    title,
    description = "Plateforme de Gouvernance, Risques et Conformité (GRC) optimisée par l'IA. Pilotez votre conformité ISO 27001, NIS2, DORA et gérez vos risques cyber en temps réel.",
    keywords = "GRC, ISO 27001, Conformité, Gestion des risques, Cybersécurité, NIS2, DORA, EBIOS RM",
    name = "Sentinel GRC",
    type = "website",
    image = "https://app.cyber-threat-consulting.com/og-image.jpg",
    url,
    structuredData
}) => {
    const siteUrl = "https://app.cyber-threat-consulting.com";
    const fullUrl = url ? `${siteUrl}${url}` : siteUrl;
    const fullTitle = `${title} | ${name}`;

    return (
        <Helmet>
            {/* Standard metadata */}
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords} />

            {/* Facebook tags */}
            <meta property="og:type" content={type} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:url" content={fullUrl} />
            <meta property="og:site_name" content={name} />

            {/* Twitter tags */}
            <meta name="twitter:creator" content="@SentinelGRC" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />

            {/* Canonical */}
            <link rel="canonical" href={fullUrl} />

            {/* JSON-LD Structured Data */}
            {structuredData && Object.keys(structuredData).length > 0 && (
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            )}
        </Helmet>
    );
};
