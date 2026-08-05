/**
 * 回收站物理清理 Cron 任务
 * 每日 UTC 17:00 执行（北京时间次日 01:00）
 * 查询所有 is_deleted=true 且 updated_at < NOW() - 30天 的记录
 * 物理删除数据库记录，同时删除关联的 Supabase Storage 图片文件
 * 涉及所有业务表
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCronSecret, AuthError } from '../_lib/auth';
import { success, error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

// ============ 配置 ============

/** 软删除后保留天数（超过此天数将被物理删除） */
const RETENTION_DAYS = 30;

/** 涉及回收站清理的业务表 */
const RECYCLE_TABLES = [
  'todos',
  'transactions',
  'couple_logs',
  'memos',
  'reminders',
  'quotes',
  'user_preferences',
] as const;

/** 存储图片的业务表（有 Storage 关联文件需要清理） */
const TABLES_WITH_STORAGE = ['couple_logs', 'memos'] as const;

/** Supabase Storage Bucket 名称 */
const STORAGE_BUCKET = 'user-uploads';

/** 每批删除最大数量 */
const BATCH_SIZE = 100;

// ============ 辅助函数 ============

/**
 * 获取今天的日期标识（YYYY-MM-DD）用于幂等性检查
 */
function getTodayId(): string {
  const beijingTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().substring(0, 10);
}

/**
 * 检查当天是否已执行
 */
async function hasExecutedToday(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobName: string,
  executionDate: string
): Promise<boolean> {
  const { data, error: queryError } = await supabase
    .from('cron_executions')
    .select('id')
    .eq('job_name', jobName)
    .eq('execution_date', executionDate)
    .eq('status', 'completed')
    .limit(1);

  if (queryError) {
    console.error('[CleanupRecycle] 查询 cron_executions 失败:', queryError.message);
    return false;
  }

  return data && data.length > 0;
}

/**
 * 记录执行状态
 */
async function recordExecution(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobName: string,
  executionDate: string,
  result: string
): Promise<void> {
  try {
    await supabase.from('cron_executions').insert({
      job_name: jobName,
      execution_date: executionDate,
      status: 'completed',
      result,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`[CleanupRecycle] 记录执行状态失败:`, e);
  }
}

/**
 * 计算 30 天前的截止时间
 * @returns ISO 日期字符串
 */
function getCutoffDate(): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  return cutoff.toISOString();
}

/**
 * 从表中提取需要清理的 Storage 文件路径
 * 仅处理有 image_url 字段的记录
 * @param table 表名
 * @param records 待删除记录
 * @returns 需要从 Storage 删除的文件路径列表
 */
function extractStoragePaths(
  table: string,
  records: Record<string, any>[]
): string[] {
  const paths: string[] = [];

  if (!TABLES_WITH_STORAGE.includes(table as any)) return paths;

  for (const record of records) {
    // 从 image_url 中提取 Storage 路径
    if (record.image_url) {
      try {
        // 尝试提取路径（URL 中 user_id/uuid.webp 部分）
        const urlStr = String(record.image_url);
        // 匹配 {user_id}/{filename} 格式的路径
        const match = urlStr.match(/\/([^/]+\/[^/]+\.webp)(\?|$)/);
        if (match) {
          paths.push(match[1]);
        }
      } catch {
        // 跳过无法解析的 URL
      }
    }
  }

  return paths;
}

/**
 * 从 Supabase Storage 批量删除文件
 * @param supabase Supabase 管理员客户端
 * @param paths 要删除的文件路径列表
 * @returns 成功删除的数量
 */
async function deleteStorageFiles(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  paths: string[]
): Promise<number> {
  if (paths.length === 0) return 0;

  try {
    // Supabase Storage 的 remove 方法支持批量删除
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(paths);

    if (error) {
      console.error('[CleanupRecycle] 删除 Storage 文件失败:', error.message);
      return 0;
    }

    // data 是已成功删除的文件列表
    const deletedCount = Array.isArray(data) ? data.length : 0;
    if (deletedCount > 0) {
      console.log(`[CleanupRecycle] 已删除 ${deletedCount} 个 Storage 文件`);
    }
    return deletedCount;
  } catch (e) {
    console.error('[CleanupRecycle] 删除 Storage 文件时发生错误:', e);
    return 0;
  }
}

