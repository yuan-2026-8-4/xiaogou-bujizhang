-- ============================================================
-- 小狗不记账 · Phase 1 增量数据库脚本（可重复执行）
-- 使用方法：Supabase 左侧菜单 → SQL Editor → New query
--          → 粘贴本文件全部内容 → 点 Run 运行
-- ============================================================

-- 1. user_categories：用户自定义分类
create table if not exists public.user_categories (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  name text not null,
  icon text not null default '📦',
  color text not null default '#64748b',
  type text not null check (type in ('expense', 'income')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (ledger_id, name, type)
);

-- 2. privacy_locks：用户隐私锁（PIN/指纹）
create table if not exists public.privacy_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  fingerprint_enabled bool not null default false,
  updated_at timestamptz not null default now()
);

-- 3. ledger_budgets：账本月度预算
create table if not exists public.ledger_budgets (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  month text not null,  -- 'YYYY-MM'
  amount numeric(12,2) not null check (amount > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (ledger_id, month)
);

-- 4. ledgers 表加 updated_at 列 + 自动刷新触发器
alter table public.ledgers add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_ledgers_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ledgers_set_updated_at on public.ledgers;
create trigger ledgers_set_updated_at
  before update on public.ledgers
  for each row execute function public.set_ledgers_updated_at();

-- ============================================================
-- 5. 开启行级安全（RLS）
-- ============================================================
alter table public.user_categories enable row level security;
alter table public.privacy_locks enable row level security;
alter table public.ledger_budgets enable row level security;

-- ============================================================
-- 6. RLS 策略
-- ============================================================

-- user_categories：成员可读（或创建者本人）；创建者本人可增改删
drop policy if exists "user_categories_select" on public.user_categories;
create policy "user_categories_select" on public.user_categories
  for select using (public.is_ledger_member(ledger_id) or auth.uid() = created_by);

drop policy if exists "user_categories_insert" on public.user_categories;
create policy "user_categories_insert" on public.user_categories
  for insert with check (auth.uid() = created_by and public.is_ledger_member(ledger_id));

drop policy if exists "user_categories_update" on public.user_categories;
create policy "user_categories_update" on public.user_categories
  for update using (auth.uid() = created_by);

drop policy if exists "user_categories_delete" on public.user_categories;
create policy "user_categories_delete" on public.user_categories
  for delete using (auth.uid() = created_by);

-- privacy_locks：仅本人可查看/增改删
drop policy if exists "privacy_locks_select" on public.privacy_locks;
create policy "privacy_locks_select" on public.privacy_locks
  for select using (auth.uid() = user_id);

drop policy if exists "privacy_locks_insert" on public.privacy_locks;
create policy "privacy_locks_insert" on public.privacy_locks
  for insert with check (auth.uid() = user_id);

drop policy if exists "privacy_locks_update" on public.privacy_locks;
create policy "privacy_locks_update" on public.privacy_locks
  for update using (auth.uid() = user_id);

drop policy if exists "privacy_locks_delete" on public.privacy_locks;
create policy "privacy_locks_delete" on public.privacy_locks
  for delete using (auth.uid() = user_id);

-- ledger_budgets：成员可读；创建者可增；owner/admin 或创建者可改删
drop policy if exists "ledger_budgets_select" on public.ledger_budgets;
create policy "ledger_budgets_select" on public.ledger_budgets
  for select using (public.is_ledger_member(ledger_id));

drop policy if exists "ledger_budgets_insert" on public.ledger_budgets;
create policy "ledger_budgets_insert" on public.ledger_budgets
  for insert with check (auth.uid() = created_by and public.is_ledger_member(ledger_id));

drop policy if exists "ledger_budgets_update" on public.ledger_budgets;
create policy "ledger_budgets_update" on public.ledger_budgets
  for update using (public.has_ledger_role(ledger_id, array['owner', 'admin']) or auth.uid() = created_by);

drop policy if exists "ledger_budgets_delete" on public.ledger_budgets;
create policy "ledger_budgets_delete" on public.ledger_budgets
  for delete using (public.has_ledger_role(ledger_id, array['owner', 'admin']) or auth.uid() = created_by);

-- ============================================================
-- 7. 常用查询索引
-- ============================================================
create index if not exists idx_user_categories_ledger on public.user_categories(ledger_id);
create index if not exists idx_budgets_ledger_month on public.ledger_budgets(ledger_id, month);

-- ============================================================
-- 8. RPC 辅助函数
-- ============================================================

-- 合并并删除分类：把旧分类下的账单迁移到新分类，然后删除旧分类
create or replace function public.merge_and_delete_category(
  p_ledger_id uuid,
  p_old_cat_name text,
  p_old_type text,
  p_new_cat_name text,
  p_new_type text
) returns void as $$
declare
  v_old_id uuid;
  v_new_id uuid;
begin
  -- 找到旧分类
  select id into v_old_id from public.user_categories
  where ledger_id = p_ledger_id and name = p_old_cat_name and type = p_old_type;

  if v_old_id is null then
    raise exception '旧分类不存在';
  end if;

  -- 找到新分类
  select id into v_new_id from public.user_categories
  where ledger_id = p_ledger_id and name = p_new_cat_name and type = p_new_type;

  if v_new_id is null then
    raise exception '新分类不存在';
  end if;

  -- 同一个分类，无需操作
  if v_old_id = v_new_id then
    return;
  end if;

  -- 迁移账单：把引用旧分类的 transactions.category 更新为新分类 id
  update public.transactions
  set category = v_new_id::text
  where ledger_id = p_ledger_id and category = v_old_id::text;

  -- 删除旧分类
  delete from public.user_categories where id = v_old_id;
end;
$$ language plpgsql security definer;

-- 删除预设分类 fallback：返回同类型系统预设分类「其他」的 id
-- 支出其他 = 'exp-other'，收入其他 = 'inc-other'
create or replace function public.transfer_category_bills_keep_default(
  p_ledger_id uuid,
  p_old_cat_id text,
  p_type text
) returns uuid as $$
begin
  if p_type = 'expense' then
    return 'exp-other'::uuid;
  elsif p_type = 'income' then
    return 'inc-other'::uuid;
  else
    raise exception '无效的分类类型: %', p_type;
  end if;
end;
$$ language plpgsql security definer;
