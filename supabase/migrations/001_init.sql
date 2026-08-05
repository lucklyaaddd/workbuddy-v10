-- ================================================================
-- WorkBuddy V10.0 数据库初始化迁移脚本
-- 创建所有业务表、索引、触发器
-- 执行方式：在 Supabase Dashboard → SQL Editor 中执行
-- ================================================================

-- ============ 扩展 ============
-- 启用 UUID 生成扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ 通用触发器函数 ============
-- 自动更新 updated_at 和 version（乐观锁递增）
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- 版本号递增（乐观锁冲突控制）
  NEW.version = COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============ 1. todos 待办表 ============
CREATE TABLE IF NOT EXISTS todos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,                    -- 待办内容
  scheduled_date DATE NOT NULL,                   -- 计划日期
  scheduled_time TIME,                            -- 计划时间
  remind_offset INT DEFAULT 0,                    -- 提前提醒分钟数（0=准时）
  status        INT DEFAULT 0,                    -- 状态：0未完成/1已完成/2超时
  is_reminded   BOOLEAN DEFAULT FALSE,            -- 是否已推送提醒
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_deleted    BOOLEAN DEFAULT FALSE,            -- 软删除标记
  version       INTEGER DEFAULT 1                 -- 乐观锁版本号
);

-- 索引：按用户+状态+日期查询（今日待办列表）
CREATE INDEX IF NOT EXISTS idx_todos_user_status_date ON todos(user_id, status, scheduled_date);
-- 部分索引：未完成且未提醒的待办（推送轮询用）
CREATE INDEX IF NOT EXISTS idx_todos_remind ON todos(user_id, is_reminded) WHERE status = 0;
-- 软删除过滤索引
CREATE INDEX IF NOT EXISTS idx_todos_user_active ON todos(user_id, scheduled_date) WHERE is_deleted = false;

CREATE TRIGGER trg_todos_updated BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 2. transactions 记账表 ============
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('income', 'expense')),  -- 收入/支出
  category      TEXT NOT NULL,                    -- 分类
  amount        BIGINT NOT NULL,                  -- 金额（分为单位）
  date          DATE NOT NULL,                    -- 日期
  note          TEXT DEFAULT '',                  -- 备注
  image_urls    TEXT[] DEFAULT '{}',              -- 关联图片URL数组
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_deleted    BOOLEAN DEFAULT FALSE,
  version       INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_active ON transactions(user_id) WHERE is_deleted = false;

CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 3. couple_logs 情侣日志表 ============
CREATE TABLE IF NOT EXISTS couple_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,                    -- 日志内容
  mood          TEXT DEFAULT '',                  -- 心情标签
  is_starred    BOOLEAN DEFAULT FALSE,            -- 是否收藏
  log_date      DATE NOT NULL,                    -- 日志日期
  image_urls    TEXT[] DEFAULT '{}',              -- 图片URL数组
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_deleted    BOOLEAN DEFAULT FALSE,
  version       INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_couple_logs_user_date ON couple_logs(user_id, log_date DESC);
-- 部分索引：收藏的日志
CREATE INDEX IF NOT EXISTS idx_couple_logs_starred ON couple_logs(user_id, is_starred) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_couple_logs_user_active ON couple_logs(user_id, log_date DESC) WHERE is_deleted = false;

CREATE TRIGGER trg_couple_logs_updated BEFORE UPDATE ON couple_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 4. memos 备忘录表 ============
CREATE TABLE IF NOT EXISTS memos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,                    -- 标题
  content       TEXT DEFAULT '',                  -- 内容
  category      TEXT DEFAULT '默认',              -- 分类
  is_pinned     BOOLEAN DEFAULT FALSE,            -- 是否置顶
  tags          TEXT[] DEFAULT '{}',              -- 标签数组
  image_urls    TEXT[] DEFAULT '{}',              -- 图片URL数组
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_deleted    BOOLEAN DEFAULT FALSE,
  version       INTEGER DEFAULT 1
);

-- 部分索引：置顶的备忘录
CREATE INDEX IF NOT EXISTS idx_memos_pinned ON memos(user_id, is_pinned DESC) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_memos_user_active ON memos(user_id, updated_at DESC) WHERE is_deleted = false;
-- 标签搜索索引
CREATE INDEX IF NOT EXISTS idx_memos_tags ON memos USING gin(tags);

