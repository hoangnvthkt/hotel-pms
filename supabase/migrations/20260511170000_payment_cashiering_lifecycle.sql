-- Payment and cashiering lifecycle for manual cash / bank transfer settlement.
-- Bank transfers stay pending until verified by accountant/manager/admin.

alter type public.payment_status add value if not exists 'pending_verification';

alter table public.folio_items
  add column if not exists source_id uuid;

create unique index if not exists folio_items_unique_payment_credit_idx
  on public.folio_items (source_id)
  where source_type = 'payment' and source_id is not null;

create unique index if not exists folio_items_unique_deposit_credit_idx
  on public.folio_items (source_id)
  where source_type = 'deposit' and source_id is not null;

with unmatched_items as (
  select
    fi.id,
    fi.folio_id,
    fi.amount,
    fi.business_date,
    row_number() over (
      partition by fi.folio_id, fi.amount, fi.business_date
      order by fi.posted_at, fi.id
    ) as rn
  from public.folio_items fi
  where fi.source_type = 'payment'
    and fi.source_id is null
),
unmatched_payments as (
  select
    p.id,
    p.folio_id,
    p.amount,
    (p.received_at at time zone 'Asia/Ho_Chi_Minh')::date as business_date,
    row_number() over (
      partition by p.folio_id, p.amount, (p.received_at at time zone 'Asia/Ho_Chi_Minh')::date
      order by p.received_at, p.id
    ) as rn
  from public.payments p
  where p.status in ('posted', 'finalized')
),
matched as (
  select ui.id as item_id, up.id as payment_id
  from unmatched_items ui
  join unmatched_payments up
    on up.folio_id = ui.folio_id
   and up.amount = ui.amount
   and up.business_date = ui.business_date
   and up.rn = ui.rn
)
update public.folio_items fi
set source_id = matched.payment_id
from matched
where fi.id = matched.item_id;

alter table public.booking_deposits
  add column if not exists status public.payment_status not null default 'posted',
  add column if not exists evidence_path text,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_note text,
  add column if not exists receipt_number text;

alter table public.payments
  add column if not exists evidence_path text,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_note text,
  add column if not exists receipt_number text;

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  branch_name text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, account_number)
);

create table if not exists public.cashier_sessions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed', 'approved', 'voided')),
  opening_float numeric(12,2) not null default 0 check (opening_float >= 0),
  declared_cash numeric(12,2) check (declared_cash >= 0),
  note text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null
);

create unique index if not exists cashier_sessions_one_open_per_cashier_idx
  on public.cashier_sessions (property_id, cashier_id)
  where status = 'open';

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  receipt_number text not null,
  receipt_type text not null check (receipt_type in ('deposit', 'payment', 'refund')),
  booking_id uuid references public.bookings(id) on delete set null,
  folio_id uuid references public.folios(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  booking_deposit_id uuid references public.booking_deposits(id) on delete set null,
  refund_id uuid references public.refunds(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method,
  status text not null default 'issued' check (status in ('issued', 'voided')),
  pdf_url text,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  unique (property_id, receipt_number)
);

alter table public.payments
  add column if not exists cashier_session_id uuid references public.cashier_sessions(id) on delete set null;

alter table public.booking_deposits
  add column if not exists cashier_session_id uuid references public.cashier_sessions(id) on delete set null;

alter table public.refunds
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists cashier_session_id uuid references public.cashier_sessions(id) on delete set null,
  add column if not exists receipt_number text;

alter table public.bank_accounts enable row level security;
alter table public.cashier_sessions enable row level security;
alter table public.receipts enable row level security;

grant select, insert, update, delete on public.bank_accounts to authenticated;
grant select, insert, update on public.cashier_sessions to authenticated;
grant select, insert, update on public.receipts to authenticated;

drop policy if exists "property scoped select bank accounts" on public.bank_accounts;
create policy "property scoped select bank accounts"
  on public.bank_accounts
  for select
  to authenticated
  using (property_id = (select private.current_property_id()));

drop policy if exists "finance manage bank accounts" on public.bank_accounts;
create policy "finance manage bank accounts"
  on public.bank_accounts
  for all
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  )
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  );

