/**
 * Sync Slice
 *
 * Manages synchronization state for real-time updates with Firebase.
 * Tracks connection status, last sync time, and pending changes.
 */

import type { SyncSlice, VoxelSliceCreator } from './types';
import { initialSync } from './types';

/**
 * Creates the sync slice with all sync-related state and actions.
 *
 * @returns Sync slice state and actions
 */
export const createSyncSlice: VoxelSliceCreator<SyncSlice> = (set) => ({
  sync: initialSync,

  /**
   * Set the synchronization status.
   *
   * @param status - New sync status ('connected' | 'syncing' | 'offline')
   */
  setSyncStatus: (status) =>
    set(
      (state) => ({ sync: { ...state.sync, status } }),
      false,
      'setSyncStatus'
    ),

  /**
   * Set the last successful sync timestamp.
   *
   * @param date - Date of last sync, or null to clear
   */
  setLastSyncAt: (date) =>
    set(
      (state) => ({ sync: { ...state.sync, lastSyncAt: date } }),
      false,
      'setLastSyncAt'
    ),

  /**
   * Increment the pending changes counter.
   * Called when a local change is made that needs to be synced.
   */
  incrementPendingChanges: () =>
    set(
      (state) => ({
        sync: { ...state.sync, pendingChanges: state.sync.pendingChanges + 1 },
      }),
      false,
      'incrementPendingChanges'
    ),

  /**
   * Decrement the pending changes counter.
   * Called when a change has been successfully synced.
   * Will not go below zero.
   */
  decrementPendingChanges: () =>
    set(
      (state) => ({
        sync: {
          ...state.sync,
          pendingChanges: Math.max(0, state.sync.pendingChanges - 1),
        },
      }),
      false,
      'decrementPendingChanges'
    ),

  /**
   * Reset the pending changes counter to zero.
   * Called after a bulk sync operation completes.
   */
  resetPendingChanges: () =>
    set(
      (state) => ({ sync: { ...state.sync, pendingChanges: 0 } }),
      false,
      'resetPendingChanges'
    ),
});