CREATE TRIGGER trg_memos_updated BEFORE UPDATE ON memos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 5. reminders 提醒表 ============
CREATE TABLE IF NOT EXISTS reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('birthday', 'custom')),  -- 生日/自定义
  name          TEXT NOT NULL,                    -- 名称
  date          DATE NOT NULL,                    -- 日期
  lunar         BOOLEAN DEFAULT FALSE,            -- 是否农历
  advance_days  INT DEFAULT 0,                    -- 提前提醒天数
  repeat_yearly BOOLEAN DEFAULT FALSE,            -- 是否每年重复
  note          TEXT DEFAULT '',                  -- 备注
  status        INT DEFAULT 0,                    -- 状态：0待处理 1已完成
  cycle_type    TEXT DEFAULT '单次' CHECK (cycle_type IN ('单次','每日','每周','每月','每年')),  -- 周期类型
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_deleted    BOOLEAN DEFAULT FALSE,
  version       INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_reminders_user_status_date ON reminders(user_id, status, date);
CREATE INDEX IF NOT EXISTS idx_reminders_user_active ON reminders(user_id, date) WHERE is_deleted = false;

CREATE TRIGGER trg_reminders_updated BEFORE UPDATE ON reminders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 6. quotes 好词好句表 ============
CREATE TABLE IF NOT EXISTS quotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,                    -- 句子内容
  author        TEXT DEFAULT '',                  -- 作者
  category      TEXT CHECK (category IN ('励志','哲思','爱情','古诗词','生活')),  -- 分类
  source        TEXT DEFAULT '',                  -- 来源
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_deleted    BOOLEAN DEFAULT FALSE,
  version       INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_quotes_user_category ON quotes(user_id, category);
CREATE INDEX IF NOT EXISTS idx_quotes_user_active ON quotes(user_id, created_at DESC) WHERE is_deleted = false;
-- 全文搜索索引（内容和作者）
CREATE INDEX IF NOT EXISTS idx_quotes_fts ON quotes USING gin(to_tsvector('simple', content || ' ' || coalesce(author, '')));

CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 7. push_subscriptions 推送订阅表 ============
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('bark', 'web_push')),  -- 推送类型
  endpoint      TEXT NOT NULL UNIQUE,             -- 加密后的 Bark URL 或 Web Push 端点
  p256dh        TEXT,                             -- Web Push 专用
  auth          TEXT,                             -- Web Push 专用
  device_name   TEXT DEFAULT '',                  -- 设备名称
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_deleted    BOOLEAN DEFAULT FALSE,
  version       INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user_active ON push_subscriptions(user_id) WHERE is_deleted = false;

CREATE TRIGGER trg_push_subs_updated BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 8. user_preferences 用户偏好表 ============
CREATE TABLE IF NOT EXISTS user_preferences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled           BOOLEAN DEFAULT TRUE,    -- 推送总开关
  backup_reminder_enabled BOOLEAN DEFAULT TRUE,   -- 备份提醒开关
  theme                  TEXT DEFAULT 'light',    -- 主题设置
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_deleted    BOOLEAN DEFAULT FALSE,
  version       INTEGER DEFAULT 1
);

-- 唯一索引：每个用户仅一条偏好记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prefs_user ON user_preferences(user_id);

CREATE TRIGGER trg_user_prefs_updated BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 9. operation_logs 操作日志表 ============
CREATE TABLE IF NOT EXISTS operation_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,                    -- 操作类型
  detail        TEXT DEFAULT '',                  -- 操作详情（已脱敏）
  ip            TEXT DEFAULT '',                  -- 操作IP
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_deleted    BOOLEAN DEFAULT FALSE,
  version       INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_op_logs_user_time ON operation_logs(user_id, created_at DESC);

CREATE TRIGGER trg_op_logs_updated BEFORE UPDATE ON operation_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 10. export_logs 导出日志表 ============
CREATE TABLE IF NOT EXISTS export_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  format        TEXT NOT NULL,                    -- 导出格式
  file_count    INT DEFAULT 0,                    -- 文件数量
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  is_deleted    BOOLEAN DEFAULT FALSE,
  version       INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_export_logs_user_time ON export_logs(user_id, created_at DESC);

CREATE TRIGGER trg_export_logs_updated BEFORE UPDATE ON export_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 11. cron_executions Cron执行记录表 ============
-- 用于实现幂等性，防止重复执行
CREATE TABLE IF NOT EXISTS cron_executions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name     TEXT NOT NULL,                    -- 任务名称
  exec_date     DATE NOT NULL,                    -- 执行日期
  exec_time     TIMESTAMPTZ DEFAULT NOW(),        -- 执行时间
  status        TEXT DEFAULT 'success',           -- 执行状态
  detail        TEXT DEFAULT ''                   -- 执行详情（已脱敏）
);

-- 唯一索引：同一天同一任务只执行一次
CREATE UNIQUE INDEX IF NOT EXISTS idx_cron_exec_unique ON cron_executions(task_name, exec_date);

-- ============ 完成提示 ============
DO $$
BEGIN
  RAISE NOTICE 'WorkBuddy V10.0 数据库表结构创建完成（11张表）';
END;
$$;
