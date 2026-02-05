/**
 * GraphBuilder - Transforms Firestore entities into Voxel graph structures
 *
 * Converts raw GRC data (Assets, Risks, Controls, etc.) into VoxelNode
 * and VoxelEdge structures for 3D visualization.
 *
 * @see Story VOX-6.1: Data Transformer Service
 * @see Story VOX-6.4: Graph Building Service
 */

import type { Asset } from '@/types/assets';
import type { Risk } from '@/types/risks';
import type { Control } from '@/types/controls';
import { RISK_THRESHOLDS, CONTROL_STATUS } from '@/constants/complianceConfig';
import type { Project } from '@/types/projects';
import type { Audit } from '@/types/audits';
import type { Incident } from '@/types/incidents';
import type { Supplier } from '@/types/business';
import type { VoxelNode, VoxelEdge, VoxelNodeType, VoxelNodeStatus } from '@/types/voxel';
import { Criticality } from '@/types/common';

// ============================================================================
// Types
// ============================================================================

export interface GraphBuilderInput {
 assets: Asset[];
 risks: Risk[];
 controls: Control[];
 projects?: Project[];
 audits?: Audit[];
 incidents?: Incident[];
 suppliers?: Supplier[];
}

export interface VoxelGraph {
 nodes: VoxelNode[];
 edges: VoxelEdge[];
}

// ============================================================================
// Constants
// ============================================================================

const NODE_SIZES: Record<VoxelNodeType, number> = {
 asset: 1.0,
 risk: 1.2,
 control: 0.9,
 audit: 0.8,
 project: 1.1,
 incident: 1.0,
 supplier: 0.85,
};

// ============================================================================
// Status Mappers
// ============================================================================

function mapAssetStatus(asset: Asset): VoxelNodeStatus {
 // Map asset criticality to status
 const maxCriticality = Math.max(
 criticalityToNumber(asset.confidentiality),
 criticalityToNumber(asset.integrity),
 criticalityToNumber(asset.availability)
 );

 if (maxCriticality >= 4) return 'critical';
 if (maxCriticality >= 3) return 'warning';
 if (asset.lifecycleStatus === 'Fin de vie' || asset.lifecycleStatus === 'Rebut') {
 return 'inactive';
 }
 return 'normal';
}

function criticalityToNumber(criticality: string): number {
 const map: Record<string, number> = {
 Négligeable: 1,
 Faible: 2,
 Moyen: 3,
 Élevé: 4,
 Critique: 5,
 };
 return map[criticality] || 2;
}

function mapRiskStatus(risk: Risk): VoxelNodeStatus {
 if (risk.status === 'Fermé') return 'inactive';
 if (risk.score >= RISK_THRESHOLDS.CRITICAL) return 'critical';
 if (risk.score >= RISK_THRESHOLDS.HIGH) return 'warning';
 return 'normal';
}

function mapControlStatus(control: Control): VoxelNodeStatus {
 if (control.status === CONTROL_STATUS.NOT_APPLICABLE || control.status === CONTROL_STATUS.EXCLUDED) {
 return 'inactive';
 }
 if (control.status === CONTROL_STATUS.NOT_STARTED || control.status === CONTROL_STATUS.OVERDUE) {
 return 'critical';
 }
 if (control.status === CONTROL_STATUS.PARTIAL || control.status === CONTROL_STATUS.IN_PROGRESS || control.status === CONTROL_STATUS.PLANNED) {
 return 'warning';
 }
 return 'normal';
}

function mapProjectStatus(project: Project): VoxelNodeStatus {
 if (project.status === 'Suspendu' || project.status === 'Terminé') return 'inactive';
 // Check progress for risk indicators
 if (project.progress < 30 && project.status === 'En cours') return 'warning';
 return 'normal';
}

function mapAuditStatus(audit: Audit): VoxelNodeStatus {
 if (audit.status === 'Terminé' || audit.status === 'Validé') return 'inactive';
 if (audit.findingsCount > 10) return 'critical';
 if (audit.findingsCount > 5) return 'warning';
 return 'normal';
}

function mapIncidentStatus(incident: Incident): VoxelNodeStatus {
 if (incident.status === 'Fermé' || incident.status === 'Résolu') return 'inactive';
 if (incident.severity === Criticality.CRITICAL || incident.severity === Criticality.HIGH) return 'critical';
 if (incident.severity === Criticality.MEDIUM) return 'warning';
 return 'normal';
}

