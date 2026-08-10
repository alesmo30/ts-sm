import { useQuery } from '@tanstack/react-query';
import { ReferenceSchema, type ReferenceOrigin } from '@ts-sm/shared';
import { z } from 'zod';

import { apiClient } from '../lib/apiClient';

export interface UseReferencesOptions {
  origin?: ReferenceOrigin;
  includeInactive?: boolean;
}

export function useReferences(options: UseReferencesOptions = {}) {
  const { origin, includeInactive } = options;

  return useQuery({
    queryKey: ['references', { origin, includeInactive }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (origin) params.set('origin', origin);
      if (includeInactive) params.set('includeInactive', 'true');
      const query = params.toString();
      return apiClient.get(`/knowledge/references${query ? `?${query}` : ''}`, z.array(ReferenceSchema));
    },
  });
}
