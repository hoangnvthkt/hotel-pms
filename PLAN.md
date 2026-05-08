# Kế Hoạch Cập Nhật PMS Khách Sạn 50 Phòng

## 1. Tóm Tắt Quyết Định
- Tạo **repo riêng** `hotel-pms`, **Supabase project riêng**, **Vercel project riêng**. Không gộp vào `KhoTienThinh`.
- Làm MVP gọn để vận hành nội bộ trước: phòng, booking, lễ tân, housekeeping, folio, thanh toán thủ công, báo cáo cơ bản.
- Các tính năng thị trường như OTA, Booking Engine, payment gateway, hóa đơn điện tử, khóa từ, yield management sẽ **không build ngay**, nhưng schema/API phải chừa sẵn điểm nối.
- UI ban đầu tối ưu cho nhân viên vận hành: nhanh, rõ, responsive trên tablet/mobile; chưa làm native mobile app.

## 2. MVP Ban Đầu
- **Auth & phân quyền:** Supabase Auth, RLS, role `admin`, `manager`, `receptionist`, `hk_supervisor`, `hk_staff`, `accountant`.
- **Dashboard:** công suất phòng, doanh thu ngày/tháng, check-in/out hôm nay, phòng dirty/maintenance, booking sắp đến, cảnh báo chưa thanh toán.
- **Quản lý phòng:** loại phòng, 50 phòng, tầng, giá cơ bản, trạng thái phòng, lịch sử trạng thái, bảo trì.
- **Đặt phòng:** booking calendar, tạo/sửa/hủy booking, tìm phòng trống, nguồn booking, đặt cọc, ghi chú.
- **Lễ tân:** check-in, walk-in, đổi phòng, early/late fee, check-out, tự chuyển phòng sang dirty sau checkout.
- **Khách hàng:** hồ sơ khách, CCCD/passport, SĐT, email, quốc tịch, VIP note, blacklist, lịch sử lưu trú, khai báo lưu trú C65.
- **Housekeeping:** task dọn phòng, gán nhân viên, cập nhật mobile, supervisor inspect, lost & found.
- **Folio & tài chính cơ bản:** room charge, dịch vụ bổ sung, minibar/giặt ủi/phụ thu, thanh toán tiền mặt/chuyển khoản/QR manual, công nợ đơn giản, invoice PDF, split folio.
- **Night Audit:** đóng ngày kinh doanh, tự động post room charge, phát hiện no-show, kiểm tra discrepancy, revenue summary (ADR/RevPAR/occupancy), lock ngày cũ.
- **Báo cáo MVP:** doanh thu phòng, doanh thu dịch vụ, công suất phòng, nguồn booking, công nợ, payment summary, khai báo lưu trú.
- **Rate Management cơ bản:** BAR, Walk-in Rate, Corporate Rate, seasonal override.

## 3. Tính Năng Thêm Từ Thị Trường Nhưng Để Sau
- **Phase 2 - Nhà hàng/POS:** sơ đồ bàn, menu, order, kitchen display, split/merge bill, charge-to-room.
- **Phase 3 - Sự kiện:** event calendar, báo giá, BEO, package, checklist, quyết toán.
- **Phase 4 - Bán phòng online:** Booking Engine, website đặt phòng trực tiếp, form inquiry.
- **Phase 5 - OTA/Channel Manager:** đồng bộ Booking.com, Agoda, Expedia; chống overbooking; mapping room/rate.
- **Phase 6 - Thanh toán & hóa đơn:** payment gateway VNPay/Momo/BlueJay Pay tương đương, hóa đơn điện tử.
- **Phase 7 - Tối ưu doanh thu:** rate plan nâng cao, smart rate, yield management, khuyến mãi.
- **Phase 8 - Thiết bị & chuỗi:** khóa thẻ từ, điện phòng, QR scanner, multi-property, mobile app, loyalty/email marketing.

