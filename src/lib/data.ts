import { queryKeys } from '@/lib/queryClient';
import { toError } from '@/lib/errors';
import { requireSupabaseClient, supabase } from '@/lib/supabase';
import { mockBookings } from '@/mock/bookings';
import { mockGuests } from '@/mock/guests';
import { mockHKTasks, mockLostFound } from '@/mock/housekeeping';
import { mockMetadataOptions } from '@/mock/metadata';
import { mockDashboardStats } from '@/mock/reports';
import { mockRoomRates, mockRooms, mockRoomTypes } from '@/mock/rooms';
import { mockCredentials, mockUsers } from '@/mock/users';
import type {
  Booking,
  BookingDeposit,
  BookingService,
  BookingSource,
  BookingStatus,
  BusinessDate,
  CashierSession,
  DashboardStats,
  Folio,
  FolioItem,
  FolioItemSourceType,
  Guest,
  GuestRequest,
  GuestRequestComment,
  GuestRequestEvent,
  GuestRequestSource,
  GuestRequestStatus,
  GuestRequestType,
  HKTask,
  HKTaskStatus,
  LostFoundItem,
  NightAuditIssue,
  NightAuditLog,
  NightAuditPrecheck,
  NightAuditRunResult,
  Notification,
  Payment,
  PaymentMethod,
  PaymentVerificationItem,
  Receipt,
  Room,
  RoomRate,
  RoomStatus,
  RoomType,
} from '@/types';

export const useMocks =
  import.meta.env.VITE_USE_MOCKS === 'true' ||
  !supabase;

export { queryKeys };

