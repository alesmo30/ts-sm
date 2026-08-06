import { useQuery } from '@tanstack/react-query';
import { SessionDetailSchema } from '@ts-sm/shared';

import { apiClient } from '../../../shared/lib/apiClient';

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ['sessions', id],
    queryFn: () => apiClient.get(`/sessions/${id}`, SessionDetailSchema),
    enabled: Boolean(id),
  });
}
