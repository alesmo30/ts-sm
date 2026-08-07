import { useQuery } from '@tanstack/react-query';
import { KbStateSchema } from '@ts-sm/shared';

import { apiClient } from '../../../shared/lib/apiClient';

export function useKbState() {
  return useQuery({
    queryKey: ['knowledge', 'state'],
    queryFn: () => apiClient.get('/knowledge/state', KbStateSchema),
  });
}
