/**
 * CalendarService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'blob:test-url');

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
 collection: vi.fn(),
 getDocs: vi.fn(),
 query: vi.fn(),
 where: vi.fn(),
 addDoc: vi.fn(),
 doc: vi.fn(),
 updateDoc: vi.fn(),
 serverTimestamp: vi.fn(() => ({ _seconds: Date.now() / 1000 }))
}));

// Mock firebase
vi.mock('../../firebase', () => ({
 db: { app: { name: 'test-app' } }
}));

// Mock date-fns
vi.mock('date-fns', () => ({
 parseISO: vi.fn((str) => new Date(str))
}));

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 }
}));

// Import after mocks
import { CalendarService } from '../calendarService';
import { getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';

const mockGetDocs = getDocs as ReturnType<typeof vi.fn>;
const mockAddDoc = addDoc as ReturnType<typeof vi.fn>;
const mockUpdateDoc = updateDoc as ReturnType<typeof vi.fn>;
const mockDoc = doc as ReturnType<typeof vi.fn>;

describe('CalendarService', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('google', () => {
 it('should generate Google Calendar URL', () => {
 const event = {
 title: 'Test Event',
 start: new Date('2024-01-15T10:00:00Z'),
 end: new Date('2024-01-15T11:00:00Z'),
 description: 'Test description',
 location: 'Test Location'
 };

 const url = CalendarService.google(event);

 expect(url).toContain('calendar.google.com/calendar/render');
 expect(url).toContain('action=TEMPLATE');
 expect(url).toContain('text=Test+Event');
 expect(url).toContain('details=Test+description');
 expect(url).toContain('location=Test+Location');
 });

 it('should handle events without description and location', () => {
 const event = {
 title: 'Simple Event',
 start: new Date('2024-01-15T10:00:00Z'),
 end: new Date('2024-01-15T11:00:00Z')
 };

 const url = CalendarService.google(event);

 expect(url).toContain('text=Simple+Event');
 expect(url).not.toContain('details=');
 expect(url).not.toContain('location=');
 });
 });

 describe('outlook', () => {
 it('should generate Outlook Calendar URL', () => {
 const event = {
 title: 'Test Event',
 start: new Date('2024-01-15T10:00:00Z'),
 end: new Date('2024-01-15T11:00:00Z'),
 description: 'Test description',
 location: 'Test Location'
 };

 const url = CalendarService.outlook(event);

 expect(url).toContain('outlook.live.com/calendar');
 expect(url).toContain('subject=Test+Event');
 expect(url).toContain('body=Test+description');
 expect(url).toContain('location=Test+Location');
 });

 it('should include start and end dates', () => {
 const event = {
 title: 'Test',
 start: new Date('2024-01-15T10:00:00Z'),
 end: new Date('2024-01-15T11:00:00Z')
 };

 const url = CalendarService.outlook(event);

 expect(url).toContain('startdt=');
 expect(url).toContain('enddt=');
 });
 });

 describe('ics', () => {
 it('should generate ICS content', () => {
 const event = {
 id: 'event-123',
 title: 'ICS Event',
 start: new Date('2024-01-15T10:00:00Z'),
 end: new Date('2024-01-15T11:00:00Z'),
 description: 'ICS description',
 location: 'ICS Location'
 };

 const url = CalendarService.ics(event);

 // URL.createObjectURL returns a blob URL
 expect(url).toMatch(/^blob:/);
 });
 });

 describe('downloadIcs', () => {
 it('should create download link and trigger download', () => {
 const createElementSpy = vi.spyOn(document, 'createElement');
 const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node);
 const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node);

 const mockLink = {
 href: '',
 setAttribute: vi.fn(),
 click: vi.fn()
 };
 createElementSpy.mockReturnValue(mockLink as unknown as HTMLElement);

 const event = {
 title: 'Download Event',
 start: new Date('2024-01-15T10:00:00Z'),
 end: new Date('2024-01-15T11:00:00Z')
 };

 CalendarService.downloadIcs(event);

 expect(createElementSpy).toHaveBeenCalledWith('a');
 expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'Download_Event.ics');
 expect(mockLink.click).toHaveBeenCalled();
 expect(appendChildSpy).toHaveBeenCalled();
 expect(removeChildSpy).toHaveBeenCalled();

 createElementSpy.mockRestore();
 appendChildSpy.mockRestore();
 removeChildSpy.mockRestore();
 });
 });

 describe('fetchAllEvents', () => {
 it('should return empty array when no organizationId', async () => {
 const events = await CalendarService.fetchAllEvents('');

 expect(events).toEqual([]);
 expect(mockGetDocs).not.toHaveBeenCalled();
 });

 it('should fetch events from all collections', async () => {
 mockGetDocs.mockResolvedValue({
 forEach: vi.fn()
 });

 await CalendarService.fetchAllEvents('org-123');

 // Should query audits, projects, assets, drills, incidents
 expect(mockGetDocs).toHaveBeenCalledTimes(5);
 });

 it('should handle errors gracefully', async () => {
 const { ErrorLogger } = await import('../errorLogger');
 mockGetDocs.mockRejectedValue(new Error('Database error'));

 const events = await CalendarService.fetchAllEvents('org-123');

 // Should return empty array and log errors
 expect(events).toEqual([]);
 expect(ErrorLogger.error).toHaveBeenCalled();
 });
 });

 describe('createEvent', () => {
 it('should create audit event', async () => {
 mockAddDoc.mockResolvedValue({ id: 'new-audit' });

 const eventData = {
 type: 'audit' as const,
 title: 'New Audit',
 start: new Date('2024-01-15T10:00:00Z'),
 end: new Date('2024-01-15T12:00:00Z'),
 description: 'Audit description'
 };

 const result = await CalendarService.createEvent(eventData, 'org-123', 'user-123');

 expect(result).toBe(true);
 expect(mockAddDoc).toHaveBeenCalled();
 });

 it('should create project event', async () => {
 mockAddDoc.mockResolvedValue({ id: 'new-project' });

 const eventData = {
 type: 'project' as const,
 title: 'New Project',
 start: new Date('2024-01-15T10:00:00Z'),
 end: new Date('2024-02-15T10:00:00Z'),
 description: 'Project description'
 };

 const result = await CalendarService.createEvent(eventData, 'org-123', 'user-123');

 expect(result).toBe(true);
 expect(mockAddDoc).toHaveBeenCalled();
 });

 it('should create drill event', async () => {
 mockAddDoc.mockResolvedValue({ id: 'new-drill' });

 const eventData = {
 type: 'drill' as const,
 title: 'New Drill',
 start: new Date('2024-01-15T10:00:00Z'),
 end: new Date('2024-01-15T14:00:00Z')
 };

 const result = await CalendarService.createEvent(eventData, 'org-123', 'user-123');

 expect(result).toBe(true);
 });

 it('should throw error on failure', async () => {
 mockAddDoc.mockRejectedValue(new Error('Create failed'));

 const eventData = {
 type: 'audit' as const,
 title: 'Failing Audit',
 start: new Date(),
 end: new Date()
 };

 await expect(CalendarService.createEvent(eventData, 'org-123', 'user-123'))
 .rejects.toThrow('Create failed');
 });
 });

 describe('updateEvent', () => {
 it('should update audit event', async () => {
 mockDoc.mockReturnValue({ id: 'audit-123' });
 mockUpdateDoc.mockResolvedValue(undefined);

 const event = {
 id: 'audit-123',
 title: 'Audit',
 type: 'audit' as const,
 start: new Date(),
 end: new Date(),
 color: 'bg-purple-100'
 };

 const result = await CalendarService.updateEvent(
 event,
 new Date('2024-01-20T10:00:00Z'),
 new Date('2024-01-20T12:00:00Z')
 );

 expect(result).toBe(true);
 expect(mockUpdateDoc).toHaveBeenCalled();
 });

 it('should update project event', async () => {
 mockDoc.mockReturnValue({ id: 'project-123' });
 mockUpdateDoc.mockResolvedValue(undefined);

 const event = {
 id: 'project-123',
 title: 'Project',
 type: 'project' as const,
 start: new Date(),
 end: new Date(),
 color: 'bg-blue-100'
 };

 const result = await CalendarService.updateEvent(
 event,
 new Date('2024-01-20T10:00:00Z'),
 new Date('2024-02-20T10:00:00Z')
 );

 expect(result).toBe(true);
 });

 it('should not update maintenance events', async () => {
 const event = {
 id: 'maintenance-123',
 title: 'Maintenance',
 type: 'maintenance' as const,
 start: new Date(),
 end: new Date(),
 color: 'bg-emerald-100'
 };

 await CalendarService.updateEvent(event, new Date(), new Date());

 expect(mockUpdateDoc).not.toHaveBeenCalled();
 });

 it('should throw error on update failure', async () => {
 mockDoc.mockReturnValue({ id: 'audit-123' });
 mockUpdateDoc.mockRejectedValue(new Error('Update failed'));

 const event = {
 id: 'audit-123',
 title: 'Audit',
 type: 'audit' as const,
 start: new Date(),
 end: new Date(),
 color: 'bg-purple-100'
 };

 await expect(CalendarService.updateEvent(event, new Date(), new Date()))
 .rejects.toThrow('Update failed');
 });
 });
});
