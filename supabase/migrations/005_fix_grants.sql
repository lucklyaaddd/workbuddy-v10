-- ================================================================
-- WorkBuddy V10.0 紧急修复：授权 authenticated 角色访问业务表
-- 适用：用户认证后 SELECT 报 42501 "permission denied" 错误
-- 原因：001_init.sql 创建表时没有显式 GRANT，RLS 无法单独生效
-- 执行：Supabase Dashboard → SQL Editor → New query → 粘贴此脚本 → Run
-- ================================================================

-- ============ 授权 schema ============
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- ============ 授权所有业务表 ============
-- 对 authenticated 角色：CRUD 全开
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.couple_logs          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memos                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_logs       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_logs          TO authenticated;

-- ============ 对 service_role（后端 Cron 用）：全权 ============
GRANT ALL PRIVILEGES ON public.todos                TO service_role;
GRANT ALL PRIVILEGES ON public.transactions         TO service_role;
GRANT ALL PRIVILEGES ON public.couple_logs          TO service_role;
GRANT ALL PRIVILEGES ON public.memos                TO service_role;
GRANT ALL PRIVILEGES ON public.reminders            TO service_role;
GRANT ALL PRIVILEGES ON public.quotes               TO service_role;
GRANT ALL PRIVILEGES ON public.push_subscriptions   TO service_role;
GRANT ALL PRIVILEGES ON public.user_preferences     TO service_role;
GRANT ALL PRIVILEGES ON public.operation_logs       TO service_role;
GRANT ALL PRIVILEGES ON public.export_logs          TO service_role;
GRANT ALL PRIVILEGES ON public.cron_executions      TO service_role;

-- ============ 授权 sequences（如有 UUID 排序等场景） ============
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============ 完成验证 ============
-- 列出当前 authenticated 角色在 public schema 的权限
SELECT
  grantee,
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee IN ('authenticated', 'service_role')
  AND table_schema = 'public'
  AND table_name IN (
    'todos','transactions','couple_logs','memos','reminders','quotes',
    'push_subscriptions','user_preferences','operation_logs','export_logs','cron_executions'
  )
GROUP BY grantee, table_name
ORDER BY grantee, table_name;