const newId = (prefix: string) =>
  `${prefix}-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;

type GuestRow = Record<string, any>;

function mapGuest(row: GuestRow): Guest {
  return {
    id: row.id,
    propertyId: row.property_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    email: row.email ?? undefined,
    phone: row.phone,
    nationality: row.nationality,
    documentType: row.document_type,
    documentNumber: row.document_number,
    documentIssueDate: row.document_issue_date ?? undefined,
    documentIssuePlace: row.document_issue_place ?? undefined,
    dateOfBirth: row.date_of_birth ?? undefined,
    gender: row.gender ?? undefined,
    occupation: row.occupation ?? undefined,
    currentAddress: row.current_address ?? undefined,
    stayPurpose: row.stay_purpose ?? undefined,
    marketingConsent: row.marketing_consent,
    isVip: row.is_vip,
    isBlacklisted: row.is_blacklisted,
    blacklistReason: row.blacklist_reason ?? undefined,
    loyaltyCode: row.loyalty_code ?? undefined,
    notes: row.notes ?? undefined,
    totalStays: row.total_stays,
    totalSpent: row.total_spent,
    createdAt: row.created_at,
  };
}

function guestToRow(input: GuestMutationInput) {
  const fullName = `${input.lastName} ${input.firstName}`.trim();
  return {
    property_id: input.propertyId,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    full_name: input.fullName?.trim() || fullName,
    email: input.email?.trim() || null,
    phone: input.phone.trim(),
    nationality: input.nationality.trim(),
    document_type: input.documentType,
    document_number: input.documentNumber.trim(),
    document_issue_date: input.documentIssueDate || null,
    document_issue_place: input.documentIssuePlace?.trim() || null,
    date_of_birth: input.dateOfBirth || null,
    gender: input.gender || null,
    occupation: input.occupation?.trim() || null,
    current_address: input.currentAddress?.trim() || null,
    stay_purpose: input.stayPurpose?.trim() || null,
    marketing_consent: Boolean(input.marketingConsent),
    is_vip: Boolean(input.isVip),
    is_blacklisted: Boolean(input.isBlacklisted),
    blacklist_reason: input.blacklistReason?.trim() || null,
    loyalty_code: input.loyaltyCode?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

function mapBooking(row: any): Booking {
  const assigned = row.booking_rooms?.[0];
  return {
    id: row.id,
    bookingNumber: row.booking_number,
    propertyId: row.property_id,
    guestId: row.guest_id,
    guestName: row.guests?.full_name ?? 'Không rõ',
    guestPhone: row.guests?.phone ?? '',
    roomId: assigned?.room_id ?? '',
    roomNumber: assigned?.rooms?.number ?? '—',
    roomTypeName: assigned?.rooms?.room_types?.name ?? 'Chưa gán',
    checkIn: row.check_in?.slice(0, 10),
    checkOut: row.check_out?.slice(0, 10),
    nights: row.nights,
    adults: row.adults,
    children: row.children,
    status: row.status,
    source: row.source,
    rateCode: row.rate_code,
    ratePerNight: Number(row.rate_per_night),
    totalAmount: Number(row.total_amount),
    depositAmount: Number(row.deposit_amount),
    depositPaid: row.deposit_paid,
    externalReference: row.external_reference ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by ?? '',
  };
}

function mapBookingService(row: any): BookingService {
  return {
    id: row.id,
    propertyId: row.property_id,
    bookingId: row.booking_id,
    serviceCode: row.service_code,
    serviceName: row.service_name,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount),
    serviceDate: row.service_date ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
  };
}

function mapNotification(row: any): Notification {
  return {
    id: row.id,
    propertyId: row.property_id,
    recipientId: row.recipient_id,
    actorId: row.actor_id ?? undefined,
    actorName: row.actor?.full_name ?? undefined,
    type: row.type,
    severity: row.severity,
    title: row.title,
    body: row.body ?? undefined,
    entityType: row.entity_type ?? undefined,
    entityId: row.entity_id ?? undefined,
    actionUrl: row.action_url ?? undefined,
    readAt: row.read_at ?? undefined,
    dismissedAt: row.dismissed_at ?? undefined,
    createdAt: row.created_at,
  };
}

function mapLostFound(row: any): LostFoundItem {
  return {
    id: row.id,
    propertyId: row.property_id,
    roomId: row.room_id ?? undefined,
    roomNumber: row.rooms?.number ?? undefined,
    floor: row.rooms?.floor ?? undefined,
    guestId: row.guest_id ?? undefined,
    guestName: row.guests?.full_name ?? undefined,
    description: row.description,
    foundBy: row.found_by_profile?.full_name ?? row.foundBy ?? undefined,
    foundAt: row.found_at,
    status: row.status,
    storageLocation: row.storage_location ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function mapGuestRequestComment(row: any): GuestRequestComment {
  return {
    id: row.id,
    propertyId: row.property_id,
    requestId: row.request_id,
    comment: row.comment,
    isInternal: row.is_internal,
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_profile?.full_name ?? undefined,
    createdAt: row.created_at,
  };
}

function mapGuestRequestEvent(row: any): GuestRequestEvent {
  return {
    id: row.id,
    propertyId: row.property_id,
    requestId: row.request_id,
    eventType: row.event_type,
    oldStatus: row.old_status ?? undefined,
    newStatus: row.new_status ?? undefined,
    payload: row.payload ?? {},
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  };
}

function mapGuestRequest(row: any): GuestRequest {
  const comments = row.guest_request_comments ?? [];
  const events = row.guest_request_events ?? [];
  return {
    id: row.id,
    propertyId: row.property_id,
    requestNumber: row.request_number,
    type: row.type,
    status: row.status,
    priority: row.priority,
    source: row.source,
    title: row.title,
    description: row.description ?? undefined,
    bookingId: row.booking_id ?? undefined,
    bookingNumber: row.bookings?.booking_number ?? undefined,
    guestId: row.guest_id ?? undefined,
    guestName: row.guests?.full_name ?? undefined,
    guestPhone: row.guests?.phone ?? undefined,
    roomId: row.room_id ?? undefined,
    roomNumber: row.rooms?.number ?? undefined,
    department: row.department,
    assignedTo: row.assigned_to ?? undefined,
    assignedToName: row.assigned?.full_name ?? undefined,
    dueAt: row.due_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    closedAt: row.closed_at ?? undefined,
    resolution: row.resolution ?? undefined,
    compensationAmount: Number(row.compensation_amount ?? 0),
    folioItemId: row.folio_item_id ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_profile?.full_name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: comments.map(mapGuestRequestComment).sort((a: GuestRequestComment, b: GuestRequestComment) => b.createdAt.localeCompare(a.createdAt)),
    events: events.map(mapGuestRequestEvent).sort((a: GuestRequestEvent, b: GuestRequestEvent) => b.createdAt.localeCompare(a.createdAt)),
  };
}

function mapPayment(row: any): Payment {
  return {
    id: row.id,
    propertyId: row.property_id,
    folioId: row.folio_id,
    method: row.method,
    status: row.status,
    amount: Number(row.amount),
    reference: row.reference ?? undefined,
    evidencePath: row.evidence_path ?? undefined,
    receiptNumber: row.receipt_number ?? undefined,
    cashierSessionId: row.cashier_session_id ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
    verifiedBy: row.verified_by ?? undefined,
    receivedAt: row.received_at,
    receivedBy: row.received_by ?? '',
  };
}

function mapBookingDeposit(row: any): BookingDeposit {
  return {
    id: row.id,
    propertyId: row.property_id,
    bookingId: row.booking_id,
    amount: Number(row.amount),
    method: row.method,
    status: row.status ?? 'posted',
    reference: row.reference ?? undefined,
    evidencePath: row.evidence_path ?? undefined,
    receiptNumber: row.receipt_number ?? undefined,
    cashierSessionId: row.cashier_session_id ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
    verifiedBy: row.verified_by ?? undefined,
    receivedAt: row.received_at,
    receivedBy: row.received_by ?? undefined,
  };
}

function mapReceipt(row: any): Receipt {
  return {
    id: row.id,
    propertyId: row.property_id,
    receiptNumber: row.receipt_number,
    receiptType: row.receipt_type,
    bookingId: row.booking_id ?? undefined,
    folioId: row.folio_id ?? undefined,
    paymentId: row.payment_id ?? undefined,
    bookingDepositId: row.booking_deposit_id ?? undefined,
    refundId: row.refund_id ?? undefined,
    amount: Number(row.amount),
    method: row.method ?? undefined,
    status: row.status,
    pdfUrl: row.pdf_url ?? undefined,
    issuedAt: row.issued_at,
    issuedBy: row.issued_by ?? undefined,
  };
}

function mapBusinessDate(row: any): BusinessDate {
  return {
    id: row.id,
    propertyId: row.property_id,
    businessDate: row.business_date,
    status: row.status,
    closedAt: row.closed_at ?? undefined,
    closedBy: row.closed_by ?? undefined,
  };
}

function mapNightAuditIssue(row: any): NightAuditIssue {
  return {
    bookingId: row.booking_id ?? undefined,
    bookingNumber: row.booking_number ?? undefined,
    folioId: row.folio_id ?? undefined,
    folioNumber: row.folio_number ?? undefined,
    paymentId: row.payment_id ?? undefined,
    depositId: row.deposit_id ?? undefined,
    taskId: row.task_id ?? undefined,
    guestName: row.guest_name ?? undefined,
    roomNumber: row.room_number ?? undefined,
    status: row.status ?? undefined,
    amount: typeof row.amount === 'undefined' ? undefined : Number(row.amount),
    balance: typeof row.balance === 'undefined' ? undefined : Number(row.balance),
    date: row.date ?? undefined,
    label: row.label ?? undefined,
  };
}

function mapNightAuditPrecheck(row: any): NightAuditPrecheck {
  const summary = row?.summary ?? {};
  const blockers = row?.blockers ?? {};
  const warnings = row?.warnings ?? {};
  const list = (value: unknown) => Array.isArray(value) ? value.map(mapNightAuditIssue) : [];
  return {
    businessDate: row.business_date,
    status: row.status ?? undefined,
    isClosed: Boolean(row.is_closed),
    canRun: Boolean(row.can_run),
    blockersCount: Number(row.blockers_count ?? 0),
    warningsCount: Number(row.warnings_count ?? 0),
    summary: {
      openDepartures: Number(summary.open_departures ?? 0),
      unpaidFolios: Number(summary.unpaid_folios ?? 0),
      pendingPayments: Number(summary.pending_payments ?? 0),
      pendingDeposits: Number(summary.pending_deposits ?? 0),
      openHousekeepingTasks: Number(summary.open_housekeeping_tasks ?? 0),
      noShowCandidates: Number(summary.no_show_candidates ?? 0),
      roomChargeCandidates: Number(summary.room_charge_candidates ?? 0),
      roomChargeTotal: Number(summary.room_charge_total ?? 0),
    },
    blockers: {
      openDepartures: list(blockers.open_departures),
      unpaidFolios: list(blockers.unpaid_folios),
      pendingPayments: list(blockers.pending_payments),
      pendingDeposits: list(blockers.pending_deposits),
      openHousekeepingTasks: list(blockers.open_housekeeping_tasks),
    },
    warnings: {
      noShowCandidates: list(warnings.no_show_candidates),
    },
  };
}

function mapNightAuditLog(row: any): NightAuditLog {
  return {
    id: row.id,
    propertyId: row.property_id,
    businessDate: row.business_date,
    step: row.step,
    summary: row.summary ?? {},
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_profile?.full_name ?? undefined,
    createdAt: row.created_at,
  };
}

function mapNightAuditRunResult(row: any): NightAuditRunResult {
  return {
    precheck: row.precheck ? mapNightAuditPrecheck(row.precheck) : undefined,
    postedRoomCharges: Number(row.posted_room_charges ?? 0),
    noShowBookings: Number(row.no_show_bookings ?? 0),
    roomRevenue: Number(row.room_revenue ?? 0),
    serviceRevenue: Number(row.service_revenue ?? 0),
    payments: Number(row.payments ?? 0),
    lockedBusinessDate: row.locked_business_date,
    nextBusinessDate: row.next_business_date,
  };
}

function mapRoomType(row: any): RoomType {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    code: row.code,
    maxOccupancy: Number(row.max_occupancy),
    bedType: row.bed_type,
    area: Number(row.area ?? 0),
    amenities: row.amenities ?? [],
    description: row.description ?? '',
    basePrice: Number(row.base_price),
  };
}

function mapRoom(row: any): Room {
  return {
    id: row.id,
    propertyId: row.property_id,
    roomTypeId: row.room_type_id,
    roomTypeName: row.room_types?.name ?? 'Không rõ',
    number: row.number,
    floor: row.floor,
    status: row.status,
    isActive: row.is_active,
    notes: row.notes ?? undefined,
    lastCleaned: row.last_cleaned_at ?? undefined,
  };
}

export async function fetchRooms(): Promise<Room[]> {
  if (useMocks) return mockRooms;
  const { data, error } = await requireSupabaseClient()
    .from('rooms')
    .select('*, room_types(name)')
    .order('number', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRoom);
}

export async function fetchRoomTypes(): Promise<RoomType[]> {
  if (useMocks) return mockRoomTypes;
  const { data, error } = await requireSupabaseClient().from('room_types').select('*').order('code');
  if (error) throw error;
  return (data ?? []).map(mapRoomType);
}

export async function checkAvailability(
  propertyId: string,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
): Promise<Room[]> {
  if (checkOut <= checkIn) return [];
  if (useMocks) {
    return mockRooms.filter(room =>
      room.propertyId === propertyId &&
      room.roomTypeId === roomTypeId &&
      room.isActive &&
      !['occupied', 'occupied_dirty', 'occupied_clean', 'out_of_order', 'blocked'].includes(room.status) &&
      !mockBookings.some(booking =>
        booking.roomId === room.id &&
        ['tentative', 'confirmed', 'checked_in'].includes(booking.status) &&
        booking.checkIn < checkOut &&
        booking.checkOut > checkIn,
      ),
    );
  }

  const { data, error } = await requireSupabaseClient().rpc('fn_check_availability', {
    p_property_id: propertyId,
    p_room_type_id: roomTypeId,
    p_check_in: `${checkIn}T14:00:00+07:00`,
    p_check_out: `${checkOut}T12:00:00+07:00`,
  });
  if (error) throw toError(error, 'Không kiểm tra được phòng trống.');
  return (data ?? []).map(mapRoom);
}

export type RoomTypeMutationInput = {
  propertyId: string;
  name: string;
  code: string;
  maxOccupancy: number;
  bedType: string;
  area?: number;
  amenities?: string[];
  description?: string;
  basePrice: number;
};

function roomTypeToRow(input: RoomTypeMutationInput) {
  return {
    property_id: input.propertyId,
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    max_occupancy: input.maxOccupancy,
    bed_type: input.bedType.trim(),
    area: typeof input.area === 'number' && Number.isFinite(input.area) ? input.area : null,
    amenities: input.amenities ?? [],
    description: input.description?.trim() || null,
    base_price: input.basePrice,
  };
}

function roomTypeUpdateToRow(input: Omit<RoomTypeMutationInput, 'propertyId'>) {
  return {
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    max_occupancy: input.maxOccupancy,
    bed_type: input.bedType.trim(),
    area: typeof input.area === 'number' && Number.isFinite(input.area) ? input.area : null,
    amenities: input.amenities ?? [],
    description: input.description?.trim() || null,
    base_price: input.basePrice,
  };
}

export async function createRoomType(input: RoomTypeMutationInput): Promise<RoomType> {
  const row = roomTypeToRow(input);
  if (useMocks) {
    const created = mapRoomType({ id: newId('rt'), ...row });
    mockRoomTypes.push(created);
    return created;
  }

  const { data, error } = await requireSupabaseClient()
    .from('room_types')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return mapRoomType(data);
}

export async function updateRoomType(id: string, input: Omit<RoomTypeMutationInput, 'propertyId'>): Promise<void> {
  const row = roomTypeUpdateToRow(input);
  if (useMocks) {
    const idx = mockRoomTypes.findIndex(rt => rt.id === id);
    if (idx >= 0) {
      const updated = { ...mockRoomTypes[idx], ...mapRoomType({ id, property_id: mockRoomTypes[idx].propertyId, ...row }) };
      mockRoomTypes[idx] = updated;
      mockRooms.forEach(room => {
        if (room.roomTypeId === id) room.roomTypeName = updated.name;
      });
    }
    return;
  }

  const { error } = await requireSupabaseClient()
    .from('room_types')
    .update(row)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteRoomType(id: string): Promise<void> {
  if (useMocks) {
    if (mockRooms.some(room => room.roomTypeId === id)) {
      throw new Error('Không thể xóa loại phòng đang có phòng sử dụng.');
    }
    const idx = mockRoomTypes.findIndex(rt => rt.id === id);
    if (idx >= 0) mockRoomTypes.splice(idx, 1);
    for (let i = mockRoomRates.length - 1; i >= 0; i--) {
      if (mockRoomRates[i].roomTypeId === id) mockRoomRates.splice(i, 1);
    }
    return;
  }

  const client = requireSupabaseClient();
  const { count, error: countError } = await client
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('room_type_id', id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) throw new Error('Không thể xóa loại phòng đang có phòng sử dụng.');

  const { error } = await client.from('room_types').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchBookings(): Promise<Booking[]> {
  if (useMocks) return mockBookings;
  const { data, error } = await requireSupabaseClient()
    .from('bookings')
    .select('*, guests(full_name, phone), booking_rooms(room_id, rooms(number, room_types(name)))')
    .order('check_in', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapBooking);
}

export async function fetchGuests(): Promise<Guest[]> {
  if (useMocks) return mockGuests;
  const { data, error } = await requireSupabaseClient().from('guests').select('*').order('full_name');
  if (error) throw error;
  return (data ?? []).map(mapGuest);
}

export async function fetchHKTasks(): Promise<HKTask[]> {
  if (useMocks) return mockHKTasks;
  const { data, error } = await requireSupabaseClient()
    .from('housekeeping_tasks')
    .select('*, rooms(number, floor), assigned:profiles!housekeeping_tasks_assigned_to_fkey(full_name), inspector:profiles!housekeeping_tasks_inspector_id_fkey(full_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    propertyId: row.property_id,
    roomId: row.room_id,
    roomNumber: row.rooms?.number ?? '—',
    floor: row.rooms?.floor ?? 0,
    taskType: row.task_type,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to ?? undefined,
    assignedToName: row.assigned?.full_name ?? undefined,
    notes: row.notes ?? undefined,
    inspectorId: row.inspector_id ?? undefined,
    inspectorName: row.inspector?.full_name ?? undefined,
    inspectionNotes: row.inspection_notes ?? undefined,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    inspectedAt: row.inspected_at ?? undefined,
  }));
}

const mockNotifications: Notification[] = [
  {
    id: 'ntf-001',
    propertyId: 'prop-001',
    recipientId: 'user-005',
    type: 'housekeeping',
    severity: 'warning',
    title: 'Task Housekeeping chờ kiểm tra',
    body: 'Phòng 103 đã hoàn thành và chờ duyệt.',
    entityType: 'housekeeping_task',
    entityId: 'hk-003',
    actionUrl: '/housekeeping',
    createdAt: new Date().toISOString(),
  },
];

export async function fetchNotifications(limit = 15): Promise<Notification[]> {
  if (useMocks) {
    const user = currentMockUser();
    return mockNotifications
      .filter(item => item.recipientId === user.id && !item.dismissedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  const { data, error } = await requireSupabaseClient()
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(full_name)')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw toError(error, 'Không tải được thông báo.');
  return (data ?? []).map(mapNotification);
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  if (useMocks) {
    const user = currentMockUser();
    return mockNotifications.filter(item => item.recipientId === user.id && !item.readAt && !item.dismissedAt).length;
  }

  const { count, error } = await requireSupabaseClient()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .is('dismissed_at', null);
  if (error) throw toError(error, 'Không tải được số thông báo.');
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (useMocks) {
    const item = mockNotifications.find(notification => notification.id === id);
    if (item) item.readAt = new Date().toISOString();
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_mark_notification_read', {
    p_notification_id: id,
  });
  if (error) throw toError(error, 'Không đánh dấu đã đọc được thông báo.');
}

export async function markAllNotificationsRead(): Promise<void> {
  if (useMocks) {
    const user = currentMockUser();
    mockNotifications.forEach(item => {
      if (item.recipientId === user.id && !item.readAt) item.readAt = new Date().toISOString();
    });
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_mark_all_notifications_read');
  if (error) throw toError(error, 'Không đánh dấu đã đọc được thông báo.');
}

export async function dismissNotification(id: string): Promise<void> {
  if (useMocks) {
    const item = mockNotifications.find(notification => notification.id === id);
    if (item) {
      item.readAt = item.readAt ?? new Date().toISOString();
      item.dismissedAt = new Date().toISOString();
    }
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_dismiss_notification', {
    p_notification_id: id,
  });
  if (error) throw toError(error, 'Không ẩn được thông báo.');
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  if (useMocks) return mockDashboardStats;
  const { data, error } = await requireSupabaseClient().rpc('fn_dashboard_stats');
  if (error) throw error;
  return data as DashboardStats;
}

export async function fetchCurrentBusinessDate(propertyId: string): Promise<BusinessDate> {
  if (useMocks) {
    return {
      id: 'mock-business-date',
      propertyId,
      businessDate: new Date().toISOString().slice(0, 10),
      status: 'open',
    };
  }

  const { data, error } = await requireSupabaseClient().rpc('fn_get_current_business_date', {
    p_property_id: propertyId,
  });
  if (error) throw toError(error, 'Không tải được ngày kinh doanh.');
  return mapBusinessDate(data);
}

export async function fetchNightAuditPrecheck(propertyId: string, businessDate: string): Promise<NightAuditPrecheck> {
  if (useMocks) {
    return {
      businessDate,
      status: 'open',
      isClosed: false,
      canRun: mockDashboardStats.unpaidFolios === 0 && mockDashboardStats.pendingHKTasks === 0,
      blockersCount: mockDashboardStats.unpaidFolios + mockDashboardStats.pendingHKTasks,
      warningsCount: 0,
      summary: {
        openDepartures: 0,
        unpaidFolios: mockDashboardStats.unpaidFolios,
        pendingPayments: 0,
        pendingDeposits: 0,
        openHousekeepingTasks: mockDashboardStats.pendingHKTasks,
        noShowCandidates: 0,
        roomChargeCandidates: mockDashboardStats.occupiedRooms,
        roomChargeTotal: mockDashboardStats.todayRevenue,
      },
      blockers: {
        openDepartures: [],
        unpaidFolios: [],
        pendingPayments: [],
        pendingDeposits: [],
        openHousekeepingTasks: [],
      },
      warnings: {
        noShowCandidates: [],
      },
    };
  }

  const { data, error } = await requireSupabaseClient().rpc('fn_night_audit_precheck', {
    p_property_id: propertyId,
    p_business_date: businessDate,
  });
  if (error) throw toError(error, 'Không kiểm tra được Night Audit.');
  return mapNightAuditPrecheck(data);
}

export async function fetchNightAuditLogs(propertyId: string, businessDate: string): Promise<NightAuditLog[]> {
  if (useMocks) return [];

  const { data, error } = await requireSupabaseClient()
    .from('night_audit_logs')
    .select('*, created_by_profile:profiles!night_audit_logs_created_by_fkey(full_name)')
    .eq('property_id', propertyId)
    .eq('business_date', businessDate)
    .order('created_at', { ascending: false });
  if (error) throw toError(error, 'Không tải được log Night Audit.');
  return (data ?? []).map(mapNightAuditLog);
}

export async function runNightAudit(propertyId: string, businessDate: string): Promise<NightAuditRunResult> {
  if (useMocks) {
    return {
      postedRoomCharges: mockDashboardStats.occupiedRooms,
      noShowBookings: 0,
      roomRevenue: mockDashboardStats.todayRevenue,
      serviceRevenue: 0,
      payments: 0,
      lockedBusinessDate: businessDate,
      nextBusinessDate: new Date(Date.parse(`${businessDate}T00:00:00+07:00`) + 86_400_000).toISOString().slice(0, 10),
    };
  }

  const { data, error } = await requireSupabaseClient().rpc('fn_run_night_audit', {
    p_property_id: propertyId,
    p_business_date: businessDate,
  });
  if (error) throw toError(error, 'Không chạy được Night Audit.');
  return mapNightAuditRunResult(data);
}

export type GuestMutationInput = {
  propertyId: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email?: string;
  phone: string;
  nationality: string;
  documentType: 'cccd' | 'passport' | 'other';
  documentNumber: string;
  documentIssueDate?: string;
  documentIssuePlace?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  occupation?: string;
  currentAddress?: string;
  stayPurpose?: string;
  marketingConsent?: boolean;
  isVip?: boolean;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  loyaltyCode?: string;
  notes?: string;
};

export async function createGuest(input: GuestMutationInput): Promise<string> {
  const row = guestToRow(input);
  if (useMocks) {
    const id = newId('g');
    mockGuests.unshift(mapGuest({ id, ...row, total_stays: 0, total_spent: 0, created_at: new Date().toISOString() }));
    return id;
  }

  const { data, error } = await requireSupabaseClient().from('guests').insert(row).select('id').single();
  if (error) throw toError(error, 'Không lưu được hồ sơ khách.');
  return data.id;
}

export async function updateGuest(id: string, input: GuestMutationInput): Promise<void> {
  const row = guestToRow(input);
  if (useMocks) {
    const idx = mockGuests.findIndex(g => g.id === id);
    if (idx >= 0) {
      mockGuests[idx] = {
        ...mockGuests[idx],
        ...mapGuest({
          id,
          ...row,
          total_stays: mockGuests[idx].totalStays,
          total_spent: mockGuests[idx].totalSpent,
          created_at: mockGuests[idx].createdAt,
        }),
      };
    }
    return;
  }

  const { error } = await requireSupabaseClient().from('guests').update(row).eq('id', id);
  if (error) throw toError(error, 'Không lưu được hồ sơ khách.');
}

export async function deleteGuest(id: string): Promise<void> {
  if (useMocks) {
    const idx = mockGuests.findIndex(g => g.id === id);
    if (idx >= 0) mockGuests.splice(idx, 1);
    return;
  }
  const { error } = await requireSupabaseClient().from('guests').delete().eq('id', id);
  if (error) throw toError(error, 'Không xóa được khách.');
}

export type RoomMutationInput = {
  propertyId: string;
  roomTypeId: string;
  number: string;
  floor: number;
  notes?: string;
};

export async function createRoom(input: RoomMutationInput): Promise<string> {
  if (useMocks) {
    const type = mockRoomTypes.find(rt => rt.id === input.roomTypeId);
    const id = newId('room');
    mockRooms.push({
      id,
      propertyId: input.propertyId,
      roomTypeId: input.roomTypeId,
      roomTypeName: type?.name ?? 'Không rõ',
      number: input.number,
      floor: input.floor,
      status: 'vacant_clean',
      isActive: true,
      notes: input.notes,
    });
    return id;
  }

  const { data, error } = await requireSupabaseClient()
    .from('rooms')
    .insert({
      property_id: input.propertyId,
      room_type_id: input.roomTypeId,
      number: input.number.trim(),
      floor: input.floor,
      notes: input.notes?.trim() || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateRoomStatus(roomId: string, status: RoomStatus, reason?: string): Promise<void> {
  if (useMocks) {
    const room = mockRooms.find(r => r.id === roomId);
    if (room) room.status = status;
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_change_room_status', {
    p_room_id: roomId,
    p_to_status: status,
    p_reason: reason ?? 'frontend_update',
  });
  if (error) throw error;
}

export async function deleteRoom(roomId: string): Promise<void> {
  if (useMocks) {
    const idx = mockRooms.findIndex(r => r.id === roomId);
    if (idx >= 0) mockRooms.splice(idx, 1);
    return;
  }
  const { error } = await requireSupabaseClient().from('rooms').update({ is_active: false }).eq('id', roomId);
  if (error) throw error;
}

export type BookingMutationInput = {
  propertyId: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  status?: Extract<BookingStatus, 'tentative' | 'confirmed'>;
  source: BookingSource;
  rateCode: string;
  ratePerNight: number;
  depositAmount: number;
  depositPaid: boolean;
  externalReference?: string;
  notes?: string;
  services?: BookingServiceMutationInput[];
};

export type BookingServiceMutationInput = {
  serviceCode: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  serviceDate?: string;
  notes?: string;
};

const bookingServiceTotal = (service: BookingServiceMutationInput) =>
  Math.max(0, service.quantity) * Math.max(0, service.unitPrice);

const cleanBookingServices = (services: BookingServiceMutationInput[] = []) =>
  services
    .map(service => ({
      serviceCode: service.serviceCode.trim() || 'other',
      serviceName: service.serviceName.trim(),
      quantity: Math.max(1, Number(service.quantity) || 1),
      unitPrice: Math.max(0, Number(service.unitPrice) || 0),
      serviceDate: service.serviceDate || undefined,
      notes: service.notes?.trim() || undefined,
    }))
    .filter(service => service.serviceName.length > 0);

const mockBookingServices: BookingService[] = [
  {
    id: 'bks-001',
    propertyId: 'prop-001',
    bookingId: 'bk-002',
    serviceCode: 'breakfast_buffet',
    serviceName: 'Buffet sáng',
    quantity: 3,
    unitPrice: 250000,
    totalAmount: 750000,
    createdAt: new Date().toISOString(),
    createdBy: 'user-003',
  },
  {
    id: 'bks-002',
    propertyId: 'prop-001',
    bookingId: 'bk-007',
    serviceCode: 'dinner',
    serviceName: 'Set dinner nhà hàng',
    quantity: 2,
    unitPrice: 650000,
    totalAmount: 1300000,
    createdAt: new Date().toISOString(),
    createdBy: 'user-002',
  },
];

export async function createBooking(input: BookingMutationInput): Promise<string> {
  const checkIn = `${input.checkIn}T14:00:00+07:00`;
  const checkOut = `${input.checkOut}T12:00:00+07:00`;
  const nights = Math.max(1, Math.ceil((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000));
  const services = cleanBookingServices(input.services);
  const serviceTotal = services.reduce((sum, service) => sum + bookingServiceTotal(service), 0);
  const totalAmount = nights * input.ratePerNight + serviceTotal;

  if (useMocks) {
    const guest = mockGuests.find(g => g.id === input.guestId);
    const room = mockRooms.find(r => r.id === input.roomId);
    const id = newId('bk');
    mockBookings.unshift({
      id,
      bookingNumber: `BK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${mockBookings.length + 1}`,
      propertyId: input.propertyId,
      guestId: input.guestId,
      guestName: guest?.fullName ?? 'Không rõ',
      guestPhone: guest?.phone ?? '',
      roomId: input.roomId,
      roomNumber: room?.number ?? '—',
      roomTypeName: room?.roomTypeName ?? 'Không rõ',
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights,
      adults: input.adults,
      children: input.children,
      status: input.status ?? 'confirmed',
      source: input.source,
      rateCode: input.rateCode,
      ratePerNight: input.ratePerNight,
      totalAmount,
      depositAmount: input.depositAmount,
      depositPaid: input.depositPaid,
      externalReference: input.externalReference,
      notes: input.notes,
      createdAt: new Date().toISOString(),
      createdBy: 'mock',
    });
    services.forEach(service => {
      mockBookingServices.push({
        id: newId('bks'),
        propertyId: input.propertyId,
        bookingId: id,
        serviceCode: service.serviceCode,
        serviceName: service.serviceName,
        quantity: service.quantity,
        unitPrice: service.unitPrice,
        totalAmount: bookingServiceTotal(service),
        serviceDate: service.serviceDate,
        notes: service.notes,
        createdAt: new Date().toISOString(),
        createdBy: 'mock',
      });
    });
    return id;
  }

  const { data, error } = await requireSupabaseClient().rpc('fn_create_booking', {
    p_payload: {
      property_id: input.propertyId,
      guest_id: input.guestId,
      room_id: input.roomId,
      check_in: checkIn,
      check_out: checkOut,
      status: input.status ?? 'confirmed',
      source: input.source,
      rate_code: input.rateCode,
      rate_per_night: input.ratePerNight,
      total_amount: totalAmount,
      deposit_amount: input.depositAmount,
      deposit_paid: input.depositPaid,
      adults: input.adults,
      children: input.children,
      external_reference: input.externalReference ?? null,
      notes: input.notes ?? null,
      services: services.map(service => ({
        service_code: service.serviceCode,
        service_name: service.serviceName,
        quantity: service.quantity,
        unit_price: service.unitPrice,
        total_amount: bookingServiceTotal(service),
        service_date: service.serviceDate ?? null,
        notes: service.notes ?? null,
      })),
    },
  });
  if (error) throw toError(error, 'Không tạo được booking.');
  return data as string;
}

export async function fetchBookingServices(bookingId: string): Promise<BookingService[]> {
  if (!bookingId) return [];
  if (useMocks) {
    return mockBookingServices
      .filter(service => service.bookingId === bookingId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const { data, error } = await requireSupabaseClient()
    .from('booking_services')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });
  if (error) throw toError(error, 'Không tải được dịch vụ đi kèm booking.');
  return (data ?? []).map(mapBookingService);
}

export async function cancelBooking(bookingId: string, reason?: string): Promise<void> {
  if (useMocks) {
    const booking = mockBookings.find(b => b.id === bookingId);
    if (booking) booking.status = 'cancelled';
    return;
  }
  const { error } = await requireSupabaseClient().rpc('fn_cancel_booking', {
    p_booking_id: bookingId,
    p_reason: reason ?? 'frontend_cancel',
    p_refund_policy: 'manual',
  });
  if (error) throw error;
}

export async function checkInBooking(bookingId: string, roomId: string): Promise<void> {
  if (useMocks) {
    const booking = mockBookings.find(b => b.id === bookingId);
    const room = mockRooms.find(r => r.id === roomId);
    if (booking) booking.status = 'checked_in';
    if (room) room.status = 'occupied';
    return;
  }
  const { error } = await requireSupabaseClient().rpc('fn_check_in_booking', {
    p_booking_id: bookingId,
    p_room_id: roomId,
    p_payment: null,
  });
  if (error) throw error;
}

export async function checkOutBooking(bookingId: string): Promise<void> {
  if (useMocks) {
    const booking = mockBookings.find(b => b.id === bookingId);
    const room = booking ? mockRooms.find(r => r.id === booking.roomId) : undefined;
    if (booking) booking.status = 'checked_out';
    if (room) room.status = 'vacant_dirty';
    if (booking && room) {
      mockHKTasks.unshift({
        id: newId('hk'),
        propertyId: booking.propertyId,
        roomId: room.id,
        roomNumber: room.number,
        floor: room.floor,
        taskType: 'checkout_clean',
        status: 'pending',
        priority: 'high',
        notes: 'Tự động tạo sau checkout',
        createdAt: new Date().toISOString(),
      });
    }
    return;
  }
  const { error } = await requireSupabaseClient().rpc('fn_check_out_booking', {
    p_booking_id: bookingId,
    p_settlement_mode: 'paid',
  });
  if (error) throw error;
}

const mockFolioExtraItems = new Map<string, FolioItem[]>();
const mockPayments: Payment[] = [];
const mockReceipts: Receipt[] = [];
const mockCashierSessions: CashierSession[] = [];
const mockBookingDeposits: BookingDeposit[] = mockBookings
  .filter(booking => booking.depositPaid && booking.depositAmount > 0)
  .map(booking => ({
    id: `dep-${booking.id}`,
    propertyId: booking.propertyId,
    bookingId: booking.id,
    amount: booking.depositAmount,
    method: 'cash',
    status: 'posted',
    reference: 'Mock deposit',
    receiptNumber: `DEP-${booking.bookingNumber}`,
    receivedAt: booking.createdAt,
    receivedBy: booking.createdBy,
  }));

function mockReceipt(type: Receipt['receiptType'], propertyId: string, amount: number, method: PaymentMethod, links: Partial<Receipt>): Receipt {
  const receipt: Receipt = {
    id: newId('rc'),
    propertyId,
    receiptNumber: `${type === 'deposit' ? 'DEP' : type === 'refund' ? 'RF' : 'RC'}-${Date.now().toString(36).toUpperCase()}`,
    receiptType: type,
    amount,
    method,
    status: 'issued',
    issuedAt: new Date().toISOString(),
    issuedBy: currentMockUser().id,
    ...links,
  };
  mockReceipts.unshift(receipt);
  return receipt;
}

function mockOpenCashierSession(propertyId: string): CashierSession {
  const user = currentMockUser();
  let session = mockCashierSessions.find(item => item.propertyId === propertyId && item.cashierId === user.id && item.status === 'open');
  if (!session) {
    session = {
      id: newId('cs'),
      propertyId,
      cashierId: user.id,
      cashierName: user.name,
      status: 'open',
      openingFloat: 0,
      cashReceived: 0,
      cashRefunded: 0,
      expectedCash: 0,
      openedAt: new Date().toISOString(),
    };
    mockCashierSessions.unshift(session);
  }
  return session;
}

function refreshMockCashierTotals() {
  mockCashierSessions.forEach(session => {
    const paymentCash = mockPayments
      .filter(p => p.cashierSessionId === session.id && p.method === 'cash' && ['posted', 'finalized'].includes(p.status))
      .reduce((sum, item) => sum + item.amount, 0);
    const depositCash = mockBookingDeposits
      .filter(d => d.cashierSessionId === session.id && d.method === 'cash' && ['posted', 'finalized'].includes(d.status))
      .reduce((sum, item) => sum + item.amount, 0);
    session.cashReceived = paymentCash + depositCash;
    session.expectedCash = session.openingFloat + session.cashReceived - session.cashRefunded;
    session.variance = typeof session.declaredCash === 'number' ? session.declaredCash - session.expectedCash : undefined;
  });
}

function mockFolioForBooking(booking: Booking): Folio {
  const base: FolioItem[] = [
    {
      id: `room-${booking.id}`,
      folioId: `folio-${booking.id}`,
      type: 'debit',
      sourceType: 'room',
      description: `Tiền phòng ${booking.roomNumber} (${booking.nights} đêm)`,
      quantity: 1,
      unitPrice: booking.totalAmount,
      amount: booking.totalAmount,
      date: booking.checkIn,
      postedBy: 'mock',
    },
  ];
  mockBookingDeposits
    .filter(deposit => deposit.bookingId === booking.id && ['posted', 'finalized'].includes(deposit.status))
    .forEach(deposit => {
      base.push({
        id: `deposit-${deposit.id}`,
        folioId: `folio-${booking.id}`,
        type: 'credit',
        sourceType: 'deposit',
        sourceId: deposit.id,
        description: deposit.method === 'cash' ? 'Đặt cọc tiền mặt' : 'Đặt cọc chuyển khoản',
        quantity: 1,
        unitPrice: deposit.amount,
        amount: deposit.amount,
        date: deposit.receivedAt.slice(0, 10),
        postedBy: deposit.receivedBy ?? 'mock',
      });
    });
  const items = [...base, ...(mockFolioExtraItems.get(booking.id) ?? [])];
  const totalDebits = items.filter(i => i.type === 'debit').reduce((sum, item) => sum + item.amount, 0);
  const totalCredits = items.filter(i => i.type === 'credit').reduce((sum, item) => sum + item.amount, 0);
  const payments = mockPayments.filter(payment => payment.folioId === `folio-${booking.id}`);
  return {
    id: `folio-${booking.id}`,
    bookingId: booking.id,
    propertyId: booking.propertyId,
    guestName: booking.guestName,
    roomNumber: booking.roomNumber,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    items,
    totalDebits,
    totalCredits,
    balance: totalDebits - totalCredits,
    status: 'open',
    payments,
    receipts: mockReceipts.filter(receipt => receipt.folioId === `folio-${booking.id}` || receipt.bookingId === booking.id),
  };
}

export async function fetchOpenFolios(): Promise<Folio[]> {
  if (useMocks) return mockBookings.filter(b => b.status === 'checked_in').map(mockFolioForBooking);

  const { data, error } = await requireSupabaseClient()
    .from('folios')
    .select('*, folio_items(*), payments(*), receipts(*), bookings(check_in, check_out, guests(full_name), booking_rooms(status, rooms(number)))')
    .eq('status', 'open')
    .is('parent_folio_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const items: FolioItem[] = (row.folio_items ?? []).map((item: any) => ({
      id: item.id,
      folioId: item.folio_id,
      type: item.type,
      sourceType: item.source_type,
      sourceId: item.source_id ?? undefined,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      amount: Number(item.amount),
      date: item.business_date,
      postedBy: item.posted_by ?? '',
    }));
    const payments = (row.payments ?? []).map(mapPayment);
    const receipts = (row.receipts ?? []).map(mapReceipt);
    const totalDebits = items.filter(i => i.type === 'debit').reduce((sum, item) => sum + item.amount, 0);
    const totalCredits = items.filter(i => i.type === 'credit').reduce((sum, item) => sum + item.amount, 0);
    const activeRoom = row.bookings?.booking_rooms?.find((br: any) => br.status === 'checked_in') ?? row.bookings?.booking_rooms?.[0];
    return {
      id: row.id,
      bookingId: row.booking_id,
      propertyId: row.property_id,
      guestName: row.bookings?.guests?.full_name ?? 'Không rõ',
      roomNumber: activeRoom?.rooms?.number ?? '—',
      checkIn: row.bookings?.check_in?.slice(0, 10) ?? '',
      checkOut: row.bookings?.check_out?.slice(0, 10) ?? '',
      items,
      totalDebits,
      totalCredits,
      balance: totalDebits - totalCredits,
      status: row.status,
      payments,
      receipts,
      parentFolioId: row.parent_folio_id ?? undefined,
    };
  });
}

export async function addFolioCharge(folio: Folio, sourceType: FolioItemSourceType, description: string, amount: number): Promise<void> {
  if (useMocks) {
    const list = mockFolioExtraItems.get(folio.bookingId) ?? [];
    list.push({
      id: newId('fi'),
      folioId: folio.id,
      type: 'debit',
      sourceType,
      description,
      quantity: 1,
      unitPrice: amount,
      amount,
      date: new Date().toISOString().slice(0, 10),
      postedBy: 'mock',
    });
    mockFolioExtraItems.set(folio.bookingId, list);
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_add_folio_charge', {
    p_folio_id: folio.id,
    p_source_type: sourceType,
    p_description: description,
    p_amount: amount,
  });
  if (error) throw error;
}

export async function recordFolioPayment(folio: Folio, method: PaymentMethod, amount: number, reference?: string, evidencePath?: string): Promise<void> {
  const normalizedMethod: PaymentMethod = method === 'qr_manual' ? 'bank_transfer' : method;
  if (useMocks) {
    const session = normalizedMethod === 'cash' ? mockOpenCashierSession(folio.propertyId) : undefined;
    const payment: Payment = {
      id: newId('pay'),
      propertyId: folio.propertyId,
      folioId: folio.id,
      method: normalizedMethod,
      status: normalizedMethod === 'cash' ? 'posted' : 'pending_verification',
      amount,
      reference: reference || undefined,
      evidencePath: evidencePath || undefined,
      cashierSessionId: session?.id,
      receivedAt: new Date().toISOString(),
      receivedBy: currentMockUser().id,
    };
    mockPayments.unshift(payment);
    if (payment.status === 'posted') {
      const receipt = mockReceipt('payment', folio.propertyId, amount, normalizedMethod, { folioId: folio.id, bookingId: folio.bookingId, paymentId: payment.id });
      payment.receiptNumber = receipt.receiptNumber;
      const list = mockFolioExtraItems.get(folio.bookingId) ?? [];
      list.push({
        id: newId('fi'),
        folioId: folio.id,
        type: 'credit',
        sourceType: 'payment',
        sourceId: payment.id,
        description: normalizedMethod === 'cash' ? 'Thanh toán tiền mặt' : 'Thanh toán chuyển khoản',
        quantity: 1,
        unitPrice: amount,
        amount,
        date: new Date().toISOString().slice(0, 10),
        postedBy: 'mock',
      });
      mockFolioExtraItems.set(folio.bookingId, list);
    }
    refreshMockCashierTotals();
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_record_folio_payment', {
    p_folio_id: folio.id,
    p_method: normalizedMethod,
    p_amount: amount,
    p_reference: reference ?? null,
    p_evidence_path: evidencePath ?? null,
  });
  if (error) throw error;
}

export async function fetchBookingDeposits(bookingId: string): Promise<BookingDeposit[]> {
  if (!bookingId) return [];
  if (useMocks) {
    return mockBookingDeposits
      .filter(deposit => deposit.bookingId === bookingId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  const { data, error } = await requireSupabaseClient()
    .from('booking_deposits')
    .select('*')
    .eq('booking_id', bookingId)
    .order('received_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapBookingDeposit);
}

export async function recordBookingDeposit(
  booking: Booking,
  method: PaymentMethod,
  amount: number,
  reference?: string,
  evidencePath?: string,
): Promise<void> {
  const normalizedMethod: PaymentMethod = method === 'qr_manual' ? 'bank_transfer' : method;
  if (useMocks) {
    const session = normalizedMethod === 'cash' ? mockOpenCashierSession(booking.propertyId) : undefined;
    const deposit: BookingDeposit = {
      id: newId('dep'),
      propertyId: booking.propertyId,
      bookingId: booking.id,
      amount,
      method: normalizedMethod,
      status: normalizedMethod === 'cash' ? 'posted' : 'pending_verification',
      reference: reference || undefined,
      evidencePath: evidencePath || undefined,
      cashierSessionId: session?.id,
      receivedAt: new Date().toISOString(),
      receivedBy: currentMockUser().id,
    };
    if (deposit.status === 'posted') {
      const receipt = mockReceipt('deposit', booking.propertyId, amount, normalizedMethod, { bookingId: booking.id, bookingDepositId: deposit.id });
      deposit.receiptNumber = receipt.receiptNumber;
      booking.depositPaid = true;
      if (booking.status === 'tentative') booking.status = 'confirmed';
    }
    mockBookingDeposits.unshift(deposit);
    refreshMockCashierTotals();
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_record_booking_deposit', {
    p_booking_id: booking.id,
    p_method: normalizedMethod,
    p_amount: amount,
    p_reference: reference ?? null,
    p_evidence_path: evidencePath ?? null,
  });
  if (error) throw error;
}

export async function verifyPayment(
  id: string,
  kind: 'payment' | 'deposit',
  decision: 'approve' | 'reject' | 'void',
  note?: string,
): Promise<void> {
  if (useMocks) {
    if (kind === 'payment') {
      const payment = mockPayments.find(item => item.id === id);
      if (!payment) return;
      payment.status = decision === 'approve' ? 'posted' : 'voided';
      payment.verifiedAt = new Date().toISOString();
      payment.verifiedBy = currentMockUser().id;
      if (decision === 'approve') {
        const booking = mockBookings.find(b => `folio-${b.id}` === payment.folioId);
        if (booking && !mockFolioExtraItems.get(booking.id)?.some(item => item.sourceId === payment.id)) {
          const receipt = mockReceipt('payment', payment.propertyId, payment.amount, payment.method, { bookingId: booking.id, folioId: payment.folioId, paymentId: payment.id });
          payment.receiptNumber = receipt.receiptNumber;
          const list = mockFolioExtraItems.get(booking.id) ?? [];
          list.push({
            id: newId('fi'),
            folioId: payment.folioId,
            type: 'credit',
            sourceType: 'payment',
            sourceId: payment.id,
            description: payment.method === 'cash' ? 'Thanh toán tiền mặt' : 'Thanh toán chuyển khoản',
            quantity: 1,
            unitPrice: payment.amount,
            amount: payment.amount,
            date: new Date().toISOString().slice(0, 10),
            postedBy: currentMockUser().id,
          });
          mockFolioExtraItems.set(booking.id, list);
        }
      }
    } else {
      const deposit = mockBookingDeposits.find(item => item.id === id);
      if (!deposit) return;
      deposit.status = decision === 'approve' ? 'posted' : 'voided';
      deposit.verifiedAt = new Date().toISOString();
      deposit.verifiedBy = currentMockUser().id;
      if (decision === 'approve') {
        const receipt = mockReceipt('deposit', deposit.propertyId, deposit.amount, deposit.method, { bookingId: deposit.bookingId, bookingDepositId: deposit.id });
        deposit.receiptNumber = receipt.receiptNumber;
        const booking = mockBookings.find(item => item.id === deposit.bookingId);
        if (booking) {
          booking.depositPaid = true;
          if (booking.status === 'tentative') booking.status = 'confirmed';
        }
      }
    }
    refreshMockCashierTotals();
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_verify_payment', {
    p_target_id: id,
    p_kind: kind,
    p_decision: decision,
    p_note: note ?? null,
  });
  if (error) throw error;
}

export async function fetchPaymentVerificationQueue(): Promise<PaymentVerificationItem[]> {
  if (useMocks) {
    const paymentItems: PaymentVerificationItem[] = mockPayments
      .filter(payment => payment.status === 'pending_verification')
      .map(payment => {
        const booking = mockBookings.find(item => `folio-${item.id}` === payment.folioId);
        return {
          id: payment.id,
          kind: 'payment',
          propertyId: payment.propertyId,
          bookingId: booking?.id,
          folioId: payment.folioId,
          bookingNumber: booking?.bookingNumber,
          guestName: booking?.guestName,
          roomNumber: booking?.roomNumber,
          method: payment.method,
          status: payment.status,
          amount: payment.amount,
          reference: payment.reference,
          evidencePath: payment.evidencePath,
          receiptNumber: payment.receiptNumber,
          receivedAt: payment.receivedAt,
          receivedBy: payment.receivedBy,
        };
      });
    const depositItems: PaymentVerificationItem[] = mockBookingDeposits
      .filter(deposit => deposit.status === 'pending_verification')
      .map(deposit => {
        const booking = mockBookings.find(item => item.id === deposit.bookingId);
        return {
          id: deposit.id,
          kind: 'deposit',
          propertyId: deposit.propertyId,
          bookingId: deposit.bookingId,
          bookingNumber: booking?.bookingNumber,
          guestName: booking?.guestName,
          roomNumber: booking?.roomNumber,
          method: deposit.method,
          status: deposit.status,
          amount: deposit.amount,
          reference: deposit.reference,
          evidencePath: deposit.evidencePath,
          receiptNumber: deposit.receiptNumber,
          receivedAt: deposit.receivedAt,
          receivedBy: deposit.receivedBy,
        };
      });
    return [...paymentItems, ...depositItems].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  const client = requireSupabaseClient();
  const [{ data: payments, error: paymentError }, { data: deposits, error: depositError }] = await Promise.all([
    client
      .from('payments')
      .select('*, folios(booking_id, bookings(booking_number, guests(full_name), booking_rooms(status, rooms(number))))')
      .eq('status', 'pending_verification')
      .order('received_at', { ascending: false }),
    client
      .from('booking_deposits')
      .select('*, bookings(booking_number, guests(full_name), booking_rooms(status, rooms(number)))')
      .eq('status', 'pending_verification')
      .order('received_at', { ascending: false }),
  ]);
  if (paymentError) throw paymentError;
  if (depositError) throw depositError;

  const paymentItems: PaymentVerificationItem[] = (payments ?? []).map((row: any) => {
    const booking = row.folios?.bookings;
    const activeRoom = booking?.booking_rooms?.find((br: any) => br.status === 'checked_in') ?? booking?.booking_rooms?.[0];
    return {
      id: row.id,
      kind: 'payment',
      propertyId: row.property_id,
      bookingId: row.folios?.booking_id,
      folioId: row.folio_id,
      bookingNumber: booking?.booking_number,
      guestName: booking?.guests?.full_name,
      roomNumber: activeRoom?.rooms?.number,
      method: row.method,
      status: row.status,
      amount: Number(row.amount),
      reference: row.reference ?? undefined,
      evidencePath: row.evidence_path ?? undefined,
      receiptNumber: row.receipt_number ?? undefined,
      receivedAt: row.received_at,
      receivedBy: row.received_by ?? undefined,
    };
  });
  const depositItems: PaymentVerificationItem[] = (deposits ?? []).map((row: any) => {
    const booking = row.bookings;
    const activeRoom = booking?.booking_rooms?.find((br: any) => br.status === 'checked_in') ?? booking?.booking_rooms?.[0];
    return {
      id: row.id,
      kind: 'deposit',
      propertyId: row.property_id,
      bookingId: row.booking_id,
      bookingNumber: booking?.booking_number,
      guestName: booking?.guests?.full_name,
      roomNumber: activeRoom?.rooms?.number,
      method: row.method,
      status: row.status,
      amount: Number(row.amount),
      reference: row.reference ?? undefined,
      evidencePath: row.evidence_path ?? undefined,
      receiptNumber: row.receipt_number ?? undefined,
      receivedAt: row.received_at,
      receivedBy: row.received_by ?? undefined,
    };
  });
  return [...paymentItems, ...depositItems].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function fetchCashierSessions(): Promise<CashierSession[]> {
  if (useMocks) {
    refreshMockCashierTotals();
    return [...mockCashierSessions].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }

  const { data, error } = await requireSupabaseClient()
    .from('cashier_sessions')
    .select('*, cashier:profiles!cashier_sessions_cashier_id_fkey(full_name), payments(method,status,amount), booking_deposits(method,status,amount), refunds(status,amount)')
    .order('opened_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const cashPayments = (row.payments ?? [])
      .filter((item: any) => item.method === 'cash' && ['posted', 'finalized'].includes(item.status))
      .reduce((sum: number, item: any) => sum + Number(item.amount), 0);
    const cashDeposits = (row.booking_deposits ?? [])
      .filter((item: any) => item.method === 'cash' && ['posted', 'finalized'].includes(item.status))
      .reduce((sum: number, item: any) => sum + Number(item.amount), 0);
    const cashRefunds = (row.refunds ?? [])
      .filter((item: any) => ['posted', 'finalized'].includes(item.status))
      .reduce((sum: number, item: any) => sum + Number(item.amount), 0);
    const openingFloat = Number(row.opening_float ?? 0);
    const expectedCash = openingFloat + cashPayments + cashDeposits - cashRefunds;
    const declaredCash = row.declared_cash === null ? undefined : Number(row.declared_cash);
    return {
      id: row.id,
      propertyId: row.property_id,
      cashierId: row.cashier_id,
      cashierName: row.cashier?.full_name ?? undefined,
      status: row.status,
      openingFloat,
      cashReceived: cashPayments + cashDeposits,
      cashRefunded: cashRefunds,
      expectedCash,
      declaredCash,
      variance: typeof declaredCash === 'number' ? declaredCash - expectedCash : undefined,
      openedAt: row.opened_at,
      closedAt: row.closed_at ?? undefined,
      approvedAt: row.approved_at ?? undefined,
    };
  });
}

export async function requestRefund(folio: Folio, paymentId: string | null, amount: number, reason: string): Promise<void> {
  if (useMocks) {
    const list = mockFolioExtraItems.get(folio.bookingId) ?? [];
    list.push({
      id: newId('fi'),
      folioId: folio.id,
      type: 'debit',
      sourceType: 'refund',
      sourceId: newId('refund'),
      description: `Hoàn tiền: ${reason}`,
      quantity: 1,
      unitPrice: amount,
      amount,
      date: new Date().toISOString().slice(0, 10),
      postedBy: currentMockUser().id,
    });
    mockFolioExtraItems.set(folio.bookingId, list);
    mockReceipt('refund', folio.propertyId, amount, 'cash', { bookingId: folio.bookingId, folioId: folio.id, paymentId: paymentId ?? undefined });
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_request_refund', {
    p_folio_id: folio.id,
    p_payment_id: paymentId,
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function approveRefund(refundId: string, decision: 'approve' | 'reject', note?: string): Promise<void> {
  if (useMocks) return;

  const { error } = await requireSupabaseClient().rpc('fn_approve_refund', {
    p_refund_id: refundId,
    p_decision: decision,
    p_note: note ?? null,
  });
  if (error) throw error;
}

export async function updateHKTaskStatus(taskId: string, status: HKTaskStatus, notes?: string): Promise<void> {
  if (useMocks) {
    const task = mockHKTasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      if (status === 'in_progress' && !task.startedAt) task.startedAt = new Date().toISOString();
      if (status === 'done') task.completedAt = new Date().toISOString();
      if (status === 'inspected' || status === 'rejected') {
        const user = currentMockUser();
        task.inspectedAt = new Date().toISOString();
        task.inspectorId = user.id;
        task.inspectorName = user.name;
        task.inspectionNotes = notes;
      } else if (notes) {
        task.notes = notes;
      }
    }
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_update_hk_task_status', {
    p_task_id: taskId,
    p_to_status: status,
    p_notes: notes ?? null,
  });
  if (error) throw toError(error, 'Không cập nhật được task housekeeping.');
}

export type HKTaskMutationInput = {
  propertyId: string;
  roomId: string;
  taskType: HKTask['taskType'];
  priority: HKTask['priority'];
  notes?: string;
  assignedTo?: string;
};

export async function createHKTask(input: HKTaskMutationInput): Promise<string> {
  if (useMocks) {
    const room = mockRooms.find(item => item.id === input.roomId);
    const assignee = mockUsers.find(user => user.id === input.assignedTo);
    const id = newId('hk');
    mockHKTasks.unshift({
      id,
      propertyId: input.propertyId,
      roomId: input.roomId,
      roomNumber: room?.number ?? '—',
      floor: room?.floor ?? 0,
      taskType: input.taskType,
      status: 'pending',
      priority: input.priority,
      assignedTo: input.assignedTo,
      assignedToName: assignee?.name,
      notes: input.notes,
      createdAt: new Date().toISOString(),
    });
    if (input.assignedTo) {
      mockNotifications.unshift({
        id: newId('ntf'),
        propertyId: input.propertyId,
        recipientId: input.assignedTo,
        type: 'housekeeping',
        severity: 'info',
        title: 'Bạn có task Housekeeping mới',
        body: `Phòng ${room?.number ?? ''} cần xử lý.`,
        entityType: 'housekeeping_task',
        entityId: id,
        actionUrl: '/housekeeping',
        createdAt: new Date().toISOString(),
      });
    }
    return id;
  }

  const { data, error } = await requireSupabaseClient().rpc('fn_create_hk_task', {
    p_room_id: input.roomId,
    p_task_type: input.taskType,
    p_priority: input.priority,
    p_notes: input.notes ?? null,
    p_assigned_to: input.assignedTo ?? null,
  });
  if (error) throw toError(error, 'Không tạo được task housekeeping.');
  return data as string;
}

export async function assignHKTask(taskId: string, assignedTo: string): Promise<void> {
  if (useMocks) {
    const task = mockHKTasks.find(item => item.id === taskId);
    const assignee = mockUsers.find(user => user.id === assignedTo);
    if (task) {
      task.assignedTo = assignedTo;
      task.assignedToName = assignee?.name;
      mockNotifications.unshift({
        id: newId('ntf'),
        propertyId: task.propertyId,
        recipientId: assignedTo,
        type: 'housekeeping',
        severity: 'info',
        title: 'Bạn được giao task Housekeeping',
        body: `Phòng ${task.roomNumber} cần xử lý.`,
        entityType: 'housekeeping_task',
        entityId: task.id,
        actionUrl: '/housekeeping',
        createdAt: new Date().toISOString(),
      });
    }
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_assign_hk_task', {
    p_task_id: taskId,
    p_assigned_to: assignedTo,
  });
  if (error) throw toError(error, 'Không giao được task housekeeping.');
}

export async function fetchHKStaff(): Promise<Array<{ id: string; name: string; roles: UserRole[] }>> {
  if (useMocks) {
    return mockUsers
      .filter(user => (user.roles ?? [user.role]).some(role => role === 'hk_staff' || role === 'hk_supervisor') && user.isActive)
      .map(user => ({ id: user.id, name: user.name, roles: user.roles ?? [user.role] }));
  }

  const { data, error } = await requireSupabaseClient()
    .from('profiles')
    .select('id, full_name, profile_roles(role)')
    .eq('is_active', true)
    .order('full_name');
  if (error) throw toError(error, 'Không tải được nhân viên housekeeping.');

  return (data ?? [])
    .map((row: any) => ({
      id: row.id,
      name: row.full_name,
      roles: (row.profile_roles ?? []).map((roleRow: any) => roleRow.role as UserRole),
    }))
    .filter((item: { roles: UserRole[] }) => item.roles.some((role: UserRole) => role === 'hk_staff' || role === 'hk_supervisor'));
}

export async function fetchLostFound(): Promise<LostFoundItem[]> {
  if (useMocks) return mockLostFound.map(mapLostFound);

  const { data, error } = await requireSupabaseClient()
    .from('lost_found')
    .select('*, rooms(number, floor), guests(full_name), found_by_profile:profiles!lost_found_found_by_fkey(full_name)')
    .order('found_at', { ascending: false });
  if (error) throw toError(error, 'Không tải được Lost & Found.');
  return (data ?? []).map(mapLostFound);
}

export async function createLostFound(input: {
  roomId?: string;
  guestId?: string;
  description: string;
  storageLocation?: string;
  notes?: string;
}): Promise<string> {
  if (useMocks) {
    const user = currentMockUser();
    const room = mockRooms.find(item => item.id === input.roomId);
    const id = newId('lf');
    mockLostFound.unshift({
      id,
      propertyId: user.propertyId,
      roomNumber: room?.number ?? '—',
      floor: room?.floor ?? 0,
      description: input.description,
      foundBy: user.name,
      foundAt: new Date().toISOString(),
      status: 'stored',
      storageLocation: input.storageLocation ?? '',
      notes: input.notes,
    } as any);
    return id;
  }

  const { data, error } = await requireSupabaseClient().rpc('fn_create_lost_found', {
    p_room_id: input.roomId ?? null,
    p_guest_id: input.guestId ?? null,
    p_description: input.description,
    p_storage_location: input.storageLocation ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw toError(error, 'Không ghi nhận được vật thất lạc.');
  return data as string;
}

export async function updateLostFoundStatus(id: string, status: LostFoundItem['status'], notes?: string): Promise<void> {
  if (useMocks) {
    const item = mockLostFound.find(lost => lost.id === id);
    if (item) {
      item.status = status;
      if (notes) (item as any).notes = notes;
    }
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_update_lost_found_status', {
    p_item_id: id,
    p_status: status,
    p_notes: notes ?? null,
  });
  if (error) throw toError(error, 'Không cập nhật được Lost & Found.');
}

export type GuestRequestMutationInput = {
  propertyId: string;
  type: GuestRequestType;
  priority: GuestRequest['priority'];
  source: GuestRequestSource;
  title: string;
  description?: string;
  bookingId?: string;
  guestId?: string;
  roomId?: string;
  department?: string;
  assignedTo?: string;
  dueAt?: string;
  compensationAmount?: number;
};

const mockGuestRequests: GuestRequest[] = [];

export async function fetchGuestRequests(): Promise<GuestRequest[]> {
  if (useMocks) {
    return [...mockGuestRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const { data, error } = await requireSupabaseClient()
    .from('guest_requests')
    .select(`
      *,
      bookings(booking_number),
      guests(full_name, phone),
      rooms(number),
      assigned:profiles!guest_requests_assigned_to_fkey(full_name),
      created_by_profile:profiles!guest_requests_created_by_fkey(full_name),
      guest_request_comments(*, created_by_profile:profiles!guest_request_comments_created_by_fkey(full_name)),
      guest_request_events(*)
    `)
    .order('created_at', { ascending: false });
  if (error) throw toError(error, 'Không tải được yêu cầu khách hàng.');
  return (data ?? []).map(mapGuestRequest);
}

export async function createGuestRequest(input: GuestRequestMutationInput): Promise<string> {
  if (useMocks) {
    const user = currentMockUser();
    const booking = input.bookingId ? mockBookings.find(item => item.id === input.bookingId) : undefined;
    const guest = input.guestId
      ? mockGuests.find(item => item.id === input.guestId)
      : booking
        ? mockGuests.find(item => item.id === booking.guestId)
        : undefined;
    const room = input.roomId
      ? mockRooms.find(item => item.id === input.roomId)
      : booking
        ? mockRooms.find(item => item.id === booking.roomId)
        : undefined;
    const assignee = input.assignedTo ? mockUsers.find(item => item.id === input.assignedTo) : undefined;
    const id = newId('gr');
    mockGuestRequests.unshift({
      id,
      propertyId: input.propertyId,
      requestNumber: `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${mockGuestRequests.length + 1}`,
      type: input.type,
      status: input.assignedTo ? 'assigned' : 'new',
      priority: input.priority,
      source: input.source,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      bookingId: booking?.id,
      bookingNumber: booking?.bookingNumber,
      guestId: guest?.id,
      guestName: guest?.fullName ?? booking?.guestName,
      guestPhone: guest?.phone ?? booking?.guestPhone,
      roomId: room?.id,
      roomNumber: room?.number ?? booking?.roomNumber,
      department: input.department || defaultGuestRequestDepartment(input.type),
      assignedTo: input.assignedTo || undefined,
      assignedToName: assignee?.name,
      dueAt: input.dueAt || undefined,
      compensationAmount: input.compensationAmount ?? 0,
      createdBy: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [],
      events: [],
    });
    return id;
  }

  const { data, error } = await requireSupabaseClient().rpc('fn_create_guest_request', {
    p_payload: {
      property_id: input.propertyId,
      type: input.type,
      priority: input.priority,
      source: input.source,
      title: input.title,
      description: input.description ?? null,
      booking_id: input.bookingId ?? null,
      guest_id: input.guestId ?? null,
      room_id: input.roomId ?? null,
      department: input.department ?? null,
      assigned_to: input.assignedTo ?? null,
      due_at: input.dueAt ?? null,
      compensation_amount: input.compensationAmount ?? 0,
    },
  });
  if (error) throw toError(error, 'Không tạo được yêu cầu khách hàng.');
  return data as string;
}

function defaultGuestRequestDepartment(type: GuestRequestType) {
  if (type === 'housekeeping' || type === 'lost_found') return 'housekeeping';
  if (type === 'maintenance') return 'maintenance';
  if (type === 'billing') return 'accounting';
  if (type === 'complaint') return 'management';
  return 'front_desk';
}

export async function updateGuestRequestStatus(
  requestId: string,
  status: GuestRequestStatus,
  resolution?: string,
  assignedTo?: string,
): Promise<void> {
  if (useMocks) {
    const item = mockGuestRequests.find(request => request.id === requestId);
    if (!item) return;
    const oldStatus = item.status;
    item.status = status;
    if (assignedTo !== undefined) {
      item.assignedTo = assignedTo || undefined;
      item.assignedToName = mockUsers.find(user => user.id === assignedTo)?.name;
    }
    if (resolution?.trim()) item.resolution = resolution.trim();
    if (status === 'resolved') item.resolvedAt = new Date().toISOString();
    if (status === 'closed') item.closedAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    item.events = [
      {
        id: newId('gre'),
        propertyId: item.propertyId,
        requestId,
        eventType: 'status_changed',
        oldStatus,
        newStatus: status,
        payload: {},
        createdBy: currentMockUser().id,
        createdAt: new Date().toISOString(),
      },
      ...(item.events ?? []),
    ];
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_update_guest_request_status', {
    p_request_id: requestId,
    p_status: status,
    p_resolution: resolution ?? null,
    p_assigned_to: assignedTo ?? null,
  });
  if (error) throw toError(error, 'Không cập nhật được yêu cầu khách hàng.');
}

export async function addGuestRequestComment(requestId: string, comment: string, isInternal = true): Promise<string> {
  if (useMocks) {
    const item = mockGuestRequests.find(request => request.id === requestId);
    if (!item) throw new Error('Không tìm thấy yêu cầu khách hàng.');
    const user = currentMockUser();
    const id = newId('grc');
    item.comments = [
      {
        id,
        propertyId: item.propertyId,
        requestId,
        comment,
        isInternal,
        createdBy: user.id,
        createdByName: user.name,
        createdAt: new Date().toISOString(),
      },
      ...(item.comments ?? []),
    ];
    item.updatedAt = new Date().toISOString();
    return id;
  }

  const { data, error } = await requireSupabaseClient().rpc('fn_add_guest_request_comment', {
    p_request_id: requestId,
    p_comment: comment,
    p_is_internal: isInternal,
  });
  if (error) throw toError(error, 'Không thêm được ghi chú xử lý.');
  return data as string;
}

export async function postGuestRequestCharge(
  request: GuestRequest,
  folio: Folio,
  description: string,
  amount: number,
): Promise<void> {
  if (useMocks) {
    const list = mockFolioExtraItems.get(folio.bookingId) ?? [];
    list.push({
      id: newId('fi'),
      folioId: folio.id,
      type: 'debit',
      sourceType: 'manual_service',
      sourceId: request.id,
      description,
      quantity: 1,
      unitPrice: amount,
      amount,
      date: new Date().toISOString().slice(0, 10),
      postedBy: currentMockUser().id,
    });
    mockFolioExtraItems.set(folio.bookingId, list);
    const item = mockGuestRequests.find(req => req.id === request.id);
    if (item) item.folioItemId = list[list.length - 1].id;
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_post_guest_request_charge', {
    p_request_id: request.id,
    p_folio_id: folio.id,
    p_description: description,
    p_amount: amount,
  });
  if (error) throw toError(error, 'Không post được phí dịch vụ vào folio.');
}

// ============================================================
// Metadata Options
// ============================================================
import type { AccountProfile, ChangePasswordInput, UpdateMyProfileInput } from '@/types/account';
import type { MetadataCategory, MetadataOption } from '@/types/metadata';
import type { InviteStaffPayload, StaffProfile, UserRole } from '@/types/staff';

const validAvatarMimeTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function rolePriority(role: UserRole): number {
  return ['admin', 'manager', 'accountant', 'receptionist', 'hk_supervisor', 'hk_staff'].indexOf(role);
}

function sortedRoles(roles: UserRole[]): UserRole[] {
  return [...new Set(roles)].sort((a, b) => rolePriority(a) - rolePriority(b));
}

async function signedAvatarUrl(path?: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  if (useMocks) return path;

  const { data, error } = await requireSupabaseClient()
    .storage
    .from('avatars')
    .createSignedUrl(path, 60 * 60);
  if (error) return undefined;
  return data.signedUrl;
}

function currentMockUser() {
  if (typeof localStorage === 'undefined') return mockUsers[0];
  const saved = localStorage.getItem('pms_user');
  if (!saved) return mockUsers[0];
  try {
    const parsed = JSON.parse(saved) as { id?: string };
    return mockUsers.find(user => user.id === parsed.id) ?? mockUsers[0];
  } catch {
    return mockUsers[0];
  }
}

function persistMockUser(userId: string) {
  if (typeof localStorage === 'undefined') return;
  const existing = localStorage.getItem('pms_user');
  if (!existing) return;
  const updated = mockUsers.find(user => user.id === userId);
  if (updated) localStorage.setItem('pms_user', JSON.stringify(updated));
}

function accountProfileFromRow(row: any, avatarUrl?: string): AccountProfile {
  const roles = sortedRoles((row.profile_roles ?? []).map((r: any) => r.role as UserRole));
  return {
    id: row.id,
    property_id: row.property_id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    avatar_path: row.avatar_path,
    avatar_url: avatarUrl,
    position_title: row.position_title,
    is_active: row.is_active,
    roles,
    primaryRole: roles[0] ?? 'receptionist',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function staffProfileFromRow(row: any, avatarUrl?: string): StaffProfile {
  const roles = sortedRoles((row.profile_roles ?? []).map((r: any) => r.role as UserRole));
  return {
    id: row.id,
    property_id: row.property_id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    avatar_path: row.avatar_path,
    avatar_url: avatarUrl,
    position_title: row.position_title,
    is_active: row.is_active,
    roles,
    primaryRole: roles[0] ?? 'receptionist',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateAvatarFile(file: File) {
  if (!validAvatarMimeTypes.has(file.type)) {
    throw new Error('Ảnh đại diện chỉ hỗ trợ JPEG, PNG hoặc WebP.');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Ảnh đại diện tối đa 2MB.');
  }
}

async function resizeAvatar(file: File): Promise<{ blob: Blob; ext: string; contentType: string }> {
  validateAvatarFile(file);

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Không đọc được ảnh đại diện.'));
      img.src = imageUrl;
    });

    const size = 512;
    const sourceSize = Math.min(image.width, image.height);
    const sx = Math.max(0, (image.width - sourceSize) / 2);
    const sy = Math.max(0, (image.height - sourceSize) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
    ctx.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);

    const contentType = file.type === 'image/png' ? 'image/png' : file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(output => output ? resolve(output) : reject(new Error('Không xử lý được ảnh đại diện.')), contentType, 0.9);
    });

    return { blob, ext: validAvatarMimeTypes.get(contentType) ?? 'webp', contentType };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được ảnh đại diện.'));
    reader.readAsDataURL(blob);
  });
}

export async function fetchMyProfile(): Promise<AccountProfile> {
  if (useMocks) {
    const user = currentMockUser();
    return {
      id: user.id,
      property_id: user.propertyId,
      full_name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      avatar_path: user.avatarPath ?? user.avatar ?? null,
      avatar_url: user.avatarUrl ?? user.avatar,
      position_title: user.positionTitle ?? null,
      is_active: user.isActive,
      roles: user.roles ?? [user.role],
      primaryRole: user.role,
      created_at: new Date().toISOString(),
    };
  }

  const client = requireSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Chưa đăng nhập.');

  const { data, error } = await client
    .from('profiles')
    .select('id, property_id, full_name, email, phone, avatar_path, position_title, is_active, created_at, updated_at, profile_roles(role)')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Không tìm thấy hồ sơ tài khoản.');

  return accountProfileFromRow(data, await signedAvatarUrl((data as any).avatar_path));
}

export async function updateMyProfile(input: UpdateMyProfileInput): Promise<AccountProfile> {
  if (useMocks) {
    const user = currentMockUser();
    user.name = input.full_name?.trim() || user.name;
    user.phone = input.phone?.trim() || undefined;
    if (input.avatar_path !== undefined) {
      user.avatarPath = input.avatar_path ?? undefined;
      user.avatarUrl = input.avatar_path ?? undefined;
      user.avatar = input.avatar_path ?? undefined;
    }
    if (input.position_title !== undefined) user.positionTitle = input.position_title?.trim() || undefined;
    persistMockUser(user.id);
    return fetchMyProfile();
  }

  const { data, error } = await requireSupabaseClient().rpc('fn_update_my_profile', {
    p_full_name: input.full_name ?? null,
    p_phone: input.phone ?? null,
    p_avatar_path: input.avatar_path ?? null,
    p_position_title: input.position_title ?? null,
  });
  if (error) throw error;
  return accountProfileFromRow(data, await signedAvatarUrl(data.avatar_path));
}

export async function uploadMyAvatar(file: File): Promise<{ path: string; url?: string }> {
  const { blob, ext, contentType } = await resizeAvatar(file);

  if (useMocks) {
    const user = currentMockUser();
    const url = await blobToDataUrl(blob);
    user.avatar = url;
    user.avatarPath = url;
    user.avatarUrl = url;
    persistMockUser(user.id);
    return { path: url, url };
  }

  const profile = await fetchMyProfile();
  const path = `${profile.property_id}/${profile.id}/avatar.${ext}`;
  const { error } = await requireSupabaseClient()
    .storage
    .from('avatars')
    .upload(path, blob, {
      contentType,
      cacheControl: '3600',
      upsert: true,
    });
  if (error) throw error;

  const updated = await updateMyProfile({ avatar_path: path });
  return { path, url: updated.avatar_url };
}

export async function deleteMyAvatar(path?: string | null): Promise<void> {
  if (useMocks) {
    const user = currentMockUser();
    delete user.avatar;
    delete user.avatarPath;
    delete user.avatarUrl;
    persistMockUser(user.id);
    return;
  }

  const profile = path ? null : await fetchMyProfile();
  const avatarPath = path ?? profile?.avatar_path;
  if (avatarPath) {
    const { error } = await requireSupabaseClient().storage.from('avatars').remove([avatarPath]);
    if (error) throw error;
  }
  const { error } = await requireSupabaseClient().rpc('fn_clear_my_avatar');
  if (error) throw error;
}

export async function changeMyPassword(input: ChangePasswordInput): Promise<void> {
  if (useMocks) {
    const user = currentMockUser();
    const cred = mockCredentials[user.email];
    if (!cred || cred.password !== input.currentPassword) {
      throw new Error('Mật khẩu hiện tại không đúng.');
    }
    mockCredentials[user.email] = { ...cred, password: input.newPassword };
    return;
  }

  const { error } = await requireSupabaseClient().auth.updateUser({
    password: input.newPassword,
    currentPassword: input.currentPassword,
  } as any);
  if (error) throw error;
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  if (useMocks) return;

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/account` : undefined;
  const { error } = await requireSupabaseClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function fetchMetadataOptions(category?: MetadataCategory): Promise<MetadataOption[]> {
  if (useMocks) {
    return [...mockMetadataOptions]
      .filter(option => !category || option.category === category)
      .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  }

  let q = requireSupabaseClient()
    .from('metadata_options')
    .select('*')
    .order('sort_order', { ascending: true });
  if (category) q = q.eq('category', category);
  const { data, error } = await q;
  if (error) throw error;
  return data as MetadataOption[];
}

