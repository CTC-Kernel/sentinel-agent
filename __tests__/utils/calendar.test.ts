import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateICS } from '../../utils/calendar';
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
    vi.spyOn(document, 'createElement').mockImplementation(() => mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
  });

  describe('generateICS', () => {
    it('should generate valid ICS content for event', () => {
      const event: CalendarEvent = {
        title: 'Annual Security Audit',
        description: 'Complete security audit including all controls',
        startDate: new Date('2024-06-15T09:00:00'),
        endDate: new Date('2024-06-16T17:00:00'),
        location: 'Main Office'
      };

      generateICS([event]);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(window.URL.createObjectURL).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalled();
    });

    it('should handle events without end date', () => {
      const event: CalendarEvent = {
        title: 'Team Meeting',
        description: 'Weekly team sync',
        startDate: new Date('2024-07-20T10:00:00'),
        location: 'Conference Room'
      };

      generateICS([event]);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle events without location and URL', () => {
      const event: CalendarEvent = {
        title: 'Simple Meeting',
        description: 'Basic meeting',
        startDate: new Date('2024-08-10T14:00:00')
      };

      generateICS([event]);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should generate correct filename', () => {
      const event: CalendarEvent = {
        title: 'Test Event With Spaces',
        description: 'Test',
        startDate: new Date('2024-08-10T14:00:00')
      };

      generateICS([event]);

      const mockLink = (document.createElement as any).mock.results[0].value;
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'Test_Event_With_Spaces.ics');
    });

    it('should create blob with correct content type', () => {
      const event: CalendarEvent = {
        title: 'Test Event',
        description: 'Test',
        startDate: new Date('2024-08-10T14:00:00')
      };

      generateICS([event]);

      expect(window.Blob).toHaveBeenCalledWith(
        expect.any(Array),
        { type: 'text/calendar;charset=utf-8' }
      );
    });
  });
});
