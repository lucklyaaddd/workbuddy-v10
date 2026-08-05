/**
 * 同步状态管理（Zustand）
 * 管理离线同步状态、最后同步时间
 */
import { create } from 'zustand';
import { onSyncStatusChange, onConflict, syncNow, getLastSyncTime } from '@/lib/offline-sync';
import type { SyncQueueItem } from '@/types';

interface SyncState {
  status: 'idle' | 'syncing' | 'offline' | 'error';
  lastSyncTime: number;
  conflicts: SyncQueueItem[];
  init: () => void;
  triggerSync: () => Promise<void>;
  clearConflicts: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncTime: 0,
  conflicts: [],

  init: () => {
    // 监听同步状态
    onSyncStatusChange((status) => {
      set({ status });
      if (status === 'idle') {
        getLastSyncTime().then(time => set({ lastSyncTime: time }));
      }
    });

    // 监听冲突
    onConflict((conflicts) => {
      set({ conflicts });
    });

    // 加载最后同步时间
    getLastSyncTime().then(time => set({ lastSyncTime: time }));
  },

  triggerSync: async () => {
    await syncNow();
  },

  clearConflicts: () => set({ conflicts: [] }),
}));
