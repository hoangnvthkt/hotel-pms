import type { RoomType, Room, RoomRate, RoomStatus } from '@/types';

export const mockRoomTypes: RoomType[] = [
  {
    id: 'rt-001',
    propertyId: 'prop-001',
    name: 'Phòng Standard',
    code: 'STD',
    maxOccupancy: 2,
    bedType: 'Giường đôi',
    area: 22,
    amenities: ['WiFi', 'TV', 'Điều hòa', 'Minibar', 'Két an toàn'],
    description: 'Phòng tiêu chuẩn thoải mái cho 2 khách',
    basePrice: 800000,
  },
  {
    id: 'rt-002',
    propertyId: 'prop-001',
    name: 'Phòng Superior',
    code: 'SUP',
    maxOccupancy: 2,
    bedType: 'Giường King',
    area: 28,
    amenities: ['WiFi', 'TV', 'Điều hòa', 'Minibar', 'Két an toàn', 'View thành phố'],
    description: 'Phòng Superior với view đẹp',
    basePrice: 1100000,
  },
  {
    id: 'rt-003',
    propertyId: 'prop-001',
    name: 'Phòng Deluxe',
    code: 'DLX',
    maxOccupancy: 2,
    bedType: 'Giường King',
    area: 35,
    amenities: ['WiFi', 'TV', 'Điều hòa', 'Minibar', 'Két an toàn', 'View hồ bơi', 'Bồn tắm'],
    description: 'Phòng Deluxe cao cấp với bồn tắm',
    basePrice: 1500000,
  },
  {
    id: 'rt-004',
    propertyId: 'prop-001',
    name: 'Phòng Junior Suite',
    code: 'JSU',
    maxOccupancy: 3,
    bedType: 'Giường King + Sofa bed',
    area: 45,
    amenities: ['WiFi', 'TV', 'Điều hòa', 'Minibar', 'Két an toàn', 'Phòng khách riêng', 'Bồn tắm'],
    description: 'Suite nhỏ với phòng khách riêng',
    basePrice: 2200000,
  },
  {
    id: 'rt-005',
    propertyId: 'prop-001',
    name: 'Penthouse Suite',
    code: 'PHS',
    maxOccupancy: 4,
    bedType: 'Giường King + 2 Giường đôi',
    area: 80,
    amenities: ['WiFi', 'TV', '2 Điều hòa', 'Minibar', 'Két an toàn', 'Phòng khách', 'Bếp nhỏ', 'Sân thượng riêng', 'Bồn tắm jacuzzi'],
    description: 'Penthouse sang trọng tầng thượng',
    basePrice: 4500000,
  },
];

const defaultRateConfigs: Array<{
  rateCode: string;
  name: string;
  multiplier: number;
}> = [
  { rateCode: 'BAR', name: 'Best Available Rate', multiplier: 1 },
  { rateCode: 'WALK', name: 'Walk-in Rate', multiplier: 1.1 },
  { rateCode: 'CORP', name: 'Corporate Rate', multiplier: 0.9 },
];

export const mockRoomRates: RoomRate[] = mockRoomTypes.flatMap(roomType =>
  defaultRateConfigs.map(rate => ({
    id: `rr-${roomType.code}-${rate.rateCode}`,
    propertyId: roomType.propertyId,
    roomTypeId: roomType.id,
    rateCode: rate.rateCode,
    name: rate.name,
    amount: Math.round(roomType.basePrice * rate.multiplier),
    currency: 'VND',
    isActive: true,
  })),
);

// Helpers
const statuses: RoomStatus[] = [
  'vacant_clean', 'vacant_clean', 'vacant_clean', 'vacant_clean',
  'occupied', 'occupied', 'occupied', 'occupied', 'occupied',
  'vacant_dirty', 'vacant_dirty',
  'inspected',
  'out_of_order',
];

function pick<T>(arr: T[], idx: number): T {
  return arr[idx % arr.length];
}

// Generate 50 rooms across 5 floors (10 rooms per floor)
// Floor 1: STD (101–110), Floor 2: STD/SUP (201–210), Floor 3: SUP/DLX (301–310)
// Floor 4: DLX/JSU (401–410), Floor 5: JSU/PHS (501–510)
const roomConfig: Array<{ floor: number; start: number; types: string[] }> = [
  { floor: 1, start: 101, types: ['rt-001', 'rt-001', 'rt-001', 'rt-001', 'rt-001', 'rt-001', 'rt-001', 'rt-001', 'rt-001', 'rt-001'] },
  { floor: 2, start: 201, types: ['rt-001', 'rt-001', 'rt-001', 'rt-001', 'rt-002', 'rt-002', 'rt-002', 'rt-002', 'rt-002', 'rt-002'] },
  { floor: 3, start: 301, types: ['rt-002', 'rt-002', 'rt-002', 'rt-002', 'rt-003', 'rt-003', 'rt-003', 'rt-003', 'rt-003', 'rt-003'] },
  { floor: 4, start: 401, types: ['rt-003', 'rt-003', 'rt-003', 'rt-003', 'rt-003', 'rt-004', 'rt-004', 'rt-004', 'rt-004', 'rt-004'] },
  { floor: 5, start: 501, types: ['rt-004', 'rt-004', 'rt-004', 'rt-004', 'rt-004', 'rt-005', 'rt-005', 'rt-005', 'rt-005', 'rt-005'] },
];

const guestNames = [
  'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Minh Cường', 'Phạm Thu Dung',
  'Hoàng Quốc Hùng', 'Đỗ Thị Lan', 'Vũ Văn Nam', 'Bùi Thị Oanh',
  'Đặng Minh Phúc', 'Ngô Thị Quỳnh', 'John Smith', 'Emily Johnson',
  'Wang Wei', 'Kim Min-jun',
];

let roomIdx = 0;
export const mockRooms: Room[] = roomConfig.flatMap(({ floor, start, types }) =>
  types.map((typeId, i) => {
    const number = String(start + i);
    const roomType = mockRoomTypes.find(rt => rt.id === typeId)!;
    const status = pick(statuses, roomIdx);
    const isOccupied = status === 'occupied' || status === 'occupied_dirty' || status === 'occupied_clean';
    const guestName = isOccupied ? pick(guestNames, roomIdx) : undefined;
    const checkOutDate = isOccupied
      ? new Date(Date.now() + pick([1, 2, 3, 5], roomIdx) * 86400000).toISOString().slice(0, 10)
      : undefined;
    roomIdx++;
    return {
      id: `room-${number}`,
      propertyId: 'prop-001',
      roomTypeId: typeId,
      roomTypeName: roomType.name,
      number,
      floor,
      status,
      isActive: status !== 'out_of_order' || number === '304',
      notes: status === 'out_of_order' ? 'Đang bảo trì điều hòa' : undefined,
      lastCleaned: status === 'vacant_clean' ? '2026-05-08T08:00:00' : undefined,
      currentGuestName: guestName,
      currentBookingId: isOccupied ? `BK-2026-${number}` : undefined,
      checkOutDate,
    };
  })
);