function mapSupplierStatus(supplier: Supplier): VoxelNodeStatus {
 if (supplier.status === 'Suspendu' || supplier.status === 'Terminé') return 'inactive';
 if (supplier.riskLevel === 'High' || supplier.riskLevel === 'Critical') return 'critical';
 if (supplier.riskLevel === 'Medium') return 'warning';
 if (supplier.criticality === Criticality.CRITICAL || supplier.criticality === Criticality.HIGH) return 'warning';
 return 'normal';
}

// ============================================================================
// Node Builders
// ============================================================================

function buildAssetNode(asset: Asset, index: number): VoxelNode {
 return {
 id: asset.id,
 type: 'asset',
 label: asset.name,
 status: mapAssetStatus(asset),
 position: calculateInitialPosition('asset', index),
 size: NODE_SIZES.asset,
 data: {
 owner: asset.owner,
 type: asset.type,
 location: asset.location,
 confidentiality: asset.confidentiality,
 integrity: asset.integrity,
 availability: asset.availability,
 lifecycleStatus: asset.lifecycleStatus,
 },
 connections: [],
 networkSegment: asset.otDetails?.networkSegment,
 otDetails: asset.otDetails
 ? {
 deviceType: asset.otDetails.deviceType,
 protocol: asset.otDetails.protocol,
 manufacturer: asset.otDetails.manufacturer,
 model: asset.otDetails.model,
 firmwareVersion: asset.otDetails.firmwareVersion,
 criticality: asset.otDetails.otCriticality,
 }
 : undefined,
 createdAt: new Date(asset.createdAt),
 updatedAt: asset.updatedAt ? new Date(asset.updatedAt) : new Date(asset.createdAt),
 };
}

function buildRiskNode(risk: Risk, index: number): VoxelNode {
 return {
 id: risk.id,
 type: 'risk',
 label: risk.threat,
 status: mapRiskStatus(risk),
 position: calculateInitialPosition('risk', index),
 size: NODE_SIZES.risk * (1 + risk.score / 25), // Scale by risk score
 data: {
 threat: risk.threat,
 vulnerability: risk.vulnerability,
 probability: risk.probability,
 impact: risk.impact,
 score: risk.score,
 residualScore: risk.residualScore,
 strategy: risk.strategy,
 status: risk.status,
 owner: risk.owner,
 assetId: risk.assetId,
 },
 connections: [risk.assetId, ...(risk.mitigationControlIds || [])],
 createdAt: risk.createdAt ? new Date(risk.createdAt) : new Date(),
 updatedAt: risk.createdAt ? new Date(risk.createdAt) : new Date(),
 };
}

function buildControlNode(control: Control, index: number): VoxelNode {
 return {
 id: control.id,
 type: 'control',
 label: `${control.code}: ${control.name}`,
 status: mapControlStatus(control),
 position: calculateInitialPosition('control', index),
 size: NODE_SIZES.control,
 data: {
 code: control.code,
 name: control.name,
 framework: control.framework,
 type: control.type,
 status: control.status,
 owner: control.owner,
 maturity: control.maturity,
 },
 connections: [
 ...(control.relatedAssetIds || []),
 ...(control.relatedRiskIds || []),
 ],
 createdAt: control.lastUpdated ? new Date(control.lastUpdated) : new Date(),
 updatedAt: control.lastUpdated ? new Date(control.lastUpdated) : new Date(),
 };
}

function buildProjectNode(project: Project, index: number): VoxelNode {
 return {
 id: project.id,
 type: 'project',
 label: project.name,
 status: mapProjectStatus(project),
 position: calculateInitialPosition('project', index),
 size: NODE_SIZES.project,
 data: {
 name: project.name,
 status: project.status,
 progress: project.progress,
 startDate: project.startDate,
 dueDate: project.dueDate,
 manager: project.manager,
 },
 connections: [
 ...(project.relatedRiskIds || []),
 ...(project.relatedControlIds || []),
 ...(project.relatedAssetIds || []),
 ],
 createdAt: project.createdAt ? new Date(project.createdAt) : new Date(),
 updatedAt: project.updatedAt ? new Date(project.updatedAt) : new Date(),
 };
}

