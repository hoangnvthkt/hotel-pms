# Luồng Vận Hành Hotel PMS — Grand Palace

Tài liệu này là nguồn tham chiếu nghiệp vụ cho MVP. UI, API, RLS và test phải bám theo các trạng thái và rule dưới đây.

## Vai Trò Và Quyền Chính

| Vai trò | Quyền chính |
|---|---|
| `admin` | Toàn quyền cấu hình, dữ liệu, báo cáo, night audit, override |
| `manager` | Dashboard, báo cáo, duyệt exception, chạy night audit |
| `receptionist` | Khách, booking, check-in/out, folio charge thủ công |
| `hk_supervisor` | Gán task, inspect/reject, lost & found |
| `hk_staff` | Xem/cập nhật task được giao |
| `accountant` | Payment finalized, invoice, refund, công nợ |

## Trạng Thái Chuẩn

### Booking Status

```text
tentative -> confirmed -> checked_in -> checked_out
tentative -> cancelled
confirmed -> cancelled
tentative/confirmed -> no_show
```

Rule:
- `tentative`: giữ chỗ, chưa có xác nhận chắc chắn.
- `confirmed`: đã xác nhận hoặc đã nhận cọc.
- `checked_in`: khách đang ở, phải có room assignment hợp lệ và folio mở.
- `checked_out`: khách đã rời, folio đã đóng hoặc đã chuyển công nợ.
- `cancelled`: booking bị hủy; deposit xử lý theo chính sách.
- `no_show`: khách không đến sau cutoff/night audit.

### Room Status

```text
vacant_clean -> occupied
occupied -> vacant_dirty
vacant_dirty -> inspected
inspected -> vacant_clean
inspected -> vacant_dirty
vacant_clean -> out_of_order
out_of_order -> vacant_dirty
vacant_clean -> blocked
blocked -> vacant_clean
occupied -> occupied_dirty
occupied_dirty -> occupied_clean
```

Rule:
- Check-in chỉ vào phòng `vacant_clean`, trừ manager/admin override.
- Checkout luôn chuyển phòng sang `vacant_dirty`.
- `out_of_order` và `blocked` không được bán trong availability.
- `in_progress` và `done` không phải Room Status; đó là trạng thái task HK.

### HK Task Status

```text
pending -> in_progress -> done -> inspected
done -> rejected -> pending
```

Rule:
- `hk_staff` chỉ cập nhật task được giao.
- `hk_supervisor` được assign, inspect, reject.
- Checkout tạo task `checkout_clean` tự động.

### Folio Status

```text
open -> closed -> invoiced
```

Rule:
- Balance = tổng debit - tổng credit.
- Chỉ payment/deposit `posted` hoặc `finalized` mới được tính vào credit.
- Chuyển khoản bắt đầu ở `pending_verification`; accountant/manager/admin xác nhận xong mới thành `posted`.
- Tiền mặt được `posted` ngay và gắn vào cashier session của người thu.
- Checkout chỉ được khi balance = 0, hoặc manager/accountant chuyển sang công nợ.
- Payment finalized chỉ accountant/admin được sửa hoặc void.
- Invoice tạo từ folio đã đóng.

### Payment Status

```text
draft -> pending_verification -> posted -> finalized
draft -> posted -> finalized
pending_verification -> voided
posted -> refunded
```

Rule:
- `cash`: receptionist/accountant ghi nhận là `posted` ngay, tạo receipt và đưa vào đối soát ca.
- `bank_transfer`: ghi nhận là `pending_verification`, chưa giảm balance cho tới khi được duyệt.
- Refund phải có request và được accountant/manager/admin approve.

## Vòng Đời Một Lượt Lưu Trú

1. Receptionist tạo hoặc nhận booking.
2. Hệ thống kiểm tra availability theo room type/date/occupancy/rate.
3. Booking được tạo ở `tentative` hoặc `confirmed`.
4. Nếu yêu cầu cọc: ghi nhận cọc tiền mặt hoặc chuyển khoản; chuyển khoản chờ xác nhận.
5. Ngày đến, receptionist xác minh giấy tờ và thông tin C65.
6. Check-in tạo folio master, chuyển booking `checked_in`, phòng `occupied`, apply cọc đã posted/finalized.
7. Trong lúc ở, dịch vụ phát sinh được ghi vào folio.
8. Checkout kiểm tra balance, pending transfer, refund/công nợ, đóng folio.
9. Checkout chuyển phòng `vacant_dirty` và tạo HK task.
10. HK dọn phòng, supervisor inspect, phòng trở lại `vacant_clean`.
11. Night audit cuối ngày post room charges, xử lý no-show/discrepancy, lock business date.

## Exception Flow Bắt Buộc

- Hủy booking: ghi reason, xử lý deposit giữ/hoàn, không xóa lịch sử.
- No-show: áp dụng cho `tentative` và `confirmed` khi quá cutoff.
- Đổi phòng: kiểm tra conflict, ghi audit log và lịch sử booking room.
- Đổi ngày: chạy lại availability trước khi lưu.
- Early check-in/late check-out/extra bed: ghi thành folio charge.
- Checkout còn nợ: chặn nếu không có quyền chuyển công nợ.
- Ngày đã audit: không cho sửa dữ liệu vận hành nếu không có override.

## C65 / Khai Báo Lưu Trú

Các trường bắt buộc:
- Họ tên, ngày sinh, giới tính, quốc tịch
- CCCD/Passport, ngày cấp, nơi cấp
- Nghề nghiệp, nơi ở hiện tại
- Thời gian lưu trú, lý do lưu trú

## Night Audit Chuẩn

1. Pre-check: arrivals chưa xử lý, departures, no-show, dirty/HK task, folio balance.
2. Post room charges cho booking `checked_in`.
3. Recalculate revenue: room, service, payment.
4. Detect discrepancies: folio, payment, invoice, công nợ.
5. Lock business date và roll sang ngày mới.

## Acceptance Scenarios

- Tạo booking -> check-in -> thêm charge -> thanh toán -> checkout -> HK inspect -> phòng available.
- Walk-in same-day tạo booking và check-in trong cùng luồng.
- Booking no-show được xử lý trong night audit.
- Double-book cùng phòng/cùng khoảng ngày bị chặn ở DB.
- Phòng `occupied`, `out_of_order`, `blocked` không xuất hiện trong availability.
- C65 export có đủ trường bắt buộc.
