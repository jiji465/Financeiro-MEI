// Providers globais. P1-C (Web core) acrescenta Toaster (sonner), tema, banner offline etc.
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryClient } from '@/app/query-client';

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
