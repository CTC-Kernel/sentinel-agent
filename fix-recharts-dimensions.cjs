#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixRechartsDimensions(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Pattern 1: Find ResponsiveContainer without minWidth/minHeight
        const responsiveContainerPattern = /<ResponsiveContainer([^>]*width="100%"[^>]*height="100%"[^>]*)>/gs;
        
        content = content.replace(responsiveContainerPattern, (match, attributes) => {
            // Check if minWidth or minHeight is already present
            if (attributes.includes('minWidth') || attributes.includes('minHeight')) {
                return match;
            }
            
            // Add minWidth and minHeight attributes
            const newAttributes = attributes.replace(/height="100%"/, 'height="100%" minWidth={200} minHeight={224}');
            modified = true;
            return `<ResponsiveContainer${newAttributes}>`;
        });
        
        // Pattern 2: Find containers with only h-[number] class
        const containerPattern = /className="h-(\d+)(?:\s+min-h-\d+)?"/gs;
        
        content = content.replace(containerPattern, (match, height) => {
            // If min-h is already present, skip
            if (match.includes('min-h-')) {
                return match;
            }
            
            // Add min-h class
            modified = true;
            return `className="h-${height} min-h-${height}"`;
        });
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✓ Fixed Recharts dimensions in ${filePath}`);
        } else {
            console.log(`- No Recharts fixes needed for ${filePath}`);
        }
        
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
    }
}

// Get all files with ResponsiveContainer
const rechartsFiles = [
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/continuity/dashboard/ContinuityCharts.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/settings/AgentManagement.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/settings/AgentDetailsModal.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/suppliers/SupplierDashboard.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/audits/dashboard/AuditCharts.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/audits/AuditPremiumStats.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/audits/SingleAuditStats.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/threats/ThreatDashboard.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/training/widgets/TrainingByDepartment.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/training/widgets/TrainingTrendChart.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/projects/ProjectDashboard.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/projects/PortfolioDashboard.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/smsi/SMSIPremiumStats.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/agents/AgentFleetDashboard.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/voxel/TrendCharts.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/compliance/dashboard/ComplianceCharts.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/compliance/ComplianceStatsWidget.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/dashboard/AnalyticsDashboard.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/dashboard/widgets/ComplianceProgressWidget.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/dashboard/widgets/AuditsDonutWidget.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/dashboard/widgets/AgentMaturityRadarWidget.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/dashboard/widgets/ComplianceEvolutionWidget.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/dashboard/widgets/PremiumHealthCard.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/dashboard/widgets/MaturityRadarWidget.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/risks/RiskTreatmentChart.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/risks/RiskResidualChart.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/risks/RiskDashboard.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/documents/DocumentsCharts.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/assets/AssetDashboard.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/vulnerabilities/OTExposureWidget.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/vulnerabilities/VulnerabilityDashboard.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/vulnerabilities/VulnerabilityOverview.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/vendor-concentration/CategoryChart.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/incidents/dashboard/IncidentOverview.tsx',
    '/Users/thibaultllopis/sentinel-grc-v2-prod/sentinel-grc-v2-prod/src/components/incidents/dashboard/IncidentCharts.tsx'
];

console.log('🔧 Fixing Recharts dimensions...\n');

rechartsFiles.forEach(fixRechartsDimensions);

console.log('\n✅ Recharts dimension fixing complete!');
