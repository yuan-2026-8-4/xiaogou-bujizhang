-- ============================================================
-- 小狗不记账 · 数据库初始化脚本（完整版，可重复执行）
-- 使用方法：Supabase 左侧菜单 → SQL Editor → New query
--          → 粘贴本文件全部内容 → 点 Run 运行
-- ============================================================

-- 1. profiles：用户扩展信息（昵称、头像）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '记账小能手',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2. ledgers：账本（个人/协同）
create table if not exists public.ledgers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'personal' check (type in ('personal', 'collaborative')),
  icon text default '📒',
  color text default '#14b8a6',
  monthly_start_day int not null default 1 check (monthly_start_day between 1 and 31),
  invite_code text unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- 3. ledger_members：账本成员关系（角色：owner/admin/member）
create table if not exists public.ledger_members (
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (ledger_id, user_id)
);

-- 4. transactions：账单
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  category text not null,
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. 账单更新时间自动刷新
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- 6. 新用户注册时自动：创建档案 + 默认个人账本 + 成员关系
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_ledger_id uuid;
begin
  insert into public.profiles (id) values (new.id);

  insert into public.ledgers (name, type, created_by)
  values ('我的账本', 'personal', new.id)
  returning id into new_ledger_id;

  insert into public.ledger_members (ledger_id, user_id, role)
  values (new_ledger_id, new.id, 'owner');

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. 通过邀请码查账本ID（绕过RLS，只返回ID；任何人都能用邀请码加入）
create or replace function public.find_ledger_by_invite_code(p_code text)
returns uuid as $$
declare
  result_id uuid;
begin
  select id into result_id from public.ledgers
  where invite_code = p_code and type = 'collaborative'
  limit 1;
  return result_id;
end;
$$ language plpgsql security definer;

-- 8. 查询账本成员昵称列表（协同页显示成员头像/昵称用）
create or replace function public.get_ledger_members(p_ledger_id uuid)
returns table (user_id uuid, nickname text, role text) as $$
begin
  return query
    select lm.user_id, coalesce(p.nickname, '成员'), lm.role
    from public.ledger_members lm
    left join public.profiles p on p.id = lm.user_id
    where lm.ledger_id = p_ledger_id
    order by lm.joined_at asc;
end;
$$ language plpgsql security definer;

-- 创建协同账本（原子操作：建账本 + 生成邀请码 + 把创建者加为 owner）
-- 用 RPC 是因为 insert+RETURNING 时创建者尚未加入成员表，SELECT 策略会拦截 RETURNING 读取
create or replace function public.create_collab_ledger(p_name text, p_icon text)
returns table (ledger_id uuid, code text) as $$
declare
  new_id uuid;
  new_code text;
  i int;