export async function createMetadataOption(
  input: Omit<MetadataOption, 'id' | 'created_at' | 'updated_at'>
): Promise<MetadataOption> {
  if (useMocks) {
    const duplicate = mockMetadataOptions.some(option =>
      option.property_id === input.property_id &&
      option.category === input.category &&
      option.code === input.code,
    );
    if (duplicate) throw new Error('Code đã tồn tại trong danh mục này.');

    const timestamp = new Date().toISOString();
    const option: MetadataOption = {
      ...input,
      id: newId('meta'),
      created_at: timestamp,
      updated_at: timestamp,
    };
    mockMetadataOptions.push(option);
    return option;
  }

  const { data, error } = await requireSupabaseClient()
    .from('metadata_options')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as MetadataOption;
}

export async function updateMetadataOption(
  id: string,
  input: Partial<Pick<MetadataOption, 'label' | 'description' | 'sort_order' | 'extra'>>
): Promise<void> {
  if (useMocks) {
    const idx = mockMetadataOptions.findIndex(option => option.id === id);
    if (idx >= 0) {
      mockMetadataOptions[idx] = {
        ...mockMetadataOptions[idx],
        ...input,
        updated_at: new Date().toISOString(),
      };
    }
    return;
  }

  const { error } = await requireSupabaseClient()
    .from('metadata_options')
    .update(input)
    .eq('id', id);
  if (error) throw error;
}

