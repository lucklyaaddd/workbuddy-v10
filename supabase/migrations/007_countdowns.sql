-- ============================================
-- WorkBuddy V10.0 - 倒数日模块
-- 007_countdowns.sql
-- 用户可添加：自定义倒数日 / 纪念日(已过去天数) / 每年生日
-- 系统自动项（新年、下一个节日）由前端实时计算，不落库
-- ============================================

-- ============ 表结构 ============
create table if not exists public.countdowns (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  target_date  date not null,
  -- since: 已过去天数（如「在一起 520 天」）
  -- until: 还剩天数（如某假期倒计时）
  -- birthday: 每年循环，算距离下次生日天数
  mode         text not null check (mode in ('since', 'until', 'birthday')),
  -- custom: 用户自定义；birthday: 生日（语义标记，mode 通常为 birthday）
  kind         text not null default 'custom' check (kind in ('custom', 'birthday')),
  color        text,                       -- 可选主题色（hex），用于卡片展示
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  is_deleted   boolean not null default false,
  version      integer not null default 1
);

-- ============ 索引 ============
create index if not exists idx_countdowns_user on public.countdowns (user_id);

-- ============ 行级安全 RLS ============
alter table public.countdowns enable row level security;

drop policy if exists countdowns_select_own on public.countdowns;
drop policy if exists countdowns_insert_own on public.countdowns;
drop policy if exists countdowns_update_own on public.countdowns;
drop policy if exists countdowns_delete_own on public.countdowns;

create policy countdowns_select_own on public.countdowns
  for select using (auth.uid() = user_id);

create policy countdowns_insert_own on public.countdowns
  for insert with check (auth.uid() = user_id);

create policy countdowns_update_own on public.countdowns
  for update using (auth.uid() = user_id);

create policy countdowns_delete_own on public.countdowns
  for delete using (auth.uid() = user_id);

-- ============ 权限授予（避免 42501 permission denied） ============
grant select, insert, update, delete on public.countdowns to authenticated;
grant select, insert, update, delete on public.countdowns to service_role;
