-- 008_together_since.sql
-- 给 user_preferences 加一列 together_since（用户自定义的"在一起纪念日"日期），
-- 情侣日志顶部"已经在一起 N 天"按此计算；为空时该卡片不显示，避免再以"第一条日志日期"误推算。
-- 旧逻辑（取 earliest log_date）会让"今天记第一条就显示 0 天"。

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS together_since TEXT; -- YYYY-MM-DD，可空
