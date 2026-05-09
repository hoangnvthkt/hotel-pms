// ============================================================
// GLOBAL TYPES — Hotel PMS
// ============================================================

export type RoomStatus =
  | 'vacant_clean'
  | 'vacant_dirty'
  | 'occupied'
  | 'occupied_dirty'
  | 'occupied_clean'
  | 'inspected'
  | 'out_of_order'
  | 'blocked';

export type BookingStatus =
  | 'tentative'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type HKTaskStatus = 'pending' | 'in_progress' | 'done' | 'inspected' | 'rejected';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'qr_manual' | 'card_manual' | 'gateway_later';

export type PaymentStatus = 'draft' | 'posted' | 'finalized' | 'voided' | 'refunded';

export type InvoiceStatus = 'draft' | 'issued' | 'voided';

export type FolioStatus = 'open' | 'closed' | 'invoiced';

export type BusinessDateStatus = 'open' | 'auditing' | 'closed';

export type UserRole = 'admin' | 'manager' | 'receptionist' | 'hk_supervisor' | 'hk_staff' | 'accountant';

export type BookingSource = 'walk_in' | 'phone' | 'facebook' | 'direct' | 'ota_manual' | 'website_later';

export type FolioItemSourceType =
  | 'room'
  | 'manual_service'
  | 'minibar'
  | 'laundry'
  | 'restaurant_later'
  | 'event_later'
  | 'payment'
  | 'deposit'
  | 'refund'
  | 'other';

// -------------------------
export interface Property {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  stars: number;
  totalRooms: number;
  checkInTime: string;
  checkOutTime: string;
  currency: string;
  timezone: string;
}

export interface User {
  id: string;
  propertyId: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  isActive: boolean;
}

export interface RoomType {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  maxOccupancy: number;
  bedType: string;
  area: number; // m2
  amenities: string[];
  description: string;
  basePrice: number;
}

export interface RoomRate {
  id: string;
  propertyId: string;
  roomTypeId: string;
  rateCode: 'BAR' | 'WALK' | 'CORP' | 'SEASONAL';
  name: string;
  amount: number;
  currency: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}

export interface Room {
  id: string;
  propertyId: string;
  roomTypeId: string;
  roomTypeName: string;
  number: string;
  floor: number;
  status: RoomStatus;
  isActive: boolean;
  notes?: string;
  lastCleaned?: string;
  currentGuestName?: string;
  currentBookingId?: string;
  checkOutDate?: string;
}

export interface MaintenanceTicket {
  id: string;
  propertyId: string;
  roomId: string;
  roomNumber: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: string;
  resolvedAt?: string;
}

export interface Guest {
  id: string;
  propertyId: string;
  firstName: string;
  lastName: string;
  fullName: string;
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
  isVip: boolean;
  isBlacklisted: boolean;
  blacklistReason?: string;
  loyaltyCode?: string;
  notes?: string;
  totalStays: number;
  totalSpent: number;
  createdAt: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  propertyId: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  checkIn: string; // ISO date
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  status: BookingStatus;
  source: BookingSource;
  rateCode: string;
  ratePerNight: number;
  totalAmount: number;
  depositAmount: number;
  depositPaid: boolean;
  externalReference?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface FolioItem {
  id: string;
  folioId: string;
  type: 'debit' | 'credit';
  sourceType: FolioItemSourceType;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  date: string;
  postedBy: string;
}

export interface Folio {
  id: string;
  bookingId: string;
  propertyId: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  items: FolioItem[];
  totalDebits: number;
  totalCredits: number;
  balance: number;
  status: FolioStatus;
  parentFolioId?: string;
}

export interface Payment {
  id: string;
  propertyId: string;
  folioId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  reference?: string;
  receivedAt: string;
  receivedBy: string;
}

export interface Invoice {
  id: string;
  propertyId: string;
  folioId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issuedAt?: string;
  totalAmount: number;
  pdfUrl?: string;
}

export interface BusinessDate {
  id: string;
  propertyId: string;
  businessDate: string;
  status: BusinessDateStatus;
  closedAt?: string;
  closedBy?: string;
}

export interface HKTask {
  id: string;
  propertyId: string;
  roomId: string;
  roomNumber: string;
  floor: number;
  taskType: 'checkout_clean' | 'daily_service' | 'turndown' | 'inspection' | 'deep_clean';
  status: HKTaskStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: string;
  assignedToName?: string;
  notes?: string;
  inspectorId?: string;
  inspectorName?: string;
  inspectionNotes?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  inspectedAt?: string;
}

export interface DashboardStats {
  occupancyRate: number;
  occupiedRooms: number;
  totalRooms: number;
  availableRooms: number;
  dirtyRooms: number;
  maintenanceRooms: number;
  todayArrivals: number;
  todayDepartures: number;
  inHouseGuests: number;
  todayRevenue: number;
  monthRevenue: number;
  adr: number;
  revpar: number;
  unpaidFolios: number;
  pendingHKTasks: number;
}