drop policy if exists "cashier sessions select" on public.cashier_sessions;
create policy "cashier sessions select"
  on public.cashier_sessions
  for select
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (
      cashier_id = auth.uid()
      or (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
    )
  );

drop policy if exists "cashier sessions insert" on public.cashier_sessions;
create policy "cashier sessions insert"
  on public.cashier_sessions
  for insert
  to authenticated
  with check (
    property_id = (select private.current_property_id())
    and cashier_id = auth.uid()
    and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]))
  );

drop policy if exists "cashier sessions update" on public.cashier_sessions;
create policy "cashier sessions update"
  on public.cashier_sessions
  for update
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (
      cashier_id = auth.uid()
      or (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
    )
  )
  with check (
    property_id = (select private.current_property_id())
    and (
      cashier_id = auth.uid()
      or (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
    )
  );

drop policy if exists "property scoped receipts select" on public.receipts;
create policy "property scoped receipts select"
  on public.receipts
  for select
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]))
  );

drop policy if exists "operations insert receipts" on public.receipts;
create policy "operations insert receipts"
  on public.receipts
  for insert
  to authenticated
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]))
  );

drop policy if exists "finance update receipts" on public.receipts;
create policy "finance update receipts"
  on public.receipts
  for update
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  )
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  );

drop policy if exists "finance update booking deposits" on public.booking_deposits;
create policy "finance update booking deposits"
  on public.booking_deposits
  for update
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  )
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  );

drop policy if exists "accountant update payments" on public.payments;
create policy "finance update payments"
  on public.payments
  for update
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  )
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  );

drop policy if exists "property scoped refunds" on public.refunds;
create policy "property scoped refunds"
  on public.refunds
  for all
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]))
  )
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]))
  );

create or replace function private.normalize_manual_payment_method(p_method public.payment_method)
returns public.payment_method
language sql
immutable
as $$
  select case
    when p_method = 'qr_manual'::public.payment_method then 'bank_transfer'::public.payment_method
    else p_method
  end
$$;

create or replace function private.generate_receipt_number(p_prefix text default 'RC')
returns text
language sql
volatile
as $$
  select p_prefix || '-' ||
    to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
$$;

