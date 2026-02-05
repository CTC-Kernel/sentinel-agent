/**
 * GoogleCalendarService Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleCalendarService } from '../googleCalendarService';

// Mock ErrorLogger
vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn()
 }
}));

describe('GoogleCalendarService', () => {
 let mockFetch: ReturnType<typeof vi.fn>;

 beforeEach(() => {
 mockFetch = vi.fn();
 global.fetch = mockFetch;
 });

 afterEach(() => {
 vi.clearAllMocks();
 });

 describe('listEvents', () => {
 it('should fetch and transform events from Google Calendar API', async () => {
 const mockResponse = {
 items: [
  {
  id: 'event-1',
  summary: 'Test Event',
  description: 'Test description',
  location: 'Test location',
  status: 'confirmed',
  start: { dateTime: '2024-01-15T10:00:00Z' },
  end: { dateTime: '2024-01-15T11:00:00Z' }
  }
 ]
 };

 mockFetch.mockResolvedValueOnce({
 ok: true,
 json: () => Promise.resolve(mockResponse)
 });

 const events = await GoogleCalendarService.listEvents(
 'test-token',
 new Date('2024-01-01'),
 new Date('2024-01-31')
 );

 expect(events).toHaveLength(1);
 expect(events[0].id).toBe('event-1');
 expect(events[0].title).toBe('Test Event');
 expect(events[0].type).toBe('google');
 });

 it('should handle all-day events', async () => {
 const mockResponse = {
 items: [
  {
  id: 'all-day-event',
  summary: 'All Day Event',
  start: { date: '2024-01-15' },
  end: { date: '2024-01-16' }
  }
 ]
 };

 mockFetch.mockResolvedValueOnce({
 ok: true,
 json: () => Promise.resolve(mockResponse)
 });

 const events = await GoogleCalendarService.listEvents(
 'test-token',
 new Date('2024-01-01'),
 new Date('2024-01-31')
 );

 expect(events[0].allDay).toBe(true);
 });

 it('should handle events without summary', async () => {
 const mockResponse = {
 items: [
  {
  id: 'no-summary',
  start: { dateTime: '2024-01-15T10:00:00Z' },
  end: { dateTime: '2024-01-15T11:00:00Z' }
  }
 ]
 };

 mockFetch.mockResolvedValueOnce({
 ok: true,
 json: () => Promise.resolve(mockResponse)
 });

 const events = await GoogleCalendarService.listEvents(
 'test-token',
 new Date('2024-01-01'),
 new Date('2024-01-31')
 );

 expect(events[0].title).toBe('Sans titre');
 });

 it('should send correct authorization header', async () => {
 mockFetch.mockResolvedValueOnce({
 ok: true,
 json: () => Promise.resolve({ items: [] })
 });

 await GoogleCalendarService.listEvents(
 'my-access-token',
 new Date('2024-01-01'),
 new Date('2024-01-31')
 );

 expect(mockFetch).toHaveBeenCalledWith(
 expect.any(String),
 expect.objectContaining({
  headers: expect.objectContaining({
  'Authorization': 'Bearer my-access-token'
  })
 })
 );
 });

 it('should return empty array on API error', async () => {
 mockFetch.mockResolvedValueOnce({
 ok: false,
 statusText: 'Unauthorized'
 });

 const events = await GoogleCalendarService.listEvents(
 'invalid-token',
 new Date('2024-01-01'),
 new Date('2024-01-31')
 );

 expect(events).toEqual([]);
 });

 it('should log errors', async () => {
 mockFetch.mockRejectedValueOnce(new Error('Network error'));
 const { ErrorLogger } = await import('../errorLogger');

 await GoogleCalendarService.listEvents(
 'test-token',
 new Date('2024-01-01'),
 new Date('2024-01-31')
 );

 expect(ErrorLogger.error).toHaveBeenCalledWith(
 expect.any(Error),
 'GoogleCalendarService.listEvents'
 );
 });

 it('should include query parameters for time range', async () => {
 mockFetch.mockResolvedValueOnce({
 ok: true,
 json: () => Promise.resolve({ items: [] })
 });

 const timeMin = new Date('2024-01-01');
 const timeMax = new Date('2024-01-31');

 await GoogleCalendarService.listEvents('test-token', timeMin, timeMax);

 const calledUrl = mockFetch.mock.calls[0][0] as string;
 expect(calledUrl).toContain('timeMin=');
 expect(calledUrl).toContain('timeMax=');
 expect(calledUrl).toContain('singleEvents=true');
 expect(calledUrl).toContain('orderBy=startTime');
 });
 });

 describe('createEvent', () => {
 it('should create event with correct payload', async () => {
 const mockCreatedEvent = {
 id: 'new-event-id',
 summary: 'New Event'
 };

 mockFetch.mockResolvedValueOnce({
 ok: true,
 json: () => Promise.resolve(mockCreatedEvent)
 });

 const result = await GoogleCalendarService.createEvent('test-token', {
 title: 'New Event',
 description: 'Event description',
 location: 'Event location',
 start: new Date('2024-01-15T10:00:00Z'),
 end: new Date('2024-01-15T11:00:00Z')
 });

 expect(result.id).toBe('new-event-id');
 });

 it('should send POST request', async () => {
 mockFetch.mockResolvedValueOnce({
 ok: true,
 json: () => Promise.resolve({})
 });

 await GoogleCalendarService.createEvent('test-token', {
 title: 'Test',
 start: new Date(),
 end: new Date()
 });

 expect(mockFetch).toHaveBeenCalledWith(
 expect.any(String),
 expect.objectContaining({
  method: 'POST'
 })
 );
 });

 it('should include event details in request body', async () => {
 mockFetch.mockResolvedValueOnce({
 ok: true,
 json: () => Promise.resolve({})
 });

 await GoogleCalendarService.createEvent('test-token', {
 title: 'Test Event',
 description: 'Test description',
 location: 'Test location',
 start: new Date('2024-01-15T10:00:00Z'),
 end: new Date('2024-01-15T11:00:00Z')
 });

 const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
 expect(requestBody.summary).toBe('Test Event');
 expect(requestBody.description).toBe('Test description');
 expect(requestBody.location).toBe('Test location');
 });

 it('should throw on API error', async () => {
 mockFetch.mockResolvedValueOnce({
 ok: false,
 statusText: 'Bad Request'
 });

 await expect(
 GoogleCalendarService.createEvent('test-token', {
  title: 'Test',
  start: new Date(),
  end: new Date()
 })
 ).rejects.toThrow('Google Calendar API error: Bad Request');
 });

 it('should log errors on failure', async () => {
 mockFetch.mockRejectedValueOnce(new Error('Network error'));
 const { ErrorLogger } = await import('../errorLogger');

 try {
 await GoogleCalendarService.createEvent('test-token', {
  title: 'Test',
  start: new Date(),
  end: new Date()
 });
 } catch {
 // Expected
 }

 expect(ErrorLogger.error).toHaveBeenCalledWith(
 expect.any(Error),
 'GoogleCalendarService.createEvent'
 );
 });
 });
});
