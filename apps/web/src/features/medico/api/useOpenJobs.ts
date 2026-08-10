import { useQuery } from '@tanstack/react-query';
import { IngestJobSchema } from '@ts-sm/shared';
import { z } from 'zod';

import { apiClient } from '../../../shared/lib/apiClient';

export function useOpenJobs() {
  return useQuery({
    queryKey: ['knowledge', 'jobs'],
    queryFn: () => apiClient.get('/knowledge/jobs', z.array(IngestJobSchema)),
  });
}
