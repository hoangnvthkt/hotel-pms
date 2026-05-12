const messageMap: Array<[RegExp, string]> = [
  [/permission denied for schema private/i, 'Backend thiếu quyền helper private. Cần chạy migration grant quyền trước khi thao tác.'],
  [/not allowed to create bookings/i, 'Tài khoản không có quyền tạo booking.'],
  [/invalid property/i, 'Tài khoản hoặc dữ liệu đang lệch khách sạn. Vui lòng tải lại trang rồi thử lại.'],
  [/invalid input syntax for type uuid/i, 'Không xác định được khách sạn hợp lệ. Vui lòng tải lại trang rồi thử lại.'],
  [/guests_property_id_document_type_document_number_key/i, 'Khách có loại giấy tờ và số giấy tờ này đã tồn tại.'],
  [/guests_c65_identity_ready/i, 'Cần đủ trường C65: ngày sinh, giới tính, ngày/nơi cấp, nghề nghiệp, địa chỉ và lý do lưu trú.'],
  [/guests_property_id_fkey/i, 'Khách sạn của hồ sơ khách không tồn tại hoặc tài khoản đang lệch khách sạn.'],
  [/room is not available/i, 'Phòng không còn trống trong khoảng ngày đã chọn.'],
  [/room not found/i, 'Không tìm thấy phòng trong khách sạn hiện tại.'],
  [/check-out must be after check-in/i, 'Ngày check-out phải sau check-in.'],
  [/pending bank transfers must be verified/i, 'Còn chuyển khoản chờ xác nhận. Kế toán/quản lý cần duyệt trước khi checkout.'],
  [/night audit blocked by pre-check/i, 'Night Audit đang bị chặn bởi pre-check. Cần xử lý checkout đến hạn, folio còn nợ, chuyển khoản chờ xác nhận hoặc housekeeping task còn mở trước khi đóng ngày.'],
  [/business date .* already closed/i, 'Ngày kinh doanh này đã đóng, không thể chạy Night Audit lại.'],
  [/business date .* is not open/i, 'Ngày kinh doanh này không ở trạng thái mở. Vui lòng tải lại Night Audit.'],
  [/not allowed to run night audit/i, 'Chỉ quản lý hoặc admin được chạy Night Audit.'],
  [/only accountant\/manager\/admin can verify/i, 'Chỉ kế toán, quản lý hoặc admin được xác nhận giao dịch.'],
  [/folio balance must be zero/i, 'Folio chưa cân bằng. Cần thu đủ tiền hoặc chuyển công nợ đúng quyền.'],
  [/reject note is required/i, 'Cần nhập lý do từ chối task housekeeping.'],
  [/not allowed to assign housekeeping tasks/i, 'Tài khoản không có quyền giao task housekeeping.'],
  [/hk staff can only update assigned tasks/i, 'Nhân viên housekeeping chỉ được cập nhật task được giao.'],
  [/only supervisor\/manager\/admin can inspect or reject/i, 'Chỉ giám sát, quản lý hoặc admin được duyệt/từ chối task.'],
  [/invalid hk task transition/i, 'Chuyển trạng thái housekeeping không hợp lệ.'],
  [/exclusion constraint|booking_rooms.*overlap|room.*already booked|room.*not available/i, 'Phòng đã có booking trùng thời gian.'],
  [/duplicate key|conflicting key value/i, 'Dữ liệu đã tồn tại. Vui lòng kiểm tra lại thông tin vừa nhập.'],
  [/row-level security/i, 'Không đủ quyền RLS để thực hiện thao tác này.'],
];

export function errorMessage(error: unknown, fallback = 'Có lỗi xảy ra.'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return mapMessage(error.message || fallback);

  const record = error as Record<string, unknown>;
  const raw = [record.message, record.details, record.hint, record.code]
    .filter(Boolean)
    .map(String)
    .join(' · ');

  return mapMessage(raw || fallback);
}

export function toError(error: unknown, fallback = 'Có lỗi xảy ra.'): Error {
  return error instanceof Error ? error : new Error(errorMessage(error, fallback));
}

function mapMessage(message: string): string {
  const mapped = messageMap.find(([pattern]) => pattern.test(message));
  return mapped?.[1] ?? message;
}
