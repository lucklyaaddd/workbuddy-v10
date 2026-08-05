/**
 * 离线双向同步引擎
 * 核心功能：
 * 1. 离线时将操作写入 IndexedDB 同步队列
 * 2. 网络恢复后自动推送队列到后端
 * 3. 使用 version 乐观锁处理多设备数据冲突
 * 4. 冲突时弹窗展示版本差异交由用户选择
 */
import { supabase, getCurrentUserId } from './supabase';
import {
  getDB,
  enqueueSync,
  getPendingSyncItems,
  updateSyncItemStatus,
  removeSyncItem,
  getConflictItems,
  setMeta,
  getMeta,
  cacheRecords,
} from './idb';
import type { SyncQueueItem, SyncOpType, BaseEntity } from '@/types';
import { generateUUID } from './utils';

// ============ 同步状态 ============

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

let currentStatus: SyncStatus = 'idle';
let statusListeners: ((status: SyncStatus) => void)[] = [];
let conflictListeners: ((conflicts: SyncQueueItem[]) => void)[] = [];

/**
 * 监听同步状态变化
 */
export function onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
  statusListeners.push(listener);
  listener(currentStatus);
  return () => {
    statusListeners = statusListeners.filter(l => l !== listener);
  };
}

/**
 * 监听冲突事件
 */
export function onConflict(listener: (conflicts: SyncQueueItem[]) => void): () => void {
  conflictListeners.push(listener);
  return () => {
    conflictListeners = conflictListeners.filter(l => l !== listener);
  };
}

function setStatus(status: SyncStatus) {
  currentStatus = status;
  statusListeners.forEach(l => l(status));
}

// ============ 离线操作入队 ============

/**
 * 将离线操作加入同步队列
 * 同时更新本地缓存
 * @param table 目标表名
 * @param op 操作类型
 * @param recordId 记录ID
 * @param data 操作数据
 */
export async function queueOfflineOp(
  table: string,
  op: SyncOpType,
  recordId: string,
  data: any
): Promise<void> {
  const item: SyncQueueItem = {
    id: generateUUID(),
    table,
    op,
    record_id: recordId,
    data,
    created_at: Date.now(),
    retry_count: 0,
    status: 'pending',
  };
  await enqueueSync(item);
  // 标记为离线状态
  if (currentStatus === 'idle') {
    setStatus('offline');
  }
}

// ============ 自动同步触发 ============

/**
 * 初始化网络状态监听
 * 在应用启动时调用
 */
export function initOfflineSync(): void {
  // 监听网络状态变化
  window.addEventListener('online', () => {
    console.log('[Sync] 网络恢复，开始同步...');
    syncNow();
  });

  window.addEventListener('offline', () => {
    console.log('[Sync] 网络断开，进入离线模式');
    setStatus('offline');
  });

  // 初始检查网络状态
  if (!navigator.onLine) {
    setStatus('offline');
  }

  // 定时检查同步（每 30 秒）
  setInterval(() => {
    if (navigator.onLine && currentStatus !== 'syncing') {
      syncNow();
    }
  }, 30000);

  // 首次启动立即同步一次
  if (navigator.onLine) {
    syncNow();
  }
}

// ============ 同步执行 ============

/**
 * 执行同步
 * 1. 推送本地队列到服务器
 * 2. 拉取服务器最新数据更新本地缓存
 */
export async function syncNow(): Promise<void> {
  if (currentStatus === 'syncing') return;
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }

  setStatus('syncing');
  try {
    // 阶段1：推送本地队列
    await pushPendingQueue();

    // 阶段2：拉取服务器数据
    await pullRemoteData();

    // 检查是否有冲突
    const conflicts = await getConflictItems();
    if (conflicts.length > 0) {
      conflictListeners.forEach(l => l(conflicts));
    }

    setStatus('idle');
    await setMeta('lastSyncTime', Date.now());
  } catch (err) {
    console.error('[Sync] 同步失败', err);
    setStatus('error');
  }
}

/**
 * 推送本地待同步队列到服务器
 */
