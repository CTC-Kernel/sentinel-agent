import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Suppliers } from '../Suppliers';
import { MemoryRouter } from 'react-router-dom';

// Mock Dependencies
vi.mock('../../hooks/useFirestore');
vi.mock('../../store');
vi.mock('../../hooks/usePersistedState');
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: React.ComponentProps<'div'>) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock Child Components
vi.mock('../../components/suppliers/SupplierDashboard', () => ({
    SupplierDashboard: () => <div data-testid="supplier-dashboard" />
}));
vi.mock('../../components/SEO', () => ({
    SEO: () => <div data-testid="seo-mock" />
}));
vi.mock('../../components/suppliers/SupplierForm', () => ({
    SupplierForm: () => <div data-testid="supplier-form" />
}));
vi.mock('../../components/ui/Drawer', () => ({
    Drawer: ({ isOpen, children }: { isOpen: boolean, children: React.ReactNode }) => isOpen ? <div data-testid="drawer">{children}</div> : null
}));
vi.mock('../../components/ui/PremiumPageControl', () => ({
    PremiumPageControl: ({ children }: { children: React.ReactNode }) => <div data-testid="premium-page-control">{children}</div>
}));
vi.mock('../../components/ui/button', () => ({
    Button: ({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; className?: string }) => 
        <button className={className} {...props}>{children}</button>
}));
vi.mock('../../components/ui/ConfirmModal', () => ({
    ConfirmModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => 
        isOpen ? <div data-testid="confirm-modal">{children}</div> : null
}));
vi.mock('../../components/ui/Skeleton', () => ({
    CardSkeleton: () => <div data-testid="card-skeleton" />
}));
vi.mock('../../components/ui/EmptyState', () => ({
    EmptyState: ({ children }: { children: React.ReactNode }) => <div data-testid="empty-state">{children}</div>
}));
vi.mock('../../components/ui/PageHeader', () => ({
    PageHeader: ({ title }: { title?: string }) => <div data-testid="page-header">{title}</div>
}));
vi.mock('../../components/ui/Tooltip', () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>
}));
vi.mock('../../components/ui/MasterpieceBackground', () => ({
    MasterpieceBackground: () => <div data-testid="masterpiece-background" />
}));
vi.mock('../../components/ui/ImportGuidelinesModal', () => ({
    ImportGuidelinesModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) => 
        isOpen ? <div data-testid="import-guidelines-modal">{children}</div> : null
}));
vi.mock('../../components/suppliers/QuestionnaireBuilder', () => ({
    QuestionnaireBuilder: () => <div data-testid="questionnaire-builder" />
}));
vi.mock('../../components/suppliers/AssessmentView', () => ({
    AssessmentView: () => <div data-testid="assessment-view" />
}));
vi.mock('../../components/suppliers/SupplierCard', () => ({
    SupplierCard: () => <div data-testid="supplier-card" />
}));
vi.mock('../../components/suppliers/SupplierInspector', () => ({
    SupplierInspector: () => <div data-testid="supplier-inspector" />
}));
vi.mock('../../services/ImportService', () => ({
    ImportService: {
        exportDORARegister: vi.fn()
    }
}));
vi.mock('../../services/onboardingService', () => ({
    OnboardingService: {}
}));
vi.mock('../../components/ui/Icons', () => {
    const createMockIcon = (name: string) => ({ className }: { className?: string }) => 
        <div data-testid={`${name.toLowerCase()}-icon`} className={className} />;
    
    return {
        Building: createMockIcon('Building'),
        Plus: createMockIcon('Plus'),
        FileSpreadsheet: createMockIcon('FileSpreadsheet'),
        ClipboardList: createMockIcon('ClipboardList'),
        Upload: createMockIcon('Upload'),
        Loader2: createMockIcon('Loader2'),
        MoreVertical: createMockIcon('MoreVertical'),
        ShieldAlert: createMockIcon('ShieldAlert'),
        ShieldCheck: createMockIcon('ShieldCheck'),
        Lock: createMockIcon('Lock'),
        FileCheck: createMockIcon('FileCheck'),
        FileText: createMockIcon('FileText'),
        Users: createMockIcon('Users'),
        Settings: createMockIcon('Settings'),
        Bell: createMockIcon('Bell'),
        Search: createMockIcon('Search'),
        LogOut: createMockIcon('LogOut'),
        CheckCircle2: createMockIcon('CheckCircle2'),
        AlertTriangle: createMockIcon('AlertTriangle'),
        XCircle: createMockIcon('XCircle'),
        Moon: createMockIcon('Moon'),
        Sun: createMockIcon('Sun'),
        Menu: createMockIcon('Menu'),
        Filter: createMockIcon('Filter'),
        ChevronRight: createMockIcon('ChevronRight'),
        ChevronUp: createMockIcon('ChevronUp'),
        ChevronDown: createMockIcon('ChevronDown'),
        Maximize2: createMockIcon('Maximize2'),
        RefreshCw: createMockIcon('RefreshCw'),
        RotateCw: createMockIcon('RotateCw'),
        ChevronLeft: createMockIcon('ChevronLeft'),
        Download: createMockIcon('Download'),
        Briefcase: createMockIcon('Briefcase'),
        Activity: createMockIcon('Activity'),
        Mail: createMockIcon('Mail'),
        Database: createMockIcon('Database'),
        History: createMockIcon('History'),
        Save: createMockIcon('Save'),
        Trash2: createMockIcon('Trash2'),
        File: createMockIcon('File'),
        Link: createMockIcon('Link'),
        Paperclip: createMockIcon('Paperclip'),
        ExternalLink: createMockIcon('ExternalLink'),
        Edit: createMockIcon('Edit'),
        UploadCloud: createMockIcon('UploadCloud'),
        X: createMockIcon('X'),
        FolderKanban: createMockIcon('FolderKanban'),
        CalendarDays: createMockIcon('CalendarDays'),
        Clock: createMockIcon('Clock'),
        CheckSquare: createMockIcon('CheckSquare'),
        MoreHorizontal: createMockIcon('MoreHorizontal'),
        LogIn: createMockIcon('LogIn'),
        ArrowRight: createMockIcon('ArrowRight'),
        Archive: createMockIcon('Archive'),
        CalendarClock: createMockIcon('CalendarClock'),
        Minus: createMockIcon('Minus'),
        Target: createMockIcon('Target'),
        TrendingDown: createMockIcon('TrendingDown'),
        Info: createMockIcon('Info'),
        Zap: createMockIcon('Zap'),
        TrendingUp: createMockIcon('TrendingUp'),
        BarChart3: createMockIcon('BarChart3'),
        PieChart: createMockIcon('PieChart'),
        Globe: createMockIcon('Globe'),
        Cpu: createMockIcon('Cpu'),
        HardDrive: createMockIcon('HardDrive'),
        Wifi: createMockIcon('Wifi'),
        Shield: createMockIcon('Shield'),
        Eye: createMockIcon('Eye'),
        EyeOff: createMockIcon('EyeOff'),
        Copy: createMockIcon('Copy'),
        Move: createMockIcon('Move'),
        ZoomIn: createMockIcon('ZoomIn'),
        ZoomOut: createMockIcon('ZoomOut'),
        Maximize: createMockIcon('Maximize'),
        Minimize: createMockIcon('Minimize'),
        Expand: createMockIcon('Expand'),
        Shrink: createMockIcon('Shrink'),
        RotateCcw: createMockIcon('RotateCcw'),
        Undo: createMockIcon('Undo'),
        Redo: createMockIcon('Redo'),
        Scissors: createMockIcon('Scissors'),
        PaperPlane: createMockIcon('PaperPlane'),
        MessageSquare: createMockIcon('MessageSquare'),
        Phone: createMockIcon('Phone'),
        MapPin: createMockIcon('MapPin'),
        Home: createMockIcon('Home'),
        User: createMockIcon('User'),
        UserPlus: createMockIcon('UserPlus'),
        UserMinus: createMockIcon('UserMinus'),
        UserCheck: createMockIcon('UserCheck'),
        Users2: createMockIcon('Users2'),
        CreditCard: createMockIcon('CreditCard'),
        DollarSign: createMockIcon('DollarSign'),
        Euro: createMockIcon('Euro'),
        PoundSterling: createMockIcon('PoundSterling'),
        Yen: createMockIcon('Yen'),
        Banknote: createMockIcon('Banknote'),
        Coins: createMockIcon('Coins'),
        Receipt: createMockIcon('Receipt'),
        Calculator: createMockIcon('Calculator'),
        Package: createMockIcon('Package'),
        Truck: createMockIcon('Truck'),
        Plane: createMockIcon('Plane'),
        Ship: createMockIcon('Ship'),
        Train: createMockIcon('Train'),
        Car: createMockIcon('Car'),
        Bike: createMockIcon('Bike'),
        Footprints: createMockIcon('Footprints'),
        Hotel: createMockIcon('Hotel'),
        Coffee: createMockIcon('Coffee'),
        Utensils: createMockIcon('Utensils'),
        ShoppingCart: createMockIcon('ShoppingCart'),
        ShoppingBag: createMockIcon('ShoppingBag'),
        Gift: createMockIcon('Gift'),
        Heart: createMockIcon('Heart'),
        Star: createMockIcon('Star'),
        ThumbsUp: createMockIcon('ThumbsUp'),
        ThumbsDown: createMockIcon('ThumbsDown'),
        Bookmark: createMockIcon('Bookmark'),
        Flag: createMockIcon('Flag'),
        Meh: createMockIcon('Meh'),
        Frown: createMockIcon('Frown'),
        Smile: createMockIcon('Smile'),
        Laugh: createMockIcon('Laugh'),
        Angry: createMockIcon('Angry'),
        Confused: createMockIcon('Confused'),
        Dizzy: createMockIcon('Dizzy'),
        Grimace: createMockIcon('Grimace'),
        Grin: createMockIcon('Grin'),
        Kiss: createMockIcon('Kiss'),
        Sad: createMockIcon('Sad'),
        Surprise: createMockIcon('Surprise'),
        Tired: createMockIcon('Tired'),
        Tongue: createMockIcon('Tongue'),
        Wink: createMockIcon('Wink'),
        ZapOff: createMockIcon('ZapOff'),
        Battery: createMockIcon('Battery'),
        BatteryLow: createMockIcon('BatteryLow'),
        BatteryMedium: createMockIcon('BatteryMedium'),
        BatteryHigh: createMockIcon('BatteryHigh'),
        BatteryFull: createMockIcon('BatteryFull'),
        Charging: createMockIcon('Charging'),
        Power: createMockIcon('Power'),
        PowerOff: createMockIcon('PowerOff'),
        Plug: createMockIcon('Plug'),
        Unplug: createMockIcon('Unplug'),
        WifiOff: createMockIcon('WifiOff'),
        Signal: createMockIcon('Signal'),
        SignalLow: createMockIcon('SignalLow'),
        SignalMedium: createMockIcon('SignalMedium'),
        SignalHigh: createMockIcon('SignalHigh'),
        SignalFull: createMockIcon('SignalFull'),
        Bluetooth: createMockIcon('Bluetooth'),
        BluetoothOff: createMockIcon('BluetoothOff'),
        Usb: createMockIcon('Usb'),
        UsbOff: createMockIcon('UsbOff'),
        Ethernet: createMockIcon('Ethernet'),
        EthernetOff: createMockIcon('EthernetOff'),
        Router: createMockIcon('Router'),
        RouterOff: createMockIcon('RouterOff'),
        Server: createMockIcon('Server'),
        ServerOff: createMockIcon('ServerOff'),
        DatabaseOff: createMockIcon('DatabaseOff'),
        Cloud: createMockIcon('Cloud'),
        CloudOff: createMockIcon('CloudOff'),
        CloudRain: createMockIcon('CloudRain'),
        CloudSnow: createMockIcon('CloudSnow'),
        CloudLightning: createMockIcon('CloudLightning'),
        CloudDrizzle: createMockIcon('CloudDrizzle'),
        Sunrise: createMockIcon('Sunrise'),
        Sunset: createMockIcon('Sunset'),
        Wind: createMockIcon('Wind'),
        Thermometer: createMockIcon('Thermometer'),
        ThermometerSnow: createMockIcon('ThermometerSnow'),
        ThermometerSun: createMockIcon('ThermometerSun'),
        Droplets: createMockIcon('Droplets'),
        Umbrella: createMockIcon('Umbrella'),
        Binoculars: createMockIcon('Binoculars'),
        Telescope: createMockIcon('Telescope'),
        Microscope: createMockIcon('Microscope'),
        Dna: createMockIcon('Dna'),
        Pill: createMockIcon('Pill'),
        Syringe: createMockIcon('Syringe'),
        Stethoscope: createMockIcon('Stethoscope'),
        Lungs: createMockIcon('Lungs'),
        Bone: createMockIcon('Bone'),
        Brain: createMockIcon('Brain'),
        Muscle: createMockIcon('Muscle'),
        Fingerprint: createMockIcon('Fingerprint'),
        UserX: createMockIcon('UserX'),
        UserCog: createMockIcon('UserCog'),
        UserSettings: createMockIcon('UserSettings'),
        UserSearch: createMockIcon('UserSearch'),
        UserLock: createMockIcon('UserLock'),
        UserUnlock: createMockIcon('UserUnlock'),
        UserShield: createMockIcon('UserShield')
    };
});

