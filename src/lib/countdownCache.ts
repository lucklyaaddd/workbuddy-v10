/**
 * 倒数日本地缓存
 * 使用独立 IndexedDB（workbuddy-countdowns），作为 Supabase 读取失败时的兜底
 * 与 recipeCache 解耦，不影响其他模块的离线同步逻辑
 */
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Countdown } from '@/types';

// ============ 数据库 Schema ============
interface CountdownDB extends DBSchema {
  countdowns: {
    key: string;
    value: Countdown;
  };
}

let dbInstance: IDBPDatabase<CountdownDB> | null = null;

/**
 * 获取 IndexedDB 实例（单例）
 */
export async function getCountdownDB(): Promise<IDBPDatabase<CountdownDB>> {
  if (!dbInstance) {
    dbInstance = await openDB<CountdownDB>('workbuddy-countdowns', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('countdowns')) {
          db.createObjectStore('countdowns', { keyPath: 'id' });
        }
      },
    });
  }
  return dbInstance;
}

/**
 * 批量缓存倒数日列表（覆盖写入）
 */
export async function cacheCountdowns(records: Countdown[]): Promise<void> {
  const db = await getCountdownDB();
  const tx = db.transaction('countdowns', 'readwrite');
  await Promise.all(records.map((r) => tx.store.put(r)));
  await tx.done;
}

/**
 * 读取全部缓存倒数日（按创建时间倒序）
 */
export async function getCachedCountdowns(): Promise<Countdown[]> {
  const db = await getCountdownDB();
  const all = await db.getAll('countdowns');
  return all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

/**
 * 写入/更新单条倒数日缓存
 */
export async function putCachedCountdown(r: Countdown): Promise<void> {
  const db = await getCountdownDB();
  await db.put('countdowns', r);
}

/**
 * 删除单条倒数日缓存
 */
export async function deleteCachedCountdown(id: string): Promise<void> {
  const db = await getCountdownDB();
  await db.delete('countdowns', id);
}
