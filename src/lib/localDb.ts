/**
 * 通用本地缓存（IndexedDB）
 * ---------------------------------------------------------------
 * 为每个模块提供独立的本地数据库，用于「本地优先」读取：
 *   - 打开功能时先用缓存瞬时渲染（无需等待海外网络）
 *   - 同时在后台从 Supabase 拉取最新数据并回写缓存
 *
 * 用法：
 *   const store = createLocalStore<Todo>('workbuddy-todos');
 *   const cached = await store.getCached();   // 读取
 *   await store.setCached(items);             // 写入（先 clear 再 put）
 *
 * 每个模块使用独立的 dbName，互不干扰。缓存写入/读取失败均被吞掉，
 * 不会影响主流程（最多退化为「网络优先」）。
 */
export interface LocalStore<T> {
  /** 读取全部缓存项；异常时返回空数组 */
  getCached: () => Promise<T[]>;
  /** 覆盖写入缓存（先清空再逐条 put） */
  setCached: (items: T[]) => Promise<void>;
}

export function createLocalStore<T extends { id: string }>(
  dbName: string,
  storeName = 'items'
): LocalStore<T> {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const getCached = async (): Promise<T[]> => {
    try {
      const db = await open();
      return await new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve((req.result as T[]) || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  };

  const setCached = async (items: T[]): Promise<void> => {
    try {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        for (const it of items) store.put(it);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      /* 缓存写入失败不影响主流程 */
    }
  };

  return { getCached, setCached };
}