export async function deactivateMetadataOption(id: string): Promise<void> {
  if (useMocks) {
    const option = mockMetadataOptions.find(item => item.id === id);
    if (option) {
      option.is_active = false;
      option.updated_at = new Date().toISOString();
    }
    return;
  }

  const { error } = await requireSupabaseClient()
    .from('metadata_options')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

export async function reactivateMetadataOption(id: string): Promise<void> {
  if (useMocks) {
    const option = mockMetadataOptions.find(item => item.id === id);
    if (option) {
      option.is_active = true;
      option.updated_at = new Date().toISOString();
    }
    return;
  }

  const { error } = await requireSupabaseClient()
    .from('metadata_options')
    .update({ is_active: true })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMetadataOption(id: string): Promise<void> {
  if (useMocks) {
    const idx = mockMetadataOptions.findIndex(option => option.id === id);
    if (idx >= 0) mockMetadataOptions.splice(idx, 1);
    return;
  }

  const { error } = await requireSupabaseClient()
    .from('metadata_options')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// Staff
// ============================================================
export async function fetchStaffProfiles(): Promise<StaffProfile[]> {
  if (useMocks) {
    return mockUsers
      .map(user => staffProfileFromRow({
        id: user.id,
        property_id: user.propertyId,
        full_name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        avatar_path: user.avatarPath ?? user.avatar ?? null,
        position_title: user.positionTitle ?? null,
        is_active: user.isActive,
        profile_roles: (user.roles ?? [user.role]).map(role => ({ role })),
        created_at: new Date().toISOString(),
      }, user.avatarUrl ?? user.avatar))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  const { data: profiles, error } = await requireSupabaseClient()
    .from('profiles')
    .select('id, property_id, full_name, email, phone, avatar_path, position_title, is_active, created_at, updated_at, profile_roles(role)')
    .order('full_name');
  if (error) throw error;

  return Promise.all((profiles ?? []).map(async (p: any) => staffProfileFromRow(p, await signedAvatarUrl(p.avatar_path))));
}

export async function inviteStaff(payload: InviteStaffPayload): Promise<{ user_id: string }> {
  const { data: { session } } = await requireSupabaseClient().auth.getSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/invite-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Failed to invite staff');
  return json;
}

export async function updateStaffProfile(
  profileId: string,
  input: { full_name?: string; phone?: string; is_active?: boolean; avatar_path?: string | null; position_title?: string | null }
): Promise<void> {
  if (useMocks) {
    const user = mockUsers.find(item => item.id === profileId);
    if (!user) return;
    if (input.full_name !== undefined) user.name = input.full_name.trim();
    if (input.phone !== undefined) user.phone = input.phone?.trim() || undefined;
    if (input.is_active !== undefined) user.isActive = input.is_active;
    if (input.avatar_path !== undefined) {
      user.avatarPath = input.avatar_path ?? undefined;
      user.avatarUrl = input.avatar_path ?? undefined;
      user.avatar = input.avatar_path ?? undefined;
    }
    if (input.position_title !== undefined) user.positionTitle = input.position_title?.trim() || undefined;
    persistMockUser(profileId);
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_update_staff_profile', {
    p_profile_id: profileId,
    p_full_name: input.full_name ?? null,
    p_phone: input.phone ?? null,
    p_is_active: input.is_active ?? null,
    p_avatar_path: input.avatar_path ?? null,
    p_position_title: input.position_title ?? null,
  });
  if (error) throw error;
}

export async function setStaffRoles(profileId: string, roles: UserRole[]): Promise<void> {
  if (useMocks) {
    const user = mockUsers.find(item => item.id === profileId);
    if (user) {
      user.roles = sortedRoles(roles);
      user.role = user.roles[0] ?? user.role;
      persistMockUser(profileId);
    }
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_set_staff_roles', {
    p_profile_id: profileId,
    p_roles: roles,
  });
  if (error) throw error;
}

export async function deactivateStaff(profileId: string): Promise<void> {
  if (useMocks) {
    const user = mockUsers.find(item => item.id === profileId);
    if (user) user.isActive = false;
    persistMockUser(profileId);
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_deactivate_staff', {
    p_profile_id: profileId,
  });
  if (error) throw error;
}

export async function reactivateStaff(profileId: string): Promise<void> {
  if (useMocks) {
    const user = mockUsers.find(item => item.id === profileId);
    if (user) user.isActive = true;
    persistMockUser(profileId);
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_reactivate_staff', {
    p_profile_id: profileId,
  });
  if (error) throw error;
}

