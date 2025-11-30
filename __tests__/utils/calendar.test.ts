import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateICS, downloadICS } from '../../utils/calendar';
import { CalendarEvent } from '../../utils/calendar';

// Mock DOM methods
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'mock-url')
  },
  writable: true
});

Object.defineProperty(window, 'Blob', {
  value: vi.fn().mockImplementation((content, options) => ({
    content,
    type: options?.type
  })),
  writable: true
});

describe('calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock document methods
    const mockLink = {
      href: '',
      setAttribute: vi.fn(),
      click: vi.fn(),
      removeAttribute: vi.fn()
    };
    vi.spyOn(document, 'createElement').mockImplementation(() => mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as unknown as Node);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as unknown as Node);
  });

  describe('generateICS', () => {
    it('should generate valid ICS content for event', () => {
      const event: CalendarEvent = {
        title: 'Annual Security Audit',
        description: 'Complete security audit including all controls',
        startDate: new Date('2024-06-15T09:00:00Z'),
        endDate: new Date('2024-06-16T17:00:00Z'),
        location: 'Main Office'
      };

      const content = generateICS([event]);

      expect(content).toContain('BEGIN:VCALENDAR');
      expect(content).toContain('SUMMARY:Annual Security Audit');
      expect(content).toContain('DESCRIPTION:Complete security audit including all controls');
      expect(content).toContain('LOCATION:Main Office');
      expect(content).toContain('END:VCALENDAR');
    });
  });

  describe('downloadICS', () => {
    it('should trigger download', () => {
      const content = 'BEGIN:VCALENDAR...';
      downloadICS('test.ics', content);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(window.URL.createObjectURL).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalled();

      const mockLink = (document.createElement as unknown as { mock: { results: { value: { setAttribute: (k: string, v: string) => void } }[] } }).mock.results[0].value;
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'test.ics');
    });
  });
});
