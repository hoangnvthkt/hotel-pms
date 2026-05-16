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

export type PaymentStatus = 'draft' | 'pending_verification' | 'posted' | 'finalized' | 'voided' | 'refunded';

export type InvoiceStatus = 'draft' | 'issued' | 'voided';

export type FolioStatus = 'open' | 'closed' | 'invoiced';

export type BusinessDateStatus = 'open' | 'auditing' | 'closed';

export type UserRole = 'admin' | 'manager' | 'receptionist' | 'hk_supervisor' | 'hk_staff' | 'accountant';

export type BookingSource = 'walk_in' | 'phone' | 'facebook' | 'direct' | 'ota_manual' | 'website_later';

export type NotificationType = 'booking' | 'payment' | 'housekeeping' | 'room' | 'night_audit' | 'system';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export type GuestRequestType =
  | 'service_order'
  | 'complaint'
  | 'housekeeping'
  | 'maintenance'
  | 'billing'
  | 'lost_found'
  | 'special_request'
  | 'feedback';

export type GuestRequestStatus =
  | 'new'
  | 'triaged'
  | 'assigned'
  | 'in_progress'
  | 'waiting_guest'
  | 'waiting_vendor'
  | 'resolved'
  | 'closed'
  | 'cancelled'
  | 'escalated';

export type GuestRequestSource = 'front_desk' | 'phone' | 'email' | 'chat' | 'qr' | 'internal' | 'post_stay';

export type FolioItemSourceType =
  | 'room'
  | 'manual_service'
  | 'minibar'
  | 'laundry'
  | 'restaurant_later'
  | 'event_later'
  | 'room_adjustment'
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
  roles?: UserRole[];
  avatar?: string;
  avatarPath?: string;
  avatarUrl?: string;
  phone?: string;
  positionTitle?: string;
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
  rateCode: string;
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

