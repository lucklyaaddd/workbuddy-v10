-- ================================================================
-- WorkBuddy V10.0 RLS（行级安全）策略
-- 为所有业务表启用 RLS，确保用户仅能访问自身数据
-- 执行方式：在 Supabase Dashboard → SQL Editor 中执行
-- ================================================================

-- ============ 启用 RLS ============
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;

-- ============ 通用策略模板 ============
-- 每张表创建 4 条策略：SELECT / INSERT / UPDATE / DELETE
-- 策略统一为：auth.uid() = user_id

-- ============ todos 策略 ============
CREATE POLICY "todos_select_own" ON todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "todos_insert_own" ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "todos_update_own" ON todos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "todos_delete_own" ON todos FOR DELETE USING (auth.uid() = user_id);

-- ============ transactions 策略 ============
CREATE POLICY "transactions_select_own" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_own" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update_own" ON transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_delete_own" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- ============ couple_logs 策略 ============
CREATE POLICY "couple_logs_select_own" ON couple_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "couple_logs_insert_own" ON couple_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "couple_logs_update_own" ON couple_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "couple_logs_delete_own" ON couple_logs FOR DELETE USING (auth.uid() = user_id);

-- ============ memos 策略 ============
CREATE POLICY "memos_select_own" ON memos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "memos_insert_own" ON memos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memos_update_own" ON memos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memos_delete_own" ON memos FOR DELETE USING (auth.uid() = user_id);

-- ============ reminders 策略 ============
CREATE POLICY "reminders_select_own" ON reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reminders_insert_own" ON reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminders_update_own" ON reminders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminders_delete_own" ON reminders FOR DELETE USING (auth.uid() = user_id);

-- ============ quotes 策略 ============
CREATE POLICY "quotes_select_own" ON quotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "quotes_insert_own" ON quotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quotes_update_own" ON quotes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quotes_delete_own" ON quotes FOR DELETE USING (auth.uid() = user_id);

-- ============ push_subscriptions 策略 ============
CREATE POLICY "push_subs_select_own" ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_subs_insert_own" ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subs_update_own" ON push_subscriptions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subs_delete_own" ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- ============ user_preferences 策略 ============
CREATE POLICY "prefs_select_own" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "prefs_insert_own" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prefs_update_own" ON user_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prefs_delete_own" ON user_preferences FOR DELETE USING (auth.uid() = user_id);

-- ============ operation_logs 策略 ============
CREATE POLICY "op_logs_select_own" ON operation_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "op_logs_insert_own" ON operation_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "op_logs_update_own" ON operation_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "op_logs_delete_own" ON operation_logs FOR DELETE USING (auth.uid() = user_id);

-- ============ export_logs 策略 ============
CREATE POLICY "export_logs_select_own" ON export_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "export_logs_insert_own" ON export_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "export_logs_update_own" ON export_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "export_logs_delete_own" ON export_logs FOR DELETE USING (auth.uid() = user_id);

-- ============ cron_executions 策略 ============
-- 该表由后端 service_role 管理，不需要用户直接访问
ALTER TABLE cron_executions ENABLE ROW LEVEL SECURITY;
-- 不创建任何策略 = 完全阻止前端访问（仅 service_role 可操作）

-- ============ 安全加固：禁止全表操作 ============
-- 确保 RLS 被强制执行，即使表 owner 也不例外
ALTER TABLE todos FORCE ROW LEVEL SECURITY;
ALTER TABLE transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE couple_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE memos FORCE ROW LEVEL SECURITY;
ALTER TABLE reminders FORCE ROW LEVEL SECURITY;
ALTER TABLE quotes FORCE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE user_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE operation_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE export_logs FORCE ROW LEVEL SECURITY;

-- ============ 完成提示 ============
DO $$
BEGIN
  RAISE NOTICE 'RLS 策略创建完成（10张表 × 4条策略 = 40条策略）';
END;
$$;
