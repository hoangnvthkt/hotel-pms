import type { MetadataCategory, MetadataOption } from '@/types/metadata';

const now = '2026-05-09T00:00:00.000Z';

const seed: Record<MetadataCategory, Array<{ code: string; label: string; description?: string }>> = {
  guest_type: [
    { code: 'standard', label: 'Khách thường' },
    { code: 'vip', label: 'VIP' },
    { code: 'corporate', label: 'Công ty' },
  ],
  stay_purpose: [
    { code: 'business', label: 'Công tác' },
    { code: 'leisure', label: 'Du lịch' },
    { code: 'family', label: 'Gia đình' },
  ],
  booking_source: [
    { code: 'direct', label: 'Trực tiếp' },
    { code: 'phone', label: 'Điện thoại' },
    { code: 'ota_manual', label: 'OTA' },
    { code: 'facebook', label: 'Facebook' },
  ],
  folio_service_type: [
    { code: 'manual_service', label: 'Dịch vụ thủ công' },
    { code: 'minibar', label: 'Minibar' },
    { code: 'laundry', label: 'Giặt là' },
  ],
  payment_method: [
    { code: 'cash', label: 'Tiền mặt' },
    { code: 'bank_transfer', label: 'Chuyển khoản' },
    { code: 'qr_manual', label: 'QR thủ công' },
  ],
  hk_task_type: [
    { code: 'checkout_clean', label: 'Dọn checkout' },
    { code: 'daily_service', label: 'Dọn hằng ngày' },
    { code: 'deep_clean', label: 'Tổng vệ sinh' },
  ],
  bed_type: [
    { code: 'double', label: 'Giường đôi' },
    { code: 'queen', label: 'Giường Queen' },
    { code: 'king', label: 'Giường King' },
    { code: 'twin', label: '2 giường đơn' },
    { code: 'king_sofa', label: 'Giường King + Sofa bed' },
    { code: 'family', label: 'Giường King + 2 Giường đôi' },
  ],
  room_feature: [
    { code: 'wifi', label: 'WiFi' },
    { code: 'tv', label: 'TV' },
    { code: 'aircon', label: 'Điều hòa' },
    { code: 'minibar', label: 'Minibar' },
    { code: 'safe', label: 'Két an toàn' },
    { code: 'city_view', label: 'View thành phố' },
    { code: 'pool_view', label: 'View hồ bơi' },
    { code: 'bathtub', label: 'Bồn tắm' },
    { code: 'living_room', label: 'Phòng khách riêng' },
    { code: 'kitchenette', label: 'Bếp nhỏ' },
    { code: 'terrace', label: 'Sân thượng riêng' },
    { code: 'jacuzzi', label: 'Bồn tắm jacuzzi' },
  ],
  rate_code: [
    { code: 'BAR', label: 'Best Available Rate' },
    { code: 'WALK', label: 'Walk-in Rate' },
    { code: 'CORP', label: 'Corporate Rate' },
    { code: 'SEASONAL', label: 'Seasonal Rate' },
  ],
  cancellation_reason: [
    { code: 'guest_request', label: 'Khách yêu cầu' },
    { code: 'no_deposit', label: 'Chưa đặt cọc' },
    { code: 'duplicate', label: 'Đặt trùng' },
  ],
};

export const mockMetadataOptions: MetadataOption[] = Object.entries(seed).flatMap(([category, options]) =>
  options.map((option, index) => ({
    id: `meta-${category}-${option.code}`,
    property_id: 'prop-001',
    category: category as MetadataCategory,
    code: option.code,
    label: option.label,
    description: option.description ?? null,
    sort_order: index,
    is_active: true,
    system_locked: false,
    extra: null,
    created_at: now,
    updated_at: now,
  })),
);
