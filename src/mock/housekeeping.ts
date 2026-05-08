import type { HKTask } from '@/types';

const today = new Date().toISOString().slice(0, 10);

export const mockHKTasks: HKTask[] = [
  {
    id: 'hk-001', propertyId: 'prop-001',
    roomId: 'room-202', roomNumber: '202', floor: 2,
    taskType: 'checkout_clean', status: 'pending', priority: 'high',
    assignedTo: 'user-006', assignedToName: 'Ngô Thị Mai',
    notes: 'Khách vừa checkout, ưu tiên dọn nhanh',
    createdAt: today + 'T07:00:00Z',
  },
  {
    id: 'hk-002', propertyId: 'prop-001',
    roomId: 'room-101', roomNumber: '101', floor: 1,
    taskType: 'daily_service', status: 'in_progress', priority: 'normal',
    assignedTo: 'user-006', assignedToName: 'Ngô Thị Mai',
    createdAt: today + 'T07:00:00Z',
    startedAt: today + 'T08:30:00Z',
  },
  {
    id: 'hk-003', propertyId: 'prop-001',
    roomId: 'room-103', roomNumber: '103', floor: 1,
    taskType: 'daily_service', status: 'done', priority: 'normal',
    assignedTo: 'user-007', assignedToName: 'Đinh Văn Tuấn',
    createdAt: today + 'T07:00:00Z',
    startedAt: today + 'T08:00:00Z',
    completedAt: today + 'T09:00:00Z',
  },
  {
    id: 'hk-004', propertyId: 'prop-001',
    roomId: 'room-205', roomNumber: '205', floor: 2,
    taskType: 'daily_service', status: 'inspected', priority: 'normal',
    assignedTo: 'user-007', assignedToName: 'Đinh Văn Tuấn',
    inspectorId: 'user-005', inspectorName: 'Hoàng Thị Lan',
    inspectionNotes: 'Phòng sạch, đạt tiêu chuẩn',
    createdAt: today + 'T07:00:00Z',
    startedAt: today + 'T07:30:00Z',
    completedAt: today + 'T08:30:00Z',
    inspectedAt: today + 'T09:00:00Z',
  },
  {
    id: 'hk-005', propertyId: 'prop-001',
    roomId: 'room-304', roomNumber: '304', floor: 3,
    taskType: 'deep_clean', status: 'pending', priority: 'urgent',
    assignedTo: undefined, assignedToName: undefined,
    notes: 'Phòng OOO vừa xong bảo trì, cần deep clean trước khi bán',
    createdAt: today + 'T09:00:00Z',
  },
  {
    id: 'hk-006', propertyId: 'prop-001',
    roomId: 'room-402', roomNumber: '402', floor: 4,
    taskType: 'checkout_clean', status: 'rejected', priority: 'high',
    assignedTo: 'user-007', assignedToName: 'Đinh Văn Tuấn',
    inspectorId: 'user-005', inspectorName: 'Hoàng Thị Lan',
    inspectionNotes: 'Còn bẩn góc phòng tắm, thiếu khăn mặt',
    createdAt: today + 'T06:30:00Z',
    startedAt: today + 'T07:00:00Z',
    completedAt: today + 'T08:00:00Z',
    inspectedAt: today + 'T08:30:00Z',
  },
  {
    id: 'hk-007', propertyId: 'prop-001',
    roomId: 'room-110', roomNumber: '110', floor: 1,
    taskType: 'turndown', status: 'pending', priority: 'low',
    assignedTo: 'user-006', assignedToName: 'Ngô Thị Mai',
    notes: 'Dọn tối, khách về lúc 22h',
    createdAt: today + 'T10:00:00Z',
  },
];

export const mockLostFound = [
  {
    id: 'lf-001', propertyId: 'prop-001',
    roomNumber: '301', floor: 3,
    description: 'Sạc điện thoại iPhone màu trắng',
    foundBy: 'Ngô Thị Mai', foundAt: today + 'T09:30:00Z',
    status: 'stored',
    storageLocation: 'Tủ thất lạc - Housekeeping office',
  },
  {
    id: 'lf-002', propertyId: 'prop-001',
    roomNumber: '205', floor: 2,
    description: 'Ví da màu nâu, bên trong có CCCD',
    foundBy: 'Đinh Văn Tuấn', foundAt: today + 'T08:00:00Z',
    guestName: 'Nguyễn Văn An',
    status: 'claimed',
    storageLocation: 'Đã trả cho khách',
  },
];
