import { useQuery } from '@tanstack/react-query';
import { IngestJobSchema } from '@ts-sm/shared';

import { apiClient } from '../lib/apiClient';

const POLL_INTERVAL_MS = 2000;

function isTerminal(stage: string, error: string | null): boolean {
  return stage === 'Indexado' || error !== null;
}

export function useIngestJob(jobId: string | null) {
  return useQuery({
    queryKey: ['knowledge', 'jobs', jobId],
    queryFn: () => apiClient.get(`/knowledge/jobs/${jobId}`, IngestJobSchema),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || !isTerminal(data.stage, data.error)) return POLL_INTERVAL_MS;
      return false;
    },
  });
}