export interface BookingService {
  id: string;
  propertyId: string;
  bookingId: string;
  serviceCode: string;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  serviceDate?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface FolioItem {
  id: string;
  folioId: string;
  type: 'debit' | 'credit';
  sourceType: FolioItemSourceType;
  sourceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  date: string;
  postedBy: string;
}

export interface FolioProjection {
  folioId: string;
  bookingId: string;
  roomNights: number;
  ratePerNight: number;
  postedRoomCharges: number;
  projectedRoomCharges: number;
  roomAdjustmentDebits: number;
  roomAdjustmentCredits: number;
  roomAdjustmentToCredit: number;
  roomBalance: number;
  roomChargeToPost: number;
  serviceCharges: number;
  depositCredits: number;
  paymentCredits: number;
  pendingFolioPayments: number;
  pendingDeposits: number;
  pendingPayments: number;
  postedBalance: number;
  projectedBalance: number;
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
  payments?: Payment[];
  receipts?: Receipt[];
  parentFolioId?: string;
  projection?: FolioProjection;
}

export interface Payment {
  id: string;
  propertyId: string;
  folioId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  reference?: string;
  evidencePath?: string;
  receiptNumber?: string;
  cashierSessionId?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  receivedAt: string;
  receivedBy: string;
}

export interface BookingDeposit {
  id: string;
  propertyId: string;
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  evidencePath?: string;
  receiptNumber?: string;
  cashierSessionId?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  receivedAt: string;
  receivedBy?: string;
}

export interface Receipt {
  id: string;
  propertyId: string;
  receiptNumber: string;
  receiptType: 'deposit' | 'payment' | 'refund';
  bookingId?: string;
  folioId?: string;
  paymentId?: string;
  bookingDepositId?: string;
  refundId?: string;
  amount: number;
  method?: PaymentMethod;
  status: 'issued' | 'voided';
  pdfUrl?: string;
  issuedAt: string;
  issuedBy?: string;
}

export interface CashierSession {
  id: string;
  propertyId: string;
  cashierId: string;
  cashierName?: string;
  status: 'open' | 'closed' | 'approved' | 'voided';
  openingFloat: number;
  cashReceived: number;
  cashRefunded: number;
  expectedCash: number;
  declaredCash?: number;
  variance?: number;
  note?: string;
  openedAt: string;
  closedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface CashierSessionTransaction {
  id: string;
  sessionId: string;
  kind: 'deposit' | 'payment' | 'refund';
  guestName?: string;
  bookingNumber?: string;
  roomNumber?: string;
  method?: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  reference?: string;
  receiptNumber?: string;
  occurredAt: string;
  actorId?: string;
}

export interface PaymentVerificationItem {
  id: string;
  kind: 'payment' | 'deposit';
  propertyId: string;
  bookingId?: string;
  folioId?: string;
  bookingNumber?: string;
  guestName?: string;
  roomNumber?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  reference?: string;
  evidencePath?: string;
  receiptNumber?: string;
  receivedAt: string;
  receivedBy?: string;
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

export interface NightAuditIssue {
  bookingId?: string;
  bookingNumber?: string;
  folioId?: string;
  folioNumber?: string;
  paymentId?: string;
  depositId?: string;
  taskId?: string;
  guestName?: string;
  roomNumber?: string;
  status?: string;
  amount?: number;
  balance?: number;
  date?: string;
  label?: string;
}

export interface NightAuditPrecheck {
  businessDate: string;
  status?: BusinessDateStatus;
  isClosed: boolean;
  canRun: boolean;
  blockersCount: number;
  warningsCount: number;
  summary: {
    openDepartures: number;
    unpaidFolios: number;
    pendingPayments: number;
    pendingDeposits: number;
    openHousekeepingTasks: number;
    noShowCandidates: number;
    roomChargeCandidates: number;
    roomChargeTotal: number;
  };
  blockers: {
    openDepartures: NightAuditIssue[];
    unpaidFolios: NightAuditIssue[];
    pendingPayments: NightAuditIssue[];
    pendingDeposits: NightAuditIssue[];
    openHousekeepingTasks: NightAuditIssue[];
  };
  warnings: {
    noShowCandidates: NightAuditIssue[];
  };
}

export interface NightAuditLog {
  id: string;
  propertyId: string;
  businessDate: string;
  step: string;
  summary: Record<string, unknown>;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface NightAuditRunResult {
  precheck?: NightAuditPrecheck;
  postedRoomCharges: number;
  noShowBookings: number;
  roomRevenue: number;
  serviceRevenue: number;
  payments: number;
  lockedBusinessDate: string;
  nextBusinessDate: string;
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

export interface LostFoundItem {
  id: string;
  propertyId: string;
  roomId?: string;
  roomNumber?: string;
  floor?: number;
  guestId?: string;
  guestName?: string;
  description: string;
  foundBy?: string;
  foundAt: string;
  status: 'stored' | 'claimed' | 'disposed';
  storageLocation?: string;
  notes?: string;
}

export interface Notification {
  id: string;
  propertyId: string;
  recipientId: string;
  actorId?: string;
  actorName?: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  readAt?: string;
  dismissedAt?: string;
  createdAt: string;
}

export interface GuestRequestComment {
  id: string;
  propertyId: string;
  requestId: string;
  comment: string;
  isInternal: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface GuestRequestEvent {
  id: string;
  propertyId: string;
  requestId: string;
  eventType: string;
  oldStatus?: GuestRequestStatus;
  newStatus?: GuestRequestStatus;
  payload: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
}

export interface GuestRequest {
  id: string;
  propertyId: string;
  requestNumber: string;
  type: GuestRequestType;
  status: GuestRequestStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  source: GuestRequestSource;
  title: string;
  description?: string;
  bookingId?: string;
  bookingNumber?: string;
  guestId?: string;
  guestName?: string;
  guestPhone?: string;
  roomId?: string;
  roomNumber?: string;
  department: string;
  assignedTo?: string;
  assignedToName?: string;
  dueAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  resolution?: string;
  compensationAmount: number;
  folioItemId?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  comments?: GuestRequestComment[];
  events?: GuestRequestEvent[];
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
