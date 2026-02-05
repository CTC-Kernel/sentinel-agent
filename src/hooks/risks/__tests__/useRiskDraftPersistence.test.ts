/**
 * Tests for useRiskDraftPersistence hook
 * Story 3.1: Enhanced Risk Creation Form
 * Task 7.3: Test draft persistence functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
 useRiskDraftPersistence,
 getRiskDraftStorageKey,
 clearAllRiskDrafts,
} from '../useRiskDraftPersistence';

// Mock localStorage
const localStorageMock = (() => {
 let store: Record<string, string> = {};
 return {
 getItem: vi.fn((key: string) => store[key] || null),
 setItem: vi.fn((key: string, value: string) => {
 store[key] = value;
 }),
 removeItem: vi.fn((key: string) => {
 delete store[key];
 }),
 clear: vi.fn(() => {
 store = {};
 }),
 get length() {
 return Object.keys(store).length;
 },
 key: vi.fn((index: number) => Object.keys(store)[index] || null),
 };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('getRiskDraftStorageKey', () => {
 it('should generate key for new risk', () => {
 const key = getRiskDraftStorageKey('org123');
 expect(key).toBe('sentinel_risk_draft_org123_new');
 });

 it('should generate key for existing risk', () => {
 const key = getRiskDraftStorageKey('org123', 'risk456');
 expect(key).toBe('sentinel_risk_draft_org123_risk456');
 });
});

describe('useRiskDraftPersistence', () => {
 beforeEach(() => {
 localStorageMock.clear();
 vi.clearAllMocks();
 vi.useFakeTimers();
 });

 afterEach(() => {
 vi.useRealTimers();
 });

 it('should return null when no draft exists', () => {
 const { result } = renderHook(() =>
 useRiskDraftPersistence({
 organizationId: 'org123',
 enabled: true,
 })
 );

 expect(result.current.savedDraft).toBeNull();
 expect(result.current.hasDraft).toBe(false);
 });

 it('should load existing draft from localStorage', () => {
 const draftData = {
 data: { threat: 'Test threat' },
 savedAt: new Date().toISOString(),
 version: 1,
 };
 localStorageMock.setItem(
 'sentinel_risk_draft_org123_new',
 JSON.stringify(draftData)
 );

 const { result } = renderHook(() =>
 useRiskDraftPersistence({
 organizationId: 'org123',
 enabled: true,
 })
 );

 expect(result.current.savedDraft).toEqual({ threat: 'Test threat' });
 expect(result.current.hasDraft).toBe(true);
 });

 it('should save draft to localStorage with debounce', async () => {
 const { result } = renderHook(() =>
 useRiskDraftPersistence({
 organizationId: 'org123',
 enabled: true,
 debounceMs: 500,
 })
 );

 act(() => {
 result.current.saveDraft({ threat: 'New threat' });
 });

 // Should not be saved immediately
 expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
 'sentinel_risk_draft_org123_new',
 expect.any(String)
 );

 // Advance timers past debounce delay
 act(() => {
 vi.advanceTimersByTime(600);
 });

 // Now it should be saved
 expect(localStorageMock.setItem).toHaveBeenCalledWith(
 'sentinel_risk_draft_org123_new',
 expect.any(String)
 );
 });

 it('should not save if threat is empty', async () => {
 const { result } = renderHook(() =>
 useRiskDraftPersistence({
 organizationId: 'org123',
 enabled: true,
 debounceMs: 100,
 })
 );

 act(() => {
 result.current.saveDraft({ vulnerability: 'Test' }); // No threat
 });

 act(() => {
 vi.advanceTimersByTime(200);
 });

 // Should not save without threat
 expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
 'sentinel_risk_draft_org123_new',
 expect.any(String)
 );
 });

 it('should clear draft from localStorage', () => {
 localStorageMock.setItem(
 'sentinel_risk_draft_org123_new',
 JSON.stringify({ data: { threat: 'Test' } })
 );

 const { result } = renderHook(() =>
 useRiskDraftPersistence({
 organizationId: 'org123',
 enabled: true,
 })
 );

 act(() => {
 result.current.clearDraft();
 });

 expect(localStorageMock.removeItem).toHaveBeenCalledWith(
 'sentinel_risk_draft_org123_new'
 );
 expect(result.current.savedDraft).toBeNull();
 expect(result.current.hasDraft).toBe(false);
 });

 it('should not load draft when disabled', () => {
 const draftData = {
 data: { threat: 'Test threat' },
 savedAt: new Date().toISOString(),
 version: 1,
 };
 localStorageMock.setItem(
 'sentinel_risk_draft_org123_new',
 JSON.stringify(draftData)
 );

 const { result } = renderHook(() =>
 useRiskDraftPersistence({
 organizationId: 'org123',
 enabled: false,
 })
 );

 expect(result.current.savedDraft).toBeNull();
 expect(result.current.hasDraft).toBe(false);
 });

 it('should use risk ID in storage key when provided', () => {
 const { result } = renderHook(() =>
 useRiskDraftPersistence({
 organizationId: 'org123',
 riskId: 'risk456',
 enabled: true,
 debounceMs: 100,
 })
 );

 act(() => {
 result.current.saveDraft({ threat: 'Test threat' });
 });

 act(() => {
 vi.advanceTimersByTime(200);
 });

 expect(localStorageMock.setItem).toHaveBeenCalledWith(
 'sentinel_risk_draft_org123_risk456',
 expect.any(String)
 );
 });
});

describe('clearAllRiskDrafts', () => {
 beforeEach(() => {
 localStorageMock.clear();
 vi.clearAllMocks();
 });

 it('should clear all drafts for an organization', () => {
 // Set up multiple drafts
 localStorageMock.setItem(
 'sentinel_risk_draft_org123_new',
 JSON.stringify({ data: { threat: 'Test 1' } })
 );
 localStorageMock.setItem(
 'sentinel_risk_draft_org123_risk1',
 JSON.stringify({ data: { threat: 'Test 2' } })
 );
 localStorageMock.setItem(
 'sentinel_risk_draft_org456_new',
 JSON.stringify({ data: { threat: 'Test 3' } })
 );
 localStorageMock.setItem('other_key', 'other_value');

 clearAllRiskDrafts('org123');

 expect(localStorageMock.removeItem).toHaveBeenCalledWith(
 'sentinel_risk_draft_org123_new'
 );
 expect(localStorageMock.removeItem).toHaveBeenCalledWith(
 'sentinel_risk_draft_org123_risk1'
 );
 // Should not remove drafts from other orgs or other keys
 expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(
 'sentinel_risk_draft_org456_new'
 );
 expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('other_key');
 });
});
