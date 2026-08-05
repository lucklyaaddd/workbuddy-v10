/**
 * IndexedDB 本地存储工具
 * 用于离线数据缓存和同步队列管理
 */
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { SyncQueueItem } from '@/types';

// ============ 数据库 Schema 定义 ============
interface WorkBuddyDB extends DBSchema {
  // 离线同步队列
  sync_queue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-status': string; 'by-table': string };
  };
  // 本地缓存的数据表（按表名分存储）
  cache_todos: { key: string; value: any };
  cache_transactions: { key: string; value: any };
  cache_couple_logs: { key: string; value: any };
  cache_memos: { key: string; value: any };
  cache_reminders: { key: string; value: any };
  cache_quotes: { key: string; value: any };
  // 元数据（最后同步时间等）
  meta: { key: string; value: any };
}

let dbInstance: IDBPDatabase<WorkBuddyDB> | null = null;

/**
 * 获取 IndexedDB 实例（单例）
 */
export async function getDB(): Promise<IDBPDatabase<WorkBuddyDB>> {
  if (!dbInstance) {
    dbInstance = await openDB<WorkBuddyDB>('workbuddy-v10', 1, {
      upgrade(db) {
        // 同步队列
        const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        syncStore.createIndex('by-status', 'status');
        syncStore.createIndex('by-table', 'table');

        // 缓存存储
        db.createObjectStore('cache_todos', { keyPath: 'id' });
        db.createObjectStore('cache_transactions', { keyPath: 'id' });
        db.createObjectStore('cache_couple_logs', { keyPath: 'id' });
        db.createObjectStore('cache_memos', { keyPath: 'id' });
        db.createObjectStore('cache_reminders', { keyPath: 'id' });
        db.createObjectStore('cache_quotes', { keyPath: 'id' });

        // 元数据
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
  }
  return dbInstance;
}

// ============ 同步队列操作 ============

/**
 * 添加同步队列项
 */
export async function enqueueSync(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('sync_queue', item);
}

/**
 * 获取所有待同步的队列项
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('sync_queue', 'by-status', 'pending');
}

/**
 * 更新队列项状态
 */
export async function updateSyncItemStatus(id: string, status: SyncQueueItem['status']): Promise<void> {
  const db = await getDB();
  const item = await db.get('sync_queue', id);
  if (item) {
    item.status = status;
    await db.put('sync_queue', item);
  }
}

/**
 * 删除已同步的队列项
 */
export async function removeSyncItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

/**
 * 获取同步队列中冲突的项目
 */
export async function getConflictItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('sync_queue', 'by-status', 'conflict');
}

// ============ 缓存操作 ============

/**
 * 缓存表名映射
 */
const CACHE_STORES = {
  todos: 'cache_todos',
  transactions: 'cache_transactions',
  couple_logs: 'cache_couple_logs',
  memos: 'cache_memos',
  reminders: 'cache_reminders',
  quotes: 'cache_quotes',
} as const;

/**
 * 批量写入缓存数据
 */
export async function cacheRecords(table: keyof typeof CACHE_STORES, records: any[]): Promise<void> {
  const db = await getDB();
  const storeName = CACHE_STORES[table];
  const tx = db.transaction(storeName, 'readwrite');
  await Promise.all(records.map(r => tx.store.put(r)));
  await tx.done;
}

/**
 * 获取缓存的全部记录
 */
export async function getCachedRecords(table: keyof typeof CACHE_STORES): Promise<any[]> {
  const db = await getDB();
  const storeName = CACHE_STORES[table];
  return db.getAll(storeName);
}

/**
 * 清除所有离线数据（退出登录时调用）
 */
export async function clearOfflineData(): Promise<void> {
  const db = await getDB();
  const stores = ['sync_queue', ...Object.values(CACHE_STORES), 'meta'];
  const tx = db.transaction(stores as any[], 'readwrite');
  await Promise.all(stores.map(s => tx.objectStore(s as any).clear()));
  await tx.done;
}

// ============ 元数据操作 ============

/**
 * 设置元数据（如最后同步时间）
 */
export async function setMeta(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('meta', { key, value });
}

/**
 * 获取元数据
 */
export async function getMeta(key: string): Promise<any> {
  const db = await getDB();
  const result = await db.get('meta', key);
  return result?.value;
}
