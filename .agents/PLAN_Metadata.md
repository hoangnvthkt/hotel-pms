# Plan: Settings Metadata + Staff/RBAC Management

## Summary
Triển khai phần `Cài đặt` theo hướng hybrid đã chọn: dữ liệu nghiệp vụ chính giữ bảng riêng (`room_types`, `room_rates`, `roles`, `profiles`, `profile_roles`), còn các danh mục cấu hình như loại khách, lý do lưu trú, nguồn booking, loại dịch vụ dùng bảng `metadata_options` có RLS, constraint và test riêng. Module nhân viên dùng Supabase Auth thật qua Edge Function invite/create user, không đưa `service_role` lên frontend.

## Key Changes

- Thêm migration `metadata_options`:
  - Bảng `metadata_options`: `property_id`, `category`, `code`, `label`, `description`, `sort_order`, `is_active`, `system_locked`, `extra jsonb`, timestamps.
  - Categories MVP: `guest_type`, `stay_purpose`, `booking_source`, `folio_service_type`, `payment_method`, `hk_task_type`, `room_feature`, `cancellation_reason`.
  - Unique `(property_id, category, code)`, label/code không rỗng, chỉ admin/manager được ghi, authenticated cùng property được đọc.
  - Không hard-delete option đã dùng; UI dùng deactivate.

- Gắn metadata vào luồng dữ liệu:
  - `guests` thêm `guest_type_option_id`; trigger/check đảm bảo option cùng `property_id` và category `guest_type`.
  - Booking form đọc `booking_source` từ metadata nhưng vẫn map về enum/code hiện có để không phá schema booking.
  - Folio manual charge đọc `folio_service_type`; payment UI đọc `payment_method`.
  - HK task tạo nhanh từ `hk_task_type`; room detail hiển thị `room_feature` qua `extra` hoặc bảng nối nếu cần mở rộng sau.

- Hoàn thiện Settings UI:
  - Thay `/settings` placeholder bằng `SettingsPage` có tabs: `Danh mục`, `Loại phòng & giá`, `Nhân viên`, `Khách sạn`.
  - Tab `Danh mục`: CRUD/deactivate/reorder metadata theo category, validate code slug, không cho sửa `code/category` của option đã system-lock.
  - Tab `Loại phòng & giá`: CRUD `room_types`, `room_rates` bằng bảng hiện có, có guard không xóa room type đang có phòng.
  - Data layer thêm query keys: `metadataOptions`, `roomTypes`, `roomRates`, `staff`, `roles`, targeted invalidation sau mutation.

- Thêm module nhân viên và phân quyền:
  - Frontend type `User` chuyển từ một `role` sang `roles: UserRole[]`, giữ `primaryRole` để tương thích UI hiện tại.
  - `rbac.ts` đổi `hasPermission`/`canAccessPath` sang kiểm tra nhiều role.
  - Bảng `profiles/profile_roles` chỉ cho ghi qua RPC hoặc Edge Function, không mở CRUD trực tiếp bừa bãi.
  - RPC tối thiểu: `fn_update_staff_profile`, `fn_set_staff_roles`, `fn_deactivate_staff`, tất cả ghi `audit_logs`.
  - Quyền: `admin` quản lý mọi nhân viên/role; `manager` chỉ quản lý `receptionist`, `hk_supervisor`, `hk_staff`, không cấp/gỡ `admin`, `manager`, `accountant`.

- Tạo Edge Function `invite-staff`:
  - Frontend gửi email, tên, điện thoại, roles, property.
  - Function dùng service role server-side để invite/create Supabase Auth user, tạo/cập nhật `profiles`, gán `profile_roles`.
  - Không expose service role ra client; function kiểm tra caller là `admin` hoặc `manager` theo DB helper, không dựa vào `user_metadata`.

## Public Interfaces & Types

- Thêm types:
  - `MetadataCategory`
  - `MetadataOption`
  - `StaffProfile`
  - `StaffStatus`
  - `RoleAssignment`
- Thêm data functions:
  - `fetchMetadataOptions(category?)`
  - `createMetadataOption`
  - `updateMetadataOption`
  - `deactivateMetadataOption`
  - `fetchStaffProfiles`
  - `inviteStaff`
  - `updateStaffProfile`
  - `setStaffRoles`
  - `deactivateStaff`
- Auth context trả về user có `roles`, `primaryRole`, `permissions`, `isActive`; user inactive không được vào app dù Auth session còn hợp lệ.

## Test Plan

- Database tests:
  - Duplicate metadata `(property_id, category, code)` bị reject.
  - User property A không đọc/ghi metadata property B.
  - Option `system_locked` không bị deactivate/sửa code.
  - `guest_type_option_id` sai property hoặc sai category bị reject.
  - Manager không thể cấp role `admin/accountant/manager`.
  - Duplicate role assignment bị reject.
  - Inactive staff không pass helper `current_property_id`.

- Frontend tests:
  - `/settings` chỉ hiện với role có `settings:manage`.
  - Danh mục tạo/sửa/deactivate xong invalidate đúng query.
  - Staff invite hiển thị lỗi rõ khi email trùng hoặc role không hợp lệ.
  - RBAC nhiều role: user có `receptionist + accountant` thấy cả reception và payment/report quyền tương ứng.

- Verification:
  - `supabase test db`
  - `npm test`
  - `npm run build`
  - Sau migration chạy advisors/lint nếu CLI hỗ trợ.
  - Smoke flow: tạo loại khách -> tạo khách với loại đó -> invite nhân viên lễ tân -> đăng nhập user đó -> chỉ thấy đúng menu/action.

## Assumptions

- Dùng phương án hybrid chuẩn và invite Supabase Auth qua Edge Function như anh đã chọn.
- Không reset remote DB; mọi thay đổi là migration forward-only.
- `room_types`, `room_rates`, `profiles`, `roles`, `profile_roles` vẫn là nguồn dữ liệu chính, không nhét các bảng này vào JSON settings.
- Production vẫn dùng RLS/RPC/Edge Function làm lớp bảo vệ chính; frontend RBAC chỉ để ẩn/hiện UX.
