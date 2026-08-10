import { useQuery } from '@tanstack/react-query';
import { StatsCountsSchema } from '@ts-sm/shared';

import { apiClient } from '../../../shared/lib/apiClient';

export function useStatsCounts() {
  return useQuery({
    queryKey: ['stats-counts'],
    queryFn: () => apiClient.get('/stats/counts', StatsCountsSchema),
    refetchInterval: 15_000,
  });
}