async function pushPendingQueue(): Promise<void> {
  const items = await getPendingSyncItems();
  if (items.length === 0) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  for (const item of items) {
    try {
      await syncSingleItem(item, userId);
      await removeSyncItem(item.id);
    } catch (err: any) {
      console.error(`[Sync] 同步失败: ${item.id}`, err);
      // 检查是否为冲突
      if (err.message?.includes('conflict') || err.code === '409') {
        await updateSyncItemStatus(item.id, 'conflict');
      } else {
        item.retry_count++;
        if (item.retry_count >= 5) {
          await updateSyncItemStatus(item.id, 'failed');
        } else {
          await enqueueSync(item); // 更新重试次数
        }
      }
    }
  }
}

/**
 * 同步单个队列项
 */
async function syncSingleItem(item: SyncQueueItem, userId: string): Promise<void> {
  const { table, op, record_id, data } = item;

  // 根据操作类型执行
  switch (op) {
    case 'create': {
      const { error } = await supabase.from(table).insert({ ...data, user_id: userId });
      if (error) throw error;
      break;
    }
    case 'update': {
      // 乐观锁：检查 version 是否匹配
      const { data: existing, error: fetchErr } = await supabase
        .from(table)
        .select('version')
        .eq('id', record_id)
        .single();

      if (fetchErr) throw fetchErr;

      // 版本冲突检测
      if (existing && existing.version > data.version) {
        throw new Error('conflict: 服务器数据版本更新');
      }

      // 更新数据并递增版本号
      const { error } = await supabase
        .from(table)
        .update({ ...data, version: (data.version || 1) + 1 })
        .eq('id', record_id)
        .eq('version', data.version || 1); // 乐观锁条件

      if (error) throw error;
      break;
    }
    case 'delete': {
      // 软删除
      const { error } = await supabase
        .from(table)
        .update({ is_deleted: true, version: (data.version || 1) + 1 })
        .eq('id', record_id)
        .eq('version', data.version || 1);

      if (error) throw error;
      break;
    }
  }
}

/**
 * 拉取服务器最新数据更新本地缓存
 * 增量更新：仅拉取上次同步后的变更
 */
async function pullRemoteData(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const lastSync = (await getMeta('lastSyncTime')) as number || 0;
  const lastSyncDate = new Date(lastSync).toISOString();

  const tables = ['todos', 'transactions', 'couple_logs', 'memos', 'reminders', 'quotes'];

  for (const table of tables) {
    try {
      // 增量拉取：仅获取更新时间大于上次同步的记录
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .or(`updated_at.gte.${lastSyncDate}`)
        .order('updated_at', { ascending: false })
        .limit(500); // 分页限制

      if (error) {
        console.error(`[Sync] 拉取 ${table} 失败`, error);
        continue;
      }

      if (data && data.length > 0) {
        await cacheRecords(table as any, data);
      }
    } catch (err) {
      console.error(`[Sync] 拉取 ${table} 异常`, err);
    }
  }
}

// ============ 冲突解决 ============

/**
 * 解决冲突：用户选择使用本地版本覆盖远程
 */
export async function resolveConflictUseLocal(item: SyncQueueItem): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    // 强制覆盖远程数据
    const { error } = await supabase
      .from(item.table)
      .update({ ...item.data, version: (item.data.version || 1) + 1, user_id: userId })
      .eq('id', item.record_id);

    if (error) throw error;
    await removeSyncItem(item.id);
  } catch (err) {
    console.error('[Sync] 解决冲突失败', err);
  }
}

/**
 * 解决冲突：用户选择使用远程版本
 */
export async function resolveConflictUseRemote(item: SyncQueueItem): Promise<void> {
  // 拉取远程最新数据
  const { data, error } = await supabase
    .from(item.table)
    .select('*')
    .eq('id', item.record_id)
    .single();

  if (error) {
    console.error('[Sync] 拉取远程数据失败', error);
    return;
  }

  // 更新本地缓存
  await cacheRecords(item.table as any, [data]);
  await removeSyncItem(item.id);
}

/**
 * 获取最后同步时间
 */
export async function getLastSyncTime(): Promise<number> {
  return (await getMeta('lastSyncTime')) as number || 0;
}
