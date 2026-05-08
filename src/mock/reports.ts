import type { DashboardStats } from '@/types';

export const mockDashboardStats: DashboardStats = {
  occupancyRate: 62,
  occupiedRooms: 31,
  totalRooms: 50,
  availableRooms: 12,
  dirtyRooms: 5,
  maintenanceRooms: 2,
  todayArrivals: 6,
  todayDepartures: 4,
  inHouseGuests: 31,
  todayRevenue: 18500000,
  monthRevenue: 312000000,
  adr: 1580000,
  revpar: 979600,
  unpaidFolios: 3,
  pendingHKTasks: 4,
};

export const mockOccupancyTrend = [
  { date: 'T2', occupancy: 55, revenue: 14200000 },
  { date: 'T3', occupancy: 62, revenue: 16800000 },
  { date: 'T4', occupancy: 70, revenue: 19500000 },
  { date: 'T5', occupancy: 78, revenue: 22000000 },
  { date: 'T6', occupancy: 85, revenue: 26000000 },
  { date: 'T7', occupancy: 92, revenue: 31000000 },
  { date: 'CN', occupancy: 62, revenue: 18500000 },
];

export const mockRevenueBreakdown = [
  { month: 'T1', room: 210000000, service: 45000000 },
  { month: 'T2', room: 185000000, service: 38000000 },
  { month: 'T3', room: 230000000, service: 52000000 },
  { month: 'T4', room: 275000000, service: 61000000 },
  { month: 'T5', room: 312000000, service: 68000000 },
];

export const mockBookingSources = [
  { name: 'Trực tiếp', value: 35, color: '#3b82f6' },
  { name: 'OTA', value: 28, color: '#8b5cf6' },
  { name: 'Điện thoại', value: 20, color: '#10b981' },
  { name: 'Facebook', value: 12, color: '#f59e0b' },
  { name: 'Walk-in', value: 5, color: '#ef4444' },
];