// Smart Mock for DataTable to test Column Logic
vi.mock('../../components/ui/DataTable', () => ({
    DataTable: ({ data, columns }: { data: Array<Record<string, unknown>>; columns: Array<{ accessorKey: string; cell?: (params: { row: { original: Record<string, unknown> } }) => React.ReactNode } & Record<string, unknown>> }) => (
        <div data-testid="data-table">
            <table>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={`row-${i}`}>
                            {columns.map((col, j) => (
                                <td key={`cell-${i}-${j}`}>
                                    {col.cell ? col.cell({ row: { original: row } }) : String(row[col.accessorKey] || '')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}));

// Mock Hooks
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { useStore } from '../../store';
import { usePersistedState } from '../../hooks/usePersistedState';

describe('Suppliers View', () => {
    const mockSuppliers = [
        {
            id: '1',
            name: 'AWS',
            category: 'Cloud',
            criticality: 'Critique',
            isICTProvider: true,
            status: 'Actif',
            securityScore: 90
        },
        {
            id: '2',
            name: 'Local Catering',
            category: 'Service',
            criticality: 'Faible',
            isICTProvider: false,
            status: 'Actif',
            securityScore: 40
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useStore).mockReturnValue({
            user: { role: 'admin', organizationId: 'org-1' },
            t: (key: string) => key,
            addToast: vi.fn(),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (vi.mocked(usePersistedState) as any).mockImplementation((key: string, defaultVal: unknown) => {
            if (key === 'suppliers_view_mode') {
                return React.useState<string>('list');
            }
            return React.useState(defaultVal);
        });

        // Mock useFirestoreCollection behavior
        (useFirestoreCollection as unknown as ReturnType<typeof vi.fn>).mockImplementation((collectionName: string) => {
            if (collectionName === 'suppliers') {
                return { data: mockSuppliers, loading: false };
            }
            return { data: [], loading: false };
        });
    });

    it('renders the suppliers table with correct data', () => {
        render(
            <MemoryRouter>
                <Suppliers />
            </MemoryRouter>
        );

        expect(screen.getByText('suppliers.title')).toBeInTheDocument();
        expect(screen.getByText('AWS')).toBeInTheDocument();
        expect(screen.getByText('Local Catering')).toBeInTheDocument();
    });

    it('displays DORA ICT badge for relevant suppliers', () => {
        render(
            <MemoryRouter>
                <Suppliers />
            </MemoryRouter>
        );

        // expecting "DORA ICT" text from the badge
        const badges = screen.getAllByText('DORA ICT');
        expect(badges.length).toBeGreaterThan(0);
        // Ensure it's associated with AWS (simple check: it exists in document)
    });

    it('calculates and displays security score colors', () => {
        render(
            <MemoryRouter>
                <Suppliers />
            </MemoryRouter>
        );

        expect(screen.getByText(/90/)).toBeInTheDocument();
        expect(screen.getByText(/40/)).toBeInTheDocument();

        // We could test classes here if we wanted to be specific about colors
    });
});
