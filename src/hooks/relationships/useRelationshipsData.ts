import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Asset, Risk, Control } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';

interface Node {
 id: string;
 type: 'Asset' | 'Risk' | 'Control';
 label: string;
 x: number;
 y: number;
 data?: Asset | Risk | Control;
}

interface Link {
 source: string;
 target: string;
}

interface RelationshipsData {
 nodes: Node[];
 links: Link[];
 loading: boolean;
}

export const useRelationshipsData = (
 rootId: string,
 rootType: 'Asset' | 'Risk',
 width: number,
 height: number
): RelationshipsData => {
 const { user } = useStore();
 const [nodes, setNodes] = useState<Node[]>([]);
 const [links, setLinks] = useState<Link[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!user?.organizationId) return;

 const orgId = user.organizationId;
 const fetchData = async () => {
 setLoading(true);
 const newNodes: Node[] = [];
 const newLinks: Link[] = [];
 const cx = width / 2;
 const cy = height / 2;

 try {
 if (rootType === 'Asset') {
 const assetSnap = await getDocs(query(collection(db, 'assets'), where('__name__', '==', rootId), where('organizationId', '==', orgId)));
 if (assetSnap.empty) return;
 const asset = { id: assetSnap.docs[0].id, ...assetSnap.docs[0].data() } as Asset;

 newNodes.push({ id: asset.id, type: 'Asset', label: asset.name, x: cx, y: cy, data: asset });

 const risksSnap = await getDocs(query(collection(db, 'risks'), where('organizationId', '==', orgId), where('assetId', '==', rootId), limit(20)));
 const risks = risksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Risk));

 risks.forEach((risk, i) => {
 const angle = (i / risks.length) * 2 * Math.PI;
 const r = 150;
 const nx = cx + r * Math.cos(angle);
 const ny = cy + r * Math.sin(angle);
 newNodes.push({ id: risk.id, type: 'Risk', label: risk.threat, x: nx, y: ny, data: risk });
 newLinks.push({ source: asset.id, target: risk.id });
 });

 } else if (rootType === 'Risk') {
 const riskSnap = await getDocs(query(collection(db, 'risks'), where('__name__', '==', rootId), where('organizationId', '==', orgId)));
 if (riskSnap.empty) return;
 const risk = { id: riskSnap.docs[0].id, ...riskSnap.docs[0].data() } as Risk;

 newNodes.push({ id: risk.id, type: 'Risk', label: risk.threat, x: cx, y: cy, data: risk });

 if (risk.assetId) {
 const assetSnap = await getDocs(query(collection(db, 'assets'), where('__name__', '==', risk.assetId), where('organizationId', '==', orgId)));
 if (!assetSnap.empty) {
 const asset = assetSnap.docs[0].data() as Asset;
 newNodes.push({ id: risk.assetId, type: 'Asset', label: asset.name, x: cx - 200, y: cy, data: asset });
 newLinks.push({ source: risk.assetId, target: risk.id });
 }
 }

 if (risk.mitigationControlIds && risk.mitigationControlIds.length > 0) {
 try {
 const chunks = [];
 for (let i = 0; i < risk.mitigationControlIds.length; i += 10) {
 chunks.push(risk.mitigationControlIds.slice(i, i + 10));
 }

 for (const chunk of chunks) {
 const controlsSnap = await getDocs(query(collection(db, 'controls'), where('organizationId', '==', orgId), where('__name__', 'in', chunk)));
 const controls = controlsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Control));

 controls.forEach((control, i) => {
  const nx = cx + 200;
  const ny = cy + (i - controls.length / 2) * 60;
  newNodes.push({ id: control.id, type: 'Control', label: control.code, x: nx, y: ny, data: control });
  newLinks.push({ source: risk.id, target: control.id });
 });
 }
 } catch (error) {
 ErrorLogger.error(error, 'useRelationshipsData.fetchLinkedControls');
 }
 }
 }

 setNodes(newNodes);
 setLinks(newLinks);
 } catch (e) {
 ErrorLogger.error(e, 'useRelationshipsData.fetchData');
 } finally {
 setLoading(false);
 }
 };

 fetchData();
 }, [rootId, rootType, width, height, user?.organizationId]);

 return { nodes, links, loading };
};
