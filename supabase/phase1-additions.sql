-- ============================================================
-- 第一阶段增量 SQL（对应 schema.sql 13-17 节，幂等）
-- 在 Supabase SQL Editor 一次性执行
-- ============================================================

-- 13. user_categories：自定义分类
create table if not exists public.user_categories (
  id text primary key,
  ledger_id uuid references public.ledgers(id) on delete cascade,
  name text not null,
  icon text not null default '📦',
  color text not null default '#64748b',
  type text not null check (type in ('income', 'expense')),
  created_at timestamptz not null default now()
);
create index if not exists idx_user_categories_ledger on public.user_categories (ledger_id, type);

alter table public.user_categories enable row level security;
drop policy if exists "uc_select" on public.user_categories;
create policy "uc_select" on public.user_categories for select using (
  ledger_id is null or public.is_ledger_member(ledger_id)
);
drop policy if exists "uc_write" on public.user_categories;
create policy "uc_write" on public.user_categories for insert
  with check (ledger_id is null or public.has_ledger_role(ledger_id, array['owner', 'admin']));
drop policy if exists "uc_update" on public.user_categories;
create policy "uc_update" on public.user_categories for update using (
  ledger_id is null or public.has_ledger_role(ledger_id, array['owner', 'admin'])
) with check (ledger_id is null or public.has_ledger_role(ledger_id, array['owner', 'admin']));
drop policy if exists "uc_delete" on public.user_categories;
create policy "uc_delete" on public.user_categories for delete using (
  ledger_id is null or public.has_ledger_role(ledger_id, array['owner', 'admin'])
);

-- 14. privacy_locks：隐私锁
create table if not exists public.privacy_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null,
  fingerprint_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.privacy_locks enable row level security;
drop policy if exists "pl_own" on public.privacy_locks;
create policy "pl_own" on public.privacy_locks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 15. ledger_budgets：月度预算
create table if not exists public.ledger_budgets (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  month text not null,
  amount numeric(12,2) not null check (amount > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (ledger_id, month)
);
create index if not exists idx_budgets_ledger_month on public.ledger_budgets (ledger_id, month);

alter table public.ledger_budgets enable row level security;
drop policy if exists "lb_select" on public.ledger_budgets;
create policy "lb_select" on public.ledger_budgets for select using (public.is_ledger_member(ledger_id));
drop policy if exists "lb_write" on public.ledger_budgets;
create policy "lb_write" on public.ledger_budgets for insert with check (
  public.has_ledger_role(ledger_id, array['owner', 'admin']) and auth.uid() = created_by
);
drop policy if exists "lb_update" on public.ledger_budgets;
create policy "lb_update" on public.ledger_budgets for update using (
  public.has_ledger_role(ledger_id, array['owner', 'admin'])
) with check (public.has_ledger_role(ledger_id, array['owner', 'admin']));
drop policy if exists "lb_delete" on public.ledger_budgets;
create policy "lb_delete" on public.ledger_budgets for delete using (
  public.has_ledger_role(ledger_id, array['owner', 'admin'])
);

-- 16. ledgers.updated_at 列 + 触发器
drop trigger if exists ledgers_set_updated_at on public.ledgers;
do $$ begin alter table public.ledgers add column if not exists updated_at timestamptz not null default now(); exception when others then null; end $$;
create trigger ledgers_set_updated_at
  before update on public.ledgers
  for each row execute function public.set_updated_at();

-- 17. 转让管理员 RPC
create or replace function public.transfer_owner(p_ledger_id uuid, p_new_owner_id uuid)
returns void as $$
declare
  old_owner uuid;
begin
  select user_id into old_owner from public.ledger_members
  where ledger_id = p_ledger_id and role = 'owner' and user_id = auth.uid();
  if old_owner is null then
    raise exception '仅账本主人可转让管理员身份';
  end if;
  if not exists (select 1 from public.ledger_members where ledger_id = p_ledger_id and user_id = p_new_owner_id) then
    raise exception '目标用户不在该账本内';
  end if;
  update public.ledger_members set role = 'admin' where ledger_id = p_ledger_id and user_id = old_owner;
  update public.ledger_members set role = 'owner' where ledger_id = p_ledger_id and user_id = p_new_owner_id;
end;
$$ language plpgsql security invoker;