// ============ 主处理器 ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // 1. 验证 Cron 密钥
    verifyCronSecret(req);

    // 2. 幂等性检查
    const supabase = getSupabaseAdmin();
    const todayId = getTodayId();
    const jobName = 'cleanup-recycle';

    const alreadyExecuted = await hasExecutedToday(supabase, jobName, todayId);
    if (alreadyExecuted) {
      console.log(`[CleanupRecycle] ${todayId} 已执行，跳过`);
      return success(res, { message: `任务已于 ${todayId} 执行，跳过本次` });
    }

    // 3. 计算截止时间
    const cutoffDate = getCutoffDate();
    console.log(`[CleanupRecycle] 清理截止日期: ${cutoffDate}`);

    // 4. 逐表处理
    const tableResults: {
      table: string;
      deletedCount: number;
      storageDeletedCount: number;
    }[] = [];

    let totalDeleted = 0;
    let totalStorageDeleted = 0;

    for (const table of RECYCLE_TABLES) {
      let tableDeletedCount = 0;
      let tableStorageDeletedCount = 0;

      // 分页查询需要物理删除的记录
      let hasMore = true;
      let page = 0;

      while (hasMore) {
        // 查询 is_deleted=true 且 updated_at < cutoffDate 的记录
        const { data: records, error: queryError } = await supabase
          .from(table)
          .select('*')
          .eq('is_deleted', true)
          .lt('updated_at', cutoffDate)
          .range(0, BATCH_SIZE - 1);

        if (queryError) {
          console.error(
            `[CleanupRecycle] 查询 ${table} 表失败:`,
            queryError.message
          );
          break;
        }

        if (!records || records.length === 0) {
          hasMore = false;
          break;
        }

        // 提取需要清理的 Storage 文件
        const storagePaths = extractStoragePaths(table, records);

        // 先删除 Storage 文件（如果存在）
        if (storagePaths.length > 0) {
          const deleted = await deleteStorageFiles(supabase, storagePaths);
          tableStorageDeletedCount += deleted;
        }

        // 物理删除数据库记录
        const recordIds = records.map((r) => r.id);
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .in('id', recordIds);

        if (deleteError) {
          console.error(
            `[CleanupRecycle] 删除 ${table} 表记录失败:`,
            deleteError.message
          );
        } else {
          tableDeletedCount += records.length;
        }

        // 如果返回的记录少于 BATCH_SIZE，说明已经处理完
        if (records.length < BATCH_SIZE) {
          hasMore = false;
        }
        page++;
      }

      // 记录该表的清理结果
      tableResults.push({
        table,
        deletedCount: tableDeletedCount,
        storageDeletedCount: tableStorageDeletedCount,
      });

      totalDeleted += tableDeletedCount;
      totalStorageDeleted += tableStorageDeletedCount;
    }

    // 5. 构建结果摘要
    const resultMsg = [
      `清理完成：共删除 ${totalDeleted} 条记录（${totalStorageDeleted} 个关联文件）`,
      ...tableResults
        .filter((r) => r.deletedCount > 0 || r.storageDeletedCount > 0)
        .map((r) => `  ${r.table}: ${r.deletedCount} 条记录 + ${r.storageDeletedCount} 个文件`),
    ].join('\n');

    // 6. 记录执行结果
    await recordExecution(supabase, jobName, todayId, resultMsg);

    console.log(`[CleanupRecycle] ${resultMsg}`);

    // 7. 返回结果
    return success(res, {
      executionDate: todayId,
      cutoffDate,
      totalDeleted,
      totalStorageDeleted,
      tableResults,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[CleanupRecycle] 执行失败:', e);
    return error(res, 500, 'Cron 任务执行失败');
  }
}