// ============================================================
// Room Rates
// ============================================================
function mapRoomRate(row: any): RoomRate {
  return {
    id: row.id,
    propertyId: row.property_id,
    roomTypeId: row.room_type_id,
    rateCode: row.rate_code,
    name: row.name,
    amount: Number(row.amount),
    currency: row.currency,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    isActive: row.is_active,
  };
}

export type RoomRateMutationInput = {
  propertyId: string;
  roomTypeId: string;
  rateCode: string;
  name: string;
  amount: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
};

function roomRateToRow(input: Partial<RoomRateMutationInput>) {
  const row: Record<string, any> = {};
  if ('propertyId' in input) row.property_id = input.propertyId;
  if ('roomTypeId' in input) row.room_type_id = input.roomTypeId;
  if ('rateCode' in input) row.rate_code = input.rateCode;
  if ('name' in input) row.name = input.name?.trim();
  if ('amount' in input) row.amount = input.amount;
  if ('currency' in input) row.currency = input.currency?.trim() || 'VND';
  if ('startDate' in input) row.start_date = input.startDate || null;
  if ('endDate' in input) row.end_date = input.endDate || null;
  if ('isActive' in input) row.is_active = input.isActive;
  return row;
}

export async function fetchRoomRates(roomTypeId?: string): Promise<RoomRate[]> {
  if (useMocks) {
    return roomTypeId ? mockRoomRates.filter(rate => rate.roomTypeId === roomTypeId) : mockRoomRates;
  }

  let q = requireSupabaseClient()
    .from('room_rates')
    .select('*')
    .order('rate_code');
  if (roomTypeId) q = q.eq('room_type_id', roomTypeId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRoomRate);
}

