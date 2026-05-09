import { queryKeys } from '@/lib/queryClient';
import { requireSupabaseClient, supabase } from '@/lib/supabase';
import { mockBookings } from '@/mock/bookings';
import { mockGuests } from '@/mock/guests';
import { mockHKTasks } from '@/mock/housekeeping';
import { mockDashboardStats } from '@/mock/reports';
import { mockRooms, mockRoomTypes } from '@/mock/rooms';
import type { Booking, DashboardStats, Guest, HKTask, Room, RoomType } from '@/types';

export const useMocks =
  import.meta.env.VITE_USE_MOCKS === 'true' ||
  !supabase;

export { queryKeys };

export async function fetchRooms(): Promise<Room[]> {
  if (useMocks) return mockRooms;
  const { data, error } = await requireSupabaseClient()
    .from('rooms')
    .select('*, room_types(name)')
    .order('number', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
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
  }));
}

export async function fetchRoomTypes(): Promise<RoomType[]> {
  if (useMocks) return mockRoomTypes;
  const { data, error } = await requireSupabaseClient().from('room_types').select('*').order('code');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    code: row.code,
    maxOccupancy: row.max_occupancy,
    bedType: row.bed_type,
    area: row.area,
    amenities: row.amenities ?? [],
    description: row.description ?? '',
    basePrice: row.base_price,
  }));
}

export async function fetchBookings(): Promise<Booking[]> {
  if (useMocks) return mockBookings;
  const { data, error } = await requireSupabaseClient()
    .from('bookings')
    .select('*, guests(full_name, phone), booking_rooms(room_id, rooms(number, room_types(name)))')
    .order('check_in', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => {
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
      ratePerNight: row.rate_per_night,
      totalAmount: row.total_amount,
      depositAmount: row.deposit_amount,
      depositPaid: row.deposit_paid,
      externalReference: row.external_reference ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
      createdBy: row.created_by ?? '',
    };
  });
}

export async function fetchGuests(): Promise<Guest[]> {
  if (useMocks) return mockGuests;
  const { data, error } = await requireSupabaseClient().from('guests').select('*').order('full_name');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
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
  }));
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