create or replace function private.get_or_open_cashier_session(
  p_property_id uuid,
  p_cashier_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_session_id uuid;
begin
  select id into v_session_id
  from public.cashier_sessions
  where property_id = p_property_id
    and cashier_id = p_cashier_id
    and status = 'open'
  order by opened_at desc
  limit 1;

  if v_session_id is null then
    insert into public.cashier_sessions (property_id, cashier_id)
    values (p_property_id, p_cashier_id)
    returning id into v_session_id;
  end if;

  return v_session_id;
end;
$$;

create or replace function private.issue_receipt(
  p_property_id uuid,
  p_receipt_type text,
  p_amount numeric,
  p_method public.payment_method,
  p_booking_id uuid default null,
  p_folio_id uuid default null,
  p_payment_id uuid default null,
  p_booking_deposit_id uuid default null,
  p_refund_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_receipt_number text;
begin
  v_receipt_number := private.generate_receipt_number(
    case p_receipt_type
      when 'deposit' then 'DEP'
      when 'refund' then 'RF'
      else 'RC'
    end
  );

  insert into public.receipts (
    property_id,
    receipt_number,
    receipt_type,
    booking_id,
    folio_id,
    payment_id,
    booking_deposit_id,
    refund_id,
    amount,
    method,
    issued_by
  )
  values (
    p_property_id,
    v_receipt_number,
    p_receipt_type,
    p_booking_id,
    p_folio_id,
    p_payment_id,
    p_booking_deposit_id,
    p_refund_id,
    p_amount,
    p_method,
    auth.uid()
  );

  return v_receipt_number;
end;
$$;

create or replace function private.create_payment_credit_item()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status in ('posted', 'finalized')
     and not exists (
       select 1
       from public.folio_items
       where source_type = 'payment'
         and source_id = new.id
     ) then
    insert into public.folio_items (
      property_id,
      folio_id,
      type,
      source_type,
      source_id,
      description,
      quantity,
      unit_price,
      amount,
      business_date,
      posted_by
    )
    values (
      new.property_id,
      new.folio_id,
      'credit',
      'payment',
      new.id,
      case
        when new.method = 'cash' then 'Thanh toán tiền mặt'
        else 'Thanh toán chuyển khoản'
      end,
      1,
      new.amount,
      new.amount,
      (new.received_at at time zone 'Asia/Ho_Chi_Minh')::date,
      new.received_by
    );
  end if;

  return new;
end;
$$;

drop trigger if exists payments_create_credit_item_trg on public.payments;
create trigger payments_create_credit_item_trg
  after insert or update of status on public.payments
  for each row execute function private.create_payment_credit_item();

create or replace function public.fn_record_booking_deposit(
  p_booking_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_reference text default null,
  p_evidence_path text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_booking record;
  v_method public.payment_method := private.normalize_manual_payment_method(p_method);
  v_status public.payment_status;
  v_deposit_id uuid;
  v_session_id uuid;
  v_receipt_number text;
  v_posted_total numeric;
begin
  if p_amount <= 0 then
    raise exception 'Deposit amount must be positive';
  end if;

  if v_method not in ('cash', 'bank_transfer') then
    raise exception 'Only cash and bank transfer are supported in MVP';
  end if;

  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to record booking deposits';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and property_id = private.current_property_id()
    and status in ('tentative', 'confirmed', 'checked_in')
  for update;

  if not found then
    raise exception 'Active booking not found';
  end if;

  v_status := case
    when v_method = 'cash' then 'posted'::public.payment_status
    else 'pending_verification'::public.payment_status
  end;

  if v_method = 'cash' then
    v_session_id := private.get_or_open_cashier_session(v_booking.property_id, auth.uid());
  end if;

  insert into public.booking_deposits (
    property_id,
    booking_id,
    amount,
    method,
    status,
    reference,
    evidence_path,
    received_by,
    cashier_session_id
  )
  values (
    v_booking.property_id,
    p_booking_id,
    p_amount,
    v_method,
    v_status,
    nullif(trim(coalesce(p_reference, '')), ''),
    nullif(trim(coalesce(p_evidence_path, '')), ''),
    auth.uid(),
    v_session_id
  )
  returning id into v_deposit_id;

  if v_status in ('posted', 'finalized') then
    v_receipt_number := private.issue_receipt(
      v_booking.property_id,
      'deposit',
      p_amount,
      v_method,
      p_booking_id,
      null,
      null,
      v_deposit_id,
      null
    );

    update public.booking_deposits
    set receipt_number = v_receipt_number
    where id = v_deposit_id;
  end if;

  select coalesce(sum(amount), 0) into v_posted_total
  from public.booking_deposits
  where booking_id = p_booking_id
    and status in ('posted', 'finalized');

  update public.bookings
  set deposit_paid = case
        when deposit_amount > 0 then v_posted_total >= deposit_amount
        else v_posted_total > 0
      end,
      status = case
        when status = 'tentative' and v_posted_total > 0 then 'confirmed'::public.booking_status
        else status
      end
  where id = p_booking_id;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_booking.property_id,
    auth.uid(),
    'booking_deposit',
    v_deposit_id,
    'record_deposit',
    jsonb_build_object('booking_id', p_booking_id, 'method', v_method, 'status', v_status, 'amount', p_amount)
  );

  return v_deposit_id;
end;
$$;

create or replace function public.fn_apply_deposits_to_folio(
  p_booking_id uuid,
  p_folio_id uuid
)
returns int
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_folio record;
  v_applied int := 0;
begin
  select * into v_folio
  from public.folios
  where id = p_folio_id
    and booking_id = p_booking_id
    and property_id = private.current_property_id()
    and status = 'open'
  for update;

  if not found then
    raise exception 'Open folio not found';
  end if;

  insert into public.folio_items (
    property_id,
    folio_id,
    type,
    source_type,
    source_id,
    description,
    quantity,
    unit_price,
    amount,
    business_date,
    posted_by
  )
  select
    bd.property_id,
    p_folio_id,
    'credit',
    'deposit',
    bd.id,
    case
      when bd.method = 'cash' then 'Đặt cọc tiền mặt'
      else 'Đặt cọc chuyển khoản'
    end,
    1,
    bd.amount,
    bd.amount,
    (bd.received_at at time zone 'Asia/Ho_Chi_Minh')::date,
    bd.received_by
  from public.booking_deposits bd
  where bd.booking_id = p_booking_id
    and bd.property_id = v_folio.property_id
    and bd.status in ('posted', 'finalized')
    and not exists (
      select 1
      from public.folio_items fi
      where fi.source_type = 'deposit'
        and fi.source_id = bd.id
    );

  get diagnostics v_applied = row_count;
  return v_applied;
end;
$$;

create or replace function public.fn_record_folio_payment(
  p_folio_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_reference text default null,
  p_evidence_path text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_folio record;
  v_method public.payment_method := private.normalize_manual_payment_method(p_method);
  v_status public.payment_status;
  v_payment_id uuid;
  v_session_id uuid;
  v_receipt_number text;
begin
  if p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;

  if v_method not in ('cash', 'bank_transfer') then
    raise exception 'Only cash and bank transfer are supported in MVP';
  end if;

  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to record payments';
  end if;

  select * into v_folio
  from public.folios
  where id = p_folio_id
    and property_id = private.current_property_id()
    and status = 'open'
  for update;

  if not found then
    raise exception 'Open folio not found';
  end if;

  v_status := case
    when v_method = 'cash' then 'posted'::public.payment_status
    else 'pending_verification'::public.payment_status
  end;

  if v_method = 'cash' then
    v_session_id := private.get_or_open_cashier_session(v_folio.property_id, auth.uid());
  end if;

  insert into public.payments (
    property_id,
    folio_id,
    method,
    status,
    amount,
    reference,
    evidence_path,
    received_by,
    cashier_session_id
  )
  values (
    v_folio.property_id,
    p_folio_id,
    v_method,
    v_status,
    p_amount,
    nullif(trim(coalesce(p_reference, '')), ''),
    nullif(trim(coalesce(p_evidence_path, '')), ''),
    auth.uid(),
    v_session_id
  )
  returning id into v_payment_id;

  if v_status in ('posted', 'finalized') then
    v_receipt_number := private.issue_receipt(
      v_folio.property_id,
      'payment',
      p_amount,
      v_method,
      v_folio.booking_id,
      p_folio_id,
      v_payment_id,
      null,
      null
    );

    update public.payments
    set receipt_number = v_receipt_number
    where id = v_payment_id;
  end if;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_folio.property_id,
    auth.uid(),
    'payment',
    v_payment_id,
    'record_payment',
    jsonb_build_object('folio_id', p_folio_id, 'method', v_method, 'status', v_status, 'amount', p_amount)
  );

  return v_payment_id;
end;
$$;

create or replace function public.fn_record_payment(
  p_folio_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_reference text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  return public.fn_record_folio_payment(p_folio_id, p_method, p_amount, p_reference, null);
end;
$$;

create or replace function public.fn_verify_payment(
  p_target_id uuid,
  p_kind text,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_payment record;
  v_deposit record;
  v_receipt_number text;
  v_posted_total numeric;
  v_folio_id uuid;
begin
  if p_kind not in ('payment', 'deposit') then
    raise exception 'Invalid payment verification kind';
  end if;

  if p_decision not in ('approve', 'reject', 'void') then
    raise exception 'Invalid payment verification decision';
  end if;

  if not private.has_any_role(array['admin','manager','accountant']::public.pms_role[]) then
    raise exception 'Only accountant/manager/admin can verify payments';
  end if;

  if p_kind = 'payment' then
    select * into v_payment
    from public.payments
    where id = p_target_id
      and property_id = private.current_property_id()
    for update;

    if not found then
      raise exception 'Payment not found';
    end if;

    if p_decision = 'approve' then
      update public.payments
      set status = 'posted',
          verified_by = auth.uid(),
          verified_at = now(),
          verification_note = nullif(trim(coalesce(p_note, '')), '')
      where id = p_target_id;

      if v_payment.receipt_number is null then
        v_receipt_number := private.issue_receipt(
          v_payment.property_id,
          'payment',
          v_payment.amount,
          v_payment.method,
          (select booking_id from public.folios where id = v_payment.folio_id),
          v_payment.folio_id,
          v_payment.id,
          null,
          null
        );

        update public.payments
        set receipt_number = v_receipt_number
        where id = p_target_id;
      end if;
    else
      update public.payments
      set status = 'voided',
          verified_by = auth.uid(),
          verified_at = now(),
          verification_note = nullif(trim(coalesce(p_note, '')), '')
      where id = p_target_id;
    end if;

    insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
    values (
      v_payment.property_id,
      auth.uid(),
      'payment',
      p_target_id,
      'verify_' || p_decision,
      jsonb_build_object('kind', p_kind, 'note', p_note)
    );

    return p_target_id;
  end if;

  select * into v_deposit
  from public.booking_deposits
  where id = p_target_id
    and property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Booking deposit not found';
  end if;

  if p_decision = 'approve' then
    update public.booking_deposits
    set status = 'posted',
        verified_by = auth.uid(),
        verified_at = now(),
        verification_note = nullif(trim(coalesce(p_note, '')), '')
    where id = p_target_id;

    if v_deposit.receipt_number is null then
      v_receipt_number := private.issue_receipt(
        v_deposit.property_id,
        'deposit',
        v_deposit.amount,
        v_deposit.method,
        v_deposit.booking_id,
        null,
        null,
        v_deposit.id,
        null
      );

      update public.booking_deposits
      set receipt_number = v_receipt_number
      where id = p_target_id;
    end if;

    select coalesce(sum(amount), 0) into v_posted_total
    from public.booking_deposits
    where booking_id = v_deposit.booking_id
      and status in ('posted', 'finalized');

    update public.bookings
    set deposit_paid = case
          when deposit_amount > 0 then v_posted_total >= deposit_amount
          else v_posted_total > 0
        end,
        status = case
          when status = 'tentative' and v_posted_total > 0 then 'confirmed'::public.booking_status
          else status
        end
    where id = v_deposit.booking_id;

    select id into v_folio_id
    from public.folios
    where booking_id = v_deposit.booking_id
      and parent_folio_id is null
      and status = 'open'
    limit 1;

    if v_folio_id is not null then
      perform public.fn_apply_deposits_to_folio(v_deposit.booking_id, v_folio_id);
    end if;
  else
    update public.booking_deposits
    set status = 'voided',
        verified_by = auth.uid(),
        verified_at = now(),
        verification_note = nullif(trim(coalesce(p_note, '')), '')
    where id = p_target_id;
  end if;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_deposit.property_id,
    auth.uid(),
    'booking_deposit',
    p_target_id,
    'verify_' || p_decision,
    jsonb_build_object('kind', p_kind, 'booking_id', v_deposit.booking_id, 'note', p_note)
  );

  return p_target_id;
end;
$$;

create or replace function public.fn_request_refund(
  p_folio_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_folio record;
  v_refundable numeric;
  v_refund_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Refund amount must be positive';
  end if;

  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Refund reason is required';
  end if;

  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to request refunds';
  end if;

  select * into v_folio
  from public.folios
  where id = p_folio_id
    and property_id = private.current_property_id();

  if not found then
    raise exception 'Folio not found';
  end if;

  select
    coalesce(sum(amount) filter (where type = 'credit' and source_type in ('payment', 'deposit')), 0)
    - coalesce(sum(amount) filter (where type = 'debit' and source_type = 'refund'), 0)
  into v_refundable
  from public.folio_items
  where folio_id = p_folio_id;

  if p_amount > coalesce(v_refundable, 0) then
    raise exception 'Refund amount exceeds refundable credit';
  end if;

  insert into public.refunds (
    property_id,
    payment_id,
    folio_id,
    amount,
    reason,
    status,
    created_by
  )
  values (
    v_folio.property_id,
    p_payment_id,
    p_folio_id,
    p_amount,
    trim(p_reason),
    'draft',
    auth.uid()
  )
  returning id into v_refund_id;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_folio.property_id,
    auth.uid(),
    'refund',
    v_refund_id,
    'request_refund',
    jsonb_build_object('folio_id', p_folio_id, 'amount', p_amount, 'reason', p_reason)
  );

  return v_refund_id;
end;
$$;

create or replace function public.fn_approve_refund(
  p_refund_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_refund record;
  v_folio record;
  v_receipt_number text;
  v_session_id uuid;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'Invalid refund decision';
  end if;

  if not private.has_any_role(array['admin','manager','accountant']::public.pms_role[]) then
    raise exception 'Only accountant/manager/admin can approve refunds';
  end if;

  select * into v_refund
  from public.refunds
  where id = p_refund_id
    and property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Refund not found';
  end if;

  if v_refund.status <> 'draft' then
    raise exception 'Refund is not pending approval';
  end if;

  select * into v_folio
  from public.folios
  where id = v_refund.folio_id;

  if p_decision = 'reject' then
    update public.refunds
    set status = 'voided',
        approved_by = auth.uid(),
        approved_at = now()
    where id = p_refund_id;
  else
    v_session_id := private.get_or_open_cashier_session(v_refund.property_id, auth.uid());

    update public.refunds
    set status = 'posted',
        approved_by = auth.uid(),
        approved_at = now(),
        cashier_session_id = v_session_id
    where id = p_refund_id;

    insert into public.folio_items (
      property_id,
      folio_id,
      type,
      source_type,
      source_id,
      description,
      quantity,
      unit_price,
      amount,
      posted_by
    )
    values (
      v_refund.property_id,
      v_refund.folio_id,
      'debit',
      'refund',
      v_refund.id,
      'Hoàn tiền: ' || v_refund.reason,
      1,
      v_refund.amount,
      v_refund.amount,
      auth.uid()
    );

    v_receipt_number := private.issue_receipt(
      v_refund.property_id,
      'refund',
      v_refund.amount,
      'cash',
      v_folio.booking_id,
      v_refund.folio_id,
      v_refund.payment_id,
      null,
      v_refund.id
    );

    update public.refunds
    set receipt_number = v_receipt_number
    where id = p_refund_id;
  end if;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_refund.property_id,
    auth.uid(),
    'refund',
    p_refund_id,
    'refund_' || p_decision,
    jsonb_build_object('folio_id', v_refund.folio_id, 'amount', v_refund.amount, 'note', p_note)
  );

  return p_refund_id;
end;
$$;

create or replace function public.fn_check_in_booking(
  p_booking_id uuid,
  p_room_id uuid,
  p_payment jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_booking record;
  v_room record;
  v_assignment_id uuid;
  v_folio_id uuid;
  v_payment_amount numeric := coalesce((p_payment->>'amount')::numeric, 0);
  v_applied_deposits int := 0;
begin
  if not private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to check in';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.status = 'checked_in' then
    select id into v_folio_id
    from public.folios
    where booking_id = p_booking_id
      and parent_folio_id is null
    limit 1;

    if v_folio_id is null then
      raise exception 'Checked-in booking has no master folio';
    end if;

    return v_folio_id;
  end if;

  if v_booking.status not in ('tentative', 'confirmed') then
    raise exception 'Booking status % cannot be checked in', v_booking.status;
  end if;

  perform private.assert_guest_c65_ready(v_booking.guest_id);

  select * into v_room
  from public.rooms
  where id = p_room_id
    and property_id = v_booking.property_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if v_room.status <> 'vacant_clean' and not private.has_any_role(array['admin','manager']::public.pms_role[]) then
    raise exception 'Room must be vacant_clean before check-in';
  end if;

  if v_room.status in ('out_of_order', 'blocked') and not private.has_any_role(array['admin','manager']::public.pms_role[]) then
    raise exception 'Only manager/admin can override blocked or out-of-order rooms';
  end if;

  if exists (
    select 1
    from public.booking_rooms br
    where br.room_id = p_room_id
      and br.booking_id <> p_booking_id
      and br.status in ('tentative', 'confirmed', 'checked_in')
      and tstzrange(br.check_in, br.check_out, '[)') && tstzrange(v_booking.check_in, v_booking.check_out, '[)')
  ) then
    raise exception 'Room is not available';
  end if;

  select id into v_assignment_id
  from public.booking_rooms
  where booking_id = p_booking_id
    and status in ('tentative', 'confirmed')
  order by created_at
  limit 1
  for update;

  if v_assignment_id is null then
    raise exception 'Booking has no active room assignment';
  end if;

  update public.bookings
  set status = 'checked_in'
  where id = p_booking_id;

  update public.booking_rooms
  set status = 'checked_in',
      room_id = p_room_id,
      check_in = v_booking.check_in,
      check_out = v_booking.check_out
  where id = v_assignment_id;

  update public.rooms
  set status = 'occupied'
  where id = p_room_id;

  insert into public.room_status_history (
    property_id,
    room_id,
    from_status,
    to_status,
    reason,
    changed_by
  )
  values (
    v_booking.property_id,
    p_room_id,
    v_room.status,
    'occupied',
    'check_in',
    auth.uid()
  );

  insert into public.folios (property_id, booking_id, folio_number)
  values (v_booking.property_id, p_booking_id, 'F-' || v_booking.booking_number)
  on conflict (booking_id) where parent_folio_id is null
  do update set booking_id = excluded.booking_id
  returning id into v_folio_id;

  v_applied_deposits := public.fn_apply_deposits_to_folio(p_booking_id, v_folio_id);

  if v_applied_deposits = 0
     and v_booking.deposit_paid
     and v_booking.deposit_amount > 0
     and not exists (
       select 1
       from public.booking_deposits
       where booking_id = p_booking_id
         and status in ('posted', 'finalized')
     )
     and not exists (
       select 1
       from public.folio_items
       where folio_id = v_folio_id
         and source_type = 'deposit'
         and type = 'credit'
     ) then
    insert into public.folio_items (
      property_id,
      folio_id,
      type,
      source_type,
      description,
      quantity,
      unit_price,
      amount,
      posted_by
    )
    values (
      v_booking.property_id,
      v_folio_id,
      'credit',
      'deposit',
      'Deposit received before check-in',
      1,
      v_booking.deposit_amount,
      v_booking.deposit_amount,
      auth.uid()
    );
  end if;

  if p_payment is not null and v_payment_amount > 0 then
    perform public.fn_record_folio_payment(
      v_folio_id,
      (p_payment->>'method')::public.payment_method,
      v_payment_amount,
      p_payment->>'reference',
      p_payment->>'evidence_path'
    );
  end if;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_booking.property_id,
    auth.uid(),
    'booking',
    p_booking_id,
    'check_in',
    jsonb_build_object('room_id', p_room_id, 'folio_id', v_folio_id)
  );

  return v_folio_id;
end;
$$;

create or replace function public.fn_check_out_booking(
  p_booking_id uuid,
  p_settlement_mode text default 'paid'
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_booking record;
  v_assignment record;
  v_folio record;
  v_balance numeric;
  v_invoice_number text;
  v_invoice_total numeric;
  v_checkout_at timestamptz;
begin
  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to check out';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and property_id = private.current_property_id()
    and status = 'checked_in'
  for update;

  if not found then
    raise exception 'Checked-in booking not found';
  end if;

  select * into v_assignment
  from public.booking_rooms
  where booking_id = p_booking_id
    and status = 'checked_in'
  order by check_in desc
  limit 1
  for update;

  if not found then
    raise exception 'Active room assignment not found';
  end if;

  select * into v_folio
  from public.folios
  where booking_id = p_booking_id
    and parent_folio_id is null
  for update;

  if not found then
    raise exception 'Master folio not found';
  end if;

  if exists (
    select 1
    from public.payments
    where folio_id = v_folio.id
      and status = 'pending_verification'
  ) or exists (
    select 1
    from public.booking_deposits
    where booking_id = p_booking_id
      and status = 'pending_verification'
  ) then
    raise exception 'Pending bank transfers must be verified before checkout';
  end if;

  v_balance := public.fn_calculate_folio_balance(v_folio.id);

  if coalesce(v_balance, 0) > 0 and p_settlement_mode <> 'city_ledger' then
    raise exception 'Folio balance must be zero before checkout';
  end if;

  if coalesce(v_balance, 0) > 0
     and p_settlement_mode = 'city_ledger'
     and not private.has_any_role(array['admin','manager','accountant']::public.pms_role[]) then
    raise exception 'Only manager/accountant can move balance to city ledger';
  end if;

  v_checkout_at := greatest(now(), v_assignment.check_in + interval '1 second');

  update public.folios
  set status = 'closed',
      closed_at = v_checkout_at
  where id = v_folio.id;

  update public.bookings
  set status = 'checked_out'
  where id = p_booking_id;

  update public.booking_rooms
  set status = 'checked_out',
      check_out = v_checkout_at
  where id = v_assignment.id;

  update public.rooms
  set status = 'vacant_dirty'
  where id = v_assignment.room_id;

  insert into public.room_status_history (property_id, room_id, from_status, to_status, reason, changed_by)
  values (v_booking.property_id, v_assignment.room_id, 'occupied', 'vacant_dirty', 'check_out', auth.uid());

  insert into public.housekeeping_tasks (property_id, room_id, task_type, status, priority, notes)
  values (v_booking.property_id, v_assignment.room_id, 'checkout_clean', 'pending', 'high', 'Tự động tạo sau checkout');

  v_invoice_number := 'INV-' || to_char(v_checkout_at at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  select coalesce(sum(amount), 0) into v_invoice_total
  from public.folio_items
  where folio_id = v_folio.id
    and type = 'debit';

  insert into public.invoices (
    property_id,
    folio_id,
    invoice_number,
    status,
    total_amount,
    issued_at,
    issued_by
  )
  values (
    v_booking.property_id,
    v_folio.id,
    v_invoice_number,
    'issued',
    v_invoice_total,
    v_checkout_at,
    auth.uid()
  );

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_booking.property_id,
    auth.uid(),
    'booking',
    p_booking_id,
    'check_out',
    jsonb_build_object('folio_id', v_folio.id, 'room_id', v_assignment.room_id, 'settlement_mode', p_settlement_mode, 'checkout_at', v_checkout_at)
  );

  return v_folio.id;
end;
$$;

grant execute on function public.fn_record_booking_deposit(uuid, public.payment_method, numeric, text, text) to authenticated;
grant execute on function public.fn_apply_deposits_to_folio(uuid, uuid) to authenticated;
grant execute on function public.fn_record_folio_payment(uuid, public.payment_method, numeric, text, text) to authenticated;
grant execute on function public.fn_verify_payment(uuid, text, text, text) to authenticated;
grant execute on function public.fn_request_refund(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.fn_approve_refund(uuid, text, text) to authenticated;

revoke all on function public.fn_record_booking_deposit(uuid, public.payment_method, numeric, text, text) from public, anon;
revoke all on function public.fn_apply_deposits_to_folio(uuid, uuid) from public, anon;
revoke all on function public.fn_record_folio_payment(uuid, public.payment_method, numeric, text, text) from public, anon;
revoke all on function public.fn_verify_payment(uuid, text, text, text) from public, anon;
revoke all on function public.fn_request_refund(uuid, uuid, numeric, text) from public, anon;
revoke all on function public.fn_approve_refund(uuid, text, text) from public, anon;
