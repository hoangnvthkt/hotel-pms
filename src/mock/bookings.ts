import type { Booking } from '@/types';

const today = new Date();
const d = (offsetDays: number) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
};

export const mockBookings: Booking[] = [
  // Currently checked-in
  {
    id: 'bk-001', bookingNumber: 'BK-2026-0001', propertyId: 'prop-001',
    guestId: 'g-002', guestName: 'Trần Thị Bình', guestPhone: '0902 111 002',
    roomId: 'room-301', roomNumber: '301', roomTypeName: 'Phòng Superior',
    checkIn: d(-2), checkOut: d(1), nights: 3, adults: 2, children: 0,
    status: 'checked_in', source: 'direct', rateCode: 'BAR',
    ratePerNight: 1100000, totalAmount: 3300000, depositAmount: 1000000, depositPaid: true,
    createdAt: d(-5) + 'T08:00:00Z', createdBy: 'user-003',
  },
  {
    id: 'bk-002', bookingNumber: 'BK-2026-0002', propertyId: 'prop-001',
    guestId: 'g-003', guestName: 'Lê Minh Cường', guestPhone: '0903 111 003',
    roomId: 'room-501', roomNumber: '501', roomTypeName: 'Penthouse Suite',
    checkIn: d(-1), checkOut: d(3), nights: 4, adults: 2, children: 1,
    status: 'checked_in', source: 'phone', rateCode: 'CORP',
    ratePerNight: 4000000, totalAmount: 16000000, depositAmount: 5000000, depositPaid: true,
    notes: 'Khách VIP, cần hoa tươi và champagne khi nhận phòng',
    createdAt: d(-7) + 'T09:00:00Z', createdBy: 'user-002',
  },
  {
    id: 'bk-003', bookingNumber: 'BK-2026-0003', propertyId: 'prop-001',
    guestId: 'g-004', guestName: 'John Smith', guestPhone: '+1 555 012 3456',
    roomId: 'room-401', roomNumber: '401', roomTypeName: 'Phòng Deluxe',
    checkIn: d(-3), checkOut: d(0), nights: 3, adults: 1, children: 0,
    status: 'checked_in', source: 'ota_manual', rateCode: 'BAR',
    ratePerNight: 1500000, totalAmount: 4500000, depositAmount: 0, depositPaid: false,
    externalReference: 'BDC-9876543',
    createdAt: d(-10) + 'T10:00:00Z', createdBy: 'user-003',
  },
  // Today arrivals
  {
    id: 'bk-004', bookingNumber: 'BK-2026-0004', propertyId: 'prop-001',
    guestId: 'g-001', guestName: 'Nguyễn Văn An', guestPhone: '0901 111 001',
    roomId: 'room-201', roomNumber: '201', roomTypeName: 'Phòng Standard',
    checkIn: d(0), checkOut: d(2), nights: 2, adults: 2, children: 0,
    status: 'confirmed', source: 'direct', rateCode: 'BAR',
    ratePerNight: 800000, totalAmount: 1600000, depositAmount: 500000, depositPaid: true,
    createdAt: d(-3) + 'T11:00:00Z', createdBy: 'user-003',
  },
  {
    id: 'bk-005', bookingNumber: 'BK-2026-0005', propertyId: 'prop-001',
    guestId: 'g-005', guestName: 'Kim Min-jun', guestPhone: '+82 10 1234 5678',
    roomId: 'room-405', roomNumber: '405', roomTypeName: 'Phòng Junior Suite',
    checkIn: d(0), checkOut: d(4), nights: 4, adults: 2, children: 0,
    status: 'confirmed', source: 'ota_manual', rateCode: 'BAR',
    ratePerNight: 2200000, totalAmount: 8800000, depositAmount: 2000000, depositPaid: true,
    externalReference: 'AGO-12345678',
    createdAt: d(-14) + 'T07:00:00Z', createdBy: 'user-003',
  },
  {
    id: 'bk-006', bookingNumber: 'BK-2026-0006', propertyId: 'prop-001',
    guestId: 'g-006', guestName: 'Phạm Thu Dung', guestPhone: '0904 111 006',
    roomId: 'room-105', roomNumber: '105', roomTypeName: 'Phòng Standard',
    checkIn: d(0), checkOut: d(1), nights: 1, adults: 1, children: 0,
    status: 'confirmed', source: 'walk_in', rateCode: 'WALK',
    ratePerNight: 900000, totalAmount: 900000, depositAmount: 900000, depositPaid: true,
    createdAt: d(0) + 'T07:30:00Z', createdBy: 'user-003',
  },
  // Future bookings
  {
    id: 'bk-007', bookingNumber: 'BK-2026-0007', propertyId: 'prop-001',
    guestId: 'g-010', guestName: 'Ngô Thị Lan', guestPhone: '0907 111 010',
    roomId: 'room-505', roomNumber: '505', roomTypeName: 'Penthouse Suite',
    checkIn: d(2), checkOut: d(6), nights: 4, adults: 2, children: 0,
    status: 'confirmed', source: 'direct', rateCode: 'BAR',
    ratePerNight: 4500000, totalAmount: 18000000, depositAmount: 5000000, depositPaid: true,
    notes: 'VIP Diamond. Hoa lan trắng, rượu vang đỏ.',
    createdAt: d(-21) + 'T14:00:00Z', createdBy: 'user-002',
  },
  {
    id: 'bk-008', bookingNumber: 'BK-2026-0008', propertyId: 'prop-001',
    guestId: 'g-008', guestName: 'Emily Johnson', guestPhone: '+44 7700 900456',
    roomId: 'room-303', roomNumber: '303', roomTypeName: 'Phòng Deluxe',
    checkIn: d(3), checkOut: d(7), nights: 4, adults: 1, children: 0,
    status: 'tentative', source: 'phone', rateCode: 'BAR',
    ratePerNight: 1500000, totalAmount: 6000000, depositAmount: 0, depositPaid: false,
    notes: 'Đang chờ xác nhận từ khách',
    createdAt: d(-1) + 'T16:00:00Z', createdBy: 'user-003',
  },
  // Past / checked-out
  {
    id: 'bk-009', bookingNumber: 'BK-2026-0009', propertyId: 'prop-001',
    guestId: 'g-009', guestName: 'Đỗ Quốc Hùng', guestPhone: '0906 111 009',
    roomId: 'room-202', roomNumber: '202', roomTypeName: 'Phòng Standard',
    checkIn: d(-5), checkOut: d(-2), nights: 3, adults: 2, children: 0,
    status: 'checked_out', source: 'facebook', rateCode: 'BAR',
    ratePerNight: 800000, totalAmount: 2400000, depositAmount: 800000, depositPaid: true,
    createdAt: d(-10) + 'T08:00:00Z', createdBy: 'user-004',
  },
  {
    id: 'bk-010', bookingNumber: 'BK-2026-0010', propertyId: 'prop-001',
    guestId: 'g-001', guestName: 'Nguyễn Văn An', guestPhone: '0901 111 001',
    roomId: 'room-108', roomNumber: '108', roomTypeName: 'Phòng Standard',
    checkIn: d(-8), checkOut: d(-6), nights: 2, adults: 1, children: 0,
    status: 'cancelled', source: 'phone', rateCode: 'BAR',
    ratePerNight: 800000, totalAmount: 1600000, depositAmount: 500000, depositPaid: true,
    notes: 'Khách hủy do thay đổi lịch công tác. Đã hoàn cọc.',
    createdAt: d(-15) + 'T10:00:00Z', createdBy: 'user-003',
  },
];
