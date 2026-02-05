/**
 * Calendar Utils Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi } from 'vitest';
import { generateICS, mapAuditsToEvents, mapTasksToEvents, CalendarEvent } from '../calendarUtils';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
 randomUUID: vi.fn(() => 'test-uuid-1234'),
});

describe('Calendar Utils', () => {
 describe('generateICS', () => {
 it('should generate valid ICS header', () => {
 const events: CalendarEvent[] = [];
 const ics = generateICS(events);

 expect(ics).toContain('BEGIN:VCALENDAR');
 expect(ics).toContain('VERSION:2.0');
 expect(ics).toContain('PRODID:-//Sentinel GRC//Calendar//FR');
 expect(ics).toContain('END:VCALENDAR');
 });

 it('should generate ICS with single event', () => {
 const events: CalendarEvent[] = [{
 title: 'Test Event',
 startTime: new Date('2024-01-15T10:00:00Z'),
 endTime: new Date('2024-01-15T11:00:00Z'),
 }];

 const ics = generateICS(events);

 expect(ics).toContain('BEGIN:VEVENT');
 expect(ics).toContain('SUMMARY:Test Event');
 expect(ics).toContain('DTSTART:20240115T100000Z');
 expect(ics).toContain('DTEND:20240115T110000Z');
 expect(ics).toContain('END:VEVENT');
 });

 it('should include description when provided', () => {
 const events: CalendarEvent[] = [{
 title: 'Test',
 description: 'Test description',
 startTime: new Date('2024-01-15T10:00:00Z'),
 endTime: new Date('2024-01-15T11:00:00Z'),
 }];

 const ics = generateICS(events);

 expect(ics).toContain('DESCRIPTION:Test description');
 });

 it('should include location when provided', () => {
 const events: CalendarEvent[] = [{
 title: 'Test',
 location: 'Conference Room A',
 startTime: new Date('2024-01-15T10:00:00Z'),
 endTime: new Date('2024-01-15T11:00:00Z'),
 }];

 const ics = generateICS(events);

 expect(ics).toContain('LOCATION:Conference Room A');
 });

 it('should include URL when provided', () => {
 const events: CalendarEvent[] = [{
 title: 'Test',
 url: 'https://example.com/event',
 startTime: new Date('2024-01-15T10:00:00Z'),
 endTime: new Date('2024-01-15T11:00:00Z'),
 }];

 const ics = generateICS(events);

 expect(ics).toContain('URL:https://example.com/event');
 });

 it('should escape special characters in title', () => {
 const events: CalendarEvent[] = [{
 title: 'Test; with, special\nchars',
 startTime: new Date('2024-01-15T10:00:00Z'),
 endTime: new Date('2024-01-15T11:00:00Z'),
 }];

 const ics = generateICS(events);

 expect(ics).toContain('SUMMARY:Test\\; with\\, special\\nchars');
 });

 it('should generate multiple events', () => {
 const events: CalendarEvent[] = [
 {
  title: 'Event 1',
  startTime: new Date('2024-01-15T10:00:00Z'),
  endTime: new Date('2024-01-15T11:00:00Z'),
 },
 {
  title: 'Event 2',
  startTime: new Date('2024-01-16T14:00:00Z'),
  endTime: new Date('2024-01-16T15:00:00Z'),
 },
 ];

 const ics = generateICS(events);

 const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
 expect(eventCount).toBe(2);
 });
 });

 describe('mapAuditsToEvents', () => {
 it('should map audits to calendar events', () => {
 const audits = [
 {
  id: 'audit-1',
  name: 'Security Audit',
  dateScheduled: '2024-01-15T10:00:00Z',
  scope: 'IT Infrastructure',
  organizationId: 'org-1',
  type: 'Interne' as const,
  status: 'Planifié' as const,
  framework: 'ISO27001' as const,
  auditor: 'John Doe',
  findingsCount: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
 },
 ];

 const events = mapAuditsToEvents(audits);

 expect(events).toHaveLength(1);
 expect(events[0].title).toBe('Audit: Security Audit');
 expect(events[0].description).toContain('IT Infrastructure');
 expect(events[0].location).toBe('Sentinel GRC');
 });

 it('should handle audits without scope', () => {
 const audits = [
 {
  id: 'audit-1',
  name: 'Basic Audit',
  dateScheduled: '2024-01-15T10:00:00Z',
  organizationId: 'org-1',
  type: 'Interne' as const,
  status: 'Planifié' as const,
  framework: 'ISO27001' as const,
  auditor: 'John Doe',
  findingsCount: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
 },
 ];

 const events = mapAuditsToEvents(audits);

 expect(events[0].description).toContain('No scope defined');
 });

 it('should set default 1 hour duration', () => {
 const audits = [
 {
  id: 'audit-1',
  name: 'Test',
  dateScheduled: '2024-01-15T10:00:00Z',
  organizationId: 'org-1',
  type: 'Interne' as const,
  status: 'Planifié' as const,
  framework: 'ISO27001' as const,
  auditor: 'John Doe',
  findingsCount: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
 },
 ];

 const events = mapAuditsToEvents(audits);

 const duration = events[0].endTime.getTime() - events[0].startTime.getTime();
 expect(duration).toBe(60 * 60 * 1000); // 1 hour in ms
 });
 });

 describe('mapTasksToEvents', () => {
 it('should map tasks to calendar events', () => {
 const tasks = [
 {
  id: 'task-1',
  title: 'Complete Review',
  description: 'Review all documents',
  startDate: '2024-01-15T09:00:00Z',
  dueDate: '2024-01-15T17:00:00Z',
  status: 'À faire' as const,
  projectId: 'proj-1',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
 },
 ];

 const events = mapTasksToEvents(tasks);

 expect(events).toHaveLength(1);
 expect(events[0].title).toBe('Tâche: Complete Review');
 expect(events[0].description).toBe('Review all documents');
 });

 it('should filter out tasks without dates', () => {
 const tasks = [
 {
  id: 'task-1',
  title: 'Task with dates',
  description: 'Review all documents',
  startDate: '2024-01-15T09:00:00Z',
  dueDate: '2024-01-15T17:00:00Z',
  status: 'À faire' as const,
  projectId: 'proj-1',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
 },
 {
  id: 'task-2',
  title: 'Task without dates',
  status: 'À faire' as const,
  projectId: 'proj-1',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
 },
 ];

 const events = mapTasksToEvents(tasks);

 expect(events).toHaveLength(1);
 expect(events[0].title).toBe('Tâche: Task with dates');
 });

 it('should handle empty description', () => {
 const tasks = [
 {
  id: 'task-3',
  title: 'Simple Task',
  startDate: '2024-01-15T09:00:00Z',
  dueDate: '2024-01-15T17:00:00Z',
  status: 'À faire' as const,
  projectId: 'proj-1',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
 },
 ];

 const events = mapTasksToEvents(tasks);

 expect(events[0].description).toBe('');
 });
 });
});
