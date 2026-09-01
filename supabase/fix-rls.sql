-- RLS 递归修复 + 测试账号密码重置（在 Supabase SQL Editor 执行）
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

drop policy if exists "ledgers_select_member" on public.ledgers;
create policy "ledgers_select_member" on public.ledgers
  for select using (public.is_ledger_member(id));
drop policy if exists "ledgers_update_owner" on public.ledgers;
create policy "ledgers_update_owner" on public.ledgers
  for update using (public.has_ledger_role(id, array['owner', 'admin']));
drop policy if exists "ledgers_delete_owner" on public.ledgers;
create policy "ledgers_delete_owner" on public.ledgers
  for delete using (public.has_ledger_role(id, array['owner']));

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

drop policy if exists "tx_select_member" on public.transactions;
create policy "tx_select_member" on public.transactions
  for select using (public.is_ledger_member(ledger_id));
drop policy if exists "tx_insert_member" on public.transactions;
create policy "tx_insert_member" on public.transactions
  for insert with check (auth.uid() = user_id and public.is_ledger_member(ledger_id));
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

-- 重置测试账号密码（保证可登录）
update auth.users
set encrypted_password = crypt('Test123456', gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'test@xiaogou.com';
