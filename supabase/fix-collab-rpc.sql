-- 协同创建 RPC + SELECT 策略补丁（在 Supabase SQL Editor 执行）
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

drop policy if exists "ledgers_select_member" on public.ledgers;
create policy "ledgers_select_member" on public.ledgers
  for select using (public.is_ledger_member(id) or auth.uid() = created_by);
