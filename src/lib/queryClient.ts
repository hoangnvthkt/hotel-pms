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
  guests: ['guests'] as const,
  folios: ['folios'] as const,
  hkTasks: ['hkTasks'] as const,
  reports: ['reports'] as const,
  dashboard: ['reports', 'dashboard'] as const,
  metadataOptions: (category?: string) => category ? ['metadata', category] as const : ['metadata'] as const,
  staff: ['staff'] as const,
  roles: ['roles'] as const,
  property: ['property'] as const,
};

