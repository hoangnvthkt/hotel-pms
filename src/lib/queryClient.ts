import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const queryKeys = {
  rooms: ['rooms'] as const,
  roomTypes: ['roomTypes'] as const,
  roomRates: ['roomRates'] as const,
  bookings: ['bookings'] as const,
  bookingServices: (bookingId?: string) => ['bookingServices', bookingId ?? ''] as const,
  availability: (roomTypeId?: string, checkIn?: string, checkOut?: string) =>
    ['availability', roomTypeId ?? '', checkIn ?? '', checkOut ?? ''] as const,
  guests: ['guests'] as const,
  folios: ['folios'] as const,
  bookingDeposits: (bookingId?: string) => ['bookingDeposits', bookingId ?? ''] as const,
  paymentQueue: ['payments', 'verificationQueue'] as const,
  cashierSessions: ['cashierSessions'] as const,
  receipts: ['receipts'] as const,
  hkTasks: ['hkTasks'] as const,
  lostFound: ['lostFound'] as const,
  guestRequests: ['guestRequests'] as const,
  guestRequestComments: (requestId?: string) => ['guestRequests', requestId ?? '', 'comments'] as const,
  notifications: ['notifications'] as const,
  notificationCount: ['notifications', 'unreadCount'] as const,
  reports: ['reports'] as const,
  dashboard: ['reports', 'dashboard'] as const,
  businessDate: ['nightAudit', 'businessDate'] as const,
  nightAuditPrecheck: (businessDate?: string) => ['nightAudit', 'precheck', businessDate ?? ''] as const,
  nightAuditLogs: (businessDate?: string) => ['nightAudit', 'logs', businessDate ?? ''] as const,
  account: ['account'] as const,
  metadataOptions: (category?: string) => category ? ['metadata', category] as const : ['metadata'] as const,
  staff: ['staff'] as const,
  roles: ['roles'] as const,
  property: ['property'] as const,
};
