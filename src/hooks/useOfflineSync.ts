/**
 * 离线同步 Hook
 * 封装 syncStore，提供同步状态和手动触发同步功能
 */
import { useSyncStore } from '@/stores/syncStore';
import type { SyncQueueItem } from '@/types';

// ============ 同步状态类型 ============
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

/**
 * 离线同步 Hook
 * 返回同步状态、冲突列表、最后同步时间及手动触发方法
 */
export function useOfflineSync() {
  const store = useSyncStore();
  const { status, lastSyncTime, conflicts, init, triggerSync, clearConflicts } = store;

  return {
    status,         // 同步状态：idle/syncing/offline/error
    lastSyncTime,   // 最后同步时间戳
    conflicts,      // 冲突列表
    isSyncing: status === 'syncing',      // 是否同步中
    isOffline: status === 'offline',      // 是否离线
    hasConflicts: conflicts.length > 0,   // 是否有冲突
    init,           // 初始化同步监听
    triggerSync,    // 手动触发同步
    clearConflicts, // 清除冲突列表
  };
}

// 类型导出
export type { SyncQueueItem };
