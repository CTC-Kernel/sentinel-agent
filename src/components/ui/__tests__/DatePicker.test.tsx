/**
 * DatePicker Tests
 * Epic 14-1: Test Coverage Improvement
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatePicker } from '../DatePicker';

// Mock lucide-react - must be before any imports that use it
vi.mock('lucide-react', () => {
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const Icon = ({ className, ...props }: any) => React.createElement('span', { className: `icon ${className}`, ...props });
 return {
 // Layout & Navigation
 LayoutDashboard: Icon,
 LayoutGrid: Icon,
 LayoutTemplate: Icon,
 Menu: Icon,
 Home: Icon,
 Search: Icon,
 Filter: Icon,
 ChevronRight: Icon,
 ChevronUp: Icon,
 ChevronDown: Icon,
 ChevronLeft: Icon,
 ArrowRight: Icon,
 ArrowLeft: Icon,
 Maximize2: Icon,
 Minimize2: Icon,
 ZoomIn: Icon,
 ZoomOut: Icon,
 MoreHorizontal: Icon,
 MoreVertical: Icon,
 GripVertical: Icon,
 Move: Icon,
 Layers: Icon,
 Grid3X3: Icon,
 List: Icon,
 ListOrdered: Icon,
 ListTodo: Icon,
 SlidersHorizontal: Icon,
 Sliders: Icon,
 // Actions
 Plus: Icon,
 Minus: Icon,
 MinusCircle: Icon,
 X: Icon,
 XCircle: Icon,
 Check: Icon,
 CheckCheck: Icon,
 CheckCircle: Icon,
 CheckCircle2: Icon,
 CheckSquare: Icon,
 Edit: Icon,
 Edit2: Icon,
 Pencil: Icon,
 PenTool: Icon,
 Save: Icon,
 Trash: Icon,
 Trash2: Icon,
 Copy: Icon,
 Download: Icon,
 Upload: Icon,
 UploadCloud: Icon,
 RefreshCw: Icon,
 RefreshCcw: Icon,
 RotateCw: Icon,
 RotateCcw: Icon,
 Send: Icon,
 Reply: Icon,
 Share2: Icon,
 ExternalLink: Icon,
 Link: Icon,
 Link2: Icon,
 Paperclip: Icon,
 Play: Icon,
 PlayCircle: Icon,
 Pause: Icon,
 Pin: Icon,
 PinOff: Icon,
 // Files & Documents
 File: Icon,
 FileText: Icon,
 FileCheck: Icon,
 FileCode: Icon,
 FileSpreadsheet: Icon,
 FileDown: Icon,
 Folder: Icon,
 FolderOpen: Icon,
 FolderKanban: Icon,
 Archive: Icon,
 Printer: Icon,
 QrCode: Icon,
 Image: Icon,
 StickyNote: Icon,
 // Text Formatting
 Bold: Icon,
 Italic: Icon,
 Underline: Icon,
 AlignLeft: Icon,
 AlignCenter: Icon,
 AlignRight: Icon,
 Heading1: Icon,
 Heading2: Icon,
 Quote: Icon,
 Code: Icon,
 Table: Icon,
 Highlighter: Icon,
 // Users & Auth
 User: Icon,
 Users: Icon,
 UserPlus: Icon,
 UserCheck: Icon,
 UserMinus: Icon,
 UserCircle: Icon,
 UserCog: Icon,
 UserX: Icon,
 LogIn: Icon,
 LogOut: Icon,
 Lock: Icon,
 Unlock: Icon,
 Key: Icon,
 Fingerprint: Icon,
 // Communication
 Bell: Icon,
 BellOff: Icon,
 Mail: Icon,
 MessageSquare: Icon,
 Phone: Icon,
 Megaphone: Icon,
 Headset: Icon,
 // Security & Compliance
 Shield: Icon,
 ShieldAlert: Icon,
 ShieldCheck: Icon,
 ShieldOff: Icon,
 ShieldQuestion: Icon,
 AlertTriangle: Icon,
 AlertCircle: Icon,
 AlertOctagon: Icon,
 Siren: Icon,
 Bug: Icon,
 Crosshair: Icon,
 // Version Control
 GitBranch: Icon,
 GitCompare: Icon,
 Hash: Icon,
 // Business & Finance
 Briefcase: Icon,
 Building: Icon,
 Building2: Icon,
 Landmark: Icon,
 DollarSign: Icon,
 Euro: Icon,
 CreditCard: Icon,
 ShoppingCart: Icon,
 Ticket: Icon,
 Handshake: Icon,
 Truck: Icon,
 Package: Icon,
 // Analytics & Charts
 BarChart3: Icon,
 PieChart: Icon,
 LineChart: Icon,
 AreaChart: Icon,
 TrendingUp: Icon,
 TrendingDown: Icon,
 Activity: Icon,
 Gauge: Icon,
 // Time & Calendar
 Calendar: Icon,
 CalendarDays: Icon,
 CalendarCheck: Icon,
 CalendarClock: Icon,
 Clock: Icon,
 Timer: Icon,
 History: Icon,
 // Technology
 Server: Icon,
 Database: Icon,
 Network: Icon,
 HardDrive: Icon,
 Cpu: Icon,
 Monitor: Icon,
 MonitorPlay: Icon,
 Laptop: Icon,
 Smartphone: Icon,
 Disc: Icon,
 Cloud: Icon,
 CloudOff: Icon,
 Plug: Icon,
 Keyboard: Icon,
 // Nature & Health
 Globe: Icon,
 GlobeLock: Icon,
 Map: Icon,
 MapPin: Icon,
 Flame: Icon,
 Stethoscope: Icon,
 HeartPulse: Icon,
 Heart: Icon,
 LifeBuoy: Icon,
 // UI Elements
 Settings: Icon,
 Settings2: Icon,
 Wrench: Icon,
 Zap: Icon,
 Rocket: Icon,
 Sparkles: Icon,
 Wand2: Icon,
 Star: Icon,
 Award: Icon,
 Crown: Icon,
 Target: Icon,
 Flag: Icon,
 Tag: Icon,
 Box: Icon,
 Lightbulb: Icon,
 HelpCircle: Icon,
 Info: Icon,
 Eye: Icon,
 EyeOff: Icon,
 Camera: Icon,
 Cookie: Icon,
 // Theme
 Moon: Icon,
 Sun: Icon,
 // Status & Indicators
 Loader: Icon,
 Loader2: Icon,
 WifiOff: Icon,
 Circle: Icon,
 // AI & Intelligence
 Bot: Icon,
 BrainCircuit: Icon,
 Brain: Icon,
 // Clipboard
 ClipboardList: Icon,
 ClipboardCheck: Icon,
 ListChecks: Icon,
 // Scale & Comparison
 Scale: Icon,
 // Book & Learning
 BookOpen: Icon,
 // Social
 Twitter: Icon,
 Linkedin: Icon,
 Github: Icon,
 ThumbsUp: Icon,
 // Command
 Command: Icon,
 };
});

// Mock Calendar component
vi.mock('../Calendar', () => ({
 Calendar: ({ onSelect, selected }: { onSelect: (date: Date | undefined) => void; selected?: Date }) =>
 React.createElement('div', { 'data-testid': 'calendar' },
 React.createElement('button', {
 'data-testid': 'select-date-btn',
 onClick: () => onSelect(new Date(2024, 0, 15))
 }, 'Select Jan 15, 2024'),
 React.createElement('button', {
 'data-testid': 'clear-date-btn',
 onClick: () => onSelect(undefined)
 }, 'Clear'),
 selected ? React.createElement('span', { 'data-testid': 'selected-date' }, selected.toISOString()) : null
 )
}));

// Mock useLocale hook to return French locale
vi.mock('../../hooks/useLocale', () => ({
 useLocale: () => ({
  locale: 'fr' as const,
  config: {
    code: 'fr',
    name: 'Français',
    dateFormat: 'dd/MM/yyyy',
    dateTimeFormat: 'dd/MM/yyyy HH:mm',
    numberFormat: { decimal: ',', thousands: ' ' },
    currency: 'EUR',
    intlLocale: 'fr-FR'
  }
 })
}));

describe('DatePicker', () => {
 const mockOnChange = vi.fn();

 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should render with label', () => {
 render(
 <DatePicker
 label="Date de début"
 onChange={mockOnChange}
 />
 );

 expect(screen.getByText('Date de début')).toBeInTheDocument();
 });

 it('should render with required indicator', () => {
 render(
 <DatePicker
 label="Date requise"
 onChange={mockOnChange}
 required={true}
 />
 );

 expect(screen.getByText('*')).toBeInTheDocument();
 });

 it('should open calendar when clicked', () => {
 render(
 <DatePicker
 label="Date"
 onChange={mockOnChange}
 />
 );

 fireEvent.click(screen.getByRole('button'));
 expect(screen.getByTestId('calendar')).toBeInTheDocument();
 });

 it('should close calendar when date is selected', () => {
 render(
 <DatePicker
 label="Date"
 onChange={mockOnChange}
 />
 );

 fireEvent.click(screen.getByRole('button'));
 fireEvent.click(screen.getByTestId('select-date-btn'));

 expect(screen.queryByTestId('calendar')).not.toBeInTheDocument();
 });

 it('should call onChange with formatted date when date is selected', () => {
 render(
 <DatePicker
 label="Date"
 onChange={mockOnChange}
 />
 );

 fireEvent.click(screen.getByRole('button'));
 fireEvent.click(screen.getByTestId('select-date-btn'));

 expect(mockOnChange).toHaveBeenCalledWith('2024-01-15');
 });

 it('should display formatted date when value is provided', () => {
 render(
 <DatePicker
 label="Date"
 value="2024-06-15"
 onChange={mockOnChange}
 />
 );

 // French locale format
 expect(screen.getByText(/15 juin 2024/)).toBeInTheDocument();
 });

 it('should show error message when error prop is provided', () => {
 render(
 <DatePicker
 label="Date"
 onChange={mockOnChange}
 error="Date invalide"
 />
 );

 expect(screen.getByText('Date invalide')).toBeInTheDocument();
 });

 it('should be disabled when disabled prop is true', () => {
 render(
 <DatePicker
 label="Date"
 onChange={mockOnChange}
 disabled={true}
 />
 );

 const button = screen.getByRole('button');
 expect(button).toHaveAttribute('tabindex', '-1');
 });

 it('should not open calendar when disabled', () => {
 render(
 <DatePicker
 label="Date"
 onChange={mockOnChange}
 disabled={true}
 />
 );

 fireEvent.click(screen.getByRole('button'));
 expect(screen.queryByTestId('calendar')).not.toBeInTheDocument();
 });

 it('should toggle calendar with keyboard', () => {
 render(
 <DatePicker
 label="Date"
 onChange={mockOnChange}
 />
 );

 const button = screen.getByRole('button');
 fireEvent.keyDown(button, { key: 'Enter' });
 expect(screen.getByTestId('calendar')).toBeInTheDocument();

 fireEvent.keyDown(button, { key: ' ' });
 expect(screen.queryByTestId('calendar')).not.toBeInTheDocument();
 });

 it('should show clear button when value is set', () => {
 render(
 <DatePicker
 label="Date"
 value="2024-06-15"
 onChange={mockOnChange}
 />
 );

 fireEvent.click(screen.getByRole('button'));
 expect(screen.getByText('Effacer la date')).toBeInTheDocument();
 });

 it('should call onChange with undefined when clear is clicked', () => {
 render(
 <DatePicker
 label="Date"
 value="2024-06-15"
 onChange={mockOnChange}
 />
 );

 fireEvent.click(screen.getByRole('button'));
 fireEvent.click(screen.getByText('Effacer la date'));

 expect(mockOnChange).toHaveBeenCalledWith(undefined);
 });

 it('should apply custom className', () => {
 const { container } = render(
 <DatePicker
 label="Date"
 onChange={mockOnChange}
 className="custom-class"
 />
 );

 expect(container.firstChild).toHaveClass('custom-class');
 });

 it('should close calendar when clicking outside', () => {
 render(
 <div>
 <DatePicker label="Date" onChange={mockOnChange} />
 <div data-testid="outside">Outside</div>
 </div>
 );

 fireEvent.click(screen.getByRole('button'));
 expect(screen.getByTestId('calendar')).toBeInTheDocument();

 fireEvent.mouseDown(screen.getByTestId('outside'));
 expect(screen.queryByTestId('calendar')).not.toBeInTheDocument();
 });

 it('should display placeholder when no value', () => {
 render(
 <DatePicker
 label="Date"
 onChange={mockOnChange}
 placeholder="Choisir une date"
 />
 );

 // Open to see placeholder in open state
 fireEvent.click(screen.getByRole('button'));
 expect(screen.getByText('Choisir une date')).toBeInTheDocument();
 });
});
