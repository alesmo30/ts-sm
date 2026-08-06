import { useQuery } from '@tanstack/react-query';
import { SessionSchema } from '@ts-sm/shared';
import { z } from 'zod';

import { apiClient } from '../../../shared/lib/apiClient';

export function useSessions(q?: string) {
  return useQuery({
    queryKey: ['sessions', q ?? ''],
    queryFn: () => {
      const search = q ? `?q=${encodeURIComponent(q)}` : '';
      return apiClient.get(`/sessions${search}`, z.array(SessionSchema));
    },
  });
}
