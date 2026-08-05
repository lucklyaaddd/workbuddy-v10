/**
 * 私厨菜谱本地缓存
 * 使用独立 IndexedDB（workbuddy-recipes），作为 Supabase 读取失败时的兜底
 * 与全局 idb.ts 解耦，不影响其他模块的离线同步逻辑
 */
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Recipe } from '@/types';

// ============ 数据库 Schema ============
interface RecipeDB extends DBSchema {
  recipes: {
    key: string;
    value: Recipe;
  };
}

let dbInstance: IDBPDatabase<RecipeDB> | null = null;

/**
 * 获取 IndexedDB 实例（单例）
 */
export async function getRecipeDB(): Promise<IDBPDatabase<RecipeDB>> {
  if (!dbInstance) {
    dbInstance = await openDB<RecipeDB>('workbuddy-recipes', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('recipes')) {
          db.createObjectStore('recipes', { keyPath: 'id' });
        }
      },
    });
  }
  return dbInstance;
}

/**
 * 批量缓存菜谱列表（覆盖写入）
 */
export async function cacheRecipes(records: Recipe[]): Promise<void> {
  const db = await getRecipeDB();
  const tx = db.transaction('recipes', 'readwrite');
  await Promise.all(records.map((r) => tx.store.put(r)));
  await tx.done;
}

/**
 * 读取全部缓存菜谱（按创建时间倒序）
 */
export async function getCachedRecipes(): Promise<Recipe[]> {
  const db = await getRecipeDB();
  const all = await db.getAll('recipes');
  return all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

/**
 * 写入/更新单条菜谱缓存
 */
export async function putCachedRecipe(r: Recipe): Promise<void> {
  const db = await getRecipeDB();
  await db.put('recipes', r);
}

/**
 * 删除单条菜谱缓存
 */
export async function deleteCachedRecipe(id: string): Promise<void> {
  const db = await getRecipeDB();
  await db.delete('recipes', id);
}
