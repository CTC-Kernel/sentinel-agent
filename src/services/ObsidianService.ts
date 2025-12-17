import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Risk, Asset } from '../types';

/**
 * Service to handle export to Obsidian (Markdown/Key-Value)
 * Optimized for the Sentinel-GRC MCP Server Obsidian Plugin
 */
export class ObsidianService {

    /**
     * Convert a Risk object to Obsidian Markdown with Frontmatter
     */
    static formatRiskToMarkdown(risk: Risk): string {
        // Safe helpers
        const safeString = (val: string | undefined) => val ? `"${val.replace(/"/g, '\\"')}"` : '""';
        const tags = ['risk', `score/${risk.score}`, `status/${risk.status}`];
        if (risk.strategy) tags.push(`strategy/${risk.strategy}`);
        if (risk.framework) tags.push(`framework/${risk.framework}`);

        return `---
id: ${risk.id}
type: risk
title: ${safeString(risk.threat || 'Sans titre')}
threat: ${safeString(risk.threat || 'Sans titre')}
vulnerability: ${safeString(risk.vulnerability || '')}
probability: ${risk.probability || 0}
impact: ${risk.impact || 0}
score: ${risk.score || 0}
status: ${risk.status || 'Ouvert'}
strategy: ${risk.strategy || 'N/A'}
owner: ${safeString(risk.owner)}
created_at: ${risk.createdAt}
tags: [${tags.join(', ')}]
---

# ${risk.threat}

## Context
**Scenario**: ${risk.scenario || 'N/A'}
**Framework**: ${risk.framework || 'N/A'}
**Vulnerability**: ${risk.vulnerability || 'N/A'}

## Assessment
- **Probability**: ${risk.probability}/5
- **Impact**: ${risk.impact}/5
- **Gross Risk Score**: ${risk.score}/25
- **Residual Score**: ${risk.residualScore || 'N/A'}

## Treatment Plan
**Strategy**: ${risk.strategy || 'N/A'}
${risk.treatment ? `
- **Status**: ${risk.treatment.status || 'N/A'}
- **Due Date**: ${risk.treatment.dueDate || 'N/A'}
- **Description**: ${risk.treatment.description || 'N/A'}
` : 'No detailed treatment plan linked.'}

## Linked Assets
ID: [[ASSET-${risk.assetId}]]
`;
    }

    /**
     * Convert an Asset object to Obsidian Markdown
     */
    static formatAssetToMarkdown(asset: Asset): string {
        const safeString = (val: string | undefined) => val ? `"${val.replace(/"/g, '\\"')}"` : '""';
        // Confidentiality is an Enum (Faible, Moyenne, etc), so we just use it as string
        const tags = ['asset', `type/${asset.type}`.replace(/\s+/g, '_')];

        return `---
id: ${asset.id}
type: asset
name: ${safeString(asset.name)}
asset_type: ${safeString(asset.type)}
location: ${safeString(asset.location)}
owner: ${safeString(asset.owner)}
confidentiality: ${asset.confidentiality}
integrity: ${asset.integrity}
availability: ${asset.availability}
tags: [${tags.join(', ')}]
---

# ${asset.name}

## Overview
**Type**: ${asset.type}
**Owner**: ${asset.owner}
**Location**: ${asset.location}

## Security Classification
- **Confidentiality**: ${asset.confidentiality}
- **Integrity**: ${asset.integrity}
- **Availability**: ${asset.availability}

## Details
${(asset as any).description || 'No description provided.'}
${asset.ipAddress ? `- **IP Address**: ${asset.ipAddress}` : ''}
${asset.dataDetails ? `- **Data Format**: ${asset.dataDetails.format}` : ''}
`;
    }

    /**
     * Export a list of Risks as a Zip of Markdown files
     */
    static async exportRisksToObsidian(risks: Risk[]) {
        const zip = new JSZip();
        // Create a root folder inside the zip for cleanliness
        const folder = zip.folder("Sentinel_Risks_Obsidian");

        risks.forEach(risk => {
            // Sanitize filename
            const threat = risk.threat || 'Risque_sans_titre';
            const safeTitle = threat.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
            const filename = `RISK-${risk.id}-${safeTitle}.md`;
            folder?.file(filename, this.formatRiskToMarkdown(risk));
        });

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "Sentinel_Risk_Register_Obsidian.zip");
    }

    /**
     * Export a list of Assets as a Zip of Markdown files
     */
    static async exportAssetsToObsidian(assets: Asset[]) {
        const zip = new JSZip();
        const folder = zip.folder("Sentinel_Assets_Obsidian");

        assets.forEach(asset => {
            const safeName = asset.name.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
            const filename = `ASSET-${asset.id}-${safeName}.md`;
            folder?.file(filename, this.formatAssetToMarkdown(asset));
        });

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "Sentinel_Asset_Inventory_Obsidian.zip");
    }
}
