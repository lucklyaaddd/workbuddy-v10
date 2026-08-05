/**
 * 全局类型定义
 * 所有业务数据表对应的 TypeScript 类型
 */

// ============ 通用字段 ============
/** 所有业务表共有的基础字段 */
export interface BaseEntity {
  id: string;          // UUID 主键
  user_id: string;     // 用户ID（RLS 隔离）
  created_at: string;  // 创建时间
  updated_at: string;  // 更新时间
  is_deleted: boolean; // 软删除标记
  version: number;     // 乐观锁版本号
}

// ============ 待办表 todos ============
/** 待办状态枚举 */
export enum TodoStatus {
  PENDING = 0,   // 未完成
  COMPLETED = 1, // 已完成
  TIMEOUT = 2,   // 超时
}

/** 待办记录 */
export interface Todo extends BaseEntity {
  content: string;          // 待办内容
  scheduled_date: string;   // 计划日期 YYYY-MM-DD
  scheduled_time: string;   // 计划时间 HH:MM
  remind_offset: number;    // 提前提醒分钟数（0=准时提醒）
  status: TodoStatus;       // 状态
  is_reminded: boolean;     // 是否已推送提醒
}

// ============ 记账表 transactions ============
/** 收支类型 */
export type TransactionType = 'income' | 'expense';

/** 记账记录 */
export interface Transaction extends BaseEntity {
  type: TransactionType;  // 收入/支出
  category: string;       // 分类
  amount: number;         // 金额（分）
  date: string;           // 日期 YYYY-MM-DD
  note: string;           // 备注
  image_urls: string[];   // 关联图片URL数组
}

// ============ 情侣日志表 couple_logs ============
/** 情侣日志记录 */
export interface CoupleLog extends BaseEntity {
  content: string;         // 日志内容
  mood: string;            // 心情标签
  is_starred: boolean;     // 是否收藏
  log_date: string;        // 日志日期
  image_urls: string[];    // 图片URL数组
}

// ============ 备忘录表 memos ============
/** 备忘录记录 */
export interface Memo extends BaseEntity {
  title: string;           // 标题
  content: string;         // 内容
  category: string;        // 分类
  is_pinned: boolean;      // 是否置顶
  tags: string[];          // 标签数组
  image_urls: string[];    // 图片URL数组
}

// ============ 提醒表 reminders ============
/** 提醒类型 */
export type ReminderType = 'birthday' | 'custom';

/** 周期类型 */
export type CycleType = '单次' | '每日' | '每周' | '每月' | '每年';

/** 提醒记录 */
export interface Reminder extends BaseEntity {
  type: ReminderType;      // 生日/自定义
  name: string;            // 名称
  date: string;            // 日期
  lunar: boolean;          // 是否农历
  advance_days: number;    // 提前提醒天数
  repeat_yearly: boolean;  // 是否每年重复
  note: string;            // 备注
  status: number;          // 状态 0=待处理 1=已完成
  cycle_type: CycleType;   // 周期类型
}

// ============ 好词好句表 quotes ============
/** 好词好句分类 */
export type QuoteCategory = '励志' | '哲思' | '爱情' | '古诗词' | '生活';

/** 好词好句记录 */
export interface Quote extends BaseEntity {
  content: string;         // 句子内容
  author: string;          // 作者
  category: QuoteCategory; // 分类
  source: string;          // 来源
}

// ============ 私厨菜谱表 recipes ============
/** 食材条目 */
export interface Ingredient {
  name: string;        // 食材名称
  amount: string;      // 用量（如 "2个"、"一勺"）
}

/** 制作步骤 */
export interface RecipeStep {
  order: number;       // 步骤顺序（从 1 开始）
  description: string; // 步骤描述
}

/** 菜谱记录 */
export interface Recipe extends BaseEntity {
  name: string;              // 菜品名称
  image_data: string | null;// 菜品图片（base64 dataURL，压缩后）
  ingredients: Ingredient[]; // 食材清单
  steps: RecipeStep[];       // 制作步骤（数组顺序即步骤顺序）
}

// ============ 推送订阅表 push_subscriptions ============
/** 推送类型 */
export type PushType = 'bark' | 'web_push';

/** 推送订阅记录 */
export interface PushSubscription extends BaseEntity {
  type: PushType;          // bark/web_push
  endpoint: string;        // 加密后的 Bark URL 或 Web Push 端点
  p256dh: string | null;   // Web Push 专用
  auth: string | null;     // Web Push 专用
  device_name: string;     // 设备名称
}

// ============ 用户偏好表 user_preferences ============
/** 用户偏好设置 */
export interface UserPreference extends BaseEntity {
  push_enabled: boolean;           // 推送总开关
  backup_reminder_enabled: boolean;// 备份提醒开关
  theme: string;                   // 主题设置 light/dark/system
}

// ============ 操作日志表 operation_logs ============
/** 操作日志 */
export interface OperationLog extends BaseEntity {
  action: string;   // 操作类型
  detail: string;   // 操作详情（已脱敏）
  ip: string;       // 操作IP
}

// ============ 离线同步队列 ============
/** 同步操作类型 */
export type SyncOpType = 'create' | 'update' | 'delete';

/** 离线同步队列项 */
export interface SyncQueueItem {
  id: string;           // 队列项ID
  table: string;        // 目标表名
  op: SyncOpType;       // 操作类型
  record_id: string;    // 记录ID
  data: any;            // 操作数据
  created_at: number;   // 创建时间戳
  retry_count: number;  // 重试次数
  status: 'pending' | 'synced' | 'conflict' | 'failed';
}

// ============ API 响应通用类型 ============
/** 统一 API 响应结构 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** 分页响应 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

// ============ Bark 推送参数 ============
/** Bark 推送参数（后端组装） */
export interface BarkPushParams {
  title: string;     // 推送标题
  body: string;      // 推送内容
  group?: string;    // 分组
  url?: string;      // 点击跳转URL
  icon?: string;     // 推送图标URL
  sound?: string;    // 推送铃声
  level?: 'active' | 'timeSensitive' | 'passive'; // iOS 通知级别
}
