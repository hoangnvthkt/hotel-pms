begin;

set search_path = public, extensions;

select plan(10);

insert into public.roles (name, description) values
  ('admin', 'Admin'),
  ('manager', 'Manager'),
  ('receptionist', 'Receptionist'),
  ('hk_supervisor', 'HK supervisor'),
  ('hk_staff', 'HK staff'),
  ('accountant', 'Accountant')
on conflict do nothing;

select test.create_auth_user('91000000-0000-4000-8000-000000000101', 'folio-projection-rec@test.local');

insert into public.properties (id, name, address, total_rooms)
values ('91000000-0000-4000-8000-000000000001', 'Folio Projection Test', 'A', 3);

insert into public.profiles (id, property_id, full_name, email)
values ('91000000-0000-4000-8000-000000000101', '91000000-0000-4000-8000-000000000001', 'Reception', 'folio-projection-rec@test.local');

insert into public.profile_roles (profile_id, role)
values ('91000000-0000-4000-8000-000000000101', 'receptionist');

select test.set_auth_user('91000000-0000-4000-8000-000000000101');

insert into public.room_types (id, property_id, name, code, max_occupancy, bed_type, base_price)
values ('91000000-0000-4000-8000-000000000201', '91000000-0000-4000-8000-000000000001', 'Standard', 'STD', 2, 'Queen', 800000);

insert into public.rooms (id, property_id, room_type_id, number, floor, status)
values
  ('91000000-0000-4000-8000-000000000301', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000201', '1001', 10, 'vacant_clean'),
  ('91000000-0000-4000-8000-000000000302', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000201', '1002', 10, 'vacant_clean');

insert into public.guests (
  id, property_id, first_name, last_name, full_name, phone, nationality,
  document_type, document_number, document_issue_date, document_issue_place,
  date_of_birth, gender, occupation, current_address, stay_purpose
)
values
  (
    '91000000-0000-4000-8000-000000000401',
    '91000000-0000-4000-8000-000000000001',
    'Projection', 'Guest', 'Projection Guest', '0900000001', 'VN',
    'cccd', '091401', date '2020-01-01', 'HCMC',
    date '1990-01-01', 'male', 'Engineer', 'HCMC', 'travel'
  ),
  (
    '91000000-0000-4000-8000-000000000402',
    '91000000-0000-4000-8000-000000000001',
    'Pending', 'Guest', 'Pending Guest', '0900000002', 'VN',
    'cccd', '091402', date '2020-01-01', 'HCMC',
    date '1990-01-01', 'female', 'Designer', 'HCMC', 'travel'
  );

insert into public.bookings (
  id, booking_number, property_id, guest_id, check_in, check_out, nights,
  status, rate_per_night, total_amount, deposit_amount, deposit_paid
)
values
  (
    '91000000-0000-4000-8000-000000000501',
    'BK-PROJ-1',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000401',
    '2026-08-01 14:00+07',
    '2026-08-02 12:00+07',
    1,
    'confirmed',
    800000,
    800000,
    100000,
    false
  ),
  (
    '91000000-0000-4000-8000-000000000502',
    'BK-PROJ-2',
    '91000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000402',
    '2026-08-03 14:00+07',
    '2026-08-04 12:00+07',
    1,
    'confirmed',
    800000,
    800000,
    100000,
    false
  );

insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
values
  ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000501', '91000000-0000-4000-8000-000000000301', '2026-08-01 14:00+07', '2026-08-02 12:00+07', 'confirmed'),
  ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000502', '91000000-0000-4000-8000-000000000302', '2026-08-03 14:00+07', '2026-08-04 12:00+07', 'confirmed');

set local role authenticated;

select public.fn_record_booking_deposit(
  '91000000-0000-4000-8000-000000000501',
  'cash',
  100000,
  'CASH-DEP-1',
  null
);

select public.fn_check_in_booking(
  '91000000-0000-4000-8000-000000000501',
  '91000000-0000-4000-8000-000000000301',
  null
);

select is(
  (
    select count(*)::int
    from public.folio_items
    where folio_id = (select id from public.folios where booking_id = '91000000-0000-4000-8000-000000000501')
      and source_type = 'deposit'
      and type = 'credit'
  ),
  1,
  'cash deposit is applied to folio as credit on check-in'
);

select is(
  (
    select (public.fn_folio_projection(id)->>'projected_balance')::numeric
    from public.folios
    where booking_id = '91000000-0000-4000-8000-000000000501'
  ),
  700000::numeric,
  'projection shows room charge minus posted deposit before night audit'
);

select public.fn_add_folio_charge(
  (select id from public.folios where booking_id = '91000000-0000-4000-8000-000000000501'),
  'manual_service',
  'Thuê xe',
  100000
);

select public.fn_add_folio_charge(
  (select id from public.folios where booking_id = '91000000-0000-4000-8000-000000000501'),
  'laundry',
  'Giặt ủi',
  100000
);

select is(
  (
    select (public.fn_folio_projection(id)->>'projected_balance')::numeric
    from public.folios
    where booking_id = '91000000-0000-4000-8000-000000000501'
  ),
  900000::numeric,
  'projection adds posted services to room minus deposit'
);

select public.fn_record_booking_deposit(
  '91000000-0000-4000-8000-000000000502',
  'bank_transfer',
  100000,
  'BANK-DEP-PENDING',
  'evidence/pending.png'
);

select public.fn_check_in_booking(
  '91000000-0000-4000-8000-000000000502',
  '91000000-0000-4000-8000-000000000302',
  null
);

select is(
  (
    select (public.fn_folio_projection(id)->>'projected_balance')::numeric
    from public.folios
    where booking_id = '91000000-0000-4000-8000-000000000502'
  ),
  800000::numeric,
  'pending deposit is not subtracted from projected balance'
);

select is(
  (
    select (public.fn_folio_projection(id)->>'pending_payments')::numeric
    from public.folios
    where booking_id = '91000000-0000-4000-8000-000000000502'
  ),
  100000::numeric,
  'pending deposit is shown separately as pending payment'
);

select is(
  public.fn_post_room_charges_until_checkout('91000000-0000-4000-8000-000000000501', date '2026-08-02'),
  1,
  'room closeout posts the missing room night'
);

select is(
  public.fn_post_room_charges_until_checkout('91000000-0000-4000-8000-000000000501', date '2026-08-02'),
  0,
  'room closeout does not duplicate an existing room charge'
);

select public.fn_record_folio_payment(
  (select id from public.folios where booking_id = '91000000-0000-4000-8000-000000000501'),
  'cash',
  900000,
  'CASH-CHECKOUT-1',
  null
);

select is(
  public.fn_calculate_folio_balance((select id from public.folios where booking_id = '91000000-0000-4000-8000-000000000501')),
  0::numeric,
  'payment of projected balance clears posted folio after room charge is posted'
);

select public.fn_check_out_booking('91000000-0000-4000-8000-000000000501', 'paid');

select is(
  (
    select count(*)::int
    from public.folio_items
    where folio_id = (select id from public.folios where booking_id = '91000000-0000-4000-8000-000000000501')
      and source_type = 'room'
      and type = 'debit'
  ),
  1,
  'checkout does not duplicate room charge that was already posted'
);

select is(
  (select status from public.bookings where id = '91000000-0000-4000-8000-000000000501'),
  'checked_out'::public.booking_status,
  'checkout succeeds after folio is fully settled'
);

select * from finish();

rollback;
