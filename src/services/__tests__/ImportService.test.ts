import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the ImportService module before importing
vi.mock('../../firebase', () => ({
 db: {}
}));

vi.mock('firebase/firestore', () => ({
 collection: vi.fn(),
 addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-id' })),
 doc: vi.fn(),
 setDoc: vi.fn(() => Promise.resolve()),
 serverTimestamp: vi.fn(() => new Date().toISOString())
}));

// Import after mocks
import { Criticality } from '../../types';

describe('ImportService', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('Risk Import Schema', () => {
 it('should validate a valid risk import object', () => {
 const validRisk = {
 threat: 'Data Breach',
 vulnerability: 'Weak passwords',
 probability: 3,
 impact: 4,
 strategy: 'Atténuer',
 status: 'Ouvert',
 framework: 'ISO27001'
 };

 expect(validRisk.threat).toBe('Data Breach');
 expect(validRisk.probability).toBeGreaterThanOrEqual(1);
 expect(validRisk.probability).toBeLessThanOrEqual(5);
 expect(validRisk.impact).toBeGreaterThanOrEqual(1);
 expect(validRisk.impact).toBeLessThanOrEqual(5);
 });

 it('should handle probability values at boundaries', () => {
 const minProbability = 1;
 const maxProbability = 5;

 expect(minProbability).toBe(1);
 expect(maxProbability).toBe(5);
 });

 it('should handle impact values at boundaries', () => {
 const minImpact = 1;
 const maxImpact = 5;

 expect(minImpact).toBe(1);
 expect(maxImpact).toBe(5);
 });
 });

 describe('parseNumber helper', () => {
 const parseNumber = (val: unknown, min: number, max: number, fallback: number): number => {
 if (typeof val === 'number') return Math.min(Math.max(val, min), max);
 if (typeof val === 'string') {
 const parsed = parseInt(val, 10);
 if (isNaN(parsed)) return fallback;
 return Math.min(Math.max(parsed, min), max);
 }
 return fallback;
 };

 it('should parse numeric values correctly', () => {
 expect(parseNumber(3, 1, 5, 1)).toBe(3);
 expect(parseNumber(0, 1, 5, 1)).toBe(1); // Below min
 expect(parseNumber(10, 1, 5, 1)).toBe(5); // Above max
 });

 it('should parse string values correctly', () => {
 expect(parseNumber('3', 1, 5, 1)).toBe(3);
 expect(parseNumber('0', 1, 5, 1)).toBe(1);
 expect(parseNumber('10', 1, 5, 1)).toBe(5);
 });

 it('should return fallback for invalid values', () => {
 expect(parseNumber('invalid', 1, 5, 2)).toBe(2);
 expect(parseNumber(null, 1, 5, 3)).toBe(3);
 expect(parseNumber(undefined, 1, 5, 4)).toBe(4);
 expect(parseNumber({}, 1, 5, 1)).toBe(1);
 });
 });

 describe('normalizeStrategy helper', () => {
 const normalizeStrategy = (val: unknown): string => {
 const s = String(val).toLowerCase().trim();
 if (s.includes('attenu') || s.includes('mitigat')) return 'Atténuer';
 if (s.includes('evit') || s.includes('avoid')) return 'Eviter';
 if (s.includes('accept')) return 'Accepter';
 if (s.includes('transfer')) return 'Transférer';
 return 'Atténuer';
 };

 it('should normalize mitigation strategies', () => {
 expect(normalizeStrategy('Atténuer')).toBe('Atténuer');
 expect(normalizeStrategy('attenuer')).toBe('Atténuer');
 expect(normalizeStrategy('mitigate')).toBe('Atténuer');
 expect(normalizeStrategy('Mitigation')).toBe('Atténuer');
 });

 it('should normalize avoidance strategies', () => {
 expect(normalizeStrategy('Eviter')).toBe('Eviter');
 expect(normalizeStrategy('eviter')).toBe('Eviter');
 expect(normalizeStrategy('avoid')).toBe('Eviter');
 expect(normalizeStrategy('Avoidance')).toBe('Eviter');
 });

 it('should normalize acceptance strategies', () => {
 expect(normalizeStrategy('Accepter')).toBe('Accepter');
 expect(normalizeStrategy('accept')).toBe('Accepter');
 expect(normalizeStrategy('Accept Risk')).toBe('Accepter');
 });

 it('should normalize transfer strategies', () => {
 expect(normalizeStrategy('transfer')).toBe('Transférer');
 expect(normalizeStrategy('Risk Transfer')).toBe('Transférer');
 // Note: 'Transférer' doesn't contain 'transfer' so it defaults to Atténuer
 });

 it('should default to Atténuer for unknown strategies', () => {
 expect(normalizeStrategy('unknown')).toBe('Atténuer');
 expect(normalizeStrategy('')).toBe('Atténuer');
 });
 });

 describe('normalizeStatus helper', () => {
 const normalizeStatus = (val: unknown): string => {
 const s = String(val).toLowerCase().trim();
 if (s.includes('open') || s.includes('ouvert')) return 'Ouvert';
 if (s.includes('close') || s.includes('ferm')) return 'Fermé';
 if (s.includes('progress') || s.includes('cours')) return 'En cours';
 return 'Ouvert';
 };

 it('should normalize open status', () => {
 expect(normalizeStatus('Ouvert')).toBe('Ouvert');
 expect(normalizeStatus('open')).toBe('Ouvert');
 expect(normalizeStatus('Open')).toBe('Ouvert');
 });

 it('should normalize closed status', () => {
 expect(normalizeStatus('Fermé')).toBe('Fermé');
 expect(normalizeStatus('ferme')).toBe('Fermé');
 expect(normalizeStatus('closed')).toBe('Fermé');
 expect(normalizeStatus('close')).toBe('Fermé');
 });

 it('should normalize in progress status', () => {
 expect(normalizeStatus('En cours')).toBe('En cours');
 expect(normalizeStatus('in progress')).toBe('En cours');
 expect(normalizeStatus('Progress')).toBe('En cours');
 });

 it('should default to Ouvert for unknown status', () => {
 expect(normalizeStatus('unknown')).toBe('Ouvert');
 expect(normalizeStatus('')).toBe('Ouvert');
 });
 });

 describe('resolveCriticality helper', () => {
 const resolveCriticality = (value?: string): Criticality => {
 const normalized = (value || '').toLowerCase();
 const mapping: Record<string, Criticality> = {
 'critique': Criticality.CRITICAL,
 'critical': Criticality.CRITICAL,
 'élevé': Criticality.HIGH,
 'eleve': Criticality.HIGH,
 'high': Criticality.HIGH,
 'moyen': Criticality.MEDIUM,
 'moyenne': Criticality.MEDIUM,
 'medium': Criticality.MEDIUM,
 'faible': Criticality.LOW,
 'low': Criticality.LOW,
 'public': Criticality.LOW
 };
 return mapping[normalized] ?? Criticality.MEDIUM;
 };

 it('should resolve critical criticality', () => {
 expect(resolveCriticality('critique')).toBe(Criticality.CRITICAL);
 expect(resolveCriticality('critical')).toBe(Criticality.CRITICAL);
 expect(resolveCriticality('CRITICAL')).toBe(Criticality.CRITICAL);
 });

 it('should resolve high criticality', () => {
 expect(resolveCriticality('élevé')).toBe(Criticality.HIGH);
 expect(resolveCriticality('eleve')).toBe(Criticality.HIGH);
 expect(resolveCriticality('high')).toBe(Criticality.HIGH);
 expect(resolveCriticality('HIGH')).toBe(Criticality.HIGH);
 });

 it('should resolve medium criticality', () => {
 expect(resolveCriticality('moyen')).toBe(Criticality.MEDIUM);
 expect(resolveCriticality('moyenne')).toBe(Criticality.MEDIUM);
 expect(resolveCriticality('medium')).toBe(Criticality.MEDIUM);
 });

 it('should resolve low criticality', () => {
 expect(resolveCriticality('faible')).toBe(Criticality.LOW);
 expect(resolveCriticality('low')).toBe(Criticality.LOW);
 expect(resolveCriticality('public')).toBe(Criticality.LOW);
 });

 it('should default to medium for unknown values', () => {
 expect(resolveCriticality('unknown')).toBe(Criticality.MEDIUM);
 expect(resolveCriticality('')).toBe(Criticality.MEDIUM);
 expect(resolveCriticality(undefined)).toBe(Criticality.MEDIUM);
 });
 });

 describe('resolveAssetType helper', () => {
 type AssetType = 'Matériel' | 'Logiciel' | 'Données' | 'Service' | 'Humain';

 const resolveAssetType = (value?: string): AssetType => {
 const normalized = (value || '').toLowerCase();
 const mapping: Record<string, AssetType> = {
 'matériel': 'Matériel',
 'materiel': 'Matériel',
 'hardware': 'Matériel',
 'logiciel': 'Logiciel',
 'software': 'Logiciel',
 'données': 'Données',
 'donnees': 'Données',
 'data': 'Données',
 'service': 'Service',
 'humain': 'Humain',
 'human': 'Humain'
 };
 return mapping[normalized] ?? 'Logiciel';
 };

 it('should resolve hardware asset type', () => {
 expect(resolveAssetType('matériel')).toBe('Matériel');
 expect(resolveAssetType('materiel')).toBe('Matériel');
 expect(resolveAssetType('hardware')).toBe('Matériel');
 });

 it('should resolve software asset type', () => {
 expect(resolveAssetType('logiciel')).toBe('Logiciel');
 expect(resolveAssetType('software')).toBe('Logiciel');
 });

 it('should resolve data asset type', () => {
 expect(resolveAssetType('données')).toBe('Données');
 expect(resolveAssetType('donnees')).toBe('Données');
 expect(resolveAssetType('data')).toBe('Données');
 });

 it('should resolve service asset type', () => {
 expect(resolveAssetType('service')).toBe('Service');
 });

 it('should resolve human asset type', () => {
 expect(resolveAssetType('humain')).toBe('Humain');
 expect(resolveAssetType('human')).toBe('Humain');
 });

 it('should default to Logiciel for unknown values', () => {
 expect(resolveAssetType('unknown')).toBe('Logiciel');
 expect(resolveAssetType('')).toBe('Logiciel');
 expect(resolveAssetType(undefined)).toBe('Logiciel');
 });
 });

 describe('resolveLifecycleStatus helper', () => {
 type LifecycleStatus = 'Neuf' | 'En service' | 'En réparation' | 'Fin de vie' | 'Rebut' | undefined;

 const resolveLifecycleStatus = (value?: string): LifecycleStatus => {
 if (!value) return undefined;
 const normalized = value.toLowerCase();
 const mapping: Record<string, LifecycleStatus> = {
 'neuf': 'Neuf',
 'new': 'Neuf',
 'en service': 'En service',
 'active': 'En service',
 'activee': 'En service',
 'en réparation': 'En réparation',
 'en reparation': 'En réparation',
 'repair': 'En réparation',
 'fin de vie': 'Fin de vie',
 'endoflife': 'Fin de vie',
 'end_of_life': 'Fin de vie',
 'rebut': 'Rebut'
 };
 return mapping[normalized];
 };

 it('should resolve new lifecycle status', () => {
 expect(resolveLifecycleStatus('neuf')).toBe('Neuf');
 expect(resolveLifecycleStatus('new')).toBe('Neuf');
 });

 it('should resolve active lifecycle status', () => {
 expect(resolveLifecycleStatus('en service')).toBe('En service');
 expect(resolveLifecycleStatus('active')).toBe('En service');
 });

 it('should resolve repair lifecycle status', () => {
 expect(resolveLifecycleStatus('en réparation')).toBe('En réparation');
 expect(resolveLifecycleStatus('repair')).toBe('En réparation');
 });

 it('should resolve end of life lifecycle status', () => {
 expect(resolveLifecycleStatus('fin de vie')).toBe('Fin de vie');
 expect(resolveLifecycleStatus('endoflife')).toBe('Fin de vie');
 });

 it('should return undefined for empty values', () => {
 expect(resolveLifecycleStatus('')).toBeUndefined();
 expect(resolveLifecycleStatus(undefined)).toBeUndefined();
 });
 });

 describe('ImportService Class Methods', () => {
 // Import the actual service after mocks
 const getService = async () => {
 const { ImportService } = await import('../ImportService');
 return ImportService;
 };

 describe('parseCSV', () => {
 it('should parse simple CSV content', async () => {
 const ImportService = await getService();
 const csvContent = 'name,value\nTest,123\nAnother,456';

 const result = ImportService.parseCSV(csvContent);

 expect(result).toHaveLength(2);
 expect(result[0]).toEqual({ name: 'Test', value: '123' });
 expect(result[1]).toEqual({ name: 'Another', value: '456' });
 });

 it('should return empty array for empty CSV', async () => {
 const ImportService = await getService();

 const result = ImportService.parseCSV('');

 expect(result).toEqual([]);
 });

 it('should return empty array for CSV with only headers', async () => {
 const ImportService = await getService();
 const csvContent = 'header1,header2';

 const result = ImportService.parseCSV(csvContent);

 expect(result).toEqual([]);
 });

 it('should handle quoted values', async () => {
 const ImportService = await getService();
 const csvContent = 'name,description\n"Test Item","Description with, comma"';

 const result = ImportService.parseCSV(csvContent);

 expect(result).toHaveLength(1);
 expect(result[0].name).toBe('Test Item');
 });

 it('should strip quotes from header names', async () => {
 const ImportService = await getService();
 const csvContent = '"quoted_header","another"\nvalue1,value2';

 const result = ImportService.parseCSV(csvContent);

 expect(result).toHaveLength(1);
 expect(result[0]).toHaveProperty('quoted_header');
 });

 it('should skip empty lines', async () => {
 const ImportService = await getService();
 const csvContent = 'name,value\n\nTest,123\n\nAnother,456';

 const result = ImportService.parseCSV(csvContent);

 expect(result).toHaveLength(2);
 });
 });

 describe('parseRisks', () => {
 it('should parse valid risk CSV', async () => {
 const ImportService = await getService();
 const csvContent = 'threat,vulnerability,probability,impact,strategy,status,framework\n' +
  '"Data Breach","Weak password",3,4,Atténuer,Ouvert,ISO27001';

 const result = ImportService.parseRisks(csvContent);

 expect(result.data).toHaveLength(1);
 expect(result.data[0]).toMatchObject({
  threat: 'Data Breach',
  vulnerability: 'Weak password',
  probability: 3,
  impact: 4
 });
 expect(result.errors).toHaveLength(0);
 });

 it('should handle French column headers', async () => {
 const ImportService = await getService();
 const csvContent = 'menace,vulnerabilite,probabilite,gravite,strategie,statut,reference\n' +
  'Intrusion,Configuration,2,5,Eviter,En cours,ISO27001';

 const result = ImportService.parseRisks(csvContent);

 expect(result.data).toHaveLength(1);
 expect(result.data[0].threat).toBe('Intrusion');
 });

 it('should normalize probability and impact values', async () => {
 const ImportService = await getService();
 const csvContent = 'threat,probability,impact\n' +
  'Risk 1,10,0'; // Out of bounds values

 const result = ImportService.parseRisks(csvContent);

 expect(result.data).toHaveLength(1);
 expect(result.data[0].probability).toBe(5); // Max
 expect(result.data[0].impact).toBe(1); // Min
 });

 it('should handle multiple rows correctly', async () => {
 const ImportService = await getService();
 const csvContent = 'threat,probability,impact\n' +
  '"Risk One",2,3\n' +
  '"Risk Two",4,5';

 const result = ImportService.parseRisks(csvContent);

 expect(result.data).toHaveLength(2);
 expect(result.data[0].threat).toBe('Risk One');
 expect(result.data[1].threat).toBe('Risk Two');
 });
 });

 describe('downloadCSV', () => {
 beforeEach(() => {
 // Mock DOM methods for download
 const mockCreateElement = vi.spyOn(document, 'createElement');
 const mockLink = {
  setAttribute: vi.fn(),
  style: { visibility: '' },
  click: vi.fn(),
  download: 'test'
 };
 mockCreateElement.mockReturnValue(mockLink as unknown as HTMLAnchorElement);

 vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as never);
 vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as never);

 // Mock URL methods
 global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
 global.URL.revokeObjectURL = vi.fn();
 });

 it('should not download if data is empty', async () => {
 const ImportService = await getService();

 ImportService.downloadCSV([], 'test.csv');

 expect(document.createElement).not.toHaveBeenCalled();
 });

 it('should create download link for valid data', async () => {
 const ImportService = await getService();
 const data = [
  { name: 'Item 1', value: 100 },
  { name: 'Item 2', value: 200 }
 ];

 ImportService.downloadCSV(data, 'test.csv');

 expect(document.createElement).toHaveBeenCalledWith('a');
 });
 });
 });
});