function buildAuditNode(audit: Audit, index: number): VoxelNode {
 return {
 id: audit.id,
 type: 'audit',
 label: audit.name || `Audit ${audit.id.slice(0, 8)}`,
 status: mapAuditStatus(audit),
 position: calculateInitialPosition('audit', index),
 size: NODE_SIZES.audit,
 data: {
 name: audit.name,
 type: audit.type,
 status: audit.status,
 framework: audit.framework,
 dateScheduled: audit.dateScheduled,
 findingsCount: audit.findingsCount,
 auditor: audit.auditor,
 },
 connections: [],
 createdAt: audit.dateScheduled ? new Date(audit.dateScheduled) : new Date(),
 updatedAt: audit.dateScheduled ? new Date(audit.dateScheduled) : new Date(),
 };
}

function buildIncidentNode(incident: Incident, index: number): VoxelNode {
 return {
 id: incident.id,
 type: 'incident',
 label: incident.title,
 status: mapIncidentStatus(incident),
 position: calculateInitialPosition('incident', index),
 size: NODE_SIZES.incident,
 data: {
 title: incident.title,
 severity: incident.severity,
 status: incident.status,
 category: incident.category,
 dateReported: incident.dateReported,
 reporter: incident.reporter,
 },
 connections: incident.affectedAssetId ? [incident.affectedAssetId] : [],
 createdAt: incident.dateReported ? new Date(incident.dateReported) : new Date(),
 updatedAt: incident.dateResolved ? new Date(incident.dateResolved) : new Date(incident.dateReported || Date.now()),
 };
}

function buildSupplierNode(supplier: Supplier, index: number): VoxelNode {
 return {
 id: supplier.id,
 type: 'supplier',
 label: supplier.name,
 status: mapSupplierStatus(supplier),
 position: calculateInitialPosition('supplier', index),
 size: NODE_SIZES.supplier,
 data: {
 name: supplier.name,
 category: supplier.category,
 criticality: supplier.criticality,
 riskLevel: supplier.riskLevel,
 status: supplier.status,
 securityScore: supplier.securityScore,
 },
 connections: [
 ...(supplier.relatedAssetIds || []),
 ...(supplier.relatedRiskIds || []),
 ],
 createdAt: supplier.createdAt ? new Date(supplier.createdAt) : new Date(),
 updatedAt: supplier.updatedAt ? new Date(supplier.updatedAt) : new Date(),
 };
}

// ============================================================================
// Position Calculation
// ============================================================================

/**
 * Calculate initial position for a node in 3D space.
 * Uses a spherical distribution based on node type and index.
 * Final positions will be adjusted by layout algorithms.
 */
function calculateInitialPosition(
 type: VoxelNodeType,
 index: number
): { x: number; y: number; z: number } {
 const typeOffsets: Record<VoxelNodeType, { layer: number; radius: number }> = {
 asset: { layer: 0, radius: 20 },
 risk: { layer: 1, radius: 35 },
 control: { layer: 2, radius: 50 },
 project: { layer: 0.5, radius: 25 },
 audit: { layer: 1.5, radius: 40 },
 incident: { layer: 1, radius: 30 },
 supplier: { layer: 2, radius: 45 },
 };

 const { layer, radius } = typeOffsets[type];

 // Golden angle for even distribution
 const goldenAngle = Math.PI * (3 - Math.sqrt(5));
 const theta = goldenAngle * index;
 const phi = Math.acos(1 - (2 * (index + 0.5)) / 100);

 return {
 x: radius * Math.sin(phi) * Math.cos(theta),
 y: layer * 15, // Vertical separation by type
 z: radius * Math.sin(phi) * Math.sin(theta),
 };
}

// ============================================================================
// Edge Builders
// ============================================================================