export async function createRoomRate(input: RoomRateMutationInput): Promise<RoomRate> {
  if (useMocks) {
    const rate: RoomRate = {
      id: newId('rate'),
      propertyId: input.propertyId,
      roomTypeId: input.roomTypeId,
      rateCode: input.rateCode,
      name: input.name.trim(),
      amount: input.amount,
      currency: input.currency?.trim() || 'VND',
      startDate: input.startDate || undefined,
      endDate: input.endDate || undefined,
      isActive: input.isActive ?? true,
    };
    mockRoomRates.push(rate);
    return rate;
  }

  const { data, error } = await requireSupabaseClient()
    .from('room_rates')
    .insert(roomRateToRow(input))
    .select('*')
    .single();
  if (error) throw error;
  return mapRoomRate(data);
}

export async function updateRoomRate(id: string, input: Partial<RoomRateMutationInput>): Promise<void> {
  if (useMocks) {
    const idx = mockRoomRates.findIndex(rate => rate.id === id);
    if (idx >= 0) {
      mockRoomRates[idx] = {
        ...mockRoomRates[idx],
        ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
        ...(input.roomTypeId !== undefined ? { roomTypeId: input.roomTypeId } : {}),
        ...(input.rateCode !== undefined ? { rateCode: input.rateCode } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.currency !== undefined ? { currency: input.currency.trim() || 'VND' } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate || undefined } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate || undefined } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      };
    }
    return;
  }

  const { error } = await requireSupabaseClient()
    .from('room_rates')
    .update(roomRateToRow(input))
    .eq('id', id);
  if (error) throw error;
}

export async function deleteRoomRate(id: string): Promise<void> {
  if (useMocks) {
    const idx = mockRoomRates.findIndex(rate => rate.id === id);
    if (idx >= 0) mockRoomRates.splice(idx, 1);
    return;
  }

  const { error } = await requireSupabaseClient().from('room_rates').delete().eq('id', id);
  if (error) throw error;
}