## 4. Thiết Kế Sẵn Để Mở Rộng
- Bảng chính đều có `property_id`, dù v1 chỉ có một khách sạn.
- `bookings.source`: `walk_in`, `phone`, `facebook`, `direct`, `ota_manual`, `website_later`.
- `bookings.external_reference`: mã booking từ OTA/website sau này.
- `payments.method`: `cash`, `bank_transfer`, `qr_manual`, `card_manual`, `gateway_later`.
- `room_rates` tách khỏi `room_types` để sau này thêm seasonal rate, promotion, smart rate.
- `folio_items.source_type`: `room`, `manual_service`, `minibar`, `laundry`, `restaurant_later`, `event_later`.
- `guests.marketing_consent` và `guests.loyalty_code` để mở CRM/loyalty sau.
- `rooms.lock_provider`, `rooms.lock_external_id`, `rooms.power_device_id` nullable để nối khóa từ/điện phòng sau.
- Không tích hợp vendor thật trong MVP; mọi field ngoài hệ thống là optional và không ảnh hưởng luồng nội bộ.

## 5. Data Model Cốt Lõi
- System: `properties`, `profiles`, `roles`, `profile_roles`, `settings`, `audit_logs`.
- Rooms: `room_types`, `rooms`, `room_rates`, `room_status_history`, `maintenance_tickets`.
- Guests/Bookings: `guests`, `guest_documents`, `bookings`, `booking_rooms`, `booking_deposits`, `booking_notes`.
- Housekeeping: `housekeeping_tasks`, `hk_assignments`, `lost_found`.
- Finance: `folios`, `folio_items`, `payments`, `invoices`, `refunds`.
- Night Audit: `business_dates`, `night_audit_logs`.
- Rates: `room_rates` (BAR, Walk-in, Corporate, Seasonal override).
- Later modules: `restaurant_tables`, `orders`, `order_items`, `kitchen_tickets`, `event_spaces`, `events`, `beo_versions`.
- **Double-booking prevention:** Dùng `btree_gist` extension + `EXCLUDE constraint` trên `booking_rooms` với `tstzrange(check_in, check_out)` — atomic, thread-safe, không race condition.
- Tiền dùng `numeric(12,2)`, timezone mặc định `Asia/Ho_Chi_Minh`, trạng thái dùng `check constraint`.

### 5.1 Room Status State Machine
```
Vacant_Clean → Occupied (check-in)
Occupied → Vacant_Dirty (check-out)
Vacant_Dirty → Inspected (HK clean done)
Inspected → Vacant_Clean (supervisor approve)
Inspected → Vacant_Dirty (supervisor reject)
Vacant_Clean → Out_of_Order (maintenance)
Out_of_Order → Vacant_Dirty (maintenance done)
Occupied → Occupied_Dirty (daily service needed)
Occupied_Dirty → Occupied_Clean (daily clean done)
```

### 5.2 Folio Architecture
- Mỗi booking có 1 master folio, có thể split thành sub-folio (VD: công ty trả room, cá nhân trả minibar).
- `folio_items`: debits (charges) & credits (payments).
- Balance = SUM(debits) - SUM(credits).
- Checkout chỉ được khi balance = 0 (hoặc chuyển city ledger/công nợ).
- Invoice tạo từ folio khi checkout.

### 5.3 Night Audit Flow
```
Night Audit = Quy trình cuối ngày:
├── Đóng ngày kinh doanh (business date roll)
├── Post room charges tự động vào folio
├── Kiểm tra: phòng chưa check-in có booking? → No-show
├── Verify HK status: tất cả phòng đã inspect chưa?
├── Revenue summary (ADR, RevPAR, occupancy %)
├── Detect discrepancies: folio chưa đóng, payment thiếu
└── Lock ngày cũ — không cho sửa dữ liệu đã audit
```

### 5.4 Guest Registration / Khai Báo Lưu Trú
Thông tin bắt buộc theo TT 01/2024/TT-BCA:
- Họ tên, ngày sinh, giới tính, quốc tịch
- CCCD/Passport + ngày cấp + nơi cấp
- Nghề nghiệp, nơi ở hiện tại
- Thời gian lưu trú (check-in/check-out), lý do lưu trú
- Hỗ trợ export báo cáo cho cơ quan công an.

