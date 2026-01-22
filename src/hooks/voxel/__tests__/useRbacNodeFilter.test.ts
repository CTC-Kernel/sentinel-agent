/**
 * useRbacNodeFilter Tests
 *
 * @see Story VOX-8.5: RBAC Node Filtering
 * @see Story VOX-8.6: Admin Full Access
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRbacNodeFilter, filterNodesByPermission } from '../useRbacNodeFilter';
import type { VoxelNode } from '@/types/voxel';
import type { UserProfile } from '@/types';

// ============================================================================
// Mocks
// ============================================================================

// Mock the store
const mockUser = vi.fn();
vi.mock('@/store', () => ({
  useStore: () => ({
    user: mockUser(),
    customRoles: [],
  }),
}));

// Mock hasPermission to simulate different permission scenarios
vi.mock('@/utils/permissions', () => ({
  hasPermission: vi.fn((user, resource, action) => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    // Simulate auditor permissions - can read audits, assets, controls
    if (user.role === 'auditor') {
      const allowedResources = ['Audit', 'Asset', 'Control', 'Risk', 'Project'];
      return action === 'read' && allowedResources.includes(resource);
    }

    // Simulate user permissions - can read assets, risks
    if (user.role === 'user') {
      const allowedResources = ['Asset', 'Risk', 'Project', 'Audit', 'Control', 'Incident'];
      return action === 'read' && allowedResources.includes(resource);
    }

    return false;
  }),
}));

// ============================================================================
// Test Data
// ============================================================================

const createMockNode = (type: VoxelNode['type'], id: string): VoxelNode => ({
  id,
  type,
  label: `Test ${type} ${id}`,
  position: { x: 0, y: 0, z: 0 },
  status: 'normal',
  size: 1,
  data: {},
  connections: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockNodes: VoxelNode[] = [
  createMockNode('asset', 'asset-1'),
  createMockNode('risk', 'risk-1'),
  createMockNode('control', 'control-1'),
  createMockNode('project', 'project-1'),
  createMockNode('audit', 'audit-1'),
  createMockNode('incident', 'incident-1'),
  createMockNode('supplier', 'supplier-1'),
];

const createMockUser = (role: string): UserProfile =>
  ({
    uid: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    role,
    organizationId: 'org-1',
    isPending: false,
  }) as UserProfile;

// ============================================================================
// Tests
// ============================================================================

describe('useRbacNodeFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.mockReturnValue(null);
  });

  describe('Admin Access', () => {
    it('should allow admin to view all node types', () => {
      mockUser.mockReturnValue(createMockUser('admin'));

      const { result } = renderHook(() => useRbacNodeFilter());

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.viewableNodeTypes).toHaveLength(7);
      expect(result.current.viewableNodeTypes).toContain('asset');
      expect(result.current.viewableNodeTypes).toContain('risk');
      expect(result.current.viewableNodeTypes).toContain('supplier');
    });

    it('should not filter any nodes for admin', () => {
      mockUser.mockReturnValue(createMockUser('admin'));

      const { result } = renderHook(() => useRbacNodeFilter());
      const filtered = result.current.filterNodes(mockNodes);

      expect(filtered).toHaveLength(mockNodes.length);
    });

    it('should report canViewNodeType as true for all types for admin', () => {
      mockUser.mockReturnValue(createMockUser('admin'));

      const { result } = renderHook(() => useRbacNodeFilter());

      expect(result.current.canViewNodeType('asset')).toBe(true);
      expect(result.current.canViewNodeType('risk')).toBe(true);
      expect(result.current.canViewNodeType('supplier')).toBe(true);
    });
  });

  describe('Regular User Access', () => {
    it('should filter nodes based on user permissions', () => {
      mockUser.mockReturnValue(createMockUser('user'));

      const { result } = renderHook(() => useRbacNodeFilter());
      const filtered = result.current.filterNodes(mockNodes);

      // User can read: Asset, Risk, Project, Audit, Control, Incident (not Supplier)
      expect(filtered).toHaveLength(6);
      expect(filtered.find((n) => n.type === 'supplier')).toBeUndefined();
    });

    it('should return correct viewable node types for user', () => {
      mockUser.mockReturnValue(createMockUser('user'));

      const { result } = renderHook(() => useRbacNodeFilter());

      expect(result.current.viewableNodeTypes).toContain('asset');
      expect(result.current.viewableNodeTypes).toContain('risk');
      expect(result.current.viewableNodeTypes).not.toContain('supplier');
    });
  });

  describe('Auditor Access', () => {
    it('should filter nodes for auditor role', () => {
      mockUser.mockReturnValue(createMockUser('auditor'));

      const { result } = renderHook(() => useRbacNodeFilter());
      const filtered = result.current.filterNodes(mockNodes);

      // Auditor can read: Audit, Asset, Control, Risk, Project
      expect(filtered.find((n) => n.type === 'audit')).toBeDefined();
      expect(filtered.find((n) => n.type === 'asset')).toBeDefined();
      expect(filtered.find((n) => n.type === 'control')).toBeDefined();
    });
  });

  describe('No User', () => {
    it('should return all nodes when no user is logged in', () => {
      mockUser.mockReturnValue(null);

      const { result } = renderHook(() => useRbacNodeFilter());
      const filtered = result.current.filterNodes(mockNodes);

      // No filtering when no user
      expect(filtered).toHaveLength(mockNodes.length);
    });

    it('should return all node types as viewable when no user', () => {
      mockUser.mockReturnValue(null);

      const { result } = renderHook(() => useRbacNodeFilter());

      expect(result.current.viewableNodeTypes).toHaveLength(7);
    });
  });

  describe('Disabled Filtering', () => {
    it('should not filter when enabled is false', () => {
      mockUser.mockReturnValue(createMockUser('user'));

      const { result } = renderHook(() => useRbacNodeFilter({ enabled: false }));
      const filtered = result.current.filterNodes(mockNodes);

      expect(filtered).toHaveLength(mockNodes.length);
    });
  });
});

describe('filterNodesByPermission', () => {
  it('should return all nodes when user is null', () => {
    const filtered = filterNodesByPermission(mockNodes, null);
    expect(filtered).toHaveLength(mockNodes.length);
  });

  it('should return all nodes for admin user', () => {
    const admin = createMockUser('admin');
    const filtered = filterNodesByPermission(mockNodes, admin);
    expect(filtered).toHaveLength(mockNodes.length);
  });

  it('should filter nodes based on permissions for regular user', () => {
    const user = createMockUser('user');
    const filtered = filterNodesByPermission(mockNodes, user);

    // Should filter out supplier
    expect(filtered.find((n) => n.type === 'supplier')).toBeUndefined();
  });

  it('should handle empty nodes array', () => {
    const user = createMockUser('user');
    const filtered = filterNodesByPermission([], user);
    expect(filtered).toHaveLength(0);
  });
});
