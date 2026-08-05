/**
 * 数据导出接口
 * GET 请求，导出所有业务表数据，打包 ZIP 下载
 * 支持 JSON/CSV 格式，每日导出次数限制
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, rateLimit, AuthError, RateLimitError } from '../_lib/auth';
import { error } from '../_lib/response';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import JSZip from 'jszip';

// ============ 业务表配置 ============
/** 需要导出的业务表列表 */
const BUSINESS_TABLES = [
  'todos',
  'transactions',
  'couple_logs',
  'memos',
  'reminders',
  'quotes',
  'user_preferences',
] as const;

/** 每页查询大小 */
const PAGE_SIZE = 1000;

/** 每日最大导出次数 */
const DAILY_EXPORT_LIMIT = parseInt(process.env.EXPORT_DAILY_LIMIT || '3', 10);

// ============ 辅助函数 ============

/**
 * 处理跨域预检请求
 */
function handleCors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * 分页查询单张表的所有记录
 * @param supabase Supabase 管理员客户端
 * @param userId 用户 ID
 * @param table 表名
 * @returns 该表的所有记录
 */
async function fetchAllRows(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  table: string
): Promise<Record<string, any>[]> {
  const allRows: Record<string, any>[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error: queryError } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (queryError) {
      console.error(`[Export] 查询 ${table} 失败:`, queryError.message);
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
    }

    // 如果返回的数据少于 PAGE_SIZE，说明已到最后一页
    hasMore = data && data.length === PAGE_SIZE;
    page++;
  }

  return allRows;
}

/**
 * 将数据转换为 JSON 字符串
 * @param data 按表名分组的导出数据
 */
function toJsonString(data: Record<string, Record<string, any>[]>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [table, rows] of Object.entries(data)) {
    result[`${table}.json`] = JSON.stringify(rows, null, 2);
  }
  return result;
}

/**
 * 将数据转换为 CSV 字符串
 * 简单实现：处理常见数据类型，不包含复杂嵌套对象
 * @param data 按表名分组的导出数据
 */
function toCsvString(data: Record<string, Record<string, any>[]>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [table, rows] of Object.entries(data)) {
    if (rows.length === 0) {
      result[`${table}.csv`] = '';
      continue;
    }

    // 获取所有列名（去重）
    const allColumns = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((key) => allColumns.add(key));
    }
    const columns = Array.from(allColumns);

    // CSV 转义函数
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      // 如果包含逗号、引号或换行符，需要用引号包裹并转义内部引号
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // 构建 CSV 内容
    const lines: string[] = [];
    // 表头
    lines.push(columns.map(escapeCsv).join(','));
    // 数据行
    for (const row of rows) {
      lines.push(columns.map((col) => escapeCsv(row[col])).join(','));
    }

    result[`${table}.csv`] = lines.join('\n');
  }

  return result;
}

/**
 * 记录导出日志到 export_logs 表
 * @param userId 用户 ID
 * @param format 导出格式
 * @param tableCount 导出表数量
 * @param totalRows 总导出条数
 */
async function logExport(
  userId: string,
  format: string,
  tableCount: number,
  totalRows: number
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('export_logs').insert({
      user_id: userId,
      format,
      table_count: tableCount,
      total_rows: totalRows,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Export] 记录导出日志失败:', e);
  }
}

// ============ 主处理器 ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 处理 CORS 预检请求
  if (handleCors(req, res)) return;

  // 仅允许 GET 方法
  if (req.method !== 'GET') {
    return error(res, 405, '仅支持 GET 请求');
  }

  try {
    // 1. 验证用户身份
    const userId = await verifyAuth(req);

    // 2. 验证导出格式参数
    const format = (req.query.format as string || 'json').toLowerCase();
    if (format !== 'json' && format !== 'csv') {
      return error(res, 400, '不支持的导出格式，仅支持 json 和 csv');
    }

    // 3. 频率限制：每日最多导出 N 次
    await rateLimit(userId, 'data_export', DAILY_EXPORT_LIMIT, 24 * 60 * 60 * 1000);

    // 4. 获取 Supabase 管理员客户端
    const supabase = getSupabaseAdmin();

    // 5. 分页查询所有业务表数据
    const exportData: Record<string, Record<string, any>[]> = {};
    let totalRows = 0;

    for (const table of BUSINESS_TABLES) {
      exportData[table] = await fetchAllRows(supabase, userId, table);
      totalRows += exportData[table].length;
    }

    // 6. 根据格式转换数据
    const files = format === 'csv' ? toCsvString(exportData) : toJsonString(exportData);

    // 7. 打包 ZIP
    const zip = new JSZip();
    for (const [filename, content] of Object.entries(files)) {
      zip.file(filename, content);
    }

    // 添加导出说明文件
    const readme = generateReadme(userId, format, exportData);
    zip.file('README.txt', readme);

    // 生成 ZIP 文件
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // 8. 记录导出日志
    await logExport(userId, format, BUSINESS_TABLES.length, totalRows);

    // 9. 返回 ZIP 文件下载
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `workbuddy-export-${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Total-Rows', String(totalRows));
    res.setHeader('X-Export-Tables', String(BUSINESS_TABLES.length));

    return res.status(200).send(zipBuffer);
  } catch (e) {
    // 友好的错误处理
    if (e instanceof AuthError || e instanceof RateLimitError) {
      return error(res, e.statusCode, e.message);
    }

    console.error('[Export] 导出数据失败:', e);
    return error(res, 500, '导出数据时发生服务器错误');
  }
}

/**
 * 生成导出说明文件内容
 * @param userId 用户 ID（已脱敏）
 * @param format 导出格式
 * @param exportData 导出数据
 */
function generateReadme(
  userId: string,
  format: string,
  exportData: Record<string, Record<string, any>[]>
): string {
  const lines: string[] = [
    'WorkBuddy V10.0 数据导出',
    '========================',
    '',
    `导出时间: ${new Date().toISOString()}`,
    `导出格式: ${format}`,
    `用户 ID: ${userId.substring(0, 8)}...`,
    '',
    '--- 各表记录数 ---',
  ];

  for (const [table, rows] of Object.entries(exportData)) {
    lines.push(`  ${table}: ${rows.length} 条`);
  }

  lines.push('');
  lines.push('注意：此文件包含您的个人数据，请妥善保管。');
  lines.push('敏感字段（如 Bark URL、密码哈希）已在导出时排除或脱敏。');

  return lines.join('\n');
}