function buildEdges(
 _assets: Asset[],
 risks: Risk[],
 controls: Control[],
 incidents?: Incident[]
): VoxelEdge[] {
 const edges: VoxelEdge[] = [];
 const edgeSet = new Set<string>();

 // Risk → Asset (impact edges)
 risks.forEach((risk) => {
 if (risk.assetId) {
 const edgeId = `${risk.id}-${risk.assetId}`;
 if (!edgeSet.has(edgeId)) {
 edges.push({
 id: edgeId,
 source: risk.id,
 target: risk.assetId,
 type: 'impact',
 weight: risk.score / 25, // Normalize to 0-1
 });
 edgeSet.add(edgeId);
 }
 }
 });

 // Control → Risk (mitigation edges)
 risks.forEach((risk) => {
 (risk.mitigationControlIds || []).forEach((controlId) => {
 const edgeId = `${controlId}-${risk.id}`;
 if (!edgeSet.has(edgeId)) {
 edges.push({
 id: edgeId,
 source: controlId,
 target: risk.id,
 type: 'mitigation',
 weight: 0.7,
 });
 edgeSet.add(edgeId);
 }
 });
 });

 // Control → Asset (dependency edges)
 controls.forEach((control) => {
 (control.relatedAssetIds || []).forEach((assetId) => {
 const edgeId = `${control.id}-${assetId}`;
 if (!edgeSet.has(edgeId)) {
 edges.push({
 id: edgeId,
 source: control.id,
 target: assetId,
 type: 'dependency',
 weight: 0.5,
 });
 edgeSet.add(edgeId);
 }
 });
 });

 // Incident → Asset (impact edges)
 (incidents || []).forEach((incident) => {
 if (incident.affectedAssetId) {
 const edgeId = `${incident.id}-${incident.affectedAssetId}`;
 if (!edgeSet.has(edgeId)) {
 const severityWeight =
 incident.severity === Criticality.CRITICAL ? 1 :
 incident.severity === Criticality.HIGH ? 0.8 :
 incident.severity === Criticality.MEDIUM ? 0.6 : 0.4;
 edges.push({
 id: edgeId,
 source: incident.id,
 target: incident.affectedAssetId,
 type: 'impact',
 weight: severityWeight,
 });
 edgeSet.add(edgeId);
 }
 }
 });

 return edges;
}

// ============================================================================
// Main Builder
// ============================================================================

/**
 * Build a complete Voxel graph from Firestore entities.
 *
 * @param input - Raw Firestore data (assets, risks, controls, etc.)
 * @returns VoxelGraph with nodes and edges
 */
export function buildGraph(input: GraphBuilderInput): VoxelGraph {
 const nodes: VoxelNode[] = [];

 // Build nodes for each entity type
 input.assets.forEach((asset, index) => {
 nodes.push(buildAssetNode(asset, index));
 });

 input.risks.forEach((risk, index) => {
 nodes.push(buildRiskNode(risk, index));
 });

 input.controls.forEach((control, index) => {
 nodes.push(buildControlNode(control, index));
 });

 (input.projects || []).forEach((project, index) => {
 nodes.push(buildProjectNode(project, index));
 });

 (input.audits || []).forEach((audit, index) => {
 nodes.push(buildAuditNode(audit, index));
 });

 (input.incidents || []).forEach((incident, index) => {
 nodes.push(buildIncidentNode(incident, index));
 });

 (input.suppliers || []).forEach((supplier, index) => {
 nodes.push(buildSupplierNode(supplier, index));
 });

 // Build edges
 const edges = buildEdges(input.assets, input.risks, input.controls, input.incidents);

 // Update node connections based on edges
 const nodeMap = new Map(nodes.map((n) => [n.id, n]));
 edges.forEach((edge) => {
 const sourceNode = nodeMap.get(edge.source);
 const targetNode = nodeMap.get(edge.target);
 if (sourceNode && !sourceNode.connections.includes(edge.target)) {
 sourceNode.connections.push(edge.target);
 }
 if (targetNode && !targetNode.connections.includes(edge.source)) {
 targetNode.connections.push(edge.source);
 }
 });

 return { nodes, edges };
}

/**
 * Update a single node in the graph without rebuilding everything.
 * Used for real-time updates.
 */
export function updateNodeFromEntity(
 entity: Asset | Risk | Control | Project | Audit | Incident | Supplier,
 entityType: VoxelNodeType,
 existingNode: VoxelNode
): VoxelNode {
 switch (entityType) {
 case 'asset':
 return { ...buildAssetNode(entity as Asset, 0), position: existingNode.position };
 case 'risk':
 return { ...buildRiskNode(entity as Risk, 0), position: existingNode.position };
 case 'control':
 return { ...buildControlNode(entity as Control, 0), position: existingNode.position };
 case 'project':
 return { ...buildProjectNode(entity as Project, 0), position: existingNode.position };
 case 'audit':
 return { ...buildAuditNode(entity as Audit, 0), position: existingNode.position };
 case 'incident':
 return { ...buildIncidentNode(entity as Incident, 0), position: existingNode.position };
 case 'supplier':
 return { ...buildSupplierNode(entity as Supplier, 0), position: existingNode.position };
 default:
 return existingNode;
 }
}

export const GraphBuilder = {
 buildGraph,
 updateNodeFromEntity,
};

export default GraphBuilder;
