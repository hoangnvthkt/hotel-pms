export type MetadataCategory =
  | 'guest_type'
  | 'stay_purpose'
  | 'booking_source'
  | 'folio_service_type'
  | 'payment_method'
  | 'hk_task_type'
  | 'bed_type'
  | 'room_feature'
  | 'rate_code'
  | 'cancellation_reason';

export const METADATA_CATEGORY_LABELS: Record<MetadataCategory, string> = {
  guest_type: 'Loại khách',
  stay_purpose: 'Mục đích lưu trú',
  booking_source: 'Nguồn đặt phòng',
  folio_service_type: 'Loại dịch vụ (Folio)',
  payment_method: 'Phương thức thanh toán',
  hk_task_type: 'Loại task HK',
  bed_type: 'Loại giường',
  room_feature: 'Tiện nghi / đặc điểm phòng',
  rate_code: 'Mã giá',
  cancellation_reason: 'Lý do hủy đặt phòng',
};

export interface MetadataOption {
  id: string;
  property_id: string;
  category: MetadataCategory;
  code: string;
  label: string;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
  system_locked: boolean;
  extra?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