begin
  for i in 1..3 loop
    new_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    begin
      insert into public.ledgers (name, type, icon, color, invite_code, created_by)
      values (p_name, 'collaborative', p_icon, '#14b8a6', new_code, auth.uid())
      returning ledgers.id into new_id;
      exit;
    exception when unique_violation then
      if i = 3 then
        raise exception '邀请码生成冲突，请重试';
      end if;
    end;
  end loop;

  insert into public.ledger_members (ledger_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  return query select new_id, new_code;
end;
$$ language plpgsql security definer;

-- 9. 注销账号：删除本人拥有的账本（级联删除账单/成员）+ 个人档案
create or replace function public.delete_own_account()
returns void as $$
begin
  delete from public.ledgers where created_by = auth.uid();
  delete from public.profiles where id = auth.uid();
end;
$$ language plpgsql security definer;

-- ============================================================
-- 10. 开启行级安全（RLS）
-- ============================================================
alter table public.profiles enable row level security;
alter table public.ledgers enable row level security;
alter table public.ledger_members enable row level security;
alter table public.transactions enable row level security;

-- 辅助函数（SECURITY DEFINER 绕过 RLS，避免 ledger_members 策略自查询导致的无限递归）
create or replace function public.is_ledger_member(p_ledger_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

create or replace function public.has_ledger_role(p_ledger_id uuid, p_roles text[])
returns boolean as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id and user_id = auth.uid() and role = any(p_roles)
  );
$$ language sql security definer stable;

-- profiles：仅本人可查看/修改自己的档案
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- ledgers：成员可读（或自己是创建者，保证 insert RETURNING 立即可见）；创建者可新建；owner/admin 可改；owner 可删
drop policy if exists "ledgers_select_member" on public.ledgers;
create policy "ledgers_select_member" on public.ledgers
  for select using (public.is_ledger_member(id) or auth.uid() = created_by);
drop policy if exists "ledgers_insert_owner" on public.ledgers;
create policy "ledgers_insert_owner" on public.ledgers
  for insert with check (auth.uid() = created_by);
drop policy if exists "ledgers_update_owner" on public.ledgers;
create policy "ledgers_update_owner" on public.ledgers
  for update using (public.has_ledger_role(id, array['owner', 'admin']));
drop policy if exists "ledgers_delete_owner" on public.ledgers;
create policy "ledgers_delete_owner" on public.ledgers
  for delete using (public.has_ledger_role(id, array['owner']));

-- ledger_members：成员可查看成员列表；owner/admin 可管理成员；
-- 邀请码加入：允许用户把自己插为成员（前端通过 find_ledger_by_invite_code 校验）
drop policy if exists "members_select" on public.ledger_members;
create policy "members_select" on public.ledger_members
  for select using (public.is_ledger_member(ledger_id));
drop policy if exists "members_insert_admin" on public.ledger_members;
create policy "members_insert_admin" on public.ledger_members
  for insert with check (public.has_ledger_role(ledger_id, array['owner', 'admin']));
drop policy if exists "members_update_admin" on public.ledger_members;
create policy "members_update_admin" on public.ledger_members
  for update using (public.has_ledger_role(ledger_id, array['owner', 'admin']));
drop policy if exists "members_delete_admin" on public.ledger_members;
create policy "members_delete_admin" on public.ledger_members
  for delete using (public.has_ledger_role(ledger_id, array['owner', 'admin']));
drop policy if exists "members_insert_self" on public.ledger_members;
create policy "members_insert_self" on public.ledger_members
  for insert with check (auth.uid() = user_id);

-- transactions：成员可读；成员可添加自己记的账单；
-- 普通成员只能改/删自己记的，owner/admin 可改/删账本内全部
drop policy if exists "tx_select_member" on public.transactions;
create policy "tx_select_member" on public.transactions
  for select using (public.is_ledger_member(ledger_id));
drop policy if exists "tx_insert_member" on public.transactions;
create policy "tx_insert_member" on public.transactions
  for insert with check (
    auth.uid() = user_id and public.is_ledger_member(ledger_id)
  );
drop policy if exists "tx_update_member" on public.transactions;
create policy "tx_update_member" on public.transactions
  for update using (
    public.has_ledger_role(ledger_id, array['owner', 'admin']) or auth.uid() = user_id
  );
drop policy if exists "tx_delete_member" on public.transactions;
create policy "tx_delete_member" on public.transactions
  for delete using (
    public.has_ledger_role(ledger_id, array['owner', 'admin']) or auth.uid() = user_id
  );

-- 11. 常用查询索引
create index if not exists idx_transactions_ledger_date on public.transactions (ledger_id, date desc);
create index if not exists idx_members_user on public.ledger_members (user_id);
create index if not exists idx_ledgers_created_by on public.ledgers (created_by);
create index if not exists idx_ledgers_invite_code on public.ledgers (invite_code);

-- ============================================================
-- 13. user_categories：用户/账本自定义分类（第一阶段任务5）
-- ledger_id 为 null 的行表示系统预设分类；ledger_id 有值是账本专属
-- ============================================================
create table if not exists public.user_categories (
  id text primary key,               -- 分类ID，例如 exp-food / inc-salary / custom-xxx
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

-- ============================================================
-- 14. privacy_locks：隐私锁（4位密码hash、指纹开关；第一阶段任务6）
-- 每个用户最多一行；pin_hash 为 SHA-256(subtleCrypto) 的 Base64
-- ============================================================
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

-- ============================================================
-- 15. ledger_budgets：账本月度预算（第一阶段任务7）
-- 按 ledger_id + month 唯一；month 格式 YYYY-MM
-- ============================================================
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

-- ============================================================
-- 16. ledgers 触发更新时间（编辑账本、邀请码等自动刷新）
-- ============================================================
drop trigger if exists ledgers_set_updated_at on public.ledgers;
do $$ begin alter table public.ledgers add column if not exists updated_at timestamptz not null default now(); exception when others then null; end $$;
create trigger ledgers_set_updated_at
  before update on public.ledgers
  for each row execute function public.set_updated_at();

-- ============================================================
-- 17. 成员转让管理员：把 ledger_members 里旧 owner 改 admin，指定用户改 owner
-- 参数：p_ledger_id, p_new_owner_id
-- ============================================================
create or replace function public.transfer_owner(p_ledger_id uuid, p_new_owner_id uuid)
returns void as $$
declare
  old_owner uuid;
begin
  -- 只有旧 owner 才能执行（SECURITY INVOKER + RLS 兜底；调用者必须有 owner 行记录）
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

-- 12. 开启账单表实时订阅（多人协同：别人记一笔，你这边立即出现）
do $$
begin
  alter publication supabase_realtime add table public.transactions;
exception
  when duplicate_object then null;  -- 已添加过
  when undefined_object then null;  -- publication 不存在（旧项目）
end $$;