## 6. Bảo Mật & Realtime
- Bật RLS cho toàn bộ bảng trong schema public.
- Không dùng `user_metadata` để phân quyền; role/permission lưu trong bảng hệ thống hoặc app metadata do server kiểm soát.
- Staff chỉ thấy dữ liệu đúng `property_id`.
- Dùng `security definer` function trong schema `private` cho role check — cache per-statement, tránh scan lại mỗi row.
- Index trên tất cả cột dùng trong RLS policies (`property_id`, `assigned_to`, `profile_id`).
- HK staff chỉ cập nhật task được giao; receptionist không sửa payment đã finalized; accountant quản lý payment/invoice; admin toàn quyền.
- Realtime chỉ subscribe bảng cần thiết: `rooms`, `housekeeping_tasks`.
- Booking calendar, dashboard: dùng TanStack Query cache + targeted invalidation + polling 30s cho aggregate.
- HK mobile: có thể dùng Broadcast thay Postgres Changes để scale tốt hơn.

## 7. Lộ Trình Triển Khai
- **Phase 0 - 1 tuần:** tạo repo, setup Vite/React/Supabase/Vercel, env local/staging/prod, seed 50 phòng mẫu.
- **Phase 1 - 2-3 tuần:** app shell, layout, auth, RBAC, RLS, settings, audit log.
- **Phase 2 - 3-4 tuần:** rooms, room types, rates cơ bản, status board, maintenance.
- **Phase 3 - 4-5 tuần:** guests, booking calendar, availability search, booking conflict constraint, khai báo lưu trú.
- **Phase 4 - 4 tuần:** check-in/out, walk-in, room change, folio (split folio), payment manual, invoice PDF, night audit.
- **Phase 5 - 2 tuần:** housekeeping mobile board, assignment, inspection, lost & found.
- **Phase 6 - 3 tuần:** dashboard, reports, export Excel/PDF cơ bản, UAT fix.
- Thời gian MVP thực tế: **~18-22 tuần** (bao gồm buffer 30%). POS + events + OTA/payment gateway là backlog sau MVP.

### 7.1 Business Logic Functions (Postgres)
```
fn_check_availability(room_type, check_in, check_out) → phòng trống
fn_calculate_folio_balance(folio_id) → tổng debit - credit
fn_post_room_charges(business_date) → auto charge nightly rate
fn_run_night_audit(property_id) → close business date
fn_generate_folio_number(property_id) → sequence-based
```

## 8. Test & Acceptance
- Unit/integration: availability search, double-book prevention, status transition, folio total, payment balance, night audit.
- RLS tests: mỗi role chỉ đọc/ghi đúng quyền; user khác property bị chặn.
- E2E: tạo booking -> check-in -> thêm dịch vụ -> thanh toán -> checkout -> housekeeping inspect -> phòng available.
- E2E finance: đặt cọc, thanh toán thiếu/đủ, invoice PDF, công nợ, night audit close.
- Performance target: 50 phòng, 20 nhân viên đồng thời, dashboard realtime cập nhật dưới 2 giây trong mạng ổn định.
- UAT pass khi lễ tân có thể vận hành một ngày thực tế không cần Excel phụ cho booking, phòng, check-in/out và folio.

## 9. Assumptions & Nguồn Tham Chiếu
- MVP chỉ phục vụ một khách sạn 50 phòng, một nhà hàng/sự kiện, vận hành nội bộ trước.
- UI tiếng Việt; dữ liệu khách hỗ trợ passport/quốc tịch để phục vụ khách nước ngoài, chưa làm đa ngôn ngữ UI.
- OTA, Booking Engine, payment gateway, hóa đơn điện tử, khóa từ đều là phase sau.
- Supabase project: `klmcoiyinztpajnnnzph`, region `ap-southeast-1` (Singapore).
- Tham chiếu tính năng thị trường từ [Blue Jay PMS article](https://bluejaypms.com/article/top-phan-mem-quan-ly-khach-san-376#table-of-contents-0), Supabase RLS/Realtime từ [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) và [Supabase Realtime](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes).
