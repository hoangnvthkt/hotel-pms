import { queryKeys } from '@/lib/queryClient';
import { requireSupabaseClient, supabase } from '@/lib/supabase';
import { mockBookings } from '@/mock/bookings';
import { mockGuests } from '@/mock/guests';
import { mockHKTasks } from '@/mock/housekeeping';
import { mockMetadataOptions } from '@/mock/metadata';
import { mockDashboardStats } from '@/mock/reports';
import { mockRoomRates, mockRooms, mockRoomTypes } from '@/mock/rooms';
import type {
  Booking,
  BookingSource,
  DashboardStats,
  Folio,
  FolioItem,
  FolioItemSourceType,
  Guest,
  HKTask,
  HKTaskStatus,
  PaymentMethod,
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

export async function fetchDashboardStats(): Promise<DashboardStats> {
  if (useMocks) return mockDashboardStats;
  const { data, error } = await requireSupabaseClient().rpc('fn_dashboard_stats');
  if (error) throw error;
  return data as DashboardStats;
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
  if (error) throw error;
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
  if (error) throw error;
}

export async function deleteGuest(id: string): Promise<void> {
  if (useMocks) {
    const idx = mockGuests.findIndex(g => g.id === id);
    if (idx >= 0) mockGuests.splice(idx, 1);
    return;
  }
  const { error } = await requireSupabaseClient().from('guests').delete().eq('id', id);
  if (error) throw error;
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
  source: BookingSource;
  rateCode: string;
  ratePerNight: number;
  depositAmount: number;
  depositPaid: boolean;
  notes?: string;
};

export async function createBooking(input: BookingMutationInput): Promise<string> {
  const checkIn = `${input.checkIn}T14:00:00+07:00`;
  const checkOut = `${input.checkOut}T12:00:00+07:00`;
  const nights = Math.max(1, Math.ceil((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000));
  const totalAmount = nights * input.ratePerNight;

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
      status: 'confirmed',
      source: input.source,
      rateCode: input.rateCode,
      ratePerNight: input.ratePerNight,
      totalAmount,
      depositAmount: input.depositAmount,
      depositPaid: input.depositPaid,
      notes: input.notes,
      createdAt: new Date().toISOString(),
      createdBy: 'mock',
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
      status: 'confirmed',
      source: input.source,
      rate_code: input.rateCode,
      rate_per_night: input.ratePerNight,
      total_amount: totalAmount,
      deposit_amount: input.depositAmount,
      deposit_paid: input.depositPaid,
      adults: input.adults,
      children: input.children,
      notes: input.notes ?? null,
    },
  });
  if (error) throw error;
  return data as string;
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
  if (booking.depositPaid && booking.depositAmount > 0) {
    base.push({
      id: `deposit-${booking.id}`,
      folioId: `folio-${booking.id}`,
      type: 'credit',
      sourceType: 'deposit',
      description: 'Đặt cọc',
      quantity: 1,
      unitPrice: booking.depositAmount,
      amount: booking.depositAmount,
      date: booking.checkIn,
      postedBy: 'mock',
    });
  }
  const items = [...base, ...(mockFolioExtraItems.get(booking.id) ?? [])];
  const totalDebits = items.filter(i => i.type === 'debit').reduce((sum, item) => sum + item.amount, 0);
  const totalCredits = items.filter(i => i.type === 'credit').reduce((sum, item) => sum + item.amount, 0);
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
  };
}

export async function fetchOpenFolios(): Promise<Folio[]> {
  if (useMocks) return mockBookings.filter(b => b.status === 'checked_in').map(mockFolioForBooking);

  const { data, error } = await requireSupabaseClient()
    .from('folios')
    .select('*, folio_items(*), bookings(check_in, check_out, guests(full_name), booking_rooms(status, rooms(number)))')
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
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      amount: Number(item.amount),
      date: item.business_date,
      postedBy: item.posted_by ?? '',
    }));
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

export async function recordFolioPayment(folio: Folio, method: PaymentMethod, amount: number, reference?: string): Promise<void> {
  if (useMocks) {
    const list = mockFolioExtraItems.get(folio.bookingId) ?? [];
    list.push({
      id: newId('fi'),
      folioId: folio.id,
      type: 'credit',
      sourceType: 'payment',
      description: reference ? `Thanh toán (${reference})` : 'Thanh toán',
      quantity: 1,
      unitPrice: amount,
      amount,
      date: new Date().toISOString().slice(0, 10),
      postedBy: 'mock',
    });
    mockFolioExtraItems.set(folio.bookingId, list);
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_record_payment', {
    p_folio_id: folio.id,
    p_method: method,
    p_amount: amount,
    p_reference: reference ?? null,
  });
  if (error) throw error;
}

export async function updateHKTaskStatus(taskId: string, status: HKTaskStatus, notes?: string): Promise<void> {
  if (useMocks) {
    const task = mockHKTasks.find(t => t.id === taskId);
    if (task) task.status = status;
    return;
  }

  const { error } = await requireSupabaseClient().rpc('fn_update_hk_task_status', {
    p_task_id: taskId,
    p_to_status: status,
    p_notes: notes ?? null,
  });
  if (error) throw error;
}

// ============================================================
// Metadata Options
// ============================================================
import type { MetadataCategory, MetadataOption } from '@/types/metadata';
import type { InviteStaffPayload, StaffProfile, UserRole } from '@/types/staff';

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
  const { data: profiles, error } = await requireSupabaseClient()
    .from('profiles')
    .select('*, profile_roles(role)')
    .order('full_name');
  if (error) throw error;

  return (profiles ?? []).map((p: any) => {
    const roles: UserRole[] = (p.profile_roles ?? []).map((r: any) => r.role as UserRole);
    return {
      id: p.id,
      property_id: p.property_id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      is_active: p.is_active,
      roles,
      primaryRole: roles[0] ?? 'receptionist',
      created_at: p.created_at,
    };
  });
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
  input: { full_name?: string; phone?: string; is_active?: boolean }
): Promise<void> {
  const { error } = await requireSupabaseClient().rpc('fn_update_staff_profile', {
    p_profile_id: profileId,
    p_full_name: input.full_name ?? null,
    p_phone: input.phone ?? null,
    p_is_active: input.is_active ?? null,
  });
  if (error) throw error;
}

export async function setStaffRoles(profileId: string, roles: UserRole[]): Promise<void> {
  const { error } = await requireSupabaseClient().rpc('fn_set_staff_roles', {
    p_profile_id: profileId,
    p_roles: roles,
  });
  if (error) throw error;
}

export async function deactivateStaff(profileId: string): Promise<void> {
  const { error } = await requireSupabaseClient().rpc('fn_deactivate_staff', {
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
