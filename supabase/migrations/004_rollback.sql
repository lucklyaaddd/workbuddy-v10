-- ================================================================
-- WorkBuddy V10.0 回滚脚本（Down Migration）
-- 按反向顺序删除所有表、策略、函数
-- 警告：执行后将永久删除所有数据！
-- ================================================================

-- ============ 删除 Storage 策略 ============
DROP POLICY IF EXISTS "storage_images_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_images_read_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_images_upload_own" ON storage.objects;

-- ============ 删除 Storage 桶 ============
DELETE FROM storage.buckets WHERE id = 'images';

-- ============ 删除 RLS 策略 ============
-- export_logs
DROP POLICY IF EXISTS "export_logs_delete_own" ON export_logs;
DROP POLICY IF EXISTS "export_logs_update_own" ON export_logs;
DROP POLICY IF EXISTS "export_logs_insert_own" ON export_logs;
DROP POLICY IF EXISTS "export_logs_select_own" ON export_logs;

-- operation_logs
DROP POLICY IF EXISTS "op_logs_delete_own" ON operation_logs;
DROP POLICY IF EXISTS "op_logs_update_own" ON operation_logs;
DROP POLICY IF EXISTS "op_logs_insert_own" ON operation_logs;
DROP POLICY IF EXISTS "op_logs_select_own" ON operation_logs;

-- user_preferences
DROP POLICY IF EXISTS "prefs_delete_own" ON user_preferences;
DROP POLICY IF EXISTS "prefs_update_own" ON user_preferences;
DROP POLICY IF EXISTS "prefs_insert_own" ON user_preferences;
DROP POLICY IF EXISTS "prefs_select_own" ON user_preferences;

-- push_subscriptions
DROP POLICY IF EXISTS "push_subs_delete_own" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_update_own" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_insert_own" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_select_own" ON push_subscriptions;

-- quotes
DROP POLICY IF EXISTS "quotes_delete_own" ON quotes;
DROP POLICY IF EXISTS "quotes_update_own" ON quotes;
DROP POLICY IF EXISTS "quotes_insert_own" ON quotes;
DROP POLICY IF EXISTS "quotes_select_own" ON quotes;

-- reminders
DROP POLICY IF EXISTS "reminders_delete_own" ON reminders;
DROP POLICY IF EXISTS "reminders_update_own" ON reminders;
DROP POLICY IF EXISTS "reminders_insert_own" ON reminders;
DROP POLICY IF EXISTS "reminders_select_own" ON reminders;

-- memos
DROP POLICY IF EXISTS "memos_delete_own" ON memos;
DROP POLICY IF EXISTS "memos_update_own" ON memos;
DROP POLICY IF EXISTS "memos_insert_own" ON memos;
DROP POLICY IF EXISTS "memos_select_own" ON memos;

-- couple_logs
DROP POLICY IF EXISTS "couple_logs_delete_own" ON couple_logs;
DROP POLICY IF EXISTS "couple_logs_update_own" ON couple_logs;
DROP POLICY IF EXISTS "couple_logs_insert_own" ON couple_logs;
DROP POLICY IF EXISTS "couple_logs_select_own" ON couple_logs;

-- transactions
DROP POLICY IF EXISTS "transactions_delete_own" ON transactions;
DROP POLICY IF EXISTS "transactions_update_own" ON transactions;
DROP POLICY IF EXISTS "transactions_insert_own" ON transactions;
DROP POLICY IF EXISTS "transactions_select_own" ON transactions;

-- todos
DROP POLICY IF EXISTS "todos_delete_own" ON todos;
DROP POLICY IF EXISTS "todos_update_own" ON todos;
DROP POLICY IF EXISTS "todos_insert_own" ON todos;
DROP POLICY IF EXISTS "todos_select_own" ON todos;

-- ============ 删除触发器 ============
DROP TRIGGER IF EXISTS trg_export_logs_updated ON export_logs;
DROP TRIGGER IF EXISTS trg_op_logs_updated ON operation_logs;
DROP TRIGGER IF EXISTS trg_user_prefs_updated ON user_preferences;
DROP TRIGGER IF EXISTS trg_push_subs_updated ON push_subscriptions;
DROP TRIGGER IF EXISTS trg_quotes_updated ON quotes;
DROP TRIGGER IF EXISTS trg_reminders_updated ON reminders;
DROP TRIGGER IF EXISTS trg_memos_updated ON memos;
DROP TRIGGER IF EXISTS trg_couple_logs_updated ON couple_logs;
DROP TRIGGER IF EXISTS trg_transactions_updated ON transactions;
DROP TRIGGER IF EXISTS trg_todos_updated ON todos;

-- ============ 删除表 ============
DROP TABLE IF EXISTS cron_executions;
DROP TABLE IF EXISTS export_logs;
DROP TABLE IF EXISTS operation_logs;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS push_subscriptions;
DROP TABLE IF EXISTS quotes;
DROP TABLE IF EXISTS reminders;
DROP TABLE IF EXISTS memos;
DROP TABLE IF EXISTS couple_logs;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS todos;

-- ============ 删除函数 ============
DROP FUNCTION IF EXISTS update_updated_at();

-- ============ 完成提示 ============
DO $$
BEGIN
  RAISE NOTICE 'WorkBuddy V10.0 数据库回滚完成（所有表、策略、函数已删除）';
END;
$$;
